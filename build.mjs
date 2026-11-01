// Builds both editions.
//
// Phone edition (Student + Guard) → www/   (the Android app and the phone web app)
//   www/index.html                      self-contained app (React, styles, fonts inlined)
//   www/vendor/human.js, www/models/    on-device AI runtime and model weights
//
// Laptop edition (Admin console + hub) → dist/kavach-laptop/   (zip this folder)
//   hub.mjs                             the hub server (Node 18+, no other dependencies)
//   app/index.html                      admin console (served to the laptop itself only)
//   app/phone.html                      phone edition, for phones that open the hub in a browser
//   app/twin.js                         CesiumJS digital twin, loaded on demand
//   app/vendor/, app/models/            on-device AI for laptop webcams
//   start-windows.bat, start-mac.command, start-linux.sh, README.txt
//
// Usage: npm run build   (or: npm run watch)
import * as esbuild from 'esbuild';
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const r = (...p) => path.join(root, ...p);
const PHONE = r('www');
const LAPTOP = r('dist', 'kavach-laptop');
const LAPTOP_APP = path.join(LAPTOP, 'app');
const common = { bundle: true, minify: true, write: false, format: 'iife', target: ['es2020'], logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' } };
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

function fontFaces() {
  const face = (family, file, style) => {
    const b64 = readFileSync(r('node_modules', file)).toString('base64');
    return `@font-face{font-family:'${family}';font-style:${style};font-display:swap;font-weight:100 900;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  };
  return [
    face('Plus Jakarta Sans Variable', '@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2', 'normal'),
    face('Space Grotesk Variable', '@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2', 'normal'),
    face('JetBrains Mono Variable', '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2', 'normal'),
  ].join('');
}

let cssCache = null;
function css() {
  if (!cssCache) cssCache = fontFaces() + execFileSync(process.execPath, [r('node_modules/tailwindcss/lib/cli.js'), '-c', r('tailwind.config.cjs'), '-i', r('src/styles.css'), '--minify'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return cssCache;
}

async function page(entry, title) {
  const js = await esbuild.build({ ...common, entryPoints: [r('src', entry)], jsx: 'automatic', loader: { '.webp': 'dataurl' } });
  const tpl = readFileSync(r('src/index.template.html'), 'utf8');
  // Function replacers keep `$` sequences in the bundle verbatim.
  return tpl
    .replace('<title>Kavach · Campus Safety</title>', () => `<title>${title}</title>`)
    .replace('/*__CSS__*/', () => css())
    .replace('/*__JS__*/', () => js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
}

async function buildTwin() {
  const js = await esbuild.build({ ...common, entryPoints: [r('src/twin.js')] });
  writeFileSync(path.join(LAPTOP_APP, 'twin.js'), js.outputFiles[0].text);
  return js.outputFiles[0].text.length;
}

async function buildHub() {
  await esbuild.build({
    entryPoints: [r('hub/server.js')], bundle: true, platform: 'node', format: 'esm', target: ['node18'],
    outfile: path.join(LAPTOP, 'hub.mjs'), logLevel: 'error', minify: false, legalComments: 'none',
    banner: { js: '// Kavach hub. Built from hub/server.js. Run: node hub.mjs' },
  });
}

// On-device AI: Human runtime and only the five models Kavach uses (~19 MB).
const AI_MODELS = ['centernet', 'blazeface', 'faceres', 'antispoof', 'liveness'];
const copy = (from, to) => {
  if (existsSync(to) && statSync(to).size === statSync(from).size) return;
  copyFileSync(from, to);
};
function copyAi(out) {
  const src = r('node_modules/@vladmandic/human');
  mkdirSync(path.join(out, 'vendor'), { recursive: true });
  mkdirSync(path.join(out, 'models'), { recursive: true });
  copy(path.join(src, 'dist/human.js'), path.join(out, 'vendor/human.js'));
  for (const m of AI_MODELS) for (const ext of ['json', 'bin']) copy(path.join(src, 'models', `${m}.${ext}`), path.join(out, 'models', `${m}.${ext}`));
}

function copyLaptopFiles() {
  for (const f of readdirSync(r('laptop'))) {
    const to = path.join(LAPTOP, f);
    copyFileSync(r('laptop', f), to);
    if (/\.(sh|command)$/.test(f)) chmodSync(to, 0o755);
  }
}

async function build({ twin = true, hub = true } = {}) {
  const t0 = Date.now();
  cssCache = null;
  mkdirSync(PHONE, { recursive: true });
  mkdirSync(LAPTOP_APP, { recursive: true });
  copyAi(PHONE);
  copyAi(LAPTOP_APP);
  const [phone, laptop] = await Promise.all([page('phone.jsx', 'Kavach · Campus Safety'), page('laptop.jsx', 'Kavach · Admin Console')]);
  writeFileSync(path.join(PHONE, 'index.html'), phone);
  writeFileSync(path.join(LAPTOP_APP, 'phone.html'), phone);
  writeFileSync(path.join(LAPTOP_APP, 'index.html'), laptop);
  const tw = twin ? await buildTwin() : 0;
  if (hub) { await buildHub(); copyLaptopFiles(); }
  console.log(`phone: www/index.html ${kb(phone.length)} · laptop: dist/kavach-laptop (console ${kb(laptop.length)}${twin ? `, twin ${kb(tw)}` : ''}${hub ? ', hub.mjs' : ''}) in ${Date.now() - t0} ms`);
}

await build();
if (process.argv.includes('--watch')) {
  let timer;
  const rebuild = (file) => {
    clearTimeout(timer);
    timer = setTimeout(() => build({ twin: /twin|campus/.test(file || ''), hub: /hub|store|actions|data|campus/.test(file || '') }).catch((e) => console.error(e.message)), 150);
  };
  watch(r('src'), { recursive: true }, (_, file) => rebuild(file));
  watch(r('hub'), { recursive: true }, (_, file) => rebuild('hub/' + file));
  console.log('Watching src/ and hub/ ...');
}
