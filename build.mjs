// Builds the app into www/ (used by the browser demo and by the Android app):
//   www/index.html  self-contained app (React, styles, fonts, logo inlined)
//   www/twin.js     CesiumJS digital twin, loaded only when the admin opens it
//   www/vendor/human.js + www/models/   on-device AI runtime and model weights
// Usage: npm run build   (or: npm run watch)
import * as esbuild from 'esbuild';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync, watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const r = (...p) => path.join(root, ...p);
const out = r('www');
const common = { bundle: true, minify: true, write: false, format: 'iife', target: ['es2020'], logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' } };

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

async function buildApp() {
  const js = await esbuild.build({ ...common, entryPoints: [r('src/main.jsx')], jsx: 'automatic', loader: { '.webp': 'dataurl' } });
  const css = execFileSync(process.execPath, [r('node_modules/tailwindcss/lib/cli.js'), '-c', r('tailwind.config.cjs'), '-i', r('src/styles.css'), '--minify'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const tpl = readFileSync(r('src/index.template.html'), 'utf8');
  // Function replacers keep `$` sequences in the bundle verbatim.
  const html = tpl
    .replace('/*__CSS__*/', () => fontFaces() + css)
    .replace('/*__JS__*/', () => js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
  writeFileSync(path.join(out, 'index.html'), html);
  return html.length;
}

async function buildTwin() {
  const js = await esbuild.build({ ...common, entryPoints: [r('src/twin.js')] });
  writeFileSync(path.join(out, 'twin.js'), js.outputFiles[0].text);
  return js.outputFiles[0].text.length;
}

// On-device AI: Human runtime and only the five models Kavach uses (~19 MB).
const AI_MODELS = ['centernet', 'blazeface', 'faceres', 'antispoof', 'liveness'];
function copyAi() {
  const src = r('node_modules/@vladmandic/human');
  const copy = (from, to) => {
    if (existsSync(to) && statSync(to).size === statSync(from).size) return;
    copyFileSync(from, to);
  };
  mkdirSync(path.join(out, 'vendor'), { recursive: true });
  mkdirSync(path.join(out, 'models'), { recursive: true });
  copy(path.join(src, 'dist/human.js'), path.join(out, 'vendor/human.js'));
  for (const m of AI_MODELS) for (const ext of ['json', 'bin']) copy(path.join(src, 'models', `${m}.${ext}`), path.join(out, 'models', `${m}.${ext}`));
}

async function build({ twin = true } = {}) {
  const t0 = Date.now();
  mkdirSync(out, { recursive: true });
  copyAi();
  const [a, b] = await Promise.all([buildApp(), twin ? buildTwin() : 0]);
  console.log(`www/index.html ${(a / 1024).toFixed(0)} KB${twin ? `, www/twin.js ${(b / 1024).toFixed(0)} KB` : ''} in ${Date.now() - t0} ms`);
}

await build();
if (process.argv.includes('--watch')) {
  let timer;
  watch(r('src'), { recursive: true }, (_, file) => {
    clearTimeout(timer);
    timer = setTimeout(() => build({ twin: /twin|campus/.test(file || '') }).catch((e) => console.error(e.message)), 150);
  });
  console.log('Watching src/ ...');
}
