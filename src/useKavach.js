// The app's state, for both editions.
//  - Not paired: everything lives on this device (localStorage), as a stand-alone demo.
//  - Paired with the laptop hub: the hub holds the shared state; this device applies
//    each action locally at once and sends it on (see sync.js).
// Which demo student this device is signed in as (female / male) is always kept on the
// device, so two phones can be Priya and Aarav at the same time.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyAction } from './actions.js';
import { STATE_VERSION, STUDENTS, camById, makeInitial, verifyQr } from './data.js';
import { myWalk, tick, toast } from './store.js';
import { HubClient, clearPairing, loadPairing, savePairing } from './sync.js';
import { subscribeVision } from './vision/engine.js';
import { configureLive, live, snapshotAt } from './vision/live.js';
import { deleteTemplate, loadTemplate, verify } from './vision/face.js';

const STORE_KEY = 'kavach-state';
const CACHE_KEY = 'kavach-hub-cache';
const GENDER_KEY = 'kavach-gender';

function load(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    if (v && v.v === STATE_VERSION) return { ...v, toasts: [] };
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
const loadGender = () => { try { const g = localStorage.getItem(GENDER_KEY); return g === 'male' || g === 'female' ? g : null; } catch (e) { return null; } };

// edition: 'phone' | 'laptop'. The laptop console always talks to the hub that served it.
export function useKavach({ edition, role, deviceName }) {
  const laptopHub = edition === 'laptop' && /^https?:$/.test(location.protocol) ? { url: location.origin, key: null, hub: 'this laptop' } : null;
  const [pairing, setPairing] = useState(() => laptopHub || loadPairing());
  const mode = pairing ? 'hub' : 'local';
  const storeKey = mode === 'hub' ? CACHE_KEY : STORE_KEY;

  const [gender, setGenderState] = useState(() => loadGender() || (load(STORE_KEY) || {}).gender || 'female');
  const genderRef = useRef(gender);
  genderRef.current = gender;

  const [base, setBase] = useState(() => load(storeKey) || makeInitial(gender));
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
      info: () => ({ name: deviceName, kind: edition, role: roleRef.current, gender: genderRef.current, live: Object.keys(live) }),
    });
    client.current = c;
    c.start();
    // tell the hub at once when this device connects or disconnects a camera
    let last = '';
    const off = subscribeVision(() => { const k = Object.keys(live).sort().join(); if (k !== last) { last = k; c.beat(); } });
    return () => { off(); c.stop(); client.current = null; };
  }, [pairing, commit, deviceName, edition]);
  useEffect(() => { if (client.current) client.current.beat(); }, [role, gender]);

  // ---- run an action ----
  const act = useCallback((name, ...args) => {
    if (name === 'setGender') {
      const [g] = args;
      if (myWalk({ ...ref.current, gender: genderRef.current }) && ref.current.walk.phase === 'active') {
        const d = structuredClone(ref.current); toast(d, 'student', 'Finish your Saathi Walk before switching student', 'warn', STUDENTS[genderRef.current].id); commit(d);
        return undefined;
      }
      genderRef.current = g;
      setGenderState(g);
      try { localStorage.setItem(GENDER_KEY, g); } catch (e) { /* ignore */ }
      return undefined;
    }
    const d = structuredClone(ref.current);
    d.gender = genderRef.current;
    let result;
    try { result = applyAction(d, name, args); } catch (e) { console.error(e); return undefined; }
    commit(d);
    if (client.current) client.current.send(name, args, genderRef.current);
    return result;
  }, [commit]);

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
  const pair = useCallback((p) => { savePairing(p); setBase(load(CACHE_KEY) || makeInitial(genderRef.current)); setPairing(p); setSync({ status: 'connecting', detail: null, pending: 0 }); }, []);
  const unpair = useCallback(() => {
    clearPairing();
    try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* ignore */ }
    const d = load(STORE_KEY) || makeInitial(genderRef.current);
    ref.current = d; setBase(d); setPairing(null); setSync({ status: 'local', detail: null, pending: 0 });
  }, []);

  // ---- clear data ----
  // Stand-alone: erase everything on this device. Paired phone: erase only what this
  // phone keeps (face templates, cached copy); campus data stays on the hub.
  const reset = useCallback(() => {
    if (mode === 'hub' && edition === 'phone') {
      if (!window.confirm('Erase what this phone keeps (enrolled face, cached data)? Campus data on the laptop hub is not affected.')) return false;
      Object.values(STUDENTS).forEach((st) => deleteTemplate(st.id));
      try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* ignore */ }
      const d = structuredClone(ref.current); toast(d, 'all', 'This phone\'s data was cleared.', 'success'); commit(d);
      return true;
    }
    if (!window.confirm('Erase everything recorded on this device (alerts, scans, walks, visitors, audit log, enrolled faces)?')) return false;
    Object.values(STUDENTS).forEach((st) => deleteTemplate(st.id));
    const d = makeInitial(genderRef.current); toast(d, 'all', 'All data cleared. Starting fresh.', 'success'); commit(d);
    return true;
  }, [mode, edition, commit]);

  const s = useMemo(() => ({ ...base, gender }), [base, gender]);
  return { s, act, now, mode, sync, pairing, pair, unpair, reset };
}
