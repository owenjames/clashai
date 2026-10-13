#!/usr/bin/env node
// Builds dist/: index.html with every script inlined (single file), plus manifest, sw.js and icons.
// Also writes ios/ClashAI/Web/ (index.html and icons only; the app has no service worker).
// Usage: node tools/build.js
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
// iOS app bundle payload: the single-file page and icons, copied in as a folder reference.
const IOS_WEB = path.join(ROOT, 'ios', 'ClashAI', 'Web');

// Must match the load order in index.html.
const SCRIPTS = [
  'js/cards.js',
  'js/engine.js',
  'js/botconfig.js',
  'js/bot.js',
  'js/ai.js',
  'js/vendor/pixi.min.js',
  'js/troopart.js',
  'js/sprites.js',
  'js/render.js',
  'js/render-pixi.js',
  'js/audio.js',
  'js/ui.js',
  'js/main.js',
];
const ICONS = ['icon-180.png', 'icon-192.png', 'icon-512.png'];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// Inline index.html with the scripts in order.
let html = read('index.html');
for (const rel of SCRIPTS) {
  const tag = `<script src="${rel}"></script>`;
  if (!html.includes(tag)) throw new Error(`index.html is missing ${tag}`);
  // Escape closing script tags so the inlined code cannot end the block early.
  const code = read(rel).replace(/<\/script/gi, '<\\/script');
  html = html.replace(tag, () => `<script>\n${code}\n</script>`);
}

// sw.js precache list for the single-file build: only the files that exist in dist.
const precache = ['./', './index.html', './manifest.webmanifest']
  .concat(ICONS.map((f) => `./icons/${f}`));
let sw = read('sw.js');
const listRe = /var PRECACHE_URLS = \[[\s\S]*?\];/;
if (!listRe.test(sw)) throw new Error('sw.js PRECACHE_URLS not found');
sw = sw.replace(listRe, () => `var PRECACHE_URLS = ${JSON.stringify(precache)};`);

for (const f of ICONS) {
  if (!fs.existsSync(path.join(ROOT, 'icons', f))) {
    throw new Error(`icons/${f} missing; run node tools/make-icons.js first`);
  }
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'icons'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'index.html'), html);
fs.writeFileSync(path.join(DIST, 'sw.js'), sw);
fs.copyFileSync(path.join(ROOT, 'manifest.webmanifest'), path.join(DIST, 'manifest.webmanifest'));
for (const f of ICONS) {
  fs.copyFileSync(path.join(ROOT, 'icons', f), path.join(DIST, 'icons', f));
}

fs.rmSync(IOS_WEB, { recursive: true, force: true });
fs.mkdirSync(path.join(IOS_WEB, 'icons'), { recursive: true });
fs.writeFileSync(path.join(IOS_WEB, 'index.html'), html);
for (const f of ICONS) {
  fs.copyFileSync(path.join(ROOT, 'icons', f), path.join(IOS_WEB, 'icons', f));
}

console.log(`built ${path.relative(process.cwd(), DIST) || DIST}`);
console.log(`built ${path.relative(process.cwd(), IOS_WEB) || IOS_WEB}`);
for (const f of ['index.html', 'sw.js', 'manifest.webmanifest']) {
  console.log(`  ${f} ${fs.statSync(path.join(DIST, f)).size} bytes`);
}
