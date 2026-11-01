// Anonymous multi-object tracker. Each detection gets a short-lived number (#12)
// so behaviour can be followed across frames; there is no identity, no face and
// nothing is kept once the person leaves the view.
// Boxes are normalised [x, y, w, h] in 0..1 of the frame.

const iou = (a, b) => {
  const x1 = Math.max(a[0], b[0]); const y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[0] + a[2], b[0] + b[2]); const y2 = Math.min(a[1] + a[3], b[1] + b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const uni = a[2] * a[3] + b[2] * b[3] - inter;
  return uni > 0 ? inter / uni : 0;
};
export const center = (b) => [b[0] + b[2] / 2, b[1] + b[3] / 2];
export const foot = (b) => [b[0] + b[2] / 2, b[1] + b[3]];

const HISTORY_S = 12;
const MAX_MISSES_S = 1.5;

export class Tracker {
  constructor() { this.tracks = []; this.nextId = 1; }

  // dets: [{ box, label, score }], t: seconds
  update(dets, t) {
    const unmatched = new Set(dets.map((_, i) => i));
    const pairs = [];
    for (const tr of this.tracks) {
      for (const i of unmatched) {
        const d = dets[i];
        if (d.label !== tr.label) continue;
        const o = iou(tr.box, d.box);
        const [cx, cy] = center(tr.box); const [dx, dy] = center(d.box);
        const near = Math.hypot(cx - dx, cy - dy) < Math.max(tr.box[3], d.box[3]) * 0.7;
        if (o > 0.15 || near) pairs.push([o + (near ? 0.1 : 0), tr, i]);
      }
    }
    pairs.sort((a, b) => b[0] - a[0]);
    const used = new Set();
    for (const [, tr, i] of pairs) {
      if (used.has(tr) || !unmatched.has(i)) continue;
      used.add(tr); unmatched.delete(i);
      const d = dets[i];
      // light smoothing keeps boxes steady without lagging fast movement
      tr.box = tr.box.map((v, k) => v * 0.35 + d.box[k] * 0.65);
      tr.score = d.score; tr.last = t; tr.hits += 1;
      tr.hist.push({ t, box: [...tr.box] });
    }
    for (const i of unmatched) {
      const d = dets[i];
      this.tracks.push({ id: this.nextId++, label: d.label, box: [...d.box], score: d.score, first: t, last: t, hits: 1, hist: [{ t, box: [...d.box] }], side: {}, tags: {} });
    }
    this.tracks = this.tracks.filter((tr) => t - tr.last <= MAX_MISSES_S);
    for (const tr of this.tracks) {
      while (tr.hist.length > 2 && t - tr.hist[0].t > HISTORY_S) tr.hist.shift();
    }
    return this.tracks;
  }

  // Confirmed tracks only (seen at least twice), to ignore one-frame false positives.
  live(label) { return this.tracks.filter((tr) => tr.hits >= 2 && (!label || tr.label === label)); }
}

// Speed in body-lengths per second over the last `win` seconds (scale-free across cameras).
export function speed(tr, win = 1) {
  const h = tr.hist;
  if (h.length < 2) return 0;
  const end = h[h.length - 1];
  let start = h[0];
  for (let i = h.length - 1; i >= 0; i--) { if (end.t - h[i].t >= win) { start = h[i]; break; } }
  const dt = end.t - start.t;
  if (dt < 0.25) return 0;
  const [x1, y1] = center(start.box); const [x2, y2] = center(end.box);
  const body = Math.max(0.05, (start.box[3] + end.box[3]) / 2);
  return Math.hypot(x2 - x1, y2 - y1) / body / dt;
}

export function heading(tr, win = 1.5) {
  const h = tr.hist;
  if (h.length < 2) return [0, 0];
  const end = h[h.length - 1];
  let start = h[0];
  for (let i = h.length - 1; i >= 0; i--) { if (end.t - h[i].t >= win) { start = h[i]; break; } }
  const [x1, y1] = center(start.box); const [x2, y2] = center(end.box);
  const n = Math.hypot(x2 - x1, y2 - y1) || 1;
  return [(x2 - x1) / n, (y2 - y1) / n];
}

// Spread of the centre over the last `win` seconds, relative to body height.
// Returns Infinity (no decision) without enough evidence: at least 4 samples
// covering most of the window, so a slow device cannot fake "standing still".
export function wander(tr, win = 8) {
  const end = tr.hist[tr.hist.length - 1];
  const recent = tr.hist.filter((p) => end.t - p.t <= win);
  if (recent.length < 4 || end.t - recent[0].t < win * 0.6) return Infinity;
  const pts = recent.map((p) => center(p.box));
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / Math.max(0.05, tr.box[3]);
}
