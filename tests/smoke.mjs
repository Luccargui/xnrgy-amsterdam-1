// Prueba automática de la web (la lanza GitHub en cada cambio).
// Abre la web en móvil y escritorio, en modo claro y oscuro, en los 4 idiomas,
// simula una jugadora con sesión y comprueba que no hay errores ni textos sin traducir.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".txt": "text/plain", ".webmanifest": "application/manifest+json" };
let failures = 0;
const fail = (msg) => { failures++; console.error("✗ " + msg); };
const ok = (msg) => console.log("✓ " + msg);

// 1) Todas las traducciones tienen las mismas claves
{
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8") + ";this.I18N=I18N;", ctx);
  const langs = Object.keys(ctx.I18N), all = new Set(langs.flatMap((l) => Object.keys(ctx.I18N[l])));
  for (const l of langs) {
    const miss = [...all].filter((k) => !(k in ctx.I18N[l]));
    miss.length ? fail(`i18n ${l}: faltan ${miss.join(", ")}`) : ok(`i18n ${l}: ${all.size} textos`);
  }
  const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  const used = [...app.matchAll(/\bt\("([a-z][A-Za-z0-9]*\.[A-Za-z0-9.]*[A-Za-z0-9])"/g)].map((m) => m[1]);
  const undef = [...new Set(used)].filter((k) => !(k in ctx.I18N.es));
  undef.length ? fail("textos usados sin traducción: " + undef.join(", ")) : ok("todos los textos usados existen");
}

// 2) Servidor local
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const BASE = `http://localhost:${server.address().port}/`;

const SIM = () => {
  state.sb = { from() { const q = { select() { return q; }, eq() { return q; }, in() { return q; }, order() { return q; }, upsert() { return Promise.resolve({}); }, delete() { return q; }, maybeSingle() { return Promise.resolve({}); }, then(f) { return Promise.resolve({ data: [] }).then(f); } }; return q; },
    rpc() { return Promise.resolve({ data: {} }); }, functions: { invoke() { return Promise.resolve({ data: { sent: 0 } }); } },
    storage: { from() { return { createSignedUrls() { return Promise.resolve({ data: [] }); } }; } }, auth: { signOut() {}, updateUser() { return Promise.resolve({}); } } };
  state.uid = "a"; state.phase = "ready";
  const mk = (f, l) => ({ firstName: f, lastName: l, country: "ES", region: "AN", side: "right", hand: "right" });
  state.players = { a: mk("Lucía", "Carrera"), b: mk("Rose", "Moro"), c: mk("Irviani", "Gerard"), d: mk("Ana", "López") };
  state.roles = { a: "owner", b: "captain", c: "manager", d: "player" };
  const d1 = ROUNDS[0].r, d2 = ROUNDS[1].r;
  state.rounds = {};
  state.rounds["r" + d1] = { pairs: [["a", "b"], ["c", "d"], [null, null], [null, null]], results: [{ won: true, sets: [[6, 4], [6, 3]], score: "6-4 6-3" }, { won: false, sets: [[3, 6], [4, 6]], by: "c", reviewed: false }, {}, {}], us: 1, them: 1 };
  state.rounds["r" + d2] = { pairs: [["a", "c"], ["b", "d"], [null, null], [null, null]], results: [{}, {}, {}, {}] };
  renderAll();
};

const browser = await chromium.launch();
const RAW_KEY = /^[a-z]{1,8}\.[a-zA-Z.]{2,}$/;
for (const [w, h, name] of [[390, 844, "móvil"], [1280, 900, "escritorio"]]) {
  for (const theme of ["dark", "light"]) {
    for (const lang of ["es", "en", "tr", "nl"]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route(/supabase\.co|challenges\.cloudflare\.com/, (r) => r.abort());
      await page.addInitScript(([t, l]) => { localStorage.setItem("xnrgy-theme", t); localStorage.setItem("xnrgy-lang", l); }, [theme, lang]);
      await page.goto(BASE);
      await page.waitForSelector("h1");
      await page.evaluate(SIM);
      for (const hash of ["#inicio", "#mis-partidos", "#mi-disponibilidad", "#avisos", "#alineaciones", "#privacidad"]) {
        await page.evaluate((hh) => { location.hash = hh; }, hash);
        await page.waitForTimeout(60);
      }
      await page.evaluate(() => { location.hash = "#jugadoras"; });
      await page.click("[data-pid='b']");
      const dlgOpen = await page.evaluate(() => document.getElementById("pl-dlg").open);
      if (!dlgOpen) errors.push("la ficha de jugadora no se abre");
      await page.keyboard.press("Escape");
      const raw = await page.evaluate((re) => [...document.querySelectorAll("body *")].filter((el) => el.children.length === 0 && el.offsetParent !== null)
        .map((el) => el.textContent.trim()).filter((t) => new RegExp(re).test(t)), RAW_KEY.source);
      if (raw.length) errors.push("textos sin traducir: " + [...new Set(raw)].slice(0, 5).join(", "));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 2) errors.push(`la página se sale ${overflow}px de ancho`);
      errors.length ? fail(`${name} · ${theme} · ${lang}: ${errors.join(" | ")}`) : ok(`${name} · ${theme} · ${lang}`);
      await page.close();
    }
  }
}
await browser.close();
server.close();
if (failures) { console.error(`\n${failures} problema(s)`); process.exit(1); }
console.log("\nTodo bien ✓");
