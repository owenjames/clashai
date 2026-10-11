// AI test harness.
//   node tools/aitest.js --stub   stub game object test (no engine needed)
//   node tools/aitest.js          10 full AI vs AI matches, if js/engine.js exists
var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');
var jsDir = path.join(root, 'js');
require(path.join(jsDir, 'cards.js'));
var hasEngine = fs.existsSync(path.join(jsDir, 'engine.js'));
if (hasEngine) require(path.join(jsDir, 'engine.js'));
require(path.join(jsDir, 'ai.js'));
var CR = globalThis.CR;

var args = process.argv.slice(2);
var DT = 1 / 30;

function summarizeRoles() {
  var R = CR.AI.roles;
  var lines = [];
  Object.keys(R).forEach(function (id) {
    var r = R[id];
    var tags = [];
    if (r.winCon) tags.push('wincon');
    if (r.tank) tags.push('tank');
    if (r.splash) tags.push('splash');
    if (r.airCapable) tags.push('air');
    if (r.swarm) tags.push('swarm');
    if (r.building) tags.push('building');
    if (r.spell) tags.push('spell');
    if (r.damageSpell) tags.push('damage');
    if (r.cheap) tags.push('cheap');
    if (r.freeze) tags.push('freeze');
    if (r.heavy) tags.push('heavy');
    lines.push('  ' + id + ' (' + r.cost + '): ' + (tags.join(', ') || '-'));
  });
  return lines.join('\n');
}

// Stub game: a flat fake of the engine surface the AI reads and writes.
function makeStubGame(team) {
  var decks = CR.AI_DECKS[0];
  var game = {
    time: 0,
    phase: 'regulation',
    timeLeft: 180,
    elixirMult: 1,
    result: null,
    entities: [],
    players: [0, 1].map(function (t) {
      return { elixir: 5, hand: decks.slice(0, 4), next: decks[4], crowns: 0, deck: decks.slice() };
    }),
    deployed: [],
    violations: 0,
    nextId: 1,
    canDeploy: function (t, hIdx, x, y) {
      if (hIdx < 0 || hIdx > 3) return false;
      if (x < 0 || x > CR.ARENA.W || y < 0 || y > CR.ARENA.H) return false;
      var onOwnSide = t === 1 ? y <= 15 : y >= 17;
      return onOwnSide && !(Math.abs(x - 9) < 2.5 && Math.abs(y - (t === 1 ? 3 : 29)) < 2.5);
    },
    deploy: function (t, hIdx, x, y) {
      // The AI must check canDeploy first; a call that would fail is a violation.
      if (!game.canDeploy(t, hIdx, x, y)) { game.violations++; return false; }
      var p = game.players[t];
      var cid = p.hand[hIdx];
      var card = CR.CARDS[cid];
      if (p.elixir < card.cost) return false;
      p.elixir -= card.cost;
      p.hand[hIdx] = p.next;
      p.next = p.deck[(p.deck.indexOf(cid) + 5) % p.deck.length];
      game.deployed.push({ t: game.time, team: t, cardId: cid, x: x, y: y });
      if (card.unit) {
        var n = CR.UNITS[card.unit];
        for (var k = 0; k < (card.count || 1); k++) {
          game.entities.push({
            id: game.nextId++, team: t, kind: n.kind, unitId: card.unit, x: x + (k % 3) * 0.4 - 0.4, y: y,
            r: n.r, air: !!n.air, hp: n.hp, maxHp: n.hp, dead: false
          });
        }
      }
      return true;
    },
    getUnitsOf: function (t) {
      return game.entities.filter(function (e) { return e.team === t && e.kind !== 'tower' && !e.dead; });
    },
    getTowers: function (t) {
      return game.entities.filter(function (e) { return e.team === t && e.kind === 'tower' && !e.dead; });
    },
    update: function (dt) {
      game.time += dt;
      game.timeLeft = Math.max(0, 180 - game.time);
      game.players.forEach(function (p) { p.elixir = Math.min(10, p.elixir + dt / CR.ELIXIR.regen); });
      // Enemy troops walk toward the AI's side (team 0 walks toward smaller y).
      game.entities.forEach(function (e) {
        if (e.kind !== 'troop' || e.dead) return;
        var dir = e.team === 0 ? -1 : 1;
        e.y += dir * 1.0 * dt;
        if (e.team === 0 && e.y < 0) e.dead = true;
      });
    }
  };
  // Own and enemy king and princess towers, for the AI's tower logic.
  CR.TOWERS.layout.forEach(function (tw) {
    [0, 1].forEach(function (t) {
      game.entities.push({
        id: game.nextId++, team: t, kind: 'tower', towerType: tw.type, lane: tw.lane,
        x: tw.x, y: t === 1 ? CR.ARENA.H - tw.y : tw.y, hp: CR.TOWERS[tw.type].hp,
        maxHp: CR.TOWERS[tw.type].hp, dead: false
      });
    });
  });
  return game;
}

function runStub() {
  console.log('== stub test ==');
  var fails = [];
  [1, 0].forEach(function (team) {
    var game = makeStubGame(team);
    var ai = new CR.AI(game, team, { difficulty: 'hard', seed: 7 });
    // Enemy pushes arrive in lane 0 near the AI's princess tower.
    game.entities.push({
      id: game.nextId++, team: 1 - team, kind: 'troop', unitId: 'giant', x: 3.5,
      y: team === 1 ? 14 : 18, r: 0.75, air: false, hp: 4091, maxHp: 4091, dead: false
    });
    var steps = 0, errors = 0;
    try {
      while (game.time < 60) {
        game.update(DT);
        ai.update(DT);
        steps++;
      }
    } catch (err) {
      errors++;
      fails.push('team ' + team + ' threw: ' + err.message);
    }
    var mine = game.deployed.filter(function (d) { return d.team === team; });
    console.log('team ' + team + ': steps ' + steps + ', deploys ' + mine.length +
      ', canDeploy violations ' + game.violations);
    mine.slice(0, 8).forEach(function (d) {
      console.log('  t=' + d.t.toFixed(2) + ' ' + d.cardId + ' at (' + d.x.toFixed(2) + ', ' + d.y.toFixed(2) + ')');
    });
    if (game.violations) fails.push('team ' + team + ': deploy attempted at invalid spot');
    if (!mine.length) fails.push('team ' + team + ': no deploys in 60 s');
    if (errors) fails.push('team ' + team + ': errors');
  });
  console.log('roles:');
  console.log(summarizeRoles());
  if (fails.length) {
    console.log('FAIL: ' + fails.join('; '));
    process.exitCode = 1;
  } else {
    console.log('stub test passed');
  }
}

function runMatch(i, team0Diff, team1Diff) {
  var seed = 1000 + i * 37;
  var decks = [CR.AI_DECKS[i % CR.AI_DECKS.length], CR.AI_DECKS[(i + 3) % CR.AI_DECKS.length]];
  var game = new CR.Game({ decks: decks, seed: seed });
  var ai0 = new CR.AI(game, 0, { difficulty: team0Diff, seed: seed });
  var ai1 = new CR.AI(game, 1, { difficulty: team1Diff, seed: seed + 1 });

  var played = [{}, {}];
  var origDeploy = game.deploy.bind(game);
  game.deploy = function (team, hIdx, x, y) {
    var cid = game.players[team].hand[hIdx];
    var ok = origDeploy(team, hIdx, x, y);
    if (ok) played[team][cid] = (played[team][cid] || 0) + 1;
    return ok;
  };

  var leaked = [0, 0];
  var cap = 400 * 30;   // safety cap in steps, well past 300 s of match time
  var steps = 0;
  while (!game.result && game.phase !== 'ended' && steps < cap) {
    game.update(DT);
    for (var t = 0; t < 2; t++) {
      var p = game.players[t];
      if (p.elixir >= 9.99) leaked[t] += DT * game.elixirMult / CR.ELIXIR.regen;
    }
    ai0.update(DT);
    ai1.update(DT);
    steps++;
  }
  var res = game.result;
  var winner = res ? res.winner : -1;
  var crowns = res ? res.crowns : game.players.map(function (p) { return p.crowns; });
  var reason = res ? res.reason : 'timeout';
  return {
    i: i, team0: team0Diff, team1: team1Diff, winner: winner, crowns: crowns, reason: reason,
    leaked: leaked, played: played, seconds: game.time
  };
}

function fmtPlayed(obj) {
  return Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; })
    .map(function (k) { return k + ' x' + obj[k]; }).join(', ') || '-';
}

function runMatches() {
  console.log('== 10 AI vs AI matches, dt 1/30 ==');
  var results = [];
  for (var i = 0; i < 10; i++) {
    var swapped = i >= 5;
    var r = swapped ? runMatch(i, 'hard', 'normal') : runMatch(i, 'normal', 'hard');
    results.push(r);
    var label = r.winner === -1 ? 'draw/none' : 'team ' + r.winner + ' (' + (r.winner === 0 ? r.team0 : r.team1) + ')';
    console.log('match ' + (i + 1) + ': team0 ' + r.team0 + ' vs team1 ' + r.team1 + ' -> ' + label +
      ', crowns ' + r.crowns.join('-') + ', reason ' + r.reason + ', ' + r.seconds.toFixed(1) + ' s');
    console.log('  elixir leaked (est): team0 ' + r.leaked[0].toFixed(1) + ', team1 ' + r.leaked[1].toFixed(1));
    console.log('  team0 played: ' + fmtPlayed(r.played[0]));
    console.log('  team1 played: ' + fmtPlayed(r.played[1]));
  }
  var tally = { normal: { w: 0, c: 0, leak: 0, n: 0 }, hard: { w: 0, c: 0, leak: 0, n: 0 } };
  results.forEach(function (r) {
    [0, 1].forEach(function (t) {
      var d = t === 0 ? r.team0 : r.team1;
      var s = tally[d];
      s.n++;
      s.c += r.crowns[t];
      s.leak += r.leaked[t];
      if (r.winner === t) s.w++;
    });
  });
  console.log('summary:');
  ['normal', 'hard'].forEach(function (d) {
    var s = tally[d];
    console.log('  ' + d + ': wins ' + s.w + '/' + s.n + ', crowns ' + s.c + ', avg leaked ' +
      (s.leak / s.n).toFixed(1) + ' elixir per match');
  });
}

if (args.indexOf('--stub') !== -1) runStub();
if (hasEngine) {
  if (args.indexOf('--stub') === -1 || args.indexOf('--all') !== -1) runMatches();
} else if (args.indexOf('--stub') === -1) {
  console.log('js/engine.js not found. Run with --stub to test against the stub game.');
}
