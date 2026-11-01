// Gate face check: enrol once on the student's own phone, then a strict 1:1
// comparison at the checkpoint against the ONE student whose QR pass was shown.
// There is no gallery and no search: the gate never asks "who is this?", only
// "is this the person on this pass?".
// The template is a list of numbers (no photo) kept in this device's storage.
import { detectGateFace, loadVision, similarity } from './engine.js';

// Calibrated on 55 faces (different people scored up to 0.59; the same person had
// a median of 0.87). Between `review` and `match` the gate asks a guard to check the
// ID card instead of deciding by itself: a false accept is worse than a slower entry.
// Re-calibrate with consented campus data before real use.
export const THRESHOLDS = { match: 0.65, review: 0.5, real: 0.5, live: 0.5, minFacePx: 70 };
const KEY = (id) => `kavach-face-${id}`;

export function loadTemplate(studentId) {
  try { const v = JSON.parse(localStorage.getItem(KEY(studentId)) || 'null'); return v && Array.isArray(v.embedding) ? v : null; } catch (e) { return null; }
}
export function saveTemplate(studentId, t) {
  try { localStorage.setItem(KEY(studentId), JSON.stringify(t)); return true; } catch (e) { return false; }
}
export function deleteTemplate(studentId) { try { localStorage.removeItem(KEY(studentId)); } catch (e) { /* ignore */ } }

function grab(video) {
  const c = document.createElement('canvas');
  c.width = video.videoWidth || 640; c.height = video.videoHeight || 480;
  c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
  return c;
}

// Reads `frames` frames and keeps the largest face in each.
async function sample(video, frames, onProgress) {
  await loadVision();
  const got = [];
  for (let i = 0; i < frames; i++) {
    const r = await detectGateFace(grab(video));
    const faces = r.face.filter((f) => f.embedding && f.embedding.length);
    onProgress && onProgress(i + 1, faces.length);
    if (faces.length) {
      const f = faces.sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3])[0];
      got.push({ emb: f.embedding, real: f.real ?? 0, live: f.live ?? 0, score: f.score, size: Math.min(f.box[2], f.box[3]), count: faces.length });
    }
    await new Promise((res) => setTimeout(res, 180));
  }
  return got;
}

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

export async function enrol(video, studentId, onProgress) {
  const got = await sample(video, 4, onProgress);
  const problems = [];
  if (got.length < 3) problems.push('Face not found clearly. Face the camera in good light.');
  if (got.some((g) => g.count > 1)) problems.push('More than one face in view. Only you should be in the frame.');
  if (got.length && avg(got.map((g) => g.size)) < THRESHOLDS.minFacePx) problems.push('Move closer so your face fills more of the frame.');
  const real = avg(got.map((g) => g.real));
  if (got.length && real < THRESHOLDS.real) problems.push('This looks like a photo or a screen, not a live face.');
  if (problems.length) return { ok: false, problems };
  const n = got[0].emb.length;
  const emb = new Array(n).fill(0);
  for (const g of got) for (let i = 0; i < n; i++) emb[i] += g.emb[i] / got.length;
  const template = { embedding: emb.map((v) => +v.toFixed(5)), enrolledAt: Date.now(), samples: got.length, quality: +avg(got.map((g) => g.score)).toFixed(2) };
  saveTemplate(studentId, template);
  return { ok: true, template, real: +real.toFixed(2) };
}

export async function verify(video, studentId, onProgress) {
  const template = loadTemplate(studentId);
  if (!template) return { ok: false, decision: 'NOT ENROLLED', reasons: ['No face enrolled for this ID. Enrol in Profile → Face check first.'] };
  const got = await sample(video, 3, onProgress);
  if (!got.length) return { ok: false, decision: 'NO FACE', reasons: ['No face seen. Look at the camera.'] };
  const best = got.map((g) => ({ ...g, sim: similarity(template.embedding, g.emb) })).sort((a, b) => b.sim - a.sim)[0];
  const real = avg(got.map((g) => g.real));
  const live = avg(got.map((g) => g.live));
  const reasons = [];
  const uncertain = best.sim >= THRESHOLDS.review && best.sim < THRESHOLDS.match;
  if (uncertain) reasons.push(`Face match uncertain (${(best.sim * 100).toFixed(0)}%). Guard to check the ID card`);
  else if (best.sim < THRESHOLDS.match) reasons.push(`Face does not match this pass (similarity ${(best.sim * 100).toFixed(0)}%, needs ${THRESHOLDS.match * 100}%)`);
  if (real < THRESHOLDS.real) reasons.push(`Anti-spoof failed (${(real * 100).toFixed(0)}%): photo or screen suspected`);
  if (live < THRESHOLDS.live) reasons.push(`Liveness failed (${(live * 100).toFixed(0)}%)`);
  if (got.some((g) => g.count > 1)) reasons.push('Several faces in view; only the pass holder should be at the gate');
  const ok = reasons.length === 0;
  const decision = ok ? 'MATCH' : uncertain && reasons.length === 1 ? 'MANUAL CHECK' : 'REJECTED';
  return { ok, decision, sim: best.sim, real, live, reasons };
}
