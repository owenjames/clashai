#!/usr/bin/env node
// Static file server for the project root with live reload. Usage: node tools/serve.js [port]
// Pages served here reload themselves when a project file changes (dev only; never shipped).
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.argv[2], 10) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Live reload: HTML responses get a tiny EventSource client, and file changes broadcast a reload.
const RELOAD_PATH = '/__reload';
// Each event carries the changed path; a page reloads only for files under its own folder
// (the game page ignores preview/ and vice versa) so one page's edits don't restart another.
const RELOAD_SNIPPET = `<script>(function(){var dir=location.pathname.replace(/[^/]*$/,'').slice(1);var es=new EventSource('${RELOAD_PATH}');es.onmessage=function(e){var p=e.data;if(dir?p.indexOf(dir)===0:p.indexOf('preview/')!==0)location.reload();};})();</script>`;
const clients = new Set();
const pending = new Set();
let reloadTimer = null;
function broadcastReload(rel) {
  pending.add(rel);
  clearTimeout(reloadTimer);
  // Editors often write several files at once, so coalesce bursts into one event per path.
  reloadTimer = setTimeout(() => {
    for (const p of pending) for (const res of clients) res.write(`data: ${p}\n\n`);
    pending.clear();
  }, 120);
}
for (const dir of ['.', 'js', 'preview']) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) continue;
  fs.watch(full, { recursive: dir === 'preview' }, (evt, name) => {
    if (!name || !/\.(html|js|css|json|png|glb|gltf|webmanifest)$/i.test(name)) return;
    broadcastReload(path.posix.join(dir === '.' ? '' : dir, name.split(path.sep).join('/')));
  });
}

function send(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    return send(res, 400, 'Bad request');
  }
  if (urlPath === RELOAD_PATH) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (urlPath.endsWith('/')) urlPath += 'index.html';

  const file = path.normalize(path.join(ROOT, urlPath));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden');

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found');
    if (path.extname(file).toLowerCase() === '.html' && req.method === 'GET') {
      const html = fs.readFileSync(file, 'utf8');
      const body = html.includes('</body>') ? html.replace('</body>', RELOAD_SNIPPET + '</body>') : html + RELOAD_SNIPPET;
      res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-cache' });
      return res.end(body);
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ClashAI serving ${ROOT}`);
  console.log(`  Local:   http://localhost:${PORT}`);
  const seen = new Set();
  for (const list of Object.values(os.networkInterfaces())) {
    for (const info of list || []) {
      if (info.family !== 'IPv4' || info.internal || seen.has(info.address)) continue;
      seen.add(info.address);
      console.log(`  Network: http://${info.address}:${PORT}`);
    }
  }
});
