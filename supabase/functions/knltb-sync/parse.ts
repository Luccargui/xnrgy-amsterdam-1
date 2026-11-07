// Lectura de las páginas de MijnKNLTB (Tournament Software) ya pasadas por clean():
// solo quedan las clases, href, title y datetime, y los espacios están normalizados.

export type Standing = {
  pos: number | null; team: string; teamId: number | null;
  played: number; won: number; drawn: number; lost: number; points: number;
  matches: string; sets: string; games: string;
};
export type DrawMatch = {
  id: number; round: number | null; datetime: string | null; home: string; away: string;
  played: boolean; score: [number, number] | null; message: string;
};
export type RubberPlayer = { name: string; kid: number | null; member: string | null; rating: string | null };
export type RubberSide = { team: string; won: boolean; players: RubberPlayer[] };
export type Rubber = { code: string; sides: RubberSide[]; sets: [number, number][]; status: string };
export type TeamMatch = {
  home: string; away: string; message: string; datetime: string | null;
  points: [number, number] | null; partijen: [number, number] | null; sets: [number, number] | null; games: [number, number] | null;
  rubbers: Rubber[];
};

export function decode(s: string): string {
  return s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
export function text(s: string): string { return decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(); }
function pair(s: string | undefined): [number, number] | null {
  const m = (s || "").match(/(\d+)\s*-\s*(\d+)/); return m ? [+m[1], +m[2]] : null;
}

// Clasificación ("Stand") de la página de la afdeling
export function parseStandings(html: string): Standing[] {
  const tb = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tb) return [];
  const out: Standing[] = [];
  for (const row of tb[1].split(/<tr[\s>]/).slice(1)) {
    const team = row.match(/\/team\/(\d+)"[^>]*>\s*<span class="nav-link__value">([^<]+)<\/span>/);
    if (!team) continue;
    const cells = [...row.matchAll(/<td class="cell-points[^"]*">([\s\S]*?)<\/td>/g)].map((m) => text(m[1]));
    if (cells.length < 5) continue;
    const pos = row.match(/standing-status[^"]*">\s*(\d+)/);
    out.push({
      pos: pos ? +pos[1] : null, team: text(team[2]), teamId: +team[1],
      played: +cells[0] || 0, won: +cells[1] || 0, drawn: +cells[2] || 0, lost: +cells[3] || 0, points: +cells[4] || 0,
      matches: cells[5] || "", sets: cells[6] || "", games: cells[7] || "",
    });
  }
  return out;
}

// Lista de partidos (página de la afdeling o del equipo), con la ronda de cada uno
export function parseDrawMatches(html: string): DrawMatch[] {
  const out: DrawMatch[] = [];
  let round: number | null = null;
  const re = /module-divider__body">([\s\S]*?)<\/h4>|<li class="match-group__item">([\s\S]*?)<\/li>/g;
  for (const m of html.matchAll(re)) {
    if (m[1] !== undefined) { const r = text(m[1]).match(/Ronde\s+(\d+)/i); if (r) round = +r[1]; continue; }
    const li = m[2];
    const id = li.match(/team-match\/(\d+)"/);
    if (!id) continue;
    const own = li.match(/Ronde\s+(\d+)/i);
    const dt = li.match(/<time datetime="([^"]+)"/);
    const home = li.match(/team-match__name is-team-1">([\s\S]*?)<\/div>/);
    const away = li.match(/team-match__name is-team-2">([\s\S]*?)<\/div>/);
    const sc = li.match(/<div class="score([^"]*)"[^>]*>([\s\S]*?)<\/div>/);
    const played = !!sc && !/is-not-played/.test(sc[1]);
    const s1 = sc && sc[2].match(/is-team-1">\s*(\d+)/), s2 = sc && sc[2].match(/is-team-2">\s*(\d+)/);
    const msg = li.match(/match__message[^"]*"[^>]*>([^<]*)</);
    out.push({
      id: +id[1], round: own ? +own[1] : round, datetime: dt ? dt[1] : null,
      home: home ? text(home[1]) : "", away: away ? text(away[1]) : "",
      played, score: played && s1 && s2 ? [+s1[1], +s2[1]] : null, message: msg ? text(msg[1]) : "",
    });
  }
  return out;
}

// Página de un partido entre equipos: marcador total y cada partida con parejas y sets
export function parseTeamMatch(html: string): TeamMatch {
  // Solo la cabecera del partido: el menú de la página también tiene fechas
  const h0 = html.indexOf("team-match-header"), scope = h0 >= 0 ? html.slice(h0) : html;
  const foot = (k: string) => pair(scope.match(new RegExp(k + ":\\s*<\\/strong>\\s*<span class=\"module__footer-item-value\">([^<]*)<"))?.[1]);
  const home = scope.match(/team-match__name is-team-1[^"]*"[^>]*>([\s\S]*?)<\/h2>/);
  const away = scope.match(/team-match__name is-team-2[^"]*"[^>]*>([\s\S]*?)<\/h2>/);
  const msg = scope.slice(0, 600).match(/match__message[^"]*"[^>]*>([^<]*)</);
  const dt = scope.match(/<time datetime="([^"]+)"/);
  const res: TeamMatch = {
    home: home ? text(home[1]) : "", away: away ? text(away[1]) : "", message: msg ? text(msg[1]) : "",
    datetime: dt ? dt[1] : null,
    points: foot("Punten"), partijen: foot("Partijen"), sets: foot("Sets"), games: foot("Games"), rubbers: [],
  };
  const start = html.indexOf("Partijen</h4>");
  if (start < 0) return res;
  const end = html.indexOf("grid-template__sidebar", start);
  const part = html.slice(start, end > 0 ? end : undefined);
  for (const item of part.split('<li class="match-group__item">').slice(1)) {
    const code = item.match(/match__header-title-item">[\s\S]*?nav-link__value">([^<]+)</);
    const [rowsPart, resultPart = ""] = item.split('<div class="match__result">');
    const h2h = item.match(/T1P1MemberID=(\d*)(?:&amp;|&)T1P2MemberID=(\d*)(?:&amp;|&)T2P1MemberID=(\d*)(?:&amp;|&)T2P2MemberID=(\d*)/);
    const sides: RubberSide[] = rowsPart.split(/<div class="match__row(?=[ "])/).slice(1).map((row, k) => {
      const players = [...row.matchAll(/match__row-title-value">([\s\S]*?)(?=<div class="match__row-title-value">|<\/div>\s*<\/div>|$)/g)].map((pm, j) => {
        const a = pm[1].match(/\/player\/(\d+)"[^>]*>\s*<span class="nav-link__value">([^<]*)<\/span>/);
        const plain = a ? null : pm[1].match(/match__row-title-value-content">([\s\S]*?)<\/span>/);
        const rating = pm[1].match(/tag-duo__title">\s*([^<]*?)\s*</);
        const member = h2h ? (h2h[1 + k * 2 + j] || null) : null;
        return { name: text(a ? a[2] : plain ? plain[1] : ""), kid: a ? +a[1] : null, member, rating: rating ? rating[1] : null };
      }).filter((p) => p.name);
      return { team: text(row.match(/match__row-title-header">([^<]*)</)?.[1] || ""), won: /^[^>]*has-won/.test(row), players };
    });
    const sets = [...resultPart.matchAll(/<ul class="points">([\s\S]*?)<\/ul>/g)]
      .map((u) => [...u[1].matchAll(/<li class="points__cell[^"]*">\s*(\d+)\s*<\/li>/g)].map((x) => +x[1]))
      .filter((p) => p.length === 2) as [number, number][];
    const status = text(resultPart.replace(/<ul class="points">[\s\S]*?<\/ul>/g, "").split("</div>")[0]);
    res.rubbers.push({ code: code ? text(code[1]) : "", sides, sets, status });
  }
  return res;
}
