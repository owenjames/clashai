// Canvas 2D renderer for the battle screen: layout, hit testing, and all drawing.
// Layout and hit tests work in CSS px. The arena is drawn in tile units through a transform.
var CR = (globalThis.CR = globalThis.CR || {});

(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var W = 18;
  var H = 32;
  var TOP_BAR_H = 44;
  var PANEL_MIN_H = 110;
  var PANEL_TILES = 4.2;
  var MARGIN = 10;
  var CARD_GAP = 6;
  var NEXT_W = 44;
  var CARD_LIFT = 8;
  var BAR_H = 22;
  var BAR_TOP = 8;
  var DEPLOY_CACHE_MS = 150;
  var LUNGE_T = 0.15;
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
    grassEdge: '#4d8c35',
    river: '#3a9be0',
    riverDeep: 'rgba(18,80,150,0.28)',
    riverBank: '#2a72ae',
    ripple: 'rgba(214,242,255,0.6)',
    wood: '#a8733f',
    woodDark: '#6c441d',
    rail: '#4a2b11',
    stone: '#d6d0bf',
    stoneEdge: '#6c675a',
    shadow: 'rgba(10,40,10,0.22)',
    hpBack: 'rgba(0,0,0,0.6)',
    invalid: 'rgba(255,58,58,0.34)',
    invalidSolid: '#ff4d4d',
    gold: '#ffe066',
    elixir: '#c96bf5',
    elixirHi: '#f2b8ff',
    drop: '#9b3fd6',
    segBack: 'rgba(0,0,0,0.45)',
    cardArt: '#f6ecd2',
    cardBand: '#2c2846',
    crownOff: '#3b4459',
    ice: '#a6e4ff',
    text: '#f3f6fb',
    textDim: '#94a1ba',
    orange: '#ffa640'
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

  // ---------- helpers ----------

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
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

  // Static arena layer: grass, border, river base and bridges. Painted once per resize.
  function paintArenaStatic(g, cfg) {
    var i, j;
    for (j = 0; j < H; j++) {
      for (i = 0; i < W; i++) {
        g.fillStyle = (i + j) & 1 ? COL.grassA : COL.grassB;
        g.fillRect(i, j, 1, 1);
      }
    }
    g.fillStyle = COL.grassEdge;
    g.fillRect(0, 0, W, 0.35);
    g.fillRect(0, H - 0.35, W, 0.35);
    g.fillRect(0, 0, 0.35, H);
    g.fillRect(W - 0.35, 0, 0.35, H);

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
      var bw = b.halfWidth * 2;
      var y0 = rt - 0.25;
      var bh = rb - rt + 0.5;
      g.fillStyle = COL.woodDark;
      g.fillRect(x0 - 0.05, y0, bw + 0.1, bh);
      g.fillStyle = COL.wood;
      g.fillRect(x0, y0, bw, bh);
      g.fillStyle = COL.woodDark;
      for (var py = y0 + 0.2; py < y0 + bh - 0.1; py += 0.32) {
        g.fillRect(x0, py, bw, 0.06);
      }
      g.fillStyle = COL.rail;
      g.fillRect(x0, y0, 0.12, bh);
      g.fillRect(x0 + bw - 0.12, y0, 0.12, bh);
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
    this._cfg = arenaCfg();
    this._ppu = 1;
    this._time = 0;
    this._selected = -1;
    this._bg = null;
    this._glyphs = {};
    this._glyphCount = 0;
    this._towers = {};
    this._towerGame = null;
    this._towerTime = 0;
    this._dz = new Uint8Array(W * H);
    this._dzKey = null;
    this._dzGame = null;
    this._dzAt = -1e9;
    this._gBuf = [];
    this._aBuf = [];
  }

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

    var cardsY = this.panelTop + BAR_TOP + BAR_H + 8;
    var cardH = Math.max(24, this.panelTop + panelH - 10 - cardsY);
    var nextX = I.left + MARGIN;
    var cardsX0 = nextX + NEXT_W + 8;
    var cardsX1 = cssW - I.right - MARGIN;
    var cardW = (cardsX1 - cardsX0 - 3 * CARD_GAP) / 4;
    this.cardRects = [];
    for (i = 0; i < 4; i++) {
      this.cardRects.push({ x: cardsX0 + i * (cardW + CARD_GAP), y: cardsY, w: cardW, h: cardH });
    }
    this.nextRect = { x: nextX, y: cardsY + 12, w: NEXT_W, h: cardH - 12 };
    this.barRect = { x: I.left + MARGIN, y: this.panelTop + BAR_TOP, w: availW - 2 * MARGIN, h: BAR_H };

    if (!this._bg) this._bg = document.createElement('canvas');
    this._bg.width = Math.max(1, Math.ceil(W * T * this.dpr));
    this._bg.height = Math.max(1, Math.ceil(H * T * this.dpr));
    var g = this._bg.getContext('2d');
    g.setTransform(this.dpr * T, 0, 0, this.dpr * T, 0, 0);
    paintArenaStatic(g, this._cfg);

    this._glyphs = {};
    this._glyphCount = 0;
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

  Renderer.prototype._arenaXform = function () {
    var d = this.dpr;
    var T = this.T;
    this.ctx.setTransform(d * T, 0, 0, d * T, d * this.ox, d * this.oy);
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
    c = document.createElement('canvas');
    c.width = px;
    c.height = px;
    var g = c.getContext('2d');
    g.font = Math.round(px * 0.9) + 'px ' + EMOJI_FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, px / 2, px / 2 + px * 0.04);
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

  // ---------- main draw ----------

  Renderer.prototype.draw = function (game, uiState) {
    var ctx = this.ctx;
    uiState = uiState || {};
    var team = uiState.team === 1 ? 1 : 0;
    var sel = typeof uiState.selected === 'number' ? uiState.selected : -1;
    this._selected = sel;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COL.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this._bg || !this.T) return;
    ctx.drawImage(this._bg, Math.round(this.ox * this.dpr), Math.round(this.oy * this.dpr));

    var time = game && game.time ? game.time : 0;
    this._time = time;
    var pl = game && game.players ? game.players[team] : null;
    var cardId = pl && pl.hand && sel >= 0 ? pl.hand[sel] : null;
    var cd = cardDef(cardId);

    if (game) {
      this._trackTowers(game);
      this._sortEntities(game.entities);
    }

    this._arenaXform();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    this._drawRipples(time);
    this._drawRubble();
    if (game && cd && cd.type !== 'spell') this._drawDeployZone(game, team, cardId);
    if (game) {
      this._drawShadows();
      this._drawGroundStack();
      this._drawBeams();
      this._drawProjectiles(game);
      this._drawAir();
      this._drawSpells(game, time);
      this._drawEffects(game);
      if (uiState.drag && sel >= 0 && cd) this._drawDragGhost(game, team, uiState, cardId, cd);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    this._uiXform();
    this._drawTopBar(game, team);
    this._drawPanel(game, team, uiState);

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
      if (!entAlive(e)) continue;
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
    ctx.fillStyle = COL.invalid;
    ctx.fill();
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

  Renderer.prototype._drawGroundStack = function () {
    var g = this._gBuf;
    for (var i = 0; i < g.length; i++) {
      var e = g[i];
      if (e.kind === 'tower') this._drawTower(e);
      else if (e.kind === 'building') this._drawBody(e, 0, true, 1.3, true);
      else this._drawBody(e, 0, false, 1.5, false);
    }
    this.ctx.globalAlpha = 1;
  };

  Renderer.prototype._drawAir = function () {
    var a = this._aBuf;
    for (var i = 0; i < a.length; i++) {
      this._drawBody(a[i], 0.6, false, 1.5, false);
    }
    this.ctx.globalAlpha = 1;
  };

  // Shared body drawing for troops and buildings.
  Renderer.prototype._drawBody = function (e, lift, square, emojiK, alwaysBar) {
    var ctx = this.ctx;
    var time = this._time;
    var r = radiusOf(e);
    var team = teamColor(e.team);
    var x = e.x;
    var y = e.y - lift;

    // Lunge toward the target for a short time after an attack.
    var age = e.lastAttackT != null ? time - e.lastAttackT : -1;
    if (age >= 0 && age < LUNGE_T && e.target && typeof e.target === 'object') {
      var dx = e.target.x - e.x;
      var dy = e.target.y - e.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.01) {
        var amt = Math.min(0.25, r * 0.5) * Math.sin((Math.PI * age) / LUNGE_T);
        x += (dx / d) * amt;
        y += (dy / d) * amt;
      }
    }

    var deploying = e.deployT > 0;
    var frozen = e.freezeT > 0;
    ctx.globalAlpha = deploying ? 0.5 : 1;

    if (square) {
      rrPath(ctx, x - r, y - r, r * 2, r * 2, r * 0.3);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fillStyle = frozen ? COL.ice : team.main;
    ctx.fill();
    ctx.lineWidth = Math.max(0.05, r * 0.16);
    ctx.strokeStyle = frozen ? '#3d7fb0' : team.dark;
    ctx.stroke();

    this._emoji(unitEmoji(e.unitId), x, y, Math.max(0.36, emojiK * r));

    if (e.charging) {
      var facing = typeof e.facing === 'number' ? e.facing : e.team === 1 ? Math.PI / 2 : -Math.PI / 2;
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

    if (deploying) {
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(x, y, r + 0.14, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(e.deployT, 0, 1));
      ctx.lineWidth = 0.08;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    ctx.globalAlpha = deploying ? 0.5 : 1;
    if (e.maxHp > 0 && e.hp > 0 && (alwaysBar || e.hp < e.maxHp)) {
      var bw = square ? r * 2.4 : Math.max(0.7, r * 2.2);
      this._bar(x, y - r - 0.34, bw, e.hp / e.maxHp, team.main);
    }
    ctx.globalAlpha = 1;
  };

  Renderer.prototype._drawTower = function (e) {
    var ctx = this.ctx;
    var type = e.towerType || (e.unitId === 'king' ? 'king' : 'princess');
    var size = towerSize(type);
    var half = size / 2;
    var x = e.x;
    var y = e.y;
    var team = teamColor(e.team);
    var sign = e.team === 1 ? 1 : -1;
    var active = type !== 'king' || e.active !== false;
    ctx.globalAlpha = active ? 1 : 0.65;

    // Crenellations on the top and bottom edges, then the stone block.
    ctx.fillStyle = COL.stone;
    ctx.strokeStyle = COL.stoneEdge;
    ctx.lineWidth = 0.08;
    var i;
    for (i = 0; i < size; i++) {
      var mx = x - half + i + 0.2;
      ctx.fillRect(mx, y - half - 0.3, 0.6, 0.34);
      ctx.strokeRect(mx, y - half - 0.3, 0.6, 0.34);
      ctx.fillRect(mx, y + half - 0.04, 0.6, 0.34);
      ctx.strokeRect(mx, y + half - 0.04, 0.6, 0.34);
    }
    ctx.fillRect(x - half, y - half, size, size);
    ctx.strokeRect(x - half, y - half, size, size);

    var roof = size - (type === 'king' ? 1.2 : 1.0);
    rrPath(ctx, x - roof / 2, y - roof / 2, roof, roof, 0.25);
    ctx.fillStyle = team.main;
    ctx.fill();
    ctx.lineWidth = 0.1;
    ctx.strokeStyle = team.dark;
    ctx.stroke();

    if (type === 'king') {
      this._emoji('👑', x, y, 1.25);
    } else {
      this._emoji('🏹', x, y, 0.95);
    }

    if (!active) {
      arenaText(ctx, 'z', x + half * 0.8, y - half * 0.8, 0.7, '#ffffff', { bold: true, outline: '#222' });
    }

    // Health bar on the side facing the player's own edge is drawn on the enemy side (outside the arena top).
    var maxHp = e.maxHp > 0 ? e.maxHp : 1;
    var frac = e.hp / maxHp;
    var bw = size * 0.95;
    var barY = sign < 0 ? y - half - 0.5 : y + half + 0.2;
    this._bar(x, barY, bw, frac, team.main);
    var txt = String(Math.max(0, Math.ceil(e.hp || 0)));
    if (sign < 0) {
      arenaText(ctx, txt, x, barY - 0.08, 0.42, COL.text, { bold: true, outline: 'rgba(0,0,0,0.7)', baseline: 'bottom' });
    } else {
      arenaText(ctx, txt, x, barY + 0.14 + 0.08, 0.42, COL.text, { bold: true, outline: 'rgba(0,0,0,0.7)', baseline: 'top' });
    }
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
        case 'deploy':
          ctx.beginPath();
          ctx.arc(x, y, R * (0.5 + 0.8 * p), 0, TAU);
          ctx.lineWidth = 0.1;
          ctx.strokeStyle = '#d9c9a0';
          ctx.stroke();
          break;
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
          ctx.beginPath();
          ctx.arc(x, y, R * 0.3 * (1 - p), 0, TAU);
          ctx.fillStyle = '#fff1a6';
          ctx.fill();
          ctx.beginPath();
          for (k = 0; k < 6; k++) {
            var da = k * (TAU / 6) + 0.2;
            var dr = R * p * 0.9;
            ctx.moveTo(x + Math.cos(da) * dr + 0.12, y + Math.sin(da) * dr);
            ctx.arc(x + Math.cos(da) * dr, y + Math.sin(da) * dr, 0.12, 0, TAU);
          }
          ctx.fillStyle = '#6e5a4a';
          ctx.fill();
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
        case 'elixir':
          arenaText(ctx, String(f.text || '-'), x, y - 1.6 * p, 0.9, '#d98bff', {
            bold: true,
            outline: '#2b0d40'
          });
          break;
        default:
          break;
      }
      ctx.restore();
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

  Renderer.prototype._crowns = function (x, cy, count, t, align) {
    var ctx = this.ctx;
    var col = teamColor(t);
    var cw = 15;
    var ch = 12;
    var gap = 3;
    var total = 3 * cw + 2 * gap;
    var x0 = align === 'right' ? x - total : x;
    for (var i = 0; i < 3; i++) {
      var on = i < count;
      crownPath(ctx, x0 + i * (cw + gap), cy - ch / 2, cw, ch);
      ctx.fillStyle = on ? col.main : COL.crownOff;
      ctx.fill();
      if (on) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = col.dark;
        ctx.stroke();
      }
    }
  };

  Renderer.prototype._drawTopBar = function (game, team) {
    var ctx = this.ctx;
    var I = this.insets;
    var cssW = this.cssW;
    ctx.fillStyle = COL.topBar;
    ctx.fillRect(0, 0, cssW, I.top + TOP_BAR_H);

    var yLabel = I.top + 11;
    var yRow = I.top + 31;
    var cx = cssW / 2;
    var enemy = 1 - team;
    var pl = game && game.players ? game.players : null;
    var eC = pl && pl[enemy] ? pl[enemy].crowns | 0 : 0;
    var pC = pl && pl[team] ? pl[team].crowns | 0 : 0;

    // Left edge reserves room for the HTML pause button that sits over the top bar.
    var leftX = I.left + MARGIN + 40;
    uiText(ctx, 'Opponent', leftX, yLabel, 10, COL.textDim, '600', 'left', 'middle');
    this._crowns(leftX, yRow, eC, enemy, 'left');
    this._crowns(cssW - I.right - MARGIN, yRow, pC, team, 'right');

    if (!game) return;
    if (game.phase === 'overtime') {
      uiText(ctx, 'Overtime', cx, yLabel, 9, COL.orange, '700', 'center', 'middle');
    }
    var label = fmtTime(game.timeLeft);
    ctx.font = '700 17px ' + FONT;
    var tw = ctx.measureText(label).width;
    uiText(ctx, label, cx, yRow, 17, COL.text, '700', 'center', 'middle');

    var mult = game.elixirMult | 0;
    if (mult > 1) {
      var bx = cx + tw / 2 + 8;
      var by = yRow - 8;
      rrPath(ctx, bx, by, 30, 16, 5);
      ctx.fillStyle = COL.elixir;
      ctx.fill();
      uiText(ctx, 'x' + mult, bx + 15, by + 8.5, 10, '#ffffff', '700', 'center', 'middle');
    }
  };

  // Elixir drop, count, and 10 segments with a partial fill.
  Renderer.prototype._drawElixir = function (elixir) {
    var ctx = this.ctx;
    var b = this.barRect;
    var e = clamp(elixir || 0, 0, 10);
    var dr = 11;
    var dcx = b.x + dr;
    var dcy = b.y + b.h / 2;
    dropPath(ctx, dcx, dcy, dr * 0.8);
    ctx.fillStyle = COL.drop;
    ctx.fill();
    uiText(ctx, String(Math.floor(e)), dcx, dcy + 1, 12, '#ffffff', '700', 'center', 'middle');

    var sx0 = b.x + dr * 2 + 8;
    var sx1 = b.x + b.w;
    var gap = 3;
    var segW = (sx1 - sx0 - gap * 9) / 10;
    for (var i = 0; i < 10; i++) {
      var x = sx0 + i * (segW + gap);
      rrPath(ctx, x, b.y, segW, b.h, 4);
      ctx.fillStyle = COL.segBack;
      ctx.fill();
      var f = clamp(e - i, 0, 1);
      if (f > 0) {
        rrPath(ctx, x, b.y, Math.max(2, segW * f), b.h, 4);
        ctx.fillStyle = COL.elixir;
        ctx.fill();
        ctx.fillStyle = COL.elixirHi;
        ctx.fillRect(x + 2, b.y + 3, Math.max(0, segW * f - 4), 2);
      }
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

    if (card.cost != null) {
      var cr = Math.max(8, Math.min(11, h * 0.15));
      var ccx = ix + cr + 3;
      var ccy = iy + artH - cr - 3;
      ctx.beginPath();
      ctx.arc(ccx, ccy, cr, 0, TAU);
      ctx.fillStyle = COL.drop;
      ctx.fill();
      uiText(ctx, String(card.cost), ccx, ccy + 0.5, cr * 1.15, '#ffffff', '700', 'center', 'middle');
    }

    if (o.elixir != null && card.cost > o.elixir) {
      var f = clamp(o.elixir / card.cost, 0, 1);
      ctx.save();
      rrPath(ctx, ix, iy, iw, ih, 5);
      ctx.clip();
      ctx.fillStyle = 'rgba(30,26,44,0.55)';
      ctx.fillRect(ix, iy, iw, ih);
      ctx.fillStyle = 'rgba(201,107,245,0.45)';
      ctx.fillRect(ix, iy + ih - f * ih, iw, f * ih);
      ctx.restore();
    }

    if (o.selected) {
      rrPath(ctx, x, y, w, h, 7);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = COL.gold;
      ctx.stroke();
    }
  };

  Renderer.prototype._drawPanel = function (game, team, uiState) {
    var ctx = this.ctx;
    var top = this.panelTop;
    ctx.fillStyle = COL.panel;
    ctx.fillRect(0, top, this.cssW, this.cssH - top);
    ctx.fillStyle = COL.panelEdge;
    ctx.fillRect(0, top, this.cssW, 1);

    var p = game && game.players ? game.players[team] : null;
    var elixir = p ? p.elixir || 0 : 0;
    this._drawElixir(elixir);

    var nr = this.nextRect;
    this._card(p ? p.next : null, nr.x, nr.y, nr.w, nr.h, { compact: true, label: 'next' });

    var sel = uiState.selected;
    for (var i = 0; i < 4; i++) {
      var r = this.cardRects[i];
      var isSel = i === sel;
      var y = isSel ? r.y - CARD_LIFT : r.y;
      this._card(p && p.hand ? p.hand[i] : null, r.x, y, r.w, r.h, {
        elixir: elixir,
        selected: isSel
      });
    }
  };

  // ---------- public API ----------

  CR.Renderer = Renderer;
})();
