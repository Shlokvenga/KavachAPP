// Real cameras: binds a webcam / phone camera to a campus camera slot (e.g. CAM-B1),
// runs the on-device AI on it and renders the view with the AI overlay (tracked
// people and objects, rule lines, status). Snapshots for alerts come from this view.
// When paired with the hub, the view is also sent there so guard phones and the
// laptop console can watch it (see shareFrames below).
//
// Compute budget ("coverage to compute"): a camera in WATCH runs the model only
// when the picture changes; a camera covering an open alert switches to
// INVESTIGATE and analyses several frames per second.
import jsQR from 'jsqr';
import { CAMERAS } from '../campus.js';
import { detectScene, emitVision, loadVision, vision } from './engine.js';
import { createAnalyzer } from './rules.js';
import { center, speed } from './tracker.js';

export const live = {}; // camId -> slot
let hooks = { onEvent: () => {}, onQr: () => {}, ctx: () => ({}) };
export function configureLive(h) { hooks = { ...hooks, ...h }; }
export const isLive = (camId) => !!live[camId];

const W = 640;
const H = 360;
const TRACKED = new Set(['person', 'backpack', 'handbag', 'suitcase', 'laptop']);

export async function listCameras() {
  // Labels are only visible after the first permission grant.
  try { const s = await navigator.mediaDevices.getUserMedia({ video: true }); s.getTracks().forEach((t) => t.stop()); } catch (e) { throw new Error(e.name === 'NotAllowedError' ? 'Camera permission was denied.' : 'No camera found.'); }
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === 'videoinput').map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` }));
}

export async function bindCamera(camId, device) {
  unbindCamera(camId);
  for (const k of Object.keys(live)) if (live[k].deviceId === device.id) unbindCamera(k);
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: device.id ? { exact: device.id } : undefined, width: { ideal: W }, height: { ideal: H } },
    audio: false,
  });
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.srcObject = stream;
  await video.play();
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const cam = CAMERAS.find((c) => c.id === camId);
  const slot = {
    camId, cam, deviceId: device.id, label: device.label, stream, video,
    raw: mk(W, H), out: mk(W, H), infer: mk(W, H), small: mk(64, 36),
    analyzer: createAnalyzer(cam),
    faces: [], tracks: [], flagged: {}, prevSmall: null,
    stats: { fps: 0, people: 0, objects: 0, mode: 'WATCH', motion: 0, inferMs: 0, lastInfer: 0, events: 0, qr: null },
    busy: false, running: true, frames: 0, fpsT: performance.now(), lastStats: 0, lastQr: 0,
  };
  live[camId] = slot;
  stream.getVideoTracks()[0].addEventListener('ended', () => unbindCamera(camId));
  loadVision().catch(() => {});
  loop(slot);
  ensureTicker();
  emitVision();
  return slot;
}

export function unbindCamera(camId) {
  const s = live[camId];
  if (!s) return;
  s.running = false;
  s.stream.getTracks().forEach((t) => t.stop());
  delete live[camId];
  emitVision();
}

let ticker = null;
function ensureTicker() {
  if (ticker) return;
  ticker = setInterval(() => { if (Object.keys(live).length) emitVision(); }, 1000);
}

function frameStats(slot) {
  const c = slot.small.getContext('2d', { willReadFrequently: true });
  c.drawImage(slot.raw, 0, 0, 64, 36);
  const d = c.getImageData(0, 0, 64, 36).data;
  const n = 64 * 36;
  const y = new Float32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) { y[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; sum += y[i]; }
  const mean = sum / n;
  let v = 0; let lap = 0; let lapN = 0; let motion = 0;
  for (let i = 0; i < n; i++) v += (y[i] - mean) ** 2;
  for (let r = 1; r < 35; r++) for (let q = 1; q < 63; q++) {
    const i = r * 64 + q;
    const l = 4 * y[i] - y[i - 1] - y[i + 1] - y[i - 64] - y[i + 64];
    lap += l * l; lapN += 1;
  }
  if (slot.prevSmall) { for (let i = 0; i < n; i++) motion += Math.abs(y[i] - slot.prevSmall[i]); motion /= n; }
  slot.prevSmall = y;
  const thumb = new Float32Array(64);
  for (let i = 0; i < n; i++) { const r = Math.floor(i / 64); const q = i % 64; thumb[Math.floor(r / 4.5) * 8 + Math.floor(q / 8)] += y[i] / 36; }
  return { mean, std: Math.sqrt(v / n), sharp: lap / lapN, motion, thumb };
}

function behaviour(tr) {
  if (tr.label !== 'person') return tr.label;
  const v = speed(tr, 0.8);
  return v > 1.8 ? 'running' : v > 0.25 ? 'walking' : 'still';
}

function render(slot, t) {
  const ctx = slot.out.getContext('2d');
  ctx.drawImage(slot.raw, 0, 0, W, H);
  const line = slot.analyzer.cfg.line;
  const E = slot.analyzer.cfg.enabled;
  if (line && (E.intrusion || E.tailgate || E.asset)) {
    ctx.save(); ctx.setLineDash([10, 8]); ctx.strokeStyle = 'rgba(245,158,11,.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(line[0] * W, line[1] * H); ctx.lineTo(line[2] * W, line[3] * H); ctx.stroke(); ctx.restore();
  }
  ctx.font = '600 13px "IBM Plex Mono", monospace';
  for (const tr of slot.tracks) {
    if (tr.hits < 2) continue;
    const [x, y, w, h] = tr.box;
    const hot = slot.flagged[tr.id] && t - slot.flagged[tr.id] < 12;
    const col = hot ? '#F43F5E' : tr.label === 'person' ? '#00e5ff' : '#f59e0b';
    ctx.strokeStyle = col; ctx.lineWidth = hot ? 3 : 2;
    ctx.strokeRect(x * W, y * H, w * W, h * H);
    const tag = `#${tr.id} ${behaviour(tr)}`;
    const tw = ctx.measureText(tag).width + 10;
    ctx.fillStyle = col; ctx.fillRect(x * W, Math.max(0, y * H - 18), tw, 18);
    ctx.fillStyle = '#05090d'; ctx.fillText(tag, x * W + 5, Math.max(13, y * H - 5));
  }
  // HUD
  ctx.fillStyle = 'rgba(5,9,13,.7)'; ctx.fillRect(0, H - 24, W, 24);
  ctx.fillStyle = slot.stats.mode === 'INVESTIGATE' ? '#F43F5E' : '#00e5ff';
  const st = slot.stats;
  const aiTxt = vision.status === 'ready' ? `${st.people} people · ${st.inferMs} ms` : vision.status === 'error' ? 'AI unavailable' : 'AI loading';
  ctx.fillText(`${st.mode} · ${st.fps} fps · ${aiTxt}`, 8, H - 8);
}

async function infer(slot, t, stats) {
  slot.busy = true;
  try {
    slot.infer.getContext('2d').drawImage(slot.raw, 0, 0);
    const t0 = performance.now();
    const r = await detectScene(slot.infer);
    slot.stats.inferMs = Math.round(performance.now() - t0);
    const dets = r.object.filter((o) => TRACKED.has(o.label)).map((o) => ({ label: o.label, score: o.score, box: [o.box[0] / W, o.box[1] / H, o.box[2] / W, o.box[3] / H] }));
    slot.faces = r.face.map((f) => [f.box[0] / W, f.box[1] / H, f.box[2] / W, f.box[3] / H]);
    const res = slot.analyzer.analyze(dets, t, stats, hooks.ctx());
    slot.tracks = res.tracks;
    slot.stats.people = res.tracks.filter((x) => x.label === 'person' && x.hits >= 2).length;
    slot.stats.objects = res.tracks.length;
    slot.stats.lastInfer = t;
    for (const ev of res.events) {
      ev.ids.forEach((id) => { slot.flagged[id] = t; });
      render(slot, t);
      const snap = document.createElement('canvas'); snap.width = 320; snap.height = 180;
      snap.getContext('2d').drawImage(slot.out, 0, 0, 320, 180);
      slot.stats.events += 1;
      hooks.onEvent(slot.camId, ev, snap.toDataURL('image/jpeg', 0.7));
    }
  } catch (e) {
    // AI not available: keep tamper detection running on image statistics alone
    const res = slot.analyzer.analyze([], t, stats, hooks.ctx());
    for (const ev of res.events) hooks.onEvent(slot.camId, ev, null);
  } finally {
    slot.busy = false;
  }
}

function loop(slot) {
  const step = () => {
    if (!slot.running) return;
    const v = slot.video;
    if (v.readyState >= 2 && v.videoWidth) {
      // cover-fit the camera into 16:9
      const sr = v.videoWidth / v.videoHeight; const dr = W / H;
      let sw = v.videoWidth; let sh = v.videoHeight; let sx = 0; let sy = 0;
      if (sr > dr) { sw = sh * dr; sx = (v.videoWidth - sw) / 2; } else { sh = sw / dr; sy = (v.videoHeight - sh) / 2; }
      slot.raw.getContext('2d').drawImage(v, sx, sy, sw, sh, 0, 0, W, H);
      const t = performance.now() / 1000;
      slot.frames += 1;
      if (t * 1000 - slot.fpsT >= 1000) { slot.stats.fps = slot.frames; slot.frames = 0; slot.fpsT = t * 1000; }
      const ctx = hooks.ctx();
      slot.stats.mode = ctx.investigate && ctx.investigate(slot.camId) ? 'INVESTIGATE' : 'WATCH';
      if (t - slot.lastStats >= 0.25) {
        slot.lastStats = t;
        slot.lastFrameStats = frameStats(slot);
        slot.stats.motion = Math.round(slot.lastFrameStats.motion * 10) / 10;
      }
      const fs = slot.lastFrameStats;
      const gap = slot.stats.mode === 'INVESTIGATE' ? 0.15 : fs && fs.motion > 1.2 ? 0.4 : 1.5;
      if (!slot.busy && fs && t - (slot.stats.lastInfer || slot.lastTry || 0) >= gap) {
        slot.lastTry = t;
        if (vision.status === 'ready') infer(slot, t, fs);
        else { const res = slot.analyzer.analyze([], t, fs, ctx); for (const ev of res.events) hooks.onEvent(slot.camId, ev, null); }
      }
      if (slot.cam.scene === 'gate' && t - slot.lastQr >= 0.5) {
        slot.lastQr = t;
        const img = slot.raw.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H);
        const hit = jsQR(img.data, W, H, { inversionAttempts: 'dontInvert' });
        if (hit && hit.data && hit.data !== slot.stats.qr) { slot.stats.qr = hit.data; hooks.onQr(slot.camId, hit.data, slot); setTimeout(() => { if (slot.stats.qr === hit.data) slot.stats.qr = null; }, 8000); }
      }
      render(slot, t);
    }
    if (slot.video.requestVideoFrameCallback) slot.video.requestVideoFrameCallback(step);
    else requestAnimationFrame(step);
  };
  step();
}

export const liveCount = () => Object.keys(live).length;

// A frame from any connected camera at a checkpoint (for Saathi Walk
// check-ins). Returns null when no real camera is connected there.
export function snapshotAt(cp) {
  const s = Object.values(live).find((x) => x.cam.cp === cp && x.stats.lastInfer);
  if (!s) return null;
  const c = document.createElement('canvas'); c.width = 320; c.height = 180;
  c.getContext('2d').drawImage(s.out, 0, 0, 320, 180);
  return c.toDataURL('image/jpeg', 0.7);
}
export const liveAt = (cp) => Object.values(live).filter((x) => x.cam.cp === cp).map((x) => x.camId);
export { center };

// Send each connected camera's live view to the hub, so guard phones and the
// console can watch it: about 6 frames a second while someone is watching that
// camera, and one every 2 s otherwise (for the camera wall thumbnails).
export function shareFrames({ url, key }) {
  let stopped = false;
  const q = key ? `&key=${encodeURIComponent(key)}` : '';
  const send = (slot) => {
    slot.sharing = true;
    slot.out.toBlob(async (blob) => {
      let next = 2000;
      try {
        if (blob && !stopped) {
          const r = await fetch(`${url}/api/frame?cam=${encodeURIComponent(slot.camId)}${q}`, { method: 'POST', body: blob, headers: { 'content-type': 'image/jpeg' }, cache: 'no-store' });
          const j = await r.json().catch(() => ({}));
          if (j.watchers > 0) next = 160;
        }
      } catch (e) { next = 4000; /* hub unreachable: try again later */ }
      slot.shareNext = performance.now() + next;
      slot.sharing = false;
    }, 'image/jpeg', 0.6);
  };
  const timer = setInterval(() => {
    const now = performance.now();
    for (const slot of Object.values(live)) if (!slot.sharing && now >= (slot.shareNext || 0) && slot.frames + slot.stats.fps > 0) send(slot);
  }, 80);
  return () => { stopped = true; clearInterval(timer); };
}
