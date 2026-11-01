// Pairing a phone with the laptop hub, and the small sync status chip.
import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { cls } from './data.js';
import { useApp } from './ctx.js';
import { cleanUrl, pairHub, parsePairText } from './sync.js';
import { Btn, Icon, Sheet } from './ui.jsx';

const NAME_KEY = 'kavach-device-name';
export const loadDeviceName = (fallback) => { try { return localStorage.getItem(NAME_KEY) || fallback; } catch (e) { return fallback; } };
const saveDeviceName = (n) => { try { localStorage.setItem(NAME_KEY, n); } catch (e) { /* ignore */ } };

const STATUS = {
  local: ['Stand-alone', 'bg-white/10 text-slate-300', 'bg-slate-400'],
  connecting: ['Connecting…', 'bg-amber-500/15 text-amber-300', 'bg-amber-400'],
  online: ['Synced', 'bg-emerald-500/15 text-emerald-300', 'bg-emerald-400'],
  offline: ['Hub offline', 'bg-red-500/15 text-red-300', 'bg-red-400'],
  unpaired: ['Unpaired', 'bg-red-500/15 text-red-300', 'bg-red-400'],
};

export function SyncChip({ onClick, className }) {
  const { sync, pairing } = useApp();
  const [label, tone, dot] = STATUS[sync.status] || STATUS.local;
  return (
    <button type="button" onClick={onClick} title={pairing ? `Hub: ${pairing.url}` : 'Not paired with a laptop hub'}
      className={cls('flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider', tone, className)}>
      <span className={cls('h-1.5 w-1.5 rounded-full', dot, sync.status === 'online' && 'blink')} />
      {label}{sync.pending > 0 ? ` · ${sync.pending} to send` : ''}
    </button>
  );
}

function QrScanner({ onText, onError }) {
  const video = useRef(null);
  useEffect(() => {
    let stream; let raf; let stopped = false;
    const cv = document.createElement('canvas');
    const g = cv.getContext('2d', { willReadFrequently: true });
    const scan = () => {
      if (stopped) return;
      const v = video.current;
      if (v && v.videoWidth) {
        const w = 480; const h = Math.round((v.videoHeight / v.videoWidth) * w);
        cv.width = w; cv.height = h; g.drawImage(v, 0, 0, w, h);
        const hit = jsQR(g.getImageData(0, 0, w, h).data, w, h);
        if (hit && hit.data) { onText(hit.data); return; }
      }
      raf = requestAnimationFrame(scan);
    };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { onError('This browser cannot use the camera here. Type the address and code instead.'); return undefined; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => { stream = s; if (video.current) { video.current.srcObject = s; video.current.play().catch(() => {}); } scan(); })
      .catch(() => onError('Camera not available. Type the address and code instead.'));
    return () => { stopped = true; cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach((t) => t.stop()); };
  }, [onText, onError]);
  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video ref={video} playsInline muted className="aspect-square w-full object-cover" />
      <div className="pointer-events-none absolute inset-[18%] rounded-2xl ring-2 ring-brand" />
      <div className="absolute inset-x-0 bottom-2 text-center font-mono text-[10px] font-bold uppercase tracking-widest text-brand">Point at the QR on the laptop</div>
    </div>
  );
}

// `initial` can carry { url, key } from a scanned link (?pair=…)
export function PairSheet({ onClose, initial }) {
  const { pair, unpair, pairing, sync, role } = useApp();
  const sameOrigin = /^https?:$/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname) ? location.origin : '';
  const [url, setUrl] = useState((initial && initial.url) || (pairing && pairing.url) || sameOrigin);
  const [code, setCode] = useState((initial && initial.key) || '');
  const [name, setName] = useState(loadDeviceName(role === 'guard' ? 'Guard phone' : 'Student phone'));
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const go = async (u = url, c = code) => {
    setErr(null); setBusy(true);
    try {
      const nm = name.trim() || 'Phone';
      saveDeviceName(nm);
      const p = await pairHub(u, c, { name: nm, kind: 'phone' });
      pair(p);
      onClose();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const onText = (t) => {
    const p = parsePairText(t);
    setScan(false);
    if (!p) { setErr('That QR is not a Kavach pairing code. Use the one on the laptop\'s Setup page.'); return; }
    setUrl(p.url); setCode(p.key);
    go(p.url, p.key);
  };
  // auto-pair from a scanned link once
  const auto = useRef(false);
  useEffect(() => { if (initial && initial.key && !auto.current) { auto.current = true; go(initial.url, initial.key); } });

  const input = 'mt-1 w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-brand';
  return (
    <Sheet onClose={onClose} title="Connect to the campus hub" tall>
      {pairing && (
        <div className="mb-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Icon name="checkCircle" className="h-4 w-4 text-emerald-500" />Paired with {pairing.hub || 'hub'}</div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-500">{pairing.url} · {STATUS[sync.status] ? STATUS[sync.status][0] : sync.status}</div>
          {sync.detail && sync.status !== 'online' && <div className="mt-1 text-[11px] text-red-500">{sync.detail}</div>}
          <Btn v="outline" size="sm" className="mt-2 w-full" icon="logout" onClick={() => { unpair(); onClose(); }}>Unpair, use this phone stand-alone</Btn>
        </div>
      )}
      <p className="text-sm text-slate-600">On the security laptop, open <b>Setup</b> in the Kavach console. Scan its QR code, or type the address and the 6-digit code. The phone and laptop must be on the same Wi-Fi.</p>
      {scan ? (
        <div className="mt-3">
          <QrScanner onText={onText} onError={(m) => { setScan(false); setErr(m); }} />
          <Btn v="outline" size="sm" className="mt-2 w-full" onClick={() => setScan(false)}>Type it instead</Btn>
        </div>
      ) : (
        <Btn v="accent" className="mt-3 w-full" icon="qr" onClick={() => { setErr(null); setScan(true); }}>Scan pairing QR</Btn>
      )}
      <div className="mt-4 space-y-3">
        <label className="block text-xs font-semibold text-slate-600">Hub address
          <input className={input} value={url} onChange={(e) => setUrl(e.target.value)} onBlur={() => setUrl(cleanUrl(url) || url)} placeholder="192.168.1.20:8787" inputMode="url" autoCapitalize="off" autoCorrect="off" />
        </label>
        <label className="block text-xs font-semibold text-slate-600">Pairing code
          <input className={cls(input, 'font-mono tracking-[.3em]')} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" inputMode="numeric" />
        </label>
        <label className="block text-xs font-semibold text-slate-600">This phone's name (shown on the laptop)
          <input className={input} value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="Gate guard phone" />
        </label>
      </div>
      {err && <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{err}</div>}
      <Btn className="mt-4 w-full" disabled={busy || !url || code.length !== 6} onClick={() => go()}>{busy ? 'Connecting…' : 'Connect'}</Btn>
      <p className="mt-3 text-[11px] text-slate-500">Without a hub the phone works on its own (demo mode). Once paired, alerts, walks and gate scans are shared live with the laptop and other phones. If the Wi-Fi drops, actions wait on the phone and are sent when it is back.</p>
    </Sheet>
  );
}
