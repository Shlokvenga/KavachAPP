// CCTV: camera wall tiles, feeds and the full camera viewer.
// A camera only shows video when a real camera (webcam / phone camera) is
// connected to it on this device or, through the hub, on another paired device
// (see vision/live.js and RemoteView).
import { useEffect, useRef, useState } from 'react';
import { ALERT_TYPES, CP, camById, cls, fmtTime } from './data.js';
import { guardById } from './store.js';
import { useApp } from './ctx.js';
import { Badge, Btn, Icon } from './ui.jsx';
import { isLive } from './vision/live.js';
import { LiveView, useVision } from './vision/ui.jsx';

export const CAM_STATUS = {
  online: { label: 'Live', badge: 'bg-emerald-500 text-white', dot: 'bg-emerald-500' },
  none: { label: 'Not connected', badge: 'bg-slate-200 text-slate-600', dot: 'bg-slate-400' },
  offline: { label: 'Offline', badge: 'bg-slate-500 text-white', dot: 'bg-slate-400' },
  tampered: { label: 'Tampered', badge: 'bg-amber-500 text-ink', dot: 'bg-amber-500' },
};

// Another paired device (e.g. the security laptop) that has this camera connected.
// Its live view comes through the hub (RemoteView).
export function remoteHost(s, camId) {
  if (isLive(camId)) return null;
  const devs = (s.net && s.net.devices) || [];
  return devs.find((d) => d.online && d.live.includes(camId)) || null;
}

// What a camera is right now: a recorded fault wins, then "live" if a real
// camera is connected on this device or on a paired one, otherwise "not connected".
export function camStatus(s, camId) {
  const st = s.cams[camId] && s.cams[camId].status;
  if (st === 'tampered' || st === 'offline') return st;
  return isLive(camId) || remoteHost(s, camId) ? 'online' : 'none';
}

// Video from a camera connected on another device, through the hub: a live MJPEG
// stream in the camera viewer, a picture refreshed every 2 s on the camera wall.
function RemoteView({ camId, stream }) {
  const { pairing } = useApp();
  const [tick, setTick] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (stream) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, [stream]);
  if (!pairing) return null;
  const q = `cam=${encodeURIComponent(camId)}${pairing.key ? `&key=${encodeURIComponent(pairing.key)}` : ''}`;
  const src = stream ? `${pairing.url}/api/mjpeg?${q}` : `${pairing.url}/api/snap?${q}&t=${tick}`;
  return (
    <img src={src} alt={`Live view of ${camId}`} onLoad={() => failed && setFailed(false)} onError={() => setFailed(true)}
      className={cls('absolute inset-0 h-full w-full object-cover', failed && 'opacity-0')} />
  );
}

export function CameraFeed({ camId, className, showMeta = true, stream = false }) {
  const { s } = useApp();
  useVision();
  const st = camStatus(s, camId);
  if (isLive(camId)) {
    return (
      <div className={cls('relative w-full overflow-hidden rounded-xl bg-black', st === 'tampered' && 'ring-2 ring-amber-400', className)}>
        <div style={{ transform: `scale(${(s.cams[camId] || {}).zoom || 1}) translateX(${-((s.cams[camId] || {}).pan || 0) / 2}%)`, transition: 'transform .4s ease' }}>
          <LiveView camId={camId} className="rounded-none" />
        </div>
        {showMeta && <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] font-bold text-brand"><span className="h-1.5 w-1.5 rounded-full bg-red-500 blink" />{camId} · LIVE · AI</div>}
        {st === 'tampered' && <div className="absolute right-1.5 top-1.5 rounded bg-amber-500 px-1.5 py-0.5 font-mono text-[9px] font-bold text-ink">TAMPER</div>}
      </div>
    );
  }
  const host = st === 'online' && remoteHost(s, camId);
  if (host) {
    return (
      <div className={cls('relative grid aspect-video w-full place-items-center overflow-hidden rounded-xl bg-black text-center', className)}>
        <div className="px-2">
          <Icon name="video" className="mx-auto h-5 w-5 text-brand" />
          <div className="mt-1 font-mono text-[10px] font-bold tracking-widest text-brand">CONNECTING TO {host.name.toUpperCase()}</div>
        </div>
        <RemoteView camId={camId} stream={stream} />
        {showMeta && <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] font-bold text-brand"><span className="h-1.5 w-1.5 rounded-full bg-red-500 blink" />{camId} · LIVE · {host.name}</div>}
      </div>
    );
  }
  const msg = { none: ['cameraOff', 'NOT CONNECTED', 'text-slate-400'], offline: ['cameraOff', 'NO SIGNAL', 'text-slate-300'], tampered: ['alert', 'VIEW BLOCKED', 'text-amber-300'] }[st];
  return (
    <div className={cls('relative grid aspect-video w-full place-items-center overflow-hidden rounded-xl bg-[repeating-linear-gradient(135deg,#070d12_0,#070d12_6px,#0a1218_6px,#0a1218_12px)] text-center', className)}>
      <div className="px-2">
        <Icon name={msg[0]} className={cls('mx-auto h-5 w-5', msg[2])} />
        <div className={cls('mt-1 font-mono text-[10px] font-bold tracking-widest', msg[2])}>{msg[1]}</div>
        {st === 'none' && showMeta && <div className="mt-0.5 text-[9px] text-slate-500">{s.net ? 'Connect a camera on the laptop or a phone' : 'Pair with the laptop hub to see its cameras'}</div>}
      </div>
      {showMeta && <div className="absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[9px] text-white">{camId}</div>}
    </div>
  );
}

export function CamTile({ camId, onOpen, highlight }) {
  const { s } = useApp();
  const cam = camById(camId);
  const st = camStatus(s, camId);
  const open = s.alerts.filter((a) => a.cam === camId && a.status !== 'resolved').length;
  return (
    <button type="button" onClick={() => onOpen(camId)}
      className={cls('overflow-hidden rounded-2xl bg-card text-left shadow-sm ring-1 transition active:scale-[.98]', highlight || open ? 'ring-2 ring-red-400' : 'ring-slate-200/70')}>
      <CameraFeed camId={camId} className="rounded-none" />
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <span className={cls('h-2 w-2 shrink-0 rounded-full', CAM_STATUS[st].dot)} />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">{cam.name}</span>
        {(isLive(camId) || remoteHost(s, camId)) && <span className="rounded bg-brand px-1 font-mono text-[9px] font-bold text-ink">AI</span>}
        {open > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">{open}</span>}
      </div>
    </button>
  );
}

export function CameraViewer({ camId, onClose, who, guardId }) {
  const { s, act } = useApp();
  const logged = useRef(false);
  const cam = camById(camId);
  const st = { ...s.cams[camId], status: camStatus(s, camId) };
  const live = isLive(camId);
  const ptz = cam.type.includes('PTZ');
  const events = s.alerts.filter((a) => a.cam === camId).slice(0, 4);
  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    act('viewFeed', camId, who);
  }, [camId, who, act]);
  const g = guardId ? guardById(s, guardId) : null;

  return (
    <div className="fade-in absolute inset-0 z-50 flex flex-col bg-ink text-white">
      <div className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-3">
        <button type="button" aria-label="Close camera" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/10"><Icon name="chevL" className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{cam.name}</div>
          <div className="truncate text-xs text-white/60">{camId} · {cam.type} · near {CP[cam.cp].name}</div>
        </div>
        <Badge className={CAM_STATUS[st.status].badge}>{CAM_STATUS[st.status].label}</Badge>
      </div>
      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-6">
        <CameraFeed camId={camId} stream />
        <div className="mt-2 flex items-center justify-between text-[11px] text-white/60">
          <span className="flex items-center gap-1"><Icon name="eye" className="h-3.5 w-3.5" />Behaviour AI on the camera's device</span>
          <span>This view is logged in the audit</span>
        </div>

        <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-4 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
          <div className="grid grid-cols-3 gap-1">
            <span />
            <button type="button" aria-label="Zoom in" onClick={() => act('camPtz', camId, { zoom: 0.5 })} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 active:bg-white/20"><Icon name="plus" className="h-4 w-4" /></button>
            <span />
            <button type="button" aria-label="Pan left" disabled={!ptz} onClick={() => act('camPtz', camId, { pan: -10 })} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 active:bg-white/20 disabled:opacity-30"><Icon name="chevL" className="h-4 w-4" /></button>
            <button type="button" aria-label="Reset view" onClick={() => act('camPtz', camId, { reset: true })} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-[10px] font-bold active:bg-white/20">1×</button>
            <button type="button" aria-label="Pan right" disabled={!ptz} onClick={() => act('camPtz', camId, { pan: 10 })} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 active:bg-white/20 disabled:opacity-30"><Icon name="chevR" className="h-4 w-4" /></button>
            <span />
            <button type="button" aria-label="Zoom out" onClick={() => act('camPtz', camId, { zoom: -0.5 })} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 active:bg-white/20"><Icon name="minus" className="h-4 w-4" /></button>
            <span />
          </div>
          <div className="text-xs text-white/70">
            <div className="font-semibold text-white">{ptz ? 'Pan, tilt, zoom' : 'Digital zoom'}</div>
            <div className="mt-0.5">{ptz ? 'Move the camera to follow an incident.' : 'Fixed camera. Zoom only.'}</div>
            <div className="mt-2 flex flex-wrap gap-1">{cam.analytics.map((a) => <span key={a} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">{a}</span>)}</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Btn v="dark" size="sm" icon="speaker" onClick={() => act('talkDown', camId)}>Talk-down speaker</Btn>
          <Btn v="dark" size="sm" icon="camera" disabled={!live} onClick={() => act('snapshot', camId, who)}>Snapshot</Btn>
          {g && <Btn v="danger" size="sm" icon="flag" className="col-span-2" onClick={() => { act('flagIncident', camId, guardId); onClose(); }}>Flag incident</Btn>}
        </div>

        <div className="mt-4 text-xs font-bold uppercase tracking-wider text-white/50">Events at this camera</div>
        <div className="mt-2 space-y-1.5">
          {events.length === 0 && <div className="rounded-xl bg-white/5 p-3 text-sm text-white/60">No alerts from this camera today.</div>}
          {events.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5 text-sm">
              <Icon name={ALERT_TYPES[a.type].icon} className="h-4 w-4 text-accent" />
              <span className="flex-1 truncate">{ALERT_TYPES[a.type].label}</span>
              <span className="text-xs text-white/50">{fmtTime(a.time)} · {a.status}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 text-[11px] text-white/40">{live ? 'Connected on this device. ' : 'No camera connected. Assign one in Guard → Cameras. '}Recordings would be kept 7 days, then deleted automatically.</div>
      </div>
    </div>
  );
}
