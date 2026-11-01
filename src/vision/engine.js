// On-device AI engine. Everything runs in the browser / Android WebView with the
// models bundled in www/models (Human by @vladmandic: CenterNet, BlazeFace, FaceRes,
// anti-spoof and liveness). No frame, face or embedding ever leaves the device.
//
// Two pipelines, on purpose:
//  - SURVEILLANCE (every campus camera): people/objects + face boxes for blurring.
//    It never computes a face embedding, so face search is impossible by design.
//  - GATE (checkpoint only): face embedding + anti-spoof + liveness for a 1:1 match
//    against the one student who presented their QR pass.

const SURVEILLANCE = {
  face: {
    enabled: true,
    detector: { rotation: false, maxDetected: 20, minConfidence: 0.25, minSize: 0, return: false },
    mesh: { enabled: false }, iris: { enabled: false }, attention: { enabled: false }, emotion: { enabled: false },
    description: { enabled: false }, antispoof: { enabled: false }, liveness: { enabled: false }, gear: { enabled: false },
  },
  object: { enabled: true, modelPath: 'centernet.json', minConfidence: 0.3, maxDetected: 25, iouThreshold: 0.4 },
};

const GATE = {
  face: {
    enabled: true,
    detector: { rotation: false, maxDetected: 3, minConfidence: 0.5, minSize: 0, return: false },
    mesh: { enabled: false }, iris: { enabled: false }, attention: { enabled: false }, emotion: { enabled: false },
    description: { enabled: true, minConfidence: 0.1 }, antispoof: { enabled: true }, liveness: { enabled: true }, gear: { enabled: false },
  },
  object: { enabled: false },
};

const BASE = {
  modelBasePath: 'models/',
  backend: 'webgl',
  debug: false,
  async: true,
  warmup: 'none',
  cacheSensitivity: 0, // every frame is a fresh analysis; no result caching between cameras
  body: { enabled: false }, hand: { enabled: false }, gesture: { enabled: false }, segmentation: { enabled: false },
  filter: { enabled: false },
  ...SURVEILLANCE,
};

export const MODELS = [
  { file: 'centernet', name: 'CenterNet', task: 'People and object detection (COCO)', pipeline: 'Surveillance' },
  { file: 'blazeface', name: 'BlazeFace', task: 'Face boxes, used only to blur faces', pipeline: 'Surveillance + Gate' },
  { file: 'faceres', name: 'FaceRes', task: '1:1 face match at the gate (never 1:N)', pipeline: 'Gate' },
  { file: 'antispoof', name: 'Anti-spoof', task: 'Rejects photos and screens held up to the camera', pipeline: 'Gate' },
  { file: 'liveness', name: 'Liveness', task: 'Checks a live face is present', pipeline: 'Gate' },
];

export const vision = { status: 'idle', backend: null, error: null, loadMs: 0, inferMs: 0, runs: 0 };
const listeners = new Set();
let version = 0;
export const visionVersion = () => version;
export function emitVision() { version += 1; listeners.forEach((f) => f()); }
export function subscribeVision(f) { listeners.add(f); return () => listeners.delete(f); }

// Models are fetched over http(s); a page opened as file:// cannot read them.
export const aiSupported = () => typeof location !== 'undefined' && location.protocol !== 'file:' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

let human = null;
let loading = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.Human) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

export function loadVision() {
  if (human) return Promise.resolve(human);
  if (!loading) {
    loading = (async () => {
      if (location.protocol === 'file:') throw new Error('On-device AI needs the app or a local server (npm run serve), not a file:// page.');
      vision.status = 'loading'; vision.error = null; emitVision();
      const t0 = performance.now();
      await loadScript('vendor/human.js');
      const H = new window.Human.Human(BASE);
      await H.load();
      // Warm the GPU kernels once so the first real frame is not slow.
      const warm = document.createElement('canvas'); warm.width = 256; warm.height = 144;
      await H.detect(warm, SURVEILLANCE);
      vision.loadMs = Math.round(performance.now() - t0);
      vision.backend = H.tf.getBackend();
      vision.status = 'ready';
      human = H;
      emitVision();
      return H;
    })().catch((e) => {
      vision.status = 'error'; vision.error = e.message || String(e); loading = null; emitVision();
      throw e;
    });
  }
  return loading;
}

// One inference at a time across all cameras keeps the GPU predictable on phones.
let queue = Promise.resolve();
function run(input, cfg) {
  const job = queue.then(async () => {
    const H = await loadVision();
    const t0 = performance.now();
    const r = await H.detect(input, cfg);
    const ms = performance.now() - t0;
    vision.inferMs = vision.runs ? Math.round(vision.inferMs * 0.8 + ms * 0.2) : Math.round(ms);
    vision.runs += 1;
    return r;
  });
  queue = job.catch(() => {});
  return job;
}

export const detectScene = (input) => run(input, SURVEILLANCE);
export const detectGateFace = (input) => run(input, GATE);
export const similarity = (a, b) => (human ? human.match.similarity(a, b) : 0);
