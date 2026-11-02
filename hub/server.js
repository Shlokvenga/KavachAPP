// Kavach hub: runs on the security office laptop.
//  - keeps the one shared campus state and saves it to data/state.json,
//  - runs the same named actions as the apps (src/actions.js) and the 1 s timers,
//  - serves the admin console to this laptop only, and the phone web app to the Wi-Fi,
//  - pairs phones with a 6-digit code (one token per phone) and syncs them by long-polling.
// Bundled with esbuild into dist/kavach-laptop/hub.mjs; needs only Node 18+.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ADMIN_ONLY, applyAction } from '../src/actions.js';
import { makeInitial, migrate } from '../src/data.js';
import { tick, toast } from '../src/store.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(process.env.KAVACH_APP || path.join(HERE, 'app'));
const DATA = path.resolve(process.env.KAVACH_DATA || path.join(HERE, 'data'));
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const QUIET = !!process.env.KAVACH_QUIET;
const VERSION = '1.0';

const log = (...a) => { if (!QUIET) console.log(new Date().toTimeString().slice(0, 8), ...a); };
fs.mkdirSync(DATA, { recursive: true });

// ---------- saved files ----------
const STATE_FILE = path.join(DATA, 'state.json');
const CONFIG_FILE = path.join(DATA, 'config.json');
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
function writeJson(f, v) {
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(v));
  fs.renameSync(tmp, f);
}

const newCode = () => String(crypto.randomInt(0, 1e6)).padStart(6, '0');
const config = { name: os.hostname(), code: newCode(), setupDone: false, devices: {}, ...(readJson(CONFIG_FILE) || {}) };
const saveConfig = () => writeJson(CONFIG_FILE, config);
saveConfig();

let state = (() => {
  const s = migrate(readJson(STATE_FILE));
  if (s) { s.toasts = []; return s; }
  return makeInitial();
})();
let version = 1;
let stateJson = null;
let saveTimer = null;
const presence = {}; // dev -> { live, role, user, seen, ip, online }

function trim(d) {
  if (d.audit.length > 3000) d.audit.length = 3000;
  if (d.alerts.length > 600) d.alerts.length = 600;
  d.alerts.forEach((a, i) => { if (i >= 40 && a.snap) a.snap = null; });
}

// Paired phones, plus this laptop's console when it is open (its webcams count as live cameras).
function netInfo() {
  const devices = Object.entries(config.devices).map(([id, x]) => {
    const p = presence[id] || {};
    return { id, name: x.name, kind: x.kind, pairedAt: x.pairedAt, role: p.role || null, user: p.user || null, live: p.live || [], online: !!p.online, seen: p.seen || null };
  });
  const c = presence.console;
  if (c) devices.push({ id: 'console', name: 'Security laptop', kind: 'laptop', role: 'admin', live: c.live || [], online: !!c.online, seen: c.seen || null });
  return { hub: config.name, devices };
}

function bump() {
  version += 1;
  stateJson = null;
  for (const w of waiters.slice()) w();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { writeJson(STATE_FILE, { ...state, toasts: [], net: undefined }); } catch (e) { log('Could not save state:', e.message); }
  }, 800);
}

function snapshotJson() {
  if (!stateJson) stateJson = JSON.stringify({ v: version, state: { ...state, net: netInfo() } });
  return stateJson;
}

// ---------- timers ----------
setInterval(() => {
  let changed = false;
  try { changed = tick(state); } catch (e) { log('tick failed:', e.message); }
  const now = Date.now();
  for (const p of Object.values(presence)) {
    const on = now - p.seen < 35000;
    if (on !== p.online) { p.online = on; changed = true; }
  }
  if (changed) bump();
}, 1000).unref();

// ---------- auth ----------
const LOCAL = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
// Trust "this laptop" only for requests made by the console itself: from the
// loopback address, to localhost (no DNS rebinding) and not from another website
// open in the laptop's browser (cross-site requests carry a foreign Origin).
const LOCAL_HOSTS = (port) => [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`];
function isLocal(req) {
  if (!LOCAL.has(req.socket.remoteAddress)) return false;
  const hosts = LOCAL_HOSTS(PORT);
  if (!hosts.includes(String(req.headers.host || ''))) return false;
  const o = req.headers.origin;
  return !o || hosts.some((h) => o === `http://${h}`);
}
const ipOf = (req) => String(req.socket.remoteAddress || '').replace('::ffff:', '');
function deviceFor(req, url) {
  // <img> requests (camera streams) cannot send headers, so they pass the token in the URL
  const tok = req.headers['x-kavach-key'] || (url && url.searchParams.get('key'));
  if (!tok) return null;
  return Object.entries(config.devices).find(([, x]) => x.token === tok) || null;
}
const fails = {}; // ip -> { n, until }
function tooMany(ip) { const f = fails[ip]; return f && f.until > Date.now(); }
function failed(ip) {
  const f = (fails[ip] = fails[ip] || { n: 0, until: 0 });
  f.n += 1;
  if (f.n >= 8) { f.until = Date.now() + 60000; f.n = 0; }
}

// ---------- http ----------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.bin': 'application/octet-stream', '.ktx2': 'image/ktx2', '.glb': 'model/gltf-binary', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-kavach-key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
}
function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(Object.assign(new Error('Too large'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(Object.assign(new Error('Bad JSON'), { code: 400 })); } });
    req.on('error', reject);
  });
}

function lanUrls() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' && a.family !== 4) continue;
      if (a.internal || a.address.startsWith('169.254.')) continue;
      out.push({ iface: name, url: `http://${a.address}:${PORT}` });
    }
  }
  // likely Wi-Fi / Ethernet first, virtual adapters last
  const rank = (x) => (/^(vmnet|vbox|virtualbox|docker|br-|veth|vEthernet|utun|tailscale|zt)/i.test(x.iface) ? 1 : 0);
  return out.sort((a, b) => rank(a) - rank(b));
}

// ---------- live camera video ----------
// The device that has a camera sends its live view here as JPEG frames; guard
// phones and the console watch it as an MJPEG stream (an <img> can play that).
// Frames are kept in memory only, never saved.
const frames = {}; // camId -> { buf, at, dev }
const viewers = {}; // camId -> Set of responses
const BOUNDARY = 'kavachframe';
function readRaw(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(Object.assign(new Error('Frame too large'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function pushFrame(res, buf) {
  res.write(`--${BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${buf.length}\r\n\r\n`);
  res.write(buf);
  res.write('\r\n');
}
const validCam = (c) => /^CAM-[A-Z0-9]{1,4}$/.test(String(c || ''));

const waiters = [];
const applied = []; // recent action ids, so a retried action never runs twice

async function api(req, res, url) {
  const p = url.pathname;
  const local = isLocal(req);
  const ip = ipOf(req);

  if (p === '/api/hello') return send(res, 200, { app: 'kavach-hub', version: VERSION, name: config.name });

  if (p === '/api/pair' && req.method === 'POST') {
    if (tooMany(ip)) return send(res, 429, { error: 'Too many wrong codes. Wait a minute.' });
    const b = await readBody(req);
    if (String(b.code || '') !== config.code) { failed(ip); log(`Pairing refused from ${ip} (wrong code)`); return send(res, 401, { error: 'Wrong pairing code' }); }
    const dev = String(b.dev || '').slice(0, 64) || 'dev-' + crypto.randomBytes(4).toString('hex');
    const token = crypto.randomBytes(18).toString('base64url');
    config.devices[dev] = { token, name: String(b.name || 'Phone').slice(0, 40), kind: String(b.kind || 'phone').slice(0, 20), pairedAt: Date.now() };
    saveConfig();
    presence[dev] = { ...(presence[dev] || {}), seen: Date.now(), ip, online: true };
    log(`Paired ${config.devices[dev].name} (${ip})`);
    bump();
    return send(res, 200, { token, name: config.name });
  }

  // everything below needs this laptop or a paired device
  const devEntry = deviceFor(req, url);
  if (!local && !devEntry) return send(res, 401, { error: 'This device is not paired with the hub' });
  const devId = devEntry ? devEntry[0] : 'console';

  if (p === '/api/state') {
    const since = Number(url.searchParams.get('v') || 0);
    if (devEntry) { presence[devId] = { ...(presence[devId] || {}), seen: Date.now(), ip }; }
    if (since < version) return send(res, 200, snapshotJson());
    let done = false;
    const finish = (revoked) => {
      if (done) return;
      done = true; clearTimeout(t);
      const i = waiters.indexOf(finish); if (i >= 0) waiters.splice(i, 1);
      if (res.writableEnded) return;
      if (revoked === true) send(res, 401, { error: 'This device was unpaired on the laptop' });
      else send(res, 200, since < version ? snapshotJson() : { v: version });
    };
    finish.dev = devId;
    const t = setTimeout(finish, 25000);
    waiters.push(finish);
    req.on('close', () => { done = true; clearTimeout(t); const i = waiters.indexOf(finish); if (i >= 0) waiters.splice(i, 1); });
    return undefined;
  }

  if (p === '/api/act' && req.method === 'POST') {
    const b = await readBody(req);
    if (b.id && applied.includes(b.id)) return send(res, 200, snapshotJson());
    if (ADMIN_ONLY.has(b.name) && !local) return send(res, 403, { error: 'Only the laptop console can do that' });
    // the console acts as the security office; a phone acts as its signed-in person
    const who = b.who && typeof b.who === 'object' && b.who.role !== 'admin' ? b.who : null;
    try {
      applyAction(state, b.name, Array.isArray(b.args) ? b.args : [], who);
      trim(state);
    } catch (e) {
      log(`Action ${b.name} failed: ${e.message}`);
      return send(res, 400, { error: `Action ${b.name} failed: ${e.message}` });
    }
    if (b.id) { applied.push(b.id); if (applied.length > 500) applied.shift(); }
    bump();
    return send(res, 200, snapshotJson());
  }

  if (p === '/api/frame' && req.method === 'POST') {
    const cam = url.searchParams.get('cam');
    if (!validCam(cam)) return send(res, 400, { error: 'Unknown camera' });
    const buf = await readRaw(req);
    if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return send(res, 400, { error: 'Not a JPEG frame' });
    frames[cam] = { buf, at: Date.now(), dev: devId };
    for (const r of viewers[cam] || []) pushFrame(r, buf);
    return send(res, 200, { watchers: (viewers[cam] || new Set()).size });
  }

  if (p === '/api/mjpeg') {
    const cam = url.searchParams.get('cam');
    if (!validCam(cam)) return send(res, 400, { error: 'Unknown camera' });
    res.writeHead(200, { 'content-type': `multipart/x-mixed-replace; boundary=${BOUNDARY}`, 'cache-control': 'no-store', connection: 'keep-alive' });
    const set = (viewers[cam] = viewers[cam] || new Set());
    set.add(res);
    const f = frames[cam];
    if (f && Date.now() - f.at < 10000) pushFrame(res, f.buf);
    req.on('close', () => set.delete(res));
    return undefined;
  }

  if (p === '/api/snap') {
    const f = frames[url.searchParams.get('cam')];
    if (!f || Date.now() - f.at > 15000) return send(res, 404, { error: 'No recent frame' });
    res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'no-store', 'content-length': f.buf.length });
    return res.end(f.buf);
  }

  if (p === '/api/presence' && req.method === 'POST') {
    const b = await readBody(req);
    const prev = presence[devId] || {};
    const live = Array.isArray(b.live) ? b.live.map(String).slice(0, 32).sort() : [];
    const next = { live, role: b.role || null, user: b.user ? String(b.user).slice(0, 60) : null, seen: Date.now(), ip, online: true };
    presence[devId] = next;
    if (devEntry && b.name && b.name !== devEntry[1].name) { devEntry[1].name = String(b.name).slice(0, 40); saveConfig(); }
    if (!prev.online || prev.role !== next.role || prev.user !== next.user || JSON.stringify(prev.live || []) !== JSON.stringify(live)) bump();
    return send(res, 200, { ok: true });
  }

  // ---------- laptop console only ----------
  if (!local) return send(res, 403, { error: 'Only on the laptop' });

  if (p === '/api/setup') {
    return send(res, 200, { name: config.name, code: config.code, port: PORT, urls: lanUrls(), setupDone: config.setupDone, data: DATA, version: VERSION, node: process.version, platform: process.platform });
  }
  if (p === '/api/setup/code' && req.method === 'POST') {
    config.code = newCode(); saveConfig();
    log('New pairing code created');
    return send(res, 200, { code: config.code });
  }
  if (p === '/api/setup/done' && req.method === 'POST') {
    const b = await readBody(req);
    config.setupDone = b.done !== false; saveConfig();
    return send(res, 200, { setupDone: config.setupDone });
  }
  if (p === '/api/setup/forget' && req.method === 'POST') {
    const b = await readBody(req);
    if (config.devices[b.dev]) {
      log(`Unpaired ${config.devices[b.dev].name}`);
      delete config.devices[b.dev]; delete presence[b.dev]; saveConfig();
      for (const w of waiters.filter((x) => x.dev === b.dev)) w(true); // tell that phone now
      bump();
    }
    return send(res, 200, { ok: true });
  }
  if (p === '/api/reset' && req.method === 'POST') {
    state = makeInitial();
    toast(state, 'all', 'All campus data erased on the hub. Starting fresh.', 'success');
    log('All campus data erased');
    bump();
    return send(res, 200, { ok: true });
  }
  if (p === '/api/export') {
    res.setHeader('content-disposition', `attachment; filename="kavach-data-${new Date().toISOString().slice(0, 10)}.json"`);
    return send(res, 200, JSON.stringify({ ...state, toasts: [], net: undefined }, null, 1));
  }
  return send(res, 404, { error: 'Unknown API' });
}

function serveFile(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  const local = isLocal(req);
  // the admin console is only for this laptop; phones on the Wi-Fi get the phone app
  if (p === '/' || p === '/index.html') p = local ? '/index.html' : '/phone.html';
  if (p === '/console' && local) p = '/index.html';
  if (p === '/phone') p = '/phone.html';
  const file = path.join(APP, path.normalize(p).replace(/^([/\\])+/, ''));
  if (!file.startsWith(APP)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found', 'text/plain');
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'content-length': st.size, 'cache-control': type.startsWith('text/html') ? 'no-store' : 'max-age=3600' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
    return undefined;
  });
  return undefined;
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    return serveFile(req, res, url);
  } catch (e) {
    if (!res.headersSent) send(res, e.code && e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.message });
    return undefined;
  }
});
server.requestTimeout = 0;
server.headersTimeout = 30000;

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use. Is the Kavach hub already running? Close it, or start with another port, e.g. PORT=8788.\n`);
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, HOST, () => {
  if (QUIET) return;
  const urls = lanUrls();
  console.log('\n  KAVACH HUB is running\n');
  console.log(`  Admin console (this laptop only):  http://localhost:${PORT}`);
  if (urls.length) {
    console.log('  Phones on the same Wi-Fi connect to:');
    for (const u of urls) console.log(`      ${u.url}    (${u.iface})`);
  } else console.log('  No Wi-Fi / network address found. Phones can pair once this laptop is on a network.');
  console.log(`  Pairing code: ${config.code}`);
  console.log(`  Data is saved in: ${DATA}`);
  console.log('\n  Keep this window open. Press Ctrl+C to stop.\n');
  if (process.argv.includes('--open')) openBrowser(`http://localhost:${PORT}`);
});

// open the console in the default browser (start scripts pass --open)
function openBrowser(u) {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', u]] : process.platform === 'darwin' ? ['open', [u]] : ['xdg-open', [u]];
  try { spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch (e) { /* open it by hand */ }
}

const stop = () => {
  clearTimeout(saveTimer);
  try { writeJson(STATE_FILE, { ...state, toasts: [], net: undefined }); } catch (e) { /* best effort */ }
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

export { server };
