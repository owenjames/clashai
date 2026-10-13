// Pixi v8 battle renderer: CR.PixiRenderer. Same public API and layout as CR.Renderer (js/render.js),
// so input and hit testing match. Pixi does not own the loop: draw() renders once per call.
// Scene: arena cached to one texture; world container scaled so 1 unit = 1 tile (T css px);
// units and towers y-sorted by feet (zIndex = y); team rings and ground shadows on a layer under them.
// Art: CR.Sprites (assets/manifest.json, troop art from CR.TroopArt); procedural placeholders otherwise.
// Requires js/vendor/pixi.min.js (global PIXI), js/sprites.js, and the render.js layout constants (copied here).
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
  var FLASH_S = 0.1;      // hit flash length in game seconds (about 3 ticks)
  var FALL_T = 0.25;      // seconds a dropped unit takes to land
  var FALL_H = 2.6;       // tiles above the landing point it starts from
  var LEVEL = 11;
  var MAX_PARTS = 260;
  var TICK_MS = 1000 / 30;
  var NUM_FONT = 'ClashNum';
  var FONT = "'Lilita One', 'Arial Rounded MT Bold', 'Arial Black', Arial, sans-serif";
  var FONT_URL = 'assets/fonts/LilitaOne-Regular.ttf';
  var TOP_FX = { hit: 1, zap: 1, lightning: 1, chain: 1, death: 1, spawn: 1, elixir: 1, deploy: 1, towerDown: 1 };
  // Tower art width in tiles, by type (footprint: king 4, princess 3). Height follows the art's aspect ratio.
  var TOWER_W = { king: 4.3, princess: 3.2 };  // 4.3 keeps the team 1 king's roof (5 tiles tall) inside the arena

  // Canvas colours for the arena painter (same as js/render.js).
  var CS = {
    grassA: '#8fd46a', grassB: '#84c95d', grassLine: 'rgba(40,90,30,0.07)', path: 'rgba(255,246,214,0.16)',
    stoneBorder: '#8d877a', stoneBorderHi: '#b9b3a2', river: '#3a9be0', riverDeep: 'rgba(18,80,150,0.28)',
    riverBank: '#2a72ae', wood: '#a8733f', woodDark: '#6c441d', rail: '#4a2b11'
  };

  // Pixi colours (numbers).
  var P = {
    bg: 0x0b1020, topBar: 0x111a2c, panel: 0x16203a, panelEdge: 0x2b3a5e,
    text: 0xf3f6fb, textDim: 0x94a1ba, red: 0xff5a4f, gold: 0xffe066,
    elixir: 0xc96bf5, elixirHi: 0xf2b8ff, drop: 0x9b3fd6, segBack: 0x140822,
    cardArt: 0xf6ecd2, cardBand: 0x2c2846, crownOff: 0x3b4459, ice: 0xa6e4ff,
    invalid: 0xff3a3a, invalidSolid: 0xff4d4d, pillBg: 0x0c1222, white: 0xffffff,
    enemy: 0xe5413b, mine: 0x2f7cf6, levelBar: 0xffe066
  };
  var RARITY = { common: 0x9a7b57, rare: 0xe0932f, epic: 0xa25ce0, legendary: 0xf0c93a };
  var TEAM_FALLBACK = [
    { main: '#2f7cf6', dark: '#1a4fa8', light: '#9cc3ff' },
    { main: '#e5413b', dark: '#9c1f1b', light: '#ffaaa6' }
  ];
  var CONFETTI = [0xffe066, 0xff5a7a, 0x5ce1ff, 0x8ee05a, 0xc96bf5, 0xffffff];

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

  function hexN(s) {
    return parseInt(String(s).replace('#', ''), 16);
  }

  var teamCache = [null, null];
  function teamN(t) {
    var i = t === 1 ? 1 : 0;
    if (!teamCache[i]) {
      var tc = CR.TEAM_COLORS || TEAM_FALLBACK;
      var c = tc[i] || TEAM_FALLBACK[i];
      teamCache[i] = { main: hexN(c.main), dark: hexN(c.dark), light: hexN(c.light) };
    }
    return teamCache[i];
  }

  function cardDef(id) {
    return (id != null && CR.CARDS && CR.CARDS[id]) || null;
  }

  function unitDef(id) {
    return (id != null && CR.UNITS && CR.UNITS[id]) || null;
  }

  function towerSize(type) {
    var spec = CR.TOWERS && CR.TOWERS[type];
    if (spec && spec.size) return spec.size;
    return type === 'king' ? 4 : 3;
  }

  function towerKey(e) {
    return e.id != null ? 'id' + e.id : e.team + ':' + (e.towerType || '') + ':' + e.lane;
  }

  function entKey(e) {
    return e.id != null ? e.id : e;
  }

  function entAlive(e) {
    return !e.dead && !(e.hp <= 0);
  }

  // Draw radius: troops draw larger than their collision circle so the art reads on a phone.
  function radiusOf(e) {
    var def = unitDef(e.unitId) || {};
    var r = e.r || def.r || 0.5;
    return e.kind === 'troop' ? r * 1.2 + 0.1 : r;
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

  function fmtTime(s) {
    var t = Math.max(0, Math.ceil(s || 0));
    var m = Math.floor(t / 60);
    var r = t % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
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

  // Parses '#rrggbb' or 'rgba(r,g,b,a)' into { color, alpha } for the Pixi fill and stroke styles.
  function colA(s) {
    if (s.charAt(0) === '#') return { color: hexN(s), alpha: 1 };
    var m = /rgba?\(([^)]+)\)/.exec(s);
    if (!m) return { color: 0, alpha: 1 };
    var p = m[1].split(',');
    var r = parseInt(p[0], 10);
    var g = parseInt(p[1], 10);
    var b = parseInt(p[2], 10);
    return { color: (r << 16) | (g << 8) | b, alpha: p.length > 3 ? parseFloat(p[3]) : 1 };
  }

  // Pooled display objects for things that exist for one frame. Index-based: reset() then next() per item,
  // end() hides the rest. Items keep their parent, so only a growing high-water mark allocates.
  function Alloc(parent, make) {
    this.parent = parent;
    this.make = make;
    this.items = [];
    this.n = 0;
  }
  Alloc.prototype.begin = function () {
    this.n = 0;
  };
  Alloc.prototype.next = function () {
    var it;
    if (this.n < this.items.length) {
      it = this.items[this.n];
    } else {
      it = this.make();
      this.parent.addChild(it);
      this.items.push(it);
    }
    this.n++;
    it.visible = true;
    return it;
  };
  Alloc.prototype.end = function () {
    for (var i = this.n; i < this.items.length; i++) this.items[i].visible = false;
  };
  // Sprite from the pool, reset to neutral look.
  Alloc.prototype.sprite = function (tex) {
    var s = this.next();
    s.texture = tex;
    s.anchor.set(0.5);
    s.alpha = 1;
    s.tint = 0xffffff;
    s.blendMode = 'normal';
    s.rotation = 0;
    s.scale.set(1);
    s.zIndex = 0;
    return s;
  };
  // BitmapText from the pool.
  Alloc.prototype.label = function (str, size, color) {
    var t = this.next();
    t.text = str;
    t.fontSize = size;
    t.tint = color == null ? 0xffffff : color;
    t.anchor.set(0.5);
    t.alpha = 1;
    t.scale.set(1);
    t.zIndex = 0;
    return t;
  };

  var fontOk = false;
  function loadFont() {
    if (typeof FontFace === 'undefined' || !document.fonts) return Promise.resolve(false);
    var ff = new FontFace('Lilita One', 'url(' + FONT_URL + ')');
    return ff.load().then(function (f) {
      document.fonts.add(f);
      fontOk = true;
      return true;
    }, function () {
      return false;
    });
  }

  function installNumFont() {
    try {
      PIXI.BitmapFont.install({
        name: NUM_FONT,
        style: {
          fontFamily: fontOk ? 'Lilita One' : 'Arial Black, Arial, sans-serif',
          fontSize: 64,
          fill: '#ffffff',
          fontWeight: '700',
          stroke: { color: '#111111', width: 9 }
        },
        chars: [['0', '9'], ['a', 'z'], ['A', 'Z'], ' !-.:+']
      });
    } catch (e) {
      /* no bitmap font: labels fall back to the default and stay readable */
    }
  }

  // Static arena layer, painted once per resize (same look as js/render.js). Units are tiles scaled by dpr * T.
  function emojiCanvas(emoji, px) {
    var c = document.createElement('canvas');
    c.width = px;
    c.height = px;
    var g = c.getContext('2d');
    g.font = Math.round(px * 0.9) + 'px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, px / 2, px / 2 + px * 0.04);
    return c;
  }

  function paintArena(g, cfg, T, dpr) {
    var i, j;
    for (j = 0; j < H; j++) {
      for (i = 0; i < W; i++) {
        g.fillStyle = (i + j) & 1 ? CS.grassA : CS.grassB;
        g.fillRect(i, j, 1, 1);
      }
    }
    g.fillStyle = CS.grassLine;
    for (i = 1; i < W; i++) g.fillRect(i - 0.02, 0, 0.04, H);
    for (j = 1; j < H; j++) g.fillRect(0, j - 0.02, W, 0.04);

    g.fillStyle = CS.path;
    for (i = 0; i < cfg.BRIDGES.length; i++) {
      var pb = cfg.BRIDGES[i];
      g.fillRect(pb.x - pb.halfWidth - 0.4, 2.5, pb.halfWidth * 2 + 0.8, cfg.RIVER_TOP - 2.5);
      g.fillRect(pb.x - pb.halfWidth - 0.4, cfg.RIVER_BOTTOM, pb.halfWidth * 2 + 0.8, 25.5 - cfg.RIVER_BOTTOM);
    }

    var bw = 0.5;
    g.fillStyle = CS.stoneBorder;
    g.fillRect(0, 0, W, bw);
    g.fillRect(0, H - bw, W, bw);
    g.fillRect(0, 0, bw, H);
    g.fillRect(W - bw, 0, bw, H);
    g.fillStyle = CS.stoneBorderHi;
    g.fillRect(bw, bw, W - 2 * bw, 0.06);
    g.fillRect(bw, H - bw - 0.06, W - 2 * bw, 0.06);
    var px = Math.max(16, Math.round(0.8 * T * dpr * 2));
    var trees = [[0.5, 1.2], [W - 0.5, 4.5], [0.5, 9.5], [W - 0.5, 27.3], [0.5, 30.8], [W - 0.5, 22.4]];
    var rocks = [[1.1, 17.2], [W - 1.1, 14.6], [9, 0.8], [5, H - 0.8], [13.2, H - 0.8]];
    var t;
    g.save();
    for (i = 0; i < trees.length; i++) {
      t = trees[i];
      g.drawImage(emojiCanvas('\u{1F333}', px), t[0] - 0.6, t[1] - 0.6, 1.2, 1.2);
    }
    for (i = 0; i < rocks.length; i++) {
      t = rocks[i];
      g.drawImage(emojiCanvas('\u{1FAA8}', px), t[0] - 0.35, t[1] - 0.35, 0.7, 0.7);
    }
    g.restore();

    var rt = cfg.RIVER_TOP;
    var rb = cfg.RIVER_BOTTOM;
    g.fillStyle = CS.river;
    g.fillRect(0, rt, W, rb - rt);
    g.fillStyle = CS.riverDeep;
    g.fillRect(0, rt + (rb - rt) / 2, W, (rb - rt) / 2);
    g.fillStyle = CS.riverBank;
    g.fillRect(0, rt - 0.08, W, 0.08);
    g.fillRect(0, rb, W, 0.08);

    for (i = 0; i < cfg.BRIDGES.length; i++) {
      var b = cfg.BRIDGES[i];
      var x0 = b.x - b.halfWidth;
      var bwid = b.halfWidth * 2;
      var y0 = rt - 0.25;
      var bh = rb - rt + 0.5;
      g.fillStyle = CS.woodDark;
      g.fillRect(x0 - 0.05, y0, bwid + 0.1, bh);
      g.fillStyle = CS.wood;
      g.fillRect(x0, y0, bwid, bh);
      g.fillStyle = CS.woodDark;
      for (var py = y0 + 0.2; py < y0 + bh - 0.1; py += 0.32) g.fillRect(x0, py, bwid, 0.06);
      g.fillStyle = CS.rail;
      g.fillRect(x0, y0, 0.12, bh);
      g.fillRect(x0 + bwid - 0.12, y0, 0.12, bh);
    }
  }

  // ---------- renderer ----------

  function PixiRenderer(canvas) {
    this.canvas = canvas;
    this.dpr = 1;
    this.cssW = 0;
    this.cssH = 0;
    this.insets = { top: 0, bottom: 0, left: 0, right: 0 };
    this.T = 0;
    this._pxPerTile = 1;  // device px per tile; set by _onLayout, kept across battles
    this.ox = 0;
    this.oy = 0;
    this.panelTop = 0;
    this.panelH = PANEL_MIN_H;
    this.cardRects = [];
    this.nextRect = null;
    this.barRect = null;
    this.emoteRect = null;
    this._cfg = arenaCfg();
    this._selected = -1;
    this._built = false;
    this.ready = false;
    this.failed = null;
    this._pending = null;
    this._texts = [];
    this._arenaTex = null;
    this._resetState();

    var self = this;
    this._app = new PIXI.Application();
    this._initP = Promise.all([
      this._app.init({
        canvas: canvas,
        width: 390,
        height: 844,
        resolution: 1,
        autoStart: false,
        background: P.bg,
        antialias: true,
        preference: 'webgl'
      }),
      loadFont(),
      CR.Sprites.load()
    ]).then(function () {
      installNumFont();
      self._build();
      self.ready = true;
      self._onLayout();
      if (self._pending) {
        var p = self._pending;
        self._pending = null;
        self.draw(p[0], p[1]);
      }
    }, function (err) {
      self.failed = err || new Error('pixi init');
      self._pending = null;
    });
  }

  // State that resets per battle (no Pixi objects touched here until built).
  PixiRenderer.prototype._resetState = function () {
    if (this._built) {
      this._releaseAll();
    }
    this._game = null;
    this._frame = 0;
    this._lastMs = 0;
    this._tickTime = -1e9;
    this._tickNow = 0;
    this._uviews = new Map();
    this._uPool = [];
    this._dying = [];
    this._towers = new Map();
    this._parts = [];
    this._seenFx = new WeakSet();
    this._seenEv = new WeakSet();
    this._fly = [];
    this._crownShown = [0, 0];
    this._crownPopMs = [-1e9, -1e9];
    this._elixirShown = null;
    this._prevHand = [null, null, null, null];
    this._prevNext = null;
    this._cardAnims = [];
    this._nextFadeMs = -1e9;
    this._gt = 0;
    this._hudT = null;
    this._shakeMs = -1e9;
    this._shakeAmp = 0;
    this._endMs = -1;
    this._dz = new Uint8Array(W * H);
    this._dzKey = null;
    this._dzGame = null;
    this._dzAt = -1e9;
    this._trail = new WeakMap();
  };

  // Hides every view. Towers are destroyed (at most six per battle) and rebuilt by the next game.
  PixiRenderer.prototype._releaseAll = function () {
    var self = this;
    this._uviews.forEach(function (v) {
      self._hideUnit(v);
      self._uPool.push(v);
    });
    this._dying.forEach(function (v) {
      self._hideUnit(v);
      self._uPool.push(v);
    });
    this._dying = [];
    this._uviews.clear();
    this._towers.forEach(function (v) {
      v.root.destroy({ children: true });
      v.shadow.destroy();
      if (v.ring) v.ring.destroy();
      if (v.pill) v.pill.destroy();
      if (v.pillT) v.pillT.destroy();
      if (v.zz) v.zz.destroy();
      if (v.rubble) v.rubble.destroy();
    });
    this._towers.clear();
  };

  PixiRenderer.prototype._build = function () {
    var stage = this._app.stage;
    var world = (this._world = new PIXI.Container());
    stage.addChild(world);
    var L = (this._lay = {});
    var names = ['arena', 'dz', 'rubble', 'ripple', 'shadow', 'fxBelow', 'sort', 'fxAbove', 'part', 'label', 'drag'];
    for (var i = 0; i < names.length; i++) {
      L[names[i]] = new PIXI.Container();
      world.addChild(L[names[i]]);
    }
    L.sort.sortableChildren = true;

    this._arena = new PIXI.Sprite(PIXI.Texture.EMPTY);
    L.arena.addChild(this._arena);
    this._rippleG = new PIXI.Graphics();
    L.ripple.addChild(this._rippleG);
    this._fxBelowG = new PIXI.Graphics();
    L.fxBelow.addChild(this._fxBelowG);
    this._fxAboveG = new PIXI.Graphics();
    L.fxAbove.addChild(this._fxAboveG);
    this._dragG = new PIXI.Graphics();
    L.drag.addChild(this._dragG);

    var spriteMake = function () {
      return new PIXI.Sprite(PIXI.Texture.EMPTY);
    };
    this._al = {
      dz: new Alloc(L.dz, function () {
        var ts = new PIXI.TilingSprite({ texture: CR.Sprites.tex.stripes(), width: 1, height: 1 });
        ts.tileScale.set(1 / 32);
        return ts;
      }),
      fxBelow: new Alloc(L.fxBelow, spriteMake),
      fxAbove: new Alloc(L.fxAbove, spriteMake),
      sort: new Alloc(L.sort, spriteMake),
      part: new Alloc(L.part, spriteMake),
      drag: new Alloc(L.drag, spriteMake),
      label: new Alloc(L.label, function () {
        return new PIXI.BitmapText({ text: '', style: { fontFamily: NUM_FONT, fontSize: 0.3, align: 'center' } });
      }),
      labelSpr: new Alloc(L.label, spriteMake),
      hud: null
    };
    this._built = true;

    var hud = (this._hud = new PIXI.Container());
    stage.addChild(hud);
    this._buildHud(hud);
  };

  // Layout: identical to CR.Renderer.resize, so hit tests and drag targets match the Canvas renderer.
  PixiRenderer.prototype.resize = function (cssW, cssH, dpr, insets) {
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
    this.emoteRect = { x: this.ox + 4, y: this.oy + H * T - 46, w: 40, h: 40 };

    this._onLayout();
  };

  // Applies the current layout to Pixi objects. Safe before the app is ready (it does nothing then).
  PixiRenderer.prototype._onLayout = function () {
    if (!this._built || !this.cssW) return;
    var d = this.dpr;
    this._app.renderer.resize(this.cssW, this.cssH, d);
    this.canvas.style.width = this.cssW + 'px';
    this.canvas.style.height = this.cssH + 'px';
    for (var i = 0; i < this._texts.length; i++) this._texts[i].resolution = d;
    this._world.scale.set(this.T);
    this._world.position.set(this.ox, this.oy);
    this._pxPerTile = this.T * d;
    this._bakeArena();
    this._layoutHud();
  };

  PixiRenderer.prototype._bakeArena = function () {
    var T = this.T;
    var d = this.dpr;
    // Art arena (manifest.arena): one image covering the play area plus a margin, 1 tile = 1 world unit.
    var art = CR.Sprites && CR.Sprites.arena ? CR.Sprites.arena() : null;
    if (art) {
      var prev = this._arenaTex;
      this._arenaTex = null;
      this._arena.texture = art.tex;
      this._arena.position.set(-art.pad, -art.pad);
      this._arena.width = W + 2 * art.pad;
      this._arena.height = H + 2 * art.pad;
      if (prev) prev.destroy(true);
      return;
    }
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(W * T * d));
    c.height = Math.max(1, Math.ceil(H * T * d));
    var g = c.getContext('2d');
    g.setTransform(d * T, 0, 0, d * T, 0, 0);
    paintArena(g, this._cfg, T, d);
    var old = this._arenaTex;
    this._arenaTex = PIXI.Texture.from(c);
    this._arena.texture = this._arenaTex;
    this._arena.width = W;
    this._arena.height = H;
    if (old) old.destroy(true);
  };

  // Coordinates: canvas CSS px <-> tiles.
  PixiRenderer.prototype.screenToTile = function (px, py) {
    return { x: (px - this.ox) / this.T, y: (py - this.oy) / this.T };
  };

  PixiRenderer.prototype.tileToScreen = function (x, y) {
    return { x: this.ox + x * this.T, y: this.oy + y * this.T };
  };

  PixiRenderer.prototype.isInArena = function (px, py) {
    var t = this.screenToTile(px, py);
    return t.x >= 0 && t.x <= W && t.y >= 0 && t.y <= H;
  };

  PixiRenderer.prototype.hitTestCard = function (px, py) {
    var rs = this.cardRects;
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i];
      var top = i === this._selected ? r.y - CARD_LIFT : r.y;
      if (px >= r.x && px <= r.x + r.w && py >= top && py <= r.y + r.h) return i;
    }
    return -1;
  };

  // Team identity on the ground: a team-coloured disc with a team rim and a light outline.
  // rx, ry: radii in tiles, drawn in world coordinates into g (the caller clears it).
  function groundRing(g, x, y, rx, ry, team, alpha) {
    var rim = Math.max(0.07, rx * 0.14);
    g.ellipse(x, y, rx, ry).fill({ color: team.main, alpha: 0.3 * alpha });
    g.ellipse(x, y, rx, ry).stroke({ width: rim, color: team.main, alpha: alpha });
    g.ellipse(x, y, rx + rim * 0.5 + 0.02, ry + rim * 0.5 + 0.01).stroke({ width: 0.035, color: 0xffffff, alpha: 0.9 * alpha });
  }

  // ---------- units ----------

  // Visual for a unit: baked troop frames when CR.TroopArt exists, else the manifest or token placeholder.
  PixiRenderer.prototype._unitVisual = function (e) {
    return this._visualFor(e.unitId, e.team === 1 ? 1 : 0, radiusOf(e));
  };

  // Art for a unit drawn at radius r: manifest art first, then baked troop art, then the token.
  PixiRenderer.prototype._visualFor = function (unitId, team, r) {
    var art = CR.Sprites.unitArt(unitId, team);
    if (art) return art;
    return CR.Sprites.troop(unitId, team, 1.4 * (r / 0.5), this._pxPerTile) || CR.Sprites.unit(unitId);
  };

  PixiRenderer.prototype._makeUnitView = function () {
    var L = this._lay;
    var empty = PIXI.Texture.EMPTY;
    var v = {
      root: new PIXI.Container(),
      shadow: new PIXI.Sprite(CR.Sprites.tex.shadow()),
      ring: new PIXI.Graphics(),
      rage: new PIXI.Sprite(CR.Sprites.tex.glow()),
      shield: new PIXI.Sprite(CR.Sprites.tex.ring()),
      body: new PIXI.Sprite(empty),
      flash: new PIXI.Sprite(empty),
      gfx: new PIXI.Graphics(),
      stars: [],
      lvl: new PIXI.BitmapText({ text: String(LEVEL), style: { fontFamily: NUM_FONT, fontSize: 0.24, align: 'center' } }),
      vis: null
    };
    v.shadow.anchor.set(0.5);
    v.rage.anchor.set(0.5);
    v.shield.anchor.set(0.5);
    v.flash.blendMode = 'add';
    v.flash.alpha = 0.85;
    v.rage.tint = 0xaa46ff;
    v.rage.alpha = 0.45;
    v.shield.tint = 0x8cd2ff;
    v.lvl.anchor.set(0.5);
    for (var i = 0; i < 3; i++) {
      var s = new PIXI.Sprite(CR.Sprites.tex.stun());
      s.anchor.set(0.5);
      s.width = 0.22;
      s.height = 0.22;
      v.stars.push(s);
    }
    v.root.addChild(v.rage, v.shield, v.body, v.flash, v.gfx, v.lvl);
    for (i = 0; i < 3; i++) v.root.addChild(v.stars[i]);
    L.sort.addChild(v.root);
    L.shadow.addChild(v.shadow, v.ring);
    return v;
  };

  PixiRenderer.prototype._initUnit = function (v, e, time) {
    v.e = e;
    v.fx = v.tx = e.x;
    v.fy = v.ty = e.y;
    v.tickT = time;
    v.spd = 0;
    v.spawnT = time;
    v.landAt = time + FALL_T;
    v.landed = false;
    v.squashMs = null;
    v.hpPrev = e.hp;
    v.flashT = -1e9;
    v.animT = 0;
    v.bobPh = 0;
    v.dying = false;
    v.dyingT = 0;
    v.seen = -1;
    v.mirror = 1;
    v.root.visible = true;
    v.shadow.visible = true;
    v.ring.visible = true;
    v.lvl.visible = false;
    v.vis = null;
  };

  PixiRenderer.prototype._hideUnit = function (v) {
    v.root.visible = false;
    v.shadow.visible = false;
    v.ring.visible = false;
  };

  PixiRenderer.prototype._getUnit = function (e, time) {
    var v = this._uPool.length ? this._uPool.pop() : this._makeUnitView();
    this._initUnit(v, e, time);
    return v;
  };

  // Applies a visual: anchor, size and the base scale that maps the art to its tile height.
  PixiRenderer.prototype._setUnitVis = function (v, vis, e) {
    v.vis = vis;
    var tex0 = vis.frames.idle[0];
    var r = radiusOf(e);
    var hT = vis.troop ? vis.h : vis.h * (r / 0.5);
    v.hT = hT;
    v.topY = -vis.anchor.y * hT;
    v.baseS = hT / tex0.height;
    v.body.anchor.set(vis.anchor.x, vis.anchor.y);
    v.flash.anchor.set(vis.anchor.x, vis.anchor.y);
    v.lvl.fontSize = 0.24;
  };

  // Frame for a unit this tick. Attack frames start early so the strike frame lands on lastAttackT.
  PixiRenderer.prototype._unitFrame = function (v, vis, e, time, dt, la, walking) {
    var fps = vis.fps || 0;
    var n;
    var frames;
    var idx;
    if (la >= 0 && la < 60 && e.target && typeof e.target === 'object' && vis.frames.attack && vis.frames.attack.length) {
      n = vis.frames.attack.length;
      var strike = vis.strikeIdx != null ? vis.strikeIdx : Math.floor(n * 0.4);
      var fi = Math.floor(la * (fps || 8)) + strike;
      if (fi < n) return { tex: vis.frames.attack[Math.max(0, fi)], attacking: true };
    }
    frames = walking ? vis.frames.walk : vis.frames.idle;
    n = frames.length;
    idx = fps ? Math.floor(v.animT * fps) % n : 0;
    return { tex: frames[idx], attacking: false };
  };

  // One unit this frame: position, walk bob, squash, attack lunge, flash, deploy clock, status.
  PixiRenderer.prototype._drawUnit = function (v, e, alpha, time, now, dt) {
    var vis = this._unitVisual(e);
    if (vis !== v.vis) this._setUnitVis(v, vis, e);
    var r = radiusOf(e);
    var team = teamN(e.team);
    var x = v.fx + (v.tx - v.fx) * alpha;
    var y = v.fy + (v.ty - v.fy) * alpha;

    var lift = e.air ? 0.6 : 0;
    if (!v.landed && time >= v.landAt) {
      v.landed = true;
      v.squashMs = now;
    }
    if (!v.landed) lift += FALL_H * Math.pow(1 - clamp((time - v.spawnT) / FALL_T, 0, 1), 2);
    if (e.dash) lift += 0.8;

    var la = e.lastAttackT != null ? time - e.lastAttackT : -1;
    var lunge = 0;
    var target = e.target && typeof e.target === 'object' ? e.target : null;
    if (la >= 0 && la < LUNGE_T && target) {
      var dx = target.x - e.x;
      var dy = target.y - e.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.01) {
        var amt = Math.min(0.25, r * 0.5) * Math.sin((Math.PI * la) / LUNGE_T);
        x += (dx / d) * amt;
        y += (dy / d) * amt;
        lunge = Math.sin((Math.PI * la) / LUNGE_T);
      }
    }

    var walking = v.spd > 0.4 && !(e.stunT > 0) && !(e.freezeT > 0);
    if (walking) v.bobPh += dt * v.spd * 6;
    v.animT += dt;
    var f = this._unitFrame(v, vis, e, time, dt, la, walking);
    var bob = walking && !vis.troop ? Math.abs(Math.sin(v.bobPh)) * 0.07 * Math.max(0.5, r * 2) : 0;

    // Squash and stretch: walk cycle, landing, attack.
    var sx = 1;
    var sy = 1;
    if (walking) {
      var wob = Math.sin(v.bobPh * 2) * 0.05;
      sx += wob;
      sy -= wob;
    }
    if (v.squashMs != null) {
      var sqA = Math.max(0, 1 - (now - v.squashMs) / 180);
      sx *= 1 + 0.25 * sqA;
      sy *= 1 - 0.22 * sqA;
    }
    if (f.attacking) {
      sx *= 1 + 0.08 * lunge;
      sy *= 1 - 0.12 * lunge;
    }

    var facing = typeof e.facing === 'number' ? e.facing : e.team === 1 ? Math.PI / 2 : -Math.PI / 2;
    var mirror = (Math.cos(facing) < -0.2) !== vis.flip ? -1 : 1;
    v.mirror = mirror;

    var deploying = e.deployT > 0;
    var frozen = e.freezeT > 0;
    var invuln = e.invulnT > 0 && Math.floor(time * 20) % 2 === 0;

    v.root.position.set(x, y - lift - bob);
    v.root.zIndex = y + (e.air ? 64 : 0);
    v.body.texture = f.tex;
    v.body.scale.set(v.baseS * mirror * sx, v.baseS * sy);
    v.body.tint = frozen ? P.ice : 0xffffff;
    v.body.alpha = deploying ? 0.55 : invuln ? 0.4 : 1;

    if (e.hp < v.hpPrev - 1e-9) v.flashT = time;
    v.hpPrev = e.hp;
    var flashing = time - v.flashT < FLASH_S;
    v.flash.visible = flashing;
    v.flash.texture = f.tex;
    v.flash.anchor.set(vis.anchor.x, vis.anchor.y);
    v.flash.scale.copyFrom(v.body.scale);

    v.rage.visible = e.rageT > 0;
    if (v.rage.visible) v.rage.width = v.rage.height = 2 * r + 0.36;
    v.shield.visible = e.shield > 0;
    if (v.shield.visible) v.shield.width = v.shield.height = 2 * (r + 0.12);
    var cy = -(vis.anchor.y - 0.5) * v.hT;
    v.shield.position.set(0, cy);

    // Ground layer: shadow and team ring stay at the feet, below every unit.
    var ground = lift > 0.2;
    v.shadow.position.set(x, y);
    v.shadow.width = 1.9 * r;
    v.shadow.height = 0.95 * r;
    v.shadow.alpha = ground ? 0.45 : 0.85;
    v.ring.clear();
    groundRing(v.ring, x, y, r * 1.05, r * 0.55, team, 1);
    v.ring.alpha = 1;

    var st = e.stunT > 0;
    for (var i = 0; i < 3; i++) {
      var s = v.stars[i];
      s.visible = st;
      if (st) {
        var a = time * 7 + (i * TAU) / 3;
        s.position.set(Math.cos(a) * r * 0.9, v.topY - 0.25 + Math.sin(a * 1.3) * 0.08);
      }
    }

    // Overlay: hp bar with level badge, deploy clock, charge marks.
    var g = v.gfx;
    g.clear();
    var showBar = e.maxHp > 0 && e.hp > 0 && (e.kind === 'building' || e.hp < e.maxHp);
    if (showBar) {
      var bw = e.kind === 'building' ? r * 2.4 : Math.max(0.9, r * 2.2);
      var by = v.topY - 0.34;
      g.rect(-bw / 2 - 0.03, by - 0.03, bw + 0.06, 0.2).fill({ color: 0x000000, alpha: 0.6 });
      g.rect(-bw / 2, by, bw * clamp(e.hp / e.maxHp, 0, 1), 0.14).fill({ color: e.team === 1 ? P.enemy : P.mine });
      v.lvl.visible = true;
      v.lvl.position.set(-bw / 2 - 0.2, by + 0.07);
    } else {
      v.lvl.visible = false;
    }
    if (deploying) {
      var frac = clamp(e.deployT, 0, 1);
      g.moveTo(0, cy).arc(0, cy, r + 0.2, -Math.PI / 2, -Math.PI / 2 + TAU * frac).lineTo(0, cy).fill({ color: 0xffffff, alpha: 0.45 });
      g.circle(0, cy, r + 0.2).stroke({ width: 0.06, color: 0x000000, alpha: 0.45 });
    }
    if (e.charging) {
      var bx = Math.cos(facing + Math.PI);
      var by2 = Math.sin(facing + Math.PI);
      var px = -by2;
      var py = bx;
      for (var k = -1; k <= 1; k++) {
        var o = k * 0.22;
        var sx0 = bx * (r + 0.08) + px * o;
        var sy0 = cy + by2 * (r + 0.08) + py * o;
        g.moveTo(sx0, sy0).lineTo(sx0 + bx * 0.55, sy0 + by2 * 0.55);
      }
      g.stroke({ width: 0.06, color: 0xffffff, alpha: 0.8 });
    }
  };

  // Death: the unit's last frame or death frames play, then it fades out and is recycled.
  PixiRenderer.prototype._startDying = function (v, now) {
    v.dying = true;
    v.dyingT = 0;
    v.dyingX = v.fx;
    v.dyingY = v.fy;
    v.dyingFrames = v.vis ? v.vis.frames.death : null;
    v.dyingFps = v.vis ? v.vis.fps || 0 : 0;
    v.gfx.clear();
    v.lvl.visible = false;
    v.rage.visible = false;
    v.shield.visible = false;
    for (var i = 0; i < 3; i++) v.stars[i].visible = false;
    this._dying.push(v);
  };

  PixiRenderer.prototype._updateDying = function (dt) {
    var keep = [];
    for (var i = 0; i < this._dying.length; i++) {
      var v = this._dying[i];
      v.dyingT += dt;
      var p = clamp(v.dyingT / 0.5, 0, 1);
      if (p >= 1) {
        this._hideUnit(v);
        this._uPool.push(v);
        continue;
      }
      keep.push(v);
      var frames = v.dyingFrames;
      if (frames && frames.length && v.dyingFps) {
        v.body.texture = frames[Math.min(frames.length - 1, Math.floor(v.dyingT * v.dyingFps))];
      }
      v.root.visible = true;
      v.root.position.set(v.dyingX, v.dyingY - 0.4 * p);
      v.root.zIndex = v.dyingY;
      v.body.alpha = 1 - p;
      v.body.visible = true;
      if (v.baseS) v.body.scale.set(v.baseS * v.mirror * (1 - 0.3 * p), v.baseS * (1 - 0.3 * p));
      v.shadow.alpha = 0.85 * (1 - p);
      v.ring.alpha = 0.9 * (1 - p);
      v.flash.visible = false;
    }
    this._dying = keep;
  };

  // ---------- towers ----------

  PixiRenderer.prototype._makeTower = function (e) {
    var type = e.towerType || (e.unitId === 'king' ? 'king' : 'princess');
    var size = towerSize(type);
    var L = this._lay;
    var v = {
      type: type,
      size: size,
      team: e.team,
      root: new PIXI.Container(),
      shadow: new PIXI.Sprite(CR.Sprites.tex.shadow()),
      ring: new PIXI.Graphics(),
      body: new PIXI.Sprite(PIXI.Texture.EMPTY),
      roof: new PIXI.Sprite(CR.Sprites.tex.roof()),
      trim: new PIXI.Sprite(CR.Sprites.tex.roundRect()),
      icon: new PIXI.Sprite(CR.Sprites.emoji('\u{1F3F9}')),
      flash: new PIXI.Sprite(PIXI.Texture.EMPTY),
      pill: new PIXI.Graphics(),
      pillT: new PIXI.BitmapText({ text: '', style: { fontFamily: NUM_FONT, fontSize: 0.4, align: 'center' } }),
      zz: new PIXI.BitmapText({ text: '', style: { fontFamily: NUM_FONT, fontSize: 0.55, align: 'center' } }),
      rubble: null,
      alive: true,
      seen: -1,
      hpPrev: e.hp,
      flashT: -1e9,
      wakeMs: -1e9,
      wasActive: type !== 'king' || e.active !== false,
      pillKey: null,
      vis: null,
      x: e.x,
      y: e.y
    };
    v.shadow.anchor.set(0.5);
    v.roof.anchor.set(0.5, 0);
    v.trim.anchor.set(0.5);
    v.icon.anchor.set(0.5);
    v.flash.blendMode = 'add';
    v.flash.alpha = 0.8;
    v.root.addChild(v.body, v.trim, v.roof, v.icon, v.flash);
    L.sort.addChild(v.root);
    L.shadow.addChild(v.shadow, v.ring);
    L.label.addChild(v.pill, v.pillT, v.zz);
    return v;
  };

  PixiRenderer.prototype._syncTower = function (e, frame, now, time) {
    var k = towerKey(e);
    var v = this._towers.get(k);
    if (!v) {
      v = this._makeTower(e);
      this._towers.set(k, v);
    }
    v.seen = frame;
    v.e = e;
    var alive = entAlive(e);
    if (!alive) {
      if (v.alive) this._towerDown(v);
      return;
    }
    var vis = CR.Sprites.tower(v.type, e.team);
    var tw = TOWER_W[v.type] || v.size * 1.07;
    if (vis !== v.vis || tw !== v.tw) {
      v.vis = vis;
      v.tw = tw;
      var tex0 = vis.frames.idle[0];
      // Width comes from the footprint; height follows the art so it never stretches.
      var hT = tw * (tex0.height / tex0.width);
      v.hT = hT;
      v.body.texture = tex0;
      v.body.anchor.set(vis.anchor.x, vis.anchor.y);
      v.body.width = tw;
      v.body.height = hT;
      v.flash.texture = tex0;
      v.flash.anchor.set(vis.anchor.x, vis.anchor.y);
      v.flash.width = tw;
      v.flash.height = hT;
    }
    var team = teamN(e.team);
    var half = v.size / 2;
    // The base stands on the bottom edge of the footprint: y 31 for the team 0 king, y 5 for team 1.
    var feetY = e.y + half;
    var active = v.type !== 'king' || e.active !== false;
    if (v.type === 'king' && active && !v.wasActive) v.wakeMs = now;
    v.wasActive = active;
    if (e.hp < v.hpPrev - 1e-9) v.flashT = time;
    v.hpPrev = e.hp;
    var wake = now - v.wakeMs;
    var bounce = wake >= 0 && wake < 450 ? 1 + 0.12 * Math.sin((wake / 450) * Math.PI * 2) * (1 - wake / 450) : 1;

    v.root.visible = true;
    v.root.position.set(e.x, feetY);
    v.root.zIndex = feetY;
    v.root.scale.set(bounce);
    v.body.tint = active ? 0xffffff : 0xc9cfdc;
    v.body.alpha = 1;

    // Ground: team ring under the footprint, shadow under the base.
    v.ring.visible = true;
    v.ring.clear();
    groundRing(v.ring, e.x, feetY - half * 0.3, half * 1.05, half * 0.5, team, 1);
    v.shadow.visible = true;
    v.shadow.position.set(e.x, feetY);
    v.shadow.width = tw * 1.05;
    v.shadow.height = tw * 0.36;

    // Procedural towers have no team art, so their roof and trim stay neutral; team colour is the ring and pill.
    var placeholder = vis.placeholder;
    v.roof.visible = placeholder;
    v.icon.visible = placeholder;
    v.trim.visible = placeholder;
    if (placeholder) {
      v.trim.position.set(0, -0.2);
      v.trim.width = v.size * 0.92;
      v.trim.height = 0.32;
      v.trim.tint = 0x2a2430;
      var rw = v.size - 0.7;
      var rh = v.size - 1.3;
      var ry = -hT0(v) + 0.35;
      v.roof.position.set(0, ry);
      v.roof.width = rw;
      v.roof.height = rh;
      v.roof.tint = 0xe9e4d6;
      v.icon.position.set(0, ry + rh / 2);
      var ch = v.type === 'king' ? '\u{1F451}' : '\u{1F3F9}';
      v.icon.texture = CR.Sprites.emoji(ch);
      var iconS = v.type === 'king' ? 1.25 : 0.95;
      v.icon.width = iconS;
      v.icon.height = iconS;
    }
    v.flash.visible = time - v.flashT < FLASH_S;
    v.flash.scale.copyFrom(v.body.scale);

    // HP pill above the tower top, or below the base when the top would leave the arena (team 1 king).
    var txt = String(Math.max(0, Math.ceil(e.hp || 0)));
    var pw = Math.max(1.1, 0.34 * txt.length + 0.5);
    var topY = feetY - hT0(v);
    var above = topY - 0.45 >= 0;
    var py = above ? topY - 0.45 : feetY + 0.45;
    var key = txt + '|' + pw + '|' + (e.team === 1 ? 1 : 0);
    if (v.pillKey !== key) {
      v.pillKey = key;
      v.pill.clear();
      v.pill.roundRect(-pw / 2, -0.3, pw, 0.6, 0.3).fill({ color: e.team === 1 ? P.enemy : P.mine });
      v.pill.roundRect(-pw / 2, -0.3, pw, 0.6, 0.3).stroke({ width: 0.05, color: 0xffffff });
      v.pillT.text = txt;
    }
    v.pill.visible = true;
    v.pill.position.set(e.x, py);
    v.pillT.visible = true;
    v.pillT.position.set(e.x, py + 0.02);
    v.zz.visible = !active;
    if (!active) {
      var zzp = (now / 600) % 3;
      v.zz.text = zzp < 1 ? 'z' : zzp < 2 ? 'zz' : 'zzz';
      v.zz.position.set(e.x + half * 0.9, e.y - half * 0.9);
    }
    v.alive = true;
  };

  function hT0(v) {
    return v.hT || v.size * 1.2;
  }

  // Tower destroyed: rubble stays, the tower body hides, the pill goes.
  PixiRenderer.prototype._towerDown = function (v) {
    v.alive = false;
    v.root.visible = false;
    v.shadow.visible = false;
    v.ring.visible = false;
    v.pill.visible = false;
    v.pillT.visible = false;
    v.zz.visible = false;
    if (!v.rubble) {
      var e = v.e;
      var rad = v.size * 0.42;
      var g = (v.rubble = new PIXI.Graphics());
      this._lay.rubble.addChild(g);
      g.ellipse(e.x, e.y, rad * 1.1, rad * 0.75).fill({ color: 0x282828, alpha: 0.35 });
      g.circle(e.x, e.y, rad * 0.5).fill({ color: 0x5f5f5f });
      for (var s = 0; s < 6; s++) {
        var a = s * (TAU / 6) + 0.4;
        g.circle(e.x + Math.cos(a) * rad * 0.7, e.y + Math.sin(a) * rad * 0.55, 0.22).fill({ color: s % 2 ? 0x9a9a9a : 0x7d7d7d });
        g.circle(e.x + Math.cos(a) * rad * 0.7, e.y + Math.sin(a) * rad * 0.55, 0.22).stroke({ width: 0.05, color: 0x3f3f3f });
      }
    }
  };

  // ---------- main draw ----------

  PixiRenderer.prototype.draw = function (game, uiState) {
    if (this.failed) return;
    uiState = uiState || {};
    if (!this.ready) {
      this._pending = [game, uiState];
      return;
    }
    if (!this.T) return;
    this._frameDraw(game, uiState, nowMs());
  };

  // ---------- frame ----------

  PixiRenderer.prototype._frameDraw = function (game, uiState, now) {
    var team = uiState.team === 1 ? 1 : 0;
    var sel = typeof uiState.selected === 'number' ? uiState.selected : -1;
    this._selected = sel;
    var L = this._lay;
    var al = this._al;
    var i;

    if (!game) {
      this._hudFrame(null, uiState, team, now, 0);
      this._app.renderer.render({ container: this._app.stage });
      return;
    }
    if (game !== this._game) {
      this._resetState();
      this._game = game;
    }

    var dt = clamp((now - (this._lastMs || now)) / 1000, 0, 0.1);
    this._lastMs = now;
    var frame = ++this._frame;
    var time = game.time || 0;
    var tick = time !== this._tickTime;
    if (tick) {
      this._tickTime = time;
      this._tickNow = now;
    }
    var alpha = clamp((now - this._tickNow) / TICK_MS, 0, 1);

    // Clear per-frame layers.
    this._fxBelowG.clear();
    this._fxAboveG.clear();
    this._dragG.clear();
    this._rippleG.clear();
    for (var key in al) if (al[key] && al[key].begin) al[key].begin();

    // Events and effects: one-shot particles, each object once.
    var evs = game.events || [];
    for (i = 0; i < evs.length; i++) {
      var ev = evs[i];
      if (!ev || this._seenEv.has(ev)) continue;
      this._seenEv.add(ev);
      if (ev.type === 'deploy') this.spawnPuff(ev.x, ev.y, 6, 2.2, 0.45, 'dust', 0xe6dcb4);
    }
    var fx = game.effects || [];
    for (i = 0; i < fx.length; i++) {
      if (fx[i] && !this._seenFx.has(fx[i])) {
        this._seenFx.add(fx[i]);
        this._onEffect(fx[i], now);
      }
    }

    // Units and towers: sync views, interpolate between engine ticks, draw.
    var ents = game.entities || [];
    for (i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (!e) continue;
      if (e.kind === 'tower') {
        this._syncTower(e, frame, now, time);
        continue;
      }
      var k = entKey(e);
      if (e.hidden) {
        var hv = this._uviews.get(k);
        if (hv) {
          hv.seen = frame;
          this._hideUnit(hv);
        }
        continue;
      }
      if (!entAlive(e)) continue;
      var v = this._uviews.get(k);
      if (!v) {
        v = this._getUnit(e, time);
        this._uviews.set(k, v);
      }
      v.seen = frame;
      if (tick) {
        var gdt = time - v.tickT;
        if (gdt > 1e-4) v.spd = Math.hypot(e.x - v.tx, e.y - v.ty) / gdt;
        v.tickT = time;
        v.fx = v.tx;
        v.fy = v.ty;
        v.tx = e.x;
        v.ty = e.y;
      } else {
        v.spd *= Math.pow(0.5, dt * 6);
      }
      v.root.visible = true;
      v.shadow.visible = true;
      v.ring.visible = true;
      this._drawUnit(v, e, alpha, time, now, dt);
    }
    // Units that vanished this frame died: play the death, then recycle.
    var gone = [];
    this._uviews.forEach(function (uv, uk) {
      if (uv.seen !== frame) gone.push(uk);
    });
    for (i = 0; i < gone.length; i++) {
      var dv = this._uviews.get(gone[i]);
      this._uviews.delete(gone[i]);
      this._startDying(dv, now);
    }
    this._updateDying(dt);
    var self = this;
    this._towers.forEach(function (tv) {
      if (tv.seen !== frame && tv.alive) self._towerDown(tv);
    });

    this._drawRipples(time);
    this._drawDeployZone(game, team, uiState);
    this._drawProjectiles(game);
    this._drawSpells(game, time);
    this._drawBeams(game);
    this._drawEffects(game, time, now);
    this._updateParts(dt, now);
    this._drawLabels(game, uiState, time, now);
    this._drawDragGhost(game, team, uiState);

    // Screen shake: a short jolt when a tower falls.
    var shk = now - this._shakeMs;
    var sx = 0;
    var sy = 0;
    if (shk < 300) {
      var amp = this._shakeAmp * (1 - shk / 300);
      sx = Math.sin(shk * 0.09) * amp;
      sy = Math.cos(shk * 0.13) * amp;
    }
    this._world.position.set(this.ox + sx * this.T, this.oy + sy * this.T);

    for (var lk in al) if (al[lk] && al[lk].end) al[lk].end();
    // HUD motion (card flights, fades, crowns, elixir) runs on game time, so it settles when the sim is paused or stepped.
    var gdt = clamp(time - (this._hudT == null ? time : this._hudT), 0, 1);
    this._hudT = time;
    this._gt = time;
    this._hudFrame(game, uiState, team, now, gdt);
    this._app.renderer.render({ container: this._app.stage });
    // Not referenced again this frame; keeps the lint quiet about the unused layer map.
    void L;
  };

  // Deploy zone: red stripes over cells this card cannot use, rebuilt at most every 150 ms.
  PixiRenderer.prototype._deployGrid = function (game, team, cardId) {
    var fn = game.isInDeployZone;
    if (typeof fn !== 'function') return null;
    var key = team + '|' + cardId;
    var now = nowMs();
    if (this._dzGame === game && this._dzKey === key && now - this._dzAt < DEPLOY_CACHE_MS) return this._dz;
    var dz = this._dz;
    for (var j = 0; j < H; j++) {
      for (var i = 0; i < W; i++) dz[j * W + i] = fn.call(game, team, cardId, i + 0.5, j + 0.5) ? 1 : 0;
    }
    this._dzGame = game;
    this._dzKey = key;
    this._dzAt = now;
    return dz;
  };

  PixiRenderer.prototype._drawDeployZone = function (game, team, uiState) {
    var sel = typeof uiState.selected === 'number' ? uiState.selected : -1;
    var pl = game.players ? game.players[team] : null;
    var cardId = pl && pl.hand && sel >= 0 ? pl.hand[sel] : null;
    var cd = cardDef(cardId);
    if (!cd || cd.type === 'spell' || !uiState.drag) return;
    var dz = this._deployGrid(game, team, cardId);
    if (!dz) return;
    var al = this._al.dz;
    for (var j = 0; j < H; j++) {
      var i = 0;
      while (i < W) {
        if (dz[j * W + i]) {
          i++;
          continue;
        }
        var i0 = i;
        while (i < W && !dz[j * W + i]) i++;
        var ts = al.next();
        ts.position.set(i0, j);
        ts.width = i - i0;
        ts.height = 1;
      }
    }
  };

  // River ripples and foam, drifting toward the bridges (same motion as js/render.js).
  PixiRenderer.prototype._drawRipples = function (time) {
    var cfg = this._cfg;
    var rt = cfg.RIVER_TOP;
    var rb = cfg.RIVER_BOTTOM;
    var g = this._rippleG;
    for (var i = 0; i < 12; i++) {
      var sp = 0.5 + (i % 4) * 0.18;
      var x = ((i * 2.37 + time * sp) % (W + 2)) - 1;
      var y = rt + 0.3 + ((i * 0.618) % 1) * (rb - rt - 0.6);
      if (overBridge(cfg, x)) continue;
      var len = 0.7 + (i % 3) * 0.25;
      g.moveTo(x, y).quadraticCurveTo(x + len / 2, y - 0.14, x + len, y);
    }
    g.stroke({ width: 0.06, color: 0xd6f2ff, alpha: 0.6, cap: 'round' });
    for (var b = 0; b < cfg.BRIDGES.length; b++) {
      var br = cfg.BRIDGES[b];
      for (var side = -1; side <= 1; side += 2) {
        var fx = br.x + side * (br.halfWidth + 0.22);
        for (var k = 0; k < 3; k++) {
          var ph = (time * 0.8 + k / 3) % 1;
          var fy = rt + 0.3 + ph * (rb - rt - 0.6);
          g.circle(fx + side * ph * 0.15, fy, 0.1 + 0.05 * (1 - ph)).fill({ color: 0xffffff, alpha: Math.sin(ph * Math.PI) * 0.8 });
        }
      }
    }
  };

  // Engine snapshot -> tower and unit states that drive visuals. Dead-tower rubble is in _towerDown.
  PixiRenderer.prototype._onEffect = function (f, now) {
    if (f.type === 'hit') {
      this.spawnPuff(f.x, f.y, 4, 4, 0.22, 'spark', 0xfff3b0);
    } else if (f.type === 'towerDown') {
      this._shakeMs = now;
      this._shakeAmp = 0.22;
      this.spawnPuff(f.x, f.y, 14, 5, 0.8, 'debris', 0xc9c2b0);
      this.spawnPuff(f.x, f.y, 6, 1.2, 1.1, 'smoke', 0x505050);
    }
  };

  // Particles: pooled sprites, aged by real dt. Kinds: smoke, spark, debris, dust, confetti.
  PixiRenderer.prototype.spawnPuff = function (x, y, n, speed, life, kind, color) {
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
        size: kind === 'debris' ? 0.12 + Math.random() * 0.12 : kind === 'smoke' ? 0.25 : 0.1,
        rot: Math.random() * TAU,
        spin: 0
      });
    }
  };

  PixiRenderer.prototype._updateParts = function (dt, now) {
    var parts = this._parts;
    var j = 0;
    var i;
    for (i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'debris') p.vy += 9 * dt;
      else if (p.kind === 'confetti') p.vy += (2.2 - p.vy) * dt * 0.9;  // drifts down at about 2 tiles/s
      else p.vy *= 1 - dt * 3;
      p.vx *= 1 - dt * 2.5;
      parts[j++] = p;
    }
    parts.length = j;
    var al = this._al.part;
    var tg = CR.Sprites.tex;
    for (i = 0; i < parts.length; i++) {
      var q = parts[i];
      var a = clamp(q.life / q.max, 0, 1);
      var s;
      if (q.kind === 'smoke') {
        s = al.sprite(tg.glow());
        s.position.set(q.x, q.y);
        s.width = s.height = q.size * 4 * (1.6 - a * 0.6);
        s.alpha = a * 0.7;
      } else if (q.kind === 'spark') {
        s = al.sprite(tg.spark());
        s.position.set(q.x, q.y);
        s.width = s.height = 0.18;
        s.alpha = a;
        s.blendMode = 'add';
      } else if (q.kind === 'debris') {
        s = al.sprite(tg.chunk());
        s.position.set(q.x, q.y);
        s.width = s.height = q.size * 2;
        s.rotation = q.rot;
        s.alpha = a;
      } else if (q.kind === 'dust') {
        s = al.sprite(tg.glow());
        s.position.set(q.x, q.y);
        s.width = s.height = 0.36 + (1 - a) * 0.4;
        s.alpha = a * 0.6;
      } else {
        s = al.sprite(tg.chunk());
        s.position.set(q.x, q.y);
        s.width = q.size;
        s.height = q.size * 0.5;
        s.rotation = q.rot + q.spin * (q.max - q.life);
        s.alpha = clamp(q.life / 0.6, 0, 1);
      }
      s.tint = q.color;
    }
    void now;
  };

  // Confetti at the end of the battle.
  PixiRenderer.prototype._startConfetti = function (now) {
    this._endMs = now;
    for (var i = 0; i < 90; i++) {
      this._parts.push({
        kind: 'confetti',
        x: Math.random() * W,
        y: -1 - Math.random() * 6,
        vx: (Math.random() - 0.5) * 2,
        vy: 1 + Math.random() * 2,
        life: 2.5,
        max: 2.5,
        color: CONFETTI[i % CONFETTI.length],
        size: 0.24 + Math.random() * 0.14,
        rot: Math.random() * TAU,
        spin: Math.random() * 8 - 4
      });
    }
  };

  // Projectiles: one sprite each, rotated along the flight for arrows, spears and bullets. Each keeps a short
  // trail of soft puffs behind it, drawn under the units.
  var TRAIL_N = 6;
  var TRAIL_TINT = { arrow: 0xe8ecf5, spear: 0xe8ecf5, bullet: 0xfff3b0, cannonball: 0xaab0bb, bomb: 0xbbbbbb, fire: 0xff9a3a, magic: 0xff8ad8, ice: 0xbff3ff, goo: 0xc49bff };
  PixiRenderer.prototype._drawProjectiles = function (game) {
    var list = game.projectiles || [];
    var al = this._al.sort;
    var ab = this._al.fxBelow;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p) continue;
      var vis = CR.Sprites.projectile(p.kind);
      var s = al.sprite(vis.frames.idle[0]);
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
      s.position.set(p.x, p.y);
      s.width = s.height = vis.h;
      // Projectile art points right, so every kind faces its direction of travel.
      s.rotation = ang;
      s.zIndex = p.y + 0.5 + (p.air ? 64 : 0);

      var tr = this._trail.get(p);
      if (!tr) {
        tr = [];
        this._trail.set(p, tr);
      }
      if (!tr.length || tr[0][0] !== p.x || tr[0][1] !== p.y) tr.unshift([p.x, p.y]);
      if (tr.length > TRAIL_N) tr.length = TRAIL_N;
      var tint = TRAIL_TINT[p.kind] != null ? TRAIL_TINT[p.kind] : 0xffffff;
      for (var j = 1; j < tr.length; j++) {
        var f = 1 - j / TRAIL_N;
        var puff = ab.sprite(CR.Sprites.tex.trail());
        puff.position.set(tr[j][0], tr[j][1]);
        puff.width = puff.height = vis.h * (0.4 + 0.9 * f);
        puff.alpha = 0.55 * f;
        puff.tint = tint;
      }
    }
  };

  // Spells: poison and log lie on the ground; a flying card shows its emoji above the ground.
  PixiRenderer.prototype._drawSpells = function (game, time) {
    var list = game.spells || [];
    var g = this._fxBelowG;
    var tg = CR.Sprites.tex;
    var ab = this._al.fxBelow;
    var as = this._al.sort;
    for (var i = 0; i < list.length; i++) {
      var sp = list[i];
      if (!sp) continue;
      var card = cardDef(sp.cardId) || {};
      if (sp.kind === 'poison') {
        var rad = sp.radius || card.radius || 3.5;
        var pulse = 0.5 + 0.5 * Math.sin(time * 4 + sp.x + sp.y);
        var gs = ab.sprite(tg.glow());
        gs.position.set(sp.x, sp.y);
        gs.width = gs.height = rad * 2;
        gs.tint = 0x78dc46;
        gs.alpha = 0.22 + 0.06 * pulse;
        g.circle(sp.x, sp.y, rad).stroke({ width: 0.1, color: 0x5ab428, alpha: 0.8 });
        for (var k = 0; k < 4; k++) {
          var a = time * 0.5 + k * 1.57;
          var dot = ab.sprite(tg.glow());
          dot.position.set(sp.x + Math.cos(a) * rad * 0.6, sp.y + Math.sin(a) * rad * 0.6);
          dot.width = dot.height = 0.24;
          dot.tint = 0xc8ff96;
          dot.alpha = 0.6;
        }
      } else if (sp.kind === 'log') {
        var lg = card.log || {};
        var w = lg.width || 3.9;
        var th = 0.9;
        var log = ab.sprite(tg.roundRect());
        log.position.set(sp.x, sp.y);
        log.width = w;
        log.height = th;
        log.tint = 0x8b5a2b;
        var phase = (time * (lg.speed || 4.6)) % 1.0;
        var x0 = sp.x - w / 2;
        var y0 = sp.y - th / 2;
        for (var m = 0; m < 4; m++) {
          var mx = x0 + ((m + phase) * w) / 4;
          g.moveTo(mx, y0 + 0.12).lineTo(mx, y0 + th - 0.12);
        }
        g.stroke({ width: 0.06, color: 0xc08a52 });
      } else {
        var shadow = ab.sprite(tg.shadow());
        shadow.position.set(sp.x, sp.y);
        shadow.width = 0.84;
        shadow.height = 0.4;
        shadow.tint = 0x000000;
        shadow.alpha = 0.25;
        var em = as.sprite(CR.Sprites.emoji(card.emoji || '?'));
        em.position.set(sp.x, sp.y - 0.7);
        em.width = em.height = 1.0;
        em.zIndex = 200;
      }
    }
  };

  // Ramp beams from an Inferno-style building to its target.
  PixiRenderer.prototype._drawBeams = function (game) {
    var g = this._fxAboveG;
    var list = game.entities || [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e || e.kind !== 'building' || typeof e.beamTarget !== 'object' || !e.beamTarget) continue;
      var t = e.beamTarget;
      var lift = t.air ? 0.6 : 0;
      var stage = e.rampStage | 0;
      var w = 0.12 + 0.08 * stage;
      var outer = stage >= 2 ? 0xff3b1f : stage === 1 ? 0xff6a2a : 0xff8a3a;
      g.moveTo(e.x, e.y).lineTo(t.x, t.y - lift).stroke({ width: w + 0.1, color: outer, alpha: 0.45, cap: 'round' });
      g.moveTo(e.x, e.y).lineTo(t.x, t.y - lift).stroke({ width: w * 0.45, color: 0xffe27a, alpha: 0.9, cap: 'round' });
    }
  };

  // Zig-zag points between two points, jittered by flick so the arc crackles.
  function boltPts(x0, y0, x1, y1, flick, seed, segs, amp) {
    var dx = x1 - x0;
    var dy = y1 - y0;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len;
    var ny = dx / len;
    var pts = [[x0, y0]];
    for (var k = 1; k < segs; k++) {
      var t = k / segs;
      var j = Math.sin(flick * 12.9 + seed * 3.1 + k * 2.7) * amp * (k % 2 ? 1 : -1);
      pts.push([x0 + dx * t + nx * j, y0 + dy * t + ny * j]);
    }
    pts.push([x1, y1]);
    return pts;
  }

  function polyline(g, pts, width, color, alpha) {
    if (pts.length < 2) return;
    g.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.stroke({ width: width, color: color, alpha: alpha, cap: 'round', join: 'round' });
  }

  // Effects. A visual from the manifest (CR.Sprites.effect) wins; otherwise the procedural drawing below.
  PixiRenderer.prototype._drawEffects = function (game, time, now) {
    var list = game.effects || [];
    var gb = this._fxBelowG;
    var ga = this._fxAboveG;
    var al = this._al;
    var tg = CR.Sprites.tex;
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
      var top = !!TOP_FX[f.type];
      var g = top ? ga : gb;
      var sprAl = top ? al.fxAbove : al.fxBelow;
      var layers = CR.Sprites.effect(f.type);
      if (layers) {
        for (var li = 0; li < layers.length; li++) {
          var L = layers[li];
          var frames = L.frames.idle;
          var fi = Math.min(frames.length - 1, Math.floor(t * (L.fps || 1)));
          var tex = frames[Math.max(0, fi)];
          if (!tex) continue;
          var s = sprAl.sprite(tex);
          var d = 2 * R * (L.scale || 1);
          s.position.set(x, y);
          s.width = d;
          s.height = d * (tex.height / tex.width);
          s.alpha = L.alpha * (p < 0.7 ? 1 : Math.max(0, (1 - p) / 0.3));
          s.blendMode = L.blend;
          s.tint = L.tint != null ? L.tint : 0xffffff;
          if (L.spin) s.rotation = t * L.spin * (Math.PI / 180);
        }
        continue;
      }
      var k;
      switch (f.type) {
        case 'hit':
          g.circle(x, y, 0.2 + R * p).stroke({ width: 0.1 * a + 0.03, color: 0xfff3b0, alpha: a });
          break;
        case 'splash':
          g.circle(x, y, R * (0.3 + 0.7 * p)).fill({ color: 0xffa03c, alpha: 0.25 * a });
          g.circle(x, y, R * (0.3 + 0.7 * p)).stroke({ width: 0.12, color: 0xff9a3c, alpha: a });
          break;
        case 'death':
          g.circle(x, y, 0.25 + R * 0.6 * p).fill({ color: 0xe6e6e6, alpha: 0.6 * a });
          break;
        case 'zap': {
          var flick = Math.floor(t * 30);
          var seed = f.seed != null ? f.seed : i;
          for (var b = 0; b < 3; b++) {
            var ang = b * (TAU / 3) + seed * 0.7 + flick * 0.9;
            var pts = [];
            for (k = 0; k <= 4; k++) {
              var dist = R * (k / 4) * 0.95;
              var jit = Math.sin(flick * 12.9 + b * 4.1 + k * 2.7) * 0.22 * (k % 2 ? 1 : -1);
              pts.push([x + Math.cos(ang) * dist - Math.sin(ang) * jit, y + Math.sin(ang) * dist + Math.cos(ang) * jit]);
            }
            polyline(ga, pts, 0.14, 0x7fdcff, a);
            polyline(ga, pts, 0.05, 0xffffff, a);
          }
          break;
        }
        case 'lightning': {
          var lf = Math.floor(t * 30);
          var show = clamp(1 - p / 0.6, 0, 1);
          polyline(ga, boltPts(x + 0.3, y - 6, x, y, lf, i, 7, 0.35), 0.32, 0xffe65a, 0.5 * show);
          polyline(ga, boltPts(x + 0.3, y - 6, x, y, lf, i, 7, 0.35), 0.1, 0xffffff, show);
          ga.circle(x, y, R * (0.5 + 0.5 * p)).fill({ color: 0xfff08c, alpha: 0.35 * a * 0.6 });
          break;
        }
        case 'tornado': {
          var spin = t * 7;
          gb.circle(x, y, R).fill({ color: 0xc8dcff, alpha: 0.16 });
          for (k = 0; k < 4; k++) {
            var ta = spin + k * (TAU / 4);
            var rx = R * (0.35 + 0.25 * k / 3);
            var ry = R * (0.6 * (0.35 + 0.25 * k / 3));
            var arc = [];
            for (var q = 0; q <= 8; q++) {
              var aa = ta + (q / 8) * 2.1;
              arc.push([x + Math.cos(aa) * rx, y + Math.sin(aa) * ry]);
            }
            polyline(gb, arc, 0.16, 0xebf5ff, 0.8);
          }
          break;
        }
        case 'rage': {
          var rp = 0.5 + 0.5 * Math.sin(t * 9);
          gb.circle(x, y, R).fill({ color: 0xaa3cff, alpha: 0.2 + 0.08 * rp });
          gb.circle(x, y, R).stroke({ width: 0.1, color: 0xd28cff, alpha: 0.9 });
          break;
        }
        case 'dash': {
          var pts2 = [];
          for (k = 0; k < 6; k++) {
            var da = (k * TAU) / 6;
            var d0 = R * (0.4 + 0.6 * p);
            gb.moveTo(x + Math.cos(da) * d0, y + Math.sin(da) * d0 * 0.6).lineTo(x + Math.cos(da) * (d0 + 0.5), y + Math.sin(da) * (d0 + 0.5) * 0.6);
          }
          gb.stroke({ width: 0.08, color: 0xf5ebc8, alpha: 0.9 });
          void pts2;
          break;
        }
        case 'chain': {
          var cf = Math.floor(t * 30);
          var x0 = f.x0 != null ? f.x0 : x;
          var y0 = f.y0 != null ? f.y0 : y;
          polyline(ga, boltPts(x0, y0, x, y, cf, i, 5, 0.25), 0.14, 0x7fdcff, 1);
          polyline(ga, boltPts(x0, y0, x, y, cf, i, 5, 0.25), 0.05, 0xffffff, 1);
          break;
        }
        case 'arrows':
          for (k = 0; k < 8; k++) {
            var aa2 = k * 2.4 + 0.3;
            var dd = R * (0.3 + 0.6 * (((k * 37) % 10) / 10));
            var sx = x + Math.cos(aa2) * dd;
            var sy = y + Math.sin(aa2) * dd * 0.7;
            var fall = (1 - p) * 2.5;
            gb.moveTo(sx, sy - fall - 0.6).lineTo(sx, sy - fall);
          }
          gb.stroke({ width: 0.07, color: 0x5a3a1a, alpha: a });
          break;
        case 'fireball':
        case 'rocket': {
          var fb = sprAl.sprite(tg.glow());
          fb.position.set(x, y);
          fb.width = fb.height = R * (0.8 + 1.2 * p) * 2;
          fb.tint = 0xff821e;
          fb.alpha = 0.7 * a;
          fb.blendMode = 'add';
          var core = sprAl.sprite(tg.glow());
          core.position.set(x, y);
          core.width = core.height = (R * 0.5 * (1 - p) + 0.1) * 2;
          core.tint = 0xffe066;
          core.alpha = a;
          break;
        }
        case 'freeze':
          gb.circle(x, y, R).fill({ color: 0xaae6ff, alpha: 0.45 * a });
          gb.circle(x, y, R).stroke({ width: 0.1, color: 0xe8fbff, alpha: a });
          for (k = 0; k < 6; k++) {
            var fa = k * (TAU / 6);
            gb.moveTo(x, y).lineTo(x + Math.cos(fa) * R * 0.8, y + Math.sin(fa) * R * 0.8);
          }
          gb.stroke({ width: 0.05, color: 0xe8fbff, alpha: a });
          break;
        case 'poison':
          gb.circle(x, y, R).fill({ color: 0x78dc46, alpha: 0.3 * a });
          break;
        case 'deploy': {
          var dt0 = t - FALL_T;
          if (dt0 > 0) {
            var dp = clamp(dt0 / 0.4, 0, 1);
            gb.circle(x, y, 0.4 + 0.9 * dp).stroke({ width: 0.14 * (1 - dp) + 0.03, color: 0xebdeb4, alpha: 0.9 * (1 - dp) });
          }
          break;
        }
        case 'towerDown':
          gb.circle(x, y, R * (0.35 + 0.65 * p)).fill({ color: 0xff9d3c, alpha: 0.7 * a });
          gb.circle(x, y - 0.3, R * (0.5 + 0.4 * p)).fill({ color: 0x5a5a5a, alpha: 0.5 * a });
          break;
        case 'spawn':
          for (k = 0; k < 3; k++) {
            var sa = k * (TAU / 3);
            var sd = 0.1 + 0.35 * p;
            ga.circle(x + Math.cos(sa) * sd, y + Math.sin(sa) * sd, 0.25 * (1 - p) + 0.12).fill({ color: 0xffffff, alpha: a * 0.7 });
          }
          break;
        case 'elixir': {
          var pop = 1 + 0.35 * Math.max(0, 1 - t / 0.15);
          var et = al.label.label(String(f.text || '-'), 0.9 * pop, 0xd98bff);
          et.position.set(x, y - 1.6 * p - 0.6);
          et.alpha = a;
          break;
        }
        default:
          if (f.radius > 0) gb.circle(x, y, R * (0.4 + 0.6 * p)).stroke({ width: 0.08, color: teamN(f.team).light, alpha: a });
          break;
      }
    }
    void now;
  };

  // Drag ghost: the card's units or spell footprint at the snapped tile, red when the drop is not allowed.
  PixiRenderer.prototype._drawDragGhost = function (game, team, uiState) {
    var d = uiState.drag;
    var sel = typeof uiState.selected === 'number' ? uiState.selected : -1;
    var pl = game.players ? game.players[team] : null;
    var cardId = pl && pl.hand && sel >= 0 ? pl.hand[sel] : null;
    var card = cardDef(cardId);
    if (!d || !card || !this.isInArena(d.x, d.y)) return;
    var t = this.screenToTile(d.x, d.y);
    var sx = Math.round(t.x * 2) / 2;
    var sy = Math.round(t.y * 2) / 2;
    var ok = true;
    if (typeof game.canDeploy === 'function') ok = !!game.canDeploy(team, sel, sx, sy);
    var tc = teamN(team);
    var g = this._dragG;
    var al = this._al.drag;
    if (card.type === 'spell') {
      if (card.log) {
        var w = card.log.width || 3.9;
        var L = card.log.length || 11;
        var ry = team === 1 ? sy : sy - L;
        g.rect(sx - w / 2, ry, w, L).fill({ color: ok ? 0xffffff : P.invalid, alpha: ok ? 0.25 : 0.34 });
        g.rect(sx - w / 2, ry, w, L).stroke({ width: 0.08, color: ok ? 0xffffff : P.invalidSolid, alpha: 0.5 });
      } else {
        var rad = card.radius || 1.5;
        g.circle(sx, sy, rad).fill({ color: ok ? 0xffffff : P.invalid, alpha: ok ? 0.22 : 0.34 });
        g.circle(sx, sy, rad).stroke({ width: 0.08, color: ok ? 0xffffff : P.invalidSolid, alpha: 0.5 });
      }
      return;
    }
    var def = unitDef(card.unit) || {};
    var r = def.r || 0.5;
    var building = card.type === 'building';
    var offs = formation(card.count || 1);
    if (def.range && (def.projectile || building)) {
      g.circle(sx, sy, def.range).fill({ color: 0xffffff, alpha: 0.06 });
      g.circle(sx, sy, def.range).stroke({ width: 0.05, color: 0xffffff, alpha: 0.45 });
    }
    var rd = def.kind === 'troop' ? r * 1.2 + 0.1 : r;
    var vis = this._visualFor(card.unit, team, rd);
    var hT = vis.troop ? vis.h : vis.h * (rd / 0.5);
    var tint = ok ? 0xffffff : P.invalidSolid;
    for (var i = 0; i < offs.length; i++) {
      var px = sx + offs[i][0];
      var py = sy + offs[i][1];
      g.ellipse(px, py, r * 1.05, r * 0.55).stroke({ width: 0.08, color: ok ? tc.main : P.invalidSolid, alpha: 0.7 });
      var s = al.sprite(vis.frames.idle[0]);
      s.anchor.set(vis.anchor.x, vis.anchor.y);
      s.position.set(px, py);
      s.height = hT;
      s.width = hT * (vis.frames.idle[0].width / vis.frames.idle[0].height);
      s.tint = tint;
      s.alpha = 0.6;
    }
  };

  // Emote bubbles over the King Towers and the end-of-battle banner.
  PixiRenderer.prototype._drawLabels = function (game, uiState, time, now) {
    var g = this._dragG;
    var list = uiState.emote;
    var al = this._al;
    if (list) {
      var ents = game.entities || [];
      for (var t = 0; t < 2; t++) {
        var b = list[t];
        if (!b || time >= b.until) continue;
        var king = null;
        for (var i = 0; i < ents.length; i++) {
          var e = ents[i];
          if (e && e.kind === 'tower' && e.team === t && e.towerType === 'king') king = e;
        }
        if (!king) continue;
        var up = king.y > 16;
        var by = up ? king.y - 3.1 : king.y + 3.1;
        var fade = clamp((b.until - time) / 0.4, 0, 1);
        var pop = clamp((time - (b.until - 2)) / 0.15, 0, 1);
        var bub = al.labelSpr.sprite(CR.Sprites.emoji(b.emoji));
        bub.position.set(king.x, by);
        bub.width = bub.height = 1.2;
        bub.alpha = fade * pop;
        g.roundRect(king.x - 1.1, by - 0.9, 2.2, 1.8, 0.7).fill({ color: 0xffffff, alpha: fade * pop });
        g.roundRect(king.x - 1.1, by - 0.9, 2.2, 1.8, 0.7).stroke({ width: 0.08, color: 0x2b3a5e, alpha: fade * pop });
      }
    }
    var r = game.result;
    if (r && this._endMs < 0) this._startConfetti(now);
    if (r && this._endMs >= 0) {
      var age = (now - this._endMs) / 1000;
      if (age <= 2.5) {
        if (r.winner === 0 || r.winner === 1) {
          var ents2 = game.entities || [];
          var king2 = null;
          for (var j = 0; j < ents2.length; j++) {
            var e2 = ents2[j];
            if (e2 && e2.kind === 'tower' && e2.towerType === 'king' && e2.team === r.winner) king2 = e2;
          }
          var x = king2 ? king2.x : W / 2;
          // Clear of the king's HP pill: above it for team 0, below it for team 1.
          var tv = king2 ? this._towers.get(towerKey(king2)) : null;
          var y = tv && tv.pill ? tv.pill.position.y + (r.winner === 0 ? -0.95 : 1.15) : H / 2;
          var et = al.label.label('Winner!', 1.4 * ease(age / 0.3), P.gold);
          et.position.set(x, y);
          et.alpha = clamp(age / 0.2, 0, 1);
        } else {
          var dt2 = al.label.label('Draw', 1.4, P.text);
          dt2.position.set(W / 2, H / 2);
          dt2.alpha = clamp(age / 0.2, 0, 1);
        }
      }
    }
  };

  // ---------- HUD (screen px, same layout as js/render.js) ----------

  PixiRenderer.prototype._text = function (size, color) {
    var t = new PIXI.Text({
      text: '',
      style: { fontFamily: FONT, fontSize: size, fill: color, align: 'center' },
      resolution: this.dpr
    });
    t.anchor.set(0.5);
    this._texts.push(t);
    return t;
  };

  PixiRenderer.prototype._buildHud = function (hud) {
    var hb = (this._hb = {});
    hb.top = new PIXI.Graphics();
    hb.opp = this._text(14, '#f3f6fb');
    hb.opp.text = 'Opponent';
    hb.opp.anchor.set(0, 0.5);
    hb.timeG = new PIXI.Graphics();
    hb.timeLbl = this._text(8.5, '#94a1ba');
    hb.timeLbl.text = 'Time left';
    hb.timeT = this._text(16, '#f3f6fb');
    hb.crown = new PIXI.Graphics();
    hb.panel = new PIXI.Graphics();
    hb.elixir = new PIXI.Graphics();
    hb.dropT = this._text(13, '#ffffff');
    hb.multT = this._text(12, '#ffffff');
    hb.nextLbl = this._text(9, '#94a1ba');
    hb.nextLbl.text = 'Next';
    hb.fly = new PIXI.Graphics();
    hud.addChild(hb.top, hb.opp, hb.timeG, hb.timeLbl, hb.timeT, hb.crown, hb.panel, hb.elixir, hb.dropT, hb.multT, hb.nextLbl);

    this._cards = [];
    for (var i = 0; i < 4; i++) this._cards.push(new CardView(this, hud));
    this._nextCard = new CardView(this, hud);
    this._animCard = new CardView(this, hud);
    this._dragCard = new CardView(this, hud);
    hud.addChild(hb.fly);
  };

  PixiRenderer.prototype._layoutHud = function () {
    /* sizes are read per frame; nothing cached */
  };

  // Bookkeeping for HUD motion: hand slots, next-card fade, crowns flying, elixir easing.
  PixiRenderer.prototype._hudState = function (game, team, now, dt) {
    var pl = game.players ? game.players[team] : null;
    var i;
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
        this._nextFadeMs = this._gt;
        this._prevNext = pl.next;
      }
      for (var t = 0; t < 2; t++) {
        var cr = (game.players[t] && game.players[t].crowns) | 0;
        if (cr > this._crownShown[t]) {
          var src = this._fallSource(game, 1 - t);
          for (var c = this._crownShown[t]; c < cr; c++) {
            this._fly.push({ team: t, t: -0.12 * (c - this._crownShown[t]), src: src });
          }
          this._crownPopMs[t] = this._gt;
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
    var p0 = game.players ? game.players[0] : null;
    var real = p0 ? p0.elixir || 0 : 0;
    if (this._elixirShown == null) this._elixirShown = real;
    this._elixirShown += (real - this._elixirShown) * Math.min(1, dt * 8);
    if (Math.abs(real - this._elixirShown) < 0.001) this._elixirShown = real;
    if (this._elixirShown > real) this._elixirShown = real;
  };

  // Last tower-down effect for an owner: where a crown flies from.
  PixiRenderer.prototype._fallSource = function (game, owner) {
    var fx = game.effects || [];
    var best = null;
    for (var i = 0; i < fx.length; i++) {
      var f = fx[i];
      if (f && f.type === 'towerDown' && f.team === owner && (!best || f.t < best.t)) best = f;
    }
    return best ? { x: best.x, y: best.y } : { x: W / 2, y: H / 2 };
  };

  // Crown polygon, with an optional pop scale about its centre.
  function crownPts(x, y, w, h) {
    return [x, y + h, x, y + h * 0.3, x + w * 0.25, y + h * 0.6, x + w * 0.5, y, x + w * 0.75, y + h * 0.6, x + w, y + h * 0.3, x + w, y + h];
  }

  PixiRenderer.prototype._drawCrowns = function (game, team, now) {
    var g = this._hb.crown;
    g.clear();
    var xr = this.ox + W * this.T;
    var cx = xr - 15;
    var pillW = 24;
    var pillH = 36;
    var yRed = this.oy + 12.5 * this.T;
    var yBlue = this.oy + 19.5 * this.T;
    var pl = game && game.players ? game.players : null;
    var cs = [pl && pl[1] ? pl[1].crowns | 0 : 0, pl && pl[0] ? pl[0].crowns | 0 : 0];
    var ys = [yRed, yBlue];
    var tm = [1, 0];
    for (var i = 0; i < 2; i++) {
      var tn = teamN(tm[i]);
      var pop = clamp(1 - (this._gt - this._crownPopMs[tm[i]]) / 0.4, 0, 1);
      var count = cs[i];
      g.roundRect(cx - pillW / 2, ys[i] - pillH / 2, pillW, pillH, 8).fill({ color: P.pillBg, alpha: 0.78 });
      g.roundRect(cx - pillW / 2, ys[i] - pillH / 2, pillW, pillH, 8).stroke({ width: 1, color: tn.dark });
      var cw = 9;
      var ch = 8;
      for (var c = 0; c < 3; c++) {
        var on = c < count;
        var s = on && c === count - 1 ? 1 + 0.5 * pop : 1;
        var x = cx - cw / 2;
        var y = ys[i] - 8 + c * 9.5;
        var mx = x + cw / 2;
        var my = y + ch / 2;
        var pts = crownPts(-cw / 2, -ch / 2, cw, ch);
        for (var k = 0; k < pts.length; k += 2) {
          pts[k] = mx + pts[k] * s;
          pts[k + 1] = my + pts[k + 1] * s;
        }
        g.poly(pts, true).fill({ color: on ? tn.main : P.crownOff });
        if (on) g.poly(pts, true).stroke({ width: 1, color: tn.dark });
      }
    }
  };

  PixiRenderer.prototype._drawFlyingCrowns = function (team) {
    var g = this._hb.fly;
    g.clear();
    var xr = this.ox + W * this.T;
    for (var i = 0; i < this._fly.length; i++) {
      var f = this._fly[i];
      if (f.t < 0) continue;
      var p = ease(f.t / 0.6);
      var from = this.tileToScreen(f.src.x, f.src.y);
      var yTo = f.team === 1 ? this.oy + 12.5 * this.T : this.oy + 19.5 * this.T;
      var tx = xr - 15;
      var x = from.x + (tx - from.x) * p;
      var y = from.y + (yTo - from.y) * p - Math.sin(p * Math.PI) * 40;
      var sc = 1 + 0.3 * Math.sin(p * Math.PI);
      var s = 14;
      var pts = crownPts(-s / 2, -s * 0.4, s, s * 0.8);
      for (var k = 0; k < pts.length; k += 2) {
        pts[k] = x + pts[k] * sc;
        pts[k + 1] = y + pts[k + 1] * sc;
      }
      g.poly(pts, true).fill({ color: teamN(f.team).main });
      g.poly(pts, true).stroke({ width: 1, color: 0xffffff });
    }
    void team;
  };

  PixiRenderer.prototype._drawElixir = function (game, now) {
    var g = this._hb.elixir;
    g.clear();
    var b = this.barRect;
    var pl = game && game.players ? game.players[0] : null;
    var real = pl ? pl.elixir || 0 : 0;
    var e = clamp(this._elixirShown != null ? this._elixirShown : real, 0, 10);
    var mult = game && game.elixirMult ? game.elixirMult | 0 : 1;
    var time = game ? game.time || 0 : 0;
    var full = real >= 10;

    // Drop with the count.
    var dr = 9.5;
    var dcx = b.x + dr + 2;
    var dcy = b.y + b.h / 2;
    g.moveTo(dcx, dcy - dr * 1.3)
      .bezierCurveTo(dcx + dr * 0.35, dcy - dr * 0.6, dcx + dr, dcy - dr * 0.2, dcx + dr, dcy + dr * 0.2)
      .arc(dcx, dcy + dr * 0.2, dr, 0, Math.PI, false)
      .bezierCurveTo(dcx - dr, dcy - dr * 0.2, dcx - dr * 0.35, dcy - dr * 0.6, dcx, dcy - dr * 1.3)
      .fill({ color: P.drop });
    g.moveTo(dcx, dcy - dr * 1.3)
      .bezierCurveTo(dcx + dr * 0.35, dcy - dr * 0.6, dcx + dr, dcy - dr * 0.2, dcx + dr, dcy + dr * 0.2)
      .arc(dcx, dcy + dr * 0.2, dr, 0, Math.PI, false)
      .bezierCurveTo(dcx - dr, dcy - dr * 0.2, dcx - dr * 0.35, dcy - dr * 0.6, dcx, dcy - dr * 1.3)
      .stroke({ width: 1.2, color: 0xffffff });
    this._hb.dropT.text = String(Math.floor(e));
    this._hb.dropT.position.set(dcx, dcy + 2);

    var sx0 = b.x + dr * 2 + 12;
    var sx1 = b.x + b.w - (mult > 1 ? 34 : 0);
    var gap = 3;
    var segW = (sx1 - sx0 - gap * 9) / 10;
    var pulse = full ? 0.5 + 0.5 * Math.sin(now / 160) : 0;
    if (full) g.roundRect(sx0 - 2, b.y - 2, sx1 - sx0 + 4, b.h + 4, 6).fill({ color: P.elixirHi, alpha: 0.2 + 0.2 * pulse });
    for (var i = 0; i < 10; i++) {
      var x = sx0 + i * (segW + gap);
      g.roundRect(x, b.y, segW, b.h, 4).fill({ color: P.segBack, alpha: 0.7 });
      var f = clamp(e - i, 0, 1);
      if (f > 0) {
        g.roundRect(x, b.y, Math.max(2, segW * f), b.h, 4).fill({ color: full && pulse > 0.5 ? 0xd88cff : P.elixir });
        g.rect(x + 2, b.y + 3, Math.max(0, segW * f - 4), 2).fill({ color: P.elixirHi });
      }
    }

    // Shimmer band over the fill; faster with double and triple elixir.
    var speed = 0.5 * Math.max(1, mult);
    var sh = (time * speed) % 1;
    var shx = sx0 + sh * (sx1 - sx0);
    var fillEnd = sx0 + (sx1 - sx0) * (e / 10);
    var bx0 = Math.max(shx - 6, sx0);
    var bx1 = Math.min(shx + 6, fillEnd);
    if (bx1 > bx0) g.rect(bx0, b.y, bx1 - bx0, b.h).fill({ color: 0xffffff, alpha: 0.18 });

    var multT = this._hb.multT;
    if (mult > 1) {
      var pw = 28;
      var px = b.x + b.w - pw;
      g.roundRect(px, b.y - 1, pw, b.h + 2, 6).fill({ color: P.drop });
      multT.text = 'x' + mult;
      multT.position.set(px + pw / 2, b.y + b.h / 2 + 0.5);
      multT.visible = true;
    } else {
      multT.visible = false;
    }
  };

  PixiRenderer.prototype._hudFrame = function (game, uiState, team, now, dt) {
    var I = this.insets;
    var cssW = this.cssW;
    var cssH = this.cssH;
    var hb = this._hb;
    var g = hb.top;
    g.clear();
    g.rect(0, 0, cssW, I.top + TOP_BAR_H).fill({ color: P.topBar });
    hb.opp.position.set(I.left + 46, I.top + TOP_BAR_H / 2);

    var tg = hb.timeG;
    tg.clear();
    var bw = 74;
    var bh = 34;
    var bx = cssW - I.right - 8 - bw;
    var by = I.top + 5;
    if (game) {
      tg.roundRect(bx, by, bw, bh, 8).fill({ color: 0x0a1428, alpha: 0.75 });
      hb.timeLbl.position.set(bx + bw / 2, by + 9);
      hb.timeT.position.set(bx + bw / 2, by + 23);
      var low = game.phase === 'overtime' && game.timeLeft < 10;
      var col = low ? '#ff5a4f' : '#f3f6fb';
      if (hb.timeT.text !== fmtTime(game.timeLeft)) hb.timeT.text = fmtTime(game.timeLeft);
      if (hb.timeT.style.fill !== col) hb.timeT.style.fill = col;
      hb.timeLbl.visible = true;
      hb.timeT.visible = true;
      this._hudState(game, team, now, dt);
    } else {
      hb.timeLbl.visible = false;
      hb.timeT.visible = false;
    }
    hb.timeLbl.style.fontSize = 8.5;
    hb.timeT.style.fontSize = 16;

    this._drawCrowns(game, team, now);

    var pg = hb.panel;
    pg.clear();
    pg.rect(0, this.panelTop, cssW, cssH - this.panelTop).fill({ color: P.panel });
    pg.rect(0, this.panelTop, cssW, 1).fill({ color: P.panelEdge });

    var p = game && game.players ? game.players[team] : null;
    var elixir = p ? p.elixir || 0 : 0;
    this._drawElixir(game, now);

    var nr = this.nextRect;
    var fade = 0.35 + 0.65 * clamp((this._gt - this._nextFadeMs) / 0.2, 0, 1);
    hb.nextLbl.position.set(nr.x + nr.w / 2, nr.y - 8);
    hb.nextLbl.alpha = fade;
    this._nextCard.root.alpha = fade;
    this._nextCard.show(p ? p.next : null, nr.x, nr.y, nr.w, nr.h, { compact: true, label: 'Next', elixir: elixir });

    var sel = typeof uiState.selected === 'number' ? uiState.selected : -1;
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
        // The old next card flies from its slot into this one.
        var k = ease(animating.t / 0.28);
        this._animCard.show(animating.id, nr.x + (r.x - nr.x) * k, nr.y + (r.y - nr.y) * k, nr.w + (r.w - nr.w) * k, nr.h + (r.h - nr.h) * k, { elixir: elixir });
        this._cards[i].root.visible = false;
        continue;
      }
      this._cards[i].show(p && p.hand ? p.hand[i] : null, r.x, y, r.w, r.h, { elixir: elixir, selected: isSel });
    }
    if (!animating_any(anims)) this._animCard.root.visible = false;

    this._drawFlyingCrowns(team);

    var cd = cardDef(p && p.hand && sel >= 0 ? p.hand[sel] : null);
    if (game && uiState.drag && sel >= 0 && cd && !this.isInArena(uiState.drag.x, uiState.drag.y)) {
      var rect = this.cardRects[sel];
      var w = rect.w * 1.1;
      var h = rect.h * 1.1;
      this._dragCard.show(p.hand[sel], uiState.drag.x - w / 2, uiState.drag.y - h / 2, w, h, { selected: true });
    } else {
      this._dragCard.root.visible = false;
    }
  };

  function animating_any(list) {
    for (var i = 0; i < list.length; i++) if (list[i].t < 0.28) return true;
    return false;
  }

  // One card: rarity frame, art (emoji), name band, cost circle, elixir fill when unaffordable.
  function CardView(R, parent) {
    this.root = new PIXI.Container();
    this.g = new PIXI.Graphics();
    this.art = new PIXI.Sprite(PIXI.Texture.EMPTY);
    this.art.anchor.set(0.5);
    this.label = R._text(10.5, '#f3f6fb');
    this.costT = R._text(10, '#ffffff');
    this.root.addChild(this.g, this.art, this.label, this.costT);
    parent.addChild(this.root);
    this.root.visible = false;
    this.lacking = null;
  }

  CardView.prototype.show = function (cardId, x, y, w, h, o) {
    o = o || {};
    this.box = [x, y, w, h];
    var card = cardDef(cardId);
    var g = this.g;
    g.clear();
    this.root.visible = true;
    if (!card) {
      g.roundRect(x, y, w, h, 7).fill({ color: 0xffffff, alpha: 0.06 });
      this.art.visible = false;
      this.label.visible = false;
      this.costT.visible = false;
      return;
    }
    this.art.visible = true;
    this.label.visible = true;
    this.costT.visible = true;
    var frame = RARITY[card.rarity] || RARITY.common;
    g.roundRect(x, y, w, h, 7).fill({ color: frame });
    var ix = x + 2.5;
    var iy = y + 2.5;
    var iw = w - 5;
    var ih = h - 5;
    g.roundRect(ix, iy, iw, ih, 5).fill({ color: hexN(CR.Sprites.cardBg(card.rarity)) });
    var bandH = o.compact ? 13 : Math.max(14, h * 0.24);
    var artH = ih - bandH;
    g.roundRect(ix, iy + artH, iw, bandH, 4).fill({ color: P.cardBand });

    var side = Math.min(iw, artH);
    this.art.texture = CR.Sprites.cardArt(cardId) || PIXI.Texture.EMPTY;
    this.art.position.set(x + w / 2, iy + artH / 2);
    this.art.width = side;
    this.art.height = side;

    var label = o.label || card.name || '';
    var fs = Math.max(6, Math.min(o.compact ? 9 : 10.5, (iw - 6) / (Math.max(1, label.length) * 0.6)));
    if (this.label.text !== label) this.label.text = label;
    if (Math.abs(this.label.style.fontSize - fs) > 0.05) this.label.style.fontSize = fs;
    this.label.position.set(x + w / 2, iy + artH + bandH / 2 + 0.5);

    var elixir = o.elixir != null ? o.elixir : null;
    var lacking = elixir != null && card.cost > elixir;
    if (lacking) {
      g.roundRect(ix, iy, iw, ih, 5).fill({ color: P.cardLack || 0x282834, alpha: 0.5 });
      var f = clamp(elixir / card.cost, 0, 1);
      g.rect(ix, iy + ih - f * ih, iw, f * ih).fill({ color: P.elixir, alpha: 0.45 });
    }

    if (card.cost != null) {
      var cr = Math.max(8, Math.min(11, h * 0.15));
      var ccx = ix + cr + 3;
      var ccy = iy + artH - cr - 3;
      g.circle(ccx, ccy, cr).fill({ color: lacking ? P.elixirHi : P.drop });
      if (lacking) g.circle(ccx, ccy, cr).stroke({ width: 1, color: 0xffffff });
      this.costT.text = String(card.cost);
      this.costT.position.set(ccx, ccy + 0.5);
      if (Math.abs(this.costT.style.fontSize - cr * 1.15) > 0.05) this.costT.style.fontSize = cr * 1.15;
      var fc = lacking ? '#3a1654' : '#ffffff';
      if (this.costT.style.fill !== fc) this.costT.style.fill = fc;
    } else {
      this.costT.visible = false;
    }

    if (o.selected) g.roundRect(x, y, w, h, 7).stroke({ width: 2.5, color: P.gold });
    this.lacking = lacking;
  };

  // ---------- public API ----------

  // Pixi analogue of CR.Renderer. Construction is synchronous; the Pixi app is ready after init and
  // draws queued before that are replayed. Check `failed` if WebGL is unavailable.
  // Whether this browser can run the Pixi renderer (WebGL available, no context already taken).
  PixiRenderer.supported = function () {
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) {
      return false;
    }
  };

  CR.PixiRenderer = PixiRenderer;
})();
