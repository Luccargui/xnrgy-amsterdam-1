// Avisos push del equipo.
//  POST {action:"vapid"}                     -> clave pública para suscribirse (se crea la primera vez)
//  POST {action:"test"}          + sesión     -> aviso de prueba a una misma
//  POST {action:"lineup", r}     + sesión de capitana/manager -> avisa a las alineadas en la jornada r
//  POST {action:"reminder"}      + cabecera x-cron-secret     -> recordatorio de disponibilidad (lo lanza pg_cron cada día)
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { generateVapid, sendPush, type Vapid } from "./webpush.ts";

const US = "XNRGY AMSTERDAM 1";
const SITE = "https://xnrgyams1.com/";
const SUBJECT = "mailto:bodaagustinymaru@gmail.com";
const SLOTS = ["DD1", "DD2", "DD3", "DD4"];
const STAFF = ["owner", "captain", "manager"];
const REMIND_DAYS = 4; // días antes de la jornada
const ROUNDS = [
  { r: 1, date: "2026-11-14", time: "12:30", home: US, away: "STROKEL 1" },
  { r: 2, date: "2026-11-28", time: null, home: "HEALTHCITY HOENDERDAAL 2", away: US },
  { r: 3, date: "2026-12-12", time: "09:30", home: US, away: "GAASPERPARK 1" },
  { r: 4, date: "2027-01-16", time: "10:30", home: "PLAZA PADEL AMERSFOORT 1", away: US },
  { r: 5, date: "2027-01-23", time: "09:30", home: US, away: "LEISURE WORLD PADEL 1" },
  { r: 6, date: "2027-01-30", time: "09:30", home: "VLTV 3", away: US },
  { r: 7, date: "2027-02-13", time: "14:00", home: "NIJKERK 1", away: US },
];
const LOC: Record<string, string> = { es: "es-ES", en: "en-GB", tr: "tr-TR", nl: "nl-NL" };
const T: Record<string, Record<string, string>> = {
  es: { lineupT: "Alineación jornada {r} · vs {rival}", lineupB: "Juegas {slot} con {partner}. {when}.", partnerTbd: "compañera por decidir", reminderT: "¿Juegas el {date}?", reminderB: "Jornada {r} vs {rival}. Marca tu disponibilidad para que la capitana pueda hacer la alineación.", testT: "Avisos activados", testB: "Así te llegarán las alineaciones y los recordatorios del equipo.", tbc: "hora por confirmar", meet: "Quedada {meet}" },
  en: { lineupT: "Line-up round {r} · vs {rival}", lineupB: "You play {slot} with {partner}. {when}.", partnerTbd: "partner to be decided", reminderT: "Are you playing on {date}?", reminderB: "Round {r} vs {rival}. Mark your availability so the captain can set the line-up.", testT: "Notifications on", testB: "This is how team line-ups and reminders will reach you.", tbc: "time to be confirmed", meet: "Meet-up {meet}" },
  tr: { lineupT: "{r}. hafta kadrosu · {rival}", lineupB: "{partner} ile {slot} oynuyorsun. {when}.", partnerTbd: "partner belli değil", reminderT: "{date} günü oynuyor musun?", reminderB: "{r}. hafta, rakip {rival}. Kaptanın kadroyu kurabilmesi için uygunluğunu işaretle.", testT: "Bildirimler açık", testB: "Takım kadroları ve hatırlatmalar sana böyle gelecek.", tbc: "saat belli değil", meet: "Buluşma {meet}" },
  nl: { lineupT: "Opstelling ronde {r} · tegen {rival}", lineupB: "Je speelt {slot} met {partner}. {when}.", partnerTbd: "partner nog niet bekend", reminderT: "Speel je op {date}?", reminderB: "Ronde {r} tegen {rival}. Geef je beschikbaarheid door zodat de aanvoerder de opstelling kan maken.", testT: "Meldingen aan", testB: "Zo krijg je de opstellingen en herinneringen van het team.", tbc: "tijd nog niet bekend", meet: "Verzamelen {meet}" },
};
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

async function secret(k: string): Promise<string | null> {
  const { data } = await sb.from("app_secrets").select("v").eq("k", k).maybeSingle();
  return data?.v ?? null;
}
async function vapid(): Promise<Vapid> {
  const v = await secret("vapid");
  if (v) return JSON.parse(v);
  const nv = await generateVapid(SUBJECT);
  await sb.from("app_secrets").insert({ k: "vapid", v: JSON.stringify(nv) });
  const again = await secret("vapid"); // por si dos llamadas a la vez crearon claves distintas
  return again ? JSON.parse(again) : nv;
}
async function userFrom(req: Request): Promise<string | null> {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data } = await sb.auth.getUser(jwt);
  return data?.user?.id ?? null;
}
type Msg = { title: string; body: string; url: string; tag: string };
// Envía a todas las suscripciones de esas jugadoras; borra las caducadas
async function sendTo(userIds: string[], make: (lang: string, uid: string) => Msg): Promise<number> {
  if (!userIds.length) return 0;
  const { data: subs } = await sb.from("push_subscriptions").select("*").in("user_id", userIds);
  const v = await vapid();
  let ok = 0;
  await Promise.all((subs || []).map(async (s) => {
    try {
      const code = await sendPush(s, make(T[s.lang] ? s.lang : "es", s.user_id), v);
      if (code === 404 || code === 410) await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      else if (code >= 200 && code < 300) ok++;
      else console.log("push", code, new URL(s.endpoint).host);
    } catch (e) { console.log("push error", String(e)); }
  }));
  return ok;
}
function amsToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());
}
function addDays(date: string, n: number): string {
  const d = new Date(date + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
const fmtDate = (date: string, lang: string) => new Intl.DateTimeFormat(LOC[lang], { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));
const rivalOf = (m: typeof ROUNDS[number]) => (m.home === US ? m.away : m.home);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: { action?: string; r?: number } = {};
  try { body = await req.json(); } catch { /* vacío */ }

  if (body.action === "vapid") return json({ publicKey: (await vapid()).publicKey });

  if (body.action === "reminder") {
    const s = await secret("cron");
    if (!s || req.headers.get("x-cron-secret") !== s) return json({ error: "forbidden" }, 403);
    const target = addDays(amsToday(), REMIND_DAYS);
    const m = ROUNDS.find((x) => x.date === target);
    if (!m) return json({ sent: 0, note: "no round on " + target });
    const { data: roles } = await sb.from("team_roles").select("user_id");
    const { data: av } = await sb.from("availability").select("user_id").eq("r", m.r);
    const answered = new Set((av || []).map((x) => x.user_id));
    const pending = (roles || []).map((x) => x.user_id).filter((id) => !answered.has(id));
    const sent = await sendTo(pending, (lang) => ({
      title: fill(T[lang].reminderT, { date: fmtDate(m.date, lang) }),
      body: fill(T[lang].reminderB, { r: m.r, rival: rivalOf(m) }),
      url: SITE + "#mi-disponibilidad", tag: "avail-" + m.r,
    }));
    return json({ sent, pending: pending.length });
  }

  const uid = await userFrom(req);
  if (!uid) return json({ error: "auth" }, 401);
  const { data: me } = await sb.from("team_roles").select("role").eq("user_id", uid).maybeSingle();
  if (!me) return json({ error: "forbidden" }, 403);

  if (body.action === "test") {
    const sent = await sendTo([uid], (lang) => ({ title: T[lang].testT, body: T[lang].testB, url: SITE + "#perfil", tag: "test" }));
    return json({ sent });
  }

  if (body.action === "lineup") {
    if (!STAFF.includes(me.role)) return json({ error: "forbidden" }, 403);
    const m = ROUNDS.find((x) => x.r === Number(body.r));
    if (!m) return json({ error: "round" }, 400);
    const { data: round } = await sb.from("rounds").select("pairs,meet_time,meet_place").eq("r", m.r).maybeSingle();
    const pairs: (string | null)[][] = round?.pairs || [];
    const ids = pairs.flat().filter((x): x is string => !!x);
    const { data: players } = await sb.from("players").select("id,first_name").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const first = new Map((players || []).map((p) => [p.id, p.first_name]));
    const sent = await sendTo([...new Set(ids)], (lang, u) => {
      const i = pairs.findIndex((p) => p && p.includes(u));
      const partnerId = i >= 0 ? pairs[i].find((x) => x && x !== u) : null;
      const meet = [round?.meet_time, round?.meet_place].filter(Boolean).join(", ");
      const when = [fmtDate(m.date, lang) + " " + (m.time || T[lang].tbc), meet ? fill(T[lang].meet, { meet }) : ""].filter(Boolean).join(" · ");
      return {
        title: fill(T[lang].lineupT, { r: m.r, rival: rivalOf(m) }),
        body: fill(T[lang].lineupB, { slot: SLOTS[i] || "", partner: (partnerId && first.get(partnerId)) || T[lang].partnerTbd, when }),
        url: SITE + "#mis-partidos", tag: "lineup-" + m.r,
      };
    });
    return json({ sent, players: new Set(ids).size });
  }
  return json({ error: "action" }, 400);
});
