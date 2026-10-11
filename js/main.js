// App shell: profile persistence, screen flow, battle loop and input.
// Uses CR.Game, CR.AI, CR.Renderer, CR.Audio and CR.UI.
(function () {
  'use strict';

  var KEY = 'clashai.v1';
  var STEP = 1 / 30;
  var MAX_STEPS = 5;       // simulation steps per frame, caps catch-up after a stall
  var COUNTDOWN = 3;       // seconds before the first step
  var OVER_DELAY = 2.5;    // seconds the final frames stay on screen before the result
  var TROPHY = { win: 30, loss: -20, draw: 0 };
  var EVENT_SOUND = { deploy: 'deploy', hit: 'hit', spell: 'spell', towerDown: 'towerDown', kingActivate: 'king' };
  var DIFFS = ['easy', 'normal', 'hard'];
  var DRAG_SLOP = 10;      // css px a press must travel before it counts as a drag
  var INTRO_S = 1.5;       // VS splash length
  var FIGHT_S = 0.9;       // "Fight!" stays on screen this long
  var EMOTE_S = 2;         // speech bubble lifetime, game seconds
  var AI_EMOTE_GAP = 6;    // minimum game seconds between opponent emotes

  // Haptics come from the iOS app shell. In a browser there is no handler, so the call is a no-op.
  CR.haptic = function (kind) {
    try { window.webkit.messageHandlers.haptic.postMessage(kind); } catch (e) {}
  };

  var canvas = null;
  var probe = null;
  var renderer = null;
  var profile = null;

  var game = null;
  var ai = null;
  var battle = null;      // per-battle bookkeeping (see startBattle), null otherwise
  var phase = 'idle';     // idle | intro | countdown | play | paused | over
  var cdLeft = 0;
  var cdShown = 0;
  var overT = 0;
  var introT = 0;
  var fightT = 0;
  var acc = 0;
  var last = 0;
  var raf = 0;
  var uiState = { selected: -1, drag: null, team: 0, emote: [null, null] };
  var ptr = null;         // current pointer gesture on the canvas

  // ---- profile ----

  function hasCard(id) {
    return Object.prototype.hasOwnProperty.call(CR.CARDS, id);
  }

  function validDeck(d) {
    if (!Array.isArray(d) || d.length !== 8) return false;
    var seen = {};
    for (var i = 0; i < d.length; i++) {
      var id = d[i];
      if (typeof id !== 'string' || !hasCard(id) || seen[id]) return false;
      seen[id] = true;
    }
    return true;
  }

  function count(v) {
    var n = Math.floor(Number(v));
    return isFinite(n) && n > 0 ? n : 0;
  }

  function defaultProfile() {
    return {
      deck: CR.DEFAULT_DECK.slice(),
      trophies: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      difficulty: 'normal',
      muted: false
    };
  }

  function loadProfile() {
    var p = defaultProfile();
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && typeof s === 'object') {
        if (validDeck(s.deck)) p.deck = s.deck.slice();
        p.trophies = count(s.trophies);
        p.wins = count(s.wins);
        p.losses = count(s.losses);
        p.draws = count(s.draws);
        if (DIFFS.indexOf(s.difficulty) >= 0) p.difficulty = s.difficulty;
        p.muted = s.muted === true;
      }
    } catch (e) {
      // Storage blocked or value corrupt: keep defaults.
    }
    return p;
  }

  function saveProfile() {
    try {
      localStorage.setItem(KEY, JSON.stringify(profile));
    } catch (e) {
      // Storage unavailable: play on without saving.
    }
  }

  // ---- screens ----

  function goHome() {
    phase = 'idle';
    CR.UI.renderHome(profile);
    CR.UI.showScreen('home');
  }

  // ---- layout ----

  function readInsets() {
    var cs = getComputedStyle(probe);
    return {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0
    };
  }

  function layout() {
    if (!renderer) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    renderer.resize(window.innerWidth, window.innerHeight, dpr, readInsets());
    CR.UI.layoutHud(renderer.emoteRect);
  }

  // ---- battle ----

  function startBattle() {
    if (!renderer) renderer = new CR.Renderer(canvas);
    var aiDeck = CR.AI_DECKS[Math.floor(Math.random() * CR.AI_DECKS.length)].slice();
    game = new CR.Game({
      decks: [profile.deck.slice(), aiDeck],
      seed: Math.floor(Math.random() * 1e9)
    });
    ai = new CR.AI(game, 1, { difficulty: profile.difficulty });
    // Handle for console debugging and automated playtests.
    CR.current = { game: game, ai: ai, uiState: uiState };
    var oppTrophies = Math.max(0, profile.trophies + Math.floor(Math.random() * 61) - 30);
    battle = {
      prevElixir: game.players[0].elixir,
      crowns: [0, 0],
      lastPhase: 'regulation',
      s60: false,
      lastBig: -1,
      lastAiEmote: -1e9,
      endSaid: false,
      oppTrophies: oppTrophies
    };

    uiState.selected = -1;
    uiState.drag = null;
    uiState.emote = [null, null];
    ptr = null;
    acc = 0;
    cdLeft = COUNTDOWN;
    cdShown = 0;
    introT = INTRO_S;
    fightT = 0;
    phase = 'intro';

    layout();
    CR.UI.setEmoteEnabled(false);
    CR.UI.setCountdown('');
    CR.UI.showScreen('battle');
    CR.UI.showIntro(profile.trophies, oppTrophies);
  }

  function playEvents(evs) {
    if (!evs || !evs.length) return;
    var seen = {};
    for (var i = 0; i < evs.length; i++) {
      if (evs[i].type === 'towerDown') CR.haptic('heavy');
      var name = EVENT_SOUND[evs[i].type];
      if (name && !seen[name]) {
        seen[name] = true;
        CR.Audio.play(name);
      }
    }
  }

  function stepOnce() {
    game.update(STEP);
    ai.update(STEP);
    playEvents(game.events);
    aiEmotes(game.events);
    var e = game.players[0].elixir;
    if (battle.prevElixir < 10 && e >= 10) CR.Audio.play('elixirFull');
    battle.prevElixir = e;
    for (var t = 0; t < 2; t++) {
      var c = game.players[t].crowns | 0;
      if (c > battle.crowns[t]) CR.Audio.play('crown');
      battle.crowns[t] = c;
    }
  }

  // Speech bubble over a King Tower for EMOTE_S game seconds.
  function emote(team, em) {
    uiState.emote[team] = { emoji: em, until: game.time + EMOTE_S };
    CR.Audio.play('emote');
  }

  // Opponent emotes: smug when it takes a tower, angry when it loses one. Rate-limited.
  function aiEmotes(evs) {
    if (!evs || !evs.length) return;
    for (var i = 0; i < evs.length; i++) {
      if (evs[i].type !== 'towerDown') continue;
      if (game.time - battle.lastAiEmote < AI_EMOTE_GAP) return;
      battle.lastAiEmote = game.time;
      emote(1, evs[i].team === 0 ? '😀' : '😡');
      return;
    }
  }

  // Player emote button. Ignored outside live play.
  function onEmote(em) {
    if (phase !== 'play' || !game) return;
    emote(0, em);
  }

  // Timed banners and the final-10-seconds countdown. Runs once per frame while playing.
  function timedCues() {
    var r = game.result;
    if (r) return;
    var lp = battle.lastPhase;
    var left = game.timeLeft;
    if (game.phase === 'overtime' && lp !== 'overtime') {
      CR.UI.showBanner('Overtime', 'Sudden death', 'red');
      CR.Audio.play('overtime');
      battle.lastBig = -1;
    }
    battle.lastPhase = game.phase;
    if (game.phase === 'regulation' && !battle.s60 && left <= 60) {
      battle.s60 = true;
      CR.UI.showBanner('60 seconds left', '2x Elixir', 'purple');
      CR.Audio.play('banner');
    }
    if (game.phase === 'overtime' && !battle.ot60 && left <= 60) {
      battle.ot60 = true;
      CR.UI.showBanner('3x Elixir', '', 'purple');
      CR.Audio.play('banner');
    }
    // Big numbers for the final 10 seconds of regulation and overtime.
    if (left > 0 && left <= 10) {
      var n = Math.ceil(left);
      if (n !== battle.lastBig) {
        battle.lastBig = n;
        CR.UI.setCountdown(n, 'big');
        CR.Audio.play('tick');
      }
    } else if (battle.lastBig !== -1 && left > 10) {
      battle.lastBig = -1;
      CR.UI.setCountdown('');
    }
  }

  // Outcome cue: the opponent's emote and a final sound, once.
  function endCues() {
    if (battle.endSaid) return;
    battle.endSaid = true;
    var w = game.result.winner;
    emote(1, w === 1 ? '😀' : w === 0 ? '😭' : '😡');
  }

  // Stores the outcome, updates the profile and shows the result screen.
  function applyResult(outcome, crownsArr, reason) {
    phase = 'idle';
    battle = null;
    game = null;
    ai = null;
    ptr = null;
    uiState.drag = null;
    uiState.selected = -1;
    CR.UI.setPaused(false);
    CR.UI.setCountdown('');

    var before = profile.trophies;
    profile.trophies = Math.max(0, before + TROPHY[outcome]);
    if (outcome === 'win') profile.wins++;
    else if (outcome === 'loss') profile.losses++;
    else profile.draws++;
    saveProfile();

    if (outcome === 'win') {
      CR.Audio.play('win');
      CR.haptic('success');
    } else if (outcome === 'loss') {
      CR.Audio.play('lose');
      CR.haptic('error');
    }

    CR.UI.showResult({
      outcome: outcome,
      crowns: crownsArr,
      trophies: profile.trophies,
      before: before,
      delta: profile.trophies - before,
      reason: reason
    });
  }

  function finishBattle() {
    var r = game.result;
    var outcome = r.winner === 0 ? 'win' : r.winner === 1 ? 'loss' : 'draw';
    applyResult(outcome, r.crowns.slice(), r.reason);
  }

  function pause() {
    if (phase !== 'play') return;
    phase = 'paused';
    ptr = null;
    uiState.drag = null;
    CR.UI.setPaused(true);
  }

  function resume() {
    if (phase !== 'paused') return;
    phase = 'play';
    acc = 0;
    CR.UI.setPaused(false);
  }

  function forfeit() {
    if (!battle || (phase !== 'play' && phase !== 'paused' && phase !== 'countdown')) return;
    var p = game.players;
    applyResult('loss', [p[0].crowns, p[1].crowns], 'forfeit');
  }

  // ---- input ----

  function local(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function snap(v) {
    return Math.round(v * 2) / 2;
  }

  // Deploy hand card idx at the screen point p. Failure plays the error sound and keeps the selection.
  function deployAt(idx, p) {
    var t = renderer.screenToTile(p.x, p.y);
    var x = Math.min(CR.ARENA.W, Math.max(0, snap(t.x)));
    var y = Math.min(CR.ARENA.H, Math.max(0, snap(t.y)));
    if (game.deploy(0, idx, x, y)) {
      uiState.selected = -1;
      CR.Audio.play('deploy');
      CR.haptic('light');
    } else {
      CR.Audio.play('error');
      CR.haptic('error');
    }
  }

  function onDown(e) {
    if (phase !== 'play') return;
    e.preventDefault();
    var p = local(e);
    var idx = renderer.hitTestCard(p.x, p.y);
    if (idx >= 0) {
      // Press selects the card. A tap on an already selected card deselects it on release.
      ptr = { id: e.pointerId, card: idx, wasSel: uiState.selected === idx, x0: p.x, y0: p.y, moved: false, dragging: false };
      uiState.selected = idx;
    } else if (renderer.isInArena(p.x, p.y)) {
      ptr = { id: e.pointerId, card: -1, x0: p.x, y0: p.y, moved: false, dragging: false };
    } else {
      ptr = null;
      return;
    }
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not supported: ignore */ }
  }

  function onMove(e) {
    if (!ptr || e.pointerId !== ptr.id) return;
    var p = local(e);
    if (!ptr.moved && Math.hypot(p.x - ptr.x0, p.y - ptr.y0) > DRAG_SLOP) ptr.moved = true;
    if (ptr.card >= 0 && ptr.moved) {
      ptr.dragging = true;
      uiState.drag = { x: p.x, y: p.y };
    }
  }

  function onUp(e) {
    if (!ptr || e.pointerId !== ptr.id) return;
    var p = local(e);
    // A fast flick can arrive with no pointermove in between, so judge the drag by the release point.
    if (ptr.card >= 0 && !ptr.dragging && Math.hypot(p.x - ptr.x0, p.y - ptr.y0) > DRAG_SLOP) ptr.dragging = true;
    if (ptr.card >= 0) {
      if (ptr.dragging) {
        uiState.drag = null;
        if (renderer.isInArena(p.x, p.y)) deployAt(ptr.card, p);
      } else {
        uiState.selected = ptr.wasSel ? -1 : ptr.card;
      }
    } else if (!ptr.moved && uiState.selected >= 0) {
      deployAt(uiState.selected, p);
    }
    ptr = null;
  }

  function onCancel() {
    uiState.drag = null;
    ptr = null;
  }

  // ---- loop ----

  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = last ? Math.min(0.25, (now - last) / 1000) : 0;
    last = now;

    if (phase === 'intro') {
      introT -= dt;
      if (introT <= 0) {
        phase = 'countdown';
        cdLeft = COUNTDOWN;
        cdShown = 0;
      }
    } else if (phase === 'countdown') {
      cdLeft -= dt;
      if (cdLeft <= 0) {
        phase = 'play';
        acc = 0;
        fightT = FIGHT_S;
        CR.UI.setCountdown('Fight!', 'fight');
        CR.Audio.play('fight');
        CR.UI.setEmoteEnabled(true);
      } else {
        var n = Math.ceil(cdLeft);
        if (n !== cdShown) {
          cdShown = n;
          CR.UI.setCountdown(n, 'big');
          CR.Audio.play('tick');
        }
      }
    } else if (phase === 'play') {
      if (fightT > 0) {
        fightT -= dt;
        if (fightT <= 0) CR.UI.setCountdown('');
      }
      acc += dt;
      var steps = 0;
      while (acc >= STEP && steps < MAX_STEPS && !game.result) {
        stepOnce();
        acc -= STEP;
        steps++;
      }
      if (steps === MAX_STEPS) acc = 0;
      if (!game.result) timedCues();
      if (game.result) {
        phase = 'over';
        overT = 0;
        CR.UI.setEmoteEnabled(false);
        CR.UI.setCountdown('');
        endCues();
      }
    } else if (phase === 'over') {
      overT += dt;
      if (overT >= OVER_DELAY) finishBattle();
    }

    if (battle && renderer) renderer.draw(game, uiState);
  }

  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
      pause();
    } else if (!raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  function prevent(e) {
    e.preventDefault();
  }

  // ---- boot ----

  function boot() {
    canvas = document.getElementById('game');
    probe = document.getElementById('probe');
    profile = loadProfile();
    CR.Audio.setMuted(profile.muted);

    CR.UI.init({
      onBattle: startBattle,
      onDeck: function () { CR.UI.openDeck(profile.deck); },
      onHome: goHome,
      onDifficulty: function (d) {
        profile.difficulty = d;
        saveProfile();
        CR.UI.renderHome(profile);
      },
      onMute: function () {
        profile.muted = !profile.muted;
        CR.Audio.setMuted(profile.muted);
        saveProfile();
        CR.UI.renderHome(profile);
      },
      onDeckChange: function (d) {
        profile.deck = d;
        saveProfile();
      },
      onPause: pause,
      onResume: resume,
      onForfeit: forfeit,
      onEmote: onEmote,
      onResultOk: goHome
    });
    goHome();

    // Audio needs a user gesture before it can start.
    var unlock = function () { CR.Audio.unlock(); };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('touchstart', prevent, { passive: false });
    canvas.addEventListener('touchend', prevent, { passive: false });

    // Stop iOS scrolling, pinch zoom and callouts. Scrollable lists opt out with class "scroll".
    document.addEventListener('touchmove', function (e) {
      if (!(e.target.closest && e.target.closest('.scroll'))) e.preventDefault();
    }, { passive: false });
    document.addEventListener('gesturestart', prevent, { passive: false });
    document.addEventListener('contextmenu', prevent);

    window.addEventListener('resize', layout);
    window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
    document.addEventListener('visibilitychange', onVisibility);

    raf = requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
