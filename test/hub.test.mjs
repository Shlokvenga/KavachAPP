// Hub tests: pairing, actions, long-poll sync, permissions, unpairing, persistence.
// Starts hub/server.js in this process on a test port with a temporary data folder.
// Requests that should look like a phone on the Wi-Fi send a non-localhost Host header.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const PORT = 8799;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'kavach-hub-test-'));
process.env.PORT = String(PORT);
process.env.KAVACH_DATA = DATA;
process.env.KAVACH_APP = DATA; // no static files needed
process.env.KAVACH_QUIET = '1';
const { server } = await import('../hub/server.js');
await new Promise((r) => (server.listening ? r() : server.once('listening', r)));

const LOCAL_HOST = `localhost:${PORT}`;
let failures = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name.padEnd(46)} ${extra}`);
  if (!ok) failures += 1;
};
// node:http (fetch would not let us set the Host header)
function req(p, { method = 'GET', body, host = LOCAL_HOST, key, origin } = {}) {
  const headers = { host };
  const data = body ? JSON.stringify(body) : null;
  if (data) { headers['content-type'] = 'application/json'; headers['content-length'] = Buffer.byteLength(data); }
  if (key) headers['x-kavach-key'] = key;
  if (origin) headers.origin = origin;
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: PORT, path: p, method, headers }, (res) => {
      let txt = '';
      res.on('data', (c) => { txt += c; });
      res.on('end', () => { let json = {}; try { json = JSON.parse(txt); } catch (e) { /* not json */ } resolve({ status: res.statusCode, json }); });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
const phone = (p, key, opts = {}) => req(p, { ...opts, host: 'phone.test', key });

try {
  const hello = await req('/api/hello');
  check('hello', hello.status === 200 && hello.json.app === 'kavach-hub');

  check('phone without pairing is refused', (await phone('/api/state')).status === 401);
  check('phone cannot read setup', (await phone('/api/setup')).status === 401);

  const code = (await req('/api/setup')).json.code;
  check('console reads pairing code', /^\d{6}$/.test(code), code);
  check('cross-site request is not trusted', (await req('/api/setup', { origin: 'http://evil.example' })).status === 401);

  const wrong = await phone('/api/pair', null, { method: 'POST', body: { code: code === '000000' ? '111111' : '000000', dev: 'x' } });
  check('wrong code refused', wrong.status === 401);

  const pa = await phone('/api/pair', null, { method: 'POST', body: { code, dev: 'dev-a', name: 'Priya phone' } });
  const pb = await phone('/api/pair', null, { method: 'POST', body: { code, dev: 'dev-b', name: 'Aarav phone' } });
  const A = pa.json.token; const B = pb.json.token;
  check('two phones pair', pa.status === 200 && pb.status === 200 && A && B && A !== B);

  let st = await phone('/api/state?v=0', A);
  check('paired phone gets state', st.status === 200 && st.json.state && st.json.state.net.devices.length === 2);
  let v = st.json.v;

  // long poll wakes when another phone acts
  const poll = phone(`/api/state?v=${v}`, A);
  await new Promise((r) => setTimeout(r, 150));
  const act = await phone('/api/act', B, { method: 'POST', body: { id: 'b1', name: 'gateScan', args: ['IN'], gender: 'male' } });
  const woke = await poll;
  check('long poll wakes on change', woke.status === 200 && woke.json.v > v && woke.json.state.gate.log.length === 1);
  check('action runs as the sending student', act.json.state.gate.log[0].sid === '21BRS018');

  const again = await phone('/api/act', B, { method: 'POST', body: { id: 'b1', name: 'gateScan', args: ['IN'], gender: 'male' } });
  check('retried action is not applied twice', again.json.state.gate.log.length === 1);

  // walks belong to the student who started them
  await phone('/api/act', A, { method: 'POST', body: { id: 'a1', name: 'startWalk', args: ['D', false, { femaleGuard: true }], gender: 'female' } });
  const other = await phone('/api/act', B, { method: 'POST', body: { id: 'b2', name: 'passNext', args: [null], gender: 'male' } });
  check("another student cannot move Priya's walk", other.json.state.walk.steps.filter((x) => x.status === 'passed').length === 1);
  const own = await phone('/api/act', A, { method: 'POST', body: { id: 'a2', name: 'passNext', args: [null], gender: 'female' } });
  check('Priya passes her next checkpoint', own.json.state.walk.steps.filter((x) => x.status === 'passed').length === 2);
  const toasts = own.json.state.toasts.filter((t) => t.role === 'student');
  check('student toasts are addressed to her', toasts.length > 0 && toasts.every((t) => t.sid === '21BRS045'));
  const busy = await phone('/api/act', B, { method: 'POST', body: { id: 'b3', name: 'startWalk', args: ['E', false, {}], gender: 'male' } });
  check('second walk refused while one is active', busy.json.state.walk.sid === '21BRS045');

  // permissions
  const vis = await phone('/api/act', A, { method: 'POST', body: { id: 'a3', name: 'createVisitor', args: [{ name: 'Test', phone: '9999999999', purpose: 'Meeting', dest: 'Main Building', from: '10:00', to: '11:00' }] } });
  check('phone cannot create visitor pass', vis.status === 403);
  const vis2 = await req('/api/act', { method: 'POST', body: { id: 'c1', name: 'createVisitor', args: [{ name: 'Test', phone: '9999999999', purpose: 'Meeting', dest: 'Main Building', from: '10:00', to: '11:00' }] } });
  check('console creates visitor pass', vis2.status === 200 && vis2.json.state.visitors.length === 1);
  check('unknown action rejected', (await phone('/api/act', A, { method: 'POST', body: { name: 'nope' } })).status === 400);
  check('phone cannot erase data', (await phone('/api/reset', A, { method: 'POST', body: {} })).status === 401 || (await phone('/api/reset', A, { method: 'POST', body: {} })).status === 403);

  // presence: cameras connected on a phone show up for everyone
  await phone('/api/presence', B, { method: 'POST', body: { role: 'guard', live: ['CAM-A1'] } });
  st = await phone('/api/state?v=0', A);
  const devB = st.json.state.net.devices.find((x) => x.id === 'dev-b');
  check('camera presence is shared', devB && devB.online && devB.live.includes('CAM-A1') && devB.role === 'guard');

  // unpairing one phone ends its sync at once, the other keeps going
  v = st.json.v;
  const pollB = phone(`/api/state?v=${v}`, B);
  await new Promise((r) => setTimeout(r, 150));
  await req('/api/setup/forget', { method: 'POST', body: { dev: 'dev-b' } });
  check('unpaired phone is told immediately', (await pollB).status === 401);
  check('unpaired phone is refused after', (await phone('/api/state?v=0', B)).status === 401);
  check('other phone still syncs', (await phone('/api/state?v=0', A)).status === 200);

  // saved to disk
  await new Promise((r) => setTimeout(r, 1200));
  const saved = JSON.parse(fs.readFileSync(path.join(DATA, 'state.json'), 'utf8'));
  check('state saved to data/state.json', saved.gate.log.length === 1 && saved.visitors.length === 1 && !saved.net);
  const cfg = JSON.parse(fs.readFileSync(path.join(DATA, 'config.json'), 'utf8'));
  check('config keeps one token per phone', Object.keys(cfg.devices).length === 1 && cfg.devices['dev-a']);

  await req('/api/reset', { method: 'POST', body: {} });
  st = await phone('/api/state?v=0', A);
  check('console erases campus data', st.json.state.gate.log.length === 0 && !st.json.state.walk);
} finally {
  server.close();
  fs.rmSync(DATA, { recursive: true, force: true });
}
console.log(failures ? `\n${failures} hub test(s) failed` : '\nAll hub tests passed');
process.exit(failures ? 1 : 0);
