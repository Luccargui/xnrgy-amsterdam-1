"use strict";
/* ───────────── Política de privacidad (4 idiomas) ───────────── */
function renderPrivacy() {
  var d = PRIVACY[lang] || PRIVACY.es;
  document.getElementById("priv-title").textContent = d.title;
  document.getElementById("privacy-root").innerHTML = '<p class="upd">' + esc(d.updated) + '</p><p>' + esc(d.intro) + '</p>' +
    d.s.map(function (sec) {
      return '<div><h3>' + esc(sec[0]) + '</h3>' + (sec[1].length > 1 ? '<ul>' + sec[1].map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul>' : '<p>' + esc(sec[1][0]) + '</p>') + '</div>';
    }).join("");
}

var LANGS = ["es", "en", "tr", "nl"];
var lang = (function () {
  try { var s = localStorage.getItem("xnrgy-lang"); if (LANGS.indexOf(s) >= 0) return s; } catch (e) {}
  var n = (navigator.language || "es").slice(0, 2).toLowerCase();
  return LANGS.indexOf(n) >= 0 ? n : "es";
})();
function t(k, vars) {
  var s = (I18N[lang] && Object.prototype.hasOwnProperty.call(I18N[lang], k)) ? I18N[lang][k] : (I18N.es[k] != null ? I18N.es[k] : k);
  if (vars) for (var v in vars) s = s.replace("{" + v + "}", vars[v]);
  return s;
}

/* ───────────── Datos de la liga (MijnKNLTB) ───────────── */
var US = "XNRGY AMSTERDAM 1";
var HOME_VENUE = { name: "XNRGY Amsterdam", street: "De Flinesstraat 10", city: "1099 CB Amsterdam" };
var ROUNDS = [
  { r: 1, date: "2026-11-14", time: "12:30", home: US, away: "STROKEL 1", venue: HOME_VENUE },
  { r: 2, date: "2026-11-28", time: null, home: "HEALTHCITY HOENDERDAAL 2", away: US, venue: { name: "Health Centre Hoenderdaal", street: "Hoendersteeg 7", city: "3972 NA Driebergen-Rijsenburg" } },
  { r: 3, date: "2026-12-12", time: "09:30", home: US, away: "GAASPERPARK 1", venue: HOME_VENUE },
  { r: 4, date: "2027-01-16", time: "10:30", home: "PLAZA PADEL AMERSFOORT 1", away: US, venue: { name: "Plaza Padel Amersfoort", street: "Bunschoterstraat 23", city: "3828 NR Hoogland" } },
  { r: 5, date: "2027-01-23", time: "09:30", home: US, away: "LEISURE WORLD PADEL 1", venue: HOME_VENUE },
  { r: 6, date: "2027-01-30", time: "09:30", home: "VLTV 3", away: US, venue: { name: "VLTV Tennis & Padel", street: "Mijdrechtse Dwarsweg 2", city: "3645 GA Vinkeveen" } },
  { r: 7, date: "2027-02-13", time: "14:00", home: "NIJKERK 1", away: US, venue: { name: "De Conijnenbergh", street: "Bloemendaalseweg 5-D", city: "3862 RN Nijkerk" } }
];
var STANDINGS = ["GAASPERPARK 1", "HEALTHCITY HOENDERDAAL 2", "LEISURE WORLD PADEL 1", "NIJKERK 1", "PLAZA PADEL AMERSFOORT 1", "STROKEL 1", "VLTV 3", US];
var KNLTB_PLAYERS = [
  { name: "Lucia Carrera Guillén", surname: "Carrera", level: "9 · 9,0000" },
  { name: "Irviani Gerard", surname: "Gerard", level: "9 · 9,7205" },
  { name: "Roseline Isabel Moro Huesca Schmit", surname: "Moro", level: "9 · 9,1265", captain: true }
];
var SLOTS = ["DD1", "DD2", "DD3", "DD4"];

/* ───────────── Estado ───────────── */
var state = {
  sb: null, uid: null, email: "", isOwner: false, canWrite: true, needPassword: false,
  phase: "loading",          // loading | slow | noaccess (sin sesión) | nocfg | ready
  players: {},               // uid -> perfil
  rounds: {},                // "r1" -> { pairs: [[a,b]x4], us, them }
  managers: [],              // uids con permiso de alineaciones
  editing: false,
  regions: null, flags: null, rivals: {}, avail: {}, standings: [], calToken: null, roles: {}, requests: [], myRequest: null, meta: {},
  acks: {}, pushOn: false, installEvt: null
};

/* ───────────── Utilidades ───────────── */
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function parse(d) { var p = d.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
var LOCALE = { es: "es-ES", en: "en-GB", tr: "tr-TR", nl: "nl-NL" };
function fmtDate(d, long) {
  try { return new Intl.DateTimeFormat(LOCALE[lang], long ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "short", day: "numeric", month: "short" }).format(parse(d)); }
  catch (e) { return d; }
}
function timeStr(m) { return m.time ? (m.time + (t("hour") ? " " + t("hour") : "")) : t("tbc"); }
/* Mensaje de WhatsApp con la alineación */
function waText(m) {
  var isHome = m.home === US, rival = isHome ? m.away : m.home;
  var L = ["*XNRGY Amsterdam 1 · " + t("round") + " " + m.r + "*", t("next.vs") + " " + rival,
    fmtDate(m.date, true) + " · " + timeStr(m) + " · " + (isHome ? t("home") : t("away")),
    m.venue.name + ", " + m.venue.street + ", " + m.venue.city, routeUrl(m.venue)];
  var ml = meetLine(m); if (ml) L.push("", t("meet.title") + ": " + ml);
  L.push("", "*" + t("cal.lineup") + "*");
  pairsOf(m.r).forEach(function (pr, i) {
    var a = state.players[pr[0]], b = state.players[pr[1]];
    if (!a && !b) return;
    var rv = rivalNames(resultsOf(m.r)[i]);
    L.push(SLOTS[i] + ": " + [a ? fullName(a) : "—", b ? fullName(b) : "—"].join(" / ") + (rv ? " " + t("next.vs") + " " + rv : ""));
  });
  if (!isHome) { var cars = carsText(m.r); if (cars.length) { L.push(""); cars.forEach(function (x) { L.push(x); }); } }
  L.push("", location.origin + location.pathname + "#mis-partidos");
  return L.join("\n");
}
function waUrl(m) { return "https://wa.me/?text=" + encodeURIComponent(waText(m)); }
function routeUrl(v) { return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(v.street + ", " + v.city + ", Nederland"); }
function countryName(cc) {
  try { return new Intl.DisplayNames([LOCALE[lang]], { type: "region" }).of(cc) || cc; } catch (e) { return cc; }
}
function initials(a, b) { return ((a || "?")[0] + ((b || "")[0] || "")).toUpperCase(); }
function fullName(p) { return p ? (p.firstName + " " + p.lastName).trim() : ""; }
function today0() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function roundDoc(r) { return state.rounds["r" + r] || null; }
function meetLine(m) {
  var d = roundDoc(m.r) || {};
  return (d.meetTime || d.meetPlace) ? [d.meetTime, d.meetPlace].filter(Boolean).join(" · ") : "";
}
function carsOf(r) {
  var drivers = [], needs = [];
  Object.keys(state.avail).forEach(function (k) {
    var a = state.avail[k]; if (a.r !== r || a.status === "no" || !state.players[a.user_id]) return;
    if (a.transport === "driver") drivers.push(a); else if (a.transport === "needs") needs.push(a);
  });
  return { drivers: drivers, needs: needs };
}
function carsText(r) {
  var c = carsOf(r), out = [];
  if (c.drivers.length) out.push(t("car.drivers") + ": " + c.drivers.map(function (a) { return fullName(state.players[a.user_id]) + " (" + a.seats + " " + t("car.seatsShort") + (a.from_place ? ", " + a.from_place : "") + ")"; }).join(" · "));
  if (c.needs.length) out.push(t("car.needsList") + ": " + c.needs.map(function (a) { return fullName(state.players[a.user_id]) + (a.from_place ? " (" + a.from_place + ")" : ""); }).join(" · "));
  return out;
}
function meetHtml(m) {
  var ml = meetLine(m), isHome = m.home === US, cars = isHome ? [] : carsText(m.r);
  if (!ml && !cars.length) return "";
  return '<div class="meet">' + (ml ? '<div><span class="label">' + esc(t("meet.title")) + '</span> ' + esc(ml) + '</div>' : '') +
    cars.map(function (x) { return '<div class="mm-meta">' + esc(x) + '</div>'; }).join("") + '</div>';
}
function rivalNames(rs) { return (rs && Array.isArray(rs.rivals)) ? rs.rivals.filter(Boolean).join(" / ") : ""; }
function resultsOf(r) { var d = roundDoc(r); return (d && Array.isArray(d.results)) ? d.results : [{}, {}, {}, {}]; }
function pairsOf(r) { var d = roundDoc(r); return (d && Array.isArray(d.pairs)) ? d.pairs : [[null, null], [null, null], [null, null], [null, null]]; }
var STAFF = ["owner", "captain", "manager"];
function myRole() { return state.uid ? state.roles[state.uid] : null; }
function canManage() { return STAFF.indexOf(myRole()) >= 0; }
function nextRound() {
  var t0 = today0();
  for (var i = 0; i < ROUNDS.length; i++) {
    var d = roundDoc(ROUNDS[i].r);
    var played = d && typeof d.us === "number" && typeof d.them === "number";
    if (!played && parse(ROUNDS[i].date) >= t0) return ROUNDS[i];
  }
  return null;
}
// Cada bandera es un archivo pequeño en flags/: el navegador solo descarga las que se ven
function flagUrl(code) { var k = code.toLowerCase(); return state.flags && state.flags[k] ? "flags/" + k + ".webp" : null; }
function flagImg(code, label) {
  var u = flagUrl(code);
  if (!u) return '<span class="noflag" role="img" aria-label="' + esc(label) + '"></span>';
  return '<img src="' + u + '" alt="' + esc(label) + '" loading="lazy" decoding="async">';
}
function regionInfo(cc, rc) {
  var reg = state.regions && state.regions[cc];
  if (!reg) return { name: rc || "", hasFlag: false };
  var name = rc; for (var i = 0; i < reg.r.length; i++) if (reg.r[i][0] === rc) { name = reg.r[i][1]; break; }
  return { name: name, hasFlag: reg.f.indexOf(rc) >= 0 };
}
function flagsHtml(p) {
  if (!p || !p.country) return "";
  var cn = countryName(p.country);
  var ri = regionInfo(p.country, p.region);
  var regionName = p.regionName || ri.name || "";
  return '<div class="flags">' +
    '<div class="flag">' + flagImg(p.country, cn) + '<span>' + esc(cn) + '</span></div>' +
    (p.region ? '<div class="flag">' + (ri.hasFlag ? flagImg(p.country + "-" + p.region, regionName) : '<span class="noflag" aria-hidden="true"></span>') + '<span>' + esc(regionName) + '</span></div>' : "") +
    '</div>';
}
function flagData(code) { return flagUrl(code); }
// Franja bajo la foto: bandera del país (izquierda) y de la región (derecha) ocupando todo el recuadro
function kitHtml(p, withCaption) {
  if (!p) return "";
  var cn = p.country ? countryName(p.country) : "", ri = p.country ? regionInfo(p.country, p.region) : { name: "", hasFlag: false };
  var rn = p.regionName || ri.name || "";
  var c = p.country ? flagData(p.country) : null, r = (p.region && ri.hasFlag) ? flagData(p.country + "-" + p.region) : null;
  var label = [cn, rn].filter(Boolean).join(" · ");
  var inner = (c ? '<img src="' + c + '" alt="" title="' + esc(cn) + '">' : '') + (r ? '<img src="' + r + '" alt="" title="' + esc(rn) + '">' : '');
  return '<div class="kit' + (inner ? '' : ' empty') + '"' + (label ? ' role="img" aria-label="' + esc(label) + '"' : ' aria-hidden="true"') + '>' + inner + '</div>' +
    (withCaption && label ? '<div class="kit-cap">' + esc(label) + '</div>' : "");
}
/* ───────────── Fotos (Supabase Storage, bucket privado) ───────────── */
function storageBase() { return ((window.XNRGY_CONFIG || {}).supabaseUrl || "") + "/storage/v1/"; }
// Los enlaces firmados duran 7 días; se guardan en el navegador para que la foto salga de la caché y no se descargue cada vez
var PHOTO_TTL = 7 * 24 * 3600;
function photoCache() { try { return JSON.parse(localStorage.getItem("xnrgy-photos") || "{}"); } catch (e) { return {}; } }
function signPhotos(players) {
  var cache = photoCache(), now = Date.now(), need = [];
  Object.keys(players).forEach(function (id) {
    var p = players[id]; if (!p.photoPath) return;
    var c = cache[p.photoPath];
    if (c && c.exp - now > 24 * 3600 * 1000) p.photo = c.url; else need.push(p.photoPath);
  });
  if (!need.length) return Promise.resolve(false);
  return state.sb.storage.from("photos").createSignedUrls(need, PHOTO_TTL).then(function (res) {
    if (res.error || !res.data) return;
    var fresh = photoCache();
    // Solo se guardan las fotos actuales: las antiguas se olvidan
    var keep = {}; Object.keys(players).forEach(function (id) { var pp = players[id].photoPath; if (pp && fresh[pp]) keep[pp] = fresh[pp]; });
    res.data.forEach(function (x) { if (x.signedUrl && x.path) keep[x.path] = { url: x.signedUrl, exp: now + PHOTO_TTL * 1000 }; });
    Object.keys(players).forEach(function (id) { var pp = players[id].photoPath; if (pp && keep[pp]) players[id].photo = keep[pp].url; });
    try { localStorage.setItem("xnrgy-photos", JSON.stringify(keep)); } catch (e) {}
    return true;
  }).catch(function () { return false; });
}
function dataUrlToBlob(d) {
  var parts = d.split(","), mime = parts[0].match(/:(.*?);/)[1], bin = atob(parts[1]), arr = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
function randomId() { var a = new Uint8Array(8); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }
// Sube una foto nueva (data URL) y devuelve su ruta en Storage
function uploadPhoto(dataUrl) {
  var path = state.uid + "/" + randomId() + ".jpg";
  return state.sb.storage.from("photos").upload(path, dataUrlToBlob(dataUrl), { contentType: "image/jpeg", cacheControl: "604800", upsert: false })
    .then(function (res) { if (res.error) throw res.error; return path; });
}
function removePhotos(paths) {
  paths = paths.filter(Boolean); if (!paths.length) return Promise.resolve();
  return state.sb.storage.from("photos").remove(paths).catch(function () {});
}
// Las fotos antiguas estaban guardadas dentro de la tabla: al entrar, la propia jugadora la pasa a Storage
function migrateMyPhoto() {
  var me = state.players[state.uid];
  if (!me || me.photoPath || state.photoMigrating) return;
  state.photoMigrating = true;
  state.sb.from("players").select("photo").eq("id", state.uid).maybeSingle().then(function (res) {
    var d = res && res.data && res.data.photo;
    if (!d || !/^data:image\//.test(d)) return;
    return uploadPhoto(d).then(function (path) {
      return state.sb.from("players").update({ photo_path: path, photo: null }).eq("id", state.uid).then(function (r) {
        if (r.error) throw r.error;
        me.photoPath = path; return signPhotos(state.players).then(function () { renderAll(); });
      });
    });
  }).catch(function () {});
}
function photoHtml(p, cls) {
  if (p && p.photo && (/^data:image\/(jpeg|png|webp);base64,/.test(p.photo) || p.photo.indexOf(storageBase()) === 0)) return '<img src="' + esc(p.photo) + '" alt="" loading="lazy" decoding="async">';
  return '<span class="' + (cls || "ini") + '">' + esc(p ? initials(p.firstName, p.lastName) : "?") + '</span>';
}
function miniHtml(p) { return '<span class="mini">' + photoHtml(p, "") + '</span>'; }
function sortedPlayers() {
  return Object.keys(state.players).map(function (id) { return { id: id, p: state.players[id] }; })
    .sort(function (a, b) { return fullName(a.p).localeCompare(fullName(b.p)); });
}

/* ───────────── Pintado de textos fijos ───────────── */
function paintStatic() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
  document.querySelectorAll(".langs button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === lang)); });
  document.getElementById("club-route").href = routeUrl(HOME_VENUE);
  document.getElementById("nav-profile").setAttribute("aria-label", t("nav.me"));

}

/* ───────────── Próximo partido ───────────── */
/* Cuenta atrás hasta la hora del partido (hora de Ámsterdam) */
var cdTimer = null, cdMatch = null;
function startCountdown(m) {
  cdMatch = m;
  if (cdTimer) { clearInterval(cdTimer); cdTimer = null; }
  tickCountdown();
  if (m) cdTimer = setInterval(tickCountdown, 1000);
}
function tickCountdown() {
  var box = document.getElementById("countdown");
  var m = cdMatch;
  if (!m) { box.innerHTML = ""; return; }
  // Sin hora confirmada: cuenta hasta el inicio del día del partido
  var start = m.time ? amsToUtc(m.date, m.time) : amsToUtc(m.date, "00:00");
  var diff = start.getTime() - Date.now();
  if (diff <= 0) {
    var playing = m.time && Date.now() - start.getTime() < MATCH_HOURS * 3600000;
    box.innerHTML = '<div class="cd-msg">' + esc(t(playing ? "cd.live" : "cd.today")) + '</div>';
    if (!playing && Date.now() - start.getTime() > 24 * 3600000) { clearInterval(cdTimer); cdTimer = null; renderNext(); }
    return;
  }
  var sec = Math.floor(diff / 1000);
  var parts = [[Math.floor(sec / 86400), "cd.days"], [Math.floor(sec % 86400 / 3600), "cd.hours"], [Math.floor(sec % 3600 / 60), "cd.min"], [sec % 60, "cd.sec"]];
  box.setAttribute("aria-label", t("next.title") + ": " + parts.map(function (p) { return p[0] + " " + t(p[1]); }).join(", "));
  box.innerHTML = parts.map(function (p, i) {
    return '<div class="cd-u"><b>' + (i ? pad2(p[0]) : p[0]) + '</b><span>' + esc(t(p[1])) + '</span></div>';
  }).join("") + (m.time ? "" : '<div class="cd-note">' + esc(t("cd.tbc")) + '</div>');
}
/* ───────────── Portada personalizada (con sesión) ───────────── */
function renderMeHome() {
  var box = document.getElementById("me-home"), me = state.players[state.uid];
  document.body.classList.toggle("authed", !!(state.uid && state.phase === "ready"));
  if (!state.uid || state.phase !== "ready" || !me) { box.innerHTML = ""; return; }
  var gm = myGames(), g = gm.up[0], next = upcomingRounds()[0], cards = [];
  // 1) Mi próximo partido
  if (g) {
    var m = g.m, rival = m.home === US ? m.away : m.home, partner = g.partnerId ? state.players[g.partnerId] : null, ml = meetLine(m);
    cards.push('<div class="mh-card mh-main"><span class="label">' + esc(t("mh.next")) + '</span>' +
      '<div class="mh-title">' + SLOTS[g.i] + ' · ' + esc(t("me.vsTeam")) + ' ' + esc(rival) + '</div>' +
      '<div class="mm-meta"><b>' + esc(fmtDate(m.date, true)) + '</b> · <b>' + esc(timeStr(m)) + '</b> · ' + esc(m.home === US ? t("home") : t("away")) + ' · ' + esc(m.venue.name) + '</div>' +
      (ml ? '<div class="mm-meta">' + esc(t("meet.title")) + ': <b>' + esc(ml) + '</b></div>' : '') +
      '<div class="partner">' + (partner ? miniHtml(partner) + '<span><span class="label">' + esc(t("me.partner")) + '</span><br>' + esc(fullName(partner)) + '</span>' : '<span class="muted">' + esc(t("me.noPartner")) + '</span>') + '</div>' +
      '<div class="form-actions" style="margin:0">' + (ackValid(state.uid, m.r) ? '<span class="ack ok">✓ ' + esc(t("ack.done")) + '</span>' : '<button type="button" class="btn small solid" data-ack-home="' + m.r + '">' + esc(t("ack.btn")) + '</button>') +
        '<a class="btn small" href="' + routeUrl(m.venue) + '" target="_blank" rel="noopener">' + esc(t("route")) + '</a><a class="btn small" href="#mis-partidos">' + esc(t("mh.all")) + '</a></div></div>');
  } else if (next) {
    var rv = next.home === US ? next.away : next.home;
    cards.push('<div class="mh-card mh-main"><span class="label">' + esc(t("mh.nextRound")) + '</span>' +
      '<div class="mh-title">' + esc(t("round")) + ' ' + next.r + ' · ' + esc(rv) + '</div>' +
      '<div class="mm-meta"><b>' + esc(fmtDate(next.date, true)) + '</b> · ' + esc(timeStr(next)) + '</div>' +
      '<p class="muted" style="margin:0">' + esc(t("mh.notIn")) + '</p></div>');
  }
  // 2) Disponibilidad sin marcar: botones directos para la primera jornada pendiente
  var pend = upcomingRounds().filter(function (m) { return !(availOf(state.uid, m.r) || {}).status; });
  if (pend.length) {
    var pm = pend[0], prv = pm.home === US ? pm.away : pm.home;
    cards.push('<div class="mh-card mh-ask"><span class="label">' + esc(t("mh.availT")) + '</span>' +
      '<div class="mh-title">' + esc(t("round")) + ' ' + pm.r + ' · ' + esc(prv) + '</div>' +
      '<div class="mm-meta">' + esc(fmtDate(pm.date, true)) + ' · ' + esc(timeStr(pm)) + '</div>' +
      '<div class="av-btns" role="group" aria-label="' + esc(t("av.title")) + ' · ' + esc(t("round")) + ' ' + pm.r + '">' +
        ["yes", "maybe", "no"].map(function (v) { return '<button type="button" class="av-btn av-' + v + '" data-av-home="' + pm.r + '" data-v="' + v + '" aria-pressed="false">' + esc(t("av." + v)) + '</button>'; }).join("") + '</div>' +
      (pend.length > 1 ? '<a class="mh-link" href="#perfil" data-goto="mi-disponibilidad">' + esc(t("mh.availMore", { n: pend.length - 1 })) + ' →</a>' : '') + '</div>');
  }
  // 3) Capitanas: solicitudes pendientes
  if (canManage() && state.requests.length) {
    cards.push('<div class="mh-card"><span class="label">' + esc(t("req.title")) + '</span><div class="mh-title">' + esc(t("mh.requests", { n: state.requests.length })) + '</div><a class="btn small" href="#perfil">' + esc(t("mh.review")) + '</a></div>');
  }
  box.innerHTML = '<section class="me-home"><div class="wrap"><p class="kicker">' + esc(t("mh.hello", { name: me.firstName })) + '</p><div class="mh-grid">' + cards.join("") + '</div></div></section>';
  box.querySelectorAll("[data-av-home]").forEach(function (b) {
    b.addEventListener("click", function () { saveAvail(+b.getAttribute("data-av-home"), { status: b.getAttribute("data-v") }); renderMeHome(); renderMe(); });
  });
  box.querySelectorAll("[data-ack-home]").forEach(function (b) { b.addEventListener("click", function () { ackLineup(+b.getAttribute("data-ack-home"), b); }); });
  box.querySelectorAll("[data-goto]").forEach(function (a) {
    a.addEventListener("click", function () { var id = a.getAttribute("data-goto"); setTimeout(function () { var el = document.getElementById(id); if (el) el.scrollIntoView(); }, 50); });
  });
}

/* ───────────── Barra inferior en el móvil (con sesión) ───────────── */
var TAB_ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
  matches: '<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  players: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.9 0 5 1.6 5.5 4.4"/>',
  lineups: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.2 4-6.5 8-6.5s7.2 2.3 8 6.5"/>'
};
function renderTabbar() {
  var bar = document.getElementById("tabbar");
  var on = !!(state.uid && state.phase === "ready");
  bar.hidden = !on; document.body.classList.toggle("has-tabs", on);
  if (!on) return;
  bar.setAttribute("aria-label", t("tabs.label"));
  var items = [["home", "#inicio", t("tabs.home")], ["matches", "#mis-partidos", t("tabs.matches")], ["stats", "#estadisticas", t("st.title")],
    canManage() ? ["lineups", "#alineaciones", t("nav.lineups")] : ["players", "#jugadoras", t("nav.players")], ["profile", "#perfil", t("tabs.profile")]];
  var h = location.hash || "#inicio", view = applyViewName();
  function active(href) {
    if (href === "#perfil") return view === "profile" && h !== "#mis-partidos";
    if (href === "#mis-partidos") return h === "#mis-partidos";
    if (href === "#alineaciones") return view === "lineups";
    if (href === "#inicio") return view === "home" && (h === "#inicio" || h === "" || ["#estadisticas", "#jugadoras"].indexOf(h) < 0);
    return h === href;
  }
  bar.innerHTML = items.map(function (x) {
    var a = active(x[1]);
    return '<a href="' + x[1] + '"' + (a ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true">' + TAB_ICONS[x[0]] + '</svg><span>' + esc(x[2]) + '</span></a>';
  }).join("");
}

function renderNext() {
  var vs = document.getElementById("next-vs"), meta = document.getElementById("next-meta"), count = document.getElementById("next-count");
  var m = nextRound();
  if (!m) { document.getElementById("next-label").textContent = t("next.none"); vs.innerHTML = ""; meta.innerHTML = ""; count.textContent = ""; startCountdown(null); return; }
  document.getElementById("next-label").textContent = t("next.title");
  var isHome = m.home === US;
  vs.innerHTML = '<span class="team' + (isHome ? "" : " them") + '">' + esc(m.home) + '</span><span class="sep">' + esc(t("next.vs")) + '</span><span class="team' + (isHome ? " them" : "") + '">' + esc(m.away) + '</span>';
  count.textContent = "";
  startCountdown(m);
  meta.innerHTML = '<span>' + esc(t("round")) + ' <b>' + m.r + '</b></span><span><b>' + esc(fmtDate(m.date)) + '</b></span><span><b>' + esc(timeStr(m)) + '</b></span>' +
    '<span><b>' + esc(isHome ? t("home") : t("away")) + '</b> · ' + esc(m.venue.name) + '</span>' +
    '<a class="route" href="' + routeUrl(m.venue) + '">' + esc(t("route")) + ' →</a>';
}

/* ───────────── Calendario ───────────── */
var openRounds = {};
function renderRounds() {
  var nx = nextRound();
  var html = ROUNDS.map(function (m) {
    var isHome = m.home === US, rival = isHome ? m.away : m.home, d = roundDoc(m.r);
    var score;
    if (d && typeof d.us === "number" && typeof d.them === "number") {
      var cls = d.us > d.them ? "w" : d.us < d.them ? "l" : "d";
      score = '<span class="r-score ' + cls + '">' + d.us + '–' + d.them + '</span>';
    } else score = '<span class="r-score pending">' + esc(m.time || t("tbc")) + '</span>';
    var pairs = pairsOf(m.r), mine = false, anySet = false;
    var lineup = pairs.map(function (pr, i) {
      var a = state.players[pr[0]], b = state.players[pr[1]];
      if (pr[0] || pr[1]) anySet = true;
      var isMine = state.uid && (pr[0] === state.uid || pr[1] === state.uid);
      if (isMine) mine = true;
      var names = [a ? fullName(a) : "—", b ? fullName(b) : "—"].join(" / ");
      var rs = resultsOf(m.r)[i] || {}, rtxt = "";
      if (rs.won === true || rs.won === false) rtxt = '<span class="ddres ' + (rs.won ? "w" : "l") + '">' + esc(t(rs.won ? "res.w" : "res.l")) + (rs.score ? " · " + esc(rs.score) : "") + '</span>';
      var rvn = rivalNames(rs);
      return '<div class="dd' + (isMine ? " mine" : "") + '"><span class="tag">' + SLOTS[i] + '</span><span class="names">' + esc(names) + (rvn ? '<span class="rvn"> ' + esc(t("next.vs")) + ' ' + esc(rvn) + '</span>' : '') + rtxt + '</span></div>';
    }).join("");
    var chip = mine ? '<span class="chip me">' + esc(t("cal.you")) + '</span>' : '<span class="chip' + (isHome ? " home" : "") + '">' + esc(isHome ? t("home") : t("away")) + '</span>';
    return '<details class="round' + (m === nx ? " is-next" : "") + '" data-r="' + m.r + '"' + (openRounds[m.r] ? " open" : "") + '>' +
      '<summary><span class="r-num">' + esc(t("round")) + ' ' + m.r + '</span>' +
      '<span class="r-date">' + esc(fmtDate(m.date)) + '<small>' + parse(m.date).getFullYear() + '</small></span>' +
      '<span class="r-match"><span class="vsw">' + esc(t("next.vs")) + '</span> ' + esc(rival) + '</span>' + chip + score + '<span class="caret" aria-hidden="true">›</span></summary>' +
      '<div class="r-body">' +
        '<div class="venue"><span class="label">' + esc(t("venue")) + ' · ' + esc(isHome ? t("home") : t("away")) + '</span>' +
          '<p><b>' + esc(m.venue.name) + '</b><br>' + esc(m.venue.street) + '<br>' + esc(m.venue.city) + '<br>' + esc(fmtDate(m.date, true)) + ' · ' + esc(timeStr(m)) + '</p>' +
          '<a class="btn small solid" href="' + routeUrl(m.venue) + '">' + esc(t("route")) + '</a></div>' +
        '<div><span class="label">' + esc(t("cal.lineup")) + '</span>' +
          ((state.uid && state.phase === "ready") ? meetHtml(m) : '') +
          ((!state.uid || state.phase !== "ready") ? '<p class="muted" style="margin:6px 0 0"><a href="#perfil">' + esc(t("cal.locked")) + '</a></p>' : (anySet ? '<div class="lineup">' + lineup + '</div><a class="btn small wa" href="' + esc(waUrl(m)) + '" target="_blank" rel="noopener">' + esc(t("wa.share")) + '</a>' : '<p class="muted" style="margin:6px 0 0">' + esc(t("cal.noLineup")) + '</p>')) + '</div>' +
      '</div></details>';
  }).join("");
  var box = document.getElementById("rounds");
  box.innerHTML = html;
  box.querySelectorAll("details").forEach(function (d) {
    d.addEventListener("toggle", function () { openRounds[d.getAttribute("data-r")] = d.open; });
  });
}

/* ───────────── Clasificación ───────────── */
function sortedStandings() {
  var list = state.standings && state.standings.length ? state.standings.slice() : STANDINGS.map(function (team) { return { team: team, played: 0, won: 0, drawn: 0, lost: 0, points: 0 }; });
  return list.sort(function (a, b) { return b.points - a.points || b.won - a.won || a.team.localeCompare(b.team); });
}
function renderStandings() {
  document.getElementById("standings").innerHTML = sortedStandings().map(function (x, i) {
    return '<tr' + (x.team === US ? ' class="us"' : '') + '><td class="pos">' + (i + 1) + '</td><td class="team">' + esc(x.team) + '</td>' +
      '<td class="n">' + x.played + '</td><td class="n">' + x.won + '</td><td class="n">' + (x.drawn || 0) + '</td><td class="n">' + x.lost + '</td><td class="n"><b>' + x.points + '</b></td></tr>';
  }).join("");
  var any = (state.standings || []).some(function (x) { return x.played > 0; });
  document.querySelector('#clasificacion .fineprint').textContent = any ? t("tab.fineUpd") : t("tab.fine");
}

/* ───────────── Plantilla ───────────── */
function bdayLabel(d, withYear) {
  if (!d || !/^\d{4}-\d\d-\d\d$/.test(d)) return "";
  try { return new Intl.DateTimeFormat(LOCALE[lang], withYear ? { day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "long" }).format(parse(d)); } catch (e) { return d; }
}
function sideLabel(v) { return v ? t("side." + v) : ""; }
function handLabel(v) { return v ? t("hand." + v) : ""; }
function roleBadge(id) {
  var r = state.roles[id];
  if (r === "captain") return '<span class="badge">' + esc(t("role.captain")) + '</span>';
  if (r === "manager") return '<span class="badge">' + esc(t("role.manager")) + '</span>';
  return "";
}
function renderPlayers() {
  if (!state.uid || state.phase !== "ready") {
    document.getElementById("players").innerHTML = '<div class="notice"><p style="margin:0">' + esc(t("pl.locked")) + ' <a href="#perfil">' + esc(t("login.submit")) + ' →</a></p></div>';
    document.getElementById("pl-note").textContent = "";
    return;
  }
  var list = sortedPlayers();
  var registeredNames = list.map(function (x) { return norm(fullName(x.p)); });
  var cards = list.map(function (x) {
    var p = x.p;
    return '<article class="player"><div class="photo">' + photoHtml(p) + '</div>' + kitHtml(p, true) + '<div class="p-body">' +
      '<div><div class="p-name">' + esc(fullName(p)) + '</div>' + roleBadge(x.id) + '</div>' +
      ((p.side || p.hand) ? '<div class="p-chips">' + (p.side ? '<span class="chip">' + esc(sideLabel(p.side)) + '</span>' : '') + (p.hand ? '<span class="chip">' + esc(handLabel(p.hand)) + '</span>' : '') + '</div>' : '') +
      (p.birthday ? '<div class="p-contact"><span>' + esc(t("f.birthday")) + ': ' + esc(bdayLabel(p.birthday, false)) + '</span></div>' : '') +
      (p.phone ? '<div class="p-contact"><span>' + esc(p.phone) + '</span><span>' + esc(p.email) + '</span><span>KNLTB ' + esc(p.knltb) + '</span></div>' : '') +
      '</div></article>';
  });
  // Jugadoras de la ficha KNLTB que aún no han rellenado su perfil
  KNLTB_PLAYERS.forEach(function (k) {
    var parts = k.name.split(" ");
    // Se compara sin acentos (Lucia = Lucía) por nombre y primer apellido
    var found = registeredNames.some(function (n) { return n.indexOf(norm(parts[0])) >= 0 && n.indexOf(norm(k.surname)) >= 0; });
    if (found) return;
    cards.push('<article class="player"><div class="photo"><span class="ini">' + esc(initials(parts[0], parts[1])) + '</span></div>' + kitHtml({ firstName: k.name.split(" ")[0], lastName: k.surname }, false) + '<div class="p-body">' +
      '<div><div class="p-name">' + esc(k.name) + '</div>' + (k.captain ? '<span class="badge">' + esc(t("pl.captain")) + '</span> ' : '') + '<span class="badge ghost">' + esc(t("pl.pending")) + '</span></div>' +
      '<div class="p-contact"><span>' + esc(t("pl.level")) + ': ' + esc(k.level) + '</span></div></div></article>');
  });
  document.getElementById("players").innerHTML = cards.join("");
  document.getElementById("pl-note").textContent = t("pl.count", { n: cards.length });
}

/* ───────────── Estadísticas ───────────── */
// Se calculan solas a partir de las alineaciones y los resultados que apunta la capitana
function computeStats() {
  var per = {}, pairs = {}, team = { pj: 0, w: 0, l: 0, sw: 0, sl: 0, gw: 0, gl: 0 };
  function add(o, rs, sets) {
    o.pj++; if (rs.won) o.w++; else o.l++;
    sets.forEach(function (x) { if (x[0] > x[1]) o.sw++; else if (x[1] > x[0]) o.sl++; o.gw += +x[0]; o.gl += +x[1]; });
  }
  function blank() { return { pj: 0, w: 0, l: 0, sw: 0, sl: 0, gw: 0, gl: 0 }; }
  ROUNDS.forEach(function (m) {
    var pr = pairsOf(m.r), res = resultsOf(m.r);
    [0, 1, 2, 3].forEach(function (i) {
      var rs = res[i] || {};
      if (rs.won !== true && rs.won !== false) return;
      var sets = setsOf(rs).map(function (x) { return [+x[0], +x[1]]; });
      add(team, rs, sets);
      var ids = (pr[i] || []).filter(function (id) { return id && state.players[id]; });
      ids.forEach(function (id) { add(per[id] = per[id] || blank(), rs, sets); });
      if (ids.length === 2) { var k = ids.slice().sort().join("|"); add(pairs[k] = pairs[k] || blank(), rs, sets); }
    });
  });
  return { per: per, pairs: pairs, team: team };
}
function pct(o) { return o.pj ? Math.round(100 * o.w / o.pj) : 0; }
function byPerf(a, b) { return (b.o.w - a.o.w) || (pct(b.o) - pct(a.o)) || ((b.o.sw - b.o.sl) - (a.o.sw - a.o.sl)) || ((b.o.gw - b.o.gl) - (a.o.gw - a.o.gl)) || (b.o.pj - a.o.pj); }
function shortName(p) { return p ? (p.firstName + " " + ((p.lastName || "")[0] || "").toUpperCase() + ".").trim() : ""; }
function pctCell(o) { var v = pct(o); return '<span class="st-bar" aria-hidden="true"><i style="width:' + v + '%"></i></span>' + v + '%'; }
function renderStats() {
  var box = document.getElementById("stats-box"), note = document.getElementById("st-note");
  if (!box) return;
  if (!state.uid || state.phase !== "ready") {
    box.innerHTML = '<div class="notice"><p style="margin:0">' + esc(t("st.locked")) + ' <a href="#perfil">' + esc(t("login.submit")) + ' →</a></p></div>';
    note.textContent = ""; return;
  }
  var S = computeStats(), T = S.team;
  note.textContent = t("st.note");
  if (!T.pj) { box.innerHTML = '<p class="muted" style="margin:0">' + esc(t("st.empty")) + '</p>'; return; }
  var tiles = [["pj", T.pj, ""], ["w", T.w, "w"], ["l", T.l, "l"], ["pct", pct(T) + "%", ""], ["sets", T.sw + "–" + T.sl, ""], ["games", T.gw + "–" + T.gl, ""]];
  var head = '<thead><tr><th>#</th><th>{who}</th><th class="n">' + esc(t("st.pj")) + '</th><th class="n">' + esc(t("st.w")) + '</th><th class="n">' + esc(t("st.l")) + '</th><th class="n">%</th><th class="n hide-sm">' + esc(t("adm.setsTot")) + '</th><th class="n hide-sm">' + esc(t("adm.games")) + '</th></tr></thead>';
  function row(i, who, o, mine) {
    return '<tr' + (mine ? ' class="me"' : '') + '><td class="pos">' + (i + 1) + '</td><td class="who">' + who + '</td><td class="n">' + o.pj + '</td><td class="n">' + o.w + '</td><td class="n">' + o.l + '</td><td class="n pc">' + pctCell(o) + '</td>' +
      '<td class="n hide-sm">' + o.sw + '–' + o.sl + '</td><td class="n hide-sm">' + o.gw + '–' + o.gl + '</td></tr>';
  }
  var players = Object.keys(S.per).map(function (id) { return { id: id, o: S.per[id] }; }).sort(byPerf);
  var prs = Object.keys(S.pairs).map(function (k) { return { ids: k.split("|"), o: S.pairs[k] }; }).sort(byPerf);
  box.innerHTML =
    '<div class="st-tiles">' + tiles.map(function (x) { return '<div class="st-tile ' + x[2] + '"><b>' + x[1] + '</b><span>' + esc(t("st.t." + x[0])) + '</span></div>'; }).join("") + '</div>' +
    '<div class="st-block"><h3 class="st-h">' + esc(t("st.players")) + '</h3><div class="table-wrap"><table class="st-tbl">' + head.replace("{who}", esc(t("st.player"))) + '<tbody>' +
      players.map(function (x, i) { return row(i, esc(fullName(state.players[x.id])), x.o, x.id === state.uid); }).join("") + '</tbody></table></div></div>' +
    (prs.length ? '<div class="st-block"><h3 class="st-h">' + esc(t("st.pairs")) + '</h3><div class="table-wrap"><table class="st-tbl">' + head.replace("{who}", esc(t("st.pair"))) + '<tbody>' +
      prs.map(function (x, i) { return row(i, esc(shortName(state.players[x.ids[0]])) + ' &amp; ' + esc(shortName(state.players[x.ids[1]])), x.o, x.ids.indexOf(state.uid) >= 0); }).join("") + '</tbody></table></div></div>' : '') +
    '<p class="fineprint">' + esc(t("st.fine")) + '</p>';
}

/* ───────────── Mi zona ───────────── */
/* Disponibilidad de cada jugadora por jornada */
function availOf(uid, r) { return state.avail[uid + ":" + r] || null; }
function upcomingRounds() { var t0 = today0(); return ROUNDS.filter(function (m) { return parse(m.date) >= t0; }); }
function availHtml() {
  var list = upcomingRounds();
  if (!list.length) return "";
  return '<div class="p-sec" id="mi-disponibilidad" style="scroll-margin-top:80px"><h3>' + esc(t("av.title")) + '</h3><p class="hint" style="margin:0">' + esc(t("av.hint")) + '</p>' +
    list.map(function (m) {
      var a = availOf(state.uid, m.r) || {}, isHome = m.home === US, rival = isHome ? m.away : m.home;
      var btn = function (v) { return '<button type="button" class="av-btn av-' + v + '" data-av="' + m.r + '" data-v="' + v + '" aria-pressed="' + (a.status === v) + '">' + esc(t("av." + v)) + '</button>'; };
      var car = '';
      if (!isHome && a.status && a.status !== "no") {
        car = '<div class="av-car"><label class="label" for="tr-' + m.r + '">' + esc(t("car.how")) + '</label>' +
          '<select id="tr-' + m.r + '" data-tr="' + m.r + '"><option value="">—</option>' +
            ["own", "driver", "needs"].map(function (v) { return '<option value="' + v + '"' + (a.transport === v ? " selected" : "") + '>' + esc(t("car." + v)) + '</option>'; }).join("") + '</select>' +
          (a.transport === "driver" ? '<label class="label" for="seats-' + m.r + '">' + esc(t("car.seats")) + '</label><select id="seats-' + m.r + '" data-seats="' + m.r + '">' + [1, 2, 3, 4, 5, 6].map(function (n) { return '<option' + (a.seats === n ? " selected" : "") + '>' + n + '</option>'; }).join("") + '</select>' : '') +
          (a.transport === "driver" || a.transport === "needs" ? '<label class="label" for="from-' + m.r + '">' + esc(t("car.from")) + '</label><input type="text" id="from-' + m.r + '" data-from="' + m.r + '" maxlength="60" placeholder="' + esc(t("car.fromPh")) + '" value="' + esc(a.from_place || "") + '">' : '') +
        '</div>';
      }
      return '<div class="av-row"><div><div class="mm-title">' + esc(t("round")) + ' ' + m.r + ' · ' + esc(rival) + '</div>' +
        '<div class="mm-meta">' + esc(fmtDate(m.date, true)) + ' · ' + esc(timeStr(m)) + ' · ' + esc(isHome ? t("home") : t("away")) + '</div></div>' +
        '<div class="av-btns" role="group" aria-label="' + esc(t("av.title")) + ' · ' + esc(t("round")) + ' ' + m.r + '">' + btn("yes") + btn("maybe") + btn("no") + '</div>' + car + '</div>';
    }).join("") + '<span class="status" id="av-status" role="status" aria-live="polite"></span></div>';
}
function saveAvail(r, patch) {
  var cur = availOf(state.uid, r) || {};
  var row = { user_id: state.uid, r: r, status: cur.status || null, transport: cur.transport || null, seats: cur.seats || null, from_place: cur.from_place || null, updated_at: new Date().toISOString() };
  Object.keys(patch).forEach(function (k) { row[k] = patch[k]; });
  if (row.status === "no") { row.transport = null; row.seats = null; row.from_place = null; }
  if (row.transport !== "driver") row.seats = null;
  if (row.transport === "driver" && !row.seats) row.seats = 3;
  if (row.transport !== "driver" && row.transport !== "needs") row.from_place = null;
  state.avail[state.uid + ":" + r] = row;
  return state.sb.from("availability").upsert(row).then(function (res) {
    if (res.error) throw res.error;
    var st = document.getElementById("av-status"); if (st) { st.textContent = t("av.saved"); st.className = "status"; }
  }).catch(function () { var st = document.getElementById("av-status"); if (st) { st.textContent = t("f.errSave"); st.className = "status bad"; } });
}
function wireAvail(root) {
  root.querySelectorAll("[data-av]").forEach(function (b) {
    b.addEventListener("click", function () { saveAvail(+b.getAttribute("data-av"), { status: b.getAttribute("data-v") }); renderMe(); });
  });
  root.querySelectorAll("[data-tr]").forEach(function (sel) {
    sel.addEventListener("change", function () { saveAvail(+sel.getAttribute("data-tr"), { transport: sel.value || null }); renderMe(); });
  });
  root.querySelectorAll("[data-seats]").forEach(function (sel) {
    sel.addEventListener("change", function () { saveAvail(+sel.getAttribute("data-seats"), { seats: +sel.value }); });
  });
  root.querySelectorAll("[data-from]").forEach(function (inp) {
    var timer = null;
    inp.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(function () { saveAvail(+inp.getAttribute("data-from"), { from_place: inp.value.trim().slice(0, 60) || null }); }, 700); });
  });
}

/* Suscripción automática al calendario */
var FN_CALENDAR = "/functions/v1/calendar";
function calFeedUrl() {
  var cfg = window.XNRGY_CONFIG || {};
  return state.calToken ? cfg.supabaseUrl + FN_CALENDAR + "?token=" + state.calToken + "&lang=" + lang : null;
}
/* ───────────── App instalable y avisos push ───────────── */
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
function isStandalone() { return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true; }
function pushSupported() { return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }
function b64uToBytes(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
function swReady() { return navigator.serviceWorker.getRegistration().then(function (r) { return r || navigator.serviceWorker.register("sw.js"); }).then(function () { return navigator.serviceWorker.ready; }); }
function refreshPushState() {
  if (!pushSupported() || !state.uid) { state.pushOn = false; return Promise.resolve(); }
  return swReady().then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
    var on = !!sub && Notification.permission === "granted";
    if (on !== state.pushOn) { state.pushOn = on; renderMe(); }
    if (sub && on) saveSubscription(sub); // la mantiene al día (idioma, jugadora)
  }).catch(function () {});
}
function saveSubscription(sub) {
  var j = sub.toJSON();
  return state.sb.from("push_subscriptions").upsert({ endpoint: j.endpoint, user_id: state.uid, p256dh: j.keys.p256dh, auth: j.keys.auth, lang: lang })
    .then(function (res) { if (res.error) throw res.error; });
}
function enablePush(st) {
  var key = (window.XNRGY_CONFIG || {}).vapidPublicKey;
  st.textContent = t("push.working"); st.className = "status";
  Notification.requestPermission().then(function (perm) {
    if (perm !== "granted") throw new Error("denied");
    return swReady();
  }).then(function (reg) {
    return reg.pushManager.getSubscription().then(function (old) { return old || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(key) }); });
  }).then(function (sub) { return saveSubscription(sub); }).then(function () {
    state.pushOn = true; renderMe();
  }).catch(function (e) {
    st.textContent = (e && e.message === "denied") ? t("push.denied") : t("push.err"); st.className = "status bad";
  });
}
function disablePush() {
  if (!pushSupported()) return Promise.resolve();
  return swReady().then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
    if (!sub) return;
    var ep = sub.endpoint;
    return state.sb.from("push_subscriptions").delete().eq("endpoint", ep).then(function () { return sub.unsubscribe(); });
  }).catch(function () {}).then(function () { state.pushOn = false; });
}
// Cerrar sesión: este dispositivo deja de recibir los avisos de esa cuenta
function signOutAll() {
  var p = state.pushOn ? disablePush() : Promise.resolve();
  return p.then(function () { return state.sb.auth.signOut(); });
}
function appHtml() {
  var parts = [];
  if (!isStandalone()) {
    if (state.installEvt) parts.push('<div class="app-row"><p class="hint" style="margin:0">' + esc(t("app.installP")) + '</p><button type="button" class="btn small solid" id="app-install">' + esc(t("app.install")) + '</button></div>');
    else if (isIOS()) parts.push('<p class="hint" style="margin:0">' + esc(t("app.ios")) + '</p>');
    else parts.push('<p class="hint" style="margin:0">' + esc(t("app.other")) + '</p>');
  }
  var push;
  if (!pushSupported()) push = '<p class="hint" style="margin:0">' + esc(isIOS() && !isStandalone() ? t("push.iosFirst") : t("push.unsupported")) + '</p>';
  else if (Notification.permission === "denied") push = '<p class="hint" style="margin:0">' + esc(t("push.blocked")) + '</p>';
  else if (state.pushOn) push = '<div class="app-row"><p style="margin:0"><b>✓ ' + esc(t("push.on")) + '</b></p><div class="form-actions" style="margin:0"><button type="button" class="btn small" id="push-test">' + esc(t("push.test")) + '</button><button type="button" class="btn small" id="push-off">' + esc(t("push.off")) + '</button></div></div>';
  else push = '<div class="app-row"><p class="hint" style="margin:0">' + esc(t("push.why")) + '</p><button type="button" class="btn small solid" id="push-on">' + esc(t("push.enable")) + '</button></div>';
  parts.push(push + '<span class="status" id="push-status" role="status" aria-live="polite"></span>');
  return '<div class="p-sec" id="avisos" style="scroll-margin-top:80px"><h3>' + esc(t("app.title")) + '</h3>' + parts.join("") + '</div>';
}
function bindAppSection() {
  var st = document.getElementById("push-status");
  var ib = document.getElementById("app-install");
  if (ib) ib.addEventListener("click", function () { var e = state.installEvt; if (!e) return; e.prompt(); e.userChoice.then(function () { state.installEvt = null; renderMe(); }); });
  var on = document.getElementById("push-on");
  if (on) on.addEventListener("click", function () { on.disabled = true; enablePush(st); setTimeout(function () { on.disabled = false; }, 4000); });
  var off = document.getElementById("push-off");
  if (off) off.addEventListener("click", function () { disablePush().then(renderMe); });
  var te = document.getElementById("push-test");
  if (te) te.addEventListener("click", function () {
    te.disabled = true; st.textContent = t("push.working"); st.className = "status";
    state.sb.functions.invoke("notify", { body: { action: "test" } }).then(function (res) {
      te.disabled = false;
      var n = res && res.data ? res.data.sent : 0;
      st.textContent = n ? t("push.testSent") : t("push.err"); st.className = "status" + (n ? "" : " bad");
    });
  });
}

/* "He visto la alineación": la capitana ve quién la ha visto desde el último cambio */
function ackOf(uid, r) { return state.acks[uid + ":" + r] || null; }
function ackValid(uid, r) {
  var a = ackOf(uid, r), d = roundDoc(r);
  return !!a && (!d || !d.updatedAt || new Date(a) >= new Date(d.updatedAt));
}
function ackLineup(r, btn) {
  btn.disabled = true;
  state.sb.from("lineup_ack").upsert({ r: r, user_id: state.uid, seen_at: new Date().toISOString() }).select("seen_at").then(function (res) {
    if (res.error) throw res.error;
    state.acks[state.uid + ":" + r] = res.data[0].seen_at; renderMe(); renderMeHome();
  }).catch(function () { btn.disabled = false; });
}

function subscribeHtml() {
  return '<div class="sub-box"><div><b>' + esc(t("sub.title")) + '</b><p class="hint" style="margin:4px 0 0">' + esc(t("sub.p")) + '</p></div>' +
    '<div class="form-actions"><button type="button" class="btn small solid" data-sub="google">' + esc(t("sub.google")) + '</button>' +
    '<button type="button" class="btn small" data-sub="apple">' + esc(t("sub.apple")) + '</button>' +
    '<button type="button" class="btn small" data-sub="copy">' + esc(t("sub.copy")) + '</button></div><span class="status" id="sub-status" role="status" aria-live="polite"></span></div>';
}
function ensureCalToken() {
  if (state.calToken) return Promise.resolve(state.calToken);
  return state.sb.from("calendar_tokens").insert({}).select("token").then(function (res) {
    if (res.error) throw res.error;
    state.calToken = res.data && res.data[0] && res.data[0].token;
    return state.calToken;
  });
}
function wireSubscribe(root) {
  root.querySelectorAll("[data-sub]").forEach(function (b) {
    b.addEventListener("click", function () {
      var kind = b.getAttribute("data-sub"), st = document.getElementById("sub-status");
      // Abrir la ventana ya en el clic para que el navegador no la bloquee
      var win = kind === "google" ? window.open("about:blank", "_blank") : null;
      ensureCalToken().then(function () {
        var https = calFeedUrl(), webcal = https.replace(/^https:/, "webcal:");
        if (kind === "google") {
          var g = "https://calendar.google.com/calendar/r?cid=" + encodeURIComponent(webcal);
          if (win) win.location.href = g; else location.href = g;
        } else if (kind === "apple") {
          location.href = webcal;
        } else {
          (navigator.clipboard ? navigator.clipboard.writeText(https) : Promise.reject()).then(function () {
            st.textContent = t("sub.copied"); st.className = "status";
          }).catch(function () { window.prompt(t("sub.copy"), https); });
        }
      }).catch(function () { if (win) win.close(); st.textContent = t("f.errSave"); st.className = "status bad"; });
    });
  });
}

function myGames() {
  var up = [], done = [], t0 = today0();
  ROUNDS.forEach(function (m) {
    pairsOf(m.r).forEach(function (pr, i) {
      if (!state.uid || (pr[0] !== state.uid && pr[1] !== state.uid)) return;
      var rs = resultsOf(m.r)[i] || {}, d = roundDoc(m.r) || {};
      var g = { m: m, i: i, partnerId: pr[0] === state.uid ? pr[1] : pr[0], rs: rs, d: d };
      var hasRes = rs.won === true || rs.won === false;
      if (hasRes || parse(m.date) < t0) done.push(g); else up.push(g);
    });
  });
  return { up: up, done: done };
}
function gameHtml(g, past) {
  var m = g.m, partner = g.partnerId ? state.players[g.partnerId] : null;
  var isHome = m.home === US, rival = isHome ? m.away : m.home;
  var right;
  if (past) {
    var cls = g.rs.won === true ? "w" : g.rs.won === false ? "l" : "p";
    right = '<div style="display:grid;gap:6px;justify-items:end"><span class="res ' + cls + '">' + esc(t("res." + cls)) + '</span>' + (g.rs.score ? '<span class="mm-score">' + esc(g.rs.score) + '</span>' : '') + '</div>';
  } else right = '<a class="btn small" href="' + routeUrl(m.venue) + '">' + esc(t("route")) + '</a>';
  var team = (past && typeof g.d.us === "number" && typeof g.d.them === "number") ? ' · ' + esc(t("prof.team")) + ' <b>' + g.d.us + '–' + g.d.them + '</b>' : '';
  return '<div class="mm">' +
    '<div><div class="mm-title">' + SLOTS[g.i] + ' · ' + esc(t("me.vsTeam")) + ' ' + esc(rival) + '</div>' +
    (rivalNames(g.rs) ? '<div class="mm-meta">' + esc(t("adm.rivalPair")) + ': <b>' + esc(rivalNames(g.rs)) + '</b></div>' : '') +
    (!past ? meetHtml(m) : '') +
    '<div class="mm-meta">' + esc(t("round")) + ' ' + m.r + ' · <b>' + esc(fmtDate(m.date, true)) + '</b>' + (past ? '' : ' · <b>' + esc(timeStr(m)) + '</b>') + ' · ' + esc(isHome ? t("home") : t("away")) + ' · ' + esc(m.venue.name) + team + '</div></div>' +
    right +
    '<div class="partner" style="grid-column:1/-1">' + (partner ? miniHtml(partner) + '<span><span class="label">' + esc(t("me.partner")) + '</span><br>' + esc(fullName(partner)) + (partner.side ? ' · ' + esc(sideLabel(partner.side)) : '') + '</span>' : '<span class="muted">' + esc(t("me.partnerTbc")) + '</span>') + '</div>' +
    (past ? '' : '<div class="ack-row">' + (ackValid(state.uid, m.r) ? '<span class="ack ok">✓ ' + esc(t("ack.done")) + '</span>' : '<button type="button" class="btn small solid" data-ack="' + m.r + '">' + esc(t("ack.btn")) + '</button><span class="hint">' + esc(t("ack.hint")) + '</span>') + '</div>') +
    (past ? '' : '<div class="cal-btns"><a class="btn small" href="' + esc(googleCalUrl(g)) + '" target="_blank" rel="noopener">' + esc(t("cal.google")) + '</a>' +
      '<button type="button" class="btn small" data-ics="' + m.r + '-' + g.i + '">' + esc(t("cal.apple")) + '</button></div>') +
    '</div>';
}

/* ───────────── Partidos en el calendario (Google / Apple / Outlook) ───────────── */
var MATCH_HOURS = 2; // duración aproximada de cada partido en el calendario
function pad2(n) { return (n < 10 ? "0" : "") + n; }
// Hora de Ámsterdam -> instante UTC (sirve también con el cambio de hora)
function amsToUtc(dateStr, timeStr) {
  var d = dateStr.split("-").map(Number), tm = timeStr.split(":").map(Number);
  var guess = Date.UTC(d[0], d[1] - 1, d[2], tm[0], tm[1]);
  var parts = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(new Date(guess)).forEach(function (x) { parts[x.type] = x.value; });
  var asAms = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
  return new Date(guess - (asAms - guess));
}
function utcStamp(dt) { return dt.getUTCFullYear() + pad2(dt.getUTCMonth() + 1) + pad2(dt.getUTCDate()) + "T" + pad2(dt.getUTCHours()) + pad2(dt.getUTCMinutes()) + "00Z"; }
function dayStamp(dateStr, plusDays) { var x = parse(dateStr); x.setDate(x.getDate() + (plusDays || 0)); return x.getFullYear() + pad2(x.getMonth() + 1) + pad2(x.getDate()); }
function gameEvent(g) {
  var m = g.m, partner = g.partnerId ? state.players[g.partnerId] : null, rival = m.home === US ? m.away : m.home;
  var ev = {
    uid: "xnrgy-r" + m.r + "-" + SLOTS[g.i].toLowerCase() + "-" + state.uid + "@luccargui.github.io",
    title: t("ev.title", { slot: SLOTS[g.i], rival: rival }),
    location: m.venue.name + ", " + m.venue.street + ", " + m.venue.city,
    details: t("round") + " " + m.r + " · " + SLOTS[g.i] + " · " + (m.home === US ? t("home") : t("away")) + "\n" +
      t("me.partner") + ": " + (partner ? fullName(partner) : t("me.partnerTbc")) + "\n" +
      (rivalNames(g.rs) ? t("adm.rivalPair") + ": " + rivalNames(g.rs) + "\n" : "") +
      (m.time ? "" : t("ev.tbc") + "\n") + location.origin + location.pathname + "#perfil"
  };
  if (m.time) { var st = amsToUtc(m.date, m.time); ev.start = utcStamp(st); ev.end = utcStamp(new Date(st.getTime() + MATCH_HOURS * 3600000)); ev.allDay = false; }
  else { ev.start = dayStamp(m.date); ev.end = dayStamp(m.date, 1); ev.allDay = true; }
  return ev;
}
function googleCalUrl(g) {
  var ev = gameEvent(g);
  return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(ev.title) +
    "&dates=" + ev.start + "/" + ev.end + "&location=" + encodeURIComponent(ev.location) +
    "&details=" + encodeURIComponent(ev.details.replace(/\\n/g, "\n")) + "&ctz=Europe/Amsterdam";
}
function icsEscape(x) { return String(x).replace(/\\n/g, "\n").replace(/[\\;,]/g, function (c) { return "\\" + c; }).replace(/\n/g, "\\n"); }
function icsFold(line) { var out = [], i = 0; while (line.length - i > 73) { out.push((i ? " " : "") + line.slice(i, i + 73)); i += 73; } out.push((i ? " " : "") + line.slice(i)); return out.join("\r\n"); }
function buildIcs(games) {
  var now = utcStamp(new Date()), L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//XNRGY Amsterdam 1//Padel//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:XNRGY Amsterdam 1"];
  games.forEach(function (g) {
    var ev = gameEvent(g);
    L.push("BEGIN:VEVENT", "UID:" + ev.uid, "DTSTAMP:" + now,
      ev.allDay ? "DTSTART;VALUE=DATE:" + ev.start : "DTSTART:" + ev.start,
      ev.allDay ? "DTEND;VALUE=DATE:" + ev.end : "DTEND:" + ev.end,
      "SUMMARY:" + icsEscape(ev.title), "LOCATION:" + icsEscape(ev.location), "DESCRIPTION:" + icsEscape(ev.details),
      "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:" + icsEscape(ev.title), "END:VALARM", "END:VEVENT");
  });
  L.push("END:VCALENDAR");
  return L.map(icsFold).join("\r\n") + "\r\n";
}
function downloadIcs(games, name) {
  var blob = new Blob([buildIcs(games)], { type: "text/calendar;charset=utf-8" });
  var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function renderMe() {
  var root = document.getElementById("me-root");
  var note = document.getElementById("me-note");
  note.textContent = "";
  if (state.phase === "loading" || state.phase === "slow") {
    root.innerHTML = '<p class="muted">' + esc(t(state.phase === "slow" ? "me.slow" : "me.loading")) + '</p>';
    return;
  }
  if (state.phase === "nocfg") {
    root.innerHTML = '<div class="notice"><h3>' + esc(t("cfg.missing")) + '</h3></div>';
    return;
  }
  if (state.phase === "noaccess") { formMounted = false; mountLogin(root); return; }
  if (state.phase === "pending") { formMounted = false; mountPending(root); return; }
  if (state.needPassword) { formMounted = false; mountSetPassword(root); return; }
  var me = state.players[state.uid];
  if (state.editing || !me) {
    if (!formMounted) mountForm(me);
    return;
  }
  formMounted = false;
  note.textContent = fullName(me);
  var gm = myGames();
  var won = gm.done.filter(function (g) { return g.rs.won === true; }).length, lost = gm.done.filter(function (g) { return g.rs.won === false; }).length;
  var gamesBlock =
    '<div class="stats"><div class="stat"><b>' + (won + lost) + '</b><span>' + esc(t("prof.played")) + '</span></div><div class="stat w"><b>' + won + '</b><span>' + esc(t("prof.won")) + '</span></div><div class="stat l"><b>' + lost + '</b><span>' + esc(t("prof.lost")) + '</span></div></div>' +
    availHtml() + appHtml() +
    '<div class="p-sec" id="mis-partidos" style="scroll-margin-top:80px"><div class="admin-head"><h3>' + esc(t("prof.upcoming")) + '</h3>' + (gm.up.length > 1 ? '<button type="button" class="btn small solid" id="ics-all">' + esc(t("cal.all")) + '</button>' : '') + '</div>' +
      subscribeHtml() +
      (gm.up.length ? '<p class="hint" style="margin:0">' + esc(t("cal.hint")) + '</p>' + gm.up.map(function (g) { return gameHtml(g, false); }).join("") : '<p class="muted" style="margin:0">' + esc(t("prof.noUpcoming")) + '</p>') + '</div>' +
    '<div class="p-sec"><h3>' + esc(t("prof.results")) + '</h3>' + (gm.done.length ? gm.done.slice().reverse().map(function (g) { return gameHtml(g, true); }).join("") : '<p class="muted" style="margin:0">' + esc(t("prof.noResults")) + '</p>') + '</div>';
  root.innerHTML = '<div class="panel"><div class="me-grid">' +
    '<div class="me-side"><div class="card-photo"><div class="photo" style="border:0">' + photoHtml(me) + '</div>' + kitHtml(me, true) + '</div></div>' +
    '<div><h3>' + esc(fullName(me)) + '</h3>' +
      '<dl class="facts">' +
        '<div><dt>' + esc(t("f.birthday")) + '</dt><dd>' + esc(bdayLabel(me.birthday, true) || "—") + '</dd></div>' +
        '<div><dt>' + esc(t("f.phone")) + '</dt><dd>' + esc(me.phone || "—") + '</dd></div>' +
        '<div><dt>' + esc(t("f.email")) + '</dt><dd>' + esc(me.email || "—") + '</dd></div>' +
        '<div><dt>' + esc(t("f.knltb")) + '</dt><dd>' + esc(me.knltb || "—") + '</dd></div>' +
        '<div><dt>' + esc(t("f.side")) + '</dt><dd>' + esc(sideLabel(me.side) || "—") + '</dd></div>' +
        '<div><dt>' + esc(t("f.hand")) + '</dt><dd>' + esc(handLabel(me.hand) || "—") + '</dd></div>' +
      '</dl>' +
      '<div class="form-actions" style="margin-top:20px"><button type="button" class="btn small" id="edit-btn">' + esc(t("me.edit")) + '</button>' +
        '<button type="button" class="btn small" id="pw-btn">' + esc(t("pw.change")) + '</button>' +
        '<button type="button" class="btn small" id="logout-btn">' + esc(t("logout")) + '</button></div>' +
      '<div id="del-box" style="margin-top:16px">' + (state.isOwner ? '<p class="hint" style="margin:0">' + esc(t("del.owner")) + '</p>' : '<button type="button" class="btn small danger" id="del-btn">' + esc(t("del.btn")) + '</button>') + '</div>' +
    '</div></div></div>' + gamesBlock;
  document.getElementById("edit-btn").addEventListener("click", function () { state.editing = true; formMounted = false; renderMe(); });
  document.getElementById("pw-btn").addEventListener("click", function () { state.needPassword = true; renderMe(); });
  document.getElementById("logout-btn").addEventListener("click", function () { signOutAll(); });
  wireAvail(root); wireSubscribe(root);
  var allBtn = document.getElementById("ics-all");
  if (allBtn) allBtn.addEventListener("click", function () { downloadIcs(gm.up, "xnrgy-mis-partidos.ics"); });
  document.querySelectorAll("[data-ack]").forEach(function (b) { b.addEventListener("click", function () { ackLineup(+b.getAttribute("data-ack"), b); }); });
  bindAppSection();
  document.querySelectorAll("[data-ics]").forEach(function (b) {
    b.addEventListener("click", function () {
      var k = b.getAttribute("data-ics").split("-").map(Number);
      var g = gm.up.filter(function (x) { return x.m.r === k[0] && x.i === k[1]; })[0];
      if (g) downloadIcs([g], "xnrgy-jornada-" + g.m.r + ".ics");
    });
  });
  var delBtn = document.getElementById("del-btn");
  if (delBtn) delBtn.addEventListener("click", function () {
    var box = document.getElementById("del-box");
    box.innerHTML = '<div class="notice" style="border-color:var(--loss)"><h3>' + esc(t("del.t")) + '</h3><p>' + esc(t("del.p")) + '</p>' +
      '<div class="form-actions" style="margin-top:12px"><button type="button" class="btn small danger solid" id="del-yes">' + esc(t("del.yes")) + '</button>' +
      '<button type="button" class="btn small" id="del-no">' + esc(t("f.cancel")) + '</button><span class="status" id="del-status" role="status" aria-live="polite"></span></div></div>';
    document.getElementById("del-no").addEventListener("click", function () { renderMe(); });
    document.getElementById("del-yes").addEventListener("click", function () {
      var yes = document.getElementById("del-yes"); yes.disabled = true;
      state.sb.storage.from("photos").list(state.uid).then(function (l) {
        return removePhotos(((l && l.data) || []).map(function (x) { return state.uid + "/" + x.name; }));
      }).catch(function () {}).then(function () { return state.sb.rpc("delete_my_account"); }).then(function (res) {
        if (res.error) throw res.error;
        return state.sb.auth.signOut();
      }).then(function () {
        document.getElementById("me-note").textContent = t("del.done");
      }).catch(function (e) {
        yes.disabled = false;
        var st = document.getElementById("del-status"); st.textContent = t("f.errSave") + (e && e.message ? " (" + e.message + ")" : ""); st.className = "status bad";
      });
    });
  });
}

/* ───────────── CAPTCHA invisible (Cloudflare Turnstile) ─────────────
   Solo se activa si config.js tiene turnstileSiteKey. Normalmente no se ve nada:
   Cloudflare solo pide pulsar una casilla si sospecha que es un bot. */
function captchaKey() { return (window.XNRGY_CONFIG || {}).turnstileSiteKey || ""; }
var turnstileLoading = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (turnstileLoading) return turnstileLoading;
  turnstileLoading = new Promise(function (ok, ko) {
    var sc = document.createElement("script");
    sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; sc.async = true;
    sc.onload = function () { ok(); }; sc.onerror = function () { turnstileLoading = null; ko(); };
    document.head.appendChild(sc);
  });
  return turnstileLoading;
}
function mountCaptcha() {
  var el = document.getElementById("l-captcha");
  if (!captchaKey() || !el) return;
  state.capToken = null;
  loadTurnstile().then(function () {
    if (!document.body.contains(el)) return;
    state.capWidget = window.turnstile.render(el, {
      sitekey: captchaKey(), appearance: "interaction-only", size: "flexible", language: lang,
      theme: document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark",
      callback: function (tok) { state.capToken = tok; },
      "expired-callback": function () { state.capToken = null; },
      "error-callback": function () { state.capToken = null; }
    });
  }).catch(function () {});
}
// Espera (máx. 10 s) a que Turnstile dé su visto bueno y devuelve el token; cada token sirve una sola vez
function getCaptcha() {
  if (!captchaKey()) return Promise.resolve(undefined);
  return new Promise(function (ok, ko) {
    var n = 0;
    (function wait() {
      if (state.capToken) { var tk = state.capToken; state.capToken = null; ok(tk); return; }
      if (++n > 50) { ko(new Error("captcha")); return; }
      setTimeout(wait, 200);
    })();
  });
}
function resetCaptcha() { try { if (window.turnstile && state.capWidget != null) window.turnstile.reset(state.capWidget); } catch (e) {} }

/* ───────────── Inicio de sesión ───────────── */
var authTab = "login";
function mountLogin(root) {
  if (root.querySelector("#lf") && root.getAttribute("data-tab") === authTab && root.getAttribute("data-lang") === lang) return; // no repintar mientras escribe
  root.setAttribute("data-tab", authTab); root.setAttribute("data-lang", lang);
  var signup = authTab === "signup";
  root.innerHTML = '<div class="notice" style="margin-bottom:24px"><h3>' + esc(t("me.noaccess.t")) + '</h3><p>' + esc(t(signup ? "su.intro" : "me.noaccess.p")) + '</p></div>' +
    '<div style="max-width:460px"><div class="tabs" role="tablist">' +
      '<button type="button" role="tab" id="tab-login" aria-selected="' + !signup + '">' + esc(t("su.tabLogin")) + '</button>' +
      '<button type="button" role="tab" id="tab-signup" aria-selected="' + signup + '">' + esc(t("su.tabSignup")) + '</button></div>' +
    '<form class="panel" id="lf" novalidate>' +
      (signup ? '<div class="form-grid"><div class="field"><label for="l-first">' + esc(t("su.first")) + '</label><input type="text" id="l-first" autocomplete="given-name" maxlength="60" required></div>' +
                '<div class="field"><label for="l-last">' + esc(t("su.last")) + '</label><input type="text" id="l-last" autocomplete="family-name" maxlength="80" required></div></div>' : '') +
      '<div class="field"><label for="l-email">' + esc(t("login.email")) + '</label><input type="email" id="l-email" autocomplete="' + (signup ? "email" : "username") + '" maxlength="120" required></div>' +
      '<div class="field"><label for="l-pass">' + esc(t(signup ? "pw.new" : "login.password")) + '</label><input type="password" id="l-pass" autocomplete="' + (signup ? "new-password" : "current-password") + '" required></div>' +
      (signup ? '<div class="field"><label for="l-pass2">' + esc(t("pw.repeat")) + '</label><input type="password" id="l-pass2" autocomplete="new-password" required></div>' +
        '<label class="consent" for="l-consent"><input type="checkbox" id="l-consent" required><span>' + esc(t("su.consent1")) + ' <a href="#privacidad" target="_blank" rel="noopener">' + esc(t("su.consentLink")) + '</a> ' + esc(t("su.consent2")) + '</span></label>' : '') +
      (captchaKey() ? '<div id="l-captcha" class="captcha"></div>' : '') +
      '<div class="form-actions"><button type="submit" class="btn solid" id="l-go">' + esc(t(signup ? "su.submit" : "login.submit")) + '</button></div>' +
      (signup ? '' : '<button type="button" class="linkbtn" id="l-forgot">' + esc(t("login.forgotBtn")) + '</button>') +
      '<span class="status" id="l-status" role="status" aria-live="polite"></span>' +
    '</form></div>';
  mountCaptcha();
  document.getElementById("tab-login").addEventListener("click", function () { authTab = "login"; mountLogin(root); });
  document.getElementById("tab-signup").addEventListener("click", function () { authTab = "signup"; mountLogin(root); });
  var f = document.getElementById("lf"), st = document.getElementById("l-status");
  function bad(msg) { st.textContent = msg; st.className = "status bad"; }
  var fg = document.getElementById("l-forgot");
  if (fg) fg.addEventListener("click", function () {
    var email = f.querySelector("#l-email").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { bad(t("login.needEmail")); f.querySelector("#l-email").focus(); return; }
    fg.disabled = true;
    getCaptcha().then(function (cap) {
      return state.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname, captchaToken: cap });
    }).then(function (res) {
      fg.disabled = false; resetCaptcha();
      if (res && res.error && /rate|limit/i.test(res.error.message || "")) { bad(t("login.rate")); return; }
      st.textContent = t("login.resetSent"); st.className = "status";
    }).catch(function (e) { fg.disabled = false; resetCaptcha(); bad(e && e.message === "captcha" ? t("cap.wait") : t("login.errNet")); });
  });
  f.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var email = f.querySelector("#l-email").value.trim(), pass = f.querySelector("#l-pass").value;
    var btn = document.getElementById("l-go");
    if (!signup) {
      if (!email || !pass) { bad(t("login.err")); return; }
      btn.disabled = true; st.textContent = t("login.sending"); st.className = "status";
      getCaptcha().then(function (cap) {
        return state.sb.auth.signInWithPassword({ email: email, password: pass, options: { captchaToken: cap } });
      }).then(function (res) {
        btn.disabled = false; resetCaptcha();
        if (res.error) bad(/fetch|network/i.test(res.error.message || "") ? t("login.errNet") : t("login.err"));
      }).catch(function (e) { btn.disabled = false; resetCaptcha(); bad(e && e.message === "captcha" ? t("cap.wait") : t("login.errNet")); });
      return;
    }
    var first = f.querySelector("#l-first").value.trim(), last = f.querySelector("#l-last").value.trim(), pass2 = f.querySelector("#l-pass2").value;
    if (!first || !last) { bad(t("su.errName")); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { bad(t("su.errEmail")); return; }
    if (pass.length < 8) { bad(t("pw.errLen")); return; }
    if (pass !== pass2) { bad(t("pw.errMatch")); return; }
    if (!f.querySelector("#l-consent").checked) { bad(t("su.errConsent")); f.querySelector("#l-consent").focus(); return; }
    btn.disabled = true; st.textContent = t("su.sending"); st.className = "status";
    getCaptcha().then(function (cap) { return state.sb.auth.signUp({ email: email, password: pass, options: { captchaToken: cap, emailRedirectTo: location.origin + location.pathname, data: { first_name: first, last_name: last, privacy_version: PRIVACY_VERSION, lang: lang, privacy_accepted_at: new Date().toISOString() } } }); }).then(function (res) {
      btn.disabled = false; resetCaptcha();
      if (res.error) {
        var m = res.error.message || "";
        if (/registered|exists/i.test(m)) bad(t("su.exists"));
        else if (/password/i.test(m)) bad(t("pw.errLen"));
        else if (/fetch|network/i.test(m)) bad(t("login.errNet"));
        else bad(m);
        return;
      }
      // Sin sesión: Supabase pide confirmar el email antes de entrar
      if (!res.data || !res.data.session) { st.textContent = t("su.confirm"); st.className = "status"; }
    }).catch(function (e) { btn.disabled = false; resetCaptcha(); bad(e && e.message === "captcha" ? t("cap.wait") : t("login.errNet")); });
  });
}

/* Cuenta creada pero aún sin aprobar */
function mountPending(root) {
  var req = state.myRequest;
  root.innerHTML = '<div class="notice"><h3>' + esc(t("pend.t")) + '</h3><p>' + esc(t("pend.p")) + '</p></div>' +
    '<div class="form-actions" style="margin-top:20px">' +
      (req ? '<span class="chip me">' + esc(t("pend.sent")) + '</span>' : '<button type="button" class="btn solid" id="pend-send">' + esc(t("pend.send")) + '</button>') +
      '<button type="button" class="btn small" id="pend-check">' + esc(t("pend.check")) + '</button>' +
      '<button type="button" class="btn small" id="logout-btn">' + esc(t("logout")) + '</button>' +
      '<span class="status" id="pend-status" role="status" aria-live="polite"></span></div>';
  var send = document.getElementById("pend-send");
  if (send) send.addEventListener("click", function () { send.disabled = true; sendJoinRequest().then(loadData).catch(function () { send.disabled = false; document.getElementById("pend-status").textContent = t("f.errSave"); }); });
  document.getElementById("pend-check").addEventListener("click", function () { loadData(); });
  document.getElementById("logout-btn").addEventListener("click", function () { signOutAll(); });
}
function sendJoinRequest() {
  var md = state.meta || {};
  var first = (md.first_name || "").trim() || (state.email.split("@")[0] || "?"), last = (md.last_name || "").trim() || "-";
  return state.sb.from("join_requests").upsert({ user_id: state.uid, first_name: first.slice(0, 60), last_name: last.slice(0, 80), email: state.email.slice(0, 120) })
    .then(function (res) { if (res.error) throw res.error; });
}

function mountSetPassword(root) {
  if (root.querySelector("#pwf")) return;
  root.innerHTML = '<form class="panel" id="pwf" novalidate style="max-width:460px">' +
      '<div><h3>' + esc(t("pw.title")) + '</h3><p class="muted" style="margin:6px 0 0">' + esc(t("pw.p")) + '</p></div>' +
      '<input type="email" autocomplete="username" value="' + esc(state.email) + '" hidden>' +
      '<div class="field"><label for="p-new">' + esc(t("pw.new")) + '</label><input type="password" id="p-new" autocomplete="new-password" minlength="8" required></div>' +
      '<div class="field"><label for="p-rep">' + esc(t("pw.repeat")) + '</label><input type="password" id="p-rep" autocomplete="new-password" minlength="8" required></div>' +
      '<div class="form-actions"><button type="submit" class="btn solid" id="p-go">' + esc(t("pw.save")) + '</button>' +
        (state.players[state.uid] ? '<button type="button" class="btn" id="p-cancel">' + esc(t("f.cancel")) + '</button>' : '') + '</div>' +
      '<span class="status" id="p-status" role="status" aria-live="polite"></span>' +
    '</form>';
  var f = document.getElementById("pwf"), st = document.getElementById("p-status");
  var cancel = document.getElementById("p-cancel");
  if (cancel) cancel.addEventListener("click", function () { state.needPassword = false; renderMe(); });
  f.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var a = f.querySelector("#p-new").value, b = f.querySelector("#p-rep").value;
    if (a.length < 8) { st.textContent = t("pw.errLen"); st.className = "status bad"; return; }
    if (a !== b) { st.textContent = t("pw.errMatch"); st.className = "status bad"; return; }
    var btn = document.getElementById("p-go"); btn.disabled = true;
    state.sb.auth.updateUser({ password: a }).then(function (res) {
      btn.disabled = false;
      if (res.error) { st.textContent = res.error.message || t("f.errSave"); st.className = "status bad"; return; }
      state.needPassword = false; renderMe();
      document.getElementById("me-note").textContent = t("pw.saved");
    }).catch(function () { btn.disabled = false; st.textContent = t("login.errNet"); st.className = "status bad"; });
  });
}

/* ───────────── Formulario de perfil ───────────── */
var formMounted = false, formPhoto = null;
function radios(name, opts, prefix, val) {
  return '<div class="choices">' + opts.map(function (o) {
    return '<label class="choice"><input type="radio" name="' + name + '" id="f-' + name + '-' + o + '" value="' + o + '"' + (val === o ? " checked" : "") + '><span>' + esc(t(prefix + o)) + '</span></label>';
  }).join("") + '</div>';
}
function norm(x) { return String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").toLowerCase(); }
function countryOptions(sel, q) {
  var codes = state.regions ? Object.keys(state.regions) : [];
  var items = codes.map(function (c) { return { c: c, n: countryName(c) }; });
  if (q) {
    var nq = norm(q);
    items = items.filter(function (i) {
      if (i.c === sel || i.c.toLowerCase() === nq) return true;
      // Busca en los 4 idiomas de la web, para que cada una lo encuentre como lo escriba
      return LANGS.some(function (l) { var n; try { n = new Intl.DisplayNames([LOCALE[l]], { type: "region" }).of(i.c); } catch (e) { n = i.n; } return norm(n).indexOf(nq) >= 0; });
    });
  }
  try { items.sort(function (a, b) { return a.n.localeCompare(b.n, LOCALE[lang]); }); } catch (e) { items.sort(function (a, b) { return a.n < b.n ? -1 : 1; }); }
  return '<option value="">' + esc(t("f.choose")) + '</option>' + items.map(function (i) { return '<option value="' + i.c + '"' + (i.c === sel ? " selected" : "") + '>' + esc(i.n) + '</option>'; }).join("");
}
function regionOptions(cc, sel, q) {
  var reg = state.regions && state.regions[cc];
  if (!reg) return '<option value="">' + esc(t("f.choose")) + '</option>';
  var items = reg.r.slice().sort(function (a, b) { return a[1].localeCompare(b[1]); });
  if (q) { var nq = norm(q); items = items.filter(function (r) { return norm(r[1]).indexOf(nq) >= 0 || r[0] === sel; }); }
  return '<option value="">' + esc(t("f.choose")) + '</option>' + items.map(function (r) { return '<option value="' + esc(r[0]) + '"' + (r[0] === sel ? " selected" : "") + '>' + esc(r[1]) + '</option>'; }).join("");
}
function field(id, key, type, val, extra) {
  var req = !!(extra && extra.required);
  return '<div class="field' + (extra && extra.full ? " full" : "") + '"><label for="f-' + id + '">' + esc(t(key)) + (req ? ' <span class="req" aria-hidden="true">*</span>' : ' <span class="opt">(' + esc(t("f.optional")) + ')</span>') + '</label>' +
    '<input type="' + type + '" id="f-' + id + '" name="' + id + '" value="' + esc(val || "") + '"' + (req ? ' required' : '') + ' aria-describedby="e-' + id + (extra && extra.hint ? ' h-' + id : '') + '"' + (extra && extra.attrs || "") + '>' +
    (extra && extra.hint ? '<span class="hint" id="h-' + id + '">' + esc(t(extra.hint)) + '</span>' : '') +
    '<span class="err" id="e-' + id + '"></span></div>';
}
function mountForm(me) {
  formMounted = true;
  me = me || {};
  formPhoto = me.photo || null;
  var root = document.getElementById("me-root");
  var intro = state.players[state.uid] ? '' : '<div class="notice" style="margin-bottom:24px"><h3>' + esc(t("me.welcome.t")) + '</h3><p>' + esc(t("me.welcome.p")) + '</p></div>';
  root.innerHTML = intro + '<form class="panel" id="pf" novalidate>' +
    '<div class="field"><span class="label">' + esc(t("f.photo")) + '</span><div class="photo-pick"><div style="width:240px;max-width:100%;border:1px solid var(--line)"><div class="photo" id="pf-photo" style="width:100%;border:0"></div><div id="pf-kit"></div></div>' +
      '<div style="display:grid;gap:8px;justify-items:start"><label class="btn small" for="f-photo" style="color:var(--text)">' + esc(t("f.photoPick")) + '</label>' +
      '<input type="file" id="f-photo" accept="image/*" style="position:absolute;opacity:0;width:1px;height:1px">' +
      '<button type="button" class="btn small" id="pf-photo-rm">' + esc(t("f.photoRemove")) + '</button>' +
      '<span class="hint">' + esc(t("f.photoHint")) + '</span><span class="err" id="e-photo"></span></div></div></div>' +
    '<div class="form-grid">' +
      field("first", "f.first", "text", me.firstName, { required: true, attrs: ' autocomplete="given-name" maxlength="60"' }) +
      field("last", "f.last", "text", me.lastName, { required: true, attrs: ' autocomplete="family-name" maxlength="80"' }) +
      '<div class="field"><label for="f-country">' + esc(t("f.country")) + ' <span class="req" aria-hidden="true">*</span></label>' +
        '<input type="search" class="opt-search" id="s-country" autocomplete="xnrgy-search" placeholder="' + esc(t("f.searchCountry")) + '" aria-label="' + esc(t("f.searchCountry")) + '" aria-controls="f-country">' +
        '<select id="f-country" name="xnrgy_bc" autocomplete="xnrgy-birth-country" required aria-describedby="e-country">' + countryOptions(me.country) + '</select><span class="err" id="e-country"></span></div>' +
      '<div class="field"><label for="f-region">' + esc(t("f.region")) + ' <span class="req" aria-hidden="true">*</span></label>' +
        '<input type="search" class="opt-search" id="s-region" autocomplete="xnrgy-search" placeholder="' + esc(t("f.searchRegion")) + '" aria-label="' + esc(t("f.searchRegion")) + '" aria-controls="f-region">' +
        '<select id="f-region" name="xnrgy_br" autocomplete="xnrgy-birth-region" required aria-describedby="e-region">' + regionOptions(me.country, me.region) + '</select><span class="err" id="e-region"></span></div>' +
      '<div class="field full"><span class="hint">' + esc(t("f.regionHint")) + '</span> <span class="hint" id="pf-flagnote"></span></div>' +
      field("birthday", "f.birthday", "date", me.birthday, { attrs: ' autocomplete="bday" min="1930-01-01" max="2025-12-31"' }) +
      field("phone", "f.phone", "tel", me.phone, { attrs: ' autocomplete="tel" maxlength="25" placeholder="+31 6 12345678"' }) +
      field("email", "f.email", "email", me.email, { attrs: ' autocomplete="email" maxlength="120"' }) +
      field("knltb", "f.knltb", "text", me.knltb, { hint: "f.knltbHint", attrs: ' inputmode="numeric" maxlength="10"' }) +
      '<fieldset class="field" id="fs-side"><legend>' + esc(t("f.side")) + ' <span class="opt">(' + esc(t("f.optional")) + ')</span></legend>' + radios("side", ["left", "right", "any"], "side.", me.side) + '<span class="err" id="e-side"></span></fieldset>' +
      '<fieldset class="field" id="fs-hand"><legend>' + esc(t("f.hand")) + ' <span class="opt">(' + esc(t("f.optional")) + ')</span></legend>' + radios("hand", ["right", "left", "both"], "hand.", me.hand) + '<span class="err" id="e-hand"></span></fieldset>' +
    '</div>' +
    '<div class="form-actions"><button type="submit" class="btn solid" id="pf-save">' + esc(t("f.save")) + '</button>' +
      (state.players[state.uid] ? '<button type="button" class="btn" id="pf-cancel">' + esc(t("f.cancel")) + '</button>' : '') +
      '<span class="status" id="pf-status" role="status" aria-live="polite"></span></div>' +
  '</form>';

  var f = document.getElementById("pf");
  function paintPhoto() {
    document.getElementById("pf-photo").innerHTML = photoHtml({ photo: formPhoto, firstName: f.first.value, lastName: f.last.value });
    document.getElementById("pf-photo-rm").hidden = !formPhoto;
  }
  function paintFlags() {
    var cc = f.xnrgy_bc.value, rc = f.xnrgy_br.value, ri = cc ? regionInfo(cc, rc) : { name: "", hasFlag: true };
    document.getElementById("pf-kit").innerHTML = kitHtml({ country: cc, region: rc, regionName: ri.name, firstName: f.first.value, lastName: f.last.value }, false);
    document.getElementById("pf-flagnote").textContent = (cc && rc && !ri.hasFlag) ? t("f.noRegionFlag") : "";
  }
  paintPhoto(); paintFlags();
  f.first.addEventListener("input", function () { paintPhoto(); paintFlags(); }); f.last.addEventListener("input", function () { paintPhoto(); paintFlags(); });
  var sC = document.getElementById("s-country"), sR = document.getElementById("s-region");
  function pickCountry() { sR.value = ""; f.xnrgy_br.innerHTML = regionOptions(f.xnrgy_bc.value, ""); paintFlags(); }
  f.xnrgy_bc.addEventListener("change", pickCountry);
  function wireSearch(input, select, build, onPick) {
    input.addEventListener("input", function () {
      var cur = select.value;
      select.innerHTML = build(cur, input.value);
      var real = Array.prototype.filter.call(select.options, function (o) { return o.value; });
      if (input.value && real.length === 1 && real[0].value !== cur) { select.value = real[0].value; onPick(); }
      else select.value = cur;
    });
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        var first = Array.prototype.find.call(select.options, function (o) { return o.value; });
        if (first) { select.value = first.value; onPick(); select.focus(); }
      } else if (ev.key === "ArrowDown") { ev.preventDefault(); select.focus(); }
    });
  }
  wireSearch(sC, f.xnrgy_bc, function (sel, q) { return countryOptions(sel, q); }, pickCountry);
  wireSearch(sR, f.xnrgy_br, function (sel, q) { return regionOptions(f.xnrgy_bc.value, sel, q); }, paintFlags);
  f.xnrgy_br.addEventListener("change", paintFlags);
  document.getElementById("pf-photo-rm").addEventListener("click", function () { formPhoto = null; paintPhoto(); });
  document.getElementById("f-photo").addEventListener("change", function (ev) {
    var file = ev.target.files && ev.target.files[0]; ev.target.value = "";
    document.getElementById("e-photo").textContent = "";
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { document.getElementById("e-photo").textContent = t("f.errBig"); return; }
    resizePhoto(file).then(function (url) { formPhoto = url; paintPhoto(); })
      .catch(function () { document.getElementById("e-photo").textContent = t("f.errImg"); });
  });
  var cancel = document.getElementById("pf-cancel");
  if (cancel) cancel.addEventListener("click", function () { state.editing = false; formMounted = false; renderMe(); });
  f.addEventListener("submit", function (ev) { ev.preventDefault(); saveProfile(f); });
}

function resizePhoto(file) {
  return new Promise(function (resolve, reject) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var s = Math.min(img.naturalWidth, img.naturalHeight), size = 400;
      var c = document.createElement("canvas"); c.width = size; c.height = size;
      var ctx = c.getContext("2d");
      ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      var q = 0.82, out = c.toDataURL("image/jpeg", q);
      while (out.length > 120000 && q > 0.4) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }
      resolve(out);
    };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("img")); };
    img.src = url;
  });
}

function setErr(id, msg, el) {
  var e = document.getElementById("e-" + id); if (e) e.textContent = msg || "";
  if (el) el.setAttribute("aria-invalid", msg ? "true" : "false");
}
function saveProfile(f) {
  var v = {
    firstName: f.first.value.trim(), lastName: f.last.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim(),
    knltb: f.knltb.value.replace(/\s/g, ""), side: (f.querySelector('input[name=side]:checked') || {}).value || "",
    hand: (f.querySelector('input[name=hand]:checked') || {}).value || "", country: f.xnrgy_bc.value, region: f.xnrgy_br.value,
    birthday: f.birthday.value || ""
  };
  var bad = null;
  function check(id, ok, msg, el) { setErr(id, ok ? "" : msg, el); if (!ok && !bad) bad = el || document.getElementById("f-" + id); }
  check("first", !!v.firstName, t("f.errRequired"), f.first);
  check("last", !!v.lastName, t("f.errRequired"), f.last);
  // Opcionales: solo se comprueban si están rellenos
  check("birthday", !v.birthday || /^(19[3-9]\d|20[0-2]\d)-\d\d-\d\d$/.test(v.birthday), t("f.errBirthday"), f.birthday);
  check("phone", !v.phone || (v.phone.replace(/\D/g, "").length >= 9 && v.phone.length <= 25), t("f.errPhone"), f.phone);
  check("email", !v.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email), t("f.errEmail"), f.email);
  check("knltb", !v.knltb || /^\d{6,10}$/.test(v.knltb), t("f.errKnltb"), f.knltb);
  check("country", !!v.country, t("f.errRequired"), f.xnrgy_bc);
  check("region", !!v.region, t("f.errRequired"), f.xnrgy_br);
  var st = document.getElementById("pf-status");
  if (bad) { st.textContent = t("f.errForm"); st.className = "status bad"; bad.focus(); return; }
  v.regionName = regionInfo(v.country, v.region).name;
  var old = state.players[state.uid] || {}, oldPath = old.photoPath || null;
  v.photo = formPhoto || null;
  v.photoPath = formPhoto ? oldPath : null;
  v.updatedAt = new Date().toISOString();
  var btn = document.getElementById("pf-save"); btn.disabled = true;
  st.textContent = t("f.saving"); st.className = "status";
  var isNew = formPhoto && /^data:image\//.test(formPhoto);
  (isNew ? uploadPhoto(formPhoto).then(function (path) { v.photoPath = path; }) : Promise.resolve()).then(function () {
    return state.sb.from("players").upsert(toRow(v));
  }).then(function (res) {
    if (res.error) throw res.error;
    return state.sb.from("player_contacts").upsert(toContact(v));
  }).then(function (res) {
    if (res.error) throw res.error;
    if (oldPath && oldPath !== v.photoPath) removePhotos([oldPath]);
    state.players[state.uid] = v; state.editing = false; formMounted = false;
    renderAll();
    document.getElementById("me-note").textContent = t("f.saved");
  }).catch(function (e) {
    btn.disabled = false;
    // Mostrar el motivo técnico ayuda a arreglarlo si vuelve a pasar
    st.textContent = t("f.errSave") + (e && (e.message || e.code) ? " (" + (e.code ? e.code + ": " : "") + (e.message || "") + ")" : ""); st.className = "status bad";
  });
}

/* ───────────── Alineaciones (capitanas) ───────────── */
var adminDirty = {};
function renderAdmin() {
  var sec = document.getElementById("alineaciones");
  if (state.phase !== "ready" || !canManage() || location.hash !== "#alineaciones") { sec.hidden = true; return; }
  sec.hidden = false;
  var players = sortedPlayers();
  // Solicitudes de acceso (dueña y capitanas)
  var rb = document.getElementById("requests-box");
  var reqs = state.requests || [];
  rb.hidden = false;
  rb.innerHTML = '<span class="label">' + esc(t("req.title")) + (reqs.length ? ' · ' + reqs.length : '') + '</span>' +
    (reqs.length ? '<p class="hint" style="margin:4px 0 8px">' + esc(t("req.hint")) + '</p>' + reqs.map(function (q) {
      return '<div class="req-row"><span><b>' + esc(q.first_name + " " + q.last_name) + '</b><br><span class="muted">' + esc(q.email) + '</span></span>' +
        '<span class="form-actions"><button type="button" class="btn small solid" data-approve="' + esc(q.user_id) + '">' + esc(t("req.approve")) + '</button>' +
        '<button type="button" class="btn small" data-reject="' + esc(q.user_id) + '">' + esc(t("req.reject")) + '</button></span></div>';
    }).join("") : '<p class="muted" style="margin:6px 0 0">' + esc(t("req.none")) + '</p>');
  rb.querySelectorAll("[data-approve]").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = b.getAttribute("data-approve"); b.disabled = true;
      state.sb.from("team_roles").insert({ user_id: id, role: "player" }).then(function (res) {
        if (res.error) throw res.error;
        return state.sb.from("join_requests").delete().eq("user_id", id);
      }).then(function () { return loadData(); }).catch(function () { b.disabled = false; });
    });
  });
  rb.querySelectorAll("[data-reject]").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = b.getAttribute("data-reject"); b.disabled = true;
      state.sb.from("join_requests").delete().eq("user_id", id).then(function () { return loadData(); }).catch(function () { b.disabled = false; });
    });
  });
  // Roles del equipo: dueña, capitana y managers nombran managers; solo la dueña nombra capitana
  var mb = document.getElementById("managers-box");
  var others = players.filter(function (x) { return x.id !== state.uid && state.roles[x.id] && state.roles[x.id] !== "owner"; });
  if (others.length) {
    mb.hidden = false;
    mb.innerHTML = '<span class="label">' + esc(t("adm.managers")) + '</span><p class="hint" style="margin:4px 0 12px">' + esc(t("adm.managersHint")) + '</p>' +
      others.map(function (x) {
        var r = state.roles[x.id];
        var opts = ["player", "manager"].concat(state.isOwner || r === "captain" ? ["captain"] : []);
        var locked = r === "captain" && !state.isOwner;
        return '<div class="req-row"><span class="partner">' + miniHtml(x.p) + '<b>' + esc(fullName(x.p)) + '</b></span>' +
          (locked ? '<span class="badge">' + esc(t("role.captain")) + '</span>' :
          '<select data-rid="' + esc(x.id) + '" aria-label="' + esc(t("adm.roleOf")) + ' ' + esc(fullName(x.p)) + '" style="width:auto;min-width:170px">' +
            opts.map(function (o) { return '<option value="' + o + '"' + (o === r ? " selected" : "") + '>' + esc(t("role." + o)) + '</option>'; }).join("") +
          '</select>') + '</div>';
      }).join("") + '<span class="status" id="roles-status" role="status" aria-live="polite"></span>';
    mb.querySelectorAll("select[data-rid]").forEach(function (sel) {
      var before = sel.value;
      sel.addEventListener("change", function () {
        var id = sel.getAttribute("data-rid"); sel.disabled = true;
        state.sb.from("team_roles").update({ role: sel.value }).eq("user_id", id).select().then(function (res) {
          if (res.error || !res.data || !res.data.length) throw res.error || new Error("denied");
          return loadData();
        }).catch(function () {
          sel.value = before; sel.disabled = false;
          var st = document.getElementById("roles-status"); if (st) { st.textContent = t("f.errSave"); st.className = "status bad"; }
        });
      });
    });
  } else mb.hidden = true;

  renderStandingsEditor();
  var list = document.getElementById("admin-list");
  if (!players.length) { list.innerHTML = '<p class="muted">' + esc(t("adm.empty")) + '</p>'; return; }
  // No repintar una jornada que alguien está editando
  var keep = {};
  list.querySelectorAll(".admin-round").forEach(function (el) { var r = el.getAttribute("data-r"); if (adminDirty[r]) keep[r] = el; });
  var optsFor = function (r) {
    var groups = { yes: [], maybe: [], none: [], no: [] };
    players.forEach(function (x) { var a = availOf(x.id, r); groups[a && a.status ? a.status : "none"].push(x); });
    return function (sel) {
      return '<option value="">' + esc(t("adm.pick")) + '</option>' + ["yes", "maybe", "none", "no"].map(function (g) {
        if (!groups[g].length) return "";
        return '<optgroup label="' + esc(t("avg." + g)) + '">' + groups[g].map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === sel ? " selected" : "") + '>' + esc(fullName(x.p)) + '</option>'; }).join("") + '</optgroup>';
      }).join("");
    };
  };
  var frag = document.createDocumentFragment();
  ROUNDS.forEach(function (m) {
    if (keep[m.r]) { frag.appendChild(keep[m.r]); return; }
    var d = roundDoc(m.r) || {}, pairs = pairsOf(m.r), rival = m.home === US ? m.away : m.home, opts = optsFor(m.r);
    var el = document.createElement("details");
    el.className = "admin-round"; el.setAttribute("data-r", m.r); el.setAttribute("data-date", m.date); el.setAttribute("data-rival", rival);
    if (adminOpen[m.r]) el.open = true;
    el.addEventListener("toggle", function () { adminOpen[m.r] = el.open; });
    var filled = pairs.filter(function (pr) { return pr[0] && pr[1]; }).length;
    var hasScore = typeof d.us === "number" && typeof d.them === "number";
    el.innerHTML = '<summary class="admin-sum"><span class="admin-sum-t"><span class="sum-title">' + esc(t("round")) + ' ' + m.r + ' · ' + esc(rival) + '</span>' +
        '<span class="muted">' + esc(fmtDate(m.date)) + ' · ' + esc(timeStr(m)) + '</span></span>' +
        '<span class="sum-chips"><span class="chip' + (filled === 4 ? " ok" : "") + '">' + esc(t("sum.lineup", { n: filled })) + '</span>' +
        (hasScore ? '<span class="chip ' + (d.us > d.them ? "w" : d.us < d.them ? "l" : "") + '">' + d.us + '–' + d.them + '</span>' : '') +
        '<span class="caret" aria-hidden="true">›</span></span></summary><div class="admin-body">' +
      availSummaryHtml(m) +
      '<div class="meet-edit"><div class="field"><label for="a' + m.r + '-mt">' + esc(t("meet.time")) + '</label><input type="time" id="a' + m.r + '-mt" value="' + esc(d.meetTime || "") + '"></div>' +
        '<div class="field"><label for="a' + m.r + '-mp">' + esc(t("meet.place")) + '</label><input type="text" id="a' + m.r + '-mp" maxlength="80" placeholder="' + esc(t("meet.placePh")) + '" value="' + esc(d.meetPlace || "") + '"></div></div>' +
      pairs.map(function (pr, i) {
        var rs = resultsOf(m.r)[i] || {}, rv = Array.isArray(rs.rivals) ? rs.rivals : ["", ""];
        var id = "a" + m.r + "-" + i;
        return '<div class="dd-card"><span class="dd-tag">' + SLOTS[i] + '</span><div class="dd-lines">' +
          '<div class="dd-line"><span class="label">' + esc(t("adm.ourPair")) + '</span>' +
            '<select id="' + id + '-0" aria-label="' + SLOTS[i] + ' · ' + esc(t("adm.ourPair")) + ' 1">' + opts(pr[0]) + '</select>' +
            '<select id="' + id + '-1" aria-label="' + SLOTS[i] + ' · ' + esc(t("adm.ourPair")) + ' 2">' + opts(pr[1]) + '</select>' + ackLineHtml(m.r, pr) + '</div>' +
          '<div class="dd-vs" aria-hidden="true">' + esc(t("next.vs")) + '</div>' +
          '<div class="dd-line"><span class="label">' + esc(t("adm.rivalPair")) + '<small>' + esc(rival) + '</small></span>' +
            '<select class="rv-sel" id="' + id + '-r0" aria-label="' + SLOTS[i] + ' · ' + esc(t("adm.rivalPair")) + ' 1">' + rivalOpts(rival, rv[0]) + '</select>' +
            '<select class="rv-sel" id="' + id + '-r1" aria-label="' + SLOTS[i] + ' · ' + esc(t("adm.rivalPair")) + ' 2">' + rivalOpts(rival, rv[1]) + '</select></div>' +
          '<div class="dd-sets"><span class="label">' + esc(t("adm.sets")) + '</span><div class="set-row">' +
            [0, 1, 2].map(function (k) {
              var sv = setsOf(rs)[k] || ["", ""];
              return '<div class="set-box"><span class="set-n">' + (k + 1) + '</span>' +
                '<input type="text" inputmode="numeric" maxlength="2" class="set-in" id="' + id + '-s' + k + 'a" aria-label="' + SLOTS[i] + ' · ' + esc(t("adm.set")) + ' ' + (k + 1) + ' · ' + esc(t("adm.us")) + '" value="' + esc(sv[0]) + '">' +
                '<span class="set-dash">–</span>' +
                '<input type="text" inputmode="numeric" maxlength="2" class="set-in" id="' + id + '-s' + k + 'b" aria-label="' + SLOTS[i] + ' · ' + esc(t("adm.set")) + ' ' + (k + 1) + ' · ' + esc(t("adm.them")) + '" value="' + esc(sv[1]) + '"></div>';
            }).join("") +
            '<span class="res p dd-auto" id="' + id + '-auto">—</span></div></div>' +
        '</div></div>';
      }).join("") +
      '<div class="admin-total" id="a' + m.r + '-total"></div>' +
      '<div class="form-actions"><button type="button" class="btn small solid" data-save>' + esc(t("adm.save")) + '</button>' +
        '<a class="btn small wa" href="' + esc(waUrl(m)) + '" target="_blank" rel="noopener" data-wa>' + esc(t("wa.share")) + '</a>' +
        '<button type="button" class="btn small" data-notify>' + esc(t("push.lineupBtn")) + '</button><span class="status" role="status" aria-live="polite"></span></div></div>';
    el.addEventListener("input", function () { adminDirty[m.r] = true; updateRoundTotals(m.r, el); });
    el.addEventListener("change", function () {
      adminDirty[m.r] = true;
      var ids = Array.prototype.map.call(el.querySelectorAll(".dd-line select:not(.dd-out):not(.rv-sel)"), function (s) { return s.value; }).filter(Boolean);
      var dup = ids.length !== new Set(ids).size;
      var stx = el.querySelector(".status"); stx.textContent = dup ? t("adm.dup") : ""; stx.className = "status" + (dup ? " bad" : "");
    });
    el.querySelector("[data-save]").addEventListener("click", function () { saveRound(m.r, el); });
    el.querySelector("[data-notify]").addEventListener("click", function () { notifyLineup(m.r, el, this); });
    updateRoundTotals(m.r, el);
    frag.appendChild(el);
  });
  list.innerHTML = ""; list.appendChild(frag);
  renderAdminFilters(); applyAdminFilters();
}
/* Desplegable de rivales (como el de nuestras jugadoras). Si hay un nombre guardado que ya no está en KNLTB, se conserva. */
function rivalOpts(team, cur) {
  var list = (state.rivals[team] || []).slice(), html = '<option value="">—</option>', seen = false;
  list.forEach(function (x) {
    if (x.name === cur) seen = true;
    html += '<option value="' + esc(x.name) + '"' + (x.name === cur ? " selected" : "") + '>' + esc(x.name) + (x.rating ? " · " + esc(x.rating) : "") + '</option>';
  });
  if (cur && !seen) html += '<option value="' + esc(cur) + '" selected>' + esc(cur) + '</option>';
  return html;
}
/* Sets: [[nosotras, rival], ...] a partir de lo guardado (o de un texto antiguo "6-4 6-3") */
function setsOf(rs) {
  if (rs && Array.isArray(rs.sets)) return rs.sets;
  if (rs && rs.score) return rs.score.split(/\s+/).map(function (x) { var m = x.match(/^(\d{1,2})-(\d{1,2})$/); return m ? [m[1], m[2]] : null; }).filter(Boolean);
  return [];
}
function readSets(r, i, el) {
  var sets = [], bad = false;
  [0, 1, 2].forEach(function (k) {
    var a = el.querySelector("#a" + r + "-" + i + "-s" + k + "a").value.trim(), b = el.querySelector("#a" + r + "-" + i + "-s" + k + "b").value.trim();
    if (a === "" && b === "") return;
    if (!/^\d{1,2}$/.test(a) || !/^\d{1,2}$/.test(b)) { bad = true; return; }
    sets.push([+a, +b]);
  });
  return { sets: sets, bad: bad };
}
// Al mejor de 3 sets: gana quien llega a 2 sets
function matchOutcome(sets) {
  var w = 0, l = 0;
  sets.forEach(function (x) { if (x[0] > x[1]) w++; else if (x[1] > x[0]) l++; });
  return { setsW: w, setsL: l, won: w >= 2 ? true : l >= 2 ? false : null };
}
function updateRoundTotals(r, el) {
  var tot = { pw: 0, pl: 0, sw: 0, sl: 0, gw: 0, gl: 0 }, anyBad = false;
  [0, 1, 2, 3].forEach(function (i) {
    var rd = readSets(r, i, el), oc = matchOutcome(rd.sets);
    if (rd.bad) anyBad = true;
    var chip = el.querySelector("#a" + r + "-" + i + "-auto");
    chip.className = "res dd-auto " + (oc.won === true ? "w" : oc.won === false ? "l" : "p");
    chip.textContent = oc.won === true ? t("res.w") : oc.won === false ? t("res.l") : "—";
    if (oc.won === true) tot.pw++; if (oc.won === false) tot.pl++;
    tot.sw += oc.setsW; tot.sl += oc.setsL;
    rd.sets.forEach(function (x) { tot.gw += x[0]; tot.gl += x[1]; });
  });
  el.querySelector("#a" + r + "-total").innerHTML =
    '<span class="label">' + esc(t("adm.score")) + '</span>' +
    '<div class="tot"><b>' + tot.pw + '–' + tot.pl + '</b><span>' + esc(t("adm.matches")) + '</span></div>' +
    '<div class="tot"><b>' + tot.sw + '–' + tot.sl + '</b><span>' + esc(t("adm.setsTot")) + '</span></div>' +
    '<div class="tot"><b>' + tot.gw + '–' + tot.gl + '</b><span>' + esc(t("adm.games")) + '</span></div>' +
    (anyBad ? '<span class="status bad">' + esc(t("adm.badSet")) + '</span>' : '');
  return { tot: tot, bad: anyBad };
}
var adminOpen = {};
var admFilter = { rival: "", round: "", from: "", to: "" };
function renderAdminFilters() {
  var box = document.getElementById("adm-filters");
  if (box.getAttribute("data-lang") === lang && box.childElementCount) return;
  box.setAttribute("data-lang", lang);
  var rivals = ROUNDS.map(function (m) { return m.home === US ? m.away : m.home; });
  box.innerHTML =
    '<div class="field"><label for="flt-rival">' + esc(t("flt.rival")) + '</label><select id="flt-rival"><option value="">' + esc(t("flt.all")) + '</option>' +
      rivals.slice().sort().map(function (x) { return '<option value="' + esc(x) + '"' + (admFilter.rival === x ? " selected" : "") + '>' + esc(x) + '</option>'; }).join("") + '</select></div>' +
    '<div class="field"><label for="flt-round">' + esc(t("round")) + '</label><select id="flt-round"><option value="">' + esc(t("flt.all")) + '</option>' +
      ROUNDS.map(function (m) { return '<option value="' + m.r + '"' + (String(admFilter.round) === String(m.r) ? " selected" : "") + '>' + esc(t("round")) + ' ' + m.r + '</option>'; }).join("") + '</select></div>' +
    '<div class="field"><label for="flt-from">' + esc(t("flt.from")) + '</label><input type="date" id="flt-from" min="2026-11-01" max="2027-03-31" value="' + esc(admFilter.from) + '"></div>' +
    '<div class="field"><label for="flt-to">' + esc(t("flt.to")) + '</label><input type="date" id="flt-to" min="2026-11-01" max="2027-03-31" value="' + esc(admFilter.to) + '"></div>' +
    '<div class="field flt-actions"><button type="button" class="btn small" id="flt-clear">' + esc(t("flt.clear")) + '</button><button type="button" class="btn small" id="flt-open">' + esc(t("flt.openAll")) + '</button></div>' +
    '<p class="hint flt-count" id="flt-count" role="status" aria-live="polite"></p>';
  [["flt-rival", "rival"], ["flt-round", "round"], ["flt-from", "from"], ["flt-to", "to"]].forEach(function (x) {
    var el = document.getElementById(x[0]);
    el.addEventListener("change", function () { admFilter[x[1]] = el.value; applyAdminFilters(); });
  });
  document.getElementById("flt-clear").addEventListener("click", function () {
    admFilter = { rival: "", round: "", from: "", to: "" };
    box.removeAttribute("data-lang"); renderAdminFilters(); applyAdminFilters();
  });
  document.getElementById("flt-open").addEventListener("click", function () {
    var vis = Array.prototype.filter.call(document.querySelectorAll("#admin-list .admin-round"), function (el) { return !el.hidden; });
    var open = vis.some(function (el) { return !el.open; });
    vis.forEach(function (el) { el.open = open; adminOpen[el.getAttribute("data-r")] = open; });
    this.textContent = t(open ? "flt.closeAll" : "flt.openAll");
  });
}
function applyAdminFilters() {
  var shown = 0, all = document.querySelectorAll("#admin-list .admin-round");
  all.forEach(function (el) {
    var ok = (!admFilter.rival || el.getAttribute("data-rival") === admFilter.rival) &&
      (!admFilter.round || el.getAttribute("data-r") === String(admFilter.round)) &&
      (!admFilter.from || el.getAttribute("data-date") >= admFilter.from) &&
      (!admFilter.to || el.getAttribute("data-date") <= admFilter.to);
    el.hidden = !ok; if (ok) shown++;
  });
  var c = document.getElementById("flt-count");
  if (c) c.textContent = shown ? t("flt.count", { n: shown, total: all.length }) : t("flt.none");
}
var standDirty = false;
function renderStandingsEditor() {
  var box = document.getElementById("standings-edit");
  if (standDirty) return;
  var cols = [["played", "tab.p"], ["won", "tab.w"], ["drawn", "tab.d"], ["lost", "tab.l"], ["points", "tab.pts"]];
  box.innerHTML = '<div class="admin-head"><h3>' + esc(t("tab.title")) + '</h3><span class="hint">' + esc(t("std.hint")) + '</span></div>' +
    '<div class="table-wrap"><table class="std-edit"><thead><tr><th>' + esc(t("tab.team")) + '</th>' + cols.map(function (c) { return '<th class="n">' + esc(t(c[1])) + '</th>'; }).join("") + '</tr></thead><tbody>' +
    sortedStandings().map(function (x) {
      return '<tr data-team="' + esc(x.team) + '"><td class="team">' + esc(x.team) + '</td>' + cols.map(function (c) {
        return '<td class="n"><input type="text" inputmode="numeric" maxlength="3" data-col="' + c[0] + '" aria-label="' + esc(x.team) + ' · ' + esc(t(c[1])) + '" value="' + (x[c[0]] || 0) + '"></td>';
      }).join("") + '</tr>';
    }).join("") + '</tbody></table></div>' +
    '<div class="form-actions"><button type="button" class="btn small solid" id="std-save">' + esc(t("std.save")) + '</button><a class="btn small" href="https://mijnknltb.toernooi.nl/league/29119B50-5DBF-428B-A636-B16B52242F5C/draw/361" target="_blank" rel="noopener">' + esc(t("std.knltb")) + '</a><span class="status" id="std-status" role="status" aria-live="polite"></span></div>';
  box.oninput = function () { standDirty = true; };
  document.getElementById("std-save").addEventListener("click", function () {
    var st = document.getElementById("std-status"), rowsOut = [], bad = false;
    box.querySelectorAll("tr[data-team]").forEach(function (tr) {
      var row = { team: tr.getAttribute("data-team"), updated_at: new Date().toISOString() };
      tr.querySelectorAll("input[data-col]").forEach(function (inp) { var v = inp.value.trim() || "0"; if (!/^\d{1,3}$/.test(v)) bad = true; row[inp.getAttribute("data-col")] = +v; });
      rowsOut.push(row);
    });
    if (bad) { st.textContent = t("f.errForm"); st.className = "status bad"; return; }
    st.textContent = t("f.saving"); st.className = "status";
    state.sb.from("standings").upsert(rowsOut).then(function (res) {
      if (res.error) throw res.error;
      standDirty = false; state.standings = rowsOut; renderStandings(); renderStandingsEditor();
      var s2 = document.getElementById("std-status"); if (s2) s2.textContent = t("av.saved");
    }).catch(function () { st.textContent = t("f.errSave"); st.className = "status bad"; });
  });
}
function availSummaryHtml(m) {
  var lists = { yes: [], maybe: [], no: [], none: [] };
  sortedPlayers().forEach(function (x) { var a = availOf(x.id, m.r); lists[a && a.status ? a.status : "none"].push(fullName(x.p)); });
  var row = function (k) { return '<div class="avs-row"><span class="avs-k avs-' + k + '">' + esc(t("avg." + k)) + ' · ' + lists[k].length + '</span><span>' + (lists[k].length ? esc(lists[k].join(", ")) : "—") + '</span></div>'; };
  var extra = "";
  if (m.home !== US) {
    var c = carsOf(m.r);
    var dr = c.drivers.map(function (a) { return fullName(state.players[a.user_id]) + " (" + a.seats + " " + t("car.seatsShort") + (a.from_place ? ", " + a.from_place : "") + ")"; });
    var nd = c.needs.map(function (a) { return fullName(state.players[a.user_id]) + (a.from_place ? " (" + a.from_place + ")" : ""); });
    extra = '<div class="avs-row"><span class="avs-k">' + esc(t("car.drivers")) + ' · ' + dr.length + '</span><span>' + (dr.length ? esc(dr.join(", ")) : "—") + '</span></div>' +
      '<div class="avs-row"><span class="avs-k">' + esc(t("car.needsList")) + ' · ' + nd.length + '</span><span>' + (nd.length ? esc(nd.join(", ")) : "—") + '</span></div>';
  }
  return '<div class="avs">' + row("yes") + row("maybe") + row("no") + row("none") + extra + '</div>';
}
function saveRound(r, el) {
  var pairs = [0, 1, 2, 3].map(function (i) { return [el.querySelector("#a" + r + "-" + i + "-0").value || null, el.querySelector("#a" + r + "-" + i + "-1").value || null]; });
  var flat = [].concat.apply([], pairs).filter(Boolean);
  var st = el.querySelector(".status");
  if (flat.length !== new Set(flat).size) { st.textContent = t("adm.dup"); st.className = "status bad"; return; }
  var calc = updateRoundTotals(r, el);
  if (calc.bad) { st.textContent = t("adm.badSet"); st.className = "status bad"; return; }
  var results = [0, 1, 2, 3].map(function (i) {
    var sets = readSets(r, i, el).sets, oc = matchOutcome(sets);
    var rv = [0, 1].map(function (k) { return el.querySelector("#a" + r + "-" + i + "-r" + k).value.trim().slice(0, 80); });
    return { sets: sets, score: sets.map(function (x) { return x[0] + "-" + x[1]; }).join(" "), won: oc.won, rivals: rv };
  });
  // Resultado de la jornada = partidos ganados y perdidos (se calcula solo)
  var played = calc.tot.pw + calc.tot.pl;
  var us = played ? calc.tot.pw : null, them = played ? calc.tot.pl : null;
  var body = { pairs: pairs, results: results, us: us, them: them, sets: [calc.tot.sw, calc.tot.sl], games: [calc.tot.gw, calc.tot.gl], updatedAt: new Date().toISOString() };
  var meetTime = el.querySelector("#a" + r + "-mt").value || null, meetPlace = el.querySelector("#a" + r + "-mp").value.trim().slice(0, 80) || null;
  body.meetTime = meetTime || ""; body.meetPlace = meetPlace || "";
  var btn = el.querySelector("[data-save]"); btn.disabled = true; st.textContent = t("f.saving"); st.className = "status";
  // Si otra capitana ha guardado esta jornada desde que la abriste, no se pisa su trabajo: se avisa y se ofrece recargar
  var prev = roundDoc(r), row = { pairs: pairs, results: results, us: us, them: them, meet_time: meetTime, meet_place: meetPlace };
  var req = (prev && prev.updatedAt)
    ? state.sb.from("rounds").update(row).eq("r", r).eq("updated_at", prev.updatedAt).select("updated_at,updated_by")
    : state.sb.from("rounds").insert(Object.assign({ r: r }, row)).select("updated_at,updated_by");
  req.then(function (res) {
    var conflict = (res.error && res.error.code === "23505") || (!res.error && (!res.data || !res.data.length));
    if (conflict) return showConflict(r, el, btn);
    if (res.error) throw res.error;
    body.updatedAt = res.data[0].updated_at; body.updatedBy = res.data[0].updated_by;
    adminDirty[r] = false; state.rounds["r" + r] = body; btn.disabled = false;
    renderAll(); var again = document.querySelector('.admin-round[data-r="' + r + '"] .status'); if (again) again.textContent = t("adm.saved");
  }).catch(function () { btn.disabled = false; st.textContent = t("f.errSave"); st.className = "status bad"; });
}
function ackLineHtml(r, pr) {
  var ids = (pr || []).filter(function (id) { return id && state.players[id]; });
  if (!ids.length) return "";
  return '<span class="ack-line">' + ids.map(function (id) {
    var ok = ackValid(id, r);
    return '<span class="ack' + (ok ? " ok" : "") + '" title="' + esc(ok ? t("ack.seen") : t("ack.notSeen")) + '">' + (ok ? "✓ " : "○ ") + esc(state.players[id].firstName) + '</span>';
  }).join("") + '</span>';
}
function notifyLineup(r, el, btn) {
  var st = el.querySelector(".status");
  if (adminDirty[r]) { st.textContent = t("push.saveFirst"); st.className = "status bad"; return; }
  btn.disabled = true; st.textContent = t("push.working"); st.className = "status";
  state.sb.functions.invoke("notify", { body: { action: "lineup", r: r } }).then(function (res) {
    btn.disabled = false;
    if (res.error) throw res.error;
    var n = res.data.sent || 0;
    st.textContent = n ? t("push.lineupSent", { n: n }) : t("push.lineupNone"); st.className = "status";
  }).catch(function () { btn.disabled = false; st.textContent = t("push.err"); st.className = "status bad"; });
}
function showConflict(r, el, btn) {
  return state.sb.from("rounds").select("updated_at,updated_by").eq("r", r).maybeSingle().then(function (res) {
    var d = (res && res.data) || {}, who = state.players[d.updated_by] ? state.players[d.updated_by].firstName : t("conf.someone");
    var mins = d.updated_at ? Math.max(0, Math.round((Date.now() - new Date(d.updated_at).getTime()) / 60000)) : 0;
    var st = el.querySelector(".status"); btn.disabled = false;
    st.className = "status bad";
    st.innerHTML = esc(t("conf.msg", { who: who, n: mins })) + ' <button type="button" class="btn small" data-reload>' + esc(t("conf.reload")) + '</button>';
    st.querySelector("[data-reload]").addEventListener("click", function () { adminDirty[r] = false; adminOpen[r] = true; loadData(); });
  });
}

/* ───────────── Render general ───────────── */
/* Menú de la cuenta */
function closeAccMenu() {
  var m = document.getElementById("acc-menu"); if (!m || m.hidden) return;
  m.hidden = true; document.getElementById("nav-profile").setAttribute("aria-expanded", "false");
}
(function () {
  var btn = document.getElementById("nav-profile"), menu = document.getElementById("acc-menu");
  btn.addEventListener("click", function (ev) {
    ev.stopPropagation();
    var open = menu.hidden;
    menu.hidden = !open; btn.setAttribute("aria-expanded", String(open));
    if (open) { var first = menu.querySelector("a:not([hidden]), button:not([hidden])"); if (first) first.focus(); }
  });
  document.addEventListener("click", function (ev) { if (!menu.hidden && !menu.contains(ev.target)) closeAccMenu(); });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && !menu.hidden) { closeAccMenu(); btn.focus(); } });
  menu.addEventListener("click", function (ev) {
    var a = ev.target.closest("a"); if (!a) return;
    closeAccMenu();
    // Si ya estás en esa dirección, vuelve a colocarte en su sitio
    if (a.getAttribute("href") === location.hash) { ev.preventDefault(); window.dispatchEvent(new HashChangeEvent("hashchange")); }
  });
  document.getElementById("theme-btn").addEventListener("click", function () {
    var light = document.documentElement.getAttribute("data-theme") !== "light";
    if (light) document.documentElement.setAttribute("data-theme", "light"); else document.documentElement.removeAttribute("data-theme");
    var mc = document.querySelector('meta[name="theme-color"]'); if (mc) mc.content = light ? "#ffffff" : "#0a0a0a";
    try { localStorage.setItem("xnrgy-theme", light ? "light" : "dark"); } catch (e) {}
  });
  document.getElementById("menu-logout").addEventListener("click", function () { closeAccMenu(); if (state.sb) signOutAll(); location.hash = "#perfil"; });
})();
function applyViewName() {
  var h = location.hash;
  return (h === "#perfil" || h === "#mis-partidos") ? "profile" : h === "#privacidad" ? "privacy" : (h === "#alineaciones" && canManage()) ? "lineups" : "home";
}
function applyView() {
  var view = applyViewName();
  document.querySelectorAll("[data-view]").forEach(function (el) { el.hidden = el.getAttribute("data-view") !== view; });
  document.getElementById("nav-profile").setAttribute("aria-current", view === "home" ? "false" : "page");
  document.getElementById("menu-lineups").hidden = !canManage();
  document.getElementById("menu-logout").hidden = !state.uid;
  document.getElementById("plan-btn").hidden = !canManage();
  return view;
}
window.addEventListener("hashchange", function () {
  closeAccMenu();
  var view = applyView(); renderAdmin(); renderMeHome(); renderTabbar();
  if (location.hash === "#mis-partidos") { var mp = document.getElementById("mis-partidos"); if (mp) mp.scrollIntoView(); else window.scrollTo(0, 0); }
  else if (view !== "home") window.scrollTo(0, 0);
  else if (location.hash && location.hash !== "#inicio") { var el = document.querySelector(location.hash); if (el) el.scrollIntoView(); }
  else window.scrollTo(0, 0);
});
function renderAll() {
  paintStatic(); applyView(); renderPrivacy(); renderNext(); renderRounds(); renderStandings(); renderPlayers(); renderStats(); renderMe(); renderAdmin(); renderMeHome(); renderTabbar();
}
document.querySelectorAll(".langs button").forEach(function (b) {
  b.addEventListener("click", function () {
    lang = b.getAttribute("data-lang");
    try { localStorage.setItem("xnrgy-lang", lang); } catch (e) {}
    syncEmailLang();
    if (state.pushOn) refreshPushState();
    formMounted = false; renderAll();
  });
});

/* ───────────── Conexión a los datos compartidos ───────────── */
function loadRegions() {
  var a = fetch("regions.json").then(function (r) { return r.json(); }).then(function (j) { state.regions = j; }).catch(function () { state.regions = null; });
  var b = fetch("flags-index.json").then(function (r) { return r.json(); }).then(function (j) { var o = {}; j.forEach(function (k) { o[k] = 1; }); state.flags = o; }).catch(function () { state.flags = null; });
  return Promise.all([a, b]);
}
/* Columnas de Supabase (snake_case) <-> objetos de la página */
function fromRow(r) {
  return { firstName: r.first_name, lastName: r.last_name, side: r.side, hand: r.hand,
    country: r.country, region: r.region, regionName: r.region_name, photo: null, photoPath: r.photo_path || null, birthday: r.birthday || "", updatedAt: r.updated_at };
}
function toRow(v) {
  return { id: state.uid, first_name: v.firstName, last_name: v.lastName, side: v.side || null, hand: v.hand || null,
    country: v.country, region: v.region, region_name: v.regionName || null, photo: null, photo_path: v.photoPath || null, birthday: v.birthday || null, updated_at: v.updatedAt };
}
// Teléfono, email y KNLTB van aparte: solo los leen ella misma, la dueña y las capitanas
function toContact(v) { return { id: state.uid, phone: v.phone || null, email: v.email || null, knltb: v.knltb || null, updated_at: v.updatedAt }; }
var loading = null;
function loadData() {
  if (loading) return loading;
  var sb = state.sb;
  var q = {
    rounds: sb.from("rounds").select("*"),
    standings: sb.from("standings").select("*")
  };
  if (state.uid) {
    q.players = sb.from("players").select("id,first_name,last_name,side,hand,country,region,region_name,photo_path,birthday,updated_at");
    q.roles = sb.from("team_roles").select("*");
    q.requests = sb.from("join_requests").select("*").order("created_at");
    q.contacts = sb.from("player_contacts").select("*");
    q.rivals = sb.from("rival_players").select("team,name,rating").order("name");
    q.avail = sb.from("availability").select("*");
    q.caltoken = sb.from("calendar_tokens").select("token");
    q.acks = sb.from("lineup_ack").select("r,user_id,seen_at");
  }
  var keys = Object.keys(q);
  loading = Promise.all(keys.map(function (k) { return q[k]; })).then(function (arr) {
    loading = null;
    var res = {}; keys.forEach(function (k, i) { res[k] = arr[i]; });
    function rows(k) { return (res[k] && !res[k].error && res[k].data) || []; }
    if (res.rounds.error) throw res.rounds.error;
    var rounds = {}; rows("rounds").forEach(function (row) { rounds["r" + row.r] = { pairs: row.pairs, results: row.results, us: row.us, them: row.them, meetTime: row.meet_time || "", meetPlace: row.meet_place || "", updatedAt: row.updated_at || null, updatedBy: row.updated_by || null }; });
    state.rounds = rounds;
    state.standings = rows("standings");
    if (state.uid) {
      if (res.players.error || res.roles.error) throw (res.players.error || res.roles.error);
      var roles = rows("roles");
      state.roles = {}; roles.forEach(function (x) { state.roles[x.user_id] = x.role; });
      var players = {}; rows("players").forEach(function (row) { if (state.roles[row.id]) players[row.id] = fromRow(row); });
      state.rivals = {}; rows("rivals").forEach(function (x) { (state.rivals[x.team] = state.rivals[x.team] || []).push(x); });
      rows("contacts").forEach(function (c) { if (players[c.id]) { players[c.id].phone = c.phone; players[c.id].email = c.email; players[c.id].knltb = c.knltb; } });
      state.players = players;
      state.avail = {}; rows("avail").forEach(function (x) { state.avail[x.user_id + ":" + x.r] = x; });
      state.calToken = (rows("caltoken")[0] || {}).token || null;
      state.acks = {}; rows("acks").forEach(function (x) { state.acks[x.user_id + ":" + x.r] = x.seen_at; });
      var reqRows = rows("requests");
      state.requests = reqRows.filter(function (x) { return x.user_id !== state.uid && !state.roles[x.user_id]; });
      state.myRequest = reqRows.filter(function (x) { return x.user_id === state.uid; })[0] || null;
      state.isOwner = state.roles[state.uid] === "owner";
      state.managers = roles.filter(function (x) { return STAFF.indexOf(x.role) >= 0; }).map(function (x) { return x.user_id; });
      var signing = signPhotos(players);
      signing.then(function (fetched) { if (fetched && state.players === players) renderAll(); if (state.players === players) migrateMyPhoto(); });
      if (!state.roles[state.uid]) {
        state.phase = "pending";
        if (!state.myRequest && !state.autoRequested) { state.autoRequested = true; sendJoinRequest().then(loadData).catch(function () {}); }
      } else state.phase = "ready";
    } else {
      state.players = {}; state.roles = {}; state.requests = []; state.myRequest = null; state.isOwner = false; state.managers = []; state.phase = "noaccess"; state.autoRequested = false; state.avail = {}; state.calToken = null; state.acks = {};
    }
    renderAll();
    if (state.phase === "ready" && state.pushFor !== state.uid) { state.pushFor = state.uid; refreshPushState(); }
  }).catch(function () {
    loading = null;
    if (state.phase === "loading") state.phase = state.uid ? "slow" : "noaccess";
    renderAll();
  });
  return loading;
}
function setSession(session) {
  var uid = session && session.user ? session.user.id : null;
  var changed = uid !== state.uid;
  state.uid = uid; state.email = session && session.user ? (session.user.email || "") : "";
  state.meta = session && session.user ? (session.user.user_metadata || {}) : {};
  if (uid) authTab = "login"; // al cerrar sesión se vuelve a ver "Entrar", no "Crear cuenta"
  if (!uid) { state.editing = false; state.needPassword = false; formMounted = false; }
  if (changed) { formMounted = false; loadData(); }
  syncEmailLang();
}
// Los emails de la cuenta (confirmar, contraseña) salen en el idioma guardado en la cuenta
function syncEmailLang() {
  if (!state.uid || !state.sb || (state.meta && state.meta.lang === lang) || state.langSyncing === lang) return;
  state.langSyncing = lang;
  state.sb.auth.updateUser({ data: { lang: lang } }).then(function (res) {
    if (!res.error && res.data && res.data.user) state.meta = res.data.user.user_metadata || state.meta;
    state.langSyncing = null;
  }).catch(function () { state.langSyncing = null; });
}
var APP_VERSION = "2026-11-05-3";
function checkVersion() {
  fetch("version.txt?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : ""; }).then(function (v) {
    v = (v || "").trim();
    if (!v || v === APP_VERSION) return;
    var key = "xnrgy-reloaded-" + v;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch (e) { return; }
    location.reload();
  }).catch(function () {});
}
function boot() {
  checkVersion();
  document.getElementById("skip-link").addEventListener("click", function (e) { e.preventDefault(); var m = document.getElementById("main"); m.focus(); m.scrollIntoView(); });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); state.installEvt = e; renderMe(); });
  window.addEventListener("appinstalled", function () { state.installEvt = null; renderMe(); });
  // Enlace de invitación o de recuperación: pedir la contraseña nueva al entrar
  var h = location.hash || "", q = location.search || "";
  if (/type=(invite|recovery)/.test(h + q)) { state.needPassword = true; }
  renderAll();
  loadRegions().then(function () { formMounted = false; renderAll(); });
  var cfg = window.XNRGY_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseKey || !window.supabase) { state.phase = "nocfg"; renderAll(); return; }
  state.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } });
  var slowTimer = setTimeout(function () { if (state.phase === "loading") { state.phase = "slow"; renderMe(); } }, 10000);
  state.sb.auth.onAuthStateChange(function (event, session) {
    clearTimeout(slowTimer);
    if (event === "PASSWORD_RECOVERY") state.needPassword = true;
    if (state.needPassword && session && /access_token|type=/.test(location.hash)) {
      history.replaceState(null, "", location.pathname + "#perfil");
      applyView();
    }
    setSession(session);
    if (event === "SIGNED_OUT") { state.phase = "noaccess"; loadData(); }
  });
  state.sb.auth.getSession().then(function (res) {
    clearTimeout(slowTimer);
    var session = res && res.data ? res.data.session : null;
    if (!session) { state.uid = null; loadData(); } else setSession(session);
  });
  try { if (!sessionStorage.getItem("xnrgy-visit")) { sessionStorage.setItem("xnrgy-visit", "1"); state.sb.rpc("touch_visit").then(function () {}, function () {}); } } catch (e) {}
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && state.sb) loadData(); });
}
boot();
