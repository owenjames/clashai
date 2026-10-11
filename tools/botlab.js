#!/usr/bin/env node
'use strict';

// Bot lab: runs bot and computer-opponent matches headlessly, sweeps bot parameters, runs a
// tournament, and writes gameplay reviews. Node built-ins only. No rendering; dt is 1/30.
//
//   node tools/botlab.js match --bot cycle --vs ai:hard --n 20 [--set offense.aggression=0.9] [--json]
//   node tools/botlab.js sweep --bot cycle --vs ai:normal --param offense.aggression=0:1:0.25 --n 10
//   node tools/botlab.js tournament --n 10
//   node tools/botlab.js review --bot control --vs ai:hard --seed 7
//   node tools/botlab.js schema [--md | --json]
//   node tools/botlab.js presets
//
// --bot takes a preset name or a path to a JSON config (an object with optional "preset" key).
// --vs takes ai:easy|normal|hard, bot:<preset>, or a JSON path.

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var ROOT = path.join(__dirname, '..');
var CR = require(path.join(ROOT, 'js/cards.js'));
require(path.join(ROOT, 'js/engine.js'));
require(path.join(ROOT, 'js/botconfig.js'));
require(path.join(ROOT, 'js/bot.js'));
require(path.join(ROOT, 'js/ai.js'));

var DT = 1 / 30;
var MAX_STEPS = Math.ceil((180 + 120 + 30) / DT);
var AI_LEVELS = ['easy', 'normal', 'hard'];
var REVIEW_DIR = path.join(ROOT, 'docs', 'reviews');
var RIVER_TOP = CR.ARENA.RIVER_TOP;
var RIVER_BOTTOM = CR.ARENA.RIVER_BOTTOM;
var W = CR.ARENA.W;
var H = CR.ARENA.H;

// ---- small helpers ------------------------------------------------------

function die(msg) {
  process.stderr.write('botlab: ' + msg + '\n');
  process.exit(2);
}

function parseArgs(argv) {
  var out = { _: [], set: [], param: [] };
  for (var i = 0; i < argv.length; i++) {
    var a = argv[i];
    if (a.indexOf('--') !== 0) { out._.push(a); continue; }
    var eq = a.indexOf('=');
    var key = eq >= 0 ? a.slice(2, eq) : a.slice(2);
    var val = eq >= 0 ? a.slice(eq + 1) : null;
    if (key === 'json' || key === 'md' || key === 'help') { out[key] = true; continue; }
    if (val === null) {
      if (i + 1 >= argv.length) die('missing value for --' + key);
      val = argv[++i];
    }
    if (key === 'set' || key === 'param') out[key].push(val);
    else out[key] = val;
  }
  return out;
}

function splitKV(s, what) {
  var i = s.indexOf('=');
  if (i < 0) die(what + ' must look like key=value, got "' + s + '"');
  return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
}

function num(v, def, name) {
  if (v === undefined || v === null) return def;
  var n = Number(v);
  if (!isFinite(n)) die(name + ' must be a number');
  return n;
}

function mean(xs) {
  if (!xs.length) return 0;
  var s = 0;
  for (var i = 0; i < xs.length; i++) s += xs[i];
  return s / xs.length;
}

function mmss(t) {
  var m = Math.floor(t / 60), s = t - m * 60;
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function dist(ax, ay, bx, by) {
  var dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function fyOf(team, y) { return team === 1 ? y : H - y; }

// Fingerprint of the game code a run used, so saved outputs can be traced to a version.
function snapshotId() {
  var h = crypto.createHash('sha1');
  ['js/engine.js', 'js/cards.js', 'js/ai.js', 'js/bot.js', 'js/botconfig.js'].forEach(function (f) {
    h.update(fs.readFileSync(path.join(ROOT, f)));
  });
  return h.digest('hex').slice(0, 10);
}
var SNAP = snapshotId();

// Wilson score interval, 95 percent by default. Returns [low, high] as fractions.
function wilson(k, n, z) {
  z = z || 1.96;
  if (!n) return [0, 0];
  var p = k / n;
  var z2 = z * z;
  var denom = 1 + z2 / n;
  var centre = (p + z2 / (2 * n)) / denom;
  var half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

function pct(x) { return (x * 100).toFixed(1) + '%'; }
function f1(x) { return (Math.round(x * 10) / 10).toFixed(1); }
function f2(x) { return (Math.round(x * 100) / 100).toFixed(2); }

// Plain text table. columns: [{ key, label, align }], rows: objects.
function renderTable(columns, rows) {
  var widths = columns.map(function (c) { return c.label.length; });
  var cells = rows.map(function (r) {
    return columns.map(function (c, i) {
      var v = String(r[c.key] === undefined ? '' : r[c.key]);
      if (v.length > widths[i]) widths[i] = v.length;
      return v;
    });
  });
  function line(vals) {
    return vals.map(function (v, i) {
      var w = widths[i];
      return columns[i].align === 'l' ? (v + ' '.repeat(w - v.length)) : (' '.repeat(w - v.length) + v);
    }).join('  ');
  }
  var out = [line(columns.map(function (c) { return c.label; }))];
  out.push(widths.map(function (w) { return '-'.repeat(w); }).join('  '));
  cells.forEach(function (c) { out.push(line(c)); });
  return out.join('\n');
}

// ---- competitors ---------------------------------------------------------

function readJson(p) {
  var full = path.resolve(p);
  if (!fs.existsSync(full)) die('no such file: ' + p);
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (e) {
    die('bad JSON in ' + p + ': ' + e.message);
  }
  return null;
}

function applySets(cfg, sets) {
  sets.forEach(function (s) {
    var kv = splitKV(s, '--set');
    try { CR.botSet(cfg, kv[0], kv[1]); } catch (e) { die(e.message); }
  });
  return cfg;
}

function resolveBot(str, sets) {
  var cfg, name;
  if (/\.json$/i.test(str) || fs.existsSync(str)) {
    var obj = readJson(str);
    name = path.basename(str).replace(/\.json$/i, '');
    try { cfg = CR.botConfig(obj); } catch (e) { die(e.message); }
  } else {
    name = str.replace(/^bot:/, '');
    try { cfg = CR.botConfig(name); } catch (e) { die(e.message); }
  }
  applySets(cfg, sets || []);
  var probs = CR.botProblems(cfg);
  if (probs.length) die('invalid bot config ' + name + ': ' + probs.join('; '));
  return { kind: 'bot', name: 'bot:' + name, short: name, config: cfg };
}

function resolveCompetitor(str, sets) {
  if (/^ai:/i.test(str)) {
    var d = str.slice(3).toLowerCase();
    if (AI_LEVELS.indexOf(d) < 0) die('ai level must be easy, normal or hard, got ' + d);
    return { kind: 'ai', name: 'ai:' + d, short: 'AI ' + d, difficulty: d };
  }
  return resolveBot(str.replace(/^bot:/, ''), sets);
}

// ---- simulation core ----------------------------------------------------

function botSeedFor(comp, seed, matchIndex) {
  return ((comp.config.general.seed | 0) + seed * 17 + matchIndex * 101 + 1) >>> 0;
}

// comps: [competitor for team 0, competitor for team 1]. hook (optional): called every step.
function simulate(comps, seed, matchIndex, hook) {
  var matchSeed = (seed * 100003 + matchIndex * 7 + 1) >>> 0;
  var decks = comps.map(function (c) {
    if (c.kind === 'bot') return CR.botDeck(c.config);
    return CR.AI_DECKS[matchIndex % CR.AI_DECKS.length].slice();
  });
  var game = new CR.Game({ decks: decks, seed: matchSeed });
  var ctl = comps.map(function (c, team) {
    if (c.kind === 'bot') {
      var cfg = CR.botConfig(c.config);
      cfg.general.seed = botSeedFor(c, seed, matchIndex);
      return new CR.Bot(game, team, cfg);
    }
    return new CR.AI(game, team, { difficulty: c.difficulty, seed: matchSeed });
  });

  var towers = game.entities.filter(function (e) { return e.kind === 'tower'; });
  var towerHp = new Map();
  towers.forEach(function (tw) { towerHp.set(tw, tw.hp); });

  var leak = [0, 0], dmgDealt = [0, 0], cards = [0, 0], spent = [0, 0];
  var sawOT = false, steps = 0;
  if (hook && hook.start) hook.start(game, ctl);

  while (game.phase !== 'ended' && steps < MAX_STEPS) {
    game.update(DT);
    for (var c = 0; c < 2; c++) ctl[c].update(DT);

    for (var t = 0; t < 2; t++) {
      if (game.players[t].elixir >= 9.99) leak[t] += DT;
    }
    towers.forEach(function (tw) {
      var hp0 = towerHp.get(tw);
      var drop = hp0 - tw.hp;
      if (drop > 0) dmgDealt[1 - tw.team] += drop;
      towerHp.set(tw, tw.hp);
    });
    game.events.forEach(function (ev) {
      if (ev.type === 'deploy') {
        cards[ev.team]++;
        var card = CR.CARDS[ev.cardId];
        if (card) spent[ev.team] += card.cost;
      }
    });
    if (game.phase === 'overtime') sawOT = true;
    if (hook && hook.step) hook.step(game, ctl, steps);
    steps++;
  }
  if (hook && hook.end) hook.end(game, ctl, steps);

  var res = game.result;
  return {
    game: game, ctl: ctl, decks: decks,
    winner: res ? res.winner : -1,
    reason: res ? res.reason : 'timeout',
    crowns: [game.players[0].crowns, game.players[1].crowns],
    duration: game.time,
    overtime: sawOT,
    leak: leak, dmgDealt: dmgDealt, cards: cards, spent: spent,
  };
}

// One match from the point of view of competitor A. A plays team 0 on even match indices, team 1 on odd.
function playMatch(A, B, seed, matchIndex) {
  var aTeam = matchIndex % 2 === 0 ? 0 : 1;
  var bTeam = 1 - aTeam;
  var comps = [];
  comps[aTeam] = A;
  comps[bTeam] = B;
  var r = simulate(comps, seed, matchIndex, null);
  var outcome = r.winner === aTeam ? 'W' : r.winner === -1 ? 'D' : 'L';
  var rec = {
    index: matchIndex,
    aSide: aTeam,
    outcome: outcome,
    reason: r.reason,
    duration: round2(r.duration),
    overtime: r.overtime,
    crownsFor: r.crowns[aTeam],
    crownsAgainst: r.crowns[bTeam],
    towerDmgFor: round1(r.dmgDealt[aTeam]),
    towerDmgAgainst: round1(r.dmgDealt[bTeam]),
    leakFor: round2(r.leak[aTeam]),
    leakAgainst: round2(r.leak[bTeam]),
    cardsFor: r.cards[aTeam],
    cardsAgainst: r.cards[bTeam],
    spentFor: r.spent[aTeam],
    spentAgainst: r.spent[bTeam],
  };
  if (r.ctl[aTeam].stats) rec.botStats = copyStats(r.ctl[aTeam].stats);
  return rec;
}

function round1(x) { return Math.round(x * 10) / 10; }
function round2(x) { return Math.round(x * 100) / 100; }
function copyStats(s) {
  var o = {};
  Object.keys(s).forEach(function (k) { o[k] = round2(s[k]); });
  return o;
}

function summarise(recs) {
  var n = recs.length;
  var w = 0, l = 0, d = 0;
  recs.forEach(function (r) {
    if (r.outcome === 'W') w++;
    else if (r.outcome === 'L') l++;
    else d++;
  });
  var ci = wilson(w, n);
  var ot = recs.filter(function (r) { return r.overtime; }).length;
  var minutes = recs.reduce(function (s, r) { return s + r.duration / 60; }, 0);
  var out = {
    n: n, wins: w, losses: l, draws: d,
    winRate: n ? w / n : 0,
    ciLow: ci[0], ciHigh: ci[1],
    crownsFor: mean(recs.map(function (r) { return r.crownsFor; })),
    crownsAgainst: mean(recs.map(function (r) { return r.crownsAgainst; })),
    towerDmgFor: mean(recs.map(function (r) { return r.towerDmgFor; })),
    towerDmgAgainst: mean(recs.map(function (r) { return r.towerDmgAgainst; })),
    leakSeconds: mean(recs.map(function (r) { return r.leakFor; })),
    cardsPerMin: minutes ? recs.reduce(function (s, r) { return s + r.cardsFor; }, 0) / minutes : 0,
    avgLength: mean(recs.map(function (r) { return r.duration; })),
    overtimeRate: n ? ot / n : 0,
  };
  var bs = recs.filter(function (r) { return r.botStats; });
  if (bs.length) {
    out.botStats = {};
    Object.keys(bs[0].botStats).forEach(function (k) {
      out.botStats[k] = round2(mean(bs.map(function (r) { return r.botStats[k]; })));
    });
  }
  return out;
}

function matchupRows(sum) {
  return [{
    W: sum.wins, L: sum.losses, D: sum.draws,
    winrate: pct(sum.winRate),
    ci: '[' + pct(sum.ciLow) + ', ' + pct(sum.ciHigh) + ']',
    cf: f2(sum.crownsFor), ca: f2(sum.crownsAgainst),
    tdf: f1(sum.towerDmgFor), tda: f1(sum.towerDmgAgainst),
    leak: f1(sum.leakSeconds),
    cpm: f1(sum.cardsPerMin),
    len: mmss(sum.avgLength),
    ot: pct(sum.overtimeRate),
  }];
}

var MATCHUP_COLS = [
  { key: 'W', label: 'W', align: 'r' }, { key: 'L', label: 'L', align: 'r' }, { key: 'D', label: 'D', align: 'r' },
  { key: 'winrate', label: 'Win rate', align: 'r' }, { key: 'ci', label: '95% CI', align: 'r' },
  { key: 'cf', label: 'Crowns for', align: 'r' }, { key: 'ca', label: 'Crowns vs', align: 'r' },
  { key: 'tdf', label: 'Tower dmg for', align: 'r' }, { key: 'tda', label: 'Tower dmg vs', align: 'r' },
  { key: 'leak', label: 'Leak s', align: 'r' }, { key: 'cpm', label: 'Cards/min', align: 'r' },
  { key: 'len', label: 'Avg length', align: 'r' }, { key: 'ot', label: 'OT rate', align: 'r' },
];

var BOT_STAT_KEYS = [
  'cardsPlayed', 'elixirSpent', 'leakSeconds', 'spellsCast', 'spellValueEst', 'spellValueHit',
  'spellUnitsHit', 'spellKills', 'defenses', 'kitePlays', 'pushesStarted', 'baitPlays', 'supportPlays',
  'forcedPlays', 'idlePlays', 'randomPlays', 'towerDamage',
];

function botStatsTable(stats) {
  return BOT_STAT_KEYS.filter(function (k) { return stats[k] !== undefined; }).map(function (k) {
    return { stat: k, value: f2(stats[k]) };
  });
}

// ---- output -------------------------------------------------------------

function emit(obj, text, asJson) {
  if (asJson) process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  else process.stdout.write(text + '\n');
}

function needN(args) {
  var n = Math.floor(num(args.n, 10, '--n'));
  if (n < 1) die('--n must be at least 1');
  return n;
}

// ---- commands -----------------------------------------------------------

function cmdMatch(args) {
  if (!args.bot) die('match needs --bot <preset|file.json|ai:level>');
  var A = resolveCompetitor(args.bot, args.set);
  var B = resolveCompetitor(args.vs || 'ai:normal', args.set);
  var n = needN(args), seed = Math.floor(num(args.seed, 1, '--seed'));
  var recs = [];
  for (var i = 0; i < n; i++) recs.push(playMatch(A, B, seed, i));
  var sum = summarise(recs);
  var text = (A.kind === 'bot' ? 'Bot ' : '') + A.short + ' vs ' + B.short + '   n=' + n + ' seed=' + seed + ' snapshot=' + SNAP + '\n\n' +
    renderTable(MATCHUP_COLS, matchupRows(sum));
  if (sum.botStats) {
    text += '\n\nBot stats (average per match)\n\n' + renderTable(
      [{ key: 'stat', label: 'Stat', align: 'l' }, { key: 'value', label: 'Avg', align: 'r' }],
      botStatsTable(sum.botStats)
    );
  }
  emit({ command: 'match', snapshot: SNAP, bot: A.name, vs: B.name, n: n, seed: seed, summary: sum, matches: recs }, text, !!args.json);
}

function parseParamSpec(spec) {
  var kv = splitKV(spec, '--param');
  var key = kv[0], rhs = kv[1];
  if (!CR.botSchemaEntry(key)) die('unknown bot parameter: ' + key);
  var entry = CR.botSchemaEntry(key);
  var values;
  if (rhs.indexOf(':') >= 0) {
    var parts = rhs.split(':').map(Number);
    if (parts.length !== 3 || parts.some(function (x) { return !isFinite(x); })) die('--param range must be min:max:step');
    var lo = parts[0], hi = parts[1], st = parts[2];
    if (st <= 0) die('--param step must be positive');
    values = [];
    for (var v = lo; v <= hi + st * 1e-9; v += st) values.push(Math.round(v * 1e9) / 1e9);
  } else {
    values = rhs.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }
  if (entry.type === 'bool') values = values.map(function (v) { return CR.botCoerce(key, v); });
  if (!values.length) die('--param ' + key + ' has no values');
  return { key: key, values: values };
}

function cartesian(specs) {
  var out = [{}];
  specs.forEach(function (sp) {
    var next = [];
    out.forEach(function (base) {
      sp.values.forEach(function (v) {
        var o = Object.assign({}, base);
        o[sp.key] = v;
        next.push(o);
      });
    });
    out = next;
  });
  return out;
}

function cmdSweep(args) {
  if (!args.bot) die('sweep needs --bot <preset|file.json>');
  if (!args.param || !args.param.length) die('sweep needs at least one --param key=min:max:step');
  var specs = args.param.map(parseParamSpec);
  var grid = cartesian(specs);
  if (grid.length > 2000) die('grid has ' + grid.length + ' points, narrow the ranges (max 2000)');
  var n = needN(args), seed = Math.floor(num(args.seed, 1, '--seed'));
  var base = resolveBot(args.bot, args.set);
  var B = resolveCompetitor(args.vs || 'ai:normal', []);
  var rows = grid.map(function (point) {
    var cfg = CR.botConfig(base.config);
    Object.keys(point).forEach(function (k) { CR.botSet(cfg, k, point[k]); });
    var A = { kind: 'bot', name: base.name, short: base.short, config: cfg };
    var recs = [];
    for (var i = 0; i < n; i++) recs.push(playMatch(A, B, seed, i));
    var sum = summarise(recs);
    var params = {};
    Object.keys(point).forEach(function (k) { params[k] = point[k]; });
    return {
      params: params, winRate: sum.winRate, ciLow: sum.ciLow, ciHigh: sum.ciHigh,
      wins: sum.wins, losses: sum.losses, draws: sum.draws,
      crownDiff: sum.crownsFor - sum.crownsAgainst, towerDiff: sum.towerDmgFor - sum.towerDmgAgainst,
      overtimeRate: sum.overtimeRate, n: n,
    };
  });
  rows.sort(function (a, b) {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.crownDiff - a.crownDiff;
  });
  var top = Math.max(1, Math.floor(num(args.top, 10, '--top')));
  var keys = specs.map(function (s) { return s.key; });
  var cols = keys.map(function (k) { return { key: k, label: k, align: 'r' }; }).concat([
    { key: 'wl', label: 'W-L-D', align: 'r' }, { key: 'winrate', label: 'Win rate', align: 'r' },
    { key: 'ci', label: '95% CI', align: 'r' }, { key: 'cdiff', label: 'Crown diff', align: 'r' },
    { key: 'tdiff', label: 'Tower dmg diff', align: 'r' },
  ]);
  var table = rows.slice(0, top).map(function (r) {
    var o = { wl: r.wins + '-' + r.losses + '-' + r.draws, winrate: pct(r.winRate), ci: '[' + pct(r.ciLow) + ', ' + pct(r.ciHigh) + ']', cdiff: f2(r.crownDiff), tdiff: f1(r.towerDiff) };
    keys.forEach(function (k) { o[k] = String(r.params[k]); });
    return o;
  });
  var text = 'Sweep: bot ' + base.short + ' vs ' + B.short + '   grid=' + grid.length + ' points, n=' + n + ' per point, seed=' + seed + ', snapshot=' + SNAP +
    '\nBest ' + table.length + ' of ' + rows.length + ' (sorted by win rate, then crown diff)\n\n' + renderTable(cols, table);
  emit({ command: 'sweep', snapshot: SNAP, bot: base.name, vs: B.name, n: n, seed: seed, params: keys, points: rows }, text, !!args.json);
}

function cmdTournament(args) {
  var n = needN(args), seed = Math.floor(num(args.seed, 1, '--seed'));
  var names = Object.keys(CR.BOT_PRESETS);
  var comps = names.map(function (p) { return resolveBot(p, args.set); })
    .concat(AI_LEVELS.map(function (d) { return resolveCompetitor('ai:' + d, []); }));
  var stand = {};
  comps.forEach(function (c) { stand[c.name] = { name: c.name, played: 0, W: 0, D: 0, L: 0, points: 0, cf: 0, ca: 0, tdf: 0, tda: 0, cdn: 0, recs: 0 }; });
  var h2h = {};
  for (var i = 0; i < comps.length; i++) {
    for (var j = i + 1; j < comps.length; j++) {
      var A = comps[i], B = comps[j];
      var recs = [];
      for (var k = 0; k < n; k++) recs.push(playMatch(A, B, seed, k));
      var sa = stand[A.name], sb = stand[B.name];
      recs.forEach(function (r) {
        sa.played++; sb.played++;
        sa.cf += r.crownsFor; sa.ca += r.crownsAgainst; sb.cf += r.crownsAgainst; sb.ca += r.crownsFor;
        sa.tdf += r.towerDmgFor; sa.tda += r.towerDmgAgainst; sb.tdf += r.towerDmgAgainst; sb.tda += r.towerDmgFor;
        if (r.outcome === 'W') { sa.W++; sb.L++; sa.points += 3; }
        else if (r.outcome === 'L') { sa.L++; sb.W++; sb.points += 3; }
        else { sa.D++; sb.D++; sa.points++; sb.points++; }
      });
      var sum = summarise(recs);
      h2h[A.name + '|' + B.name] = sum;
      h2h[B.name + '|' + A.name] = summarise(recs.map(function (r) {
        return Object.assign({}, r, {
          outcome: r.outcome === 'W' ? 'L' : r.outcome === 'L' ? 'W' : 'D',
          crownsFor: r.crownsAgainst, crownsAgainst: r.crownsFor,
          towerDmgFor: r.towerDmgAgainst, towerDmgAgainst: r.towerDmgFor,
        });
      }));
    }
  }
  var table = Object.keys(stand).map(function (k) {
    var s = stand[k];
    var games = s.played || 1;
    return {
      name: s.name, points: s.points, W: s.W, D: s.D, L: s.L,
      winrate: pct((s.W) / games),
      cf: f2(s.cf / games), ca: f2(s.ca / games),
      tdf: f1(s.tdf / games), tda: f1(s.tda / games),
      played: s.played,
    };
  });
  table.sort(function (a, b) {
    if (b.points !== a.points) return b.points - a.points;
    return parseFloat(b.winrate) - parseFloat(a.winrate);
  });
  var cols = [
    { key: 'name', label: 'Competitor', align: 'l' }, { key: 'points', label: 'Pts', align: 'r' },
    { key: 'W', label: 'W', align: 'r' }, { key: 'D', label: 'D', align: 'r' }, { key: 'L', label: 'L', align: 'r' },
    { key: 'winrate', label: 'Win rate', align: 'r' }, { key: 'cf', label: 'Crowns for', align: 'r' },
    { key: 'ca', label: 'Crowns vs', align: 'r' }, { key: 'tdf', label: 'Tower dmg for', align: 'r' },
    { key: 'tda', label: 'Tower dmg vs', align: 'r' }, { key: 'played', label: 'Games', align: 'r' },
  ];
  var names2 = table.map(function (r) { return r.name; });
  var matrixCols = [{ key: 'name', label: 'A \\ B', align: 'l' }].concat(names2.map(function (nm, idx) {
    return { key: 'c' + idx, label: String(idx + 1), align: 'r' };
  }));
  var matrix = names2.map(function (a) {
    var row = { name: (names2.indexOf(a) + 1) + ' ' + a };
    names2.forEach(function (b, idx) {
      if (a === b) row['c' + idx] = '-';
      else {
        var s = h2h[a + '|' + b];
        row['c' + idx] = s ? (s.wins + '-' + s.losses + '-' + s.draws) : '';
      }
    });
    return row;
  });
  var text = 'Tournament: ' + comps.length + ' competitors, n=' + n + ' per pair (' + (comps.length * (comps.length - 1) / 2) +
    ' pairs), seed=' + seed + ', snapshot=' + SNAP + '\nPoints: 3 per win, 1 per draw. Crowns and tower damage are per game.\n\n' +
    renderTable(cols, table) + '\n\nHead to head, row A vs column B, W-L-D from A\'s side:\n\n' +
    renderTable(matrixCols, matrix);
  emit({ command: 'tournament', snapshot: SNAP, n: n, seed: seed, standings: table, headToHead: h2h }, text, !!args.json);
}

// ---- review -------------------------------------------------------------

// Side names in logs and findings: BOT for the subject, AI for the computer opponent, OPP for a bot opponent.
function ownerName(team, botTeam, oppLabel) {
  return team === botTeam ? 'BOT' : oppLabel;
}

function reviewRun(A, B, seed, botTeam) {
  var comps = [];
  comps[botTeam] = A;
  comps[1 - botTeam] = B;
  var aiTeam = 1 - botTeam;
  var logLines = [];
  var findings = { elixir: [], pushes: [], spells: [], units: [], cards: [], engine: [] };
  var played = [new Set(), new Set()];
  var playCount = [0, 0], playsByReason = {};
  var ents = new Map();          // entity -> tracking record
  var projSeen = new Set();
  var noTargetProj = [0, 0];
  var alone = [[], []];
  var wasted = [[], []];
  var stuckIdle = [[], []];
  var riverSeen = [[], []];
  var outOfBounds = [0, 0];
  var episodes = [];             // unanswered tower hits
  var spellPending = [];
  var spellHits = [[0, 0], [0, 0]], spellMiss = [[], []];
  var capStart = [null, null], capIntervals = [[], []];
  var towerHp = new Map();
  var towerList = [];
  var towerNames = new Map();
  var spellImpacts = [];         // { t, x, y }
  var botTrace = null;
  var lastState = -1;
  var ot = null, gameOverT = null;
  var nameOfTower = function (tw) {
    if (tw.towerType === 'king') return 'king tower';
    return (tw.lane === 0 ? 'left' : 'right') + ' princess tower';
  };
  var oppLabel = B.kind === 'ai' ? 'AI' : 'OPP';
  var side = function (team) { return ownerName(team, botTeam, oppLabel); };

  function deployNote(team, cardId, t) {
    if (team !== botTeam || !botTrace) return '';
    var tt = Math.round(t * 100) / 100;
    for (var i = botTrace.length - 1; i >= 0; i--) {
      var e = botTrace[i];
      if (e.t === tt && e.card === cardId) return ' (' + e.reason + ')';
      if (e.t < tt - 0.5) break;
    }
    return '';
  }

  function stateLine(game) {
    var p0 = game.players[0], p1 = game.players[1];
    var towers = function (team) {
      return game.entities.filter(function (e) { return e.kind === 'tower' && e.team === team && !e.dead; })
        .map(function (e) { return (e.towerType === 'king' ? 'K' : (e.lane === 0 ? 'L' : 'R')) + ' ' + Math.round(e.hp); }).join(', ');
    };
    var units = function (team) {
      return game.entities.filter(function (e) { return e.kind !== 'tower' && e.team === team && !e.dead; }).length;
    };
    var name = function (t) { return side(t); };
    return '[' + mmss(game.time) + '] ' + game.phase + ' x' + game.elixirMult +
      ' | crowns ' + name(0) + ' ' + game.players[0].crowns + ' - ' + game.players[1].crowns + ' ' + name(1) +
      ' | elixir ' + name(0) + ' ' + p0.elixir.toFixed(1) + ', ' + name(1) + ' ' + p1.elixir.toFixed(1) +
      ' | towers ' + name(0) + ' [' + towers(0) + '] ' + name(1) + ' [' + towers(1) + ']' +
      ' | units ' + units(0) + '/' + units(1);
  }

  var hook = {
    start: function (game, ctl) {
      botTrace = ctl[botTeam].trace || null;
      game.entities.forEach(function (e) {
        if (e.kind === 'tower') { towerList.push(e); towerHp.set(e, e.hp); }
      });
      towerList.forEach(function (tw) { towerNames.set(tw, nameOfTower(tw)); });
      logLines.push('[' + mmss(0) + '] match start: BOT is team ' + botTeam + ', ' + oppLabel + ' is team ' + aiTeam +
        '. Opponent ' + comps[aiTeam].name + ', bot ' + comps[botTeam].name + '.');
    },
    step: function (game, ctl, steps) {
      var t = game.time;
      var tt = Math.round(t * 100) / 100;
      if (Math.floor(t / 5) !== lastState) {
        lastState = Math.floor(t / 5);
        logLines.push(stateLine(game));
      }

      // Events: plays, tower falls, king activations, game over.
      game.events.forEach(function (ev) {
        if (ev.type === 'deploy') {
          var card = CR.CARDS[ev.cardId];
          played[ev.team].add(ev.cardId);
          playCount[ev.team]++;
          var reason = deployNote(ev.team, ev.cardId, t);
          if (reason) {
            var key = reason.replace(/^ \(|\)$/g, '').replace(/ lane \d+/, '');
            playsByReason[key] = (playsByReason[key] || 0) + 1;
          }
          logLines.push('[' + mmss(t) + '] ' + side(ev.team) + ' plays ' + (card ? card.name : ev.cardId) +
            ' at (' + ev.x.toFixed(1) + ', ' + ev.y.toFixed(1) + ') for ' + (card ? card.cost : '?') + reason);
          if (card && card.type === 'spell' && !card.spawnUnit) {
            var k = game.getTowers(ev.team).filter(function (tw) { return tw.towerType === 'king' && !tw.dead; })[0];
            var flight = card.travelSpeed > 0 && k ? dist(k.x, k.y, ev.x, ev.y) / card.travelSpeed : 0;
            spellPending.push({ due: t + flight + 0.05, team: ev.team, cardId: ev.cardId, x: ev.x, y: ev.y, radius: card.radius || 1.5, log: !!card.log });
            spellImpacts.push({ t: t + flight, x: ev.x, y: ev.y });
          }
        } else if (ev.type === 'towerDown') {
          logLines.push('[' + mmss(t) + '] ' + side(ev.team) + ' ' + (towerNames.get(towerList.filter(function (tw) { return tw.x === ev.x && tw.y === ev.y; })[0]) || 'tower') + ' destroyed');
        } else if (ev.type === 'kingActivate') {
          logLines.push('[' + mmss(t) + '] ' + side(ev.team) + ' king tower activated');
        } else if (ev.type === 'gameOver') {
          gameOverT = t;
          logLines.push('[' + mmss(t) + '] game over: ' + (ev.team === -1 ? 'draw' : side(ev.team) + ' wins') +
            ' (' + game.players[0].crowns + '-' + game.players[1].crowns + ', ' + game.result.reason + ')');
        }
      });
      if (game.phase === 'overtime' && ot === null) {
        ot = t;
        logLines.push('[' + mmss(t) + '] overtime starts (sudden death)');
      }

      // Elixir at cap intervals.
      for (var pt = 0; pt < 2; pt++) {
        var atCap = game.players[pt].elixir >= 9.99;
        if (atCap && capStart[pt] === null) capStart[pt] = t;
        if (!atCap && capStart[pt] !== null) {
          capIntervals[pt].push([capStart[pt], t]);
          capStart[pt] = null;
        }
      }

      // Tower damage with no defender nearby = unanswered hit (spell impacts excluded).
      towerList.forEach(function (tw) {
        var hp0 = towerHp.get(tw);
        var drop = hp0 - tw.hp;
        towerHp.set(tw, tw.hp);
        if (drop <= 0) return;
        var defenders = game.entities.filter(function (e) {
          return !e.dead && e.team === tw.team && e.kind !== 'tower' && dist(e.x, e.y, tw.x, tw.y) < 6;
        });
        var fromSpell = spellImpacts.some(function (s) { return Math.abs(s.t - t) < 0.6 && dist(s.x, s.y, tw.x, tw.y) < 4.5; });
        if (defenders.length || fromSpell) return;
        var last = episodes.filter(function (ep) { return ep.tower === tw && t - ep.endT < 8; })[0];
        var attackers = game.entities.filter(function (e) {
          return !e.dead && e.team !== tw.team && e.kind !== 'tower' && dist(e.x, e.y, tw.x, tw.y) < 9;
        });
        if (last) {
          last.endT = t;
          last.dmg += drop;
          attackers.forEach(function (a) { last.cards.add(CR.CARDS[a.cardId] ? CR.CARDS[a.cardId].name : a.unitId); });
        } else {
          var cards = new Set();
          attackers.forEach(function (a) { cards.add(a.cardId && CR.CARDS[a.cardId] ? CR.CARDS[a.cardId].name : a.unitId); });
          var recent = playsRecent(tw.team, t, 8);
          episodes.push({
            tower: tw, startT: t, endT: t, dmg: drop, defender: tw.team, cards: cards,
            elixir: game.players[tw.team].elixir, recentPlays: recent,
          });
        }
      });

      // Spell impact checks: did anything get hit?
      spellPending = spellPending.filter(function (sp) {
        if (t < sp.due) return true;
        if (sp.log) return false;
        var enemy = 1 - sp.team;
        // Units the spell killed are gone from the arena by now, so count tracked units, dead or alive.
        var hit = false;
        ents.forEach(function (info, e) {
          if (!hit && e.team === enemy && dist(e.x, e.y, sp.x, sp.y) <= sp.radius + (e.r || 0)) hit = true;
        });
        towerList.forEach(function (tw) {
          if (!hit && tw.team === enemy && dist(tw.x, tw.y, sp.x, sp.y) <= sp.radius + tw.r) hit = true;
        });
        var card = CR.CARDS[sp.cardId];
        if (hit) spellHits[sp.team][0]++;
        else {
          spellMiss[sp.team].push({ t: sp.due - 0.05, card: card ? card.name : sp.cardId, x: sp.x, y: sp.y });
          spellHits[sp.team][1]++;
        }
        return false;
      });

      // Units and projectiles.
      game.projectiles.forEach(function (p) {
        if (projSeen.has(p)) return;
        projSeen.add(p);
        // A target killed in the same step clears p.target before we see it. Only flag when no
        // entity, living or just dead, stood at the aim point.
        if (!p.target) {
          var aimed = false;
          ents.forEach(function (info, e) {
            if (!aimed && dist(e.x, e.y, p.tx, p.ty) < 0.8 + (e.r || 0)) aimed = true;
          });
          if (!aimed) noTargetProj[p.team]++;
        }
      });
      game.entities.forEach(function (e) {
        if (e.kind === 'tower') return;
        if (!ents.has(e)) ents.set(e, { e: e, born: t, lastPos: { x: e.x, y: e.y }, lastMove: t, reached: false, aloneChecked: false, idleFlag: false, stuckFlag: false, riverFrames: 0, riverFlag: false, boundsFlag: false, recorded: false });
      });
      ents.forEach(function (info, e) {
        if (e.dead) {
          if (!info.recorded) {
            info.recorded = true;
            var u = CR.UNITS[e.unitId];
            if (e.kind === 'troop' && u && !info.reached) {
              var crossed = e.team === 0 ? e.y < RIVER_TOP : e.y > RIVER_BOTTOM;
              if (crossed) wasted[e.team].push({ t: t, card: nameCard(e), x: e.x, y: e.y });
            }
          }
          return;
        }
        if (e.kind !== 'troop') return;
        var u2 = CR.UNITS[e.unitId];
        if (!u2) return;
        if (e.x < 0 || e.x > W || e.y < 0 || e.y > H) {
          if (!info.boundsFlag) { info.boundsFlag = true; outOfBounds[e.team]++; findings.engine.push('[' + mmss(t) + '] ' + side(e.team) + ' ' + nameCard(e) + ' left the arena at (' + e.x.toFixed(1) + ', ' + e.y.toFixed(1) + ')'); }
        }
        // Speed over 5 s windows. Under 0.25 tiles/s with no target (or an out-of-range target)
        // is a stall. Units crawling along a tower footprint count as blocked, not moving.
        if (info.winT === undefined) { info.winT = t; info.winPos = { x: e.x, y: e.y }; info.tgtInWindow = false; }
        if (e.target) info.tgtInWindow = true;
        if (t - info.winT >= 5) {
          var sp = dist(e.x, e.y, info.winPos.x, info.winPos.y) / (t - info.winT);
          var disabledNow = e.stunT > 0 || e.freezeT > 0;
          if (!info.slowFlag && e.deployT <= 0 && !disabledNow && sp < 0.25) {
            if (!e.target && !info.tgtInWindow) {
              info.slowFlag = true;
              var jammed = game.entities.some(function (o) {
                return o !== e && !o.dead && o.kind !== 'tower' && dist(o.x, o.y, e.x, e.y) < e.r + (o.r || 0) + 0.15;
              });
              var nearTower = game.entities.some(function (o) {
                return !o.dead && o.kind === 'tower' && dist(o.x, o.y, e.x, e.y) < o.r + e.r + 0.5;
              });
              var kind = jammed ? 'jam' : nearTower ? 'blocked' : 'idle';
              stuckIdle[e.team].push({ t: t, card: nameCard(e), x: e.x, y: e.y, kind: kind, speed: sp });
            } else if (e.target && !e.target.dead) {
              var edge = dist(e.x, e.y, e.target.x, e.target.y) - e.r - (e.target.r || 0);
              if (edge > u2.range + 0.5) {
                info.slowFlag = true;
                stuckIdle[e.team].push({ t: t, card: nameCard(e), x: e.x, y: e.y, kind: 'stuck', speed: sp });
              }
            }
          }
          info.winT = t;
          info.winPos = { x: e.x, y: e.y };
          info.tgtInWindow = !!e.target;
        }
        // River: troops sitting in the river outside a bridge.
        var inRiver = !e.air && !u2.jumpsRiver && e.y > RIVER_TOP && e.y < RIVER_BOTTOM;
        var onBridge = CR.ARENA.BRIDGES.some(function (b) { return Math.abs(e.x - b.x) <= b.halfWidth; });
        if (inRiver && !onBridge) {
          info.riverFrames++;
          if (info.riverFrames === 15 && !info.riverFlag) {
            info.riverFlag = true;
            riverSeen[e.team].push({ t: t, card: nameCard(e), x: e.x, y: e.y });
          }
        } else {
          info.riverFrames = 0;
        }
        // Reaching an enemy tower, and whether it had company.
        var enemyTowers = towerList.filter(function (tw) { return tw.team !== e.team && !tw.dead; });
        enemyTowers.forEach(function (tw) {
          var edge = dist(e.x, e.y, tw.x, tw.y) - e.r - tw.r;
          if (edge <= u2.range + 0.5 && !info.reached) {
            info.reached = true;
            if (!info.aloneChecked) {
              info.aloneChecked = true;
              var friends = game.entities.filter(function (f) {
                return !f.dead && f !== e && f.team === e.team && f.kind === 'troop' && dist(f.x, f.y, e.x, e.y) <= 3;
              });
              if (!friends.length) alone[e.team].push({ t: t, card: nameCard(e), tower: towerNames.get(tw) || 'tower' });
            }
          }
        });
      });
    },
    end: function (game) {
      // Close open cap intervals.
      for (var pt = 0; pt < 2; pt++) {
        if (capStart[pt] !== null) capIntervals[pt].push([capStart[pt], game.time]);
      }
    },
  };

  function nameCard(e) {
    if (e.cardId && CR.CARDS[e.cardId]) return CR.CARDS[e.cardId].name;
    var u = CR.UNITS[e.unitId];
    return u ? u.name : e.unitId;
  }

  var playTimes = [[], []];
  function playsRecent(team, t, window) {
    return playCountSince(team, t - window);
  }
  var origEvent = hook.step;
  hook.step = function (game, ctl, steps) {
    game.events.forEach(function (ev) { if (ev.type === 'deploy') playTimes[ev.team].push(game.time); });
    origEvent(game, ctl, steps);
  };
  function playCountSince(team, since) {
    return playTimes[team].filter(function (x) { return x >= since; }).length;
  }

  var sim = simulate(comps, seed, 0, hook);
  var g = sim.game;

  // Findings from the collected records.
  var D = function (team) { return side(team); };
  capIntervals.forEach(function (ivs, team) {
    var total = ivs.reduce(function (s, iv) { return s + (iv[1] - iv[0]); }, 0);
    if (total >= 1) {
      var longest = ivs.slice().sort(function (a, b) { return (b[1] - b[0]) - (a[1] - a[0]); })[0];
      findings.elixir.push(D(team) + ' sat at 10 elixir for ' + total.toFixed(1) + ' s over ' + ivs.length +
        ' stretch(es). Longest ' + (longest[1] - longest[0]).toFixed(1) + ' s from ' + mmss(longest[0]) + '.');
    }
  });
  var deck = [0, 1].map(function (team) { return g.players[team].deck.slice(); });
  [0, 1].forEach(function (team) {
    var never = deck[team].filter(function (id) { return !played[team].has(id); });
    if (never.length) {
      findings.cards.push(D(team) + ' never played: ' + never.map(function (id) { return CR.CARDS[id] ? CR.CARDS[id].name : id; }).join(', ') +
        ' (of its 8-card deck; played ' + played[team].size + ' distinct cards, ' + playCount[team] + ' plays).');
    }
  });
  episodes.forEach(function (ep) {
    var att = D(1 - ep.defender);
    var defSide = D(ep.defender);
    var rec = ep.recentPlays;
    var what = Array.from(ep.cards).join(', ') || 'none in view (projectile or spell in flight)';
    findings.pushes.push('[' + mmss(ep.startT) + '] ' + defSide + ' ' + towerNames.get(ep.tower) + ' took ' + Math.round(ep.dmg) +
      ' damage with no defender within 6 tiles (' + (ep.endT > ep.startT ? 'until ' + mmss(ep.endT) : 'one hit') +
      '). ' + att + ' attackers in range: ' + what + '. ' + defSide + ' had ' + ep.elixir.toFixed(1) +
      ' elixir and played ' + rec + ' card(s) in the 8 s before.');
  });
  alone.forEach(function (list, team) {
    if (!list.length) return;
    var byCard = {};
    list.forEach(function (a) { byCard[a.card] = (byCard[a.card] || 0) + 1; });
    var sample = list.slice(0, 4).map(function (a) { return a.card + ' at ' + mmss(a.t) + ' into ' + a.tower; }).join('; ');
    findings.units.push(D(team) + ' sent ' + list.length + ' troop(s) into an enemy tower with no friendly troop within 3 tiles. Examples: ' + sample + '.');
  });
  wasted.forEach(function (list, team) {
    if (!list.length) return;
    var byCard = {};
    list.forEach(function (a) { byCard[a.card] = (byCard[a.card] || 0) + 1; });
    var parts = Object.keys(byCard).map(function (k) { return k + ' x' + byCard[k]; }).join(', ');
    findings.pushes.push(D(team) + ' lost ' + list.length + ' troop(s) in the enemy half without reaching a tower (' + parts + ').');
  });
  spellMiss.forEach(function (list, team) {
    list.slice(0, 6).forEach(function (m) {
      findings.spells.push('[' + mmss(m.t) + '] ' + D(team) + ' ' + m.card + ' at (' + m.x.toFixed(1) + ', ' + m.y.toFixed(1) + ') hit nothing on impact.');
    });
    if (list.length > 6) findings.spells.push(D(team) + ': ' + (list.length - 6) + ' more spells hit nothing.');
    if (spellHits[team][0] + spellHits[team][1] > 0) {
      findings.spells.push(D(team) + ' spells: ' + spellHits[team][0] + ' hit, ' + spellHits[team][1] + ' missed (checked at impact, logs and barrels not counted).');
    }
  });
  stuckIdle.forEach(function (list, team) {
    var fmt = function (x) { return x.card + ' at ' + mmss(x.t) + ' (' + x.x.toFixed(1) + ', ' + x.y.toFixed(1) + ')'; };
    var groups = [
      ['idle', 'stood still with no target and no visible cause'],
      ['jam', 'packed against other units with no target (crowding)'],
      ['blocked', 'crawled along a tower footprint with no target (blocked by a tower, under 0.25 tiles/s)'],
      ['stuck', 'had a target out of range and did not move (under 0.25 tiles/s)'],
    ];
    groups.forEach(function (g) {
      var hits = list.filter(function (x) { return x.kind === g[0]; });
      if (!hits.length) return;
      findings.units.push(D(team) + ' ' + hits.length + ' troop(s) ' + g[1] + '. Examples: ' +
        hits.slice(0, 4).map(fmt).join('; ') + '.');
    });
  });
  riverSeen.forEach(function (list, team) {
    if (!list.length) return;
    findings.engine.push(D(team) + ' had ' + list.length + ' troop(s) sit in the river for 0.5 s or more outside a bridge. Examples: ' +
      list.slice(0, 4).map(function (x) { return x.card + ' at ' + mmss(x.t) + ' (' + x.x.toFixed(1) + ', ' + x.y.toFixed(1) + ')'; }).join('; ') + '.');
  });
  noTargetProj.forEach(function (count, team) {
    if (count) findings.engine.push(D(team) + ' fired ' + count + ' projectile(s) with no target and nothing at the aim point.');
  });
  if (ot !== null) {
    findings.units.push('Match went to overtime (started ' + mmss(ot) + ', ended ' + mmss(g.time) + ', reason ' + g.result.reason + ').');
  }

  // Summary per side.
  var summary = {};
  [0, 1].forEach(function (team) {
    var st = sim.ctl[team].stats ? copyStats(sim.ctl[team].stats) : null;
    summary[side(team)] = {
      crowns: g.players[team].crowns,
      towerDamageDealt: round1(sim.dmgDealt[team]),
      leakSeconds: round2(sim.leak[team]),
      cards: sim.cards[team],
      elixirSpent: sim.spent[team],
      distinctCards: played[team].size,
      botStats: st,
    };
  });
  var mix = {};
  Object.keys(playsByReason).forEach(function (k) { mix[k] = playsByReason[k]; });

  return {
    sim: sim, log: logLines, findings: findings, summary: summary, playsByReason: mix,
    result: g.result, duration: g.time, overtime: sim.overtime, gameOverT: gameOverT,
  };
}

function cmdReview(args) {
  if (!args.bot) die('review needs --bot <preset|file.json>');
  var botTeam = Math.floor(num(args.team, 0, '--team'));
  if (botTeam !== 0 && botTeam !== 1) die('--team must be 0 or 1');
  var A = resolveBot(args.bot, args.set);
  A.config.general.trace = true;
  var B = resolveCompetitor(args.vs || 'ai:normal', []);
  var seed = Math.floor(num(args.seed, 1, '--seed'));
  var r = reviewRun(A, B, seed, botTeam);

  var botLabel = A.short;
  var oppLabel = B.kind === 'ai' ? 'AI (' + B.difficulty + ')' : 'OPP (' + B.short + ')';
  var title = 'Review: BOT (' + botLabel + ') vs ' + oppLabel + ', seed ' + seed;
  var res = r.result;
  var resultLine;
  if (!res) resultLine = 'no result (step limit)';
  else if (res.winner === -1) resultLine = 'draw (' + res.reason + ')';
  else resultLine = (res.winner === botTeam ? 'BOT wins' : (B.kind === 'ai' ? 'AI wins' : 'OPP wins')) + ' by ' + res.reason +
    ' (crowns ' + res.crowns[botTeam] + '-' + res.crowns[1 - botTeam] + ')';

  var names = { elixir: 'Elixir', pushes: 'Pushes and defence', spells: 'Spells', units: 'Units and tactics', cards: 'Cards', engine: 'Engine' };
  var md = [];
  md.push('# ' + title);
  md.push('');
  md.push('Generated ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC. Match length ' + mmss(r.duration) +
    '. Game seed ' + seed + ', bot seed from config. Snapshot ' + SNAP + ' (engine, cards, AI, bot).');
  md.push('');
  md.push('## Result');
  md.push('');
  md.push(resultLine + '.');
  md.push('');
  md.push('| Side | Crowns | Tower dmg dealt | Leak s (at 10) | Cards | Elixir spent | Distinct cards |');
  md.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  Object.keys(r.summary).forEach(function (k) {
    var s = r.summary[k];
    md.push('| ' + k + ' | ' + s.crowns + ' | ' + s.towerDamageDealt + ' | ' + s.leakSeconds + ' | ' + s.cards + ' | ' + s.elixirSpent + ' | ' + s.distinctCards + ' |');
  });
  md.push('');
  var bs = r.summary.BOT.botStats;
  if (bs) {
    md.push('Bot decisions: ' + Object.keys(r.playsByReason).map(function (k) { return k + ' ' + r.playsByReason[k]; }).join(', ') + '.');
    md.push('');
    md.push('Bot counters: defenses ' + bs.defenses + ', kites ' + bs.kitePlays + ', pushes ' + bs.pushesStarted +
      ', spells ' + bs.spellsCast + ' (value hit ' + f1(bs.spellValueHit) + ' of ' + f1(bs.spellValueEst) + ' estimated), forced plays ' + bs.forcedPlays +
      ', idle cycle plays ' + bs.idlePlays + ', baits ' + bs.baitPlays + ', supports ' + bs.supportPlays + '.');
    md.push('');
  }
  md.push('## Findings');
  md.push('');
  ['elixir', 'pushes', 'spells', 'units', 'cards', 'engine'].forEach(function (sec) {
    md.push('### ' + names[sec]);
    md.push('');
    if (!r.findings[sec].length) md.push('None.');
    r.findings[sec].forEach(function (f) { md.push('- ' + f); });
    md.push('');
  });
  md.push('## Gameplay log');
  md.push('');
  md.push('Game clock, one state line every 5 s, then plays and key events. "AI" is the computer opponent, "OPP" a bot opponent.');
  md.push('');
  md.push('```');
  r.log.forEach(function (l) { md.push(l); });
  md.push('```');
  md.push('');
  var text = md.join('\n');

  var name = args.name || (slug(botLabel) + '-vs-' + slug(B.kind === 'ai' ? 'ai-' + B.difficulty : B.short) + '-seed' + seed);
  if (!fs.existsSync(REVIEW_DIR)) fs.mkdirSync(REVIEW_DIR, { recursive: true });
  var outFile = path.join(REVIEW_DIR, name + '.md');
  fs.writeFileSync(outFile, text);

  var jsonOut = {
    command: 'review', snapshot: SNAP, file: path.relative(ROOT, outFile), bot: A.name, vs: B.name, seed: seed, team: botTeam,
    result: res, duration: r.duration, overtime: r.overtime, summary: r.summary, playsByReason: r.playsByReason, findings: r.findings,
  };
  if (args.json) emit(jsonOut, '', true);
  else {
    process.stdout.write(title + '\n' + resultLine + '.\nWrote ' + path.relative(ROOT, outFile) + '\n');
    ['elixir', 'pushes', 'spells', 'units', 'cards', 'engine'].forEach(function (sec) {
      process.stdout.write('  ' + names[sec] + ': ' + r.findings[sec].length + ' finding(s)\n');
    });
  }
}

// ---- schema and presets ----------------------------------------------------

function fmtDefault(v) {
  if (v === null || v === undefined) return 'default deck';
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  return String(v);
}

function fmtRange(e) {
  if (e.type === 'bool') return 'on / off';
  if (e.type === 'enum') return e.options.join(' | ');
  if (e.type === 'deck') return '8 card ids';
  return e.min + ' to ' + e.max + ' (step ' + e.step + ')';
}

function schemaMarkdown() {
  var out = [];
  var groups = [];
  CR.BOT_SCHEMA.forEach(function (e) { if (groups.indexOf(e.group) < 0) groups.push(e.group); });
  groups.forEach(function (g) {
    out.push('### ' + g);
    out.push('');
    out.push('| Parameter | Type | Default | Range or options | Meaning |');
    out.push('| --- | --- | --- | --- | --- |');
    CR.BOT_SCHEMA.filter(function (e) { return e.group === g; }).forEach(function (e) {
      out.push('| `' + e.key + '` | ' + e.type + ' | ' + fmtDefault(e.default) + ' | ' + fmtRange(e) + ' | ' + e.description + ' |');
    });
    out.push('');
  });
  return out.join('\n');
}

function cmdSchema(args) {
  if (args.md) { process.stdout.write(schemaMarkdown() + '\n'); return; }
  if (args.json) { emit({ schema: CR.BOT_SCHEMA, defaults: CR.BOT_DEFAULTS }, '', true); return; }
  var rows = CR.BOT_SCHEMA.map(function (e) {
    return { key: e.key, group: e.group, type: e.type, def: fmtDefault(e.default), range: fmtRange(e) };
  });
  process.stdout.write(renderTable([
    { key: 'key', label: 'Parameter', align: 'l' }, { key: 'type', label: 'Type', align: 'l' },
    { key: 'def', label: 'Default', align: 'r' }, { key: 'range', label: 'Range', align: 'l' },
  ], rows) + '\n');
}

function cmdPresets(args) {
  var rows = Object.keys(CR.BOT_PRESETS).map(function (k) {
    var p = CR.BOT_PRESETS[k];
    return { name: k, label: p.label, description: p.description || '', deck: CR.botDeck(CR.botConfig(k)).join(', ') };
  });
  emit({ presets: rows }, renderTable([
    { key: 'name', label: 'Preset', align: 'l' }, { key: 'label', label: 'Name', align: 'l' },
    { key: 'description', label: 'Description', align: 'l' },
  ], rows) + '\n\nDecks:\n' + rows.map(function (r) { return '  ' + r.name + ': ' + r.deck; }).join('\n') + '\n', !!args.json);
}

// ---- main ---------------------------------------------------------------

function usage() {
  process.stdout.write([
    'Usage: node tools/botlab.js <command> [options]',
    '',
    '  match      --bot <preset|file.json|ai:level> --vs <ai:easy|normal|hard|bot:name|file.json> [--n 10] [--seed 1] [--set key=value]',
    '  sweep      --bot <...> --vs <...> --param key=min:max:step | key=a,b,c  (repeatable) [--n 10] [--top 10]',
    '  tournament [--n 10] [--seed 1] [--set key=value]',
    '  review     --bot <...> --vs <...> [--seed 1] [--team 0|1] [--name file-name]',
    '  schema     [--md | --json]',
    '  presets    [--json]',
    '',
    'Add --json to any command for machine-readable output on stdout.',
    '',
  ].join('\n'));
}

function main() {
  var args = parseArgs(process.argv.slice(2));
  var cmd = args._[0];
  if (!cmd || args.help || cmd === 'help') { usage(); return; }
  if (cmd === 'match') return cmdMatch(args);
  if (cmd === 'sweep') return cmdSweep(args);
  if (cmd === 'tournament') return cmdTournament(args);
  if (cmd === 'review') return cmdReview(args);
  if (cmd === 'schema') return cmdSchema(args);
  if (cmd === 'presets') return cmdPresets(args);
  die('unknown command: ' + cmd + ' (try --help)');
}

module.exports = { simulate: simulate, playMatch: playMatch, summarise: summarise, wilson: wilson, schemaMarkdown: schemaMarkdown };

if (require.main === module) main();
