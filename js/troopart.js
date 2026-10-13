// Procedural cartoon troop art. Every unit is drawn in code, so there are no image files.
//
// draw(ctx, unitId, team, pose, phase, opts)
//   One frame. The caller sets the transform: 1 unit = character height, feet at (0,0),
//   head top near y = -1. Ink outline is 0.039 units (2.5 px at 64 px tall), so the
//   caller's scale must be the on-screen height of one unit. draw() saves and restores ctx.
//   opts: facing (1 | -1), flash (0..1 white overlay), frozen (bool, icy tint).
//
// bake(unitId, team, opts)
//   Renders every pose to offscreen canvases once and caches them. opts: height (CSS px,
//   default 96), dpr (default devicePixelRatio capped at 2), poses (subset of POSES).
//   Result: { frames: {idle:[canvas], walk:[...], attack:[...], death:[...]}, fps, size }.
//   size.anchor is the feet point in canvas pixels. size.scale is the unit's relative size
//   (goblins are smaller, giants larger); the renderer multiplies it into its own height.
//
// Pure canvas 2D. No dependencies. Units come from CR.UNITS and CR.TEAM_COLORS in cards.js.
(function () {
  'use strict';
  var CR = (globalThis.CR = globalThis.CR || {});

  var TAU = Math.PI * 2;
  var HALF_PI = Math.PI / 2;
  var INK = '#1d1a33';
  var OL = 0.039;          // ink width at 1 unit = 1 char height
  var HIP_Y = -0.27;
  var SHO_Y = -0.58;
  var SHO_X = 0.2;
  var ARM1 = 0.14, ARM2 = 0.13;
  var LEG1 = 0.13, LEG2 = 0.13;
  var REACH = ARM1 + ARM2;
  var SKIN = '#f2c49b';
  var GOB = '#7fd24e';
  var STEEL = '#c3cddc', STEEL_D = '#6f7d96', STEEL_L = '#dfe6f1';
  var LEATHER_D = '#5b3a22';
  var WOOD = '#8a5a2b';
  var GOLD = '#f4c24d';
  var BONE = '#f1ead6';
  var WHITE = '#fbf8f0';
  var FRAMES = { idle: 4, walk: 6, attack: 6, death: 5 };
  var POSES = ['idle', 'walk', 'attack', 'death'];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sstep(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function seg(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
  function mixv(a, b, t) {
    if (typeof a === 'number') return a + (b - a) * t;
    return a.map(function (v, i) { return v + (b[i] - v) * t; });
  }
  // Keyframes: [[t, value], ...] with smoothstep easing between neighbours.
  function kf(p, keys) {
    if (p <= keys[0][0]) return keys[0][1];
    for (var i = 1; i < keys.length; i++) {
      if (p <= keys[i][0]) {
        var a = keys[i - 1], b = keys[i];
        return mixv(a[1], b[1], sstep((p - a[0]) / Math.max(1e-6, b[0] - a[0])));
      }
    }
    return keys[keys.length - 1][1];
  }

  // ---- colour -------------------------------------------------------------
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) {
    var A = hexRgb(a), B = hexRgb(b), o = '#';
    for (var i = 0; i < 3; i++) o += Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0');
    return o;
  }
  var ST = { flash: 0, ice: 0, k: 1 };   // per-frame tint state; k = ink scale inside a scaled sub-frame
  var cmemo = new Map();
  function C(col) {
    if (!ST.flash && !ST.ice) return col;
    var key = col + '|' + ST.flash + '|' + ST.ice;
    var v = cmemo.get(key);
    if (v) return v;
    var o = col;
    if (ST.ice) o = mix(o, '#a9ecff', 0.55 * ST.ice);
    if (ST.flash) o = mix(o, '#ffffff', 0.9 * ST.flash);
    if (cmemo.size > 4000) cmemo.clear();
    cmemo.set(key, o);
    return o;
  }
  function hiC(col) { return mix(col, '#ffffff', 0.42); }
  function shC(col) { return mix(col, '#20124a', 0.36); }

  // ---- primitives ---------------------------------------------------------
  // Fill the current path with a radial highlight-to-shade gradient, then ink its outline.
  function paint(c, col, x, y, r, lw) {
    var base = C(col);
    r = Math.max(r, 0.02);
    var g = c.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.05, x, y, r * 1.3);
    g.addColorStop(0, hiC(base));
    g.addColorStop(0.55, base);
    g.addColorStop(1, shC(base));
    c.fillStyle = g;
    c.fill();
    c.lineWidth = (lw || OL) * ST.k;
    c.strokeStyle = INK;
    c.lineJoin = 'round';
    c.stroke();
  }
  function ell(c, x, y, rx, ry, col, rot) {
    c.beginPath();
    c.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
    paint(c, col, x, y, Math.max(rx, ry));
  }
  function bbox(list) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, i;
    for (i = 0; i < list.length; i++) {
      x0 = Math.min(x0, list[i][0]); x1 = Math.max(x1, list[i][0]);
      y0 = Math.min(y0, list[i][1]); y1 = Math.max(y1, list[i][1]);
    }
    return [(x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, y1 - y0) / 2 + 0.01];
  }
  function poly(c, list, col) {
    c.beginPath();
    c.moveTo(list[0][0], list[0][1]);
    for (var i = 1; i < list.length; i++) c.lineTo(list[i][0], list[i][1]);
    c.closePath();
    var b = bbox(list);
    paint(c, col, b[0], b[1], b[2]);
  }
  function rr(c, x, y, w, h, r, col) {
    var rad = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rad, y);
    c.arcTo(x + w, y, x + w, y + h, rad);
    c.arcTo(x + w, y + h, x, y + h, rad);
    c.arcTo(x, y + h, x, y, rad);
    c.arcTo(x, y, x + w, y, rad);
    c.closePath();
    paint(c, col, x + w / 2, y + h / 2, Math.max(w, h) / 2);
  }
  // Thick inked polyline (limbs, shafts). The ink is the same width on both sides of the colour.
  function tube(c, list, w, col) {
    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(list[0][0], list[0][1]);
    for (var i = 1; i < list.length; i++) c.lineTo(list[i][0], list[i][1]);
    c.strokeStyle = INK;
    c.lineWidth = w + 2 * OL * ST.k;
    c.stroke();
    c.strokeStyle = C(col);
    c.lineWidth = w;
    c.stroke();
    c.restore();
  }
  // Plain stroke with no ink (brows, mouths, string, highlights).
  function line(c, list, w, col) {
    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(list[0][0], list[0][1]);
    for (var i = 1; i < list.length; i++) c.lineTo(list[i][0], list[i][1]);
    c.strokeStyle = C(col || INK);
    c.lineWidth = w;
    c.stroke();
    c.restore();
  }
  // Two-bone IK. S shoulder or hip, T target. side +1 bends the elbow outward on the +x side.
  function ik(S, T, L1, L2, side) {
    var dx = T[0] - S[0], dy = T[1] - S[1];
    var d = Math.hypot(dx, dy) || 1e-4;
    var max = (L1 + L2) * 0.999;
    if (d > max) { dx *= max / d; dy *= max / d; d = max; }
    var a0 = Math.atan2(dx, dy);
    var ca = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * Math.max(d, 1e-4)), -1, 1);
    var a = a0 + side * Math.acos(ca);
    return {
      E: [S[0] + L1 * Math.sin(a), S[1] + L1 * Math.cos(a)],
      T: [S[0] + dx, S[1] + dy],
    };
  }
  function limb(c, S, T, side, w, col, L1, L2) {
    var r = ik(S, T, L1, L2, side);
    tube(c, [S, r.E, r.T], w, col);
    return r.T;
  }
  // Angle is measured from straight down, positive toward +x (the weapon side).
  function armPt(S, a, reach) {
    reach = reach || REACH * 0.97;
    return [S[0] + reach * Math.sin(a), S[1] + reach * Math.cos(a)];
  }
  var SHO_W = [SHO_X, SHO_Y];
  var SHO_O = [-SHO_X, SHO_Y];

  // ---- teams --------------------------------------------------------------
  function teamIndex(team) {
    return (team === 1 || team === '1' || team === 'red' || team === 'r') ? 1 : 0;
  }
  function teamOf(team) {
    var i = teamIndex(team);
    var tc = CR.TEAM_COLORS && CR.TEAM_COLORS[i];
    if (tc) return { main: tc.main, dark: tc.dark, light: tc.light };
    return i ? { main: '#e5413b', dark: '#9c1f1b', light: '#ffaaa6' }
             : { main: '#2f7cf6', dark: '#1a4fa8', light: '#9cc3ff' };
  }
  function tcol(v, tm) { return v === 'team' ? tm.main : v; }

  // ---- face ---------------------------------------------------------------
  function eye(c, x, y, s) {
    c.beginPath();
    c.ellipse(x, y, 0.04 * s, 0.052 * s, 0, 0, TAU);
    c.fillStyle = INK;
    c.fill();
    c.beginPath();
    c.arc(x + 0.014 * s, y - 0.018 * s, 0.016 * s, 0, TAU);
    c.fillStyle = WHITE;
    c.fill();
  }
  function face(c, kind, hy, sc, tm) {
    var ex = 0.085 * sc, ey = hy + 0.012;
    if (!kind || kind === 'none') return;
    c.save();
    if (kind === 'visor') {
      c.beginPath();
      c.roundRect ? c.roundRect(-0.16 * sc, hy - 0.03, 0.32 * sc, 0.055, 0.025) : c.rect(-0.16 * sc, hy - 0.03, 0.32 * sc, 0.055);
      c.fillStyle = INK;
      c.fill();
      c.fillStyle = WHITE;
      c.beginPath(); c.arc(-0.07 * sc, hy - 0.002, 0.014, 0, TAU); c.fill();
      c.beginPath(); c.arc(0.07 * sc, hy - 0.002, 0.014, 0, TAU); c.fill();
    } else if (kind === 'skull') {
      c.fillStyle = INK;
      c.beginPath(); c.ellipse(-ex, hy + 0.02, 0.07 * sc, 0.08, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(ex, hy + 0.02, 0.07 * sc, 0.08, 0, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(-0.07, hy + 0.1); c.lineTo(0.07, hy + 0.1); c.lineTo(0.05, hy + 0.2); c.lineTo(-0.05, hy + 0.2); c.closePath();
      c.fillStyle = INK; c.fill();
      line(c, [[-0.03, hy + 0.11], [-0.03, hy + 0.19]], 0.012, BONE);
      line(c, [[0.02, hy + 0.11], [0.02, hy + 0.19]], 0.012, BONE);
    } else if (kind === 'mask') {
      ell(c, -ex, hy + 0.02, 0.05 * sc, 0.025, INK);
      ell(c, ex, hy + 0.02, 0.05 * sc, 0.025, INK);
      c.fillStyle = WHITE;
      c.beginPath(); c.arc(-ex - 0.01, hy + 0.01, 0.01, 0, TAU); c.fill();
      c.beginPath(); c.arc(ex - 0.01, hy + 0.01, 0.01, 0, TAU); c.fill();
    } else {
      var angry = kind === 'fierce' || kind === 'angry';
      var grim = kind === 'grim';
      var blush = kind === 'cute' || kind === 'happy' || kind === 'grin';
      if (blush) {
        c.fillStyle = 'rgba(255,110,125,0.45)';
        c.beginPath(); c.ellipse(-0.14 * sc, hy + 0.07, 0.04 * sc, 0.025, 0, 0, TAU); c.fill();
        c.beginPath(); c.ellipse(0.14 * sc, hy + 0.07, 0.04 * sc, 0.025, 0, 0, TAU); c.fill();
      }
      if (kind === 'glow') {
        ell(c, -ex, ey, 0.045 * sc, 0.05, tm.main);
        ell(c, ex, ey, 0.045 * sc, 0.05, tm.main);
      } else {
        var es = angry ? 0.8 : grim ? 0.85 : 1;
        eye(c, -ex, ey, es * sc);
        eye(c, ex, ey, es * sc);
      }
      if (angry || grim) {
        for (var s = -1; s <= 1; s += 2) {
          line(c, [[s * 0.05 * sc, hy - 0.05], [s * 0.17 * sc, hy - (angry ? 0.11 : 0.075)]], 0.036, INK);
        }
      }
      if (kind === 'smirk') {
        line(c, [[-0.02, hy + 0.1], [0.05, hy + 0.09], [0.08, hy + 0.07]], 0.024, INK);
      } else if (kind === 'grin') {
        c.beginPath(); c.moveTo(-0.07, hy + 0.07); c.quadraticCurveTo(0, hy + 0.2, 0.07, hy + 0.07); c.closePath();
        c.fillStyle = '#7d1d2b'; c.fill(); c.lineWidth = 0.02; c.strokeStyle = INK; c.stroke();
      } else if (kind === 'fierce') {
        c.beginPath(); c.moveTo(-0.07, hy + 0.08); c.lineTo(0.07, hy + 0.08); c.quadraticCurveTo(0, hy + 0.17, -0.07, hy + 0.08); c.closePath();
        c.fillStyle = '#5e1a24'; c.fill(); c.lineWidth = 0.02; c.strokeStyle = INK; c.stroke();
        c.fillStyle = WHITE;
        c.beginPath(); c.moveTo(-0.045, hy + 0.085); c.lineTo(-0.025, hy + 0.085); c.lineTo(-0.035, hy + 0.12); c.fill();
        c.beginPath(); c.moveTo(0.045, hy + 0.085); c.lineTo(0.025, hy + 0.085); c.lineTo(0.035, hy + 0.12); c.fill();
      } else if (grim) {
        line(c, [[-0.05, hy + 0.11], [0.05, hy + 0.11]], 0.024, INK);
      } else if (kind === 'angry') {
        line(c, [[-0.05, hy + 0.11], [0.05, hy + 0.11]], 0.024, INK);
      } else {
        c.beginPath(); c.moveTo(-0.05, hy + 0.08); c.quadraticCurveTo(0, hy + 0.13, 0.05, hy + 0.08);
        c.lineWidth = 0.024; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke();
      }
    }
    c.restore();
  }

  // ---- head and headgear --------------------------------------------------
  function hairCap(c, col, hy, sc, spiky) {
    c.beginPath();
    c.ellipse(0, hy - 0.06 * sc, 0.205 * sc, 0.15 * sc, 0, Math.PI, TAU);
    c.lineTo(0.2 * sc, hy - 0.06);
    c.lineTo(0.14 * sc, hy + 0.0);
    c.lineTo(0.07 * sc, hy - 0.05);
    c.lineTo(0, hy + 0.01);
    c.lineTo(-0.07 * sc, hy - 0.05);
    c.lineTo(-0.14 * sc, hy + 0.0);
    c.lineTo(-0.2 * sc, hy - 0.06);
    c.closePath();
    paint(c, col, 0, hy - 0.06, 0.22 * sc);
    if (spiky) {
      poly(c, [[-0.14 * sc, hy - 0.17], [-0.1 * sc, hy - 0.3], [-0.04 * sc, hy - 0.17]], col);
      poly(c, [[-0.03 * sc, hy - 0.18], [0.02 * sc, hy - 0.33], [0.08 * sc, hy - 0.18]], col);
      poly(c, [[0.1 * sc, hy - 0.16], [0.16 * sc, hy - 0.28], [0.18 * sc, hy - 0.13]], col);
    }
  }
  function domeCap(c, col, hy, sc, tall) {
    c.beginPath();
    c.moveTo(-0.23 * sc, hy - 0.02);
    c.quadraticCurveTo(-0.23 * sc, hy - 0.27 * tall, 0, hy - 0.27 * tall);
    c.quadraticCurveTo(0.23 * sc, hy - 0.27 * tall, 0.23 * sc, hy - 0.02);
    c.closePath();
    paint(c, col, 0, hy - 0.12, 0.25);
  }
  function hatCone(c, col, tm, hy, tall) {
    c.beginPath();
    c.moveTo(-0.27, hy - 0.1);
    c.quadraticCurveTo(0, hy - 0.16, 0.27, hy - 0.1);
    c.quadraticCurveTo(0.14, hy - 0.4 * tall, 0.06, hy - 0.58 * tall);
    c.quadraticCurveTo(-0.1, hy - 0.38 * tall, -0.27, hy - 0.1);
    c.closePath();
    paint(c, col, 0, hy - 0.35, 0.36);
    ell(c, 0, hy - 0.1, 0.34, 0.07, col);
    rr(c, -0.25, hy - 0.15, 0.5, 0.06, 0.02, tm.main);
    poly(c, [[0.0, hy - 0.42], [0.025, hy - 0.37], [0.07, hy - 0.37], [0.035, hy - 0.335], [0.05, hy - 0.29], [0, hy - 0.32], [-0.05, hy - 0.29], [-0.035, hy - 0.335], [-0.07, hy - 0.37], [-0.025, hy - 0.37]], GOLD);
  }
  function hoodShape(c, col, hy, sc) {
    c.beginPath();
    c.moveTo(-0.25 * sc, hy + 0.08);
    c.quadraticCurveTo(-0.3 * sc, hy - 0.28, 0, hy - 0.28);
    c.quadraticCurveTo(0.3 * sc, hy - 0.28, 0.25 * sc, hy + 0.08);
    c.quadraticCurveTo(0, hy + 0.02, -0.25 * sc, hy + 0.08);
    c.closePath();
    paint(c, col, 0, hy - 0.1, 0.27);
  }
  function headgear(c, d, tm, sc, hy) {
    var top = d.top || 'none';
    var hc = d.hair || '#5a3a20';
    var hornC = d.horn || '#efe4c4';
    switch (top) {
      case 'hair':
        hairCap(c, hc, hy, sc, d.spiky);
        if (d.bun) ell(c, 0, hy - 0.24 * sc, 0.07, 0.06, hc);
        break;
      case 'helm':
        domeCap(c, STEEL, hy, sc, 1.0);
        rr(c, -0.225 * sc, hy - 0.1, 0.45 * sc, 0.05, 0.02, tm.main);
        break;
      case 'great':
        rr(c, -0.23 * sc, hy - 0.2, 0.46 * sc, 0.4, 0.14, STEEL);
        ell(c, -0.15 * sc, hy - 0.12, 0.022, 0.022, STEEL_D);
        ell(c, 0.15 * sc, hy - 0.12, 0.022, 0.022, STEEL_D);
        if (d.plume) poly(c, [[0, hy - 0.2], [-0.07, hy - 0.36], [0.05, hy - 0.42], [0.2, hy - 0.34], [0.08, hy - 0.24]], tm.main);
        break;
      case 'pekka':
        rr(c, -0.22 * sc, hy - 0.2, 0.44 * sc, 0.36, 0.1, '#56647d');
        rr(c, -0.03, hy - 0.16, 0.06, 0.26, 0.02, STEEL_L);
        rr(c, -0.23 * sc, hy + 0.1, 0.46 * sc, 0.06, 0.02, tm.main);
        break;
      case 'viking':
        rr(c, -0.22 * sc, hy - 0.2, 0.44 * sc, 0.22, 0.1, STEEL);
        tube(c, [[-0.2 * sc, hy - 0.1], [-0.33 * sc, hy - 0.2], [-0.36 * sc, hy - 0.36]], 0.06, hornC);
        tube(c, [[0.2 * sc, hy - 0.1], [0.33 * sc, hy - 0.2], [0.36 * sc, hy - 0.36]], 0.06, hornC);
        rr(c, -0.22 * sc, hy - 0.05, 0.44 * sc, 0.05, 0.02, tm.main);
        break;
      case 'hood':
        hoodShape(c, d.hood || tm.main, hy, sc);
        ell(c, 0, hy + 0.02, 0.14 * sc, 0.15, d.skin || SKIN);
        break;
      case 'mask':
        hoodShape(c, d.hood || '#2e2a3a', hy, sc);
        c.beginPath();
        c.moveTo(-0.16, hy - 0.04);
        c.quadraticCurveTo(0, hy - 0.12, 0.16, hy - 0.04);
        c.quadraticCurveTo(0.14, hy + 0.12, 0, hy + 0.12);
        c.quadraticCurveTo(-0.14, hy + 0.12, -0.16, hy - 0.04);
        c.closePath();
        paint(c, WHITE, 0, hy + 0.02, 0.15);
        break;
      case 'wizard':
        hatCone(c, d.hat || '#5b35a6', tm, hy, 0.9);
        break;
      case 'witch':
        hatCone(c, d.hat || '#3b2a66', tm, hy, 1.22);
        break;
      case 'crown':
        rr(c, -0.19 * sc, hy - 0.2, 0.38 * sc, 0.12, 0.02, GOLD);
        poly(c, [[-0.19 * sc, hy - 0.2], [-0.14 * sc, hy - 0.33], [-0.08 * sc, hy - 0.2]], GOLD);
        poly(c, [[-0.06 * sc, hy - 0.2], [0, hy - 0.36], [0.06 * sc, hy - 0.2]], GOLD);
        poly(c, [[0.08 * sc, hy - 0.2], [0.14 * sc, hy - 0.33], [0.19 * sc, hy - 0.2]], GOLD);
        ell(c, 0, hy - 0.14, 0.04, 0.04, tm.main);
        break;
      case 'tiara':
        rr(c, -0.19 * sc, hy - 0.13, 0.38 * sc, 0.05, 0.02, GOLD);
        ell(c, 0, hy - 0.1, 0.035, 0.035, tm.main);
        break;
      case 'tricorn':
        ell(c, 0, hy - 0.19, 0.3 * sc, 0.06, '#2a2833');
        c.beginPath();
        c.moveTo(-0.32, hy - 0.16);
        c.quadraticCurveTo(-0.2, hy - 0.34, -0.02, hy - 0.25);
        c.quadraticCurveTo(0.12, hy - 0.36, 0.32, hy - 0.16);
        c.quadraticCurveTo(0, hy - 0.1, -0.32, hy - 0.16);
        c.closePath();
        paint(c, '#2a2833', 0, hy - 0.22, 0.3);
        ell(c, 0.14, hy - 0.22, 0.05, 0.05, tm.main);
        break;
      case 'bandana':
        rr(c, -0.205 * sc, hy - 0.08, 0.41 * sc, 0.09, 0.03, tm.main);
        poly(c, [[0.19 * sc, hy - 0.05], [0.33 * sc, hy - 0.02], [0.26 * sc, hy + 0.04], [0.19 * sc, hy + 0.0]], tm.main);
        break;
      case 'hardhat':
        domeCap(c, '#f5c542', hy, sc, 1.05);
        rr(c, -0.225 * sc, hy - 0.17, 0.45 * sc, 0.05, 0.02, tm.main);
        rr(c, -0.27 * sc, hy - 0.06, 0.54 * sc, 0.04, 0.02, '#d9a02a');
        ell(c, 0, hy - 0.27, 0.035, 0.035, '#fff7c2');
        break;
      case 'beanie':
        domeCap(c, tm.main, hy, sc, 1.05);
        rr(c, -0.215 * sc, hy - 0.1, 0.43 * sc, 0.06, 0.02, tm.dark);
        ell(c, 0, hy - 0.27, 0.04, 0.04, WHITE);
        break;
      case 'cap':
        domeCap(c, tm.main, hy, sc, 0.9);
        ell(c, 0.1 * sc, hy - 0.1, 0.2 * sc, 0.04, tm.dark);
        break;
      case 'darkhelm':
        rr(c, -0.22 * sc, hy - 0.2, 0.44 * sc, 0.36, 0.12, '#4e3d6b');
        poly(c, [[-0.14 * sc, hy - 0.19], [-0.08 * sc, hy - 0.36], [-0.02 * sc, hy - 0.19]], '#4e3d6b');
        poly(c, [[0.02 * sc, hy - 0.19], [0.08 * sc, hy - 0.36], [0.14 * sc, hy - 0.19]], '#4e3d6b');
        if (d.plume !== false) poly(c, [[-0.02, hy - 0.32], [0.06, hy - 0.46], [0.12, hy - 0.3]], tm.main);
        break;
      case 'rock':
      case 'none':
      default:
        break;
    }
  }

  function head(c, d, tm, sc) {
    var hy = -0.8, rx = 0.2 * sc, ry = 0.19 * sc;
    var skin = d.skin || SKIN;
    if (d.long) rr(c, -rx - 0.03, hy - 0.04, 2 * rx + 0.06, 0.28, 0.12, d.hair || '#6b4424');
    if (d.beard) ell(c, 0, hy + 0.14 * sc, 0.12 * sc, 0.11 * sc, d.beard);
    if (d.head === 'goblin') {
      poly(c, [[-0.17 * sc, hy - 0.04], [-0.37 * sc, hy - 0.12], [-0.19 * sc, hy + 0.05]], skin);
      poly(c, [[0.17 * sc, hy - 0.04], [0.37 * sc, hy - 0.12], [0.19 * sc, hy + 0.05]], skin);
    }
    if (d.head === 'skull') {
      ell(c, 0, hy, rx, ry, BONE);
      rr(c, -0.12 * sc, hy + 0.1, 0.24 * sc, 0.08, 0.03, BONE);
    } else if (d.head === 'rock') {
      var pts = [];
      for (var k = 0; k < 10; k++) {
        var th = k * TAU / 10, rad = k % 2 ? 0.92 : 1.0;
        pts.push([Math.cos(th) * rx * 1.05 * rad, hy + Math.sin(th) * ry * 1.05 * rad]);
      }
      poly(c, pts, skin);
    } else {
      ell(c, 0, hy, rx, ry, skin);
    }
    headgear(c, d, tm, sc, hy);
    face(c, d.face || 'cute', hy, sc, tm);
  }

  // ---- body ---------------------------------------------------------------
  function bodyFill(d, tm) {
    switch (d.body) {
      case 'plate': return tcol(d.fill, tm) || STEEL;
      case 'darkplate': return tcol(d.fill, tm) || '#4a3d68';
      case 'tunic': return tcol(d.fill, tm) || '#c98f57';
      case 'bulky': return tcol(d.fill, tm) || '#b98252';
      case 'coat': return tm.main;
      case 'skeleton': return BONE;
      case 'bare': case 'fur': return tcol(d.fill, tm) || d.skin || SKIN;
      case 'bib': return tcol(d.fill, tm) || '#6f809a';
      case 'plaid': return tm.main;
      case 'dress': return tm.main;
      case 'apron': return tcol(d.fill, tm) || '#3a2f3f';
      case 'robe': return tcol(d.robe, tm) || tm.main;
      case 'rock': return d.skin || '#8d9099';
      case 'leather': return tcol(d.fill, tm) || '#4c3a2c';
      default: return tcol(d.fill, tm) || '#c98f57';
    }
  }
  function torsoPath(c, sx, wx, yt, yb) {
    c.beginPath();
    c.moveTo(-sx, yt);
    c.quadraticCurveTo(0, yt - 0.07, sx, yt);
    c.quadraticCurveTo(sx + 0.03, (yt + yb) / 2, wx, yb);
    c.quadraticCurveTo(0, yb + 0.05, -wx, yb);
    c.quadraticCurveTo(-sx - 0.03, (yt + yb) / 2, -sx, yt);
    c.closePath();
  }
  function ribs(c, tm, wide) {
    tube(c, [[0, -0.6], [0, -0.3]], 0.05, BONE);
    for (var k = 0; k < 4; k++) {
      var y = -0.56 + k * 0.075;
      tube(c, [[0, y], [0.16 * wide, y + 0.05]], 0.04, BONE);
      tube(c, [[0, y], [-0.16 * wide, y + 0.05]], 0.04, BONE);
    }
    rr(c, -0.13 * wide, -0.34, 0.26 * wide, 0.07, 0.03, BONE);
    poly(c, [[-0.12, -0.3], [0.12, -0.3], [0.08, -0.22], [0.04, -0.29], [0, -0.21], [-0.04, -0.29], [-0.08, -0.22]], tm.main);
  }
  function torso(c, d, tm, wide) {
    var body = d.body || 'tunic';
    var sx = 0.19 * wide, wx = 0.15 * wide;
    var yt = -0.6, yb = -0.29, mid = (yt + yb) / 2;
    var fill = bodyFill(d, tm);
    var trim = tcol(d.trim || 'team', tm);
    if (body === 'skeleton') { ribs(c, tm, wide); return; }
    if (body === 'robe') {
      c.beginPath();
      c.moveTo(-sx, yt);
      c.quadraticCurveTo(0, yt - 0.07, sx, yt);
      c.quadraticCurveTo(sx + 0.05, -0.3, sx * 1.3, -0.04);
      c.quadraticCurveTo(0, 0.01, -sx * 1.3, -0.04);
      c.quadraticCurveTo(-sx - 0.05, -0.3, -sx, yt);
      c.closePath();
      paint(c, fill, 0, -0.32, 0.36);
      rr(c, -sx * 1.3, -0.1, sx * 2.6, 0.07, 0.03, trim);
      rr(c, -wx - 0.01, -0.37, 2 * wx + 0.02, 0.06, 0.02, trim);
      return;
    }
    torsoPath(c, sx, wx, yt, yb);
    paint(c, fill, 0, mid, 0.26);
    switch (body) {
      case 'plate':
      case 'darkplate':
        poly(c, [[-0.085, -0.6], [0.085, -0.6], [0.075, -0.32], [-0.075, -0.32]], tm.main);
        rr(c, -wx - 0.01, -0.36, 2 * wx + 0.02, 0.06, 0.02, '#3d2c1e');
        ell(c, -sx - 0.01, -0.6, 0.1 * wide, 0.085, fill === STEEL ? STEEL_L : mix(fill, '#ffffff', 0.2));
        ell(c, sx + 0.01, -0.6, 0.1 * wide, 0.085, fill === STEEL ? STEEL_L : mix(fill, '#ffffff', 0.2));
        break;
      case 'tunic':
      case 'bulky':
        poly(c, [[-sx + 0.02, -0.6], [-sx + 0.12, -0.6], [sx - 0.1, -0.36], [sx - 0.02, -0.36]], tm.main);
        rr(c, -wx - 0.01, -0.36, 2 * wx + 0.02, body === 'bulky' ? 0.08 : 0.06, 0.02, '#3d2c1e');
        if (body === 'bulky') rr(c, -0.035, -0.37, 0.07, 0.08, 0.01, GOLD);
        break;
      case 'coat':
        poly(c, [[-0.02, -0.6], [-0.12, -0.6], [-0.08, -0.3], [0, -0.36]], WHITE);
        poly(c, [[0.02, -0.6], [0.12, -0.6], [0.08, -0.3], [0, -0.36]], WHITE);
        ell(c, 0, -0.5, 0.022, 0.022, GOLD);
        ell(c, 0, -0.4, 0.022, 0.022, GOLD);
        line(c, [[-sx + 0.05, -0.56], [sx - 0.05, -0.34]], 0.05, WHITE);
        break;
      case 'bib':
        poly(c, [[-0.11, -0.58], [0.11, -0.58], [0.11, -0.34], [-0.11, -0.34]], tm.main);
        line(c, [[-0.08, -0.6], [-0.1, -0.58]], 0.03, INK);
        line(c, [[0.08, -0.6], [0.1, -0.58]], 0.03, INK);
        rr(c, -wx - 0.01, -0.36, 2 * wx + 0.02, 0.06, 0.02, '#3d2c1e');
        break;
      case 'plaid':
        for (var k = 0; k < 4; k++) line(c, [[-sx, -0.55 + k * 0.07], [sx, -0.55 + k * 0.07]], 0.018, '#2a1f33');
        for (var j = -1; j <= 1; j++) line(c, [[j * 0.08, -0.6], [j * 0.08, -0.3]], 0.018, '#2a1f33');
        break;
      case 'dress':
        poly(c, [[-wx, -0.33], [wx, -0.33], [wx + 0.16 * wide, -0.04], [-wx - 0.16 * wide, -0.04]], fill);
        line(c, [[-wx - 0.16 * wide, -0.05], [wx + 0.16 * wide, -0.05]], 0.03, GOLD);
        break;
      case 'bare':
        poly(c, [[-wx, -0.37], [wx, -0.37], [wx * 0.8, -0.22], [-wx * 0.8, -0.22]], tm.main);
        break;
      case 'fur':
        poly(c, [[-0.2 * wide, -0.6], [-0.1 * wide, -0.6], [0.2 * wide, -0.36], [0.12 * wide, -0.34]], tm.main);
        poly(c, [[-wx - 0.02, -0.37], [wx + 0.02, -0.37], [wx + 0.04, -0.25], [0.06, -0.27], [0, -0.2], [-0.06, -0.27], [-wx - 0.04, -0.25]], '#6b4a2e');
        break;
      case 'apron':
        rr(c, -0.13, -0.56, 0.26, 0.28, 0.03, tm.main);
        line(c, [[-0.1, -0.58], [-sx + 0.05, -0.6]], 0.02, INK);
        line(c, [[0.1, -0.58], [sx - 0.05, -0.6]], 0.02, INK);
        break;
      case 'rock':
        line(c, [[-0.12, -0.54], [-0.02, -0.46], [0.05, -0.52]], 0.02, '#4a4d56');
        line(c, [[0.08, -0.38], [0.16, -0.32]], 0.02, '#4a4d56');
        poly(c, [[0, -0.55], [0.07, -0.45], [0, -0.36], [-0.07, -0.45]], tm.main);
        break;
      case 'leather':
        rr(c, -0.14, -0.63, 0.28, 0.06, 0.02, tm.main);
        break;
      default:
        poly(c, [[-0.085, -0.6], [0.085, -0.6], [0.075, -0.32], [-0.075, -0.32]], tm.main);
        break;
    }
  }
  function cape(c, d, r, tm) {
    var col = tcol(d.cape, tm);
    var sw = (r.sway || 0) * 0.025;
    c.beginPath();
    c.moveTo(-0.18, -0.6);
    c.quadraticCurveTo(-0.32, -0.46, -0.3 + sw, -0.12);
    c.lineTo(0.3 + sw, -0.12);
    c.quadraticCurveTo(0.32, -0.46, 0.18, -0.6);
    c.closePath();
    paint(c, col, 0, -0.38, 0.3);
  }
  function shield(c, kind, p, tm) {
    var x = p[0] - 0.03, y = p[1] + 0.02;
    if (kind === 'kite') {
      poly(c, [[x - 0.15, y - 0.16], [x + 0.15, y - 0.16], [x + 0.12, y + 0.08], [x, y + 0.22], [x - 0.12, y + 0.08]], tm.main);
      line(c, [[x, y - 0.12], [x, y + 0.18]], 0.04, WHITE);
    } else if (kind === 'spike') {
      var st = [];
      for (var k = 0; k < 16; k++) {
        var th = k * TAU / 16 - HALF_PI, rad = k % 2 ? 0.18 : 0.24;
        st.push([x + Math.cos(th) * rad, y + Math.sin(th) * rad]);
      }
      poly(c, st, tm.main);
      ell(c, x, y, 0.13, 0.13, tm.dark);
      ell(c, x, y, 0.05, 0.05, GOLD);
    } else {
      ell(c, x, y, 0.17, 0.17, tm.main);
      c.beginPath(); c.arc(x, y, 0.12, 0, TAU); c.strokeStyle = WHITE; c.lineWidth = 0.02; c.stroke();
      ell(c, x, y, 0.05, 0.05, GOLD);
    }
  }

  // ---- legs ---------------------------------------------------------------
  function legs(c, d, r, tm) {
    var st = d.legs || 'pants';
    if (st === 'none') return;
    var col = d.legsCol || (st === 'greave' ? STEEL : st === 'bare' ? (d.skin || SKIN) :
      st === 'bone' ? BONE : st === 'rock' ? (d.skin || '#8d9099') : (d.pants || '#3f3650'));
    var w = st === 'bone' ? 0.06 : st === 'rock' ? 0.17 : st === 'bare' ? 0.085 : 0.12;
    var boot = d.boots || (st === 'greave' ? STEEL_D : '#4e3423');
    var i, hip, f;
    for (i = 0; i < 2; i++) {
      hip = [r.hipX[i], HIP_Y + r.bob];
      f = r.feet[i];
      if (st === 'robe') {
        ell(c, f[0], -0.03, 0.075, 0.04, '#2a2236');
        continue;
      }
      limb(c, hip, f, i ? 1 : -1, w, col, LEG1, LEG2);
      ell(c, f[0] + (i ? 0.02 : -0.02), -0.03, 0.09, 0.045, boot);
    }
    if (st !== 'bone') rr(c, -0.13, HIP_Y + r.bob - 0.05, 0.26, 0.11, 0.05, col);
  }

  // ---- weapons ------------------------------------------------------------
  // Weapon frame: origin at the hand, +y points along the arm, out from the body.
  function weaponDraw(c, d, r, tm, hw) {
    var w = d.w;
    if (!w) return;
    var L = w.len || 0.5;
    c.save();
    c.translate(hw[0], hw[1]);
    c.rotate(-r.wa);
    switch (w.t) {
      case 'sword':
      case 'bonesword':
        rr(c, -0.035, -0.1, 0.07, 0.12, 0.03, '#6b4226');
        rr(c, -0.1, 0.0, 0.2, 0.04, 0.015, GOLD);
        poly(c, [[-0.045, 0.04], [0.045, 0.04], [0.04, L - 0.06], [0, L], [-0.04, L - 0.06]], w.t === 'bonesword' ? BONE : STEEL_L);
        line(c, [[-0.015, 0.09], [-0.015, L - 0.12]], 0.012, WHITE);
        break;
      case 'axe':
        tube(c, [[0, -0.02], [0, L]], 0.05, WOOD);
        rr(c, -0.04, 0.02, 0.08, 0.13, 0.03, tm.main);
        poly(c, [[0, L - 0.16], [0.2, L - 0.14], [0.22, L + 0.02], [0, L + 0.04]], STEEL);
        break;
      case 'bigaxe':
        tube(c, [[0, -0.02], [0, L + 0.08]], 0.055, WOOD);
        rr(c, -0.045, 0.02, 0.09, 0.14, 0.03, tm.main);
        c.beginPath();
        c.moveTo(0, L - 0.22);
        c.quadraticCurveTo(0.34, L - 0.22, 0.3, L + 0.1);
        c.quadraticCurveTo(0.16, L + 0.04, 0, L + 0.12);
        c.closePath();
        paint(c, STEEL, 0.16, L - 0.05, 0.22);
        break;
      case 'hammer':
        tube(c, [[0, -0.02], [0, L]], 0.05, WOOD);
        rr(c, -0.13, L - 0.06, 0.26, 0.16, 0.03, STEEL_D);
        rr(c, -0.13, L + 0.02, 0.26, 0.05, 0.02, tm.main);
        break;
      case 'mace':
        tube(c, [[0, -0.02], [0, L]], 0.05, WOOD);
        rr(c, -0.04, 0.02, 0.08, 0.13, 0.03, tm.main);
        var sp = [];
        for (var k = 0; k < 12; k++) {
          var th = k * TAU / 12, rad = k % 2 ? 0.1 : 0.2;
          sp.push([Math.cos(th) * rad, L + Math.sin(th) * rad]);
        }
        poly(c, sp, STEEL_D);
        break;
      case 'pick':
        tube(c, [[0, -0.02], [0, L]], 0.05, WOOD);
        rr(c, -0.04, 0.02, 0.08, 0.13, 0.03, tm.main);
        c.beginPath();
        c.moveTo(-0.17, L - 0.02);
        c.quadraticCurveTo(0, L - 0.14, 0.2, L);
        c.quadraticCurveTo(0, L + 0.03, -0.17, L - 0.02);
        c.closePath();
        paint(c, STEEL, 0, L, 0.2);
        break;
      case 'spear':
      case 'lance':
        tube(c, [[0, 0], [0, L]], w.t === 'lance' ? 0.05 : 0.045, WOOD);
        poly(c, [[-0.05, L - 0.1], [0.05, L - 0.1], [0, L + 0.12]], STEEL_L);
        if (w.t === 'lance') {
          poly(c, [[0, 0.22], [0.2, 0.28], [0, 0.34]], tm.main);
        } else {
          poly(c, [[0, L - 0.3], [0.2, L - 0.25], [0, L - 0.2]], tm.main);
        }
        break;
      case 'dagger':
        rr(c, -0.03, -0.08, 0.06, 0.1, 0.02, '#3b2a20');
        rr(c, -0.08, 0.0, 0.16, 0.03, 0.01, GOLD);
        poly(c, [[-0.03, 0.03], [0.03, 0.03], [0, L]], STEEL_L);
        break;
      case 'staff':
        tube(c, [[0, 0], [0, L]], 0.05, '#7a4e2a');
        if (r.fx > 0.01) {
          var g = c.createRadialGradient(0, L, 0.01, 0, L, 0.3);
          g.addColorStop(0, 'rgba(255,255,255,' + (0.9 * r.fx) + ')');
          g.addColorStop(0.4, 'rgba(180,240,255,' + (0.55 * r.fx) + ')');
          g.addColorStop(1, 'rgba(180,240,255,0)');
          c.fillStyle = g;
          c.beginPath(); c.arc(0, L, 0.3, 0, TAU); c.fill();
        }
        ell(c, 0, L, 0.085, 0.085, w.orb === 'team' || !w.orb ? tm.main : w.orb);
        ell(c, -0.03, L - 0.03, 0.02, 0.02, WHITE);
        break;
      case 'musket':
        rr(c, -0.03, -0.18, 0.1, 0.2, 0.04, '#7b4b26');
        tube(c, [[0, 0], [0, 0.8]], 0.05, '#4d5563');
        rr(c, -0.02, 0.42, 0.04, 0.06, 0.01, '#3b4352');
        if (r.fire > 0.01) muzzle(c, 0, 0.82, r.fire);
        break;
      case 'cannon':
        rr(c, -0.11, -0.05, 0.22, 0.5, 0.06, STEEL_D);
        rr(c, -0.12, 0.16, 0.24, 0.06, 0.02, tm.main);
        ell(c, 0, 0.46, 0.12, 0.05, '#3b4352');
        if (r.fire > 0.01) smoke(c, 0, 0.5, r.fire);
        break;
      case 'spark':
        var zig = [[-0.12, -0.02], [-0.04, 0.05], [-0.1, 0.1], [0.0, 0.16]];
        line(c, zig, 0.022, mix('#fff27a', '#ffffff', 0.3));
        line(c, [[0.12, 0.02], [0.05, -0.04], [0.11, -0.1]], 0.022, '#fff27a');
        break;
      default:
        break;
    }
    c.restore();
  }
  function muzzle(c, x, y, a) {
    c.save();
    c.globalAlpha *= a;
    c.beginPath();
    for (var k = 0; k < 10; k++) {
      var th = k * TAU / 10, rad = k % 2 ? 0.07 : 0.2;
      c.lineTo(x + Math.cos(th) * rad, y + Math.sin(th) * rad);
    }
    c.closePath();
    c.fillStyle = '#ffd23a';
    c.fill();
    c.lineWidth = OL * ST.k;
    c.strokeStyle = INK;
    c.stroke();
    c.restore();
  }
  function smoke(c, x, y, a) {
    c.save();
    c.globalAlpha *= 0.55 * a;
    c.fillStyle = '#d7d9e4';
    c.beginPath(); c.arc(x, y, 0.13 + 0.12 * (1 - a), 0, TAU); c.fill();
    c.beginPath(); c.arc(x + 0.12, y + 0.08, 0.09, 0, TAU); c.fill();
    c.restore();
  }

  // Bow: archers and princesses. Bow hand holds the grip on -x, draw hand (+x) pulls the nock.
  function bow(c, r, tm, hw) {
    var top = [-0.34, -0.94], bot = [-0.34, -0.18];
    c.save();
    c.beginPath();
    c.moveTo(top[0], top[1]);
    c.quadraticCurveTo(-0.6, -0.56, bot[0], bot[1]);
    c.strokeStyle = INK; c.lineWidth = 0.075; c.lineCap = 'round'; c.stroke();
    c.strokeStyle = WOOD; c.lineWidth = 0.035; c.stroke();
    c.restore();
    line(c, [top, hw, bot], 0.011, '#f0ead8');
    if (r.draw > 0.1) {
      line(c, [hw, [hw[0] + 0.3 * r.draw, hw[1] - 0.005]], 0.02, WOOD);
    }
  }

  // Arm-held items that are not on the arm axis (bomb, fist glow) are handled in human().
  function human(c, d, r, tm) {
    var rs = d.mount ? (d.rs || 0.5) : 1;
    var sc = d.hs || 1;
    var wide = d.wide || 1;
    var skin = d.skin || SKIN;
    var armC = d.arm ? tcol(d.arm, tm) : (d.body === 'rock' ? (d.skin || '#8d9099') :
      d.body === 'skeleton' ? BONE : (d.body === 'plate' || d.body === 'darkplate') ? STEEL :
      bodyFill(d, tm));
    var handC = d.gauntlet || (d.body === 'plate' || d.body === 'darkplate' ? STEEL_D :
      d.body === 'rock' ? (d.skin || '#8d9099') : d.body === 'skeleton' ? BONE : skin);
    var armW = d.body === 'skeleton' ? 0.06 : d.body === 'rock' ? 0.16 : 0.11;
    var handR = (d.w && d.w.t === 'fist') ? 0.1 : 0.056;
    var mount = d.mount;

    if (mount) {
      mountBody(c, mount, r, tm);
      c.translate(0, -0.56);
      c.scale(rs, rs);
      ST.k = 1 / rs;
    }
    legs(c, d, r, tm);
    c.save();
    c.translate(r.lunge, r.bob);
    c.translate(0, HIP_Y);
    c.rotate(r.tilt);
    c.translate(0, -HIP_Y);
    if (d.cape) cape(c, d, r, tm);
    torso(c, d, tm, wide);
    head(c, d, tm, sc);
    var hO = limb(c, SHO_O, r.hO, -1, armW, armC, ARM1, ARM2);
    ell(c, hO[0], hO[1], handR, handR, handC);
    if (d.shield) shield(c, d.shield, hO, tm);
    var hW = limb(c, SHO_W, r.hW, 1, armW, armC, ARM1, ARM2);
    if (d.w && d.w.t === 'bow') {
      bow(c, r, tm, hW);
    }
    if (d.w && d.w.t === 'bomb' && r.bomb < 1) {
      ell(c, hW[0] + 0.02, hW[1], 0.075, 0.075, '#2e2c3a');
      line(c, [[hW[0] + 0.05, hW[1] - 0.07], [hW[0] + 0.1, hW[1] - 0.13]], 0.02, '#8a5a2b');
    }
    ell(c, hW[0], hW[1], handR, handR, handC);
    if (r.trail && r.trail.alpha > 0.02) swingTrail(c, r.trail);
    weaponDraw(c, d, r, tm, hW);
    c.restore();
    ST.k = 1;
  }
  function swingTrail(c, t) {
    var R = REACH + 0.25;
    var s = HALF_PI - t.a0, e = HALF_PI - t.a1;
    c.save();
    c.strokeStyle = 'rgba(255,255,255,' + (0.55 * t.alpha) + ')';
    c.lineWidth = 0.07;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(SHO_W[0], SHO_W[1], R, Math.min(s, e), Math.max(s, e));
    c.stroke();
    c.restore();
  }

  // Per-pose rig. Hands are targets in upper-body space; the limbs are solved by IK.
  function rigFor(d, pose, p) {
    var t = p * TAU;
    var s = Math.sin(t), co = Math.cos(t);
    var hold = d.hold == null ? 0.2 : d.hold;
    var wt = d.w ? d.w.t : null;
    var r = {
      p: p, t: t, moving: false, bob: 0, lunge: 0, tilt: 0, sq: 0, alpha: 1, sway: 0, flap: 0,
      hipX: [-0.09, 0.09], feet: [[-0.09, -0.02], [0.09, -0.02]],
      hW: armPt(SHO_W, hold), hO: armPt(SHO_O, -0.25), wa: hold,
      fx: 0, fire: 0, kick: 0, draw: 0, drop: 0, bomb: 0, trail: null,
    };
    r.moving = pose === 'walk' || pose === 'attack';
    var fixed = wt === 'musket' || wt === 'cannon' || wt === 'bow' || wt === 'staff' || d.k !== 'h';

    // Rest hands and weapon angle; swing amplitude is the arm sway.
    function rest(amp) {
      if (wt === 'musket' || wt === 'cannon') { r.hW = [0.42, -0.5]; r.wa = HALF_PI; r.hO = [-0.02, -0.5]; }
      else if (wt === 'bow') { r.hW = [-0.1, -0.56]; r.hO = [-0.46, -0.56]; r.wa = 0; }
      else if (wt === 'staff') { r.hW = [0.22, -0.42]; r.wa = Math.PI + 0.1; r.hO = [-0.2, -0.44]; }
      else if (wt === 'spark') { r.hW = [0.3, -0.45]; r.hO = [-0.3, -0.45]; r.wa = 0.6; }
      else { r.wa = hold + amp; r.hW = armPt(SHO_W, r.wa); r.hO = armPt(SHO_O, -0.25 - amp); }
    }

    if (pose === 'idle' || !pose) {
      r.bob = 0.012 * s;
      r.sq = 0.012 * s;
      rest(fixed ? 0 : 0.05 * s);
      if (d.k === 'h') r.hO = armPt(SHO_O, -0.25 + 0.05 * Math.sin(t + Math.PI));
    } else if (pose === 'walk') {
      var ab = Math.abs(s);
      r.bob = -0.03 * ab;
      r.sq = 0.025 * ab;
      r.tilt = 0.03 * s;
      r.sway = s;
      r.feet = [0, 1].map(function (i) {
        var q = t + i * Math.PI;
        return [(i ? 0.09 : -0.09) + 0.03 * Math.sin(q), -0.02 - 0.05 * Math.max(0, Math.cos(q))];
      });
      rest(fixed ? 0 : 0.3 * Math.sin(t + Math.PI));
      if (!fixed) r.hO = armPt(SHO_O, -0.25 + 0.3 * s);
      if (d.k !== 'h') { r.bob = 0.03 * s; r.tilt = 0.03 * co; }
    } else if (pose === 'attack') {
      r.hO = armPt(SHO_O, -0.25);
      if (wt === 'bow') {
        var dr = kf(p, [[0, 0], [0.5, 1], [0.7, 1], [0.8, 0], [1, 0]]);
        r.draw = dr;
        r.hW = [-0.1 + 0.22 * dr, -0.56 - 0.08 * dr];
        r.hO = [-0.46, -0.56];
        r.wa = 0;
        r.lunge = -0.02 * dr;
      } else if (wt === 'musket' || wt === 'cannon') {
        r.kick = kf(p, [[0, 0], [0.1, 0], [0.13, 1], [0.3, 0.25], [0.5, 0], [1, 0]]);
        r.fire = kf(p, [[0, 0], [0.1, 0], [0.13, 1], [0.24, 0], [1, 0]]);
        r.hW = [0.42 - 0.07 * r.kick, -0.5];
        r.hO = [-0.02, -0.5];
        r.wa = HALF_PI;
        r.lunge = -0.02 * r.kick;
        r.tilt = 0.03 * r.kick;
      } else if (wt === 'staff') {
        r.wa = kf(p, [[0, Math.PI + 0.1], [0.35, Math.PI - 0.28], [0.6, Math.PI - 0.12], [1, Math.PI + 0.1]]);
        r.hW = kf(p, [[0, [0.22, -0.42]], [0.35, [0.3, -0.7]], [0.6, [0.26, -0.56]], [1, [0.22, -0.42]]]);
        r.hO = [-0.18, -0.45];
        r.fx = kf(p, [[0, 0.35], [0.4, 0.8], [0.55, 1], [0.85, 0.35], [1, 0.35]]);
      } else if (wt === 'fist') {
        r.hW = kf(p, [[0, [0.28, -0.4]], [0.35, [0.3, -1.0]], [0.5, [0.46, -0.3]], [1, [0.28, -0.4]]]);
        r.hO = kf(p, [[0, [-0.28, -0.4]], [0.35, [-0.3, -0.92]], [0.5, [-0.2, -0.3]], [1, [-0.28, -0.4]]]);
        r.wa = Math.atan2(r.hW[0] - SHO_X, r.hW[1] - SHO_Y);
        r.lunge = kf(p, [[0, 0], [0.35, -0.03], [0.5, 0.1], [1, 0]]);
        r.impact = seg(p, 0.5, 0.72) > 0 && p < 0.72 ? 1 - seg(p, 0.5, 0.72) : 0;
      } else if (wt === 'spark') {
        r.hW = kf(p, [[0, [0.3, -0.45]], [0.4, [0.4, -0.6]], [0.6, [0.46, -0.62]], [1, [0.3, -0.45]]]);
        r.hO = kf(p, [[0, [-0.3, -0.45]], [0.4, [-0.4, -0.6]], [0.6, [-0.46, -0.62]], [1, [-0.3, -0.45]]]);
        r.fx = kf(p, [[0, 0.3], [0.4, 0.9], [0.6, 1], [1, 0.3]]);
        r.wa = Math.atan2(r.hW[0] - SHO_X, r.hW[1] - SHO_Y);
      } else if (wt === 'bomb') {
        r.hW = kf(p, [[0, [0.26, -0.42]], [0.3, [0.3, -0.92]], [0.45, [0.5, -0.7]], [1, [0.26, -0.42]]]);
        r.wa = Math.atan2(r.hW[0] - SHO_X, r.hW[1] - SHO_Y);
        r.bomb = p < 0.45 ? 0 : 1;
        r.drop = seg(p, 0.45, 0.8);
      } else if (wt === 'spear' || wt === 'lance') {
        var a = kf(p, [[0, hold], [0.35, -0.9], [0.5, 1.45], [1, hold]]);
        r.wa = a;
        r.hW = armPt(SHO_W, a);
        r.lunge = kf(p, [[0, 0], [0.35, -0.02], [0.5, 0.14], [1, 0]]);
        r.tilt = kf(p, [[0, 0], [0.35, -0.03], [0.5, 0.08], [1, 0]]);
      } else {
        // Swing (sword, axe, hammer, mace, pick) and unarmed fallback.
        var sw = kf(p, [[0, hold], [0.35, -2.6], [0.5, 1.3], [1, hold]]);
        r.wa = sw;
        r.hW = armPt(SHO_W, sw);
        r.hO = armPt(SHO_O, kf(p, [[0, -0.25], [0.35, -0.9], [0.5, -0.5], [1, -0.25]]));
        r.lunge = kf(p, [[0, 0], [0.35, -0.03], [0.5, 0.09], [1, 0]]);
        r.tilt = kf(p, [[0, 0], [0.35, -0.08], [0.5, 0.12], [1, 0]]);
        if (p > 0.3 && p < 0.72) r.trail = { a0: -2.6, a1: sw, alpha: 1 - seg(p, 0.5, 0.72) };
      }
      // Non-humanoid attacks: lunge, dive, or spit.
      if (d.k !== 'h') {
        r.lunge = kf(p, [[0, 0], [0.35, -0.05], [0.5, 0.12], [1, 0]]);
        r.tilt = kf(p, [[0, 0], [0.35, -0.08], [0.5, 0.14], [1, 0]]);
        r.fire = kf(p, [[0, 0], [0.3, 0], [0.45, 1], [0.75, 0.6], [1, 0]]);
        r.drop = seg(p, 0.45, 0.8);
        r.bob = 0.03 * s;
      }
    } else if (pose === 'death') {
      var f = sstep(seg(p, 0, 0.5));
      r.tilt = -1.3 * f;
      r.lunge = -0.1 * f;
      r.bob = -0.02 * f;
      r.alpha = 1 - sstep(seg(p, 0.55, 1));
      r.hW = armPt(SHO_W, 1.1 + 0.6 * f * Math.sin(p * TAU * 1.5));
      r.hO = armPt(SHO_O, -1.0 - 0.5 * f * Math.cos(p * TAU * 1.5));
      r.wa = Math.atan2(r.hW[0] - SHO_X, r.hW[1] - SHO_Y);
      r.feet = [[-0.14 - 0.05 * f, -0.02 - 0.05 * f], [0.14 + 0.05 * f, -0.02]];
      r.sq = 0;
      if (d.k !== 'h') { r.tilt = -1.2 * f; r.bob = 0.1 * f; r.lunge = -0.05 * f; }
    }
    r.flap = d.k === 'h' ? 0 : pose === 'death' ? 0.2 : pose === 'attack' ? 1 : Math.sin(t * 2);
    return r;
  }

  // ---- mounts -------------------------------------------------------------
  function mountBody(c, kind, r, tm) {
    if (kind === 'horse') {
      var legX = [-0.26, -0.14, 0.14, 0.26], ph = [0, Math.PI, Math.PI, 0], i;
      for (i = 0; i < 4; i++) {
        var q = r.t + ph[i];
        var foot = r.moving ? [legX[i] + 0.04 * Math.sin(q), -0.02 - 0.05 * Math.max(0, Math.cos(q))] : [legX[i], -0.02];
        limb(c, [legX[i], -0.34], foot, legX[i] < 0 ? -1 : 1, 0.09, '#5a3a22', 0.18, 0.18);
      }
      tube(c, [[-0.4, -0.46], [-0.52, -0.4], [-0.5, -0.3]], 0.05, '#3e2a1a');
      ell(c, 0, -0.44, 0.42, 0.17, '#9b6a43');
      tube(c, [[0.3, -0.5], [0.42, -0.7]], 0.15, '#9b6a43');
      tube(c, [[0.28, -0.62], [0.42, -0.8]], 0.05, '#3e2a1a');
      ell(c, 0.5, -0.76, 0.13, 0.1, '#9b6a43', 0.2);
      ell(c, 0.6, -0.72, 0.07, 0.05, '#d6b08a');
      ell(c, 0.54, -0.8, 0.02, 0.02, INK);
      poly(c, [[-0.22, -0.58], [0.18, -0.58], [0.2, -0.3], [-0.24, -0.3]], tm.main);
      line(c, [[-0.24, -0.3], [0.2, -0.3]], 0.03, GOLD);
    } else {
      // Boar: short legs, snout, tusks, saddle blanket.
      var bx = [-0.22, -0.1, 0.1, 0.22], bp = [0, Math.PI, Math.PI, 0], j;
      for (j = 0; j < 4; j++) {
        var qq = r.t + bp[j];
        var ft = r.moving ? [bx[j] + 0.03 * Math.sin(qq), -0.02 - 0.04 * Math.max(0, Math.cos(qq))] : [bx[j], -0.02];
        limb(c, [bx[j], -0.2], ft, bx[j] < 0 ? -1 : 1, 0.085, '#7a4d3a', 0.14, 0.12);
      }
      tube(c, [[-0.38, -0.4], [-0.46, -0.44], [-0.44, -0.5]], 0.035, '#7a4d3a');
      ell(c, 0, -0.36, 0.42, 0.22, '#c98a73');
      ell(c, 0.42, -0.36, 0.1, 0.09, '#f0a7a0');
      poly(c, [[0.38, -0.31], [0.34, -0.24], [0.44, -0.28]], WHITE);
      poly(c, [[0.3, -0.42], [0.22, -0.52], [0.34, -0.48]], '#9b6a50');
      ell(c, 0.3, -0.44, 0.02, 0.02, INK);
      poly(c, [[-0.2, -0.52], [0.16, -0.52], [0.18, -0.32], [-0.22, -0.32]], tm.main);
      line(c, [[-0.22, -0.32], [0.18, -0.32]], 0.03, GOLD);
    }
    ST.k = 1;
  }

  // ---- non-humanoid bodies -------------------------------------------------
  function blob(c, d, r, tm) {
    var kind = d.kind;
    var col = kind === 'ice' ? '#8fe4ff' : kind === 'fire' ? '#ff8a2a' : '#ffe84a';
    var inner = kind === 'ice' ? '#e8fbff' : kind === 'fire' ? '#ffd23a' : '#fffbd0';
    var n = kind === 'elec' ? 9 : kind === 'ice' ? 6 : 7;
    var amp = kind === 'ice' ? 0.14 : kind === 'fire' ? 0.1 : 0.12;
    c.save();
    c.translate(0, r.bob);
    var pts = [];
    for (var k = 0; k < n * 2; k++) {
      var th = k * TAU / (n * 2) - HALF_PI;
      var rad = 0.36 + (k % 2 ? amp : 0) + 0.02 * Math.sin(r.t * 2 + k);
      pts.push([Math.cos(th) * rad * 1.05, -0.5 + Math.sin(th) * rad]);
    }
    poly(c, pts, col);
    ell(c, 0, -0.48, 0.2, 0.19, inner);
    ell(c, -0.12, -0.52, 0.045, 0.06, INK);
    ell(c, 0.12, -0.52, 0.045, 0.06, INK);
    c.fillStyle = WHITE;
    c.beginPath(); c.arc(-0.1, -0.545, 0.016, 0, TAU); c.fill();
    c.beginPath(); c.arc(0.14, -0.545, 0.016, 0, TAU); c.fill();
    line(c, [[-0.06, -0.4], [0, -0.38], [0.06, -0.4]], 0.02, INK);
    ell(c, 0, -0.1, 0.24, 0.06, tm.main);
    c.restore();
  }
  function bat(c, d, r, tm) {
    var fl = r.flap;
    c.save();
    c.translate(0, r.bob - 0.1 + 0.03 * fl);
    for (var side = -1; side <= 1; side += 2) {
      c.save();
      c.scale(side, 1);
      c.beginPath();
      c.moveTo(0.08, -0.62);
      c.quadraticCurveTo(0.4, -0.98 - 0.12 * fl, 0.84, -0.84 - 0.2 * fl);
      c.quadraticCurveTo(0.72, -0.66, 0.6, -0.56);
      c.quadraticCurveTo(0.5, -0.5, 0.4, -0.56);
      c.quadraticCurveTo(0.28, -0.46, 0.08, -0.5);
      c.closePath();
      paint(c, tm.dark === undefined ? '#6b4aa0' : mix(tm.main, '#20124a', 0.25), 0.45, -0.7, 0.45);
      line(c, [[0.1, -0.6], [0.8, -0.86 - 0.18 * fl]], 0.02, INK);
      c.restore();
    }
    ell(c, 0, -0.56, 0.14, 0.18, '#4c3b6e');
    poly(c, [[-0.13, -0.66], [-0.2, -0.82], [-0.05, -0.7]], '#4c3b6e');
    poly(c, [[0.13, -0.66], [0.2, -0.82], [0.05, -0.7]], '#4c3b6e');
    ell(c, -0.055, -0.6, 0.04, 0.035, '#ffd23a');
    ell(c, 0.055, -0.6, 0.04, 0.035, '#ffd23a');
    ell(c, -0.055, -0.6, 0.015, 0.02, INK);
    ell(c, 0.055, -0.6, 0.015, 0.02, INK);
    c.restore();
  }
  function minion(c, d, r, tm) {
    var fl = r.flap;
    c.save();
    c.translate(0, r.bob - 0.08);
    for (var side = -1; side <= 1; side += 2) {
      c.save();
      c.scale(side, 1);
      c.beginPath();
      c.moveTo(0.12, -0.6);
      c.quadraticCurveTo(0.42, -0.9 - 0.1 * fl, 0.5, -0.72 - 0.12 * fl);
      c.quadraticCurveTo(0.42, -0.68, 0.36, -0.58);
      c.quadraticCurveTo(0.3, -0.52, 0.12, -0.5);
      c.closePath();
      paint(c, '#3d2466', 0.3, -0.7, 0.3);
      c.restore();
    }
    tube(c, [[0, -0.22], [0.16, -0.14], [0.22, -0.2]], 0.04, '#6d3fa8');
    ell(c, 0, -0.55, 0.26, 0.3, '#7a48b8');
    poly(c, [[-0.2, -0.78], [-0.26, -0.96], [-0.1, -0.8]], '#e8e0d0');
    poly(c, [[0.2, -0.78], [0.26, -0.96], [0.1, -0.8]], '#e8e0d0');
    ell(c, -0.1, -0.6, 0.08, 0.09, '#ffe24a');
    ell(c, 0.1, -0.6, 0.08, 0.09, '#ffe24a');
    ell(c, -0.1, -0.6, 0.03, 0.04, INK);
    ell(c, 0.1, -0.6, 0.03, 0.04, INK);
    c.fillStyle = INK;
    c.beginPath(); c.moveTo(-0.1, -0.44); c.quadraticCurveTo(0, -0.38, 0.1, -0.44); c.fill();
    rr(c, -0.24, -0.4, 0.48, 0.1, 0.04, tm.main);
    c.restore();
  }
  function dragon(c, d, r, tm) {
    var fl = r.flap;
    c.save();
    c.translate(0, r.bob);
    tube(c, [[0, -0.36], [0.26, -0.3], [0.38, -0.22]], 0.08, '#4bae5e');
    ell(c, 0.4, -0.22, 0.05, 0.05, '#2f8a48');
    for (var side = -1; side <= 1; side += 2) {
      c.save();
      c.scale(side, 1);
      c.beginPath();
      c.moveTo(0.06, -0.5);
      c.quadraticCurveTo(0.5, -0.98 - 0.12 * fl, 0.62, -0.64 - 0.06 * fl);
      c.quadraticCurveTo(0.54, -0.52, 0.42, -0.5);
      c.quadraticCurveTo(0.3, -0.38, 0.06, -0.4);
      c.closePath();
      paint(c, mix(tm.main, '#ffffff', 0.1), 0.35, -0.6, 0.35);
      line(c, [[0.08, -0.48], [0.58, -0.7 - 0.08 * fl]], 0.02, INK);
      c.restore();
    }
    tube(c, [[-0.12, -0.28], [-0.14, -0.14]], 0.1, '#2f8a48');
    tube(c, [[0.12, -0.28], [0.14, -0.14]], 0.1, '#2f8a48');
    ell(c, 0, -0.48, 0.28, 0.3, '#5fbf6a');
    ell(c, 0, -0.42, 0.16, 0.2, '#c9ef9a');
    ell(c, 0.02, -0.84, 0.22, 0.19, '#5fbf6a');
    ell(c, 0.14, -0.8, 0.12, 0.08, '#7fd47e');
    poly(c, [[-0.14, -0.96], [-0.18, -1.12], [-0.06, -0.98]], '#efe4c4');
    poly(c, [[0.1, -0.98], [0.16, -1.1], [0.2, -0.96]], '#efe4c4');
    ell(c, -0.08, -0.86, 0.04, 0.05, INK);
    ell(c, 0.1, -0.86, 0.04, 0.05, INK);
    c.fillStyle = WHITE;
    c.beginPath(); c.arc(-0.07, -0.88, 0.014, 0, TAU); c.fill();
    c.beginPath(); c.arc(0.11, -0.88, 0.014, 0, TAU); c.fill();
    if (r.fire > 0.02) {
      c.save();
      c.globalAlpha *= r.fire;
      poly(c, [[0.26, -0.8], [0.9, -0.92], [0.92, -0.68], [0.26, -0.72]], '#ff8a2a');
      poly(c, [[0.3, -0.78], [0.7, -0.84], [0.72, -0.72], [0.3, -0.74]], '#ffd23a');
      c.restore();
    }
    c.restore();
  }
  function balloonDraw(c, d, r, tm) {
    c.save();
    c.translate(0, r.bob);
    line(c, [[-0.2, -0.3], [-0.16, -0.16]], 0.02, '#5a4330');
    line(c, [[0.2, -0.3], [0.16, -0.16]], 0.02, '#5a4330');
    ell(c, 0, -0.66, 0.42, 0.36, tm.main);
    line(c, [[0, -1.0], [0.2, -0.66], [0, -0.32]], 0.018, INK);
    line(c, [[0, -1.0], [-0.2, -0.66], [0, -0.32]], 0.018, INK);
    rr(c, -0.17, -0.2, 0.34, 0.16, 0.04, '#a0683e');
    line(c, [[-0.17, -0.12], [0.17, -0.12]], 0.015, '#6b4a2e');
    var drop = r.drop || 0;
    ell(c, 0.27, -0.2 + 0.6 * drop, 0.07, 0.07, '#2e2c3a');
    line(c, [[0.3, -0.27 + 0.6 * drop], [0.33, -0.33 + 0.6 * drop]], 0.02, '#8a5a2b');
    c.restore();
  }
  // Lava hound and lava pup: rock body with lava cracks, team harness, big head and fangs.
  function hound(c, d, r, tm) {
    var fl = r.flap;
    var ROCK = '#4d3b3c', ROCK_D = '#3a2c2c';
    c.save();
    c.translate(0, r.bob);
    for (var side = -1; side <= 1; side += 2) {
      c.save();
      c.scale(side, 1);
      c.beginPath();
      c.moveTo(-0.04, -0.66);
      c.lineTo(0.16, -1.04 - 0.1 * fl);
      c.lineTo(0.3, -0.9 - 0.04 * fl);
      c.lineTo(0.52, -1.14 - 0.14 * fl);
      c.lineTo(0.42, -0.8);
      c.lineTo(0.58, -0.76);
      c.lineTo(0.3, -0.6);
      c.lineTo(0.12, -0.56);
      c.closePath();
      paint(c, ROCK_D, 0.25, -0.85, 0.32);
      line(c, [[0.0, -0.66], [0.16, -1.0 - 0.1 * fl], [0.5, -1.1 - 0.14 * fl]], 0.035, '#ff7a1a');
      c.restore();
    }
    var lg = [-0.22, -0.06, 0.18, 0.3], i;
    for (i = 0; i < 4; i++) {
      tube(c, [[lg[i], -0.36], [lg[i] + (i < 2 ? -0.02 : 0.02), -0.06]], 0.13, ROCK_D);
      ell(c, lg[i] + (i < 2 ? -0.03 : 0.03), -0.04, 0.09, 0.05, '#2c2222');
    }
    ell(c, -0.02, -0.46, 0.44, 0.28, ROCK);
    // Lava cracks: orange glow with a yellow core.
    var crack = [[-0.3, -0.5], [-0.16, -0.36], [-0.02, -0.52], [0.14, -0.38], [0.28, -0.5]];
    line(c, crack, 0.06, '#ff7a1a');
    line(c, crack, 0.022, '#ffd23a');
    // Team harness: two straps and a chest plate.
    poly(c, [[-0.4, -0.62], [-0.32, -0.66], [0.22, -0.3], [0.14, -0.26]], tm.main);
    poly(c, [[-0.2, -0.66], [-0.12, -0.7], [0.36, -0.38], [0.28, -0.34]], tm.main);
    rr(c, -0.12, -0.52, 0.2, 0.14, 0.03, tm.main);
    // Neck and head.
    tube(c, [[0.22, -0.52], [0.36, -0.62]], 0.2, ROCK);
    ell(c, 0.4, -0.7, 0.21, 0.18, '#5a4646');
    ell(c, 0.57, -0.62, 0.1, 0.09, '#5a4646');
    poly(c, [[0.22, -0.8], [0.58, -0.84], [0.6, -0.74], [0.26, -0.72]], ROCK_D);
    ell(c, 0.34, -0.74, 0.055, 0.055, '#ff9a2a');
    ell(c, 0.47, -0.76, 0.055, 0.055, '#ff9a2a');
    ell(c, 0.35, -0.74, 0.024, 0.03, INK);
    ell(c, 0.48, -0.76, 0.024, 0.03, INK);
    poly(c, [[0.5, -0.57], [0.54, -0.46], [0.58, -0.57]], WHITE);
    poly(c, [[0.62, -0.6], [0.65, -0.5], [0.68, -0.6]], WHITE);
    c.restore();
  }

  // Buildings: 1 unit tall, footprint about 0.7 wide.
  function building(c, d, r, tm) {
    var k = d.kind;
    c.save();
    if (k === 'cannon') {
      rr(c, -0.36, -0.42, 0.72, 0.42, 0.12, '#8e9aa8');
      rr(c, -0.36, -0.22, 0.72, 0.06, 0.02, tm.main);
      c.translate(0, -0.5);
      c.rotate(-0.45 - 0.06 * (r.kick || 0));
      rr(c, -0.06, -0.12, 0.62, 0.24, 0.08, STEEL_D);
      ell(c, 0.6, 0, 0.09, 0.14, '#3b4352');
      c.rotate(0.45 + 0.06 * (r.kick || 0));
      c.translate(0, 0.5);
      ell(c, -0.22, -0.02, 0.1, 0.1, '#6b4a2e');
      ell(c, 0.22, -0.02, 0.1, 0.1, '#6b4a2e');
      line(c, [[0.3, -0.42], [0.3, -0.9]], 0.02, '#5a4330');
      poly(c, [[0.3, -0.9], [0.52, -0.84], [0.3, -0.78]], tm.main);
    } else if (k === 'inferno') {
      var fh = 0.2 + 0.05 * Math.sin(r.t * 3) + 0.08 * (r.fire || 0);
      rr(c, -0.26, -0.2, 0.52, 0.2, 0.05, '#6f7180');
      rr(c, -0.16, -0.78, 0.32, 0.6, 0.05, '#8a8c99');
      rr(c, -0.17, -0.5, 0.34, 0.07, 0.02, tm.main);
      ell(c, 0, -0.8, 0.26, 0.1, '#55505a');
      poly(c, [[-0.13, -0.82], [0, -0.82 - fh], [0.13, -0.82]], '#ff8a2a');
      poly(c, [[-0.06, -0.82], [0.02, -0.82 - fh * 0.6], [0.08, -0.82]], '#ffd23a');
    } else if (k === 'tomb') {
      c.beginPath();
      c.moveTo(-0.3, 0);
      c.lineTo(-0.3, -0.55);
      c.quadraticCurveTo(-0.3, -0.84, 0, -0.84);
      c.quadraticCurveTo(0.3, -0.84, 0.3, -0.55);
      c.lineTo(0.3, 0);
      c.closePath();
      paint(c, '#a6aeb8', 0, -0.4, 0.4);
      rr(c, -0.04, -0.72, 0.08, 0.36, 0.02, '#5a6270');
      rr(c, -0.14, -0.6, 0.28, 0.07, 0.02, '#5a6270');
      rr(c, -0.3, -0.2, 0.6, 0.07, 0.02, tm.main);
      ell(c, 0, 0, 0.42, 0.06, '#5b4a3a');
    } else if (k === 'hut') {
      rr(c, -0.35, -0.5, 0.7, 0.5, 0.04, '#a8703e');
      for (var j = 0; j < 3; j++) line(c, [[-0.35, -0.44 + j * 0.13], [0.35, -0.44 + j * 0.13]], 0.016, '#7a4e2a');
      poly(c, [[-0.44, -0.46], [0, -0.92], [0.44, -0.46]], '#7a8f3a');
      rr(c, -0.1, -0.28, 0.2, 0.28, 0.04, '#5a3a22');
      line(c, [[0.3, -0.8], [0.3, -1.12]], 0.025, '#5a4330');
      poly(c, [[0.3, -1.12], [0.5, -1.06], [0.3, -1.0]], tm.main);
      rr(c, -0.35, -0.3, 0.7, 0.05, 0.02, tm.main);
    } else if (k === 'tesla') {
      rr(c, -0.22, -0.2, 0.44, 0.2, 0.04, '#6e7a8d');
      rr(c, -0.07, -0.72, 0.14, 0.54, 0.03, '#8d97a8');
      ell(c, 0, -0.42, 0.14, 0.04, '#55606f');
      ell(c, 0, -0.58, 0.14, 0.04, '#55606f');
      ell(c, 0, -0.82, 0.16, 0.16, tm.main);
      ell(c, -0.04, -0.86, 0.04, 0.04, WHITE);
      if (r.fire > 0.02) {
        line(c, [[0.1, -0.8], [0.3, -0.9], [0.22, -0.98]], 0.02, '#8ff3ff');
        line(c, [[-0.1, -0.76], [-0.3, -0.7], [-0.28, -0.84]], 0.02, '#8ff3ff');
      }
    } else {
      rr(c, -0.3, -0.7, 0.6, 0.7, 0.05, '#8e9aa8');
      poly(c, [[-0.36, -0.68], [0, -0.92], [0.36, -0.68]], tm.main);
    }
    c.restore();
  }

  // ---- defs ---------------------------------------------------------------
  // s: size relative to a standard character (bake applies it).
  // k: 'h' humanoid (mount optional), 'bat' 'minion' 'dragon' 'balloon' 'hound' 'blob' 'bld'.
  var SOLDIER = { k: 'h', s: 1, body: 'tunic', fill: 'team', legs: 'pants', pants: '#3f3650', top: 'helm', face: 'cute', w: { t: 'sword', len: 0.5 }, hold: 0.2 };
  var DEFS = {
    knight: { k: 'h', s: 1, body: 'plate', legs: 'greave', top: 'great', plume: true, face: 'visor', w: { t: 'sword', len: 0.5 }, shield: 'kite', hold: 0.3 },
    archer: { k: 'h', s: 1, body: 'tunic', fill: 'team', legs: 'pants', pants: '#4a3a2e', top: 'hair', hair: '#6b3e1e', bun: true, face: 'cute', w: { t: 'bow' }, hold: 0.2 },
    giant: { k: 'h', s: 1.12, body: 'bulky', legs: 'pants', pants: '#4f3a2c', top: 'hair', hair: '#3d2a1a', spiky: true, face: 'grim', w: { t: 'fist' }, wide: 1.4, hs: 1.02, skin: '#e9a878' },
    musketeer: { k: 'h', s: 1, body: 'coat', legs: 'pants', pants: '#ece6d6', top: 'tricorn', face: 'smirk', w: { t: 'musket' }, hold: 0.1 },
    minipekka: { k: 'h', s: 0.92, body: 'plate', legs: 'greave', top: 'pekka', face: 'visor', w: { t: 'sword', len: 0.55 }, hold: 0.25, wide: 1.05 },
    pekka: { k: 'h', s: 1.12, body: 'plate', legs: 'greave', top: 'pekka', face: 'visor', w: { t: 'sword', len: 0.8 }, hold: 0.2, wide: 1.2 },
    goblin: { k: 'h', s: 0.72, body: 'bare', skin: GOB, legs: 'bare', top: 'bandana', head: 'goblin', face: 'grin', w: { t: 'dagger', len: 0.3 }, hold: 0.3, wide: 0.85, hs: 1.05 },
    speargoblin: { k: 'h', s: 0.75, body: 'bare', skin: GOB, legs: 'bare', top: 'bandana', head: 'goblin', face: 'grin', w: { t: 'spear', len: 0.95 }, hold: 0.3, wide: 0.85, hs: 1.05 },
    skeleton: { k: 'h', s: 0.84, body: 'skeleton', skin: BONE, legs: 'bone', top: 'none', head: 'skull', face: 'skull', w: { t: 'bonesword', len: 0.36 }, hold: 0.25, wide: 0.9 },
    babydragon: { k: 'dragon', s: 0.9 },
    hogrider: { k: 'h', s: 0.95, mount: 'boar', rs: 0.6, body: 'tunic', fill: '#d9a46a', legs: 'pants', pants: '#3e3247', top: 'bandana', face: 'fierce', w: { t: 'hammer', len: 0.42 }, hold: 0.2 },
    valkyrie: { k: 'h', s: 1.05, body: 'plate', fill: '#c3ccdb', legs: 'greave', top: 'viking', horn: '#efe4c4', hair: '#f0c85a', long: true, face: 'fierce', w: { t: 'bigaxe', len: 0.48 }, shield: 'round', hold: 0.25, wide: 1.12, cape: 'team' },
    wizard: { k: 'h', s: 1, body: 'robe', robe: 'team', legs: 'robe', top: 'wizard', hat: '#5b35a6', beard: '#f5f0e6', face: 'happy', w: { t: 'staff', len: 0.8, orb: 'team' }, hold: 0.2 },
    minion: { k: 'minion', s: 0.62 },
    prince: { k: 'h', s: 1, mount: 'horse', rs: 0.52, body: 'plate', legs: 'greave', top: 'great', plume: true, face: 'visor', w: { t: 'lance', len: 1.05 }, cape: 'team', hold: 0.9, wide: 1.0 },
    balloon: { k: 'balloon', s: 1.1 },
    bomber: { k: 'h', s: 0.92, body: 'bib', fill: '#e8dcc4', legs: 'pants', pants: '#3c3550', top: 'cap', face: 'grin', w: { t: 'bomb' }, hold: 0.25 },
    icespirit: { k: 'blob', kind: 'ice', s: 0.6 },
    witch: { k: 'h', s: 1, body: 'robe', robe: '#7b3ea8', trim: 'team', legs: 'robe', top: 'witch', hat: '#3b2a66', hair: '#8a4ac0', long: true, face: 'smirk', w: { t: 'staff', len: 0.85, orb: '#7cf5a0' }, hold: 0.2 },
    golem: { k: 'h', s: 1.2, body: 'rock', legs: 'rock', top: 'rock', head: 'rock', face: 'glow', w: { t: 'fist' }, skin: '#8d9099', wide: 1.45, hs: 1.05, hold: 0.2 },
    golemite: { k: 'h', s: 0.78, body: 'rock', legs: 'rock', top: 'rock', head: 'rock', face: 'glow', w: { t: 'fist' }, skin: '#8d9099', wide: 1.25, hs: 1.0, hold: 0.2 },
    barbarian: { k: 'h', s: 1, body: 'fur', skin: SKIN, legs: 'pants', pants: '#6b4a2e', top: 'hair', hair: '#3a2616', beard: '#3a2616', face: 'fierce', w: { t: 'sword', len: 0.62 }, hold: 0.25, wide: 1.1 },
    bat: { k: 'bat', s: 0.55 },
    royalgiant: { k: 'h', s: 1.12, body: 'bulky', fill: '#a9b4c6', legs: 'greave', top: 'crown', face: 'grim', w: { t: 'cannon' }, wide: 1.35, hs: 1.04, hold: 0.2 },
    princess: { k: 'h', s: 0.9, body: 'dress', legs: 'none', top: 'tiara', hair: '#ffd65c', long: true, face: 'cute', w: { t: 'bow' }, hold: 0.2 },
    electrowizard: { k: 'h', s: 1, body: 'robe', robe: 'team', legs: 'robe', top: 'hair', hair: '#ffe066', spiky: true, face: 'fierce', w: { t: 'spark' }, hold: 0.2 },
    miner: { k: 'h', s: 0.95, body: 'bib', fill: '#7e8ea8', legs: 'pants', pants: '#3a4a6a', top: 'hardhat', face: 'grin', w: { t: 'pick', len: 0.5 }, hold: 0.2 },
    megaknight: { k: 'h', s: 1.12, body: 'plate', fill: '#8f9bb0', legs: 'greave', top: 'viking', horn: '#7a5230', face: 'visor', w: { t: 'mace', len: 0.48 }, shield: 'spike', hold: 0.2, wide: 1.3 },
    bandit: { k: 'h', s: 0.92, body: 'leather', legs: 'pants', pants: '#2d2a3a', top: 'mask', hood: '#2e2a3a', face: 'mask', cape: 'team', w: { t: 'dagger', len: 0.32 }, hold: 0.25 },
    icewizard: { k: 'h', s: 0.98, body: 'robe', robe: 'team', trim: '#8fe7ff', legs: 'robe', top: 'wizard', hat: '#9be8ff', beard: '#e8f6ff', face: 'happy', w: { t: 'staff', len: 0.8, orb: '#bff3ff' }, hold: 0.2 },
    lavahound: { k: 'hound', s: 1.12 },
    lavapup: { k: 'hound', s: 0.72, small: true },
    darkprince: { k: 'h', s: 1.02, body: 'darkplate', legs: 'greave', legsCol: '#3f3352', top: 'darkhelm', face: 'visor', w: { t: 'sword', len: 0.5 }, shield: 'spike', hold: 0.25, cape: 'team', wide: 1.1 },
    electrospirit: { k: 'blob', kind: 'elec', s: 0.6 },
    firespirit: { k: 'blob', kind: 'fire', s: 0.66 },
    executioner: { k: 'h', s: 1.05, body: 'apron', fill: '#3a2f3f', legs: 'pants', pants: '#2e2834', top: 'mask', hood: '#2a2530', face: 'mask', w: { t: 'bigaxe', len: 0.5 }, hold: 0.25, wide: 1.12 },
    lumberjack: { k: 'h', s: 1.05, body: 'plaid', fill: 'team', legs: 'pants', pants: '#2e3848', top: 'beanie', hair: '#6b3d1f', beard: '#6b3d1f', face: 'fierce', w: { t: 'axe', len: 0.5 }, hold: 0.25, wide: 1.12 },
    cannon: { k: 'bld', kind: 'cannon', s: 0.95 },
    infernotower: { k: 'bld', kind: 'inferno', s: 1.25 },
    tombstone: { k: 'bld', kind: 'tomb', s: 0.9 },
    goblinhut: { k: 'bld', kind: 'hut', s: 1.12 },
    tesla: { k: 'bld', kind: 'tesla', s: 1.2 },
    __soldier: SOLDIER,
    __bld: { k: 'bld', kind: 'generic', s: 1 },
  };

  function defOf(id) {
    if (DEFS[id]) return DEFS[id];
    var u = CR.UNITS && CR.UNITS[id];
    if (u && u.kind === 'building') return DEFS.__bld;
    return DEFS.__soldier;
  }

  // ---- public -------------------------------------------------------------
  function draw(ctx, unitId, team, pose, phase, opts) {
    opts = opts || {};
    var d = defOf(unitId);
    var tm = teamOf(team);
    var p = phase - Math.floor(phase);
    var r = rigFor(d, pose || 'idle', p);
    ST.flash = clamp(+opts.flash || 0, 0, 1);
    ST.ice = opts.frozen ? 1 : 0;
    ST.k = 1;
    ctx.save();
    ctx.scale(opts.facing === -1 ? -1 : 1, 1);
    ctx.globalAlpha = ctx.globalAlpha * r.alpha;
    ctx.scale(1 + r.sq * 0.5, 1 - r.sq);
    ctx.translate(0, 0);
    if (d.k === 'h') {
      ctx.save();
      human(ctx, d, r, tm);
      ctx.restore();
    } else {
      // Non-humanoids share one tilt and lunge, so death and dive read the same everywhere.
      ctx.translate(r.lunge, 0);
      ctx.translate(0, -0.4);
      ctx.rotate(r.tilt);
      ctx.translate(0, 0.4);
    }
    if (d.k === 'blob') {
      blob(ctx, d, r, tm);
    } else if (d.k === 'bat') {
      bat(ctx, d, r, tm);
    } else if (d.k === 'minion') {
      minion(ctx, d, r, tm);
    } else if (d.k === 'dragon') {
      dragon(ctx, d, r, tm);
    } else if (d.k === 'balloon') {
      balloonDraw(ctx, d, r, tm);
    } else if (d.k === 'hound') {
      hound(ctx, d, r, tm);
    } else if (d.k === 'bld') {
      building(ctx, d, r, tm);
    }
    ctx.restore();
    if (opts.frozen) frost(ctx);
    ST.flash = 0;
    ST.ice = 0;
    ST.k = 1;
  }
  function frost(ctx) {
    ctx.save();
    ctx.globalAlpha *= 0.85;
    ctx.fillStyle = 'rgba(190,240,255,0.8)';
    ctx.strokeStyle = 'rgba(40,110,150,0.9)';
    ctx.lineWidth = OL;
    [[-0.3, 0.02, 0.1], [0.05, 0.03, 0.12], [0.3, 0.0, 0.09]].forEach(function (s) {
      ctx.beginPath();
      ctx.moveTo(s[0] - 0.05, s[1]);
      ctx.lineTo(s[0], s[1] - s[2]);
      ctx.lineTo(s[0] + 0.05, s[1]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  var cache = new Map();
  function makeCanvas(w, h) {
    if (typeof document !== 'undefined' && document.createElement) {
      var cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      return cv;
    }
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    throw new Error('TroopArt.bake needs a canvas');
  }
  function bake(unitId, team, opts) {
    opts = opts || {};
    var h = opts.height || 96;
    var dpr = opts.dpr || (typeof devicePixelRatio === 'number' ? Math.min(2, devicePixelRatio) : 1);
    var ti = teamIndex(team);
    var poses = opts.poses || POSES;
    var key = [unitId, ti, h, dpr, poses.join('.')].join('|');
    if (cache.has(key)) return cache.get(key);
    var d = defOf(unitId);
    var px = h * dpr;
    var W = Math.ceil(1.9 * px), H = Math.ceil(1.7 * px);
    var ox = 0.95 * px, oy = 1.55 * px;
    var frames = {};
    poses.forEach(function (pose) {
      var n = FRAMES[pose] || 4;
      frames[pose] = [];
      for (var i = 0; i < n; i++) {
        var cv = makeCanvas(W, H);
        var cx = cv.getContext('2d');
        cx.setTransform(px * d.s, 0, 0, px * d.s, ox, oy);
        draw(cx, unitId, ti, pose, i / n, {});
        frames[pose].push(cv);
      }
    });
    var out = {
      frames: frames,
      fps: 8,
      size: {
        width: W, height: H, cssHeight: h, dpr: dpr,
        anchor: [ox, oy], scale: d.s, pxPerUnit: px * d.s,
        // Content box in units relative to the feet, for placing the canvas.
        bounds: { x0: -0.95, x1: 0.95, y0: -1.55, y1: 0.15 },
      },
    };
    cache.set(key, out);
    return out;
  }

  CR.TroopArt = {
    draw: draw,
    bake: bake,
    POSES: POSES.slice(),
    FRAMES: Object.assign({}, FRAMES),
    scaleOf: function (unitId) { return defOf(unitId).s; },
    has: function (unitId) { return !!DEFS[unitId] || !!(CR.UNITS && CR.UNITS[unitId]); },
    clearCache: function () { cache.clear(); cmemo.clear(); },
    teamIndex: teamIndex,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CR;
})();
