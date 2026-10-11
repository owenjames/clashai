// Canvas 2D renderer for the battle screen: layout, hit testing, and all drawing.
// Layout and hit tests work in CSS px. The arena is drawn in tile units through a transform.
// Visual-only state (hit flashes, fall-in, crown pops, particles) lives here, keyed off engine state.
var CR = (globalThis.CR = globalThis.CR || {});

(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var W = 18;
  var H = 32;
  var TOP_BAR_H = 44;
  var PANEL_MIN_H = 126;
  var PANEL_TILES = 4.2;
  var MARGIN = 10;
  var CARD_GAP = 6;
  var NEXT_W = 44;
  var CARD_LIFT = 8;
  var BAR_H = 22;
  var BAR_GAP = 10;
  var DEPLOY_CACHE_MS = 150;
  var LUNGE_T = 0.15;
  var FLASH_MS = 80;
  var FALL_T = 0.25;      // seconds a dropped unit takes to land
  var FALL_H = 2.6;       // tiles above the landing point it starts from
  var LEVEL = 11;         // tournament-standard level shown on unit HP bars
  var MAX_PARTS = 260;
  var GLYPH_CACHE_MAX = 300;
  var FONT = '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';
  var EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

  var COL = {
    bg: '#0b1020',
    topBar: '#111a2c',
    panel: '#16203a',
    panelEdge: '#2b3a5e',
    grassA: '#8fd46a',
    grassB: '#84c95d',
    grassLine: 'rgba(40,90,30,0.07)',
    path: 'rgba(255,246,214,0.16)',
    grassEdge: '#4d8c35',
    stoneBorder: '#8d877a',
    stoneBorderHi: '#b9b3a2',
    river: '#3a9be0',
    riverDeep: 'rgba(18,80,150,0.28)',
    riverBank: '#2a72ae',
    ripple: 'rgba(214,242,255,0.6)',
    foam: 'rgba(255,255,255,0.75)',
    wood: '#a8733f',
    woodDark: '#6c441d',
    rail: '#4a2b11',
    stone: '#d6d0bf',
    stoneFront: '#a79f88',
    stoneEdge: '#6c675a',
    shadow: 'rgba(10,40,10,0.22)',
    hpBack: 'rgba(0,0,0,0.6)',
    invalid: 'rgba(255,58,58,0.34)',
    invalidSolid: '#ff4d4d',
    gold: '#ffe066',
    elixir: '#c96bf5',
    elixirHi: '#f2b8ff',
    drop: '#9b3fd6',
    segBack: 'rgba(20,8,34,0.7)',
    cardArt: '#f6ecd2',
    cardBand: '#2c2846',
    crownOff: '#3b4459',
    ice: '#a6e4ff',
    text: '#f3f6fb',
    textDim: '#94a1ba',
    orange: '#ffa640',
    red: '#ff5a4f'
  };

  var RARITY = {
    common: '#9a7b57',
    rare: '#e0932f',
    epic: '#a25ce0',
    legendary: '#f0c93a'
  };

  var FALLBACK_EMOJI = { skeleton: '💀', golemite: '🪨', speargoblin: '🔱', goblin: '👺' };
  var TEAM_FALLBACK = [
    { main: '#2f7cf6', dark: '#1a4fa8', light: '#9cc3ff' },
    { main: '#e5413b', dark: '#9c1f1b', light: '#ffaaa6' }
  ];
  var CONFETTI = ['#ffe066', '#ff5a7a', '#5ce1ff', '#8ee05a', '#c96bf5', '#ffffff'];

  // Per-entity and per-effect visual records. Keys are engine objects, so entries drop with them.
  var VIS = new WeakMap();
  var SEEN_FX = new WeakSet();

  // ---------- helpers ----------

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function ease(t) {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function nowMs() {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  }

  function teamColor(t) {
    var tc = CR.TEAM_COLORS || TEAM_FALLBACK;
    var i = t === 1 ? 1 : 0;
    return tc[i] || TEAM_FALLBACK[i];
  }

  function cardDef(id) {
    return (id != null && CR.CARDS && CR.CARDS[id]) || null;
  }

  function unitDef(id) {
    return (id != null && CR.UNITS && CR.UNITS[id]) || null;
  }

  var unitEmojiMap = null;
  function unitEmoji(unitId) {
    if (!unitEmojiMap) {
      unitEmojiMap = {};
      var cards = CR.CARDS || {};
      for (var k in cards) {
        var c = cards[k];
        if (c && c.unit && unitEmojiMap[c.unit] === undefined) unitEmojiMap[c.unit] = c.emoji;
      }
    }
    return unitEmojiMap[unitId] || FALLBACK_EMOJI[unitId] || '?';
  }

  function towerSize(type) {
    var spec = CR.TOWERS && CR.TOWERS[type];
    if (spec && spec.size) return spec.size;
    return type === 'king' ? 4 : 3;
  }

  function towerKey(e) {
    return e.id != null ? 'id' + e.id : e.team + ':' + (e.towerType || '') + ':' + e.lane;
  }

  function entAlive(e) {
    return !e.dead && !(e.hp <= 0);
  }

  function radiusOf(e) {
    var def = unitDef(e.unitId) || {};
    var r = e.r || def.r || 0.5;
    // Troops draw larger than their collision circle so emoji stay legible on a phone.
    return e.kind === 'troop' ? r * 1.2 + 0.1 : r;
  }

  function byY(a, b) {
    return a.y - b.y;
  }

  function fmtTime(s) {
    var t = Math.max(0, Math.ceil(s || 0));
    var m = Math.floor(t / 60);
    var r = t % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function arenaCfg() {
    var a = CR.ARENA || {};
    return {
      RIVER_TOP: a.RIVER_TOP != null ? a.RIVER_TOP : 15,
      RIVER_BOTTOM: a.RIVER_BOTTOM != null ? a.RIVER_BOTTOM : 17,
      BRIDGES: a.BRIDGES || [{ x: 3.5, halfWidth: 1.5 }, { x: 14.5, halfWidth: 1.5 }]
    };
  }

  function overBridge(cfg, x) {
    for (var i = 0; i < cfg.BRIDGES.length; i++) {
      var b = cfg.BRIDGES[i];
      if (x > b.x - b.halfWidth && x < b.x + b.halfWidth) return true;
    }
    return false;
  }

  // Rounded rectangle path. Starts its own path.
  function rrPath(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Elixir drop: point at the top, round bottom. Starts its own path.
  function dropPath(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 1.3);
    ctx.bezierCurveTo(cx + r * 0.35, cy - r * 0.6, cx + r, cy - r * 0.2, cx + r, cy + r * 0.2);
    ctx.arc(cx, cy + r * 0.2, r, 0, Math.PI, false);
    ctx.bezierCurveTo(cx - r, cy - r * 0.2, cx - r * 0.35, cy - r * 0.6, cx, cy - r * 1.3);
    ctx.closePath();
  }

  // Crown: flat base, three points. Starts its own path.
  function crownPath(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + h * 0.3);
    ctx.lineTo(x + w * 0.25, y + h * 0.6);
    ctx.lineTo(x + w * 0.5, y);
    ctx.lineTo(x + w * 0.75, y + h * 0.6);
    ctx.lineTo(x + w, y + h * 0.3);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  }

  function uiText(ctx, str, x, y, px, color, weight, align, baseline) {
    ctx.font = (weight || '500') + ' ' + px + 'px ' + FONT;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = baseline || 'middle';
    ctx.fillText(str, x, y);
  }

  // Text in tile units. Font is built at 100x and scaled down so small sizes stay exact.
  function arenaText(ctx, str, x, y, size, color, opts) {
    opts = opts || {};
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(0.01, 0.01);
    ctx.font = (opts.bold ? '700 ' : '600 ') + Math.round(size * 100) + 'px ' + FONT;
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = opts.baseline || 'middle';
    if (opts.outline) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 12;
      ctx.strokeStyle = opts.outline;
      ctx.strokeText(str, 0, 0);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, 0, 0);
    ctx.restore();
  }

  // Offsets for a multi-unit drop, in tiles around the drop point.
  function formation(n) {
    var out = [];
    if (n <= 1) {
      out.push([0, 0]);
    } else if (n === 2) {
      out.push([-0.4, 0], [0.4, 0]);
    } else if (n === 3) {
      out.push([0, -0.35], [-0.4, 0.3], [0.4, 0.3]);
    } else {
      var rad = n <= 5 ? 0.8 : 0.35 * Math.sqrt(n);
      for (var k = 0; k < n; k++) {
        var a = (k * TAU) / n;
        out.push([Math.cos(a) * rad, Math.sin(a) * rad]);
      }
    }
    return out;
  }

  // Small emoji bitmap for static layers (painted once per resize).
  function emojiCanvas(emoji, px) {
    var c = document.createElement('canvas');
    c.width = px;
    c.height = px;
    var g = c.getContext('2d');
    g.font = Math.round(px * 0.9) + 'px ' + EMOJI_FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, px / 2, px / 2 + px * 0.04);
    return c;
  }

  // Static arena layer: tiled grass, path lanes, stone border with trees and rocks, river and bridges.
  // Painted once per resize into a canvas at arena size (tile units scaled by T * dpr).
  function paintArenaStatic(g, cfg, T, dpr) {
    var i, j;
    for (j = 0; j < H; j++) {
      for (i = 0; i < W; i++) {
        g.fillStyle = (i + j) & 1 ? COL.grassA : COL.grassB;
        g.fillRect(i, j, 1, 1);
      }
    }
    // Very subtle tile grid.
    g.fillStyle = COL.grassLine;
    for (i = 1; i < W; i++) g.fillRect(i - 0.02, 0, 0.04, H);
    for (j = 1; j < H; j++) g.fillRect(0, j - 0.02, W, 0.04);

    // Lighter dirt path up each lane from the bridges to the towers.
    g.fillStyle = COL.path;
    for (i = 0; i < cfg.BRIDGES.length; i++) {
      var pb = cfg.BRIDGES[i];
      g.fillRect(pb.x - pb.halfWidth - 0.4, 2.5, pb.halfWidth * 2 + 0.8, cfg.RIVER_TOP - 2.5);
      g.fillRect(pb.x - pb.halfWidth - 0.4, cfg.RIVER_BOTTOM, pb.halfWidth * 2 + 0.8, 25.5 - cfg.RIVER_BOTTOM);
    }

    // Stone border ring just inside the edge, with a few trees and rocks along it.
    var bw = 0.5;
    g.fillStyle = COL.stoneBorder;
    g.fillRect(0, 0, W, bw);
    g.fillRect(0, H - bw, W, bw);
    g.fillRect(0, 0, bw, H);
    g.fillRect(W - bw, 0, bw, H);
    g.fillStyle = COL.stoneBorderHi;
    g.fillRect(bw, bw, W - 2 * bw, 0.06);
    g.fillRect(bw, H - bw - 0.06, W - 2 * bw, 0.06);
    var px = Math.max(16, Math.round(0.8 * T * dpr * 2));
    var trees = [[0.5, 1.2], [W - 0.5, 4.5], [0.5, 9.5], [W - 0.5, 27.3], [0.5, 30.8], [W - 0.5, 22.4]];
    var rocks = [[1.1, 17.2], [W - 1.1, 14.6], [9, 0.8], [5, H - 0.8], [13.2, H - 0.8]];
    var t;
    // Trees and rocks drawn in tile units: the context is scaled by dpr * T, so 1 unit = 1 tile.
    g.save();
    for (i = 0; i < trees.length; i++) {
      t = trees[i];
      g.drawImage(emojiCanvas('🌳', px), (t[0] - 0.6), t[1] - 0.6, 1.2, 1.2);
    }
    for (i = 0; i < rocks.length; i++) {
      t = rocks[i];
      g.drawImage(emojiCanvas('🪨', px), t[0] - 0.35, t[1] - 0.35, 0.7, 0.7);
    }
    g.restore();

    var rt = cfg.RIVER_TOP;
    var rb = cfg.RIVER_BOTTOM;
    g.fillStyle = COL.river;
    g.fillRect(0, rt, W, rb - rt);
    g.fillStyle = COL.riverDeep;
    g.fillRect(0, rt + (rb - rt) / 2, W, (rb - rt) / 2);
    g.fillStyle = COL.riverBank;
    g.fillRect(0, rt - 0.08, W, 0.08);
    g.fillRect(0, rb, W, 0.08);

    for (i = 0; i < cfg.BRIDGES.length; i++) {
      var b = cfg.BRIDGES[i];
      var x0 = b.x - b.halfWidth;
      var bwid = b.halfWidth * 2;
      var y0 = rt - 0.25;
      var bh = rb - rt + 0.5;
      g.fillStyle = COL.woodDark;
      g.fillRect(x0 - 0.05, y0, bwid + 0.1, bh);
      g.fillStyle = COL.wood;
      g.fillRect(x0, y0, bwid, bh);
      g.fillStyle = COL.woodDark;
      for (var py = y0 + 0.2; py < y0 + bh - 0.1; py += 0.32) {
        g.fillRect(x0, py, bwid, 0.06);
      }
      g.fillStyle = COL.rail;
      g.fillRect(x0, y0, 0.12, bh);
      g.fillRect(x0 + bwid - 0.12, y0, 0.12, bh);
    }
  }

  // ---------- renderer ----------

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.cssW = 0;
    this.cssH = 0;
    this.insets = { top: 0, bottom: 0, left: 0, right: 0 };
    this.T = 0;
    this.ox = 0;
    this.oy = 0;
    this.panelTop = 0;
    this.panelH = PANEL_MIN_H;
    this.cardRects = [];
    this.nextRect = null;
    this.barRect = null;
    this.emoteRect = null;
    this._cfg = arenaCfg();
    this._ppu = 1;
    this._time = 0;
    this._selected = -1;
    this._bg = null;
    this._glyphs = {};
    this._glyphCount = 0;
    this._dz = new Uint8Array(W * H);
    this._dzKey = null;
    this._dzGame = null;
    this._dzAt = -1e9;
    this._gBuf = [];
    this._aBuf = [];
    this._pattern = null;
    this._resetState(null);
  }

  Renderer.prototype._resetState = function (game) {
    this._game = game;
    this._frame = 0;
    this._lastMs = 0;
    this._prevLiving = [];
    this._ghosts = [];
    this._parts = [];
    this._fly = [];
    this._crownShown = [0, 0];
    this._crownPopMs = [-1e9, -1e9];
    this._elixirShown = null;
    this._prevHand = [null, null, null, null];
    this._prevNext = null;
    this._cardAnims = [];
    this._nextFadeMs = -1e9;
    this._shakeMs = -1e9;
    this._shakeAmp = 0;
    this._endMs = -1;
    this._towers = {};
    this._towerGame = null;
    this._towerTime = 0;
    this._dzKey = null;
  };

  Renderer.prototype.resize = function (cssW, cssH, dpr, insets) {
    var ins = insets || {};
    var I = (this.insets = {
      top: ins.top || 0,
      bottom: ins.bottom || 0,
      left: ins.left || 0,
      right: ins.right || 0
    });
    this.dpr = dpr || 1;
    this.cssW = cssW;
    this.cssH = cssH;
    this._cfg = arenaCfg();

    var canvas = this.canvas;
    canvas.width = Math.max(1, Math.round(cssW * this.dpr));
    canvas.height = Math.max(1, Math.round(cssH * this.dpr));
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';

    var availW = cssW - I.left - I.right;
    var vertAvail = function (ph) {
      return cssH - I.top - I.bottom - TOP_BAR_H - ph;
    };
    var panelH = PANEL_MIN_H;
    var T = 1;
    var i;
    for (i = 0; i < 4; i++) {
      T = Math.max(1, Math.min(availW / W, vertAvail(panelH) / H));
      panelH = Math.max(PANEL_MIN_H, PANEL_TILES * T);
    }
    this.T = T;
    this.panelH = panelH;
    this.panelTop = cssH - I.bottom - panelH;
    this.ox = I.left + (availW - W * T) / 2;
    var bandTop = I.top + TOP_BAR_H;
    this.oy = bandTop + (this.panelTop - bandTop - H * T) / 2;

    // Elixir bar sits at the very bottom of the panel; the hand fills the space above it.
    var panelBottom = cssH - I.bottom;
    this.barRect = { x: I.left + MARGIN, y: panelBottom - BAR_GAP - BAR_H, w: availW - 2 * MARGIN, h: BAR_H };
    var cardsY = this.panelTop + 8 + CARD_LIFT;
    var cardH = Math.max(40, this.barRect.y - BAR_GAP / 2 - cardsY);
    var nextX = I.left + MARGIN;
    var cardsX0 = nextX + NEXT_W + 8;
    var cardsX1 = cssW - I.right - MARGIN;
    var cardW = (cardsX1 - cardsX0 - 3 * CARD_GAP) / 4;
    this.cardRects = [];
    for (i = 0; i < 4; i++) {
      this.cardRects.push({ x: cardsX0 + i * (cardW + CARD_GAP), y: cardsY, w: cardW, h: cardH });
    }
    this.nextRect = { x: nextX, y: cardsY + 14, w: NEXT_W, h: cardH - 14 };

    // Emote button sits in the arena's bottom-left corner, above the hand.
    this.emoteRect = { x: this.ox + 4, y: this.oy + H * T - 46, w: 40, h: 40 };

    if (!this._bg) this._bg = document.createElement('canvas');
    this._bg.width = Math.max(1, Math.ceil(W * T * this.dpr));
    this._bg.height = Math.max(1, Math.ceil(H * T * this.dpr));
    var g = this._bg.getContext('2d');
    g.setTransform(this.dpr * T, 0, 0, this.dpr * T, 0, 0);
    paintArenaStatic(g, this._cfg, T, this.dpr);

    this._glyphs = {};
    this._glyphCount = 0;
    this._pattern = null;
  };

  // Coordinates: canvas CSS px -> tiles and back.
  Renderer.prototype.screenToTile = function (px, py) {
    return { x: (px - this.ox) / this.T, y: (py - this.oy) / this.T };
  };

  Renderer.prototype.tileToScreen = function (x, y) {
    return { x: this.ox + x * this.T, y: this.oy + y * this.T };
  };

  Renderer.prototype.isInArena = function (px, py) {
    var t = this.screenToTile(px, py);
    return t.x >= 0 && t.x <= W && t.y >= 0 && t.y <= H;
  };

  Renderer.prototype.hitTestCard = function (px, py) {
    var rs = this.cardRects;
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i];
      var top = i === this._selected ? r.y - CARD_LIFT : r.y;
      if (px >= r.x && px <= r.x + r.w && py >= top && py <= r.y + r.h) return i;
    }
    return -1;
  };

  // ---------- transforms and glyphs ----------

  Renderer.prototype._arenaXform = function (sx, sy) {
    var d = this.dpr;
    var T = this.T;
    this.ctx.setTransform(d * T, 0, 0, d * T, d * (this.ox + sx * T), d * (this.oy + sy * T));
    this._ppu = d * T;
  };

  Renderer.prototype._uiXform = function () {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._ppu = this.dpr;
  };

  Renderer.prototype._glyph = function (emoji, px) {
    var key = emoji + '|' + px;
    var c = this._glyphs[key];
    if (c) return c;
    if (this._glyphCount >= GLYPH_CACHE_MAX) {
      this._glyphs = {};
      this._glyphCount = 0;
    }
    c = emojiCanvas(emoji, px);
    this._glyphs[key] = c;
    this._glyphCount++;
    return c;
  };

  // Draws an emoji centred at (cx, cy). size is the em size in current user units.
  Renderer.prototype._emoji = function (emoji, cx, cy, size) {
    var ppu = this._ppu;
    var px = Math.max(8, Math.round(size * ppu));
    var c = this._glyph(emoji || '?', px);
    var s = px / ppu;
    this.ctx.drawImage(c, cx - s / 2, cy - s / 2, s, s);
  };

  Renderer.prototype._bar = function (cx, y, w, frac, color) {
    var ctx = this.ctx;
    var h = 0.14;
    ctx.fillStyle = COL.hpBack;
    ctx.fillRect(cx - w / 2 - 0.03, y - 0.03, w + 0.06, h + 0.06);
    ctx.fillStyle = color;
    ctx.fillRect(cx - w / 2, y, w * clamp(frac, 0, 1), h);
  };

  // Invalid-area fill: red diagonal stripes, drawn with a pattern in tile space.
  Renderer.prototype._stripes = function () {
    if (this._pattern) return this._pattern;
    var c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    var g = c.getContext('2d');
    g.strokeStyle = 'rgba(255,58,58,0.55)';
    g.lineWidth = 4;
    for (var k = -16; k <= 16; k += 8) {
      g.beginPath();
      g.moveTo(k, 16);
      g.lineTo(k + 16, 0);
      g.stroke();
    }
    var p = this.ctx.createPattern(c, 'repeat');
    if (p && p.setTransform && typeof DOMMatrix !== 'undefined') p.setTransform(new DOMMatrix([1 / 16, 0, 0, 1 / 16, 0, 0]));
    this._pattern = p || COL.invalid;
    return this._pattern;
  };

  // ---------- per-frame state ----------

  function visOf(e, game, now) {
    var r = VIS.get(e);
    if (!r) {
      r = {
        spawnT: game.time || 0,
        fallable: e.kind !== 'tower',
        hpPrev: e.hp,
        flashMs: -1e9,
        x: e.x,
        y: e.y,
        bobPh: 0,
        moving: false,
        frame: -1,
        alive: false,
        activeOn: e.active !== false,
        wakeMs: -1e9
      };
      VIS.set(e, r);
    }
    return r;
  }

  Renderer.prototype._spawnParts = function (kind, x, y, n, color, speed, life) {
    var parts = this._parts;
    for (var i = 0; i < n; i++) {
      if (parts.length >= MAX_PARTS) parts.shift();
      var a = Math.random() * TAU;
      var sp = speed * (0.4 + Math.random() * 0.8);
      parts.push({
        kind: kind,
        x: x,
        y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (kind === 'smoke' ? 0.2 : 0),
        life: life * (0.7 + Math.random() * 0.6),
        max: life,
        color: color,
        size: kind === 'debris' ? 0.12 + Math.random() * 0.12 : kind === 'smoke' ? 0.25 : 0.1
      });
    }
  };

  Renderer.prototype._onEffect = function (f, now) {
    if (f.type === 'hit') {
      this._spawnParts('spark', f.x, f.y, 4, '#fff3b0', 4, 0.22);
    } else if (f.type === 'towerDown') {
      this._shakeMs = now;
      this._shakeAmp = 0.22;
      this._spawnParts('debris', f.x, f.y, 14, f.team === 1 ? '#c9c2b0' : '#c9c2b0', 5, 0.8);
      this._spawnParts('smoke', f.x, f.y, 6, 'rgba(80,80,80,0.7)', 1.2, 1.1);
    } else if (f.type === 'death') {
      this._spawnParts('smoke', f.x, f.y, 3, 'rgba(235,235,235,0.8)', 0.8, 0.6);
    } else if (f.type === 'deploy') {
      this._spawnParts('dust', f.x, f.y, 6, 'rgba(230,220,180,0.8)', 2.2, 0.45);
    }
  };

  Renderer.prototype._update = function (game, uiState, now) {
    var dt = clamp((now - (this._lastMs || now)) / 1000, 0, 0.1);
    this._lastMs = now;
    var fr = ++this._frame;
    var time = game.time || 0;
    var ents = game.entities || [];
    var i, e, r, rec;

    // Entities: flash on damage, track wake-ups, remember who is alive for ghosts.
    var living = [];
    for (i = 0; i < ents.length; i++) {
      e = ents[i];
      if (!e) continue;
      rec = visOf(e, game, now);
      rec.frame = fr;
      rec.alive = entAlive(e);
      if (e.hp < rec.hpPrev - 1e-9) rec.flashMs = now;
      rec.hpPrev = e.hp;
      if (e.kind === 'tower') {
        var act = e.active !== false;
        if (act && !rec.activeOn) rec.wakeMs = now;
        rec.activeOn = act;
      } else if (rec.alive && !e.hidden) {
        living.push(e);
        var mv = Math.hypot(e.x - rec.x, e.y - rec.y);
        rec.moving = dt > 0 && mv / dt > 0.4;
        if (rec.moving) rec.bobPh += dt * 14;
      }
      rec.x = e.x;
      rec.y = e.y;
    }
    // Units that were alive last frame and are gone now become ghosts.
    var prev = this._prevLiving;
    for (i = 0; i < prev.length; i++) {
      e = prev[i];
      rec = VIS.get(e);
      if (rec && rec.frame !== fr && rec.alive) {
        this._ghosts.push({ unitId: e.unitId, team: e.team, x: rec.x, y: rec.y, air: !!e.air, t: 0 });
        if (this._ghosts.length > 40) this._ghosts.shift();
      }
    }
    this._prevLiving = living;

    // Effects: spawn particles once per effect object.
    var fx = game.effects || [];
    for (i = 0; i < fx.length; i++) {
      if (fx[i] && !SEEN_FX.has(fx[i])) {
        SEEN_FX.add(fx[i]);
        this._onEffect(fx[i], now);
      }
    }

    // Hand: a played card's slot gets the old "next" card flying in; the next card fades in.
    var pl = game.players ? game.players[uiState.team === 1 ? 1 : 0] : null;
    this._cardAnims = this._cardAnims || [];
    if (pl && pl.hand) {
      for (i = 0; i < 4; i++) {
        var nc = pl.hand[i];
        if (nc !== this._prevHand[i]) {
          if (this._prevNext != null && nc === this._prevNext && this._prevHand[i] != null) {
            this._cardAnims.push({ id: nc, slot: i, t: 0 });
          }
          this._prevHand[i] = nc;
        }
      }
      if (pl.next !== this._prevNext) {
        this._nextFadeMs = now;
        this._prevNext = pl.next;
      }
      // Crowns: pop the counter and fly a crown from the tower that fell.
      for (var t = 0; t < 2; t++) {
        var cr = (game.players[t] && game.players[t].crowns) | 0;
        if (cr > this._crownShown[t]) {
          var owner = 1 - t;
          var src = this._fallSource(game, owner);
          for (var c = this._crownShown[t]; c < cr; c++) {
            this._fly.push({ team: t, t: -0.12 * (c - this._crownShown[t]), src: src });
          }
          this._crownPopMs[t] = now;
          this._crownShown[t] = cr;
        }
      }
    }
    for (i = this._cardAnims.length - 1; i >= 0; i--) {
      this._cardAnims[i].t += dt;
      if (this._cardAnims[i].t >= 0.28) this._cardAnims.splice(i, 1);
    }
    for (i = this._fly.length - 1; i >= 0; i--) {
      this._fly[i].t += dt;
      if (this._fly[i].t >= 0.7) this._fly.splice(i, 1);
    }

    // Elixir eases toward the real value.
    var real = pl ? pl.elixir || 0 : 0;
    if (this._elixirShown == null) this._elixirShown = real;
    this._elixirShown += (real - this._elixirShown) * Math.min(1, dt * 8);
    if (Math.abs(real - this._elixirShown) < 0.001) this._elixirShown = real;
    if (this._elixirShown > real) this._elixirShown = real;

    // Particles and ghosts.
    var parts = this._parts;
    var j = 0;
    for (i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'debris') p.vy += 9 * dt;
      else p.vy *= 1 - dt * 3;
      p.vx *= 1 - dt * 2.5;
      parts[j++] = p;
    }
    parts.length = j;
    var gh = this._ghosts;
    j = 0;
    for (i = 0; i < gh.length; i++) {
      gh[i].t += dt;
      if (gh[i].t < 0.5) gh[j++] = gh[i];
    }
    gh.length = j;

    // Confetti at the end of the battle.
    if (game.result && this._endMs < 0) {
      this._endMs = now;
      for (i = 0; i < 90; i++) {
        this._parts.push({
          kind: 'confetti',
          x: Math.random() * W,
          y: -1 - Math.random() * 6,
          vx: (Math.random() - 0.5) * 2,
          vy: 2 + Math.random() * 3,
          life: 2.5,
          max: 2.5,
          color: CONFETTI[i % CONFETTI.length],
          size: 0.16 + Math.random() * 0.1,
          rot: Math.random() * TAU
        });
      }
    }
    this._time = time;
  };

  Renderer.prototype._fallSource = function (game, owner) {
    var fx = game.effects || [];
    var best = null;
    for (var i = 0; i < fx.length; i++) {
      var f = fx[i];
      if (f && f.type === 'towerDown' && f.team === owner && (!best || f.t < best.t)) best = f;
    }
    return best ? { x: best.x, y: best.y } : { x: W / 2, y: H / 2 };
  };

  // ---------- main draw ----------

  Renderer.prototype.draw = function (game, uiState) {
    var ctx = this.ctx;
    uiState = uiState || {};
    var team = uiState.team === 1 ? 1 : 0;
    var sel = typeof uiState.selected === 'number' ? uiState.selected : -1;
    this._selected = sel;
    var now = nowMs();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COL.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this._bg || !this.T) return;

    if (!game) {
      this._drawChrome(null, team, uiState);
      return;
    }
    if (game !== this._game) this._resetState(game);
    this._update(game, uiState, now);

    var time = game.time || 0;
    var pl = game.players ? game.players[team] : null;
    var cardId = pl && pl.hand && sel >= 0 ? pl.hand[sel] : null;
    var cd = cardDef(cardId);

    this._trackTowers(game);
    this._sortEntities(game.entities);

    // Screen shake: a short, small jolt when a tower falls.
    var shk = now - this._shakeMs;
    var sx = 0;
    var sy = 0;
    if (shk < 300) {
      var amp = this._shakeAmp * (1 - shk / 300);
      sx = Math.sin(shk * 0.09) * amp;
      sy = Math.cos(shk * 0.13) * amp;
    }

    // Arena background (static layer) with the same shake offset.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this._bg, Math.round((this.ox + sx * this.T) * this.dpr), Math.round((this.oy + sy * this.T) * this.dpr));

    this._arenaXform(sx, sy);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    this._drawRipples(time, now);
    this._drawRubble();
    if (cd && cd.type !== 'spell') this._drawDeployZone(game, team, cardId);
    this._drawShadows();
    this._drawGroundStack(now);
    this._drawBeams();
    this._drawProjectiles(game);
    this._drawAir(now);
    this._drawSpells(game, time);
    this._drawEffects(game, now);
    this._drawGhosts();
    this._drawParts(now);
    this._drawBubbles(game, uiState, time);
    this._drawEndText(game, time, now);
    if (uiState.drag && sel >= 0 && cd) this._drawDragGhost(game, team, uiState, cardId, cd);
    ctx.globalAlpha = 1;
    ctx.restore();

    this._drawChrome(game, team, uiState, cd, cardId, now);
  };

  // HUD in CSS px: top bar, crown counters, elixir bar, hand. Also the drag card.
  Renderer.prototype._drawChrome = function (game, team, uiState, cd, cardId, now) {
    var sel = typeof uiState.selected === 'number' ? uiState.selected : -1;
    this._uiXform();
    this._drawTopBar(game, team);
    this._drawCrownCounters(game, team, now);
    this._drawPanel(game, team, uiState, now);
    this._drawFlyingCrowns(game, team, now);
    if (game && uiState.drag && sel >= 0 && cd && !this.isInArena(uiState.drag.x, uiState.drag.y)) {
      var rect = this.cardRects[sel];
      var w = rect.w * 1.1;
      var h = rect.h * 1.1;
      this._card(cardId, uiState.drag.x - w / 2, uiState.drag.y - h / 2, w, h, { selected: true });
    }
  };

  // ---------- towers ----------

  Renderer.prototype._trackTowers = function (game) {
    var ents = game.entities || [];
    if (this._towerGame !== game || (game.time || 0) < this._towerTime) {
      this._towerGame = game;
      this._towers = {};
    }
    this._towerTime = game.time || 0;
    var seen = {};
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (!e || e.kind !== 'tower') continue;
      var key = towerKey(e);
      seen[key] = true;
      var rec = this._towers[key];
      if (!rec) {
        var type = e.towerType || (e.unitId === 'king' ? 'king' : 'princess');
        rec = this._towers[key] = { type: type, size: towerSize(type) };
      }
      rec.x = e.x;
      rec.y = e.y;
      rec.team = e.team;
      rec.alive = entAlive(e);
    }
    for (var k in this._towers) {
      if (!seen[k]) this._towers[k].alive = false;
    }
  };

  Renderer.prototype._drawRubble = function () {
    var ctx = this.ctx;
    for (var k in this._towers) {
      var r = this._towers[k];
      if (r.alive || r.x == null) continue;
      var rad = r.size * 0.42;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, rad * 1.1, rad * 0.75, 0, 0, TAU);
      ctx.fillStyle = 'rgba(40,40,40,0.35)';
      ctx.fill();
      ctx.fillStyle = '#5f5f5f';
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad * 0.5, 0, TAU);
      ctx.fill();
      for (var s = 0; s < 6; s++) {
        var a = s * (TAU / 6) + 0.4;
        var sx = r.x + Math.cos(a) * rad * 0.7;
        var sy = r.y + Math.sin(a) * rad * 0.55;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.22, 0, TAU);
        ctx.fillStyle = s % 2 ? '#9a9a9a' : '#7d7d7d';
        ctx.fill();
        ctx.lineWidth = 0.05;
        ctx.strokeStyle = '#3f3f3f';
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  };

  // Splits entities into ground (towers, buildings, ground troops) and air buffers, sorted by y.
  Renderer.prototype._sortEntities = function (ents) {
    var g = this._gBuf;
    var a = this._aBuf;
    g.length = 0;
    a.length = 0;
    ents = ents || [];
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (!e || e.dead) continue;
      if (e.kind === 'tower') {
        if (entAlive(e)) g.push(e);
        continue;
      }
      if (!entAlive(e) || e.hidden) continue;
      if (e.kind === 'building') g.push(e);
      else if (e.air) a.push(e);
      else g.push(e);
    }
    g.sort(byY);
    a.sort(byY);
  };

  // ---------- arena layers ----------

  Renderer.prototype._drawRipples = function (time) {
    var ctx = this.ctx;
    var cfg = this._cfg;
    var rt = cfg.RIVER_TOP;
    var rb = cfg.RIVER_BOTTOM;
    ctx.beginPath();
    ctx.strokeStyle = COL.ripple;
    ctx.lineWidth = 0.06;
    ctx.lineCap = 'round';
    for (var i = 0; i < 12; i++) {
      var sp = 0.5 + (i % 4) * 0.18;
      var x = ((i * 2.37 + time * sp) % (W + 2)) - 1;
      var y = rt + 0.3 + ((i * 0.618) % 1) * (rb - rt - 0.6);
      if (overBridge(cfg, x)) continue;
      var len = 0.7 + (i % 3) * 0.25;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + len / 2, y - 0.14, x + len, y);
    }
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Foam where the water meets each bridge edge, drifting toward the bridge.
    ctx.fillStyle = COL.foam;
    for (var b = 0; b < cfg.BRIDGES.length; b++) {
      var br = cfg.BRIDGES[b];
      for (var side = -1; side <= 1; side += 2) {
        var fx = br.x + side * (br.halfWidth + 0.22);
        for (var k = 0; k < 3; k++) {
          var ph = (time * 0.8 + k / 3) % 1;
          var fy = rt + 0.3 + ph * (rb - rt - 0.6);
          ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.8;
          ctx.beginPath();
          ctx.arc(fx + side * ph * 0.15, fy, 0.1 + 0.05 * (1 - ph), 0, TAU);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  };

  Renderer.prototype._drawDeployZone = function (game, team, cardId) {
    var dz = this._deployGrid(game, team, cardId);
    if (!dz) return;
    var ctx = this.ctx;
    ctx.beginPath();
    for (var j = 0; j < H; j++) {
      for (var i = 0; i < W; i++) {
        if (!dz[j * W + i]) ctx.rect(i, j, 1, 1);
      }
    }
    ctx.fillStyle = this._stripes();
    ctx.fill();
  };

  Renderer.prototype._deployGrid = function (game, team, cardId) {
    var fn = game.isInDeployZone;
    if (typeof fn !== 'function') return null;
    var key = team + '|' + cardId;
    var now = nowMs();
    if (this._dzGame === game && this._dzKey === key && now - this._dzAt < DEPLOY_CACHE_MS) {
      return this._dz;
    }
    var dz = this._dz;
    for (var j = 0; j < H; j++) {
      for (var i = 0; i < W; i++) {
        dz[j * W + i] = fn.call(game, team, cardId, i + 0.5, j + 0.5) ? 1 : 0;
      }
    }
    this._dzGame = game;
    this._dzKey = key;
    this._dzAt = now;
    return dz;
  };

  Renderer.prototype._drawShadows = function () {
    var ctx = this.ctx;
    var g = this._gBuf;
    var a = this._aBuf;
    ctx.beginPath();
    ctx.fillStyle = COL.shadow;
    var i, e, r;
    for (i = 0; i < g.length; i++) {
      e = g[i];
      if (e.kind === 'tower') continue;
      r = radiusOf(e);
      ctx.moveTo(e.x + r * 0.95, e.y + r * 0.3);
      ctx.ellipse(e.x, e.y + r * 0.3, r * 0.95, r * 0.5, 0, 0, TAU);
    }
    for (i = 0; i < a.length; i++) {
      e = a[i];
      r = radiusOf(e);
      ctx.moveTo(e.x + r * 0.95, e.y + r * 0.3);
      ctx.ellipse(e.x, e.y + r * 0.3, r * 0.95, r * 0.5, 0, 0, TAU);
    }
    ctx.fill();
  };

  Renderer.prototype._drawGroundStack = function (now) {
    var g = this._gBuf;
    for (var i = 0; i < g.length; i++) {
      var e = g[i];
      if (e.kind === 'tower') this._drawTower(e, now);
      else if (e.kind === 'building') this._drawBody(e, true, 1.3, true, now);
      else this._drawBody(e, false, 1.5, false, now);
    }
    this.ctx.globalAlpha = 1;
  };

  Renderer.prototype._drawAir = function (now) {
    var a = this._aBuf;
    for (var i = 0; i < a.length; i++) {
      this._drawBody(a[i], false, 1.5, false, now);
    }
    this.ctx.globalAlpha = 1;
  };

  // Shared body drawing for troops and buildings. Lift and fall are visual only.
  Renderer.prototype._drawBody = function (e, square, emojiK, alwaysBar, now) {
    var ctx = this.ctx;
    var time = this._time;
    var rec = VIS.get(e) || { flashMs: -1e9, spawnT: time, fallable: true, bobPh: 0, moving: false };
    var r = radiusOf(e);
    var team = teamColor(e.team);
    var x = e.x;
    var lift = e.air ? 0.6 : 0;

    // Drop-in: start high above the landing point and accelerate down.
    var age = time - rec.spawnT;
    if (rec.fallable && age >= 0 && age < FALL_T) lift += FALL_H * Math.pow(1 - age / FALL_T, 2);
    if (e.dash) lift += 0.8;
    var y = e.y - lift;

    // Lunge toward the target for a short time after an attack.
    var la = e.lastAttackT != null ? time - e.lastAttackT : -1;
    if (la >= 0 && la < LUNGE_T && e.target && typeof e.target === 'object') {
      var dx = e.target.x - e.x;
      var dy = e.target.y - e.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.01) {
        var amt = Math.min(0.25, r * 0.5) * Math.sin((Math.PI * la) / LUNGE_T);
        x += (dx / d) * amt;
        y += (dy / d) * amt;
      }
    }
    // Walking bob.
    if (rec.moving && !square) y -= Math.abs(Math.sin(rec.bobPh)) * 0.08;

    var deploying = e.deployT > 0;
    var frozen = e.freezeT > 0;
    var flashing = now - rec.flashMs < FLASH_MS;
    var invuln = e.invulnT > 0 && Math.floor(time * 20) % 2 === 0;
    ctx.globalAlpha = deploying ? 0.55 : invuln ? 0.4 : 1;

    // Rage buff: a faint purple halo under the body.
    if (e.rageT > 0) {
      ctx.beginPath();
      ctx.arc(x, y, r + 0.18, 0, TAU);
      ctx.fillStyle = 'rgba(170,70,255,0.35)';
      ctx.fill();
    }

    if (square) {
      rrPath(ctx, x - r, y - r, r * 2, r * 2, r * 0.3);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fillStyle = flashing ? '#ffffff' : frozen ? COL.ice : team.main;
    ctx.fill();
    ctx.lineWidth = Math.max(0.05, r * 0.16);
    ctx.strokeStyle = frozen ? '#3d7fb0' : team.dark;
    ctx.stroke();

    if (e.shield > 0) {
      ctx.beginPath();
      ctx.arc(x, y, r + 0.12, 0, TAU);
      ctx.lineWidth = 0.08;
      ctx.strokeStyle = 'rgba(140,210,255,0.9)';
      ctx.stroke();
    }

    // Emoji faces its direction of travel or attack: mirror horizontally.
    var facing = typeof e.facing === 'number' ? e.facing : e.team === 1 ? Math.PI / 2 : -Math.PI / 2;
    var flip = Math.cos(facing) < -0.2;
    if (flip) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      this._emoji(unitEmoji(e.unitId), 0, 0, Math.max(0.36, emojiK * r));
      ctx.restore();
    } else {
      this._emoji(unitEmoji(e.unitId), x, y, Math.max(0.36, emojiK * r));
    }

    if (e.charging) {
      var bx = Math.cos(facing + Math.PI);
      var by = Math.sin(facing + Math.PI);
      var px = -by;
      var py = bx;
      ctx.beginPath();
      for (var k = -1; k <= 1; k++) {
        var o = k * 0.22;
        var sx = x + bx * (r + 0.08) + px * o;
        var sy = y + by * (r + 0.08) + py * o;
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + bx * 0.55, sy + by * 0.55);
      }
      ctx.lineWidth = 0.06;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.stroke();
    }

    if (e.stunT > 0) {
      ctx.fillStyle = '#ffe83a';
      for (var s = 0; s < 3; s++) {
        var a = time * 7 + (s * TAU) / 3;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r * 0.9, y - r * 0.9 - 0.12 + Math.sin(a * 1.3) * 0.08, 0.07, 0, TAU);
        ctx.fill();
      }
    }

    // Deploy clock: a dark disc with a white sweep that empties as the unit goes active.
    if (deploying) {
      var frac = clamp(e.deployT, 0, 1);
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, r + 0.2, -Math.PI / 2, -Math.PI / 2 + TAU * frac, false);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, r + 0.2, 0, TAU);
      ctx.lineWidth = 0.06;
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.stroke();
    }

    ctx.globalAlpha = deploying ? 0.6 : 1;
    if (e.maxHp > 0 && e.hp > 0 && (alwaysBar || e.hp < e.maxHp)) {
      var bwid = square ? r * 2.4 : Math.max(0.9, r * 2.2);
      var by2 = e.y - r - 0.34;
      var sideTeam = e.team === 1 ? '#e5413b' : '#2f7cf6';
      this._bar(x, by2, bwid, e.hp / e.maxHp, sideTeam);
      // Level badge at the left end of the bar.
      arenaText(ctx, String(LEVEL), x - bwid / 2 - 0.2, by2 + 0.07, 0.24, COL.text, {
        bold: true,
        outline: '#1a1a1a'
      });
    }
    ctx.globalAlpha = 1;
  };

  Renderer.prototype._drawTower = function (e, now) {
    var ctx = this.ctx;
    var type = e.towerType || (e.unitId === 'king' ? 'king' : 'princess');
    var size = towerSize(type);
    var half = size / 2;
    var x = e.x;
    var y = e.y;
    var team = teamColor(e.team);
    var rec = VIS.get(e) || { flashMs: -1e9, wakeMs: -1e9 };
    var active = type !== 'king' || e.active !== false;
    var flashing = now - rec.flashMs < FLASH_MS;
    var wake = now - rec.wakeMs;

    // Wake-up bounce for a king tower that just activated.
    var bounce = wake >= 0 && wake < 450 ? 1 + 0.12 * Math.sin((wake / 450) * Math.PI * 2) * (1 - wake / 450) : 1;
    ctx.globalAlpha = active ? 1 : 0.8;

    // Ground shadow.
    ctx.beginPath();
    ctx.fillStyle = COL.shadow;
    ctx.ellipse(x + 0.12, y + half * 0.85, half * 1.02, half * 0.36, 0, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(bounce, bounce);
    ctx.translate(-x, -y);

    // Crenellations on the top and bottom edges, then the stone block with a darker front face.
    ctx.fillStyle = COL.stone;
    ctx.strokeStyle = COL.stoneEdge;
    ctx.lineWidth = 0.08;
    var i;
    for (i = 0; i < size; i++) {
      var mx = x - half + i + 0.2;
      ctx.fillRect(mx, y - half - 0.3, 0.6, 0.34);
      ctx.strokeRect(mx, y - half - 0.3, 0.6, 0.34);
    }
    ctx.fillStyle = flashing ? '#ffffff' : COL.stone;
    ctx.fillRect(x - half, y - half, size, size);
    ctx.strokeRect(x - half, y - half, size, size);
    // Front face: a darker band at the bottom suggests height.
    ctx.fillStyle = COL.stoneFront;
    ctx.fillRect(x - half, y + half - 0.7, size, 0.7);
    ctx.strokeRect(x - half, y + half - 0.7, size, 0.7);

    var roofW = size - 0.7;
    var roofH = size - 1.3;
    rrPath(ctx, x - roofW / 2, y - half + 0.35, roofW, roofH, 0.25);
    ctx.fillStyle = active ? team.main : '#7b8497';
    ctx.fill();
    ctx.lineWidth = 0.1;
    ctx.strokeStyle = team.dark;
    ctx.stroke();

    if (type === 'king') {
      this._emoji(active ? '👑' : '😴', x, y - 0.05, 1.25);
    } else {
      this._emoji('🏹', x, y - 0.05, 0.95);
    }

    if (!active) {
      var zz = (now / 600) % 3;
      arenaText(ctx, zz < 1 ? 'z' : zz < 2 ? 'zz' : 'zzz', x + half * 0.9, y - half * 0.9, 0.55, '#ffffff', {
        bold: true,
        outline: '#222'
      });
    }
    ctx.restore();

    // HP number pill, like Clash Royale. Blue for yours, red for theirs. Above the tower unless there is no room.
    var txt = String(Math.max(0, Math.ceil(e.hp || 0)));
    var pw = Math.max(1.1, 0.34 * txt.length + 0.5);
    var above = y - half - 0.5 >= 0.9;
    var py = above ? y - half - 0.5 : y + half + 0.5;
    rrPath(ctx, x - pw / 2, py - 0.3, pw, 0.6, 0.3);
    ctx.fillStyle = e.team === 1 ? '#e5413b' : '#2f7cf6';
    ctx.fill();
    ctx.lineWidth = 0.05;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    arenaText(ctx, txt, x, py + 0.02, 0.4, COL.text, { bold: true });
    ctx.globalAlpha = 1;
  };

  Renderer.prototype._drawBeams = function () {
    var ctx = this.ctx;
    var g = this._gBuf;
    for (var i = 0; i < g.length; i++) {
      var e = g[i];
      if (e.kind !== 'building' || typeof e.beamTarget !== 'object' || !e.beamTarget) continue;
      var t = e.beamTarget;
      var lift = t.air ? 0.6 : 0;
      var stage = e.rampStage | 0;
      var w = 0.12 + 0.08 * stage;
      var outer = stage >= 2 ? '#ff3b1f' : stage === 1 ? '#ff6a2a' : '#ff8a3a';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(t.x, t.y - lift);
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = outer;
      ctx.lineWidth = w + 0.1;
      ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#ffe27a';
      ctx.lineWidth = w * 0.45;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
  };

  Renderer.prototype._drawProjectiles = function (game) {
    var list = game.projectiles;
    if (!list || !list.length) return;
    var ctx = this.ctx;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p) continue;
      var dx;
      var dy;
      var tgt = p.target;
      if (tgt && typeof tgt === 'object' && tgt.x !== undefined) {
        dx = tgt.x - p.x;
        dy = tgt.y - p.y;
      } else {
        dx = (p.tx != null ? p.tx : p.x) - p.x;
        dy = (p.ty != null ? p.ty : p.y) - p.y;
      }
      var ang = Math.atan2(dy, dx);
      if (!isFinite(ang)) ang = 0;
      var c = Math.cos(ang);
      var s = Math.sin(ang);
      var x = p.x;
      var y = p.y;
      ctx.globalAlpha = 1;
      switch (p.kind) {
        case 'arrow':
          ctx.beginPath();
          ctx.moveTo(x - c * 0.3, y - s * 0.3);
          ctx.lineTo(x + c * 0.3, y + s * 0.3);
          ctx.lineWidth = 0.07;
          ctx.strokeStyle = '#4d3418';
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x + c * 0.3, y + s * 0.3, 0.06, 0, TAU);
          ctx.fillStyle = '#c9ced6';
          ctx.fill();
          break;
        case 'bullet':
          ctx.beginPath();
          ctx.arc(x, y, 0.09, 0, TAU);
          ctx.fillStyle = '#1d1d22';
          ctx.fill();
          break;
        case 'cannonball':
          ctx.beginPath();
          ctx.arc(x, y, 0.22, 0, TAU);
          ctx.fillStyle = '#15151a';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x - 0.07, y - 0.07, 0.06, 0, TAU);
          ctx.fillStyle = '#5a5a66';
          ctx.fill();
          break;
        case 'fire':
          ctx.beginPath();
          ctx.arc(x, y, 0.34, 0, TAU);
          ctx.fillStyle = 'rgba(255,120,30,0.45)';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x, y, 0.2, 0, TAU);
          ctx.fillStyle = '#ffb22e';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x, y, 0.08, 0, TAU);
          ctx.fillStyle = '#fff3b0';
          ctx.fill();
          break;
        case 'goo':
          ctx.beginPath();
          ctx.arc(x, y, 0.2, 0, TAU);
          ctx.fillStyle = '#9a4fd8';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x - c * 0.12, y - s * 0.12, 0.08, 0, TAU);
          ctx.fillStyle = '#b97cf0';
          ctx.fill();
          break;
        case 'spear':
          ctx.beginPath();
          ctx.moveTo(x - c * 0.4, y - s * 0.4);
          ctx.lineTo(x + c * 0.4, y + s * 0.4);
          ctx.lineWidth = 0.08;
          ctx.strokeStyle = '#7a5226';
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x + c * 0.4, y + s * 0.4, 0.07, 0, TAU);
          ctx.fillStyle = '#c9ced6';
          ctx.fill();
          break;
        case 'bomb':
          ctx.beginPath();
          ctx.arc(x, y, 0.2, 0, TAU);
          ctx.fillStyle = '#202024';
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x, y - 0.2);
          ctx.lineTo(x + 0.08, y - 0.32);
          ctx.lineWidth = 0.05;
          ctx.strokeStyle = '#8a6a3a';
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x + 0.08, y - 0.32, 0.05, 0, TAU);
          ctx.fillStyle = '#ffb020';
          ctx.fill();
          break;
        case 'magic':
          ctx.beginPath();
          ctx.arc(x, y, 0.3, 0, TAU);
          ctx.fillStyle = 'rgba(255,110,210,0.4)';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x, y, 0.16, 0, TAU);
          ctx.fillStyle = '#ff8ad8';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x, y, 0.05, 0, TAU);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          break;
        case 'ice':
          ctx.beginPath();
          ctx.arc(x, y, 0.26, 0, TAU);
          ctx.fillStyle = 'rgba(160,230,255,0.5)';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x, y, 0.14, 0, TAU);
          ctx.fillStyle = '#c7f1ff';
          ctx.fill();
          break;
        default:
          ctx.beginPath();
          ctx.arc(x, y, 0.1, 0, TAU);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
      }
    }
  };

  Renderer.prototype._drawSpells = function (game, time) {
    var list = game.spells;
    if (!list || !list.length) return;
    var ctx = this.ctx;
    for (var i = 0; i < list.length; i++) {
      var sp = list[i];
      if (!sp) continue;
      var card = cardDef(sp.cardId) || {};
      ctx.globalAlpha = 1;
      if (sp.kind === 'poison') {
        var rad = sp.radius || card.radius || 3.5;
        var pulse = 0.5 + 0.5 * Math.sin(time * 4 + sp.x + sp.y);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, rad, 0, TAU);
        ctx.fillStyle = 'rgba(120,220,70,' + (0.22 + 0.06 * pulse).toFixed(3) + ')';
        ctx.fill();
        ctx.lineWidth = 0.1;
        ctx.strokeStyle = 'rgba(90,180,40,0.8)';
        ctx.stroke();
        ctx.fillStyle = 'rgba(200,255,150,0.6)';
        for (var k = 0; k < 4; k++) {
          var a = time * 0.5 + k * 1.57;
          ctx.beginPath();
          ctx.arc(sp.x + Math.cos(a) * rad * 0.6, sp.y + Math.sin(a) * rad * 0.6, 0.12, 0, TAU);
          ctx.fill();
        }
      } else if (sp.kind === 'log') {
        var lg = card.log || {};
        var w = lg.width || 3.9;
        var th = 0.9;
        var x0 = sp.x - w / 2;
        var y0 = sp.y - th / 2;
        rrPath(ctx, x0, y0, w, th, th / 2);
        ctx.fillStyle = '#8b5a2b';
        ctx.fill();
        ctx.lineWidth = 0.07;
        ctx.strokeStyle = '#4e2f14';
        ctx.stroke();
        // Bark marks slide along the log to suggest rolling.
        var phase = (time * (lg.speed || 4.6)) % 1.0;
        ctx.beginPath();
        for (var m = 0; m < 4; m++) {
          var mx = x0 + ((m + phase) * w) / 4;
          ctx.moveTo(mx, y0 + 0.12);
          ctx.lineTo(mx, y0 + th - 0.12);
        }
        ctx.lineWidth = 0.06;
        ctx.strokeStyle = '#c08a52';
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(sp.x, sp.y, 0.42, 0.2, 0, 0, TAU);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fill();
        this._emoji(card.emoji || '?', sp.x, sp.y - 0.7, 1.0);
      }
    }
    ctx.globalAlpha = 1;
  };

  // Zig-zag path between two points, jittered by flick so it crackles.
  function boltPath(ctx, x0, y0, x1, y1, flick, seed, segs, amp) {
    var dx = x1 - x0;
    var dy = y1 - y0;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len;
    var ny = dx / len;
    ctx.moveTo(x0, y0);
    for (var k = 1; k < segs; k++) {
      var t = k / segs;
      var j = Math.sin(flick * 12.9 + seed * 3.1 + k * 2.7) * amp * (k % 2 ? 1 : -1);
      ctx.lineTo(x0 + dx * t + nx * j, y0 + dy * t + ny * j);
    }
    ctx.lineTo(x1, y1);
  }

  Renderer.prototype._drawEffects = function (game) {
    var list = game.effects;
    if (!list || !list.length) return;
    var ctx = this.ctx;
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      if (!f) continue;
      var dur = f.dur > 0 ? f.dur : 0.5;
      var t = f.t || 0;
      var p = clamp(t / dur, 0, 1);
      var a = 1 - p;
      var R = f.radius > 0 ? f.radius : 0.6;
      var x = f.x;
      var y = f.y;
      var k;
      ctx.save();
      ctx.globalAlpha = a;
      switch (f.type) {
        case 'hit':
          ctx.beginPath();
          ctx.arc(x, y, 0.2 + R * p, 0, TAU);
          ctx.lineWidth = 0.1 * a + 0.03;
          ctx.strokeStyle = '#fff3b0';
          ctx.stroke();
          break;
        case 'splash':
          ctx.beginPath();
          ctx.arc(x, y, R * (0.3 + 0.7 * p), 0, TAU);
          ctx.fillStyle = 'rgba(255,160,60,0.25)';
          ctx.fill();
          ctx.lineWidth = 0.12;
          ctx.strokeStyle = '#ff9a3c';
          ctx.stroke();
          break;
        case 'death':
          ctx.beginPath();
          ctx.arc(x, y, 0.25 + R * 0.6 * p, 0, TAU);
          ctx.fillStyle = 'rgba(230,230,230,0.6)';
          ctx.fill();
          ctx.lineWidth = 0.06;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
          break;
        case 'zap': {
          var flick = Math.floor(t * 30);
          var seed = f.seed != null ? f.seed : i;
          ctx.lineJoin = 'round';
          for (var pass = 0; pass < 2; pass++) {
            ctx.beginPath();
            for (var b = 0; b < 3; b++) {
              var ang = b * (TAU / 3) + seed * 0.7 + flick * 0.9;
              for (k = 0; k <= 4; k++) {
                var dist = R * (k / 4) * 0.95;
                var jit = Math.sin(flick * 12.9 + b * 4.1 + k * 2.7) * 0.22 * (k % 2 ? 1 : -1);
                var px = x + Math.cos(ang) * dist - Math.sin(ang) * jit;
                var py = y + Math.sin(ang) * dist + Math.cos(ang) * jit;
                if (k === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
              }
            }
            ctx.lineWidth = pass === 0 ? 0.14 : 0.05;
            ctx.strokeStyle = pass === 0 ? '#7fdcff' : '#ffffff';
            ctx.stroke();
          }
          break;
        }
        case 'lightning': {
          // Bolt from the sky onto the target, then a flash ring.
          var lf = Math.floor(t * 30);
          var show = clamp(1 - p / 0.6, 0, 1);
          ctx.lineJoin = 'round';
          ctx.globalAlpha = show;
          ctx.beginPath();
          boltPath(ctx, x + 0.3, y - 6, x, y, lf, i, 7, 0.35);
          ctx.lineWidth = 0.32;
          ctx.strokeStyle = 'rgba(255,230,90,0.5)';
          ctx.stroke();
          ctx.beginPath();
          boltPath(ctx, x + 0.3, y - 6, x, y, lf, i, 7, 0.35);
          ctx.lineWidth = 0.1;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
          ctx.globalAlpha = a * 0.6;
          ctx.beginPath();
          ctx.arc(x, y, R * (0.5 + 0.5 * p), 0, TAU);
          ctx.fillStyle = 'rgba(255,240,140,0.35)';
          ctx.fill();
          break;
        }
        case 'tornado': {
          // Spinning swirl of arcs over the zone, fading at the end.
          var spin = t * 7;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.ellipse(x, y, R, R * 0.6, 0, 0, TAU);
          ctx.fillStyle = 'rgba(200,220,255,0.16)';
          ctx.fill();
          for (k = 0; k < 4; k++) {
            var ta = spin + k * (TAU / 4);
            ctx.beginPath();
            ctx.ellipse(x, y, R * (0.35 + 0.25 * k / 3), R * (0.6 * (0.35 + 0.25 * k / 3)), 0, ta, ta + 2.1);
            ctx.lineWidth = 0.16;
            ctx.strokeStyle = 'rgba(235,245,255,0.8)';
            ctx.stroke();
          }
          ctx.lineCap = 'butt';
          break;
        }
        case 'rage': {
          // Purple zone that pulses while it lasts.
          var rp = 0.5 + 0.5 * Math.sin(t * 9);
          ctx.beginPath();
          ctx.arc(x, y, R, 0, TAU);
          ctx.fillStyle = 'rgba(170,60,255,' + (0.2 + 0.08 * rp).toFixed(3) + ')';
          ctx.fill();
          ctx.lineWidth = 0.1;
          ctx.strokeStyle = 'rgba(210,140,255,0.9)';
          ctx.stroke();
          break;
        }
        case 'dash': {
          // Jump streak: a short burst of dust lines where the unit lands or leaves.
          ctx.lineWidth = 0.08;
          ctx.strokeStyle = 'rgba(245,235,200,0.9)';
          ctx.beginPath();
          for (k = 0; k < 6; k++) {
            var da = (k * TAU) / 6;
            var d0 = R * (0.4 + 0.6 * p);
            ctx.moveTo(x + Math.cos(da) * d0, y + Math.sin(da) * d0 * 0.6);
            ctx.lineTo(x + Math.cos(da) * (d0 + 0.5), y + Math.sin(da) * (d0 + 0.5) * 0.6);
          }
          ctx.stroke();
          break;
        }
        case 'chain': {
          // Electric arc from the previous link to this one.
          var cf = Math.floor(t * 30);
          var x0 = f.x0 != null ? f.x0 : x;
          var y0 = f.y0 != null ? f.y0 : y;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          boltPath(ctx, x0, y0, x, y, cf, i, 5, 0.25);
          ctx.lineWidth = 0.14;
          ctx.strokeStyle = '#7fdcff';
          ctx.stroke();
          ctx.lineWidth = 0.05;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
          break;
        }
        case 'arrows':
          ctx.beginPath();
          for (k = 0; k < 8; k++) {
            var aa = k * 2.4 + 0.3;
            var dd = R * (0.3 + 0.6 * (((k * 37) % 10) / 10));
            var sx = x + Math.cos(aa) * dd;
            var sy = y + Math.sin(aa) * dd * 0.7;
            var fall = (1 - p) * 2.5;
            ctx.moveTo(sx, sy - fall - 0.6);
            ctx.lineTo(sx, sy - fall);
          }
          ctx.lineWidth = 0.07;
          ctx.strokeStyle = '#5a3a1a';
          ctx.stroke();
          break;
        case 'fireball':
        case 'rocket':
          ctx.beginPath();
          ctx.arc(x, y, R * (0.4 + 0.6 * p), 0, TAU);
          ctx.fillStyle = 'rgba(255,130,30,0.7)';
          ctx.fill();
          ctx.lineWidth = 0.12;
          ctx.strokeStyle = '#ff6a1a';
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y, R * 0.5 * (1 - p) + 0.1, 0, TAU);
          ctx.fillStyle = '#ffe066';
          ctx.fill();
          break;
        case 'freeze':
          ctx.beginPath();
          ctx.arc(x, y, R, 0, TAU);
          ctx.fillStyle = 'rgba(170,230,255,0.45)';
          ctx.fill();
          ctx.lineWidth = 0.1;
          ctx.strokeStyle = '#e8fbff';
          ctx.stroke();
          ctx.beginPath();
          for (k = 0; k < 6; k++) {
            var fa = k * (TAU / 6);
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(fa) * R * 0.8, y + Math.sin(fa) * R * 0.8);
          }
          ctx.lineWidth = 0.05;
          ctx.stroke();
          break;
        case 'poison':
          ctx.beginPath();
          ctx.arc(x, y, R, 0, TAU);
          ctx.fillStyle = 'rgba(120,220,70,0.3)';
          ctx.fill();
          break;
        case 'deploy': {
          // Landing dust ring, after the unit has fallen in.
          var dt0 = t - FALL_T;
          if (dt0 > 0) {
            var dp = clamp(dt0 / 0.4, 0, 1);
            ctx.globalAlpha = 1 - dp;
            ctx.beginPath();
            ctx.arc(x, y, 0.4 + 0.9 * dp, 0, TAU);
            ctx.lineWidth = 0.14 * (1 - dp) + 0.03;
            ctx.strokeStyle = 'rgba(235,222,180,0.9)';
            ctx.stroke();
          }
          break;
        }
        case 'towerDown':
          ctx.beginPath();
          ctx.arc(x, y, R * (0.35 + 0.65 * p), 0, TAU);
          ctx.fillStyle = 'rgba(255,157,60,0.7)';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x, y - 0.3, R * (0.5 + 0.4 * p), 0, TAU);
          ctx.globalAlpha = a * 0.5;
          ctx.fillStyle = '#5a5a5a';
          ctx.fill();
          ctx.globalAlpha = a;
          break;
        case 'spawn':
          ctx.fillStyle = '#ffffff';
          for (k = 0; k < 3; k++) {
            var sa = k * (TAU / 3);
            var sd = 0.1 + 0.35 * p;
            ctx.beginPath();
            ctx.arc(x + Math.cos(sa) * sd, y + Math.sin(sa) * sd, 0.25 * (1 - p) + 0.12, 0, TAU);
            ctx.globalAlpha = a * 0.7;
            ctx.fill();
          }
          break;
        case 'elixir': {
          // Cost pops in purple above the drop point, then drifts up and fades.
          var pop = 1 + 0.35 * Math.max(0, 1 - t / 0.15);
          arenaText(ctx, String(f.text || '-'), x, y - 1.6 * p - 0.6, 0.9 * pop, '#d98bff', {
            bold: true,
            outline: '#2b0d40'
          });
          break;
        }
        default:
          // Unknown effect: a faint ring in the owner's colour.
          if (f.radius > 0) {
            ctx.beginPath();
            ctx.arc(x, y, R * (0.4 + 0.6 * p), 0, TAU);
            ctx.lineWidth = 0.08;
            ctx.strokeStyle = teamColor(f.team).light;
            ctx.stroke();
          }
          break;
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };

  // Ghosts: the emoji of a unit that just died, drifting up and fading.
  Renderer.prototype._drawGhosts = function () {
    var gh = this._ghosts;
    var ctx = this.ctx;
    for (var i = 0; i < gh.length; i++) {
      var g = gh[i];
      var p = clamp(g.t / 0.5, 0, 1);
      ctx.globalAlpha = (1 - p) * 0.8;
      this._emoji(unitEmoji(g.unitId), g.x, g.y - 0.4 - p * 0.9, 1.2 + 0.2 * p);
    }
    ctx.globalAlpha = 1;
  };

  // Smoke, sparks, debris, dust and confetti.
  Renderer.prototype._drawParts = function (now) {
    var ctx = this.ctx;
    var parts = this._parts;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var a = clamp(p.life / p.max, 0, 1);
      if (p.kind === 'smoke') {
        ctx.globalAlpha = a * 0.7;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, TAU);
        ctx.fillStyle = p.color;
        ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.09, 0, TAU);
        ctx.fillStyle = p.color;
        ctx.fill();
      } else if (p.kind === 'debris') {
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fillStyle = p.color;
        ctx.fill();
      } else if (p.kind === 'dust') {
        ctx.globalAlpha = a * 0.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.18 + (1 - a) * 0.2, 0, TAU);
        ctx.fillStyle = p.color;
        ctx.fill();
      } else if (p.kind === 'confetti') {
        ctx.globalAlpha = clamp(p.life / 0.6, 0, 1);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot + now * 0.001 * (p.max - p.life) * 4);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  };

  // Speech bubbles over each King Tower, for emotes.
  Renderer.prototype._drawBubbles = function (game, uiState, time) {
    var list = uiState.emote;
    if (!list) return;
    var ctx = this.ctx;
    for (var t = 0; t < 2; t++) {
      var b = list[t];
      if (!b || time >= b.until) continue;
      var king = null;
      var ents = game.entities || [];
      for (var i = 0; i < ents.length; i++) {
        var e = ents[i];
        if (e && e.kind === 'tower' && e.team === t && e.towerType === 'king') king = e;
      }
      if (!king) continue;
      var up = king.y > 16;
      var by = up ? king.y - 3.1 : king.y + 3.1;
      var fade = clamp((b.until - time) / 0.4, 0, 1);
      var pop = clamp((time - (b.until - 2)) / 0.15, 0, 1);
      ctx.globalAlpha = fade * pop;
      rrPath(ctx, king.x - 1.1, by - 0.9, 2.2, 1.8, 0.7);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 0.08;
      ctx.strokeStyle = '#2b3a5e';
      ctx.stroke();
      this._emoji(b.emoji, king.x, by, 1.2);
    }
    ctx.globalAlpha = 1;
  };

  // "Winner!" over the winning King Tower, or "Draw" in the middle.
  Renderer.prototype._drawEndText = function (game, time, now) {
    var r = game.result;
    if (!r || this._endMs < 0) return;
    var age = (now - this._endMs) / 1000;
    if (age > 2.5) return;
    var ctx = this.ctx;
    if (r.winner === 0 || r.winner === 1) {
      var ents = game.entities || [];
      var king = null;
      for (var i = 0; i < ents.length; i++) {
        var e = ents[i];
        if (e && e.kind === 'tower' && e.towerType === 'king' && e.team === r.winner) king = e;
      }
      var x = king ? king.x : W / 2;
      var y = king ? king.y + (r.winner === 0 ? -3.4 : 3.4) : H / 2;
      var s = 1.4 * ease(age / 0.3);
      ctx.globalAlpha = clamp(age / 0.2, 0, 1);
      arenaText(ctx, 'Winner!', x, y, s, COL.gold, { bold: true, outline: '#5a3500' });
    } else {
      ctx.globalAlpha = clamp(age / 0.2, 0, 1);
      arenaText(ctx, 'Draw', W / 2, H / 2, 1.4, COL.text, { bold: true, outline: '#1d2a44' });
    }
    ctx.globalAlpha = 1;
  };

  Renderer.prototype._drawDragGhost = function (game, team, uiState, cardId, card) {
    var d = uiState.drag;
    if (!d || !this.isInArena(d.x, d.y)) return;
    var t = this.screenToTile(d.x, d.y);
    var sx = Math.round(t.x * 2) / 2;
    var sy = Math.round(t.y * 2) / 2;
    var ok = true;
    if (typeof game.canDeploy === 'function') {
      ok = !!game.canDeploy(team, uiState.selected, sx, sy);
    }
    var tc = teamColor(team);
    var ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.5;
    if (card.type === 'spell') {
      if (card.log) {
        var w = card.log.width || 3.9;
        var L = card.log.length || 11;
        // Team 0 rolls toward smaller y, team 1 toward larger y.
        var ry = team === 1 ? sy : sy - L;
        ctx.fillStyle = ok ? 'rgba(255,255,255,0.25)' : COL.invalid;
        ctx.fillRect(sx - w / 2, ry, w, L);
        ctx.lineWidth = 0.08;
        ctx.strokeStyle = ok ? '#ffffff' : COL.invalidSolid;
        ctx.strokeRect(sx - w / 2, ry, w, L);
      } else {
        var rad = card.radius || 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, rad, 0, TAU);
        ctx.fillStyle = ok ? 'rgba(255,255,255,0.22)' : COL.invalid;
        ctx.fill();
        ctx.lineWidth = 0.08;
        ctx.setLineDash([0.15, 0.15]);
        ctx.strokeStyle = ok ? '#ffffff' : COL.invalidSolid;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else {
      var def = unitDef(card.unit) || {};
      var r = def.r || 0.5;
      var building = card.type === 'building';
      var offs = formation(card.count || 1);
      // Attack range ring for ranged units and buildings.
      if (def.range && (def.projectile || building)) {
        ctx.beginPath();
        ctx.arc(sx, sy, def.range, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fill();
        ctx.lineWidth = 0.05;
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.stroke();
      }
      var col = ok ? tc.main : COL.invalidSolid;
      for (var i = 0; i < offs.length; i++) {
        var px = sx + offs[i][0];
        var py = sy + offs[i][1];
        if (building) {
          rrPath(ctx, px - r, py - r, r * 2, r * 2, r * 0.3);
        } else {
          ctx.beginPath();
          ctx.arc(px, py, r, 0, TAU);
        }
        ctx.fillStyle = col;
        ctx.fill();
        this._emoji(card.unit ? unitEmoji(card.unit) : '?', px, py, Math.max(0.36, (building ? 1.3 : 1.5) * r));
      }
    }
    ctx.restore();
  };

  // ---------- UI ----------

  // Crown icon row inside a small pill: filled for earned crowns.
  Renderer.prototype._crownRow = function (cx, cy, count, t, popK) {
    var ctx = this.ctx;
    var col = teamColor(t);
    var cw = 9;
    var ch = 8;
    for (var i = 0; i < 3; i++) {
      var on = i < count;
      var s = on && i === count - 1 ? 1 + 0.5 * popK : 1;
      var x = cx - cw / 2;
      var y = cy - 8 + i * 9.5;
      ctx.save();
      ctx.translate(x + cw / 2, y + ch / 2);
      ctx.scale(s, s);
      crownPath(ctx, -cw / 2, -ch / 2, cw, ch);
      ctx.restore();
      ctx.fillStyle = on ? col.main : COL.crownOff;
      ctx.fill();
      if (on) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = col.dark;
        ctx.stroke();
      }
    }
  };

  Renderer.prototype._drawCrownCounters = function (game, team, now) {
    var ctx = this.ctx;
    var xr = this.ox + W * this.T;
    var cx = xr - 15;
    var pillW = 24;
    var pillH = 36;
    // Red (enemy) above the river, blue (you) below.
    var yRed = this.oy + 12.5 * this.T;
    var yBlue = this.oy + 19.5 * this.T;
    var pl = game && game.players ? game.players : null;
    var cs = [pl && pl[1] ? pl[1].crowns | 0 : 0, pl && pl[0] ? pl[0].crowns | 0 : 0];
    var ys = [yRed, yBlue];
    var tm = [1, 0];
    for (var i = 0; i < 2; i++) {
      var pop = clamp(1 - (now - this._crownPopMs[tm[i]]) / 400, 0, 1);
      rrPath(ctx, cx - pillW / 2, ys[i] - pillH / 2, pillW, pillH, 8);
      ctx.fillStyle = 'rgba(12,18,34,0.78)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = teamColor(tm[i]).dark;
      ctx.stroke();
      this._crownRow(cx, ys[i], cs[i], tm[i], pop);
    }
  };

  // Crowns in flight from a fallen tower to a counter.
  Renderer.prototype._drawFlyingCrowns = function (game, team, now) {
    var ctx = this.ctx;
    var xr = this.ox + W * this.T;
    for (var i = 0; i < this._fly.length; i++) {
      var f = this._fly[i];
      if (f.t < 0) continue;
      var p = ease(f.t / 0.6);
      var from = this.tileToScreen(f.src.x, f.src.y);
      var yTo = f.team === 1 ? this.oy + 12.5 * this.T : this.oy + 19.5 * this.T;
      var to = { x: xr - 15, y: yTo };
      var x = from.x + (to.x - from.x) * p;
      var y = from.y + (to.y - from.y) * p - Math.sin(p * Math.PI) * 40;
      var s = 14;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1 + 0.3 * Math.sin(p * Math.PI), 1 + 0.3 * Math.sin(p * Math.PI));
      crownPath(ctx, -s / 2, -s * 0.4, s, s * 0.8);
      ctx.fillStyle = teamColor(f.team).main;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();
    }
  };

  Renderer.prototype._drawTopBar = function (game, team) {
    var ctx = this.ctx;
    var I = this.insets;
    var cssW = this.cssW;
    ctx.fillStyle = COL.topBar;
    ctx.fillRect(0, 0, cssW, I.top + TOP_BAR_H);

    // Opponent name at the left, beside the HTML pause button.
    var leftX = I.left + 46;
    uiText(ctx, 'Opponent', leftX, I.top + TOP_BAR_H / 2, 14, COL.text, '700', 'left', 'middle');

    if (!game) return;
    // Time left box at the top-right.
    var bw = 74;
    var bh = 34;
    var bx = cssW - I.right - 8 - bw;
    var by = I.top + 5;
    rrPath(ctx, bx, by, bw, bh, 8);
    ctx.fillStyle = 'rgba(10,20,40,0.75)';
    ctx.fill();
    uiText(ctx, 'Time left', bx + bw / 2, by + 9, 8.5, COL.textDim, '600', 'center', 'middle');
    var low = game.phase === 'overtime' && game.timeLeft < 10;
    uiText(ctx, fmtTime(game.timeLeft), bx + bw / 2, by + 23, 16, low ? COL.red : COL.text, '700', 'center', 'middle');
  };

  // Elixir: drop with count on the left, segmented purple bar, smooth fill, x2/x3 and full-bar glow.
  Renderer.prototype._drawElixir = function (game, now) {
    var ctx = this.ctx;
    var b = this.barRect;
    var pl = game && game.players ? game.players[0] : null;
    var real = pl ? pl.elixir || 0 : 0;
    var e = clamp(this._elixirShown != null ? this._elixirShown : real, 0, 10);
    var mult = game && game.elixirMult ? game.elixirMult | 0 : 1;
    var time = this._time;
    var full = real >= 10;

    var dr = 9.5;
    var dcx = b.x + dr + 2;
    var dcy = b.y + b.h / 2;
    dropPath(ctx, dcx, dcy, dr);
    ctx.fillStyle = COL.drop;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    uiText(ctx, String(Math.floor(e)), dcx, dcy + 2, 13, '#ffffff', '700', 'center', 'middle');

    var sx0 = b.x + dr * 2 + 12;
    var sx1 = b.x + b.w - (mult > 1 ? 34 : 0);
    var gap = 3;
    var segW = (sx1 - sx0 - gap * 9) / 10;
    var pulse = full ? 0.5 + 0.5 * Math.sin(now / 160) : 0;
    if (full) {
      ctx.save();
      ctx.shadowColor = COL.elixirHi;
      ctx.shadowBlur = 6 + 8 * pulse;
    }
    for (var i = 0; i < 10; i++) {
      var x = sx0 + i * (segW + gap);
      rrPath(ctx, x, b.y, segW, b.h, 4);
      ctx.fillStyle = COL.segBack;
      ctx.fill();
      var f = clamp(e - i, 0, 1);
      if (f > 0) {
        rrPath(ctx, x, b.y, Math.max(2, segW * f), b.h, 4);
        ctx.fillStyle = full ? (pulse > 0.5 ? '#d88cff' : COL.elixir) : COL.elixir;
        ctx.fill();
        ctx.fillStyle = COL.elixirHi;
        ctx.fillRect(x + 2, b.y + 3, Math.max(0, segW * f - 4), 2);
      }
    }
    if (full) ctx.restore();

    // Shimmer band sweeps across the fill; faster with double and triple elixir.
    var speed = 0.5 * Math.max(1, mult);
    var sh = (time * speed) % 1;
    var shx = sx0 + sh * (sx1 - sx0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx0, b.y, (sx1 - sx0) * (e / 10), b.h);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(shx - 6, b.y, 12, b.h);
    ctx.restore();

    if (mult > 1) {
      var pw = 28;
      var px = b.x + b.w - pw;
      rrPath(ctx, px, b.y - 1, pw, b.h + 2, 6);
      ctx.fillStyle = COL.drop;
      ctx.fill();
      uiText(ctx, 'x' + mult, px + pw / 2, b.y + b.h / 2 + 0.5, 12, '#ffffff', '800', 'center', 'middle');
    }
  };

  // One card: rarity frame, art with emoji, name band, cost circle, and affordability fill.
  Renderer.prototype._card = function (cardId, x, y, w, h, o) {
    var ctx = this.ctx;
    o = o || {};
    var card = cardDef(cardId);
    if (!card) {
      rrPath(ctx, x, y, w, h, 7);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fill();
      return;
    }
    var frame = RARITY[card.rarity] || RARITY.common;
    rrPath(ctx, x, y, w, h, 7);
    ctx.fillStyle = frame;
    ctx.fill();

    var ix = x + 2.5;
    var iy = y + 2.5;
    var iw = w - 5;
    var ih = h - 5;
    rrPath(ctx, ix, iy, iw, ih, 5);
    ctx.fillStyle = COL.cardArt;
    ctx.fill();

    var bandH = o.compact ? 13 : Math.max(14, h * 0.24);
    var artH = ih - bandH;
    rrPath(ctx, ix, iy + artH, iw, bandH, 4);
    ctx.fillStyle = COL.cardBand;
    ctx.fill();

    this._emoji(card.emoji || '?', x + w / 2, iy + artH / 2 + 1, Math.min(artH * 0.72, w * 0.52));

    var label = o.label || card.name || '';
    var fs = o.compact ? 9 : 10.5;
    ctx.font = '700 ' + fs + 'px ' + FONT;
    while (fs > 6 && ctx.measureText(label).width > iw - 6) {
      fs -= 0.5;
      ctx.font = '700 ' + fs + 'px ' + FONT;
    }
    uiText(ctx, label, x + w / 2, iy + artH + bandH / 2 + 0.5, fs, COL.text, '700', 'center', 'middle');

    var elixir = o.elixir != null ? o.elixir : null;
    var lacking = elixir != null && card.cost > elixir;

    // Unaffordable: greyed art with the elixir fill rising behind it.
    if (lacking) {
      ctx.save();
      rrPath(ctx, ix, iy, iw, ih, 5);
      ctx.clip();
      ctx.fillStyle = 'rgba(40,40,52,0.5)';
      ctx.fillRect(ix, iy, iw, ih);
      var f = clamp(elixir / card.cost, 0, 1);
      ctx.fillStyle = 'rgba(201,107,245,0.45)';
      ctx.fillRect(ix, iy + ih - f * ih, iw, f * ih);
      ctx.restore();
    }

    if (card.cost != null) {
      var cr = Math.max(8, Math.min(11, h * 0.15));
      var ccx = ix + cr + 3;
      var ccy = iy + artH - cr - 3;
      ctx.beginPath();
      ctx.arc(ccx, ccy, cr, 0, TAU);
      ctx.fillStyle = lacking ? COL.elixirHi : COL.drop;
      ctx.fill();
      if (lacking) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
      uiText(ctx, String(card.cost), ccx, ccy + 0.5, cr * 1.15, lacking ? '#3a1654' : '#ffffff', '700', 'center', 'middle');
    }

    if (o.selected) {
      ctx.save();
      ctx.shadowColor = COL.gold;
      ctx.shadowBlur = 12;
      rrPath(ctx, x, y, w, h, 7);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = COL.gold;
      ctx.stroke();
      ctx.restore();
    }
  };

  Renderer.prototype._drawPanel = function (game, team, uiState, now) {
    var ctx = this.ctx;
    var top = this.panelTop;
    ctx.fillStyle = COL.panel;
    ctx.fillRect(0, top, this.cssW, this.cssH - top);
    ctx.fillStyle = COL.panelEdge;
    ctx.fillRect(0, top, this.cssW, 1);

    var p = game && game.players ? game.players[team] : null;
    var elixir = p ? p.elixir || 0 : 0;
    this._drawElixir(game, now);

    // "Next" label above the small card at the far left, which fades in on each change.
    var nr = this.nextRect;
    // Floor at 0.35 so the preview never vanishes while it fades in.
    var fade = 0.35 + 0.65 * clamp((now - this._nextFadeMs) / 200, 0, 1);
    ctx.globalAlpha = fade;
    uiText(ctx, 'Next', nr.x + nr.w / 2, nr.y - 8, 9, COL.textDim, '700', 'center', 'middle');
    this._card(p ? p.next : null, nr.x, nr.y, nr.w, nr.h, { compact: true, label: 'Next', elixir: elixir });
    ctx.globalAlpha = 1;

    var sel = uiState.selected;
    var anims = this._cardAnims || [];
    for (var i = 0; i < 4; i++) {
      var r = this.cardRects[i];
      var isSel = i === sel;
      var y = isSel ? r.y - CARD_LIFT : r.y;
      var animating = null;
      for (var a = 0; a < anims.length; a++) {
        if (anims[a].slot === i && anims[a].t < 0.28) animating = anims[a];
      }
      if (animating) {
        // The old "next" card flies from its slot into this slot.
        var k = ease(animating.t / 0.28);
        var fx = nr.x + (r.x - nr.x) * k;
        var fy = nr.y + (r.y - nr.y) * k;
        var fw = nr.w + (r.w - nr.w) * k;
        var fh = nr.h + (r.h - nr.h) * k;
        this._card(animating.id, fx, fy, fw, fh, { elixir: elixir });
        continue;
      }
      this._card(p && p.hand ? p.hand[i] : null, r.x, y, r.w, r.h, {
        elixir: elixir,
        selected: isSel
      });
    }
  };

  // ---------- public API ----------

  CR.Renderer = Renderer;
})();
