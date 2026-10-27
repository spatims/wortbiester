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
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const url = process.argv[2] || 'http://127.0.0.1:8766/';
const out = process.argv[3] || new URL('./shots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const port = 9000 + Math.floor(Math.random() * 500);
const chrome = spawn('chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`,
  '--user-data-dir=' + out + '/profil', '--no-first-run', 'about:blank',
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

async function shot(name, width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
  await send('Page.navigate', { url });
  await sleep(1500);
  const { result } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${out}/${name}.png`, Buffer.from(result.data, 'base64'));
  const txt = await send('Runtime.evaluate', { expression: 'document.body.innerText.slice(0, 400)', returnByValue: true });
  return txt.result?.result?.value || '';
}

const quer = await shot('quer', 1180, 820, false);
const hoch = await shot('hoch', 390, 844, true);

console.log(`Screenshots: ${out}/quer.png  ${out}/hoch.png`);
console.log('Sichtbarer Text (quer):', JSON.stringify(quer.slice(0, 200)));
console.log('Sichtbarer Text (hoch):', JSON.stringify(hoch.slice(0, 200)));
const einmalig = [...new Set(probleme)];
if (einmalig.length) {
  console.log(`\n${einmalig.length} Problem(e):`);
  for (const p of einmalig) console.log(' - ' + p);
  process.exitCode = 1;
} else console.log('\nKeine Konsolenfehler, keine fehlgeschlagenen Ladungen.');
ws.close();
chrome.kill();
