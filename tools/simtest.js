#!/usr/bin/env node
'use strict';

// Headless tests for js/engine.js: invariant soak runs with random bots, plus focused mechanic checks.
// Usage: node tools/simtest.js   (exit code 1 on any failure)

const path = require('path');

const ROOT = path.join(__dirname, '..');
const CR = require(path.join(ROOT, 'js/cards.js'));
require(path.join(ROOT, 'js/engine.js'));
const Game = CR.Game;

const DT = 1 / 30;
const MATCHES = 40;
const MAX_TIME = 305;

const failures = [];
function check(cond, msg) {
  if (!cond) failures.push(msg);
}

function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    const t = (a = (a + 0x6d2b79f5) | 0);
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

const DECK_A = ['knight', 'zap', 'archers', 'giant', 'musketeer', 'minipekka', 'fireball', 'babydragon'];
const DECK_B = ['skeletons', 'goblins', 'archers', 'giant', 'musketeer', 'minipekka', 'fireball', 'zap'];

// Per-step invariants. Stops the match at the first broken state.
function checkState(game, tag) {
  for (const e of game.entities) {
    if (!isNum(e.x) || !isNum(e.y) || !isNum(e.hp)) {
      check(false, `${tag}: non-finite ${e.unitId} x=${e.x} y=${e.y} hp=${e.hp}`);
      return false;
    }
  }
  for (const p of game.projectiles) {
    if (!isNum(p.x) || !isNum(p.y)) {
      check(false, `${tag}: non-finite projectile`);
      return false;
    }
  }
  for (const s of game.spells) {
    if (!isNum(s.x) || !isNum(s.y)) {
      check(false, `${tag}: non-finite spell ${s.cardId}`);
      return false;
    }
  }
  for (let t = 0; t < 2; t++) {
    const p = game.players[t];
    if (!(p.elixir >= 0 && p.elixir <= 10)) {
      check(false, `${tag}: elixir out of range ${p.elixir}`);
      return false;
    }
    if (!(p.crowns >= 0 && p.crowns <= 3)) {
      check(false, `${tag}: crowns out of range ${p.crowns}`);
      return false;
    }
    const hs = new Set(p.hand);
    if (p.hand.length !== 4 || hs.size !== 4 || p.hand.some((c) => !c)) {
      check(false, `${tag}: hand not 4 distinct filled slots ${p.hand}`);
      return false;
    }
    if (!p.next || hs.has(p.next)) {
      check(false, `${tag}: next card missing or duplicated in hand`);
      return false;
    }
  }
  return true;
}

// Random bot: every 1.5-4 s picks a random affordable card and drops it at a random valid point.
function makeBot(team, rng) {
  return { team, rng, nextAt: 1.5 + rng() * 2.5 };
}

function botAct(game, bot) {
  if (game.time < bot.nextAt) return;
  bot.nextAt = game.time + 1.5 + bot.rng() * 2.5;
  const p = game.players[bot.team];
  const affordable = [0, 1, 2, 3].filter((i) => p.elixir >= CR.CARDS[p.hand[i]].cost);
  if (affordable.length === 0) return;
  const idx = affordable[Math.floor(bot.rng() * affordable.length)];
  const card = CR.CARDS[p.hand[idx]];
  if (card.type === 'spell') {
    const enemies = game.entities.filter((e) => !e.dead && e.team !== bot.team);
    let x;
    let y;
    if (enemies.length > 0 && bot.rng() < 0.7) {
      const e = enemies[Math.floor(bot.rng() * enemies.length)];
      x = e.x;
      y = e.y;
    } else {
      x = bot.rng() * CR.ARENA.W;
      y = bot.rng() * CR.ARENA.H;
    }
    game.deploy(bot.team, idx, x, y);
    return;
  }
  for (let tries = 0; tries < 40; tries++) {
    const x = bot.rng() * CR.ARENA.W;
    const y = bot.team === 0 ? CR.ARENA.RIVER_BOTTOM + bot.rng() * 14.5 : bot.rng() * CR.ARENA.RIVER_TOP;
    if (game.canDeploy(bot.team, idx, x, y)) {
      game.deploy(bot.team, idx, x, y);
      return;
    }
  }
}

// Walk-speed check: a ground troop that is walking must average at least 70 percent of its speed over each
// 1 s window. Walking excludes attacking, deploying, stunned, frozen, slowed, raged and knocked-back troops. A window is
// not counted when the troop was within 1.5 tiles of its target, touched another troop at any step, or was
// squeezed between two or more towers or buildings (a crowd or pocket pushes it around, not a footprint). Other windows that touched a tower or building
// are reported as a separate failure.
const WALK_WINDOW = 1.0;
const WALK_MIN = 0.7;
function edgeDistTo(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
}
function makeWalkTracker() {
  return { anchor: new Map(), slow: 0, crowdExcluded: 0, bldSlow: 0, windows: 0, worst: null };
}
function trackWalk(game, tr, tag) {
  const seen = new Set();
  for (const e of game.entities) {
    if (e.kind !== 'troop' || e.air || e.dead || !(e.def.speed > 0)) continue;
    seen.add(e);
    const walking =
      e.deployT <= 0 && !e.hidden && e.stunT <= 0 && e.freezeT <= 0 && e.slowT <= 0 && e.rageT <= 0 && e.knockT <= 0 &&
      !e.charging && !e.dash && !(e.target && edgeDistTo(e, e.target) <= e.def.range + 0.05);
    let a = tr.anchor.get(e);
    if (!walking) {
      tr.anchor.delete(e);
      continue;
    }
    if (!a) {
      a = { t: game.time, x: e.x, y: e.y, crowd: false, bld: false };
      tr.anchor.set(e, a);
    }
    let crowd = !!(e.target && edgeDistTo(e, e.target) < 1.5);
    let bldContacts = 0;
    for (const o of game.entities) {
      if (o === e || o.dead) continue;
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      if (o.kind === 'troop') {
        if (d < e.r + o.r + 1.0) crowd = true;
      } else if (d < e.r + o.r + 0.6) {
        bldContacts++;
      }
    }
    // Squeezed between two or more towers or buildings: a pocket that is narrower than the troop, not a crawl.
    if (bldContacts >= 2) crowd = true;
    a.crowd = a.crowd || crowd;
    a.bld = a.bld || bldContacts === 1;
    const dt = game.time - a.t;
    if (dt + 1e-9 >= WALK_WINDOW) {
      tr.windows++;
      const avg = Math.hypot(e.x - a.x, e.y - a.y) / dt;
      if (avg < WALK_MIN * e.def.speed) {
        if (a.crowd) {
          tr.crowdExcluded++;
        } else {
          tr.slow++;
          if (a.bld) tr.bldSlow++;
          if (!tr.worst || avg / e.def.speed < tr.worst.ratio) {
            tr.worst = { tag, unit: e.unitId, ratio: avg / e.def.speed, at: game.time, x: e.x, y: e.y };
          }
        }
      }
      tr.anchor.set(e, { t: game.time, x: e.x, y: e.y, crowd: false, bld: false });
    }
  }
  for (const k of [...tr.anchor.keys()]) if (!seen.has(k)) tr.anchor.delete(k);
}

function runMatch(seed, tr) {
  const rng = mulberry32(seed * 7919 + 13);
  const pick = () => (rng() < 0.3 ? CR.DEFAULT_DECK : CR.AI_DECKS[Math.floor(rng() * CR.AI_DECKS.length)]);
  const decks = [pick(), pick()];
  for (const d of decks) {
    check(new Set(d).size === 8, `seed ${seed}: deck not 8 distinct cards`);
  }
  const game = new Game({ decks, seed });
  const bots = [makeBot(0, rng), makeBot(1, rng)];
  const tag = `seed ${seed}`;
  let towerDowns = 0;
  let ok = checkState(game, tag);
  while (ok && !game.result && game.time < MAX_TIME) {
    for (const b of bots) botAct(game, b);
    game.update(DT);
    trackWalk(game, tr, tag);
    towerDowns += game.events.filter((ev) => ev.type === 'towerDown').length;
    ok = checkState(game, tag);
  }
  check(game.result !== null, `${tag}: no result by t=${MAX_TIME} (time ${game.time.toFixed(2)})`);
  if (game.result) {
    const r = game.result;
    check(game.time <= MAX_TIME, `${tag}: ended at ${game.time}`);
    check(r.crowns.every((c) => c >= 0 && c <= 3), `${tag}: result crowns ${r.crowns}`);
    check([0, 1, -1].includes(r.winner), `${tag}: bad winner ${r.winner}`);
    check(['crowns', 'king', 'tiebreak', 'draw'].includes(r.reason), `${tag}: bad reason ${r.reason}`);
  }
  return { seed, duration: game.time, result: game.result, towerDowns };
}

// Makes cardId playable from the hand (the engine shuffles decks) and returns its hand index.
function ensureInHand(game, team, cardId) {
  const p = game.players[team];
  const i = p.hand.indexOf(cardId);
  if (i >= 0) return i;
  if (p.next === cardId) {
    const old = p.hand[0];
    p.hand[0] = cardId;
    p.next = old;
    return 0;
  }
  const q = p.queue.indexOf(cardId);
  if (q < 0) throw new Error(`card ${cardId} not in team ${team} deck`);
  const old = p.hand[0];
  p.hand[0] = cardId;
  p.queue[q] = old;
  return 0;
}

function play(game, team, cardId, x, y) {
  return game.deploy(team, ensureInHand(game, team, cardId), x, y);
}

function findTower(game, team, type, lane) {
  return game.entities.find(
    (e) => e.kind === 'tower' && e.team === team && e.towerType === type && (lane === undefined || e.lane === lane)
  );
}

// Deploy refusals: insufficient elixir, outside the zone, in the river, on a tower footprint.
function testDeployRefusals() {
  const g = new Game({ decks: [DECK_A, DECK_B], seed: 11 });
  const idx = ensureInHand(g, 0, 'knight');
  const handBefore = g.players[0].hand.slice();
  g.players[0].elixir = 1;
  check(!g.deploy(0, idx, 9, 22), 'deploy refused with 1 elixir for a 3-cost card');
  check(JSON.stringify(g.players[0].hand) === JSON.stringify(handBefore), 'refused deploy changed the hand');
  g.players[0].elixir = 10;
  check(!g.deploy(0, idx, 9, 5), 'deploy refused on the enemy half');
  check(!g.deploy(0, idx, 9, 16), 'deploy refused in the river');
  check(!g.deploy(0, idx, 3.5, 25.5), 'deploy refused on a princess tower footprint');
  check(g.deploy(0, idx, 9, 22), 'deploy accepted on a valid point');
  check(g.players[0].elixir === 7, `deploy spent wrong elixir: ${g.players[0].elixir}`);
}

// Knight from the bottom-left crosses the left bridge and hits team 1's left princess tower.
function testKnightCrossesBridge() {
  const g = new Game({ decks: [DECK_A, DECK_B], seed: 21 });
  g.players[0].elixir = 10;
  check(play(g, 0, 'knight', 3.5, 20), 'knight deploys at (3.5, 20)');
  const knight = g.entities.find((e) => e.unitId === 'knight' && e.team === 0);
  const tower = findTower(g, 1, 'princess', 0);
  let onBridge = false;
  let offBridge = false;
  let minY = Infinity;
  for (let i = 0; i < 40 / DT && !g.result && !knight.dead; i++) {
    g.update(DT);
    if (knight.y > CR.ARENA.RIVER_TOP && knight.y < CR.ARENA.RIVER_BOTTOM) {
      if (Math.abs(knight.x - 3.5) <= 1.5) onBridge = true;
      else offBridge = true;
    }
    minY = Math.min(minY, knight.y);
  }
  check(minY < CR.ARENA.RIVER_TOP, `knight never reached the far bank (minY ${minY.toFixed(2)})`);
  check(onBridge && !offBridge, `knight did not cross the left bridge cleanly (onBridge ${onBridge}, offBridge ${offBridge})`);
  check(tower.hp < tower.maxHp, `knight did not damage the left princess tower (hp ${tower.hp})`);
}

// Giant walks past a nearby enemy Knight and never targets it.
function testGiantIgnoresKnight() {
  const g = new Game({
    decks: [['giant', 'zap', 'archers', 'knight', 'musketeer', 'minipekka', 'fireball', 'babydragon'], DECK_A],
    seed: 22,
  });
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 0, 'giant', 9, 17.5), 'giant deploys');
  check(play(g, 1, 'knight', 9, 14), 'enemy knight deploys');
  const giant = g.entities.find((e) => e.unitId === 'giant' && e.team === 0);
  const enemy = g.entities.find((e) => e.unitId === 'knight' && e.team === 1);
  let targetedEnemy = false;
  let targetedBuilding = false;
  for (let i = 0; i < 15 / DT && !g.result && !giant.dead; i++) {
    g.update(DT);
    if (giant.target && giant.target === enemy) targetedEnemy = true;
    if (giant.target && giant.target.kind !== 'troop') targetedBuilding = true;
  }
  check(!targetedEnemy, 'giant targeted the nearby enemy knight');
  check(targetedBuilding, 'giant never went for a tower or building');
}

// Hog Rider crosses the river at a point with no bridge.
function testHogCrossesRiverWithoutBridge() {
  const g = new Game({
    decks: [['hogrider', 'zap', 'archers', 'knight', 'musketeer', 'minipekka', 'fireball', 'babydragon'], DECK_B],
    seed: 23,
  });
  g.players[0].elixir = 10;
  check(play(g, 0, 'hogrider', 9, 20), 'hog rider deploys');
  const hog = g.entities.find((e) => e.unitId === 'hogrider' && e.team === 0);
  let crossedOffBridge = false;
  let reachedFarSide = false;
  for (let i = 0; i < 20 / DT && !g.result && !hog.dead; i++) {
    g.update(DT);
    if (hog.y > CR.ARENA.RIVER_TOP && hog.y < CR.ARENA.RIVER_BOTTOM) {
      const onBridge = Math.abs(hog.x - 3.5) <= 1.5 || Math.abs(hog.x - 14.5) <= 1.5;
      if (!onBridge) crossedOffBridge = true;
    }
    if (hog.y < CR.ARENA.RIVER_TOP) {
      reachedFarSide = true;
      break;
    }
  }
  check(reachedFarSide, 'hog rider never reached the far side');
  check(crossedOffBridge, 'hog rider never crossed the river off a bridge');
}

// Zap stuns an Inferno Tower and resets its damage ramp.
function testZapResetsInferno() {
  const g = new Game({
    decks: [
      ['knight', 'zap', 'archers', 'giant', 'musketeer', 'minipekka', 'fireball', 'babydragon'],
      ['infernotower', 'knight', 'archers', 'giant', 'musketeer', 'minipekka', 'fireball', 'zap'],
    ],
    seed: 5,
  });
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 1, 'infernotower', 9, 12.5), 'inferno tower deploys for team 1');
  check(play(g, 0, 'knight', 9, 17.5), 'knight deploys for team 0');
  const inferno = g.entities.find((e) => e.unitId === 'infernotower');
  for (let i = 0; i < 4.5 / DT; i++) g.update(DT);
  check(inferno.rampStage >= 1, `inferno never ramped (stage ${inferno.rampStage})`);
  check(play(g, 0, 'zap', 9, 12.5), 'zap deploys on the inferno tower');
  check(inferno.rampStage === 0, `zap did not reset the inferno ramp (stage ${inferno.rampStage})`);
  check(inferno.stunT > 0, 'zap did not stun the inferno tower');
}

// Destroying a princess tower activates the king and opens the pocket in that lane.
function testPrincessKillActivatesKing() {
  const g = new Game({
    decks: [['zap', 'knight', 'archers', 'giant', 'musketeer', 'minipekka', 'fireball', 'babydragon'], DECK_B],
    seed: 9,
  });
  g.players[0].elixir = 10;
  const princess = findTower(g, 1, 'princess', 0);
  const king = findTower(g, 1, 'king');
  check(!king.active, 'enemy king starts inactive');
  check(!g.isInDeployZone(0, 'knight', 3.5, 12), 'no pocket before the princess falls');
  princess.hp = 1; // shortcut: one zap finishes the tower
  check(play(g, 0, 'zap', 3.5, 6.5), 'zap deploys on the princess tower');
  check(princess.dead, 'princess tower did not die');
  check(king.active, 'destroying the princess did not activate the king');
  check(g.events.some((ev) => ev.type === 'kingActivate' && ev.team === 1), 'no kingActivate event');
  check(g.events.some((ev) => ev.type === 'towerDown' && ev.team === 1), 'no towerDown event');
  check(g.players[0].crowns === 1, `attacker crowns ${g.players[0].crowns}, want 1`);
  check(g.isInDeployZone(0, 'knight', 3.5, 12), 'pocket did not open in the lane');
  check(!g.isInDeployZone(0, 'knight', 14, 12), 'pocket opened in the other lane');
}

// Arrows damages towers by towerDamage, not damage.
function testArrowsTowerDamage() {
  const g = new Game({
    decks: [['arrows', 'knight', 'zap', 'giant', 'musketeer', 'minipekka', 'fireball', 'babydragon'], DECK_B],
    seed: 3,
  });
  g.players[0].elixir = 10;
  const tower = findTower(g, 1, 'princess', 1);
  const before = tower.hp;
  check(play(g, 0, 'arrows', 14.5, 6.5), 'arrows deploys on the right princess tower');
  for (let i = 0; i < 5 / DT && g.spells.length > 0; i++) g.update(DT);
  const dealt = before - tower.hp;
  check(dealt === CR.CARDS.arrows.towerDamage, `arrows dealt ${dealt} to the tower, want ${CR.CARDS.arrows.towerDamage}`);
}

function runFocusedTests() {
  const tests = [
    ['deploy refusals', testDeployRefusals],
    ['knight crosses left bridge', testKnightCrossesBridge],
    ['giant ignores knight', testGiantIgnoresKnight],
    ['hog crosses river', testHogCrossesRiverWithoutBridge],
    ['zap resets inferno ramp', testZapResetsInferno],
    ['princess kill activates king and pocket', testPrincessKillActivatesKing],
    ['arrows tower damage', testArrowsTowerDamage],
  ];
  for (const [name, fn] of tests) {
    const before = failures.length;
    try {
      fn();
    } catch (err) {
      failures.push(`${name}: threw ${err.stack || err}`);
    }
    const status = failures.length === before ? 'ok' : 'FAIL';
    console.log(`[${status}] ${name}`);
  }
}

function main() {
  runFocusedTests();

  const results = [];
  const tr = makeWalkTracker();
  for (let s = 1; s <= MATCHES; s++) {
    try {
      results.push(runMatch(s, tr));
    } catch (err) {
      failures.push(`seed ${s}: threw ${err.stack || err}`);
    }
  }

  const wins = [0, 0];
  let draws = 0;
  let totalDur = 0;
  let totalCrowns = 0;
  let totalTowerDowns = 0;
  for (const r of results) {
    totalDur += r.duration;
    totalTowerDowns += r.towerDowns;
    if (r.result) {
      if (r.result.winner === 0 || r.result.winner === 1) wins[r.result.winner]++;
      else draws++;
      totalCrowns += (r.result.crowns[0] + r.result.crowns[1]) / 2;
    }
  }
  const n = results.length || 1;
  console.log(`matches: ${results.length}`);
  console.log(`wins: team 0 ${wins[0]}, team 1 ${wins[1]}, draws ${draws}`);
  console.log(`avg duration: ${(totalDur / n).toFixed(1)} s`);
  console.log(`avg crowns per team: ${(totalCrowns / n).toFixed(2)}`);
  console.log(`avg crown towers destroyed per match: ${(totalTowerDowns / n).toFixed(2)}`);
  check(totalTowerDowns / n > 0, 'troops never destroyed a tower across random matches');
  console.log(`walk windows: ${tr.windows}, below ${WALK_MIN * 100}% of speed: ${tr.slow + tr.crowdExcluded} (${tr.crowdExcluded} with troop crowding, not counted)`);
  if (tr.worst) console.log(`  worst open-ground window: ${tr.worst.tag} ${tr.worst.unit} at ${tr.worst.at.toFixed(1)} s (${tr.worst.x.toFixed(1)}, ${tr.worst.y.toFixed(1)}) ${(tr.worst.ratio * 100).toFixed(0)}%`);
  check(tr.slow === 0, `${tr.slow} one-second walk window(s) below ${WALK_MIN * 100}% of unit speed without troop crowding`);
  check(tr.bldSlow === 0, `${tr.bldSlow} slow walk window(s) touched a tower or building`);

  if (failures.length > 0) {
    console.log(`\n${failures.length} failure(s):`);
    for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log('\nall checks passed');
  }
}

main();
