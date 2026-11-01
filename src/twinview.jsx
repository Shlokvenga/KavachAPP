// React side of the digital twin: lazy-loads www/twin.js (CesiumJS), feeds it live
// state, and falls back to the 2D map if WebGL or the bundle is unavailable.
import { useEffect, useRef, useState } from 'react';
import { CAMERAS, CAMPUS_SHORT } from './campus.js';
import { ALERT_TYPES, CP, camById, cls, fmtTime } from './data.js';
import { useApp } from './store.js';
import CampusMap from './map.jsx';
import { CAM_STATUS, CamTile, CameraFeed, CameraViewer } from './cctv.jsx';
import { Badge, Btn, Icon, LiveDot, Logo } from './ui.jsx';

let loading = null;
function loadTwin() {
  if (window.KavachTwin) return Promise.resolve(window.KavachTwin);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = 'twin.js';
      sc.onload = () => (window.KavachTwin ? resolve(window.KavachTwin) : reject(new Error('twin missing')));
      sc.onerror = () => { loading = null; reject(new Error('twin.js failed to load')); };
      document.head.appendChild(sc);
    });
  }
  return loading;
}

export function heatFor(s) {
  const heat = { ...s.heatBase };
  for (const a of s.alerts) if (!a.seed) heat[a.cp] = (heat[a.cp] || 0) + 1;
  return heat;
}

export function twinData(s, layers, selected) {
  const w = s.walk && s.walk.phase === 'active' ? s.walk : null;
  const last = w ? [...w.steps].reverse().find((x) => x.status === 'passed') : null;
  return {
    layers,
    selected,
    cams: Object.fromEntries(Object.entries(s.cams).map(([k, v]) => [k, v.status])),
    alerts: s.alerts.filter((a) => a.status !== 'resolved').map((a) => ({ id: a.id, cp: a.cp, pri: ALERT_TYPES[a.type].pri, label: ALERT_TYPES[a.type].label })),
    guards: s.guards.map((g) => ({ id: g.id, name: g.name, x: g.x, y: g.y })),
    walk: w ? { route: w.steps.map((x) => x.cp), at: last && last.cp } : null,
    heat: layers.heat ? heatFor(s) : null,
  };
}

export function Twin({ data, onPick, apiRef, className }) {
  const { s } = useApp();
  const box = useRef(null);
  const inst = useRef(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const [state, setState] = useState('loading');
  useEffect(() => {
    let dead = false;
    loadTwin().then((T) => {
      if (dead) return;
      try {
        inst.current = T.create(box.current, { onPick: (id) => pick.current && pick.current(id) });
        if (apiRef) apiRef.current = inst.current;
        setState('ready');
      } catch (e) { setState('error'); }
    }).catch(() => !dead && setState('error'));
    return () => { dead = true; if (inst.current) inst.current.destroy(); inst.current = null; if (apiRef) apiRef.current = null; };
  }, [apiRef]);
  useEffect(() => { if (inst.current) inst.current.update(data); });
  return (
    <div className={cls(className || 'relative', 'overflow-hidden bg-ink')}>
      <div ref={box} className={cls('absolute inset-0', state === 'error' && 'hidden')} />
      {state === 'loading' && (
        <div className="absolute inset-0 grid place-items-center text-sm text-white/70">
          <div className="flex items-center gap-2"><span className="spin h-4 w-4 rounded-full border-2 border-accent border-t-transparent" />Loading 3D campus…</div>
        </div>
      )}
      {state === 'error' && (
        <div className="absolute inset-0 overflow-auto bg-raise p-2">
          <div className="mb-1 px-1 text-[11px] font-semibold text-slate-500">3D view needs WebGL. Showing the 2D map.</div>
          <CampusMap alerts={data.layers.alerts !== false ? s.alerts : []} guards={data.layers.guards !== false ? s.guards : []} walk={data.layers.walk !== false ? s.walk : null}
            heat={data.heat} showCams={data.layers.cams !== false} cams={s.cams} onCam={(id) => onPick && onPick('cam:' + id)} />
        </div>
      )}
    </div>
  );
}

const LAYERS = [['cams', 'Cameras', 'video'], ['alerts', 'Alerts', 'bell'], ['heat', 'Heatmap', 'flame'], ['guards', 'Guards', 'users'], ['walk', 'Walks', 'walk']];

export function LayerChips({ layers, setLayers, dark }) {
  return (
    <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
      {LAYERS.map(([k, l, ic]) => {
        const on = layers[k] !== false && (k !== 'heat' || layers.heat);
        return (
          <button key={k} type="button" onClick={() => setLayers({ ...layers, [k]: !on })}
            className={cls('flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition',
              on ? 'bg-accent text-ink' : dark ? 'bg-white/10 text-white/70' : 'bg-card text-slate-500 ring-1 ring-slate-200')}>
            <Icon name={ic} className="h-3.5 w-3.5" />{l}
          </button>
        );
      })}
    </div>
  );
}

// Full-screen operations view for a laptop or a phone in landscape.
export function CommandCentre({ onClose }) {
  const { s, now } = useApp();
  const [layers, setLayers] = useState({ cams: true, alerts: true, heat: false, guards: true, walk: true, labels: true });
  const [sel, setSel] = useState(null);
  const [cam, setCam] = useState(null);
  const api = useRef(null);
  const open = s.alerts.filter((a) => a.status !== 'resolved');
  const alertCams = [...new Set(open.map((a) => a.cam).filter(Boolean))];
  const wall = [...alertCams, ...CAMERAS.map((c) => c.id).filter((id) => !alertCams.includes(id))].slice(0, 6);
  const counts = { online: 0, offline: 0, tampered: 0 };
  for (const c of Object.values(s.cams)) counts[c.status] += 1;

  const onPick = (id) => {
    setSel(id);
    if (!id) return;
    const [k, v] = id.split(':');
    if (k === 'cam') setCam(v);
    if (api.current) api.current.flyTo(k === 'alert' ? 'cp:' + (s.alerts.find((a) => a.id === v) || {}).cp : id);
  };

  return (
    <div className="fade-in fixed inset-0 z-[200] flex flex-col bg-ink text-white">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <Logo className="h-8 w-8" />
        <div className="mr-2">
          <div className="font-display text-lg font-semibold leading-tight">Kavach command centre</div>
          <div className="text-[11px] text-white/60">{CAMPUS_SHORT} · digital twin · {fmtTime(now, true)}</div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge className="bg-white/10 text-white"><LiveDot />Live</Badge>
          <Badge className="bg-white/10 text-white">{s.inside.toLocaleString('en-IN')} inside</Badge>
          <Badge className={open.length ? 'bg-red-600 text-white' : 'bg-white/10 text-white'}>{open.length} open alerts</Badge>
          <Badge className="bg-white/10 text-white">{counts.online}/{CAMERAS.length} cameras live</Badge>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Btn v="dark" size="sm" icon="x" onClick={onClose}>Close</Btn>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-[300px] flex-1">
          <Twin data={twinData(s, layers, sel)} onPick={onPick} apiRef={api} className="absolute inset-0" />
          <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center gap-2">
            <LayerChips layers={layers} setLayers={setLayers} dark />
            <div className="ml-auto flex gap-1.5">
              {[['overview', 'Overview'], ['top', 'Top'], ['walk', 'Route']].map(([k, l]) => (
                <button key={k} type="button" onClick={() => api.current && api.current.view(k)} className="rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/15 hover:bg-black/70">{l}</button>
              ))}
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/50 px-2 py-1 text-[10px] text-white/60">Drag to rotate · pinch or scroll to zoom · tap a camera or alert</div>
        </div>
        <div className="no-scrollbar flex w-full shrink-0 flex-col gap-3 overflow-y-auto border-white/10 p-3 lg:w-[400px] lg:border-l">
          <div className="text-xs font-bold uppercase tracking-wider text-white/50">Open alerts</div>
          {open.length === 0 && <div className="rounded-xl bg-white/5 p-3 text-sm text-white/60">All clear.</div>}
          {open.slice(0, 6).map((a) => (
            <button key={a.id} type="button" onClick={() => onPick('alert:' + a.id)}
              className={cls('flex items-center gap-3 rounded-xl p-2.5 text-left ring-1', sel === 'alert:' + a.id ? 'bg-white/15 ring-accent' : 'bg-white/5 ring-white/10')}>
              <span className={cls('grid h-8 w-8 shrink-0 place-items-center rounded-lg', ALERT_TYPES[a.type].pri === 'medium' ? 'bg-amber-500 text-ink' : 'bg-red-600')}><Icon name={ALERT_TYPES[a.type].icon} className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{ALERT_TYPES[a.type].label}</span>
                <span className="block text-[11px] text-white/60">{CP[a.cp].name} · {fmtTime(a.time)}{a.escalated ? ' · escalated' : ''}</span>
              </span>
              {a.cam && <span onClick={(e) => { e.stopPropagation(); setCam(a.cam); }} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold">{a.cam}</span>}
            </button>
          ))}
          <div className="mt-1 text-xs font-bold uppercase tracking-wider text-white/50">Camera wall</div>
          <div className="grid grid-cols-2 gap-2">
            {wall.map((id) => (
              <button key={id} type="button" onClick={() => { setCam(id); onPick('cam:' + id); }} className="overflow-hidden rounded-xl bg-black text-left ring-1 ring-white/10">
                <CameraFeed camId={id} detections={false} className="rounded-none" />
                <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px]">
                  <span className={cls('h-1.5 w-1.5 rounded-full', CAM_STATUS[s.cams[id].status].dot)} />
                  <span className="truncate">{camById(id).name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
      {cam && (
        <div className="absolute inset-y-0 right-0 z-10 w-full max-w-[420px] shadow-2xl">
          <CameraViewer key={cam} camId={cam} onClose={() => setCam(null)} who="Admin (Ms. Kulkarni)" />
        </div>
      )}
    </div>
  );
}

export { CamTile };
