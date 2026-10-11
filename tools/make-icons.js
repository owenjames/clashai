#!/usr/bin/env node
// Draws the ClashAI app icon procedurally and writes PNGs to icons/. No dependencies.
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'icons');
const IOS_ICON = path.join(__dirname, '..', 'ios', 'ClashAI', 'Assets.xcassets', 'AppIcon.appiconset', 'icon-1024.png');
const SIZES = [180, 192, 512, 1024];
const SS = 4; // supersampling grid per axis

const BG_A = [0x3b, 0x8c, 0xff];
const BG_B = [0x6a, 0x2f, 0xd6];
const GOLD_HI = [0xff, 0xf0, 0xa0];
const GOLD_LO = [0xf5, 0xa6, 0x23];
const BAND = [0xd9, 0x8a, 0x12];
const OUTLINE = [0x5c, 0x35, 0x00];
const RED = [0xe5, 0x21, 0x3b];
const OUT_W = 0.022; // outline width in icon units

// Crown as one closed polygon, unit coordinates, y grows downward.
const CROWN = [
  [0.20, 0.78], [0.16, 0.34], [0.36, 0.52], [0.50, 0.26],
  [0.64, 0.52], [0.84, 0.34], [0.80, 0.78],
];
// Jewels on the three crown tips: x, y, radius.
const JEWELS = [[0.16, 0.33, 0.045], [0.50, 0.25, 0.052], [0.84, 0.33, 0.045]];
const BAND_Y = [0.60, 0.70];

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function inPoly(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? clamp01(((px - ax) * dx + (py - ay) * dy) / len2) : 0;
  const qx = ax + dx * t - px, qy = ay + dy * t - py;
  return Math.sqrt(qx * qx + qy * qy);
}

function edgeDist(poly, x, y) {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    d = Math.min(d, segDist(x, y, a[0], a[1], b[0], b[1]));
  }
  return d;
}

// Colour of one point of the icon, unit coordinates.
function sample(x, y) {
  for (const j of JEWELS) {
    const d = Math.hypot(x - j[0], y - j[1]);
    if (d < j[2]) return RED;
    if (d < j[2] + OUT_W) return OUTLINE;
  }
  if (edgeDist(CROWN, x, y) < OUT_W) return OUTLINE;
  if (inPoly(CROWN, x, y)) {
    if (y >= BAND_Y[0] && y <= BAND_Y[1]) return BAND;
    return mix(GOLD_HI, GOLD_LO, clamp01((y - 0.26) / 0.52));
  }
  return mix(BG_A, BG_B, clamp01((x + y) / 2));
}

// Raw scanlines: each row starts with filter byte 0, then RGB triples.
function render(size) {
  const stride = 1 + size * 3;
  const raw = Buffer.alloc(stride * size);
  const n = SS * SS;
  for (let py = 0; py < size; py++) {
    raw[py * stride] = 0;
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = sample((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const o = py * stride + 1 + px * 3;
      raw[o] = Math.round(r / n);
      raw[o + 1] = Math.round(g / n);
      raw[o + 2] = Math.round(b / n);
    }
  }
  return raw;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function encodePng(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB, opaque (app icons must not have alpha)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // no interlace
  return Buffer.concat([
    PNG_SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
let failed = false;
for (const size of SIZES) {
  // The 1024 px App Store icon also goes straight into the iOS asset catalog.
  const files = [path.join(OUT_DIR, `icon-${size}.png`)];
  if (size === 1024) files.push(IOS_ICON);
  for (const file of files) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, encodePng(size, render(size)));
    const head = fs.readFileSync(file).subarray(0, 8);
    const ok = head.equals(PNG_SIG);
    if (!ok) failed = true;
    console.log(`${ok ? 'ok ' : 'BAD'} ${file} (${fs.statSync(file).size} bytes)`);
  }
}
if (failed) process.exitCode = 1;
