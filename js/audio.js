// Sound effects: a tiny WebAudio synth, no audio files.
// Safe to load in Node: nothing touches window or AudioContext until a sound plays.
var CR = (globalThis.CR = globalThis.CR || {});

CR.Audio = (function () {
  'use strict';

  var VOLUME = 0.5;
  var HIT_LIMIT = 12; // hit sounds per second, the rest are dropped
  var ctx = null;
  var master = null;
  var muted = false;
  var hitTimes = [];

  // Note: f start freq, f2 optional end freq (sweep), type, dur seconds, v peak gain, d delay seconds.
  var SOUNDS = {
    deploy: [{ f: 520, f2: 700, type: 'sine', dur: 0.09, v: 0.10 }],
    hit: [{ f: 260, f2: 200, type: 'triangle', dur: 0.05, v: 0.06 }],
    spell: [
      { f: 330, f2: 880, type: 'sawtooth', dur: 0.22, v: 0.04 },
      { f: 660, type: 'sine', dur: 0.20, v: 0.04, d: 0.08 }
    ],
    towerDown: [
      { f: 330, type: 'square', dur: 0.25, v: 0.04 },
      { f: 247, type: 'square', dur: 0.30, v: 0.04, d: 0.18 },
      { f: 165, type: 'triangle', dur: 0.50, v: 0.08, d: 0.36 }
    ],
    king: [
      { f: 392, type: 'triangle', dur: 0.20, v: 0.07 },
      { f: 523, type: 'triangle', dur: 0.20, v: 0.07, d: 0.15 },
      { f: 784, type: 'triangle', dur: 0.45, v: 0.08, d: 0.30 }
    ],
    win: [
      { f: 523, type: 'sine', dur: 0.14, v: 0.08 },
      { f: 659, type: 'sine', dur: 0.14, v: 0.08, d: 0.12 },
      { f: 784, type: 'sine', dur: 0.14, v: 0.08, d: 0.24 },
      { f: 1047, type: 'sine', dur: 0.40, v: 0.08, d: 0.36 }
    ],
    lose: [
      { f: 392, type: 'triangle', dur: 0.30, v: 0.07 },
      { f: 330, type: 'triangle', dur: 0.30, v: 0.07, d: 0.20 },
      { f: 294, type: 'triangle', dur: 0.30, v: 0.07, d: 0.40 },
      { f: 262, type: 'triangle', dur: 0.45, v: 0.07, d: 0.60 }
    ],
    error: [
      { f: 150, type: 'square', dur: 0.12, v: 0.04 },
      { f: 120, type: 'square', dur: 0.12, v: 0.04, d: 0.06 }
    ],
    tick: [{ f: 1000, type: 'sine', dur: 0.05, v: 0.05 }],
    elixirFull: [
      { f: 880, type: 'sine', dur: 0.08, v: 0.05 },
      { f: 1320, type: 'sine', dur: 0.12, v: 0.05, d: 0.09 }
    ],
    // Intro splash and banners.
    vs: [
      { f: 220, f2: 660, type: 'sawtooth', dur: 0.35, v: 0.04 },
      { f: 880, type: 'triangle', dur: 0.2, v: 0.06, d: 0.3 }
    ],
    fight: [
      { f: 523, type: 'square', dur: 0.12, v: 0.05 },
      { f: 784, type: 'square', dur: 0.12, v: 0.05, d: 0.1 },
      { f: 1047, type: 'square', dur: 0.3, v: 0.06, d: 0.2 }
    ],
    banner: [{ f: 300, f2: 900, type: 'triangle', dur: 0.25, v: 0.05 }],
    overtime: [
      { f: 392, type: 'sawtooth', dur: 0.25, v: 0.05 },
      { f: 311, type: 'sawtooth', dur: 0.25, v: 0.05, d: 0.25 },
      { f: 262, type: 'sawtooth', dur: 0.5, v: 0.05, d: 0.5 }
    ],
    // Emote pop and crown earned.
    emote: [{ f: 660, f2: 990, type: 'sine', dur: 0.12, v: 0.06 }],
    crown: [
      { f: 784, type: 'triangle', dur: 0.12, v: 0.07 },
      { f: 1175, type: 'triangle', dur: 0.25, v: 0.07, d: 0.1 }
    ]
  };

  function ensure() {
    if (ctx) return ctx;
    var AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : VOLUME;
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
      master = null;
    }
    return ctx;
  }

  function note(n, t0) {
    var start = t0 + (n.d || 0);
    var end = start + n.dur;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = n.type || 'sine';
    osc.frequency.setValueAtTime(n.f, start);
    if (n.f2) osc.frequency.exponentialRampToValueAtTime(n.f2, end);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(n.v, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(end + 0.02);
  }

  function allowHit(now) {
    while (hitTimes.length && now - hitTimes[0] > 1000) hitTimes.shift();
    if (hitTimes.length >= HIT_LIMIT) return false;
    hitTimes.push(now);
    return true;
  }

  return {
    // Call from a user gesture so iOS allows audio output.
    unlock: function () {
      var c = ensure();
      if (c && c.state === 'suspended') {
        try { c.resume(); } catch (e) { /* ignore */ }
      }
    },

    play: function (name) {
      var notes = SOUNDS[name];
      if (!notes || muted) return;
      var c = ensure();
      if (!c) return;
      if (c.state !== 'running') return;
      if (name === 'hit' && !allowHit(Date.now())) return;
      var t0 = c.currentTime + 0.005;
      for (var i = 0; i < notes.length; i++) note(notes[i], t0);
    },

    setMuted: function (m) {
      muted = !!m;
      if (master) master.gain.value = muted ? 0 : VOLUME;
    }
  };
})();
