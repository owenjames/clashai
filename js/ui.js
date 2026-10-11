// Menus: home, deck builder, result, battle HUD. Builds markup into the screen sections in index.html.
// Game state, persistence and the battle loop live in js/main.js, which passes callbacks to CR.UI.init.
var CR = (globalThis.CR = globalThis.CR || {});

CR.UI = (function () {
  'use strict';

  var app = {};
  var el = {};
  var deck = [];
  var selCol = null;   // collection card picked, waiting for a deck slot
  var selSlot = null;  // deck slot picked, waiting for a card or a second slot
  var sheetOpen = false;
  var lp = null;       // long-press tracker for the info sheet

  var DIFFS = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']];
  var TYPES = { troop: 'Troop', building: 'Building', spell: 'Spell' };
  var TARGETS = { ground: 'Ground', both: 'Air and ground', buildings: 'Buildings' };
  var TITLES = { win: 'Victory', loss: 'Defeat', draw: 'Draw' };
  var REASONS = { king: 'King tower destroyed', tiebreak: 'Tiebreak', forfeit: 'Forfeit' };
  var EMOTES = ['😀', '😡', '👍', '😭'];
  var COLLECTION = Object.keys(CR.CARDS).sort(function (a, b) {
    var A = CR.CARDS[a], B = CR.CARDS[b];
    return A.cost - B.cost || A.name.localeCompare(B.name);
  });

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; });
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function avg(ids) {
    var t = 0;
    for (var i = 0; i < ids.length; i++) t += CR.CARDS[ids[i]].cost;
    return ids.length ? t / ids.length : 0;
  }

  function speedTier(v) {
    if (v <= 0) return 'Static';
    if (v <= 0.75) return 'Slow';
    if (v <= 1.0) return 'Medium';
    if (v <= 1.5) return 'Fast';
    return 'Very fast';
  }

  // Full card tile: rarity border, elixir drop, emoji, name.
  function tile(id, cls, attr) {
    var c = CR.CARDS[id];
    return '<div class="tile r-' + c.rarity + (cls ? ' ' + cls : '') + '" data-id="' + id + '"' +
      (attr ? ' ' + attr : '') + '>' +
      '<div class="tin"><span class="emo">' + c.emoji + '</span><span class="tn">' + esc(c.name) + '</span></div>' +
      '<span class="drop">' + c.cost + '</span></div>';
  }

  // Compact tile for the home deck preview.
  function mini(id) {
    var c = CR.CARDS[id];
    return '<div class="tile mini r-' + c.rarity + '"><div class="tin"><span class="emo">' + c.emoji + '</span></div>' +
      '<span class="drop">' + c.cost + '</span></div>';
  }

  function crowns(n, color) {
    var out = '';
    for (var i = 0; i < 3; i++) {
      out += '<svg class="crown' + (i < n ? '' : ' off') + '" viewBox="0 0 24 20" style="--c:' + color + '">' +
        '<path d="M2 18 L3.5 5 L8.5 11 L12 2 L15.5 11 L20.5 5 L22 18 Z"/></svg>';
    }
    return out;
  }

  // Stat rows and ability chips for the info sheet, from the unit and card data.
  function stats(id) {
    var c = CR.CARDS[id], rows = [], chips = [], u;
    function row(k, v) { rows.push([k, String(v)]); }

    if (c.type === 'spell') {
      if (c.damage) row('Damage', c.damage);
      if (c.towerDamage) row('Tower damage', c.towerDamage);
      if (c.radius) row('Radius', c.radius + ' tiles');
      if (c.dps) row('DPS', c.dps);
      if (c.towerDps) row('Tower DPS', c.towerDps);
      if (c.duration) row('Duration', c.duration + ' s');
      if (c.travelSpeed !== undefined) row('Travel', c.travelSpeed ? c.travelSpeed + ' tiles/s' : 'Instant');
      if (c.stun) row('Stun', c.stun + ' s');
      if (c.freeze) row('Freeze', c.freeze + ' s');
      if (c.knockback) row('Knockback', c.knockback + ' tiles');
      if (c.slow) row('Slow', Math.round(c.slow * 100) + '%');
      if (c.log) {
        row('Length', c.log.length + ' tiles');
        row('Width', c.log.width + ' tiles');
        row('Roll speed', c.log.speed + ' tiles/s');
      }
      if (c.spawnUnit) chips.push('Spawns ' + c.spawnCount + ' ' + CR.UNITS[c.spawnUnit].name);
    } else {
      u = CR.UNITS[c.unit];
      if (c.type === 'troop') row('Count', c.count);
      row('HP', u.hp);
      if (u.damage) row('Damage', u.damage);
      if (u.hitSpeed) row('Hit speed', u.hitSpeed + ' s');
      if (u.damage && u.hitSpeed) row('DPS', Math.round(u.damage / u.hitSpeed));
      if (u.range) row('Range', u.range + ' tiles');
      if (u.speed) row('Speed', speedTier(u.speed));
      if (TARGETS[u.targets]) row('Targets', TARGETS[u.targets]);
      if (u.lifetime) row('Lifetime', u.lifetime + ' s');

      if (u.air) chips.push('Flying');
      if (u.projectile) chips.push('Ranged');
      if (u.jumpsRiver) chips.push('Jumps river');
      if (u.splash) chips.push('Splash ' + u.splash + ' tiles');
      if (u.splashAroundSelf) chips.push('Splash around self');
      if (u.charge) chips.push('Charge ' + u.charge.damageMult + 'x after ' + u.charge.dist + ' tiles');
      if (u.ramp) chips.push('Ramps to ' + u.ramp.stages[2] + ' dmg');
      if (u.kamikaze) chips.push('Kamikaze, freezes ' + u.kamikaze.freeze + ' s');
      if (u.spawn) {
        chips.push('Spawns ' + u.spawn.count + ' ' + CR.UNITS[u.spawn.unit].name +
          ' every ' + u.spawn.interval + ' s');
      }
      if (u.deathDamage) {
        chips.push('On death: ' + u.deathDamage.damage + ' dmg, radius ' + u.deathDamage.radius);
      }
      if (u.deathSpawn) {
        chips.push('On death: ' + u.deathSpawn.count + ' ' + CR.UNITS[u.deathSpawn.unit].name);
      }
    }
    return { rows: rows, chips: chips };
  }

  // ---- home ----

  function renderHome(p) {
    var diffs = DIFFS.map(function (d) {
      return '<button class="' + (p.difficulty === d[0] ? 'on' : '') + '" data-diff="' + d[0] + '">' + d[1] + '</button>';
    }).join('');
    el.home.innerHTML =
      '<div class="bar">' +
        '<div class="pill"><span>🏆</span><b>' + p.trophies + '</b></div>' +
        '<button class="iconbtn" data-act="mute" aria-label="Sound">' + (p.muted ? '🔇' : '🔊') + '</button>' +
      '</div>' +
      '<h1 class="logo">ClashAI</h1>' +
      '<div class="rec"><span>Wins <b>' + p.wins + '</b></span><span>Losses <b>' + p.losses +
        '</b></span><span>Draws <b>' + p.draws + '</b></span></div>' +
      '<div class="panel decks"><div class="minis">' + p.deck.map(mini).join('') + '</div>' +
        '<div class="avgline">Avg elixir <b>' + avg(p.deck).toFixed(1) + '</b></div></div>' +
      '<div class="spacer"></div>' +
      '<div class="seg">' + diffs + '</div>' +
      '<button class="btn gold xl" data-act="battle">Battle</button>' +
      '<button class="btn dark" data-act="deck">Deck</button>';
  }

  // ---- deck builder ----

  function renderDeck() {
    el.slots.innerHTML = deck.map(function (id, i) {
      return tile(id, 'slot' + (selSlot === i ? ' sel' : ''), 'data-slot="' + i + '"');
    }).join('');
    el.grid.innerHTML = COLLECTION.map(function (id) {
      var cls = (deck.indexOf(id) >= 0 ? 'used ' : '') + (selCol === id ? 'sel' : '');
      return tile(id, cls.trim(), 'data-col="1"');
    }).join('');
    el.avg.textContent = avg(deck).toFixed(1);
  }

  function changed() {
    app.onDeckChange(deck.slice());
    renderDeck();
  }

  // Put a collection card in a slot. If it is already in the deck, the two slots swap.
  function place(id, slot) {
    var i = deck.indexOf(id);
    if (i === slot) return;
    if (i >= 0) deck[i] = deck[slot];
    deck[slot] = id;
    selCol = null;
    selSlot = null;
    changed();
  }

  function swapSlots(a, b) {
    var t = deck[a];
    deck[a] = deck[b];
    deck[b] = t;
    selSlot = null;
    changed();
  }

  function onSlot(i) {
    if (selCol) return place(selCol, i);
    if (selSlot === i) return openSheet(deck[i]);
    if (selSlot !== null) return swapSlots(selSlot, i);
    selSlot = i;
    renderDeck();
  }

  function onCol(id) {
    if (selSlot !== null) return place(id, selSlot);
    if (selCol === id) return openSheet(id);
    selCol = id;
    renderDeck();
  }

  function openSheet(id) {
    var c = CR.CARDS[id], s = stats(id);
    sheetOpen = true;
    el.sheet.innerHTML =
      '<div class="sh"><span class="emo big">' + c.emoji + '</span><div>' +
        '<h3>' + esc(c.name) + '</h3>' +
        '<div class="sub">' + TYPES[c.type] + ' · ' + cap(c.rarity) + ' · ' + c.cost + ' elixir</div>' +
      '</div></div>' +
      (s.rows.length ? '<dl class="stats">' + s.rows.map(function (r) {
        return '<div><dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd></div>';
      }).join('') + '</dl>' : '') +
      (s.chips.length ? '<div class="chips">' + s.chips.map(function (t) {
        return '<span>' + esc(t) + '</span>';
      }).join('') + '</div>' : '') +
      '<button class="btn gold" data-act="close-sheet">Close</button>';
    el.sheetBack.classList.add('open');
  }

  function closeSheet() {
    sheetOpen = false;
    el.sheetBack.classList.remove('open');
  }

  function openDeck(d) {
    deck = d.slice();
    selCol = null;
    selSlot = null;
    closeSheet();
    renderDeck();
    showScreen('deck');
  }

  // ---- result ----

  // Result screen. Crowns light up in order, trophies count from the old total to the new one.
  function showResult(r) {
    var delta = r.delta > 0 ? '+' + r.delta : String(r.delta);
    var dcls = r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : '';
    var from = r.before != null ? r.before : r.trophies;
    el.result.innerHTML =
      '<div class="res ' + r.outcome + '">' +
        '<h1 class="rtitle">' + TITLES[r.outcome] + '</h1>' +
        '<div class="crowns">' +
          '<div class="side" data-crowns="0">' + crowns(0, CR.TEAM_COLORS[0].main) + '</div>' +
          '<div class="side" data-crowns="1">' + crowns(0, CR.TEAM_COLORS[1].main) + '</div>' +
        '</div>' +
        '<div class="trophy"><span>🏆</span><b class="tv">' + from + '</b><span class="delta dl ' + dcls + '">' + delta + '</span></div>' +
        (REASONS[r.reason] ? '<p class="why">' + REASONS[r.reason] + '</p>' : '') +
        '<button class="btn gold" data-act="ok">OK</button>' +
      '</div>';
    showScreen('result');

    // Crowns: fill each earned crown in turn.
    var steps = [];
    for (var s = 0; s < 2; s++) {
      for (var i = 1; i <= r.crowns[s]; i++) steps.push({ side: s, n: i });
    }
    steps.forEach(function (st, k) {
      setTimeout(function () {
        var side = el.result.querySelector('[data-crowns="' + st.side + '"]');
        if (!side) return;
        side.innerHTML = crowns(st.n, CR.TEAM_COLORS[st.side].main);
        var c = side.children[st.n - 1];
        if (c) c.setAttribute('class', 'crown earn');
        if (CR.Audio) CR.Audio.play('crown');
      }, 500 + k * 350);
    });

    // Trophies: count from the old total to the new total.
    var tv = el.result.querySelector('.tv');
    var dur = 900;
    var delay = 500 + Math.max(1, steps.length) * 350 + 200;
    var t0 = 0;
    function tick() {
      var p = Math.min(1, Math.max(0, (nowMs() - t0) / dur));
      if (tv) tv.textContent = String(Math.round(from + (r.trophies - from) * p));
      if (p < 1 && tv) requestAnimationFrame(tick);
    }
    setTimeout(function () { t0 = nowMs(); requestAnimationFrame(tick); }, delay);
  }

  function nowMs() {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  }

  // ---- battle HUD ----

  function setPaused(on) {
    el.pause.classList.toggle('open', !!on);
  }

  // Big centre text: countdown 3-2-1, final-10s numbers (big), or "Fight!" (fight).
  function setCountdown(text, kind) {
    var c = $('cd');
    c.textContent = text ? String(text) : '';
    c.className = 'cd' + (text ? ' on' : '') + (kind ? ' ' + kind : '');
    if (text) {
      void c.offsetWidth; // restart the pop animation
      c.classList.add('pop');
    }
  }

  // Intro splash: you vs opponent with trophy counts. Calls done when it hides.
  function showIntro(you, opp, done) {
    var box = $('intro');
    box.innerHTML =
      '<div class="vs">' +
        '<div class="who b"><div class="nm">You</div><div class="tr">🏆 ' + you + '</div></div>' +
        '<div class="swords">⚔️</div>' +
        '<div class="who r"><div class="nm">Opponent</div><div class="tr">🏆 ' + opp + '</div></div>' +
      '</div>';
    box.classList.add('on');
    setTimeout(function () {
      box.classList.remove('on');
      if (done) done();
    }, 1500);
  }

  // Slides a message across the middle. cls: 'purple' | 'red' | 'gold' or none.
  function showBanner(title, sub, cls) {
    var b = $('banner');
    b.className = 'banner ' + (cls || '');
    b.innerHTML = '<div class="t">' + esc(title) + '</div>' + (sub ? '<div class="s">' + esc(sub) + '</div>' : '');
    void b.offsetWidth; // restart the slide
    b.classList.add('on');
  }

  // Places the emote button at the arena's bottom-left corner and its picker above it.
  function layoutHud(rect) {
    if (!rect) return;
    var btn = $('emobtn');
    btn.style.left = rect.x + 'px';
    btn.style.top = rect.y + 'px';
    var pick = $('emopick');
    pick.style.left = rect.x + 'px';
    pick.style.top = rect.y - 54 + 'px';
  }

  // Emote button enabled only during play.
  function setEmoteEnabled(on) {
    var btn = $('emobtn');
    btn.style.display = on ? 'flex' : 'none';
    if (!on) closeEmotes();
  }

  function closeEmotes() {
    $('emopick').classList.remove('open');
  }

  function toggleEmotes() {
    $('emopick').classList.toggle('open');
  }

  function showScreen(name) {
    var map = { home: el.home, deck: el.deck, result: el.result, battle: el.hud };
    for (var k in map) map[k].classList.toggle('on', k === name);
    document.body.classList.toggle('in-battle', name === 'battle');
  }

  // ---- setup ----

  function bindHome() {
    el.home.addEventListener('click', function (e) {
      var d = e.target.closest('[data-diff]');
      if (d) return app.onDifficulty(d.getAttribute('data-diff'));
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var a = b.getAttribute('data-act');
      if (a === 'battle') app.onBattle();
      else if (a === 'deck') app.onDeck();
      else if (a === 'mute') app.onMute();
    });
  }

  function bindDeck() {
    // Long press (450 ms, no drag) on any card opens its info sheet.
    el.deck.addEventListener('pointerdown', function (e) {
      var t = e.target.closest('[data-id]');
      if (!t || sheetOpen) { lp = null; return; }
      var id = t.getAttribute('data-id');
      var rec = { x: e.clientX, y: e.clientY, fired: false, timer: 0 };
      rec.timer = setTimeout(function () {
        rec.fired = true;
        openSheet(id);
      }, 450);
      lp = rec;
    });
    el.deck.addEventListener('pointermove', function (e) {
      if (lp && !lp.fired && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 12) {
        clearTimeout(lp.timer);
        lp = null;
      }
    });
    el.deck.addEventListener('pointercancel', function () {
      if (lp) clearTimeout(lp.timer);
      lp = null;
    });

    el.deck.addEventListener('click', function (e) {
      if (lp && lp.fired) { lp = null; return; }
      if (sheetOpen) {
        if (e.target === el.sheetBack || e.target.closest('[data-act="close-sheet"]')) closeSheet();
        return;
      }
      var act = e.target.closest('[data-act]');
      if (act && act.getAttribute('data-act') === 'home') return app.onHome();
      var s = e.target.closest('[data-slot]');
      if (s) return onSlot(parseInt(s.getAttribute('data-slot'), 10));
      var c = e.target.closest('[data-col]');
      if (c) onCol(c.getAttribute('data-id'));
    });
  }

  function bindResult() {
    el.result.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act="ok"]');
      if (b) app.onResultOk();
    });
  }

  function bindHud() {
    el.hud.addEventListener('click', function (e) {
      var em = e.target.closest('[data-emote]');
      if (em) {
        closeEmotes();
        return app.onEmote(em.getAttribute('data-emote'));
      }
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var a = b.getAttribute('data-act');
      if (a === 'pause') app.onPause();
      else if (a === 'resume') app.onResume();
      else if (a === 'forfeit') app.onForfeit();
      else if (a === 'emotes') toggleEmotes();
    });
  }

  function init(handlers) {
    app = handlers;
    el.home = $('home');
    el.deck = $('deck');
    el.result = $('result');
    el.hud = $('hud');

    el.deck.innerHTML =
      '<div class="head"><button class="btn dark sm" data-act="home">Back</button>' +
        '<h2>Deck</h2><div class="pill">Avg <b class="avgv">0.0</b></div></div>' +
      '<div class="panel dslots"></div>' +
      '<div class="scroll"><div class="grid"></div></div>' +
      '<div class="overlay" id="sheet-back"><div class="panel sheet"></div></div>';
    el.slots = el.deck.querySelector('.dslots');
    el.grid = el.deck.querySelector('.grid');
    el.avg = el.deck.querySelector('.avgv');
    el.sheetBack = $('sheet-back');
    el.sheet = el.sheetBack.querySelector('.sheet');

    el.hud.innerHTML =
      '<button class="hudbtn" data-act="pause" aria-label="Pause">' +
        '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1.2"/>' +
        '<rect x="14" y="5" width="4" height="14" rx="1.2"/></svg></button>' +
      '<div class="cd" id="cd"></div>' +
      '<div class="intro" id="intro"></div>' +
      '<div class="banner" id="banner"></div>' +
      '<button class="emobtn" id="emobtn" data-act="emotes" aria-label="Emotes">😀</button>' +
      '<div class="emopick" id="emopick">' +
        EMOTES.map(function (em) {
          return '<button data-emote="' + em + '">' + em + '</button>';
        }).join('') +
      '</div>' +
      '<div class="overlay" id="pause"><div class="panel pmenu">' +
        '<button class="btn gold" data-act="resume">Resume</button>' +
        '<button class="btn red" data-act="forfeit">Forfeit</button>' +
      '</div></div>';
    el.pause = $('pause');

    bindHome();
    bindDeck();
    bindResult();
    bindHud();
  }

  return {
    init: init,
    showScreen: showScreen,
    renderHome: renderHome,
    openDeck: openDeck,
    showResult: showResult,
    setPaused: setPaused,
    setCountdown: setCountdown,
    showIntro: showIntro,
    showBanner: showBanner,
    layoutHud: layoutHud,
    setEmoteEnabled: setEmoteEnabled,
    EMOTES: EMOTES
  };
})();
