// Calendario personal de partidos (suscripción .ics para Google/Apple/Outlook).
// Se llama con ?token=<código secreto de la jugadora>&lang=es|en|tr|nl
// y devuelve solo los partidos en los que esa jugadora está alineada.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const US = "XNRGY AMSTERDAM 1";
const SITE = "https://xnrgyams1.com/";
const MATCH_HOURS = 2;
const SLOTS = ["DD1", "DD2", "DD3", "DD4"];
const HOME = { name: "XNRGY Amsterdam", street: "De Flinesstraat 10", city: "1099 CB Amsterdam" };
type Round = { r: number; date: string; time: string | null; home: string; away: string; venue: { name: string; street: string; city: string } };
// Las jornadas vienen de la tabla fixtures (la capitana las edita en la web)
async function loadRounds(sb: any): Promise<Round[]> {
  const { data } = await sb.from("fixtures").select("*").order("date");
  return (data ?? []).map((x: any) => {
    const isHome = x.home === US;
    const venue = (isHome && !x.venue_name && !x.venue_street) ? HOME : { name: x.venue_name ?? "", street: x.venue_street ?? "", city: x.venue_city ?? "" };
    return { r: x.r, date: x.date, time: x.time ?? null, home: x.home, away: x.away, venue };
  });
}
const T: Record<string, Record<string, string>> = {
  es: { cal: "XNRGY Amsterdam 1 · Mis partidos", title: "Pádel {slot} · XNRGY vs {rival}", round: "Jornada", home: "En casa", away: "Fuera", partner: "Compañera", tbd: "por decidir", rivals: "Pareja rival", meet: "Quedada", tbc: "Hora por confirmar." },
  en: { cal: "XNRGY Amsterdam 1 · My matches", title: "Padel {slot} · XNRGY vs {rival}", round: "Round", home: "Home", away: "Away", partner: "Partner", tbd: "to be decided", rivals: "Opponents", meet: "Meet-up", tbc: "Time to be confirmed." },
  tr: { cal: "XNRGY Amsterdam 1 · Maçlarım", title: "Padel {slot} · XNRGY - {rival}", round: "Hafta", home: "İç saha", away: "Deplasman", partner: "Partner", tbd: "belli değil", rivals: "Rakip çift", meet: "Buluşma", tbc: "Saat henüz belli değil." },
  nl: { cal: "XNRGY Amsterdam 1 · Mijn wedstrijden", title: "Padel {slot} · XNRGY - {rival}", round: "Ronde", home: "Thuis", away: "Uit", partner: "Partner", tbd: "nog niet bekend", rivals: "Tegenstanders", meet: "Verzamelen", tbc: "Tijd nog niet bekend." },
};

const pad = (n: number) => String(n).padStart(2, "0");
// Hora de Ámsterdam -> instante UTC
function amsToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number), [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const p: Record<string, string> = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(new Date(guess)).forEach((x) => (p[x.type] = x.value));
  const asAms = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
  return new Date(guess - (asAms - guess));
}
const utc = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const day = (date: string, plus = 0) => { const d = new Date(date + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + plus); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`; };
const esc = (s: string) => s.replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
function fold(line: string): string {
  const out: string[] = []; let i = 0;
  while (line.length - i > 73) { out.push((i ? " " : "") + line.slice(i, i + 73)); i += 73; }
  out.push((i ? " " : "") + line.slice(i));
  return out.join("\r\n");
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const lang = ["es", "en", "tr", "nl"].includes(url.searchParams.get("lang") ?? "") ? url.searchParams.get("lang")! : "es";
  const tx = T[lang];
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response("Not found", { status: 404 });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: tk } = await sb.from("calendar_tokens").select("user_id").eq("token", token).maybeSingle();
  if (!tk) return new Response("Not found", { status: 404 });
  const uid = tk.user_id as string;
  const { data: role } = await sb.from("team_roles").select("role").eq("user_id", uid).maybeSingle();
  if (!role) return new Response("Not found", { status: 404 });

  const [ROUNDS, { data: rounds }, { data: players }] = await Promise.all([
    loadRounds(sb),
    sb.from("rounds").select("r,pairs,results,meet_time,meet_place"),
    sb.from("players").select("id,first_name,last_name"),
  ]);
  const names: Record<string, string> = {};
  (players ?? []).forEach((p) => (names[p.id] = `${p.first_name} ${p.last_name}`.trim()));
  const byR: Record<number, any> = {};
  (rounds ?? []).forEach((x) => (byR[x.r] = x));

  const now = utc(new Date());
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//XNRGY Amsterdam 1//Padel//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:" + esc(tx.cal), "X-WR-TIMEZONE:Europe/Amsterdam", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H"];
  for (const m of ROUNDS) {
    const d = byR[m.r]; if (!d || !Array.isArray(d.pairs)) continue;
    d.pairs.forEach((pr: (string | null)[], i: number) => {
      if (!pr || (pr[0] !== uid && pr[1] !== uid)) return;
      const partnerId = pr[0] === uid ? pr[1] : pr[0];
      const rs = (Array.isArray(d.results) && d.results[i]) || {};
      const rivals = Array.isArray(rs.rivals) ? rs.rivals.filter(Boolean).join(" / ") : "";
      const isHome = m.home === US, rival = isHome ? m.away : m.home;
      const desc = [
        `${tx.round} ${m.r} · ${SLOTS[i]} · ${isHome ? tx.home : tx.away}`,
        `${tx.partner}: ${partnerId && names[partnerId] ? names[partnerId] : tx.tbd}`,
        rivals ? `${tx.rivals}: ${rivals}` : "",
        d.meet_time || d.meet_place ? `${tx.meet}: ${[d.meet_time, d.meet_place].filter(Boolean).join(" · ")}` : "",
        m.time ? "" : tx.tbc,
        SITE + "#mis-partidos",
      ].filter(Boolean).join("\n");
      const title = tx.title.replace("{slot}", SLOTS[i]).replace("{rival}", rival);
      // El UID mantiene el dominio antiguo a propósito: si cambiara, los calendarios suscritos duplicarían los partidos
      L.push("BEGIN:VEVENT", `UID:xnrgy-r${m.r}-${SLOTS[i].toLowerCase()}-${uid}@luccargui.github.io`, "DTSTAMP:" + now);
      if (m.time) {
        const st = amsToUtc(m.date, m.time);
        L.push("DTSTART:" + utc(st), "DTEND:" + utc(new Date(st.getTime() + MATCH_HOURS * 3600000)));
      } else L.push("DTSTART;VALUE=DATE:" + day(m.date), "DTEND;VALUE=DATE:" + day(m.date, 1));
      L.push("SUMMARY:" + esc(title), "LOCATION:" + esc([m.venue.name, m.venue.street, m.venue.city].filter(Boolean).join(", ")), "DESCRIPTION:" + esc(desc),
        "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:" + esc(title), "END:VALARM", "END:VEVENT");
    });
  }
  L.push("END:VCALENDAR");
  return new Response(L.map(fold).join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" },
  });
});
