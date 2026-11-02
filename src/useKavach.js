// The app's state, for both editions.
//  - Not paired: everything lives on this device (localStorage), as a stand-alone demo.
//  - Paired with the laptop hub: the hub holds the shared state; this device applies
//    each action locally at once and sends it on (see sync.js).
// Who is signed in on this device (`me`, from src/auth.js) is sent with every action,
// so several phones can each be a different student or guard.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyAction } from './actions.js';
import { camById, makeInitial, migrate, verifyQr } from './data.js';
import { tick, toast } from './store.js';
import { listAccounts } from './auth.js';
import { HubClient, clearPairing, loadPairing, savePairing } from './sync.js';
import { subscribeVision } from './vision/engine.js';
import { configureLive, live, shareFrames, snapshotAt } from './vision/live.js';
import { deleteTemplate, loadTemplate, verify } from './vision/face.js';

const STORE_KEY = 'kavach-state';
const CACHE_KEY = 'kavach-hub-cache';

function load(key) {
  try {
    const v = migrate(JSON.parse(localStorage.getItem(key) || 'null'));
    if (v) return { ...v, toasts: [] };
  } catch (e) { /* storage unavailable or corrupt: start fresh */ }
  return null;
}
function save(key, s) {
  const data = { ...s, toasts: [], net: undefined };
  try { localStorage.setItem(key, JSON.stringify(data)); return; } catch (e) { /* probably full */ }
  try {
    const slim = { ...data, alerts: data.alerts.map((a, i) => (i < 15 ? a : { ...a, snap: null })) };
    localStorage.setItem(key, JSON.stringify(slim));
  } catch (e) { /* give up quietly; the app keeps working in memory */ }
}

// edition: 'phone' | 'laptop'. The laptop console always talks to the hub that served it.
// me: the signed-in account's public profile (phone), or null (laptop console).
export function useKavach({ edition, role, deviceName, me = null }) {
  const laptopHub = edition === 'laptop' && /^https?:$/.test(location.protocol) ? { url: location.origin, key: null, hub: 'this laptop' } : null;
  const [pairing, setPairing] = useState(() => laptopHub || loadPairing());
  const mode = pairing ? 'hub' : 'local';
  const storeKey = mode === 'hub' ? CACHE_KEY : STORE_KEY;

  const meRef = useRef(me);
  meRef.current = me;

  const [base, setBase] = useState(() => load(storeKey) || makeInitial());
  const ref = useRef(base);
  const [now, setNow] = useState(Date.now());
  const [sync, setSync] = useState({ status: mode === 'hub' ? 'connecting' : 'local', detail: null, pending: 0 });
  const client = useRef(null);

  const commit = useCallback((d) => { ref.current = d; setBase(d); }, []);

  // ---- hub connection ----
  const roleRef = useRef(role);
  roleRef.current = role;
  useEffect(() => {
    if (!pairing) return undefined;
    const c = new HubClient({
      url: pairing.url,
      key: pairing.key,
      onState: (st) => commit(st),
      onStatus: (status, detail) => setSync({ status, detail: detail || null, pending: c.pending() }),
      info: () => ({ name: deviceName, kind: edition, role: roleRef.current, user: meRef.current ? meRef.current.name : null, live: Object.keys(live) }),
    });
    client.current = c;
    c.start();
    // tell the hub at once when this device connects or disconnects a camera
    let last = '';
    const off = subscribeVision(() => { const k = Object.keys(live).sort().join(); if (k !== last) { last = k; c.beat(); } });
    return () => { off(); c.stop(); client.current = null; };
  }, [pairing, commit, deviceName, edition]);
  useEffect(() => { if (client.current) client.current.beat(); }, [role, me]);
  // live video from cameras on this device goes to the hub for the other devices
  useEffect(() => (pairing ? shareFrames(pairing) : undefined), [pairing]);

  // ---- run an action ----
  // actAs: for the rare action on behalf of an account that is not open (logging
  // out from the lock screen)
  const actAs = useCallback((who, name, ...args) => {
    const d = structuredClone(ref.current);
    let result;
    try { result = applyAction(d, name, args, who); } catch (e) { console.error(e); return undefined; }
    commit(d);
    if (client.current) client.current.send(name, args, who);
    return result;
  }, [commit]);
  const act = useCallback((name, ...args) => actAs(meRef.current, name, ...args), [actAs]);

  // ---- 1 s clock; timers run here only when there is no hub ----
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      if (mode === 'local') {
        const d = structuredClone(ref.current);
        if (tick(d)) commit(d);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [mode, commit]);

  // ---- save (the device copy, or a cache of the hub's copy for offline start) ----
  const saved = useRef('');
  useEffect(() => {
    const t = setTimeout(() => {
      const s = base;
      const key = JSON.stringify([s.seq, s.alerts.length, s.gate.log.length, s.walk && s.walk.steps.map((x) => x.status), s.visitors, s.issued.length, s.audit.length, s.cams]);
      if (key !== saved.current) { saved.current = key; save(storeKey, s); }
    }, 800);
    return () => clearTimeout(t);
  }, [base, storeKey]);

  // ---- real cameras on this device feed the shared state ----
  useEffect(() => {
    configureLive({
      onEvent: (camId, ev, snap) => act('aiEvent', camId, ev, snap),
      onQr: async (camId, text, slot) => {
        let face = null;
        const q = verifyQr(text);
        if (q.ok && loadTemplate(q.id)) face = await verify(slot.video, q.id).catch(() => null);
        act('gateQr', camId, text, face);
      },
      ctx: () => {
        const st = ref.current;
        return {
          // coverage to compute: a camera near an open alert analyses more frames
          investigate: (camId) => { const cam = camById(camId); return st.alerts.some((a) => a.status !== 'resolved' && (a.cam === camId || a.cp === cam.cp)); },
          scansSince: (sec) => st.gate.log.filter((l) => l.dir === 'IN' && Date.now() - l.time <= sec * 1000).length,
        };
      },
    });
  }, [act]);

  // ---- a student passed a checkpoint where this device has the camera: add the photo ----
  const tried = useRef(new Set());
  useEffect(() => {
    const w = base.walk;
    if (!w || w.phase !== 'active' || !Object.keys(live).length) return;
    for (const st of w.steps) {
      const k = `${w.id}:${st.cp}`;
      if (st.status !== 'passed' || st.snap || tried.current.has(k)) continue;
      tried.current.add(k);
      const snap = snapshotAt(st.cp);
      if (snap) act('attachSnap', w.id, st.cp, snap);
    }
  }, [base, act]);

  // ---- pairing ----
  const pair = useCallback((p) => { savePairing(p); setBase(load(CACHE_KEY) || makeInitial()); setPairing(p); setSync({ status: 'connecting', detail: null, pending: 0 }); }, []);
  const unpair = useCallback(() => {
    clearPairing();
    try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* ignore */ }
    const d = load(STORE_KEY) || makeInitial();
    ref.current = d; setBase(d); setPairing(null); setSync({ status: 'local', detail: null, pending: 0 });
  }, []);

  // ---- clear data ----
  // Stand-alone: erase the campus activity on this device. Paired phone: erase only what
  // this phone keeps (face templates, cached copy); campus data stays on the hub.
  // Accounts and the login are kept either way (log out or remove the account for that).
  const forgetFaces = () => listAccounts().forEach((a) => deleteTemplate(a.profile.id));
  const reset = useCallback(() => {
    if (mode === 'hub' && edition === 'phone') {
      if (!window.confirm('Erase what this phone keeps (enrolled face, cached data)? Campus data on the laptop hub is not affected.')) return false;
      forgetFaces();
      try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* ignore */ }
      const d = structuredClone(ref.current); toast(d, 'all', 'This phone\'s data was cleared.', 'success'); commit(d);
      return true;
    }
    if (!window.confirm('Erase the campus activity recorded on this device (alerts, scans, walks, lab records, audit log, enrolled faces)? Accounts on this phone are kept.')) return false;
    forgetFaces();
    const d = makeInitial();
    if (meRef.current) applyAction(d, 'hello', [], meRef.current); // keep the signed-in person known
    toast(d, 'all', 'All data cleared. Starting fresh.', 'success'); commit(d);
    return true;
  }, [mode, edition, commit]);

  const s = useMemo(() => ({ ...base, me }), [base, me]);
  return { s, act, actAs, now, mode, sync, pairing, pair, unpair, reset };
}
