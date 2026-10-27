#!/usr/bin/env node
// Oberflächen-Prüfung ohne Browser-Fenster: lädt die App in Chromium (headless), sammelt
// Konsolenfehler, unbehandelte Ausnahmen und fehlgeschlagene Netzladungen und macht Screenshots
// im Quer- (1180×820) und Hochformat (390×844).
//
//   node dev/pruefung.mjs [URL] [Ausgabeordner]
//   Standard: http://127.0.0.1:8766/  und  dev/shots/
//
// Vorher: python3 -m http.server 8766  (oder npm start) im Projektordner.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const url = process.argv[2] || 'http://127.0.0.1:8766/';
const out = process.argv[3] || new URL('./shots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const port = 9000 + Math.floor(Math.random() * 500);
const chrome = spawn('chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`,
  '--user-data-dir=' + out + '/profil', '--no-first-run', ...(process.env.FLAGS ? process.env.FLAGS.split(' ') : []), 'about:blank',
], { stdio: 'ignore' });
process.on('exit', () => chrome.kill());

async function targets() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json`); return await r.json(); } catch { await sleep(100); }
  }
  throw new Error('Chromium antwortet nicht');
}

const page = (await targets()).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0;
const pending = new Map();
const probleme = [];
const urls = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
    probleme.push(`konsole.${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    probleme.push(`ausnahme: ${d.exception?.description || d.text} (${d.url || ''}:${d.lineNumber || ''})`);
  }
  if (msg.method === 'Network.requestWillBeSent') urls.set(msg.params.requestId, msg.params.request.url);
  if (msg.method === 'Network.loadingFailed' && msg.params.errorText !== 'net::ERR_ABORTED') {
    probleme.push(`laden fehlgeschlagen: ${msg.params.errorText} ${urls.get(msg.params.requestId) || ''}`);
  }
  if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400) {
    probleme.push(`http ${msg.params.response.status}: ${msg.params.response.url}`);
  }
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Runtime.enable');
await send('Network.enable');
await send('Page.enable');

// Optionen (Umgebungsvariablen, damit die Positionsargumente bleiben):
//   ZUSTAND=dev/zustand/orbit.json   → wird vor dem Laden als localStorage „wortbiester.v1“ gesetzt
//   SCHRITTE=dev/schritte/jagd.json  → Liste von Schritten nach dem Laden, je Format:
//       { "klick": "Jagd starten" }   Element mit diesem sichtbaren Text antippen (button/.knopf/.block zuerst)
//       { "js": "…" }                 Ausdruck ausführen (await erlaubt)
//       { "warte": 800 }              Millisekunden warten
//       { "shot": "name" }            Screenshot name-quer.png bzw. name-hoch.png
//       { "loese": 1 }                aktuelle Aufgabe über window.wortbiester richtig lösen
//   GANZ=1                           → Screenshot über die ganze Seitenhöhe
//   NUR=quer|hoch                    → nur ein Format
const zustand = process.env.ZUSTAND ? readFileSync(process.env.ZUSTAND, 'utf8') : null;
const schritte = process.env.SCHRITTE ? JSON.parse(readFileSync(process.env.SCHRITTE, 'utf8')) : [];
const ganz = !!process.env.GANZ;
const formate = [['quer', 1180, 820, false], ['hoch', 390, 844, true]].filter((f) => !process.env.NUR || f[0] === process.env.NUR);

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) probleme.push(`schritt: ${r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text}`);
  return r.result?.result?.value;
};

const HILFEN = `
window.__wbKlick = (text) => {
  const alle = [...document.querySelectorAll('button, .knopf, .block, [role=button], a')];
  const t = (e) => (e.innerText || e.textContent || '').trim();
  const el = alle.find((e) => t(e) === text) || alle.find((e) => t(e).startsWith(text)) || [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && t(e) === text);
  if (!el) throw new Error('kein Element mit Text „' + text + '“');
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); el.click();
  return t(el);
};
window.__wbLoese = async () => {
  const ctx = window.wortbiester; const hunt = ctx?.hunt; if (!hunt) throw new Error('keine Jagd aktiv');
  const st = hunt.state(); const task = st.task;
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  if (st.phase === 'lagerfeuer') { __wbKlick('Beute sichern'); return 'lagerfeuer'; }
  if (!task) return 'keine Aufgabe (' + st.phase + ')';
  if (task.type === 'kennenlernen') { __wbKlick('Verstanden'); return 'kennenlernen'; }
  const klickBlock = (text, benutzt) => {
    const bl = [...document.querySelectorAll('.block, .antworten button, .antworten .knopf, button')].filter((b) => !benutzt.has(b) && (b.innerText || b.textContent).replace(/\\u00a0/g, ' ') === text && !b.disabled);
    if (!bl.length) throw new Error('Block „' + text + '“ nicht gefunden'); benutzt.add(bl[0]); bl[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); bl[0].click();
  };
  const items = task.type === 'blitz' ? task.items : [task];
  for (const it of items) {
    const benutzt = new Set();
    if (it.options) { klickBlock(it.options.find((o) => o.correct).text, benutzt); await pause(900); }
    else if (it.target) { for (const t of it.target) { klickBlock(t, benutzt); await pause(180); } await pause(900); }
  }
  return task.type;
};
window.__wbFalsch = async () => {
  const hunt = window.wortbiester?.hunt; const st = hunt.state(); const task = st.task;
  if (!task || task.type === 'kennenlernen') return 'nichts zu verfehlen (' + (task?.type || st.phase) + ')';
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const it = task.type === 'blitz' ? task.items[0] : task;
  const alle = [...document.querySelectorAll('.block')].filter((b) => !b.disabled);
  if (it.options) { const o = it.options.find((o) => !o.correct); const b = alle.find((b) => (b.innerText || '').trim() === o.text); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); }
  else { for (let i = 0; i < 3; i++) { const b = [...document.querySelectorAll('.bank .block')].find((b) => !b.disabled && (b.innerText || '') !== it.target[0]); if (!b) break; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); await pause(250); } }
  return 'falsch bei ' + task.type;
};`;

async function lauf(name, width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
  if (zustand) {
    await send('Page.navigate', { url });
    await sleep(300);
    await evaluate(`localStorage.setItem('wortbiester.v1', ${JSON.stringify(zustand)}); 'ok'`);
  }
  await send('Page.navigate', { url });
  await sleep(1500);
  await evaluate(HILFEN + '; "ok"');
  const shot = async (sname) => {
    const opts = { format: 'png' };
    if (ganz) {
      const m = await send('Page.getLayoutMetrics');
      const h = Math.ceil(m.result.cssContentSize.height);
      opts.clip = { x: 0, y: 0, width, height: h, scale: 1 };
      opts.captureBeyondViewport = true;
    }
    const { result } = await send('Page.captureScreenshot', opts);
    writeFileSync(`${out}/${sname}.png`, Buffer.from(result.data, 'base64'));
    console.log(`Screenshot: ${out}/${sname}.png`);
  };
  for (const s of schritte) {
    await evaluate(`if (!window.__wbKlick) { ${HILFEN} }; 'ok'`);   // nach einem Neuladen neu einhängen
    if (s.klick) { const r = await evaluate(`__wbKlick(${JSON.stringify(s.klick)})`); if (r == null) console.log(`  ${name}: Klick „${s.klick}“ fehlgeschlagen`); await sleep(400); }
    if (s.js) await evaluate(s.js);
    if (s.warte) await sleep(s.warte);
    if (s.shot) await shot(`${s.shot}-${name}`);
    if (s.falsch) { const r = await evaluate('__wbFalsch()'); console.log(`  ${name}: ${r}`); await sleep(300); }
    if (s.loese) { for (let i = 0; i < s.loese; i++) { const r = await evaluate('__wbLoese()'); console.log(`  ${name}: gelöst ${r}`); await sleep(500); } }
  }
  await shot(name);
  const txt = await evaluate('document.body.innerText.slice(0, 300)');
  console.log(`Sichtbarer Text (${name}):`, JSON.stringify((txt || '').slice(0, 200)));
}

for (const f of formate) await lauf(...f);
const einmalig = [...new Set(probleme)];
if (einmalig.length) {
  console.log(`\n${einmalig.length} Problem(e):`);
  for (const p of einmalig) console.log(' - ' + p);
  process.exitCode = 1;
} else console.log('\nKeine Konsolenfehler, keine fehlgeschlagenen Ladungen.');
ws.close();
chrome.kill();
