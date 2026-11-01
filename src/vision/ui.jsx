// UI for the on-device AI: live anonymised views, camera binding, explainable
// alert blocks, face enrolment and the real 1:1 gate check.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CAMERAS } from '../campus.js';
import { STUDENT, cls, fmtTime } from '../data.js';
import { gateFaceResult, useApp, toast } from '../store.js';
import { Badge, Btn, Card, Icon, Sheet } from '../ui.jsx';
import { MODELS, aiSupported, loadVision, subscribeVision, vision, visionVersion } from './engine.js';
import { THRESHOLDS, deleteTemplate, enrol, loadTemplate, verify } from './face.js';
import { bindCamera, listCameras, live, unbindCamera } from './live.js';
import { RULES } from './rules.js';

export const useVision = () => useSyncExternalStore(subscribeVision, visionVersion);

// Mirrors a live camera's anonymised output into this component's own canvas.
export function LiveView({ camId, className }) {
  const ref = useRef(null);
  useEffect(() => {
    let raf;
    const draw = () => {
      const s = live[camId]; const c = ref.current;
      if (s && c) { const ctx = c.getContext('2d'); ctx.drawImage(s.out, 0, 0, c.width, c.height); }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [camId]);
  return <canvas ref={ref} width={640} height={360} className={cls('block aspect-video w-full rounded-xl bg-black', className)} />;
}

export function AiStatus({ compact }) {
  useVision();
  const n = Object.keys(live).length;
  const st = { idle: ['Off', 'bg-slate-200 text-slate-600'], loading: ['Loading models', 'bg-amber-100 text-amber-800'], ready: ['On-device AI ready', 'bg-emerald-100 text-emerald-700'], error: ['AI unavailable', 'bg-red-100 text-red-700'] }[vision.status];
  return (
    <div className={cls('flex flex-wrap items-center gap-1.5 text-[11px]', compact && 'text-[10px]')}>
      <Badge className={st[1]}>{vision.status === 'loading' && <span className="spin h-2.5 w-2.5 rounded-full border-2 border-current border-t-transparent" />}{st[0]}</Badge>
      {vision.status === 'ready' && <Badge className="bg-slate-200 font-mono text-slate-700">{vision.backend} · {vision.inferMs} ms</Badge>}
      <Badge className="bg-slate-200 font-mono text-slate-700">{n} live camera{n === 1 ? '' : 's'}</Badge>
    </div>
  );
}

const SUGGEST = ['CAM-G1', 'CAM-B1', 'CAM-W1', 'CAM-C1', 'CAM-D2'];

// Guard → Cameras: plug in webcams (laptop) or use the phone camera (Android app).
export function CamConnect() {
  useVision();
  const [devices, setDevices] = useState(null);
  const [err, setErr] = useState(null);
  const [pick, setPick] = useState({});
  const [open, setOpen] = useState(null);
  const bound = Object.values(live);

  if (!aiSupported()) {
    return (
      <Card className="flex items-start gap-3 bg-amber-50 ring-amber-200">
        <Icon name="info" className="mt-0.5 h-5 w-5 text-amber-700" />
        <p className="text-sm text-amber-900">Real cameras and on-device AI need the Android app or a local server. Run <span className="font-mono">npm run serve</span> and open <span className="font-mono">http://localhost:8080</span>.</p>
      </Card>
    );
  }
  const find = async () => {
    setErr(null);
    try {
      const d = await listCameras();
      setDevices(d);
      const used = new Set(Object.keys(live));
      const p = {};
      d.forEach((dev, i) => { const slot = Object.values(live).find((s) => s.deviceId === dev.id); p[dev.id] = slot ? slot.camId : SUGGEST.filter((c) => !used.has(c))[i] || 'CAM-B2'; });
      setPick(p);
      loadVision().catch(() => {});
    } catch (e) { setErr(e.message); }
  };
  const connect = async (dev) => {
    setErr(null);
    try { await bindCamera(pick[dev.id], dev); } catch (e) { setErr(`${dev.label}: ${e.message}`); }
  };

  return (
    <Card className="space-y-3 ring-brand/30">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-display text-sm font-bold uppercase tracking-wider text-slate-900">Real cameras · on-device AI</div>
          <p className="text-xs text-slate-500">Connect webcams or this phone's camera. Video is analysed on this device and never uploaded.</p>
        </div>
        <Icon name="cpu" className="h-5 w-5 text-brand" />
      </div>
      <AiStatus />
      {vision.error && <p className="text-xs text-red-700">{vision.error}</p>}
      {err && <p className="text-xs text-red-700">{err}</p>}
      {bound.map((s) => (
        <div key={s.camId} className="rounded-xl bg-raise p-2 ring-1 ring-line">
          <div className="flex items-center gap-2">
            <span className={cls('h-2 w-2 rounded-full', s.stats.mode === 'INVESTIGATE' ? 'bg-coral blink' : 'bg-brand')} />
            <span className="font-mono text-xs font-bold text-brand">{s.camId}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-slate-600">{s.label}</span>
            <Badge className={s.stats.mode === 'INVESTIGATE' ? 'bg-red-100 text-red-700' : 'bg-brand-100 text-brand'}>{s.stats.mode}</Badge>
          </div>
          <div className="mt-1 font-mono text-[10px] text-slate-500">{s.stats.fps} fps · {s.stats.people} people · motion {s.stats.motion} · {s.stats.events} events</div>
          <div className="mt-2 flex gap-2">
            <Btn size="sm" v="outline" className="flex-1" icon="settings" onClick={() => setOpen(open === s.camId ? null : s.camId)}>Rules</Btn>
            <Btn size="sm" v="outline" className="flex-1" onClick={() => unbindCamera(s.camId)}>Disconnect</Btn>
          </div>
          {open === s.camId && <RuleEditor slot={s} />}
        </div>
      ))}
      {!devices && <Btn className="w-full" icon="video" onClick={find}>{bound.length ? 'Connect another camera' : 'Find cameras'}</Btn>}
      {devices && (
        <div className="space-y-2">
          {devices.length === 0 && <p className="text-xs text-slate-500">No cameras found.</p>}
          {devices.map((dev) => {
            const slot = Object.values(live).find((s) => s.deviceId === dev.id);
            return (
              <div key={dev.id} className="flex items-center gap-2 rounded-xl bg-raise p-2 ring-1 ring-line">
                <Icon name="video" className="h-4 w-4 text-slate-500" />
                <span className="min-w-0 flex-1 truncate text-xs text-slate-700">{dev.label}</span>
                {slot ? <Badge className="bg-emerald-100 text-emerald-700">{slot.camId}</Badge> : (
                  <>
                    <select aria-label={`Camera slot for ${dev.label}`} value={pick[dev.id]} onChange={(e) => setPick({ ...pick, [dev.id]: e.target.value })}
                      className="rounded-lg border-0 bg-card px-2 py-1 font-mono text-[11px] text-slate-800 ring-1 ring-line">
                      {CAMERAS.map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}
                    </select>
                    <Btn size="sm" onClick={() => connect(dev)}>Connect</Btn>
                  </>
                )}
              </div>
            );
          })}
          <button type="button" onClick={() => setDevices(null)} className="text-xs font-semibold text-slate-500">Done</button>
        </div>
      )}
      <p className="text-[11px] text-slate-500">Tip: assign a camera to <b className="text-slate-700">CAM-G1</b> (gate) to scan students' QR passes and count tailgating, <b className="text-slate-700">CAM-B1</b> (path) for following, running and falls, <b className="text-slate-700">CAM-W1</b> (wall) for line crossing.</p>
    </Card>
  );
}

function RuleEditor({ slot }) {
  const [, force] = useState(0);
  const cfg = slot.analyzer.cfg;
  const set = (fn) => { fn(cfg); force((n) => n + 1); };
  return (
    <div className="fade-up mt-2 space-y-1.5 border-t border-line pt-2">
      {Object.entries(RULES).map(([k, r]) => (
        <label key={k} className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={!!cfg.enabled[k]} onChange={(e) => set((c) => { c.enabled[k] = e.target.checked; })} className="accent-[#00e5ff]" />
          <span className="font-semibold text-slate-800">{r.name}</span>
          <span className="truncate text-slate-500">{r.about}</span>
        </label>
      ))}
      <label className="flex items-center gap-2 pt-1 text-xs text-slate-600">
        Sensitivity
        <input type="range" min="0.5" max="1.5" step="0.1" value={cfg.sensitivity} onChange={(e) => set((c) => { c.sensitivity = +e.target.value; })} className="flex-1 accent-[#00e5ff]" />
        <span className="w-8 font-mono">{cfg.sensitivity.toFixed(1)}</span>
      </label>
    </div>
  );
}

// "Why did the AI raise this?" block inside an alert card.
export function AiExplain({ a }) {
  if (!a.ai) return null;
  return (
    <div className="mt-3 rounded-xl bg-brand-50 p-3 ring-1 ring-brand/25">
      <div className="flex items-center gap-2 text-xs">
        <Badge className="bg-brand text-ink"><Icon name="cpu" className="h-3 w-3" />AI · {(a.ai.conf * 100).toFixed(0)}%</Badge>
        <span className="font-semibold text-slate-800">{a.ai.name}</span>
        <span className="ml-auto font-mono text-[10px] text-slate-500">{a.ai.model}</span>
      </div>
      <p className="mt-1.5 text-xs text-slate-700"><b>Why:</b> {a.ai.explain}</p>
      {a.snap && <img src={a.snap} alt="Anonymised snapshot from the camera" className="mt-2 w-full rounded-lg ring-1 ring-line" />}
      <p className="mt-1 text-[10px] text-slate-500">Snapshot is anonymised (faces and heads pixelated) before it is saved.</p>
    </div>
  );
}

// Front-camera hook for the student's own phone.
function useSelfCam(active) {
  const ref = useRef(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    if (!active) return undefined;
    let stream;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
      .then((s) => { stream = s; if (ref.current) { ref.current.srcObject = s; ref.current.play().catch(() => {}); } })
      .catch((e) => setErr(e.name === 'NotAllowedError' ? 'Camera permission was denied.' : 'No camera available.'));
    loadVision().catch((e) => setErr(e.message));
    return () => stream && stream.getTracks().forEach((t) => t.stop());
  }, [active]);
  return [ref, err];
}

export function FaceEnrolPage({ onBack }) {
  useVision();
  const { mutate } = useApp();
  const [tpl, setTpl] = useState(() => loadTemplate(STUDENT.id));
  const [cam, setCam] = useState(false);
  const [busy, setBusy] = useState(null);
  const [res, setRes] = useState(null);
  const [video, err] = useSelfCam(cam);
  const go = async () => {
    setRes(null); setBusy('Hold still…');
    try {
      const r = await enrol(video.current, STUDENT.id, (i) => setBusy(`Reading your face ${i}/4…`));
      setRes(r);
      if (r.ok) { setTpl(r.template); setCam(false); mutate((d) => toast(d, 'student', 'Face enrolled on this phone for 1:1 gate checks', 'success')); }
    } catch (e) { setRes({ ok: false, problems: [e.message] }); }
    setBusy(null);
  };
  return (
    <div className="pb-28">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-ink/85 px-4 py-3 backdrop-blur">
        <button type="button" aria-label="Back" onClick={onBack} className="grid h-9 w-9 place-items-center rounded-full bg-card ring-1 ring-line"><Icon name="chevL" className="h-5 w-5" /></button>
        <h1 className="font-display text-[20px] font-bold uppercase tracking-[.06em] text-slate-900">Face check</h1>
      </div>
      <div className="space-y-4 px-4 pt-4">
        <Card>
          <div className="font-display text-sm font-bold uppercase tracking-wider text-slate-900">How it works</div>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
            <li>• Your face becomes a list of numbers, stored <b className="text-slate-800">only on this phone</b>. No photo is kept.</li>
            <li>• At a gate it is compared <b className="text-slate-800">1:1</b> with the person holding your pass. Never searched against anyone else.</li>
            <li>• Anti-spoof and liveness checks stop someone using your photo.</li>
          </ul>
        </Card>
        {tpl && !cam && (
          <Card className="flex items-center gap-3 bg-emerald-50 ring-emerald-200">
            <Icon name="checkCircle" className="h-6 w-6 text-emerald-700" />
            <div className="flex-1 text-sm"><div className="font-semibold text-slate-900">Face enrolled</div><div className="text-xs text-slate-600">{fmtTime(tpl.enrolledAt)} · {tpl.samples} samples · quality {tpl.quality}</div></div>
            <Btn size="sm" v="outline" onClick={() => { deleteTemplate(STUDENT.id); setTpl(null); }}>Delete</Btn>
          </Card>
        )}
        {!aiSupported() && <Card className="text-sm text-amber-800">Needs the Android app or <span className="font-mono">npm run serve</span>.</Card>}
        {aiSupported() && !cam && <Btn className="w-full" icon="camera" onClick={() => setCam(true)}>{tpl ? 'Enrol again' : 'Enrol my face'}</Btn>}
        {cam && (
          <Card className="space-y-3 p-3">
            <div className="relative overflow-hidden rounded-xl bg-black">
              <video ref={video} muted playsInline className="aspect-[4/3] w-full -scale-x-100 object-cover" />
              <div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="h-[70%] w-[48%] rounded-[50%] border-2 border-dashed border-brand/70" /></div>
            </div>
            {err && <p className="text-xs text-red-700">{err}</p>}
            <AiStatus compact />
            <Btn className="w-full" disabled={!!busy || vision.status !== 'ready'} onClick={go}>{busy || (vision.status === 'ready' ? 'Capture' : 'Loading AI…')}</Btn>
            <Btn v="outline" className="w-full" onClick={() => setCam(false)}>Cancel</Btn>
          </Card>
        )}
        {res && !res.ok && <Card className="bg-red-50 ring-red-200"><div className="text-sm font-semibold text-red-700">Try again</div><ul className="mt-1 list-disc pl-5 text-xs text-slate-700">{res.problems.map((p) => <li key={p}>{p}</li>)}</ul></Card>}
      </div>
    </div>
  );
}

// Real gate check with this phone's camera: 1:1 face match + anti-spoof + liveness.
export function GateCheckSheet({ onClose }) {
  useVision();
  const { s, mutate } = useApp();
  const stateDir = useRef(s.gate.dir);
  stateDir.current = s.gate.dir;
  const [video, err] = useSelfCam(true);
  const [busy, setBusy] = useState(null);
  const [res, setRes] = useState(null);
  const go = async () => {
    setRes(null); setBusy('Checking…');
    try {
      const r = await verify(video.current, STUDENT.id, (i) => setBusy(`Frame ${i}/3…`));
      const dir = r.ok ? (stateDir.current === 'IN' ? 'OUT' : 'IN') : null;
      mutate((d) => { gateFaceResult(d, r); toast(d, 'guard', r.ok ? `Gate face check: ${STUDENT.id} matched 1:1 (${(r.sim * 100).toFixed(0)}%)` : r.decision === 'MANUAL CHECK' ? `Gate: ${STUDENT.id} needs a manual ID check (${(r.sim * 100).toFixed(0)}%)` : `Gate face check rejected: ${r.reasons[0]}`, r.ok ? 'success' : 'alert'); });
      setRes({ ...r, dir });
    } catch (e) { setRes({ ok: false, decision: 'ERROR', reasons: [e.message] }); }
    setBusy(null);
  };
  const pct = (v) => `${(v * 100).toFixed(0)}%`;
  return (
    <Sheet title="Live gate check" onClose={onClose} tall>
      <div className="relative overflow-hidden rounded-2xl bg-black">
        <video ref={video} muted playsInline className="aspect-[4/3] w-full -scale-x-100 object-cover" />
        <div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="h-[70%] w-[48%] rounded-[50%] border-2 border-dashed border-brand/70" /></div>
        {busy && <div className="scanline" />}
      </div>
      {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
      <div className="mt-3"><AiStatus compact /></div>
      {res && (
        <div className={cls('fade-up mt-3 rounded-2xl p-3 ring-1', res.ok ? 'bg-emerald-50 ring-emerald-200' : res.decision === 'MANUAL CHECK' ? 'bg-amber-50 ring-amber-200' : 'bg-red-50 ring-red-200')}>
          <div className={cls('font-display text-lg font-bold uppercase', res.ok ? 'text-emerald-700' : res.decision === 'MANUAL CHECK' ? 'text-amber-700' : 'text-red-700')}>{res.ok ? `Match · entry ${res.dir}` : res.decision}</div>
          {res.sim !== undefined && (
            <div className="mt-2 grid grid-cols-3 gap-2 text-center font-mono text-xs">
              <div className="rounded-lg bg-card p-2 ring-1 ring-line"><div className="text-slate-500">1:1 match</div><div className="text-base font-bold text-slate-900">{pct(res.sim)}</div><div className="text-[10px] text-slate-500">need {pct(THRESHOLDS.match)}</div></div>
              <div className="rounded-lg bg-card p-2 ring-1 ring-line"><div className="text-slate-500">Anti-spoof</div><div className="text-base font-bold text-slate-900">{pct(res.real)}</div><div className="text-[10px] text-slate-500">need {pct(THRESHOLDS.real)}</div></div>
              <div className="rounded-lg bg-card p-2 ring-1 ring-line"><div className="text-slate-500">Liveness</div><div className="text-base font-bold text-slate-900">{pct(res.live)}</div><div className="text-[10px] text-slate-500">need {pct(THRESHOLDS.live)}</div></div>
            </div>
          )}
          {!res.ok && <ul className="mt-2 list-disc pl-5 text-xs text-slate-700">{res.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
        </div>
      )}
      <Btn className="mt-3 w-full" icon="scan" disabled={!!busy || vision.status !== 'ready'} onClick={go}>{busy || (vision.status === 'ready' ? 'Verify me at the gate' : 'Loading AI…')}</Btn>
      <p className="mt-2 text-center text-[11px] text-slate-500">Compared only with the face enrolled for {STUDENT.id}, on this device.</p>
    </Sheet>
  );
}

export function AiAdminCard() {
  useVision();
  const { s } = useApp();
  const rules = Object.entries(s.ai.byRule).sort((a, b) => b[1] - a[1]);
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Icon name="cpu" className="h-5 w-5 text-brand" /><h3 className="font-display font-bold uppercase tracking-wider text-slate-900">On-device AI</h3></div>
        <AiStatus compact />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[[Object.keys(live).length, 'Live cameras'], [s.ai.events, 'AI events'], [s.ai.gate.filter((g) => g.ok).length + '/' + s.ai.gate.length, 'Gate scans ok']].map(([v, k]) => (
          <div key={k} className="rounded-xl bg-raise px-1 py-2 ring-1 ring-line"><div className="font-mono text-lg font-bold text-slate-900">{v}</div><div className="text-[10px] text-slate-500">{k}</div></div>
        ))}
      </div>
      {rules.length > 0 && <div className="flex flex-wrap gap-1.5">{rules.map(([k, n]) => <Badge key={k} className="bg-brand-100 text-brand">{RULES[k].name} · {n}</Badge>)}</div>}
      {s.ai.gate.slice(0, 3).map((g) => (
        <div key={g.id} className="flex items-center gap-2 text-xs">
          <Icon name={g.ok ? 'checkCircle' : 'xCircle'} className={cls('h-4 w-4', g.ok ? 'text-emerald-700' : 'text-red-700')} />
          <span className="font-mono text-slate-500">{fmtTime(g.time, true)}</span>
          <span className="truncate text-slate-700">{g.cam}: {g.ok ? `valid pass → ${g.dir}` : g.reason}</span>
        </div>
      ))}
      <details className="text-xs text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-800">Models on this device</summary>
        <ul className="mt-2 space-y-1">{MODELS.map((m) => <li key={m.file}><b className="text-slate-800">{m.name}</b> · {m.task} <span className="text-slate-500">({m.pipeline})</span></li>)}</ul>
        <p className="mt-2">Campus cameras never compute face embeddings, so face search is impossible by design. Only a gate computes one, to compare 1:1 with the pass holder.</p>
      </details>
    </Card>
  );
}

