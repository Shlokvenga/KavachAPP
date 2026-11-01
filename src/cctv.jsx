// CCTV: simulated live feeds, camera wall tiles and the full camera viewer.
// Feeds are drawn in SVG and animated with CSS; nothing touches a real camera.
// Every feed shows blurred faces and anonymous behaviour boxes, never names.
import { useEffect, useRef, useState } from 'react';
import { ALERT_TYPES, CP, camById, cls, fmtTime, hash, pad } from './data.js';
import { camPtz, flagIncident, guardById, requestUnblur, snapshot, talkDown, useApp, viewFeed } from './store.js';
import { Badge, Btn, Icon } from './ui.jsx';
import { isLive } from './vision/live.js';
import { LiveView, useVision } from './vision/ui.jsx';

export const CAM_STATUS = {
  online: { label: 'Live', badge: 'bg-emerald-500 text-white', dot: 'bg-emerald-500' },
  offline: { label: 'Offline', badge: 'bg-slate-500 text-white', dot: 'bg-slate-400' },
  tampered: { label: 'Tampered', badge: 'bg-amber-500 text-ink', dot: 'bg-amber-500' },
};

const isNight = (now) => { const h = new Date(now).getHours(); return h >= 18 || h < 6; };
const BEHAVIOUR = ['walking', 'walking', 'standing', 'walking', 'group'];

function Backdrop({ scene, thermal }) {
  if (thermal) {
    return (
      <g>
        <rect width="160" height="90" fill="#1a0b2e" />
        <rect y="58" width="160" height="32" fill="#2b1250" />
        <rect x="0" y="40" width="160" height="12" fill="#3a1a5c" />
        {Array.from({ length: 16 }).map((_, i) => <rect key={i} x={i * 10} y="40" width="1.2" height="12" fill="#4c2475" />)}
      </g>
    );
  }
  const common = <path d="M0 64 L160 56 L160 90 L0 90Z" fill="#7d736a" />;
  switch (scene) {
    case 'gate':
      return (
        <g>
          <rect width="160" height="90" fill="#cfd8de" />{common}
          <rect x="20" y="22" width="10" height="44" fill="#334155" /><rect x="130" y="22" width="10" height="44" fill="#334155" />
          <rect x="30" y="26" width="100" height="6" fill="#F7F1EE" />
          <text x="80" y="31" textAnchor="middle" fontSize="4.2" fontWeight="700" fill="#334155">MAIN GATE · PB ROAD</text>
          <rect x="74" y="50" width="3" height="16" fill="#433B36" /><rect x="76" y="52" width="34" height="2" fill="#dc2626" />
        </g>
      );
    case 'building':
      return (
        <g>
          <rect width="160" height="90" fill="#e7dccb" />
          <rect x="30" y="8" width="100" height="56" fill="#F7F1EE" />
          {[40, 60, 92, 112].map((x) => <rect key={x} x={x} y="16" width="10" height="12" fill="#9fb0bf" />)}
          <rect x="70" y="34" width="20" height="30" fill="#5b4a3f" />
          {common}
        </g>
      );
    case 'junction':
      return (
        <g>
          <rect width="160" height="90" fill="#d9d2c4" />
          <rect x="96" y="14" width="56" height="40" fill="#EADCC6" /><rect x="96" y="14" width="56" height="6" fill="#0e7490" />
          {common}
          {[22, 46].map((x) => <g key={x}><rect x={x} y="60" width="16" height="3" fill="#6B5E58" /><rect x={x + 7} y="63" width="2" height="7" fill="#6B5E58" /></g>)}
        </g>
      );
    case 'lawn':
      return (
        <g>
          <rect width="160" height="90" fill="#c9d6e0" />
          <rect x="10" y="10" width="140" height="40" fill="#FBF8F4" />
          {[20, 36, 52, 108, 124, 140].map((x) => <rect key={x} x={x} y="18" width="4" height="32" fill="#E3D9C7" />)}
          <path d="M60 10 L80 0 L100 10Z" fill="#FBF8F4" />
          <path d="M0 52 L160 50 L160 90 L0 90Z" fill="#8fb873" />
          <rect x="77" y="40" width="6" height="16" fill="#3f3a36" />
        </g>
      );
    default: // path
      return (
        <g>
          <rect width="160" height="90" fill="#cdd5cf" />
          {[[18, 30], [140, 26], [118, 40]].map(([x, r]) => <circle key={x} cx={x} cy={r} r="14" fill="#8fae7a" />)}
          <path d="M0 70 L160 58 L160 90 L0 90Z" fill="#a39684" />
          <path d="M40 90 L78 58 L92 58 L84 90Z" fill="#e6dccb" />
          <rect x="104" y="12" width="2" height="48" fill="#544943" /><circle cx="105" cy="13" r="2.4" fill="#fde68a" />
        </g>
      );
  }
}

function Walker({ i, seed, thermal, detections }) {
  const dur = 9 + ((seed >> (i * 3)) % 7);
  const delay = -((seed >> (i * 2)) % 9);
  const y = 50 + i * 6;
  const s = 0.9 + i * 0.12;
  const body = thermal ? '#f97316' : '#5a4f48';
  const head = thermal ? '#fde047' : '#c9a088';
  const tag = BEHAVIOUR[(seed + i) % BEHAVIOUR.length];
  return (
    <g className="walker" style={{ animationDuration: `${dur}s`, animationDelay: `${delay}s`, animationDirection: (seed + i) % 2 ? 'reverse' : 'normal' }}>
      <g transform={`translate(0 ${y}) scale(${s})`}>
        <rect x="-3.5" y="-8" width="7" height="12" rx="2.5" fill={body} />
        <rect x="-3" y="4" width="2.4" height="8" fill={body} className="leg-a" />
        <rect x=".6" y="4" width="2.4" height="8" fill={body} className="leg-b" />
        <circle cx="0" cy="-11.5" r="3.4" fill={head} filter={thermal ? undefined : 'url(#faceblur)'} />
        {detections && (
          <>
            <rect x="-7" y="-17" width="14" height="31" fill="none" stroke="#00e5ff" strokeWidth=".8" strokeDasharray="2 1.2" />
            <rect x="-7" y="-22" width="22" height="5" fill="#00e5ff" />
            <text x="-6" y="-18.6" fontSize="3.4" fontWeight="700" fill="#1b1411">#{(seed % 90) + i * 7} {tag}</text>
          </>
        )}
      </g>
    </g>
  );
}

export function CameraFeed({ camId, className, detections = true, showMeta = true }) {
  const { s, now } = useApp();
  useVision();
  if (isLive(camId)) {
    return (
      <div className={cls('relative w-full overflow-hidden rounded-xl bg-black', className)}>
        <LiveView camId={camId} className="rounded-none" />
        {showMeta && <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] font-bold text-brand"><span className="h-1.5 w-1.5 rounded-full bg-red-500 blink" />{camId} · REAL · AI</div>}
      </div>
    );
  }
  const cam = camById(camId);
  const st = s.cams[camId] || { status: 'online', zoom: 1, pan: 0 };
  const seed = parseInt(hash(camId).slice(0, 6), 36);
  const thermal = cam.type.startsWith('Thermal');
  const night = isNight(now) && !thermal;
  const people = st.status === 'online' ? 1 + (seed % 3) : 0;
  const t = new Date(now);
  const stamp = `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
  return (
    <div className={cls('relative aspect-video w-full overflow-hidden rounded-xl bg-black', className)}>
      <svg viewBox="0 0 160 90" className="h-full w-full" preserveAspectRatio="xMidYMid slice"
        style={{ filter: night ? 'grayscale(1) brightness(.75) contrast(1.15) sepia(.25) hue-rotate(60deg)' : undefined }}>
        <defs><filter id="faceblur" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="1.6" /></filter></defs>
        <g style={{ transform: `translate(${80 - 80 * st.zoom - st.pan * st.zoom}px, ${45 - 45 * st.zoom}px) scale(${st.zoom})`, transition: 'transform .5s ease' }}>
          <Backdrop scene={cam.scene} thermal={thermal} />
          {Array.from({ length: people }).map((_, i) => <Walker key={i} i={i} seed={seed} thermal={thermal} detections={detections} />)}
        </g>
        {Array.from({ length: 15 }).map((_, i) => <rect key={i} y={i * 6} width="160" height=".6" fill="#fff" opacity=".04" />)}
      </svg>
      {st.status === 'offline' && (
        <div className="absolute inset-0 grid place-items-center bg-[repeating-linear-gradient(0deg,#1f1a17_0,#1f1a17_2px,#2a231f_2px,#2a231f_4px)] text-center">
          <div><Icon name="cameraOff" className="mx-auto h-6 w-6 text-slate-400" /><div className="mt-1 text-[11px] font-bold tracking-widest text-slate-300">NO SIGNAL</div></div>
        </div>
      )}
      {st.status === 'tampered' && (
        <div className="absolute inset-0 grid place-items-center bg-black/80 backdrop-blur-md text-center">
          <div><Icon name="alert" className="mx-auto h-6 w-6 text-amber-400" /><div className="mt-1 text-[11px] font-bold tracking-widest text-amber-300">VIEW BLOCKED</div></div>
        </div>
      )}
      {showMeta && (
        <>
          <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[9px] text-white">
            <span className={cls('h-1.5 w-1.5 rounded-full', st.status === 'online' ? 'bg-red-500 blink' : 'bg-slate-400')} />{camId}
          </div>
          <div className="absolute right-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[9px] text-white">{stamp}</div>
          {st.zoom > 1 && <div className="absolute bottom-1.5 right-1.5 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[9px] text-white">{st.zoom.toFixed(1)}×</div>}
        </>
      )}
    </div>
  );
}

export function CamTile({ camId, onOpen, highlight }) {
  const { s } = useApp();
  const cam = camById(camId);
  const st = s.cams[camId].status;
  const open = s.alerts.filter((a) => a.cam === camId && a.status !== 'resolved').length;
  return (
    <button type="button" onClick={() => onOpen(camId)}
      className={cls('overflow-hidden rounded-2xl bg-card text-left shadow-sm ring-1 transition active:scale-[.98]', highlight || open ? 'ring-2 ring-red-400' : 'ring-slate-200/70')}>
      <CameraFeed camId={camId} detections={false} className="rounded-none" />
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <span className={cls('h-2 w-2 shrink-0 rounded-full', CAM_STATUS[st].dot)} />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">{cam.name}</span>
        {isLive(camId) && <span className="rounded bg-brand px-1 font-mono text-[9px] font-bold text-ink">AI</span>}
        {open > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">{open}</span>}
      </div>
    </button>
  );
}

const UNBLUR_REASONS = ['Police complaint', 'Theft investigation', 'Student safety incident', 'Ragging complaint'];

export function CameraViewer({ camId, onClose, who, guardId }) {
  const { s, mutate } = useApp();
  const [unblur, setUnblur] = useState(false);
  const logged = useRef(false);
  const cam = camById(camId);
  const st = s.cams[camId];
  const ptz = cam.type.includes('PTZ');
  const events = s.alerts.filter((a) => a.cam === camId).slice(0, 4);
  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    mutate((d) => viewFeed(d, camId, who));
  }, [camId, who, mutate]);
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
        <CameraFeed camId={camId} />
        <div className="mt-2 flex items-center justify-between text-[11px] text-white/60">
          <span className="flex items-center gap-1"><Icon name="eye" className="h-3.5 w-3.5" />Faces blurred · behaviour AI only</span>
          <span>This view is logged in the audit</span>
        </div>

        <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-4 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
          <div className="grid grid-cols-3 gap-1">
            <span />
            <button type="button" aria-label="Zoom in" onClick={() => mutate((d) => camPtz(d, camId, { zoom: 0.5 }))} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 active:bg-white/20"><Icon name="plus" className="h-4 w-4" /></button>
            <span />
            <button type="button" aria-label="Pan left" disabled={!ptz} onClick={() => mutate((d) => camPtz(d, camId, { pan: -10 }))} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 active:bg-white/20 disabled:opacity-30"><Icon name="chevL" className="h-4 w-4" /></button>
            <button type="button" aria-label="Reset view" onClick={() => mutate((d) => camPtz(d, camId, { reset: true }))} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-[10px] font-bold active:bg-white/20">1×</button>
            <button type="button" aria-label="Pan right" disabled={!ptz} onClick={() => mutate((d) => camPtz(d, camId, { pan: 10 }))} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 active:bg-white/20 disabled:opacity-30"><Icon name="chevR" className="h-4 w-4" /></button>
            <span />
            <button type="button" aria-label="Zoom out" onClick={() => mutate((d) => camPtz(d, camId, { zoom: -0.5 }))} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 active:bg-white/20"><Icon name="minus" className="h-4 w-4" /></button>
            <span />
          </div>
          <div className="text-xs text-white/70">
            <div className="font-semibold text-white">{ptz ? 'Pan, tilt, zoom' : 'Digital zoom'}</div>
            <div className="mt-0.5">{ptz ? 'Move the camera to follow an incident.' : 'Fixed camera. Zoom only.'}</div>
            <div className="mt-2 flex flex-wrap gap-1">{cam.analytics.map((a) => <span key={a} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">{a}</span>)}</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Btn v="dark" size="sm" icon="speaker" onClick={() => mutate((d) => talkDown(d, camId))}>Talk-down speaker</Btn>
          <Btn v="dark" size="sm" icon="camera" onClick={() => mutate((d) => snapshot(d, camId, who))}>Snapshot</Btn>
          {g && <Btn v="danger" size="sm" icon="flag" onClick={() => { mutate((d) => flagIncident(d, camId, guardId)); onClose(); }}>Flag incident</Btn>}
          <Btn v="dark" size="sm" icon="eye" className={g ? '' : 'col-span-2'} onClick={() => setUnblur(!unblur)}>Request unblur</Btn>
        </div>
        {unblur && (
          <div className="fade-up mt-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
            <div className="text-sm font-semibold">Why do you need to see faces?</div>
            <p className="text-xs text-white/60">The student committee reviews every request. Nothing is unblurred until they approve.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {UNBLUR_REASONS.map((r) => (
                <button key={r} type="button" onClick={() => { mutate((d) => requestUnblur(d, camId, who, r)); setUnblur(false); }}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20">{r}</button>
              ))}
            </div>
          </div>
        )}

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
        <div className="mt-4 text-[11px] text-white/40">{st.status === 'online' ? `Online since ${fmtTime(st.since)} · ` : ''}Recording kept 7 days, then deleted automatically.</div>
      </div>
    </div>
  );
}
