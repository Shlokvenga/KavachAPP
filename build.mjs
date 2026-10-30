// Builds a single self-contained, offline-ready index.html from src/.
// Usage: npm run build   (or: npm run watch)
import * as esbuild from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const r = (...p) => path.join(root, ...p);

async function build() {
  const t0 = Date.now();
  const js = await esbuild.build({
    entryPoints: [r('src/main.jsx')],
    bundle: true,
    minify: true,
    write: false,
    format: 'iife',
    target: ['es2019'],
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'warning',
  });
  const css = execFileSync(
    process.execPath,
    [r('node_modules/tailwindcss/lib/cli.js'), '-c', r('tailwind.config.cjs'), '-i', r('src/styles.css'), '--minify'],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
  const tpl = readFileSync(r('src/index.template.html'), 'utf8');
  // Use function replacers so `$` sequences in the bundle are kept verbatim.
  const html = tpl
    .replace('/*__CSS__*/', () => css)
    .replace('/*__JS__*/', () => js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
  writeFileSync(r('index.html'), html);
  console.log(`index.html built (${(html.length / 1024).toFixed(0)} KB) in ${Date.now() - t0} ms`);
}

await build();
if (process.argv.includes('--watch')) {
  let timer;
  watch(r('src'), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => build().catch((e) => console.error(e.message)), 150);
  });
  console.log('Watching src/ ...');
}
