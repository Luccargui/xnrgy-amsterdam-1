// Sincroniza resultados, clasificación y horarios desde la liga en MijnKNLTB.
//   POST {action:"sync"} + cabecera x-cron-secret  -> lo lanza pg_cron (sábados cada 20 min y dos veces al día)
//   POST {action:"probe", paths:[...]}              -> lee páginas para depurar (sin datos de la cuenta)
// La cuenta de MijnKNLTB va en los secretos KNLTB_LOGIN y KNLTB_PASSWORD de Supabase; nunca sale de aquí.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { parseStandings, parseDrawMatches, parseTeamMatch } from "./parse.ts";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const HOST = "https://mijnknltb.toernooi.nl";
const LEAGUE = "29119B50-5DBF-428B-A636-B16B52242F5C", DRAW = 361, US = "XNRGY AMSTERDAM 1";

async function cronOk(req: Request) {
  const { data } = await sb.from("app_secrets").select("v").eq("k", "cron").maybeSingle();
  return !!data && req.headers.get("x-cron-secret") === data.v;
}

// Cada petición lleva su propia sesión (cookies), para que dos llamadas a la vez no se mezclen
type Session = { jar: Map<string, string> };
const newSession = (): Session => ({ jar: new Map() });
function keep(ss: Session, res: Response) {
  const all = (res.headers as any).getSetCookie ? (res.headers as any).getSetCookie() : [];
  for (const c of all) { const [kv] = c.split(";"); const i = kv.indexOf("="); if (i > 0) ss.jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim()); }
}
function cookieHeader(ss: Session) { return [...ss.jar].map(([k, v]) => k + "=" + v).join("; "); }
// Petición con cookies y redirecciones a mano (la web pide aceptar cookies antes de enseñar nada)
async function get(ss: Session, url: string, init: RequestInit = {}, trace: string[] = []): Promise<{ res: Response; url: string; trace: string[] }> {
  let u = url;
  for (let i = 0; i < 6; i++) {
    const res = await fetch(u, { ...init, redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (compatible; XNRGY-team-site/1.0)", "Accept": "text/html", "Accept-Language": "nl-NL,nl;q=0.9", Cookie: cookieHeader(ss), ...(init.headers || {}) } });
    keep(ss, res);
    trace.push(res.status + " " + u);
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) { u = new URL(loc, u).toString(); init = {}; continue; }
    return { res, url: u, trace };
  }
  throw new Error("too many redirects");
}
function clean(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "").replace(/<(head)[\s\S]*?<\/head>/i, "").replace(/\s+/g, " ")
    .replace(/ (class|data-[a-z-]+|aria-[a-z-]+|role|style|tabindex|id)="[^"]*"/g, (m, a) => a === "class" ? m : "");
}

// Abre una página de la liga pasando por las cookies (solo las básicas) y el inicio de sesión de MijnKNLTB
const LOGIN = Deno.env.get("KNLTB_LOGIN") || "", PASSWORD = Deno.env.get("KNLTB_PASSWORD") || "";
function redact(t: string) {
  let out = t;
  for (const v of [LOGIN, PASSWORD]) if (v && v.length > 2) out = out.split(v).join("***");
  return out;
}
async function open(ss: Session, host: string, path: string, trace: string[] = []): Promise<{ html: string; url: string; trace: string[]; loggedIn: boolean }> {
  let r = await get(ss, host + path, {}, trace);
  let html = await r.res.text();
  if (/\/cookiewall/i.test(r.url)) {
    const fd = new URLSearchParams({ ReturnUrl: path, SettingsOpen: "false" });
    r = await get(ss, new URL("/cookiewall/Save", r.url).toString(), { method: "POST", body: fd, headers: { "Content-Type": "application/x-www-form-urlencoded" } }, trace);
    html = await r.res.text();
  }
  if (/\/user\/login/i.test(r.url)) {
    if (!LOGIN || !PASSWORD) throw new Error("missing_credentials");
    const form = html.match(/<form[^>]*action="\/user"[\s\S]*?<\/form>/i)?.[0] || "";
    const fd = new URLSearchParams();
    for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/gi)) {
      const name = m[0].match(/name="([^"]+)"/i)?.[1]; if (!name) continue;
      fd.append(name, (m[0].match(/value="([^"]*)"/i)?.[1] || "").replace(/&amp;/g, "&"));
    }
    if (!fd.has("ReturnUrl")) fd.set("ReturnUrl", path);
    fd.set("Login", LOGIN); fd.set("Password", PASSWORD);
    r = await get(ss, new URL("/user", r.url).toString(), { method: "POST", body: fd, headers: { "Content-Type": "application/x-www-form-urlencoded" } }, trace);
    html = await r.res.text();
    if (/\/user\/login/i.test(r.url) || /<form[^>]*action="\/user"/i.test(html)) {
      // Motivo que da la propia página (sin datos de la cuenta)
      const msg = (html.match(/validation-summary-errors[\s\S]*?<\/ul>/i)?.[0] || html.match(/field-validation-error[^>]*>[^<]*/i)?.[0] || "")
        .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
      const err = new Error("login_failed") as Error & { detail?: unknown };
      err.detail = { url: r.url, trace, msg: redact(msg), fields: [...fd.keys()] };
      throw err;
    }
  }
  return { html, url: r.url, trace, loggedIn: !!LOGIN };
}


// ---------- Sincronización ----------
const up = (s: string) => (s || "").trim().toUpperCase();
const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const dayAms = (d = new Date()) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(d);
async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
type Status = { last_run?: string; last_ok?: string | null; error?: string | null; detail?: Record<string, any> };
async function readStatus(): Promise<Status> {
  const { data } = await sb.from("knltb_sync").select("*").eq("id", 1).maybeSingle();
  return data || { detail: {} };
}
async function saveStatus(st: Status) { await sb.from("knltb_sync").upsert({ id: 1, ...st }); }

// Convierte un partido de KNLTB en la fila de la jornada, visto desde nuestro equipo
type Finder = (p: { name: string; member: string | null }) => string | null;
function buildRound(tm: ReturnType<typeof parseTeamMatch>, id: number, listHome: string, listMsg: string, us: string, findPlayer: Finder, rd: any) {
  const unmatched: string[] = [];
  const ui = up(tm.home || listHome) === us ? 0 : 1, ti = 1 - ui;
  const flip = (p: [number, number] | null) => p ? [p[ui], p[ti]] : null;
  const results = tm.rubbers.map((rb) => {
    const mine = rb.sides.find((x) => up(x.team) === us) || rb.sides[ui] || { team: "", won: false, players: [] };
    const theirs = rb.sides.find((x) => x !== mine) || { team: "", won: false, players: [] };
    const sets = rb.sets.map((p) => [p[ui], p[ti]]);
    const ids = mine.players.map(findPlayer);
    mine.players.forEach((p, k) => { if (!ids[k]) unmatched.push(p.name); });
    return {
      code: rb.code, sets, score: sets.map((x) => x[0] + "-" + x[1]).join(" "),
      won: mine.won ? true : theirs.won ? false : null,
      names: mine.players.map((p) => p.name), players: ids, rivals: theirs.players.map((p) => p.name),
      ratings: mine.players.map((p) => p.rating), rivalRatings: theirs.players.map((p) => p.rating),
      status: rb.status || "", source: "knltb",
    };
  });
  const started = results.some((x) => x.sets.length || x.won !== null);
  const final = results.length > 0 && results.every((x) => x.won !== null);
  const part = flip(tm.partijen);
  const row: Record<string, unknown> = {
    results: started || results.some((x) => x.names.length) ? results : (rd ? rd.results : []),
    us: final && part ? part[0] : null, them: final && part ? part[1] : null,
    knltb: { id, final, message: tm.message || listMsg || "", points: flip(tm.points), partijen: part, sets: flip(tm.sets), games: flip(tm.games) },
  };
  // Con resultados, las parejas son las que de verdad jugaron
  if (started) row.pairs = [0, 1, 2, 3].map((i) => results[i] ? [results[i].players[0] || null, results[i].players[1] || null] : [null, null]);
  return { row, unmatched };
}

async function sync(force: boolean) {
  const prev = await readStatus();
  const detail: Record<string, any> = { ...(prev.detail || {}) };
  const now = new Date().toISOString();
  const credHash = await sha(LOGIN + "\u0000" + PASSWORD);
  // Si la cuenta falló hace poco con estos mismos datos, no se insiste (KNLTB podría bloquearla)
  if (!force && prev.error === "login_failed" && detail.badCred === credHash && prev.last_run && Date.now() - Date.parse(prev.last_run) < 12 * 3600e3) {
    return { ok: false, skipped: "login_paused" };
  }
  const info = { standings: 0, fixtures: 0, rounds: [] as number[], pages: 0, unmatched: [] as string[] };
  try {
    const ss = newSession();
    const draw = clean((await open(ss, HOST, `/league/${LEAGUE}/draw/${DRAW}`)).html); info.pages++;
    const table = parseStandings(draw);
    if (table.length < 2) throw new Error("parse_standings");
    const { error: se } = await sb.from("standings").upsert(table.map((x) => ({
      team: up(x.team), played: x.played, won: x.won, drawn: x.drawn, lost: x.lost, points: x.points,
      pos: x.pos, matches: x.matches, sets: x.sets, games: x.games, updated_at: now,
    })));
    if (se) throw se;
    info.standings = table.length;

    const ours = parseDrawMatches(draw).filter((m) => m.round && (up(m.home) === US || up(m.away) === US));
    // Fecha y hora de cada jornada tal como las publica KNLTB
    const { data: fx } = await sb.from("fixtures").select("r,date,time");
    for (const m of ours) {
      const f = (fx || []).find((x: any) => x.r === m.round);
      if (!f || !m.datetime) continue;
      const [d, t] = m.datetime.split(" ");
      if (f.date !== d || (f.time || null) !== (t || null)) {
        await sb.from("fixtures").update({ date: d, time: t || null, updated_at: now }).eq("r", m.round);
        info.fixtures++;
      }
    }

    // Resultados: partidos ya empezados o pasados que no estén cerrados, o cerrados hace poco (por si KNLTB corrige)
    const today = dayAms();
    const { data: rounds } = await sb.from("rounds").select("r,pairs,results,us,them,knltb");
    const checked: Record<string, string> = detail.checked || {};
    const due = ours.filter((m) => {
      if (!m.datetime || m.datetime.slice(0, 10) > today) return false;
      const rd = (rounds || []).find((x: any) => x.r === m.round);
      const final = !!(rd && rd.knltb && rd.knltb.final);
      const ageDays = (Date.parse(today) - Date.parse(m.datetime.slice(0, 10))) / 864e5;
      const last = checked[String(m.round)] ? Date.parse(checked[String(m.round)]) : 0;
      if (force) return true;
      if (!final) return true;
      return ageDays <= 10 && Date.now() - last > 6 * 3600e3;
    }).slice(0, 4);

    if (due.length) {
      const [{ data: pl }, { data: ct }] = await Promise.all([
        sb.from("players").select("id,first_name,last_name"),
        sb.from("player_contacts").select("id,knltb"),
      ]);
      const findPlayer = (p: { name: string; member: string | null }) => {
        const byMember = p.member && (ct || []).find((c: any) => c.knltb && c.knltb === p.member);
        if (byMember) return byMember.id as string;
        const n = norm(p.name);
        const exact = (pl || []).find((x: any) => norm(x.first_name + " " + x.last_name) === n);
        if (exact) return exact.id as string;
        const toks = n.split(" ");
        const loose = (pl || []).filter((x: any) => toks[0] === norm(x.first_name).split(" ")[0] && toks.includes(norm(x.last_name).split(" ")[0]));
        return loose.length === 1 ? loose[0].id as string : null;
      };
      for (const m of due) {
        const tm = parseTeamMatch(clean((await open(ss, HOST, `/league/${LEAGUE}/team-match/${m.id}`)).html)); info.pages++;
        checked[String(m.round)] = now;
        const rd = (rounds || []).find((x: any) => x.r === m.round);
        const { row, unmatched } = buildRound(tm, m.id, m.home, m.message, US, findPlayer, rd);
        info.unmatched.push(...unmatched);
        const same = rd && JSON.stringify([rd.results, rd.us, rd.them, rd.knltb, rd.pairs]) === JSON.stringify([row.results, row.us, row.them, row.knltb, row.pairs ?? rd.pairs]);
        if (same) continue; // sin cambios: no se toca la fila para no pisar a una capitana que esté editando
        const { error } = rd ? await sb.from("rounds").update(row).eq("r", m.round) : await sb.from("rounds").insert({ r: m.round, ...row });
        if (error) throw error;
        info.rounds.push(m.round as number);
      }
    }
    detail.checked = checked; delete detail.badCred;
    detail.info = info;
    await saveStatus({ last_run: now, last_ok: now, error: null, detail });
    return { ok: true, ...info };
  } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 200);
    if (msg === "login_failed") detail.badCred = credHash;
    await saveStatus({ last_run: now, last_ok: prev.last_ok || null, error: msg, detail });
    return { ok: false, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  if (!(await cronOk(req))) return new Response("forbidden", { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body.action === "sync") {
    const r = await sync(!!body.force);
    return Response.json(r, { status: r.ok || r.skipped ? 200 : 500 });
  }
  if (body.action === "parse") {
    // Para comprobar la lectura con cualquier partido: devuelve lo que se entiende de la página, sin guardar nada
    const path = String(body.path || "");
    if (!/^\/league\/[0-9A-F-]{36}\/(team-match|draw)\/\d+$/i.test(path)) return new Response("bad path", { status: 400 });
    const html = clean((await open(newSession(), HOST, path)).html);
    return Response.json(/team-match/.test(path) ? parseTeamMatch(html) : { standings: parseStandings(html), matches: parseDrawMatches(html) });
  }
  if (body.action === "preview") {
    // Igual que la sincronización pero con cualquier partido y equipo, sin guardar nada
    const path = String(body.path || "");
    if (!/^\/league\/[0-9A-F-]{36}\/team-match\/\d+$/i.test(path)) return new Response("bad path", { status: 400 });
    const tm = parseTeamMatch(clean((await open(newSession(), HOST, path)).html));
    return Response.json(buildRound(tm, 0, tm.home, "", up(String(body.us || tm.home)), () => null, null));
  }
  if (body.action === "probe") {
    const paths: string[] = Array.isArray(body.paths) ? body.paths : [String(body.path || "")];
    if (!paths.length || paths.some((p) => !/^\/(league|sport|team|match|player|player-profile)[\w\/\-\.\?=&%]*$/i.test(p))) return new Response("bad path", { status: 400 });
    const ss = newSession();
    const out: unknown[] = [];
    for (const path of paths.slice(0, 6)) {
      let r;
      try { r = await open(ss, HOST, path); } catch (e) { out.push({ path, error: String((e as Error).message), detail: (e as any).detail || null }); break; }
      let c = clean(r.html);
      const st = c.indexOf("page-content-start"); if (st > 0 && !body.full) c = c.slice(st);
      const ft = c.indexOf('class="footer'); if (ft > 0 && !body.full) c = c.slice(0, ft);
      const off = +body.offset || 0, lim = Math.min(+body.limit || 12000, 60000);
      out.push({ path, url: r.url, length: c.length, text: redact(c.slice(off, off + lim)) });
    }
    return Response.json(out);
  }
  return new Response("unknown action", { status: 400 });
});
