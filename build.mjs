// Builds the app into www/ (used by the browser demo and by the Android app):
//   www/index.html  self-contained app (React, styles, fonts, logo inlined)
//   www/twin.js     CesiumJS digital twin, loaded only when the admin opens it
// Usage: npm run build   (or: npm run watch)
import * as esbuild from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, watch } from 'node:fs';
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
    face('Outfit Variable', '@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2', 'normal'),
    face('Lora Variable', '@fontsource-variable/lora/files/lora-latin-wght-normal.woff2', 'normal'),
    face('Lora Variable', '@fontsource-variable/lora/files/lora-latin-wght-italic.woff2', 'italic'),
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

async function build({ twin = true } = {}) {
  const t0 = Date.now();
  mkdirSync(out, { recursive: true });
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
