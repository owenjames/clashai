// Texture source for the Pixi renderer. Art comes from assets/manifest.json through PIXI.Assets.
// Anything missing (no manifest, failed load, no entry) falls back to a procedural placeholder,
// generated once from canvas. Needs the global PIXI (js/vendor/pixi.min.js) and CR.CARDS.
// Format: see assets/README.md.
var CR = (globalThis.CR = globalThis.CR || {});

(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var MANIFEST_URL = 'assets/manifest.json';
  // Private art (licensed packs, gitignored): merged over the base manifest when present.
  var ART_MANIFEST_URL = 'art/manifest.json';
  var MERGE_SECTIONS = ['units', 'buildings', 'towers', 'projectiles', 'effects', 'ui'];
  var STATES = ['idle', 'walk', 'attack', 'death'];
  var EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  var TRAIL_SRC = 'assets/vfx/particles/light_01.png';

  var manifest = {};
  var gen = 0;          // bumps when the manifest finishes loading; renderers rebuild views on change
  var procedural = {};  // name -> Texture, generated once
  var sources = {};     // manifest src -> Texture (or null when the load failed)
  var visuals = {};     // 'kind|key|team' -> visual record (see fromEntry)
  var emojis = {};      // emoji -> Texture
  var unitEmojiMap = null;

  function mkCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function bake(name, w, h, paint) {
    var t = procedural[name];
    if (!t) {
      var c = mkCanvas(w, h);
      paint(c.getContext('2d'), w, h);
      t = procedural[name] = PIXI.Texture.from(c);
    }
    return t;
  }

  function radial(g, cx, cy, r, stops) {
    var grd = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    for (var i = 0; i < stops.length; i++) grd.addColorStop(stops[i][0], stops[i][1]);
    return grd;
  }

  // Rounded rect path without ctx.roundRect (missing on older iOS Safari).
  function rrPath(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function star(g, cx, cy, r, inner) {
    g.beginPath();
    for (var k = 0; k < 8; k++) {
      var a = (k * Math.PI) / 4 - Math.PI / 2;
      var rr = k % 2 ? r * inner : r;
      var x = cx + Math.cos(a) * rr;
      var y = cy + Math.sin(a) * rr;
      if (k === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
  }

  function unitEmoji(unitId) {
    if (!unitEmojiMap) {
      unitEmojiMap = {};
      var cards = CR.CARDS || {};
      for (var k in cards) {
        var c = cards[k];
        if (c && c.unit && unitEmojiMap[c.unit] === undefined) unitEmojiMap[c.unit] = c.emoji;
      }
    }
    return unitEmojiMap[unitId] || '?';
  }

  // ---------- procedural textures ----------

  function emojiTex(ch) {
    var key = ch || '?';
    if (!emojis[key]) {
      var c = mkCanvas(128, 128);
      var g = c.getContext('2d');
      g.font = '96px ' + EMOJI_FONT;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(key, 64, 68);
      emojis[key] = PIXI.Texture.from(c);
    }
    return emojis[key];
  }

  // Token for a unit with no art: light disc, dark rim, card emoji. Team colour comes from the ring.
  function tokenTex(ch) {
    return bake('token|' + ch, 128, 128, function (g) {
      g.beginPath();
      g.arc(64, 64, 58, 0, TAU);
      g.fillStyle = '#f6f0de';
      g.fill();
      g.lineWidth = 8;
      g.strokeStyle = '#1d1a2b';
      g.stroke();
      g.font = '84px ' + EMOJI_FONT;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(ch || '?', 64, 70);
    });
  }

  // Projectiles at phone size: thick ink outlines so each shot reads against grass and river.
  function projectileTex(kind) {
    return bake('proj|' + kind, 64, 64, function (g) {
      var cx = 32;
      var cy = 32;
      var ink = '#1d1a33';
      g.lineCap = 'round';
      g.lineJoin = 'round';
      if (kind === 'arrow' || kind === 'spear') {
        var metal = kind === 'arrow' ? '#e4e9f2' : '#c9d2e0';
        var wood = kind === 'arrow' ? '#8a5a2b' : '#9b6a34';
        var sw = kind === 'arrow' ? 8 : 9;
        g.beginPath();
        g.moveTo(cx - 22, cy);
        g.lineTo(cx + 14, cy);
        g.lineWidth = sw + 6;
        g.strokeStyle = ink;
        g.stroke();
        g.lineWidth = sw;
        g.strokeStyle = wood;
        g.stroke();
        // Head, then fletching at the tail.
        g.beginPath();
        g.moveTo(cx + 29, cy);
        g.lineTo(cx + 12, cy - 12);
        g.lineTo(cx + 12, cy + 12);
        g.closePath();
        g.fillStyle = metal;
        g.fill();
        g.lineWidth = 4;
        g.strokeStyle = ink;
        g.stroke();
        g.beginPath();
        g.moveTo(cx - 22, cy);
        g.lineTo(cx - 31, cy - 9);
        g.moveTo(cx - 22, cy);
        g.lineTo(cx - 31, cy + 9);
        g.lineWidth = 5;
        g.strokeStyle = ink;
        g.stroke();
      } else if (kind === 'cannonball' || kind === 'bomb') {
        g.beginPath();
        g.arc(cx, cy, kind === 'bomb' ? 17 : 20, 0, TAU);
        g.fillStyle = kind === 'bomb' ? '#2a2a31' : '#3b3d46';
        g.fill();
        g.lineWidth = 5;
        g.strokeStyle = ink;
        g.stroke();
        g.beginPath();
        g.arc(cx - 7, cy - 7, 6, 0, TAU);
        g.fillStyle = '#8c909c';
        g.fill();
        if (kind === 'bomb') {
          g.beginPath();
          g.arc(cx + 10, cy - 14, 4, 0, TAU);
          g.fillStyle = '#ffb22e';
          g.fill();
        }
      } else if (kind === 'fire' || kind === 'magic' || kind === 'ice' || kind === 'goo') {
        var outer = { fire: 'rgba(255,120,30,0.6)', magic: 'rgba(255,110,210,0.55)', ice: 'rgba(160,230,255,0.65)', goo: 'rgba(154,79,216,0.7)' }[kind];
        var core = { fire: '#ffb22e', magic: '#ff8ad8', ice: '#c7f1ff', goo: '#9a4fd8' }[kind];
        g.beginPath();
        g.arc(cx, cy, 30, 0, TAU);
        g.fillStyle = outer;
        g.fill();
        g.beginPath();
        g.arc(cx, cy, 19, 0, TAU);
        g.fillStyle = core;
        g.fill();
        g.lineWidth = 4;
        g.strokeStyle = ink;
        g.stroke();
        g.beginPath();
        g.arc(cx - 5, cy - 6, 5, 0, TAU);
        g.fillStyle = '#ffffff';
        g.fill();
      } else {
        g.beginPath();
        g.arc(cx, cy, 13, 0, TAU);
        g.fillStyle = '#ffffff';
        g.fill();
        g.lineWidth = 5;
        g.strokeStyle = ink;
        g.stroke();
      }
    });
  }

  var tex = {
    white: function () {
      return bake('white', 8, 8, function (g) {
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, 8, 8);
      });
    },
    // White ring with transparent middle. Tinted for team rings, shields and deploy rings.
    ring: function () {
      return bake('ring', 128, 128, function (g) {
        g.beginPath();
        g.arc(64, 64, 54, 0, TAU);
        g.lineWidth = 14;
        g.strokeStyle = '#ffffff';
        g.stroke();
      });
    },
    // Soft radial blob: glow, puff and smoke all use it, tinted and added as needed.
    glow: function () {
      return bake('glow', 128, 128, function (g) {
        g.fillStyle = radial(g, 64, 64, 64, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]);
        g.fillRect(0, 0, 128, 128);
      });
    },
    // Ground shadow: flat soft ellipse.
    shadow: function () {
      return bake('shadow', 128, 64, function (g) {
        g.save();
        g.translate(64, 32);
        g.scale(1, 0.5);
        g.fillStyle = radial(g, 0, 0, 64, [[0, 'rgba(10,30,10,0.42)'], [0.6, 'rgba(10,30,10,0.22)'], [1, 'rgba(10,30,10,0)']]);
        g.beginPath();
        g.arc(0, 0, 64, 0, TAU);
        g.fill();
        g.restore();
      });
    },
    spark: function () {
      return bake('spark', 64, 64, function (g) {
        g.fillStyle = '#ffffff';
        star(g, 32, 32, 30, 0.3);
        g.fill();
      });
    },
    stun: function () {
      return bake('stun', 64, 64, function (g) {
        g.fillStyle = '#ffe83a';
        star(g, 32, 32, 30, 0.45);
        g.fill();
        g.lineWidth = 4;
        g.strokeStyle = '#7a5a00';
        g.stroke();
      });
    },
    chunk: function () {
      return bake('chunk', 32, 32, function (g) {
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.moveTo(4, 8);
        g.lineTo(18, 3);
        g.lineTo(28, 14);
        g.lineTo(22, 28);
        g.lineTo(6, 26);
        g.closePath();
        g.fill();
      });
    },
    // Rounded rect, tinted for log bodies and card-like plates.
    roundRect: function () {
      return bake('rr', 64, 64, function (g) {
        g.fillStyle = '#ffffff';
        rrPath(g, 2, 2, 60, 60, 16);
        g.fill();
      });
    },
    // Tower body: stone block with a darker front face at the bottom. Anchored at its base centre.
    towerBody: function () {
      return bake('towerBody', 256, 308, function (g, w, h) {
        g.fillStyle = '#d6d0bf';
        g.fillRect(6, 6, w - 12, h - 12);
        g.fillStyle = '#a79f88';
        g.fillRect(6, h * 0.74, w - 12, h * 0.26 - 6);
        g.lineWidth = 8;
        g.strokeStyle = '#6c675a';
        g.strokeRect(6, 6, w - 12, h - 12);
      });
    },
    // Tower roof: white plate with a dark rim. Tinted to the team colour at draw time.
    roof: function () {
      return bake('roof', 256, 256, function (g) {
        g.beginPath();
        rrPath(g, 14, 14, 228, 228, 26);
        g.fillStyle = '#ffffff';
        g.fill();
        g.lineWidth = 12;
        g.strokeStyle = '#2a2430';
        g.stroke();
      });
    },
    // Soft particle for projectile trails: the vfx light sprite when it loaded, else the glow blob.
    trail: function () {
      return sources[TRAIL_SRC] || tex.glow();
    },
    // Red diagonal stripes for invalid deploy cells. Repeats.
    stripes: function () {
      return bake('stripes', 16, 16, function (g) {
        g.strokeStyle = 'rgba(255,58,58,0.6)';
        g.lineWidth = 4;
        for (var k = -16; k <= 16; k += 8) {
          g.beginPath();
          g.moveTo(k, 16);
          g.lineTo(k + 16, 0);
          g.stroke();
        }
      });
    }
  };

  // ---------- card portraits ----------

  // Solid card-art background per rarity (the card frame uses the darker rarity colour).
  var CARD_BG = { common: '#d9c09a', rare: '#f6cf8a', epic: '#d9b2f2', legendary: '#fbeaa0' };
  var CARD_FRAME = { common: '#9a7b57', rare: '#e0932f', epic: '#a25ce0', legendary: '#f0c93a' };
  var cardArts = {};    // card id -> Texture

  // Canvas copy of a texture's frame (manifest frame or sheet cell).
  function textureCanvas(t) {
    var f = t && t.frame;
    var src = t && t.source && t.source.resource;
    if (!src || !f) return null;
    var c = mkCanvas(Math.max(1, Math.round(f.width)), Math.max(1, Math.round(f.height)));
    c.getContext('2d').drawImage(src, f.x, f.y, f.width, f.height, 0, 0, c.width, c.height);
    return c;
  }

  // Bounding box of the opaque pixels in a canvas, or null when empty.
  function alphaBox(c) {
    var w = c.width;
    var h = c.height;
    var d = c.getContext('2d').getImageData(0, 0, w, h).data;
    var x0 = w;
    var x1 = -1;
    var y0 = h;
    var y1 = -1;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 40) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;
    return { x0: x0, y0: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: (x0 + x1 + 1) / 2 };
  }

  // Upper body (head to chest) of a character canvas, on the card background. 160 px square.
  function characterPortrait(src, bg) {
    var out = mkCanvas(160, 160);
    var g = out.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, 160, 160);
    var box = alphaBox(src);
    if (!box) return out;
    var side = Math.min(Math.max(box.h * 0.62, box.w * 0.9), src.width, src.height);
    var sx = Math.min(Math.max(box.cx - side / 2, 0), src.width - side);
    var sy = Math.min(Math.max(box.y0, 0), src.height - side);
    g.drawImage(src, sx, sy, side, side, 0, 0, 160, 160);
    return out;
  }

  // Spells and anything without a character: the card emoji on the background.
  function emojiPortrait(ch, bg) {
    var out = mkCanvas(160, 160);
    var g = out.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, 160, 160);
    g.font = '104px ' + EMOJI_FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, 80, 86);
    return out;
  }

  // Manifest art for a unit id: the idle frame, or null when the manifest has none.
  function artCanvas(unitId) {
    var art = Sprites.unitArt(unitId);
    return art ? textureCanvas(art.frames.idle[0]) : null;
  }

  // Idle frame of baked troop art (team 0 colours), or null.
  function troopIdleCanvas(unitId) {
    if (!CR.TroopArt || typeof CR.TroopArt.bake !== 'function') return null;
    try {
      var b = CR.TroopArt.bake(unitId, 0, { height: 200, dpr: 1, poses: ['idle'] });
      return b && b.frames && b.frames.idle ? b.frames.idle[0] : null;
    } catch (err) {
      return null;
    }
  }

  // ---------- manifest ----------

  function collectSrcs(m) {
    var out = [];
    function add(s) {
      if (typeof s === 'string' && out.indexOf(s) < 0) out.push(s);
    }
    function scan(entry) {
      if (!entry || typeof entry !== 'object') return;
      add(entry.src);
      if (entry.sheet) add(entry.sheet.src);
      if (entry.frames) {
        for (var s in entry.frames) (entry.frames[s] || []).forEach(add);
      }
    }
    scan(m.arena);
    ['units', 'buildings', 'projectiles', 'effects', 'ui'].forEach(function (sec) {
      var o = m[sec] || {};
      for (var k in o) {
        // An effect may be a list of layers, each a normal entry.
        if (Array.isArray(o[k])) o[k].forEach(scan);
        else {
          scan(o[k]);
          // Team variants of one building: { team0: entry, team1: entry }.
          if (o[k] && typeof o[k] === 'object') { scan(o[k].team0); scan(o[k].team1); }
        }
      }
    });
    var towers = m.towers || {};
    for (var t in towers) {
      scan(towers[t]);
      scan(towers[t].team0);
      scan(towers[t].team1);
    }
    return out;
  }

  // JSON or null. A missing file is not an error: the caller falls back to procedural art.
  function fetchJson(url) {
    return fetch(url, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  // Section-level merge: entries in art replace base entries with the same key.
  function mergeManifests(base, art) {
    var out = {};
    var k;
    for (k in base) out[k] = base[k];
    for (k in art) {
      var isSection = MERGE_SECTIONS.indexOf(k) >= 0 && base[k] && typeof base[k] === 'object';
      out[k] = isSection ? Object.assign({}, base[k], art[k]) : art[k];
    }
    return out;
  }

  function loadSources(list) {
    return Promise.all(list.map(function (src) {
      return PIXI.Assets.load(src).then(function (t) {
        sources[src] = t;
      }, function () {
        sources[src] = null;
      });
    }));
  }

  // Tint as a number. Accepts "#rrggbb" or 0xrrggbb; anything else means no tint.
  function parseTint(t) {
    if (typeof t === "number") return t;
    if (typeof t === "string" && /^#[0-9a-fA-F]{6}$/.test(t)) return parseInt(t.slice(1), 16);
    return null;
  }

  // Turns one manifest entry into a visual: { frames: {state: [Texture]}, fps, anchor, h, flip, tintable }.
  // h is tiles tall. Units scale h by r / 0.5; towers by size / 3; projectiles use h as length.
  function fromEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    var anchor = entry.anchor || [0.5, 0.9];
    var vis = {
      frames: {},
      fps: entry.fps || 0,
      anchor: { x: anchor[0], y: anchor[1] },
      h: entry.scale || 1,
      flip: !!entry.flipDefault,
      tintable: entry.tintable !== false,
      blend: entry.blend === 'add' ? 'add' : 'normal',
      tint: parseTint(entry.tint),
      alpha: entry.alpha != null ? entry.alpha : 1,
      spin: entry.spin || 0,
      placeholder: false
    };
    var i;
    if (entry.sheet) {
      var sh = entry.sheet;
      var base = sources[sh.src];
      if (!base) return null;
      var fw = sh.frameW;
      var fh = sh.frameH;
      for (var s = 0; s < STATES.length; s++) {
        var row = sh.rows && sh.rows[STATES[s]];
        if (!row) continue;
        var list = [];
        for (i = 0; i < row[1]; i++) {
          list.push(new PIXI.Texture({
            source: base.source,
            frame: new PIXI.Rectangle(((row[2] || 0) + i) * fw, row[0] * fh, fw, fh)
          }));
        }
        vis.frames[STATES[s]] = list;
      }
      vis.fps = sh.fps || entry.fps || 8;
    } else if (entry.frames) {
      for (var f = 0; f < STATES.length; f++) {
        var files = entry.frames[STATES[f]];
        if (!files) continue;
        var ts = files.map(function (src) { return sources[src]; }).filter(Boolean);
        if (ts.length) vis.frames[STATES[f]] = ts;
      }
      vis.fps = entry.fps || 8;
    } else if (entry.src) {
      var one = sources[entry.src];
      if (!one) return null;
      vis.frames.idle = [one];
    }
    if (!vis.frames.idle) {
      vis.frames.idle = vis.frames.walk || vis.frames.attack || null;
      if (!vis.frames.idle) return null;
    }
    // Missing states reuse idle, so the renderer never has to check.
    for (i = 0; i < STATES.length; i++) {
      if (!vis.frames[STATES[i]]) vis.frames[STATES[i]] = vis.frames.idle;
    }
    return vis;
  }

  function cached(key, make) {
    var k = key;
    if (!(k in visuals)) visuals[k] = make() || null;
    return visuals[k];
  }

  function placeholderVisual(kind, key) {
    if (kind === 'unit') {
      var tk = tokenTex(unitEmoji(key));
      return { frames: { idle: [tk], walk: [tk], attack: [tk], death: [tk] }, fps: 0, anchor: { x: 0.5, y: 0.5 }, h: 1.4, flip: false, tintable: false, placeholder: true };
    }
    if (kind === 'tower') {
      var body = tex.towerBody();
      return { frames: { idle: [body], walk: [body], attack: [body], death: [body] }, fps: 0, anchor: { x: 0.5, y: 1 }, h: 3.6, flip: false, tintable: false, placeholder: true };
    }
    if (kind === 'projectile') {
      var pt = projectileTex(key);
      return { frames: { idle: [pt] }, fps: 0, anchor: { x: 0.5, y: 0.5 }, h: 0.6, flip: false, tintable: false, placeholder: true };
    }
    return null;
  }

  // Team entries: towers[type].team0 / team1, or one shared entry on towers[type].
  function towerEntry(type, team) {
    var t = (manifest.towers || {})[type];
    if (!t) return null;
    var e = t['team' + team];
    if (!e && (t.src || t.sheet || t.frames)) e = t;
    return e || null;
  }

  var Sprites = {
    tex: tex,
    emoji: emojiTex,
    // Bumps once the manifest has loaded. Renderers drop cached views when it changes.
    get gen() {
      return gen;
    },
    // Resolves true when a manifest was read and its art loaded (or was empty). Never rejects.
    load: function (url) {
      var list = null;
      return fetchJson(url || MANIFEST_URL)
        .then(function (base) {
          base = base && typeof base === 'object' ? base : {};
          return fetchJson(ART_MANIFEST_URL).then(function (art) {
            return art && typeof art === 'object' ? mergeManifests(base, art) : base;
          });
        })
        .then(function (m) {
          manifest = m;
          list = collectSrcs(manifest);
          if (list.indexOf(TRAIL_SRC) < 0) list.push(TRAIL_SRC);
          return loadSources(list);
        })
        .then(function () {
          visuals = {};
          gen++;
          return true;
        })
        .catch(function () { return false; });
    },
    // Manifest art for a unit or building, or null. The renderer falls back to baked troop art, then the token.
    // team (0 or 1) picks a building's team variant; without it team 0 is used.
    unitArt: function (unitId, team) {
      var b = manifest.buildings && manifest.buildings[unitId];
      var teamed = !!(b && (b.team0 || b.team1));
      return cached('unit|' + unitId + (teamed ? '|' + (team === 1 ? 1 : 0) : ''), function () {
        var m = b || (manifest.units || {})[unitId];
        if (teamed) m = b[team === 1 ? 'team1' : 'team0'] || b.team0 || b.team1;
        return fromEntry(m);
      });
    },
    // Unit visual for the token placeholder path (manifest art or token).
    unit: function (unitId, team) {
      return Sprites.unitArt(unitId, team) || cached('ph|unit|' + unitId, function () {
        return placeholderVisual('unit', unitId);
      });
    },
    tower: function (type, team) {
      return cached('tower|' + type + '|' + team, function () {
        return fromEntry(towerEntry(type, team)) || placeholderVisual('tower', type);
      });
    },
    projectile: function (kind) {
      return cached('proj|' + kind, function () {
        return fromEntry((manifest.projectiles || {})[kind]) || placeholderVisual('projectile', kind);
      });
    },
    // Manifest effect visual, or null when the renderer should draw its own.
    // Layers for an effect type (empty when the renderer should draw its own).
    effect: function (type) {
      return cached('fx|' + type, function () {
        var e = (manifest.effects || {})[type];
        if (!e) return null;
        var list = (Array.isArray(e) ? e : [e]).map(fromEntry).filter(Boolean);
        return list.length ? list : null;
      });
    },
    // Troop frames baked by CR.TroopArt. tilesH: standing height in tiles of a r = 0.5 unit (the renderer
    // passes 1.4 * r / 0.5); the bake's relative size (goblins smaller, giants bigger) applies on top.
    // pxPerTile: device px per tile. The visual's h is the whole canvas height in tiles, anchor the feet.
    troop: function (unitId, team, tilesH, pxPerTile) {
      if (!CR.TroopArt || typeof CR.TroopArt.bake !== 'function') return null;
      var hpx = Math.max(16, Math.round(tilesH * pxPerTile / 4) * 4);
      var key = 'troop|' + unitId + '|' + team + '|' + hpx;
      if (!(key in visuals)) {
        var out = null;
        try {
          var b = CR.TroopArt.bake(unitId, team, { height: hpx, dpr: 1 });
          if (b && b.frames) {
            var W = b.size.width;
            var H = b.size.height;
            var frames = {};
            ['idle', 'walk', 'attack', 'death'].forEach(function (st) {
              var list = b.frames[st] && b.frames[st].length ? b.frames[st] : b.frames.idle;
              frames[st] = list.map(function (c) { return PIXI.Texture.from(c); });
            });
            out = {
              frames: frames, fps: b.fps || 10,
              anchor: { x: b.size.anchor[0] / W, y: b.size.anchor[1] / H },
              h: H / pxPerTile, flip: false, tintable: false, blend: 'normal', tint: null, alpha: 1, spin: 0,
              placeholder: false, troop: true,
              strikeIdx: Math.floor((frames.attack || []).length * 0.4)
            };
          }
        } catch (err) { out = null; }
        visuals[key] = out;
      }
      return visuals[key];
    },
    // Card portrait: upper body of the unit's idle frame (manifest art, else baked troop art) on the rarity
    // background, or the card emoji for spells. Built once per card.
    cardArt: function (cardId) {
      if (cardArts[cardId]) return cardArts[cardId];
      var card = CR.CARDS && CR.CARDS[cardId];
      if (!card) return null;
      var bg = CARD_BG[card.rarity] || CARD_BG.common;
      var src = card.type !== 'spell' && card.unit ? (artCanvas(card.unit) || troopIdleCanvas(card.unit)) : null;
      var c = src ? characterPortrait(src, bg) : emojiPortrait(card.emoji || '?', bg);
      cardArts[cardId] = PIXI.Texture.from(c);
      return cardArts[cardId];
    },
    // Card art background and frame colours for a rarity, as CSS hex strings.
    cardBg: function (rarity) {
      return CARD_BG[rarity] || CARD_BG.common;
    },
    cardFrame: function (rarity) {
      return CARD_FRAME[rarity] || CARD_FRAME.common;
    },
    // Arena background from manifest.arena: { tex, pad } or null for the procedural grass and river.
    // pad: tiles of margin around the 18x32 play area that the image covers on each side.
    arena: function () {
      var a = manifest.arena;
      var t = a && a.src ? sources[a.src] : null;
      return t ? { tex: t, pad: a.pad || 0 } : null;
    },
    // UI icon texture from manifest.ui, or null for the built-in drawing.
    ui: function (name) {
      var v = cached('ui|' + name, function () {
        return fromEntry((manifest.ui || {})[name]);
      });
      return v ? v.frames.idle[0] : null;
    }
  };

  CR.Sprites = Sprites;
})();
