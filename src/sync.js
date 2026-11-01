// Talking to the laptop hub (hub/server.js).
// The hub keeps the one shared copy of the campus state. Each device:
//  - long-polls GET /api/state?v=N and gets the full state whenever it changes,
//  - sends every change as a named action (POST /api/act), applying it locally
//    first so the screen reacts at once,
//  - keeps unsent actions in an outbox while the hub is unreachable and sends
//    them, in order, when it is back (each has an id, so a retry never runs twice),
//  - reports which campus cameras it has connected (POST /api/presence).
// No React here.

const PAIR_KEY = 'kavach-hub';
const DEV_KEY = 'kavach-device';
const OUTBOX_KEY = 'kavach-outbox';

const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
};

export const loadPairing = () => ls.get(PAIR_KEY);
export const savePairing = (p) => ls.set(PAIR_KEY, p);
export const clearPairing = () => { ls.set(PAIR_KEY, null); ls.set(OUTBOX_KEY, null); };

const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export function deviceId() {
  let id = ls.get(DEV_KEY);
  if (!id) { id = 'dev-' + rid(); ls.set(DEV_KEY, id); }
  return id;
}

export const cleanUrl = (u) => {
  let x = String(u || '').trim();
  if (!x) return '';
  if (!/^https?:\/\//i.test(x)) x = 'http://' + x;
  try { const p = new URL(x); return `${p.protocol}//${p.host}`; } catch (e) { return ''; }
};

// What the pairing QR on the laptop holds: http://192.168.1.20:8787/?pair=123456
// (scanning it with the phone's own camera app opens the phone web app, which pairs itself)
export function parsePairText(text) {
  try {
    const u = new URL(String(text).trim());
    const key = u.searchParams.get('pair');
    if (!/^https?:$/.test(u.protocol) || !key) return null;
    return { url: `${u.protocol}//${u.host}`, key };
  } catch (e) { return null; }
}

async function call(base, path, { key, method = 'GET', body, signal, timeout = 8000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  if (signal) signal.addEventListener('abort', () => ctl.abort());
  try {
    const r = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(key ? { 'x-kavach-key': key } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
      cache: 'no-store',
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || `Hub answered ${r.status}`); e.status = r.status; throw e; }
    return j;
  } finally { clearTimeout(t); }
}

// Pair with the code shown on the laptop. The hub answers with a token for this
// device only, so the laptop can unpair one phone without touching the others.
export async function pairHub(url, code, info) {
  const base = cleanUrl(url);
  if (!base) throw new Error('Enter the address shown on the laptop, e.g. 192.168.1.20:8787');
  let hello;
  try { hello = await call(base, '/api/hello', { timeout: 5000 }); } catch (e) {
    throw new Error(`No Kavach hub at ${base}. Is the laptop on the same Wi-Fi and the hub running?`);
  }
  if (hello.app !== 'kavach-hub') throw new Error(`${base} is not a Kavach hub.`);
  try {
    const j = await call(base, '/api/pair', { method: 'POST', body: { code: String(code).trim(), dev: deviceId(), ...info }, timeout: 6000 });
    return { url: base, key: j.token, hub: j.name };
  } catch (e) {
    throw new Error(e.status === 401 ? 'Wrong pairing code. Check the Setup page on the laptop.' : e.status === 429 ? 'Too many wrong codes. Wait a minute and try again.' : e.message);
  }
}

export class HubClient {
  constructor({ url, key, onState, onStatus, info }) {
    this.url = url; this.key = key; this.onState = onState; this.onStatus = onStatus; this.info = info;
    this.v = 0; this.stopped = false; this.status = 'connecting';
    this.outbox = ls.get(OUTBOX_KEY) || [];
    this.held = null; // newest server state, held back while our own actions are unsent
    this.ctl = null;
  }

  setStatus(st, detail) {
    const pending = this.outbox.length;
    if (st === this.status && !detail && pending === this.lastPending) return;
    this.status = st; this.lastPending = pending;
    this.onStatus && this.onStatus(st, detail);
  }

  start() {
    this.loop();
    this.flush();
    this.beat();
    this.beatTimer = setInterval(() => this.beat(), 10000);
  }

  stop() {
    this.stopped = true;
    clearInterval(this.beatTimer);
    if (this.ctl) this.ctl.abort();
  }

  accept(state, v) {
    if (v < this.v) return;
    this.v = v;
    if (this.outbox.length) { this.held = { state, v }; return; }
    this.held = null;
    this.onState(state, v);
  }

  async loop() {
    let wait = 1000;
    while (!this.stopped) {
      this.ctl = new AbortController();
      try {
        const j = await call(this.url, `/api/state?v=${this.v}&dev=${encodeURIComponent(deviceId())}`, { key: this.key, signal: this.ctl.signal, timeout: 35000 });
        if (j.state) this.accept(j.state, j.v);
        this.setStatus('online');
        wait = 1000;
        if (this.outbox.length && !this.flushing) this.flush();
      } catch (e) {
        if (this.stopped) return;
        this.setStatus(e.status === 401 ? 'unpaired' : 'offline', e.message);
        await new Promise((r) => setTimeout(r, wait));
        wait = Math.min(wait * 2, 8000);
      }
    }
  }

  // queue an action; returns once the hub has it (or it is safely queued)
  send(name, args, gender) {
    this.outbox.push({ id: rid(), name, args, gender, at: Date.now() });
    ls.set(OUTBOX_KEY, this.outbox);
    this.setStatus(this.status);
    this.flush();
  }

  async flush() {
    if (this.flushing || this.stopped) return;
    this.flushing = true;
    try {
      while (this.outbox.length && !this.stopped) {
        const a = this.outbox[0];
        let j;
        try {
          j = await call(this.url, '/api/act', { key: this.key, method: 'POST', body: { ...a, dev: deviceId() }, timeout: 10000 });
        } catch (e) {
          if (e.status && e.status !== 429 && e.status < 500) {
            // the hub refused this action (e.g. not allowed from a phone): drop it, say why
            this.outbox.shift(); ls.set(OUTBOX_KEY, this.outbox);
            this.setStatus(this.status, e.message);
            continue;
          }
          this.setStatus(e.status === 401 ? 'unpaired' : 'offline', e.message);
          setTimeout(() => { this.flushing = false; this.flush(); }, 3000);
          return;
        }
        this.outbox.shift();
        ls.set(OUTBOX_KEY, this.outbox);
        this.setStatus('online');
        if (j.state) this.accept(j.state, j.v);
      }
      if (this.held) { const h = this.held; this.held = null; this.onState(h.state, h.v); }
    } finally { this.flushing = false; }
  }

  async beat() {
    if (this.stopped) return;
    try { await call(this.url, '/api/presence', { key: this.key, method: 'POST', body: { dev: deviceId(), ...this.info() }, timeout: 5000 }); } catch (e) { /* the long poll reports status */ }
  }

  pending() { return this.outbox.length; }
}

// Laptop console only (trusted because it runs on the hub's own machine).
export const hubAdmin = {
  setup: () => call(location.origin, '/api/setup'),
  newCode: () => call(location.origin, '/api/setup/code', { method: 'POST', body: {} }),
  finish: (done = true) => call(location.origin, '/api/setup/done', { method: 'POST', body: { done } }),
  forget: (dev) => call(location.origin, '/api/setup/forget', { method: 'POST', body: { dev } }),
  reset: () => call(location.origin, '/api/reset', { method: 'POST', body: {} }),
};
