#!/usr/bin/env node
'use strict';

// Scenario tests for js/engine.js mechanics, each built on a directly-set-up CR.Game.
// Usage: node tools/mechtest.js   (prints [ok]/[FAIL] per test, exit code 1 on any failure)

const path = require('path');

const ROOT = path.join(__dirname, '..');
const CR = require(path.join(ROOT, 'js/cards.js'));
require(path.join(ROOT, 'js/engine.js'));
const Game = CR.Game;

const DT = 1 / 30;
const RIVER_TOP = CR.ARENA.RIVER_TOP;
const RIVER_BOTTOM = CR.ARENA.RIVER_BOTTOM;

// Filler deck used when a test does not care about the other cards.
const FILL = ['archers', 'zap', 'fireball', 'musketeer', 'minipekka', 'giant', 'knight', 'babydragon'];

const results = [];
let currentFails = null;

function check(cond, msg) {
  if (!cond && currentFails) currentFails.push(msg);
}

function near(a, b, tol) {
  return Math.abs(a - b) <= tol;
}

function makeGame(deck0, deck1, seed) {
  return new Game({
    decks: [deck0 || FILL, deck1 || FILL],
    seed: seed === undefined ? 1 : seed,
  });
}

// Moves cardId into hand slot 0 (swapping whatever was there into the queue) and returns 0.
function putInHand(game, team, cardId) {
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

// Plays cardId from hand (set up for precision). Returns deploy result.
function play(game, team, cardId, x, y) {
  const idx = putInHand(game, team, cardId);
  return game.deploy(team, idx, x, y);
}

function step(game, seconds) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n && game.phase !== 'ended'; i++) game.update(DT);
}

function unitsOf(game, unitId, team) {
  return game.entities.filter((e) => !e.dead && e.unitId === unitId && (team === undefined || e.team === team));
}

function towerOf(game, team, type, lane) {
  return game.entities.find(
    (e) => e.kind === 'tower' && e.team === team && e.towerType === type && (lane === undefined || e.lane === lane)
  );
}

const TESTS = [];
function test(name, fn) {
  TESTS.push({ name, fn });
}

// ---- 1. Elixir --------------------------------------------------------------

test('1a elixir regen from 5 caps at 10 after 28 s at 1x', () => {
  const g = makeGame();
  g.players[0].elixir = 5;
  step(g, 28);
  check(g.players[0].elixir === 10, `elixir ${g.players[0].elixir}, want 10`);
  g.players[0].elixir = 5;
  g.update(0);
  check(g.players[0].elixir === 5, 'update(0) should not regen');
});

test('1b elixir regen is 2.8 s per point at 1x', () => {
  const g = makeGame();
  g.players[0].elixir = 5;
  step(g, 2.8 * 2);
  check(near(g.players[0].elixir, 7, 0.02), `elixir after 5.6 s ${g.players[0].elixir}, want 7`);
});

test('1c regen is 2x in the last 60 s of regulation', () => {
  const g = makeGame();
  g.time = 120; // advance clock so the 2x window starts at 120
  g.players[0].elixir = 0;
  g.players[1].elixir = 0;
  step(g, 10); // 2x window: 10 s * 2 / 2.8 = 7.14 elixir
  check(g.elixirMult === 2, `elixirMult ${g.elixirMult}, want 2 in last minute`);
  check(near(g.players[0].elixir, 20 / 2.8, 0.05),
    `2x regen gave ${g.players[0].elixir}, want about ${(20 / 2.8).toFixed(2)}`);
});

test('1d regen is 3x in the final minute of overtime', () => {
  const g = makeGame();
  g.time = 180; // regulation ends with no crowns: overtime starts
  g.update(DT);
  check(g.phase === 'overtime', `phase ${g.phase}, want overtime`);
  g.time = g.overtimeStart + 61; // 61 s into overtime: final minute of sudden death
  g.update(DT);
  check(g.elixirMult === 3, `elixirMult ${g.elixirMult}, want 3 in the last minute of overtime`);
  g.players[0].elixir = 0;
  step(g, 2.8 / 3);
  check(near(g.players[0].elixir, 1, 0.05), `3x regen gave ${g.players[0].elixir}, want about 1 after 0.93 s`);
});

// ---- 2. Card cycle ---------------------------------------------------------

test('2 card cycle: first played card returns to hand after 4 other plays', () => {
  const deck = ['knight', 'archers', 'giant', 'musketeer', 'minipekka', 'fireball', 'zap', 'babydragon'];
  const g = makeGame(deck, FILL);
  const p = g.players[0];
  const first = p.hand[0];
  p.elixir = 10;
  check(g.deploy(0, 0, 3, 20), 'first play rejected');
  check(!p.hand.includes(first), `first card ${first} still in hand right after play`);
  // Plays of whatever sits in slot 0: 3 others leave the card still out of hand.
  for (let i = 0; i < 3; i++) {
    p.elixir = 10;
    const other = p.hand[0];
    check(other !== first, 'first card came back too early');
    check(g.deploy(0, 0, 3 + i, 20), `other play ${i} rejected`);
    check(!p.hand.includes(first), `first card returned after only ${i + 1} other plays`);
  }
  // The 4th other play brings it back.
  p.elixir = 10;
  check(g.deploy(0, 0, 3, 22), 'fourth other play rejected');
  check(p.hand.includes(first), `first card ${first} not back in hand after 4 other plays; hand ${p.hand}`);
});

// ---- 3. Deploy time --------------------------------------------------------

test('3 knight cannot move or attack during its first 1.0 s', () => {
  const g = makeGame(['knight', 'archers', 'giant', 'musketeer', 'minipekka', 'fireball', 'zap', 'babydragon'],
    ['skeletons', 'archers', 'giant', 'musketeer', 'minipekka', 'fireball', 'zap', 'babydragon']);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 0, 'knight', 9, 18.5), 'knight deploys');
  check(play(g, 1, 'skeletons', 9, 13), 'enemy skeleton deploys');
  const k = unitsOf(g, 'knight', 0)[0];
  const [sk] = unitsOf(g, 'skeleton', 1);
  check(k && k.deployT > 0.99, `deployT ${k && k.deployT}, want about 1`);
  // The skeleton is in melee range but outside both princess towers' range, so only the knight's deploy time matters.
  place(sk, 9, 17.4);
  freeze(sk);
  const hp0 = sk.hp;
  const x0 = k.x;
  const y0 = k.y;
  step(g, 0.9);
  check(k.x === x0 && k.y === y0, `knight moved during deploy: (${x0}, ${y0}) -> (${k.x}, ${k.y})`);
  check(k.lastAttackT < 0, 'knight attacked during deploy');
  check(sk.hp === hp0, `skeleton took ${hp0 - sk.hp} damage during the knight's deploy`);
  step(g, 1.0);
  check(k.lastAttackT >= 0, 'knight never attacked after deploying');
});

// ---- 4. Knight vs knight on open ground ------------------------------------

test('4a equal knights on open ground die nearly together', () => {
  const g = makeGame(['knight', 'archers', 'giant', 'musketeer', 'minipekka', 'fireball', 'zap', 'babydragon'],
    ['knight', 'archers', 'giant', 'musketeer', 'minipekka', 'fireball', 'zap', 'babydragon']);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 0, 'knight', 9, 17.5), 'team 0 knight deploys');
  check(play(g, 1, 'knight', 9, 14.5), 'team 1 knight deploys');
  const [a] = unitsOf(g, 'knight', 0);
  const [b] = unitsOf(g, 'knight', 1);
  // The duel runs on the left bridge, which the princess towers cover, so count only the knights' own hits:
  // stop at the first death and require the survivor to be within one hit of death.
  const hit = CR.UNITS.knight.damage;
  let first = null;
  for (let i = 0; i < 40 / DT && first === null; i++) {
    g.update(DT);
    if (a.dead) first = a;
    else if (b.dead) first = b;
  }
  check(first !== null, 'neither knight died in the duel');
  if (first !== null) {
    const other = first === a ? b : a;
    check(other.hp > 0 && other.hp < hit, `survivor at ${other.hp} hp when the first knight died, want less than one hit (${hit})`);
  }
});

test('4b first hit waits for loadTime after entering range', () => {
  const g = makeGame(['knight', 'archers', 'giant', 'musketeer', 'minipekka', 'fireball', 'zap', 'babydragon'],
    ['knight', 'archers', 'giant', 'musketeer', 'minipekka', 'fireball', 'zap', 'babydragon']);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 0, 'knight', 9, 17.5), 'team 0 knight deploys');
  check(play(g, 1, 'knight', 9, 14.5), 'team 1 knight deploys');
  const [a] = unitsOf(g, 'knight', 0);
  const [b] = unitsOf(g, 'knight', 1);
  const range = CR.UNITS.knight.range;
  const loadTime = CR.UNITS.knight.loadTime;
  let tIn = null;
  let tHit = null;
  let hpA = a.hp;
  let hpB = b.hp;
  for (let i = 0; i < 10 / DT && tHit === null; i++) {
    g.update(DT);
    const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
    if (tIn === null && gap <= range + 1e-6 && a.deployT === 0 && b.deployT === 0) tIn = g.time;
    if (tIn !== null && (a.hp < hpA || b.hp < hpB) && tHit === null) tHit = g.time;
    hpA = a.hp;
    hpB = b.hp;
  }
  check(tIn !== null, 'knights never came into range');
  check(tHit !== null, 'no damage was dealt');
  if (tIn !== null && tHit !== null) {
    const wait = tHit - tIn;
    check(wait >= loadTime - 2 * DT, `first hit ${wait.toFixed(2)} s after range, want at least ${loadTime} s`);
  }
});

// ---- 5. Musketeer vs princess tower ----------------------------------------

test('5 musketeer walking at a princess tower takes tower damage first', () => {
  const g = makeGame(['musketeer', 'archers', 'giant', 'knight', 'minipekka', 'fireball', 'zap', 'babydragon'], FILL);
  g.players[0].elixir = 10;
  check(play(g, 0, 'musketeer', 3.5, 18.5), 'musketeer deploys');
  const [m] = unitsOf(g, 'musketeer', 0);
  const tower = towerOf(g, 1, 'princess', 0);
  let tMusk = null;
  let tTower = null;
  for (let i = 0; i < 25 / DT && (tMusk === null || tTower === null) && !m.dead; i++) {
    g.update(DT);
    if (tMusk === null && m.hp < m.maxHp) tMusk = g.time;
    if (tTower === null && tower.hp < tower.maxHp) tTower = g.time;
  }
  check(tMusk !== null, 'musketeer was never damaged by the tower');
  check(tTower !== null, 'musketeer never hit the tower');
  if (tMusk !== null && tTower !== null) {
    check(tMusk <= tTower, `tower hit musketeer at ${tMusk.toFixed(2)} s, but musketeer hit tower first at ${tTower.toFixed(2)} s`);
  }
});

// ---- 6. Ground melee cannot hit air ----------------------------------------

test('6a knight next to a baby dragon never damages it', () => {
  const g = makeGame(['knight', 'archers', 'giant', 'musketeer', 'minipekka', 'fireball', 'zap', 'babydragon'],
    ['babydragon', 'archers', 'giant', 'musketeer', 'minipekka', 'fireball', 'zap', 'knight']);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 0, 'knight', 9, 20), 'knight deploys');
  check(play(g, 1, 'babydragon', 9, 14.5), 'baby dragon deploys');
  step(g, 1.2);
  const [k] = unitsOf(g, 'knight', 0);
  const [d] = unitsOf(g, 'babydragon', 1);
  // Pin both units side by side, out of every princess tower's range, so only the knight could hurt the dragon.
  const hp0 = d.hp;
  let knightTargetedDragon = false;
  for (let i = 0; i < 3 / DT; i++) {
    k.x = 9;
    k.y = 17.5;
    d.x = 9;
    d.y = 16.9;
    g.update(DT);
    if (k.target === d) knightTargetedDragon = true;
  }
  check(d.hp === hp0 && !d.dead, `dragon took ${hp0 - d.hp} damage from a knight`);
  check(!knightTargetedDragon, 'knight targeted the air dragon');
});

test('6b archers damage a baby dragon', () => {
  const g = makeGame(['archers', 'knight', 'giant', 'musketeer', 'minipekka', 'fireball', 'zap', 'babydragon'],
    ['babydragon', 'archers', 'giant', 'musketeer', 'minipekka', 'fireball', 'zap', 'knight']);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 0, 'archers', 9, 20), 'archers deploy');
  check(play(g, 1, 'babydragon', 9, 14.5), 'baby dragon deploys');
  step(g, 3);
  const [d] = unitsOf(g, 'babydragon', 1);
  check(!d || d.hp < d.maxHp, 'archers never damaged the baby dragon');
});

// Stops a unit from walking (per-entity copy of its def, so the shared UNITS table is untouched).
function freeze(e) {
  e.def = Object.assign({}, e.def, { speed: 0 });
}

// Teleports a unit (test setup only).
function place(e, x, y) {
  e.x = x;
  e.y = y;
}

// ---- 7. Giant targeting ----------------------------------------------------

test('7a giant ignores a knight hitting it and keeps walking past it', () => {
  const g = makeGame(['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'babydragon'],
    ['knight', 'archers', 'giant', 'musketeer', 'minipekka', 'fireball', 'zap', 'babydragon']);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 0, 'giant', 9, 17.5), 'giant deploys');
  check(play(g, 1, 'knight', 9, 14.5), 'enemy knight deploys');
  const [giant] = unitsOf(g, 'giant', 0);
  const [knight] = unitsOf(g, 'knight', 1);
  const princess = towerOf(g, 1, 'princess', 1);
  let targetedKnight = false;
  let targetedTower = false;
  // The knight chases and hits the giant, but the giant must keep walking toward the tower and never target it.
  for (let i = 0; i < 25 / DT && !giant.dead && !knight.dead; i++) {
    g.update(DT);
    if (giant.target === knight) targetedKnight = true;
    if (giant.target === princess) targetedTower = true;
  }
  check(!targetedKnight, 'giant targeted the knight that was hitting it');
  check(targetedTower, 'giant never walked on to the princess tower');
});

// ---- 7b. Cannon pulls a giant off a princess tower -------------------------

test('7b centre cannon draws the giant away from the princess tower when it is closer', () => {
  const g = makeGame(['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'babydragon'],
    ['cannon', 'archers', 'giant', 'musketeer', 'minipekka', 'fireball', 'zap', 'babydragon']);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 1, 'cannon', 9, 13), 'enemy cannon deploys in the centre');
  check(play(g, 0, 'giant', 9, 18.5), 'giant deploys');
  const [giant] = unitsOf(g, 'giant', 0);
  const cannon = unitsOf(g, 'cannon', 1)[0];
  const princess = towerOf(g, 1, 'princess', 0);
  let targetedCannon = false;
  let targetedPrincess = false;
  for (let i = 0; i < 4 / DT && !giant.dead && !cannon.dead; i++) {
    g.update(DT);
    if (giant.target === cannon) targetedCannon = true;
    if (giant.target === princess) targetedPrincess = true;
  }
  check(targetedCannon, 'giant never targeted the centre cannon');
  check(!targetedPrincess, 'giant went for the princess tower while the closer cannon stood');
});

// ---- 8. River crossing -----------------------------------------------------

test('8a hog rider jumps the river off the bridges', () => {
  const g = makeGame(['hogrider', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'babydragon'], FILL);
  g.players[0].elixir = 10;
  check(play(g, 0, 'hogrider', 9, 20), 'hog rider deploys at x = 9');
  const [hog] = unitsOf(g, 'hogrider', 0);
  let inRiverOffBridge = false;
  let inRiverSamples = 0;
  for (let i = 0; i < 12 / DT && !hog.dead && hog.y > RIVER_TOP - 1; i++) {
    g.update(DT);
    if (hog.y > RIVER_TOP && hog.y < RIVER_BOTTOM) {
      inRiverSamples++;
      const onBridge = Math.abs(hog.x - 3.5) <= 1.5 || Math.abs(hog.x - 14.5) <= 1.5;
      if (!onBridge) inRiverOffBridge = true;
    }
  }
  check(inRiverSamples > 0, 'hog rider never stood in the river');
  check(inRiverOffBridge, 'hog rider did not cross off the bridge');
});

test('8b knight at x = 9 routes over a bridge and never stands in water', () => {
  const g = makeGame(['knight', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'giant', 'babydragon'], FILL);
  g.players[0].elixir = 10;
  check(play(g, 0, 'knight', 9, 20), 'knight deploys at x = 9');
  const [k] = unitsOf(g, 'knight', 0);
  let inWater = false;
  let crossed = false;
  for (let i = 0; i < 12 / DT && !k.dead; i++) {
    g.update(DT);
    if (k.y < RIVER_TOP) crossed = true;
    if (k.y > RIVER_TOP && k.y < RIVER_BOTTOM) {
      const onBridge = Math.abs(k.x - 3.5) <= 1.5 || Math.abs(k.x - 14.5) <= 1.5;
      if (!onBridge) inWater = true;
    }
  }
  check(crossed, 'knight never reached the far bank');
  check(!inWater, 'knight stood in the river off a bridge');
});

// ---- 9. Lock-on ------------------------------------------------------------

test('9 mini P.E.K.K.A stays locked on its knight, then retargets after it dies', () => {
  const g = makeGame(['minipekka', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['knight', 'skeletons', 'zap', 'musketeer', 'giant', 'fireball', 'archers', 'babydragon']);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 0, 'minipekka', 9, 17.5), 'mini P.E.K.K.A deploys');
  check(play(g, 1, 'knight', 9, 14.5), 'enemy knight deploys');
  const [pekka] = unitsOf(g, 'minipekka', 0);
  const [knight] = unitsOf(g, 'knight', 1);
  // Stage the duel on the left bridge, in melee range, with both frozen in place.
  place(pekka, 3.5, 16);
  place(knight, 3.5, 14.3);
  freeze(pekka);
  freeze(knight);
  step(g, 1.5);
  check(pekka.target === knight && pekka.locked, `pekka not locked on the knight (target ${pekka.target && pekka.target.unitId})`);
  // A skeleton arrives right beside the pekka, closer than the knight.
  check(play(g, 1, 'skeletons', 9, 12), 'skeleton deploys');
  const sk = unitsOf(g, 'skeleton', 1)[0];
  step(g, 1.1);
  place(sk, pekka.x + 0.6, pekka.y);
  step(g, 0.4);
  check(pekka.target === knight, `pekka switched to the closer skeleton mid-fight (target ${pekka.target && pekka.target.unitId})`);
  // Kill the knight; the pekka should now pick the skeleton.
  knight.hp = 1;
  let retargeted = false;
  for (let i = 0; i < 4 / DT && !knight.dead; i++) g.update(DT);
  check(knight.dead, 'knight did not die');
  // Within a second of the knight's death the pekka should be on the skeleton (its next hit is on the skeleton).
  for (let i = 0; i < 1 / DT; i++) {
    g.update(DT);
    if (pekka.target === sk) retargeted = true;
  }
  check(retargeted, `pekka did not retarget to the skeleton after the knight died (target ${pekka.target && pekka.target.unitId})`);
});

// ---- 10. Retarget while walking --------------------------------------------

test('10 a walking unit switches to a closer enemy that enters sight', () => {
  const g = makeGame(['knight', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'minipekka', 'babydragon'],
    ['giant', 'skeletons', 'zap', 'musketeer', 'minipekka', 'fireball', 'archers', 'babydragon']);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 0, 'knight', 9, 20), 'knight deploys');
  check(play(g, 1, 'giant', 9, 13), 'far enemy giant deploys');
  const [k] = unitsOf(g, 'knight', 0);
  const [far] = unitsOf(g, 'giant', 1);
  freeze(k);
  freeze(far);
  step(g, 1.1); // finish deploying, then look for targets
  place(far, 9, 14);
  step(g, 0.5);
  check(k.target === far, `knight did not target the only enemy in sight (target ${k.target && k.target.unitId})`);
  check(!k.locked, 'knight locked on before reaching range');
  check(play(g, 1, 'skeletons', 9, 13.5), 'skeleton deploys');
  const sk = unitsOf(g, 'skeleton', 1)[0];
  step(g, 1.1);
  place(sk, 9, 17.5);
  step(g, 0.25);
  check(k.target === sk, `knight stayed on the far enemy instead of the closer skeleton (target ${k.target && k.target.unitId})`);
});

// ---- 11. Splash -----------------------------------------------------------

test('11a valkyrie spin kills all 15 skeleton army skeletons around her', () => {
  const g = makeGame(['valkyrie', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['skeletonarmy', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon']);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 0, 'valkyrie', 9, 19.5), 'valkyrie deploys');
  check(play(g, 1, 'skeletonarmy', 9, 13), 'skeleton army deploys');
  step(g, 1.1);
  const [v] = unitsOf(g, 'valkyrie', 0);
  const sks = unitsOf(g, 'skeleton', 1);
  check(sks.length === 15, `skeleton army has ${sks.length} skeletons, want 15`);
  // Ring them around the valkyrie on her own side (inside the splash radius, no river contact).
  sks.forEach((s, i) => {
    const a = (i * 2 * Math.PI) / sks.length;
    place(s, v.x + 1.2 * Math.cos(a), v.y + 1.2 * Math.sin(a));
    freeze(s);
  });
  step(g, 1.5);
  const alive = unitsOf(g, 'skeleton', 1).length;
  check(alive === 0, `${alive} of 15 skeletons survived the valkyrie spin`);
});

test('11b wizard projectile splash hits several clustered units', () => {
  const g = makeGame(['wizard', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['skeletons', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon']);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 0, 'wizard', 9, 20), 'wizard deploys');
  check(play(g, 1, 'skeletons', 9, 13), 'skeleton trio deploys');
  step(g, 1.1);
  const sks = unitsOf(g, 'skeleton', 1);
  sks.forEach((s) => freeze(s));
  step(g, 4); // the wizard locks, loads, and the projectile has to fly 6 tiles
  const hurt = sks.filter((s) => s.dead || s.hp < s.maxHp).length;
  check(hurt >= 2, `wizard splash hit ${hurt} skeletons, want at least 2`);
});

test('11c baby dragon splash hits both an air and a ground unit', () => {
  const g = makeGame(['babydragon', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'skeletons'],
    ['skeletons', 'minions', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon']);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 0, 'babydragon', 9, 19.5), 'baby dragon deploys');
  check(play(g, 1, 'skeletons', 9, 13), 'enemy skeleton deploys');
  check(play(g, 1, 'minions', 9, 12.5), 'enemy minions deploy');
  step(g, 1.1);
  const [d] = unitsOf(g, 'babydragon', 0);
  const [sk] = unitsOf(g, 'skeleton', 1);
  const [m] = unitsOf(g, 'minion', 1);
  // Park everything in place: dragon in range of the skeleton, the minion 0.5 tiles from the skeleton.
  place(d, 9, 15.8);
  place(sk, 9, 13);
  place(m, 9.0, 12.5);
  [d, sk, m].forEach(freeze);
  const hpSk = sk.hp;
  const hpM = m.hp;
  step(g, 2.5);
  check(sk.dead || sk.hp < hpSk, 'dragon splash did not hit the ground skeleton');
  check(m.dead || m.hp < hpM, 'dragon splash did not hit the air minion');
});

// ---- 12. Prince charge -----------------------------------------------------

function princeSetup(seed) {
  const g = makeGame(['prince', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons'], seed);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 0, 'prince', 9, 19.5), 'prince deploys');
  check(play(g, 1, 'giant', 9, 13.2), 'enemy giant deploys as the target');
  const [giant] = unitsOf(g, 'giant', 1);
  freeze(giant);
  step(g, 1.1);
  return { g, prince: unitsOf(g, 'prince', 0)[0], giant };
}

// Records the damage of each hit the giant takes, in order.
function hitDrops(g, giant, seconds) {
  const drops = [];
  let last = giant.hp;
  for (let i = 0; i < seconds / DT && !giant.dead; i++) {
    g.update(DT);
    if (giant.hp < last) drops.push(last - giant.hp);
    last = giant.hp;
  }
  return drops;
}

test('12a prince first hit after a 3 tile charge deals double damage (784)', () => {
  const { g, prince, giant } = princeSetup(31);
  let chargedAtHit = null;
  let last = giant.hp;
  for (let i = 0; i < 10 / DT && chargedAtHit === null; i++) {
    const wasCharging = prince.charging;
    g.update(DT);
    if (giant.hp < last) chargedAtHit = { dmg: last - giant.hp, wasCharging };
    last = giant.hp;
  }
  check(chargedAtHit !== null, 'prince never hit the giant');
  if (chargedAtHit) {
    check(chargedAtHit.wasCharging, 'prince was not charging at the first hit');
    check(near(chargedAtHit.dmg, 784, 0.5), `first hit ${chargedAtHit.dmg.toFixed(1)}, want 784`);
  }
  const next = hitDrops(g, giant, 3);
  check(next.length > 0 && near(next[0], 392, 0.5), `second hit ${next[0]}, want 392 (charge spent)`);
});

test('12b an enemy zap during the charge cancels it (next hit is 392)', () => {
  const { g, prince, giant } = princeSetup(32);
  let guard = 0;
  while (!prince.charging && guard++ < 10 / DT) g.update(DT);
  check(prince.charging, 'prince never started charging');
  check(play(g, 1, 'zap', prince.x, prince.y), 'enemy zap deploys on the charging prince');
  check(!prince.charging && prince.chargeDist === 0, 'zap did not cancel and reset the charge');
  // The charge only comes back after the prince runs another 2.5 tiles. Track the travel to the first hit.
  let walked = 0;
  let px = prince.x;
  let py = prince.y;
  let firstDmg = null;
  let last = giant.hp;
  for (let i = 0; i < 9 / DT && firstDmg === null; i++) {
    g.update(DT);
    walked += Math.hypot(prince.x - px, prince.y - py);
    px = prince.x;
    py = prince.y;
    if (giant.hp < last) firstDmg = last - giant.hp;
    last = giant.hp;
  }
  check(firstDmg !== null, 'prince never hit the giant after the zap');
  if (firstDmg !== null) {
    const want = walked >= 3.0 ? 784 : 392;
    check(near(firstDmg, want, 0.5), `hit ${firstDmg} after walking ${walked.toFixed(2)} tiles since the zap, want ${want}`);
  }
});

// ---- 13. Inferno ramp ------------------------------------------------------

function infernoSetup(seed) {
  const g = makeGame(['infernotower', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons'], seed);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 0, 'infernotower', 9, 19), 'inferno tower deploys');
  check(play(g, 1, 'giant', 9, 13.5), 'enemy giant deploys');
  const [giant] = unitsOf(g, 'giant', 1);
  freeze(giant);
  const inferno = unitsOf(g, 'infernotower', 0)[0];
  step(g, 1.1);
  return { g, inferno, giant };
}

test('13a inferno ramps 42 -> 127 -> 422 on a locked giant', () => {
  const { g, giant } = infernoSetup(41);
  const drops = [];
  let last = giant.hp;
  for (let i = 0; i < 7 / DT && !giant.dead; i++) {
    g.update(DT);
    if (giant.hp < last) drops.push({ t: g.time, dmg: Math.round(last - giant.hp) });
    last = giant.hp;
  }
  const first = drops[0];
  check(first && first.dmg === 42, `first inferno hit ${first && first.dmg}, want 42`);
  const mid = drops.find((d) => d.dmg === 127);
  const top = drops.find((d) => d.dmg === 422);
  check(mid, 'inferno never reached 127 damage per hit');
  check(top, 'inferno never reached 422 damage per hit');
  if (first && mid && top) check(first.t < mid.t && mid.t < top.t, 'inferno stages out of order');
});

test('13b a zap resets the inferno ramp to 42', () => {
  const { g, inferno, giant } = infernoSetup(42);
  step(g, 4.5);
  check(inferno.rampStage === 2, `inferno stage ${inferno.rampStage} before zap, want 2`);
  check(play(g, 1, 'zap', inferno.x, inferno.y), 'enemy zap deploys on the inferno tower');
  check(inferno.rampStage === 0, `zap left inferno at stage ${inferno.rampStage}`);
  let firstAfter = null;
  let last = giant.hp;
  for (let i = 0; i < 3 / DT && firstAfter === null; i++) {
    g.update(DT);
    if (giant.hp < last) firstAfter = last - giant.hp;
    last = giant.hp;
  }
  check(firstAfter !== null && near(firstAfter, 42, 0.5), `first hit after zap ${firstAfter}, want 42`);
});

test('13c retargeting the inferno resets the ramp to 35', () => {
  const { g, inferno, giant } = infernoSetup(43);
  step(g, 4.5);
  check(inferno.rampStage === 2, `inferno stage ${inferno.rampStage} before retarget, want 2`);
  // The locked giant dies; a second giant steps into range and the inferno retargets to it.
  giant.hp = 1;
  check(play(g, 1, 'giant', 9, 13), 'second enemy giant deploys');
  const giant2 = unitsOf(g, 'giant', 1).find((x) => x !== giant);
  freeze(giant2);
  place(giant2, 9, 15.8);
  step(g, 1.2);
  check(giant.dead, 'first giant did not die');
  check(inferno.target === giant2, `inferno did not retarget to the second giant (target ${inferno.target && inferno.target.unitId})`);
  check(inferno.rampStage === 0, `retarget left inferno at stage ${inferno.rampStage}`);
});

// ---- 14. Ice Spirit --------------------------------------------------------

test('14 ice spirit freezes units in its splash for about 1.2 s and dies', () => {
  const g = makeGame(['icespirit', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons']);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 0, 'icespirit', 9, 20), 'ice spirit deploys');
  check(play(g, 1, 'giant', 9, 13), 'enemy giant deploys');
  const [spirit] = unitsOf(g, 'icespirit', 0);
  const [giant] = unitsOf(g, 'giant', 1);
  // Teleport the giant into the spirit's path on its own side (test setup only).
  place(giant, 9, 18.0);
  freeze(giant);
  freeze(spirit);
  step(g, 1.5);
  // Ice spirit is kamikaze: it should be dead after it attacked.
  check(spirit.dead, 'ice spirit did not die on its attack');
  check(giant.freezeT > 0.5, `giant freezeT ${giant.freezeT.toFixed(2)} after the impact, want about 1.2`);
  const frozenAt = { x: giant.x, y: giant.y };
  step(g, 0.5);
  check(near(giant.x, frozenAt.x, 1e-9) && near(giant.y, frozenAt.y, 1e-9), 'giant moved while frozen');
  step(g, 1.5);
  check(giant.freezeT === 0, `giant still frozen after 2.5 s (${giant.freezeT.toFixed(2)})`);
});

// ---- 15. Balloon -----------------------------------------------------------

test('15a balloon hits its tower repeatedly while alive', () => {
  const g = makeGame(['balloon', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'], FILL);
  g.players[0].elixir = 10;
  check(play(g, 0, 'balloon', 14.5, 19.5), 'balloon deploys');
  step(g, 1.1);
  const [b] = unitsOf(g, 'balloon', 0);
  const tower = towerOf(g, 1, 'princess', 1);
  place(b, 14.5, 8.7); // in melee (range 0.1) of the right princess tower
  let hits = 0;
  let last = tower.hp;
  for (let i = 0; i < 8 / DT && !b.dead; i++) {
    g.update(DT);
    if (tower.hp < last) hits++;
    last = tower.hp;
  }
  check(hits >= 2, `balloon landed ${hits} tower hits while alive, want at least 2`);
});

test('15b balloon death bomb damages nearby ground units', () => {
  const g = makeGame(['balloon', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['skeletons', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon']);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 0, 'balloon', 9, 19.5), 'balloon deploys');
  check(play(g, 1, 'skeletons', 9, 13), 'enemy skeleton deploys');
  step(g, 1.1);
  const [b] = unitsOf(g, 'balloon', 0);
  const [sk] = unitsOf(g, 'skeleton', 1);
  // Freeze the balloon over (14.5, 12) with 1 hp, inside the right princess tower's range; the tower's arrow kills it.
  place(b, 14.5, 12);
  b.hp = 1;
  freeze(b);
  place(sk, 14.5, 12.8);
  freeze(sk);
  step(g, 3);
  check(b.dead, 'balloon was not killed by the tower');
  check(sk.dead, `death bomb did not kill the skeleton beside it (hp ${sk.hp})`);
});

// ---- 16. Golem -------------------------------------------------------------

test('16 golem death spawns 2 golemites and deals death damage', () => {
  const g = makeGame(['golem', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons']);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 0, 'golem', 9, 19.5), 'golem deploys');
  check(play(g, 1, 'giant', 9, 13), 'enemy giant deploys');
  step(g, 1.1);
  const [golem] = unitsOf(g, 'golem', 0);
  const [giant] = unitsOf(g, 'giant', 1);
  place(golem, 9, 19.5);
  place(giant, 9, 18.0); // 1.5 tiles from the golem: inside the golem's death radius and the zap
  freeze(giant);
  freeze(golem);
  golem.hp = 1;
  const hp0 = giant.hp;
  // Enemy zap (team 1) finishes the golem at its spot. The giant is on the zap caster's team, so only death damage hits it.
  check(play(g, 1, 'zap', 9, 19.5), 'enemy zap deploys on the golem');
  check(golem.dead, 'golem did not die');
  const golemites = unitsOf(g, 'golemite', 0);
  check(golemites.length === 2, `${golemites.length} golemites spawned, want 2`);
  check(near(hp0 - giant.hp, CR.UNITS.golem.deathDamage.damage, 0.5),
    `giant took ${hp0 - giant.hp} from the death blast, want ${CR.UNITS.golem.deathDamage.damage}`);
});

// ---- 17. Spawners and decay ------------------------------------------------

test('17a witch spawns 4 skeletons about every 7 s', () => {
  const g = makeGame(['witch', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'], FILL);
  g.players[0].elixir = 10;
  check(play(g, 0, 'witch', 9, 19.5), 'witch deploys');
  const seen = new Set();
  const bursts = [];
  for (let i = 0; i < 17 / DT; i++) {
    g.update(DT);
    const fresh = g.entities.filter((e) => e.unitId === 'skeleton' && e.team === 0 && !seen.has(e.id));
    if (fresh.length) {
      fresh.forEach((e) => seen.add(e.id));
      bursts.push({ t: g.time, n: fresh.length });
    }
  }
  check(bursts.length >= 2, `witch produced ${bursts.length} bursts in 17 s, want 2 or more`);
  check(bursts.every((b) => b.n === 4), `burst sizes ${bursts.map((b) => b.n)}, want all 4`);
  if (bursts.length >= 2) {
    const gap = bursts[1].t - bursts[0].t;
    check(near(gap, 7, 0.2), `witch burst gap ${gap.toFixed(2)} s, want about 7`);
  }
});

test('17b tombstone spawns 2 skeletons every 3.5 s and 4 on death', () => {
  const g = makeGame(['tombstone', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['skeletons', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon']);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 0, 'tombstone', 9, 19.5), 'tombstone deploys');
  const [ts] = unitsOf(g, 'tombstone', 0);
  const seen = new Set();
  const bursts = [];
  for (let i = 0; i < 10 / DT; i++) {
    g.update(DT);
    const fresh = g.entities.filter((e) => e.unitId === 'skeleton' && e.team === 0 && !seen.has(e.id));
    if (fresh.length) {
      fresh.forEach((e) => seen.add(e.id));
      bursts.push({ t: g.time, n: fresh.length });
    }
  }
  check(bursts.length >= 2, `tombstone produced ${bursts.length} bursts in 10 s, want 2 or more`);
  check(bursts.every((b) => b.n === 2), `tombstone burst sizes ${bursts.map((b) => b.n)}, want all 2`);
  if (bursts.length >= 2) {
    const gap = bursts[1].t - bursts[0].t;
    check(near(gap, 3.5, 0.15), `tombstone gap ${gap.toFixed(2)} s, want about 3.5`);
  }
  // Death: no further spawns from the timer, so the 4 death skeletons are the only new ones.
  ts.spawnTimer = 99;
  ts.hp = 1; // the enemy zap (192) finishes it
  const before = g.entities.filter((e) => e.unitId === 'skeleton' && e.team === 0).length;
  check(play(g, 1, 'zap', 9, 19.5), 'enemy zap deploys on the tombstone');
  check(ts.dead, 'tombstone did not die');
  const after = g.entities.filter((e) => e.unitId === 'skeleton' && e.team === 0).length;
  check(after - before === 4, `tombstone death spawned ${after - before} skeletons, want 4`);
});

test('17c buildings decay to 0 hp over their lifetime', () => {
  const g = makeGame(['cannon', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'], FILL);
  g.players[0].elixir = 10;
  check(play(g, 0, 'cannon', 9, 22), 'cannon deploys');
  const [c] = unitsOf(g, 'cannon', 0);
  const maxHp = c.maxHp;
  step(g, 15);
  const want = maxHp * (1 - 15 / CR.UNITS.cannon.lifetime);
  check(near(c.hp, want, maxHp * 0.01), `cannon hp ${c.hp.toFixed(0)} after 15 s, want about ${want.toFixed(0)}`);
  step(g, 15.5);
  check(c.dead || c.hp <= 0, `cannon still alive after its lifetime (hp ${c.hp.toFixed(0)})`);
});

// ---- 18. Spells ------------------------------------------------------------

test('18a fireball deals 689 to a troop and 207 to a crown tower', () => {
  const g = makeGame(['fireball', 'archers', 'zap', 'musketeer', 'giant', 'knight', 'minipekka', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons']);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 1, 'giant', 9, 13), 'enemy giant deploys');
  const [giant] = unitsOf(g, 'giant', 1);
  freeze(giant);
  step(g, 1.1);
  const hp0 = giant.hp;
  check(play(g, 0, 'fireball', 9, 13), 'fireball on the giant');
  step(g, 2);
  check(near(hp0 - giant.hp, CR.CARDS.fireball.damage, 0.5), `fireball did ${hp0 - giant.hp} to a troop, want 689`);

  const g2 = makeGame(['fireball', 'archers', 'zap', 'musketeer', 'giant', 'knight', 'minipekka', 'babydragon'], FILL);
  g2.players[0].elixir = 10;
  const tower = towerOf(g2, 1, 'princess', 0);
  const th0 = tower.hp;
  check(play(g2, 0, 'fireball', 3.5, 6.5), 'fireball on the princess tower');
  step(g2, 3); // flies 23 tiles from the king tower at 10 tiles/s
  check(near(th0 - tower.hp, CR.CARDS.fireball.towerDamage, 0.5), `fireball did ${th0 - tower.hp} to a tower, want 207`);
});

test('18b arrows hit air units', () => {
  const g = makeGame(['arrows', 'archers', 'zap', 'musketeer', 'giant', 'knight', 'minipekka', 'babydragon'],
    ['babydragon', 'archers', 'giant', 'musketeer', 'minipekka', 'fireball', 'zap', 'knight']);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 1, 'babydragon', 9, 13), 'enemy baby dragon deploys');
  const [d] = unitsOf(g, 'babydragon', 1);
  freeze(d);
  step(g, 1.1);
  const hp0 = d.hp;
  check(play(g, 0, 'arrows', 9, 13), 'arrows on the dragon');
  step(g, 2.5);
  check(near(hp0 - d.hp, CR.CARDS.arrows.damage, 0.5), `arrows did ${hp0 - d.hp} to the air dragon, want 366`);
});

test('18c the log hits ground only and pushes a small unit back', () => {
  const g = makeGame(['log', 'archers', 'zap', 'musketeer', 'giant', 'knight', 'minipekka', 'babydragon'],
    ['knight', 'minions', 'giant', 'musketeer', 'minipekka', 'fireball', 'zap', 'babydragon']);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 1, 'knight', 9, 13), 'enemy knight deploys');
  check(play(g, 1, 'minions', 9.5, 13.5), 'enemy minions deploy');
  step(g, 1.1);
  const [k] = unitsOf(g, 'knight', 1);
  const [m] = unitsOf(g, 'minion', 1);
  // Team 1's side, out of team 0's tower range, so only the log can hurt them.
  place(k, 9, 12.5);
  place(m, 9.5, 12.5);
  freeze(k);
  freeze(m);
  const kHp = k.hp;
  const mHp = m.hp;
  const kY = k.y;
  // Log dropped at (9, 14) rolls toward smaller y and runs into the knight at y 12.5.
  check(play(g, 0, 'log', 9, 14), 'log deploys');
  step(g, 1.5);
  check(near(kHp - k.hp, CR.CARDS.log.damage, 0.5), `log did ${kHp - k.hp} to the knight, want 290`);
  check(near(kY - k.y, CR.CARDS.log.knockback, 0.05), `knight pushed ${(kY - k.y).toFixed(2)} tiles, want ${CR.CARDS.log.knockback}`);
  check(m.hp === mHp && !m.dead, 'log hit an air minion');
});

test('18d freeze stops a locked attacker for about 4 s', () => {
  const g = makeGame(['freeze', 'archers', 'zap', 'musketeer', 'giant', 'knight', 'minipekka', 'babydragon'],
    ['knight', 'archers', 'giant', 'musketeer', 'minipekka', 'fireball', 'zap', 'babydragon']);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 0, 'giant', 9, 18.5), 'giant deploys as the victim');
  check(play(g, 1, 'knight', 9, 14.5), 'enemy knight deploys');
  step(g, 1.1);
  const [giant] = unitsOf(g, 'giant', 0);
  const [k] = unitsOf(g, 'knight', 1);
  freeze(giant);
  place(k, 9, 19.9); // in melee range of the giant, on the giant's side
  step(g, 0.5); // knight locks on and starts its hits
  check(k.locked, 'knight did not lock on the giant before the freeze');
  check(play(g, 0, 'freeze', k.x, k.y), 'freeze deploys on the knight');
  const castT = g.time;
  check(near(k.freezeT, CR.CARDS.freeze.freeze, 0.1), `knight freezeT ${k.freezeT.toFixed(2)} after freeze, want about 4`);
  let firstHit = null;
  let last = giant.hp;
  for (let i = 0; i < 8 / DT && firstHit === null; i++) {
    g.update(DT);
    if (giant.hp < last) firstHit = g.time;
    last = giant.hp;
  }
  check(firstHit !== null, 'knight never hit the giant after the freeze');
  if (firstHit !== null) {
    const gap = firstHit - castT;
    check(gap >= CR.CARDS.freeze.freeze - 0.2, `knight hit ${gap.toFixed(2)} s after freeze, want at least about 4`);
  }
});

test('18e poison ticks about 8 times over 8 s and slows units inside', () => {
  const g = makeGame(['poison', 'archers', 'zap', 'musketeer', 'giant', 'knight', 'minipekka', 'babydragon'],
    ['giant', 'knight', 'zap', 'musketeer', 'minipekka', 'fireball', 'archers', 'babydragon']);
  g.players[0].elixir = 10;
  g.players[1].elixir = 10;
  check(play(g, 1, 'giant', 9, 13), 'enemy giant deploys');
  check(play(g, 1, 'knight', 10.6, 13), 'enemy knight deploys');
  step(g, 1.1);
  const [giant] = unitsOf(g, 'giant', 1);
  const [k] = unitsOf(g, 'knight', 1);
  freeze(giant);
  freeze(k);
  const gHp = giant.hp;
  check(play(g, 0, 'poison', 9.8, 13), 'poison deploys over both');
  step(g, 0.5);
  check(near(k.slowAmount, CR.CARDS.poison.slow, 1e-9), `slow ${k.slowAmount} inside poison, want ${CR.CARDS.poison.slow}`);
  step(g, 9);
  const ticks = (gHp - giant.hp) / CR.CARDS.poison.dps;
  check(Math.abs(ticks - 8) <= 1, `poison did ${ticks.toFixed(2)} ticks to the giant over 8 s, want about 8`);
  check(!g.spells.some((s) => s.kind === 'poison'), 'poison cloud still lingers after 8 s');
  step(g, 0.5);
  check(k.slowAmount === 0, `slow ${k.slowAmount} after the poison ends, want 0`);
});

test('18f goblin barrel lands 3 goblins after its travel time', () => {
  const g = makeGame(['goblinbarrel', 'archers', 'zap', 'musketeer', 'giant', 'knight', 'minipekka', 'babydragon'], FILL);
  g.players[0].elixir = 10;
  check(play(g, 0, 'goblinbarrel', 9, 20), 'barrel deploys');
  // King tower (9, 29) to (9, 20) is 9 tiles at 6 tiles/s.
  const expect = 9 / CR.CARDS.goblinbarrel.travelSpeed;
  let arrivedAt = null;
  let count = 0;
  for (let i = 0; i < 4 / DT && arrivedAt === null; i++) {
    g.update(DT);
    const goblins = unitsOf(g, 'goblin', 0);
    if (goblins.length > 0) {
      arrivedAt = g.time;
      count = goblins.length;
    }
  }
  check(arrivedAt !== null, 'no goblins landed');
  if (arrivedAt !== null) {
    check(near(arrivedAt, expect, 0.12), `goblins landed at ${arrivedAt.toFixed(2)} s, want about ${expect.toFixed(2)}`);
  }
  check(count === CR.CARDS.goblinbarrel.spawnCount, `${count} goblins landed, want ${CR.CARDS.goblinbarrel.spawnCount}`);
});

test('18g rocket flies slower than fireball', () => {
  function flightTime(cardId) {
    const g = makeGame([cardId, 'archers', 'zap', 'musketeer', 'giant', 'knight', 'minipekka', 'babydragon'], FILL);
    g.players[0].elixir = 10;
    check(play(g, 0, cardId, 9, 20), `${cardId} deploys`);
    const s = g.spells.find((x) => x.cardId === cardId);
    const t0 = g.time;
    for (let i = 0; i < 5 / DT && s && !s.done; i++) g.update(DT);
    return s ? g.time - t0 : Infinity;
  }
  const fb = flightTime('fireball');
  const rk = flightTime('rocket');
  check(rk > fb + 0.3, `rocket took ${rk.toFixed(2)} s, fireball ${fb.toFixed(2)} s, want rocket clearly slower`);
  check(near(fb, 9 / CR.CARDS.fireball.travelSpeed, 0.12), `fireball flight ${fb.toFixed(2)} s, want about ${(9 / CR.CARDS.fireball.travelSpeed).toFixed(2)}`);
});

// ---- 19. King tower --------------------------------------------------------

test('19a inactive king tower does not shoot', () => {
  const g = makeGame(['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'knight', 'fireball', 'babydragon'], FILL);
  g.players[0].elixir = 10;
  check(play(g, 0, 'giant', 9, 19), 'giant deploys');
  step(g, 1.1);
  const [giant] = unitsOf(g, 'giant', 0);
  place(giant, 9, 12.5); // inside the enemy king's range (test setup only)
  freeze(giant);
  const king = towerOf(g, 1, 'king');
  const princess = towerOf(g, 1, 'princess', 0);
  step(g, 3);
  check(!king.active, 'king woke up with no damage taken');
  check(king.lastAttackT < 0, 'inactive king fired');
  check(princess.lastAttackT >= 0, 'princess did not fire at the giant (test setup not in range)');
});

test('19b king activates when hit by a spell', () => {
  const g = makeGame(['zap', 'archers', 'giant', 'musketeer', 'minipekka', 'knight', 'fireball', 'babydragon'], FILL);
  g.players[0].elixir = 10;
  const king = towerOf(g, 1, 'king');
  check(!king.active, 'king starts inactive');
  check(play(g, 0, 'zap', 9, 3), 'zap deploys on the king tower');
  check(king.active, 'king did not activate after a spell hit');
  check(g.events.some((e) => e.type === 'kingActivate' && e.team === 1), 'no kingActivate event');
});

test('19c king activates when a princess tower falls', () => {
  const g = makeGame(['zap', 'archers', 'giant', 'musketeer', 'minipekka', 'knight', 'fireball', 'babydragon'], FILL);
  g.players[0].elixir = 10;
  const king = towerOf(g, 1, 'king');
  const princess = towerOf(g, 1, 'princess', 1);
  princess.hp = 1;
  check(play(g, 0, 'zap', 14.5, 6.5), 'zap finishes the right princess');
  check(princess.dead, 'princess did not fall');
  check(king.active, 'king did not activate when its princess fell');
});

// ---- 20. Pocket ------------------------------------------------------------

test('20 pocket opens in the lane of a fallen enemy princess tower only', () => {
  const g = makeGame(['zap', 'archers', 'giant', 'musketeer', 'minipekka', 'knight', 'fireball', 'babydragon'], FILL);
  g.players[0].elixir = 10;
  check(!g.isInDeployZone(0, 'knight', 3.5, 12), 'pocket open before the princess fell');
  const princess = towerOf(g, 1, 'princess', 0);
  princess.hp = 1;
  check(play(g, 0, 'zap', 3.5, 6.5), 'zap finishes the left princess');
  check(princess.dead, 'left princess did not fall');
  check(g.isInDeployZone(0, 'knight', 3.5, 12), 'no pocket at (3.5, 12) in the fallen lane');
  check(!g.isInDeployZone(0, 'knight', 14.5, 12), 'pocket opened in the lane whose princess still stands');
});

// ---- 21. Collision ---------------------------------------------------------

test('21a two giants deployed on the same spot separate', () => {
  const g = makeGame(['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'knight', 'fireball', 'babydragon'], FILL);
  g.players[0].elixir = 10;
  check(play(g, 0, 'giant', 9, 20), 'first giant deploys');
  g.players[0].elixir = 10;
  check(play(g, 0, 'giant', 9, 20), 'second giant deploys on the same spot');
  step(g, 1);
  const gs = unitsOf(g, 'giant', 0);
  check(gs.length === 2, `${gs.length} giants alive, want 2`);
  if (gs.length === 2) {
    const d = Math.hypot(gs[0].x - gs[1].x, gs[0].y - gs[1].y);
    const want = gs[0].r + gs[1].r;
    check(d >= want - 0.02, `giants still overlap: centre distance ${d.toFixed(2)}, want at least ${want}`);
  }
});

test('21b a giant pushes a knight further than it moves itself (mass)', () => {
  const g = makeGame(['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'knight', 'fireball', 'babydragon'], FILL);
  g.players[0].elixir = 10;
  check(play(g, 0, 'giant', 9, 19), 'giant deploys');
  g.players[0].elixir = 10;
  check(play(g, 0, 'knight', 9, 22), 'knight deploys');
  step(g, 1.1);
  const [gi] = unitsOf(g, 'giant', 0);
  const [k] = unitsOf(g, 'knight', 0);
  freeze(gi);
  freeze(k);
  place(gi, 9, 20.0);
  place(k, 9, 19.2); // overlapping, knight is on the giant's near side
  const g0 = { x: gi.x, y: gi.y };
  const k0 = { x: k.x, y: k.y };
  step(g, 5 * DT);
  const dg = Math.hypot(gi.x - g0.x, gi.y - g0.y);
  const dk = Math.hypot(k.x - k0.x, k.y - k0.y);
  check(dk > dg, `knight moved ${dk.toFixed(3)} but giant moved ${dg.toFixed(3)}, want the knight to move more`);
});

// ---- 22. Match end --------------------------------------------------------

test('22a more crowns at 3:00 wins', () => {
  const g = makeGame();
  g.players[0].crowns = 1;
  g.time = 179.99;
  g.update(DT);
  check(g.phase === 'ended', `phase ${g.phase} at 3:00 with a crown lead`);
  check(g.result && g.result.winner === 0 && g.result.reason === 'crowns', `result ${JSON.stringify(g.result)}`);
});

test('22b tied crowns at 3:00 go to overtime with 2 minutes', () => {
  const g = makeGame();
  g.time = 179.99;
  g.update(DT);
  check(g.phase === 'overtime', `phase ${g.phase}, want overtime when crowns are tied`);
  check(near(g.timeLeft, 120, 0.1), `overtime timeLeft ${g.timeLeft}, want 120`);
  check(g.result === null, 'match ended at the tie instead of going to overtime');
});

test('22c the first crown in overtime ends the match', () => {
  const g = makeGame(['zap', 'archers', 'giant', 'musketeer', 'minipekka', 'knight', 'fireball', 'babydragon'], FILL);
  g.players[0].elixir = 10;
  g.time = 179.99;
  g.update(DT);
  check(g.phase === 'overtime', 'not in overtime');
  const princess = towerOf(g, 1, 'princess', 1);
  princess.hp = 1;
  check(play(g, 0, 'zap', 14.5, 6.5), 'zap finishes a princess in overtime');
  check(g.phase === 'ended', 'first crown did not end overtime');
  check(g.result && g.result.winner === 0 && g.result.reason === 'crowns', `result ${JSON.stringify(g.result)}`);
});

test('22d overtime tiebreak: lowest tower hp loses', () => {
  const g = makeGame();
  g.time = 179.99;
  g.update(DT);
  // Team 0's lowest tower is at 1000, team 1's lowest is at 2000.
  g.entities.forEach((e) => {
    if (e.kind !== 'tower') return;
    if (e.team === 0) e.hp = 1000;
    else e.hp = 2000;
  });
  g.time = g.overtimeStart + 120;
  g.update(DT);
  check(g.phase === 'ended', 'overtime did not end after 2 minutes');
  check(g.result && g.result.winner === 1 && g.result.reason === 'tiebreak',
    `tiebreak result ${JSON.stringify(g.result)}, want winner 1 (team 0 had less tower hp)`);
});

test('22e destroying the king tower ends the match at once with 3 crowns', () => {
  const g = makeGame(['zap', 'archers', 'giant', 'musketeer', 'minipekka', 'knight', 'fireball', 'babydragon'], FILL);
  g.players[0].elixir = 10;
  const king = towerOf(g, 1, 'king');
  king.hp = 1;
  check(play(g, 0, 'zap', 9, 3), 'zap finishes the king tower');
  check(king.dead, 'king tower did not fall');
  check(g.phase === 'ended', 'king tower did not end the match');
  check(g.players[0].crowns === 3, `attacker crowns ${g.players[0].crowns}, want 3`);
  check(g.result && g.result.winner === 0 && g.result.reason === 'king', `result ${JSON.stringify(g.result)}`);
});

// ---- 23. Default walk goal -------------------------------------------------

test('23a unit with nothing in sight walks to its lane princess, then the king', () => {
  const g = makeGame(['knight', 'archers', 'zap', 'musketeer', 'minipekka', 'giant', 'fireball', 'babydragon'], FILL);
  g.players[0].elixir = 10;
  check(play(g, 0, 'knight', 3.5, 17.5), 'knight deploys in lane 0');
  step(g, 1.1);
  const [k] = unitsOf(g, 'knight', 0);
  const princessL = towerOf(g, 1, 'princess', 0);
  const princessR = towerOf(g, 1, 'princess', 1);
  const king = towerOf(g, 1, 'king');
  let sawRightPrincess = false;
  let firstTarget = null;
  let yPrev = k.y;
  let monotone = true;
  for (let i = 0; i < 4 / DT; i++) {
    g.update(DT);
    if (k.target && firstTarget === null) firstTarget = k.target;
    if (k.target === princessR) sawRightPrincess = true;
    if (k.y > yPrev + 1e-6) monotone = false;
    yPrev = k.y;
  }
  check(monotone, 'knight did not walk steadily toward the enemy side');
  check(!sawRightPrincess, 'lane 0 knight targeted the right princess tower');
  check(firstTarget === princessL || firstTarget === null, `first target ${firstTarget && firstTarget.towerType}`);
  // Now drop the lane princess and check the goal switches to the king.
  princessL.hp = 1;
  check(play(g, 0, 'zap', 3.5, 6.5), 'zap finishes the lane princess');
  check(princessL.dead, 'lane princess did not fall');
  const d0 = Math.hypot(k.x - king.x, k.y - king.y);
  step(g, 3);
  const d1 = Math.hypot(k.x - king.x, k.y - king.y);
  check(d1 < d0 - 0.5, `knight did not head for the king after the lane princess fell (dist ${d0.toFixed(2)} -> ${d1.toFixed(2)})`);
  check(!k.target || k.target !== princessL, 'knight still targets the dead princess');
});

// ---- 24. Air over the river ------------------------------------------------

test('24 air units fly straight over the river, no bridge detour', () => {
  const g = makeGame(['babydragon', 'archers', 'zap', 'musketeer', 'minipekka', 'knight', 'fireball', 'giant'], FILL);
  g.players[0].elixir = 10;
  check(play(g, 0, 'babydragon', 9, 20), 'baby dragon deploys');
  step(g, 1.1);
  const [d] = unitsOf(g, 'babydragon', 0);
  const p0 = { x: d.x, y: d.y };
  // Straight line from the start point to the right princess tower (the goal for x >= 9).
  const goal = { x: 14.5, y: 6.5 };
  let inRiver = 0;
  let maxDev = 0;
  for (let i = 0; i < 6 / DT && d.y > 14; i++) {
    g.update(DT);
    if (d.y > RIVER_TOP && d.y < RIVER_BOTTOM) {
      inRiver++;
      const t = (p0.y - d.y) / (p0.y - goal.y);
      const lineX = p0.x + (goal.x - p0.x) * t;
      maxDev = Math.max(maxDev, Math.abs(d.x - lineX));
    }
  }
  check(d.y < RIVER_TOP, 'baby dragon never got across the river');
  check(inRiver > 0, 'baby dragon never sampled the river');
  check(maxDev < 0.3, `air unit left the straight line by ${maxDev.toFixed(2)} tiles`);
});

// ---- 25. Mechanics round: new cards ----------------------------------------

// Deploys with elixir topped up so a test can play several cards in a row.
function dep(g, team, cardId, x, y) {
  g.players[team].elixir = 10;
  return play(g, team, cardId, x, y);
}

test('25 lightning hits the 3 highest-hp enemies in radius, stuns them, leaves the rest', () => {
  const g = makeGame(['lightning', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons'], 51);
  check(dep(g, 1, 'giant', 9, 9), 'enemy giant deploys');
  check(dep(g, 1, 'knight', 9.8, 9), 'enemy knight deploys');
  check(dep(g, 1, 'musketeer', 8.2, 9), 'enemy musketeer deploys');
  check(dep(g, 1, 'archers', 9, 10.5), 'enemy archers deploy');
  check(dep(g, 1, 'skeletons', 9.2, 8), 'enemy skeletons deploy');
  const giant = unitsOf(g, 'giant', 1)[0];
  const knight = unitsOf(g, 'knight', 1)[0];
  const mus = unitsOf(g, 'musketeer', 1)[0];
  const archers = unitsOf(g, 'archer', 1);
  const skels = unitsOf(g, 'skeleton', 1);
  check(dep(g, 0, 'lightning', 9, 9), 'lightning deploys on the cluster');
  check(giant.hp < 4091, `giant not hit (hp ${giant.hp})`);
  check(knight.hp < 1766, `knight not hit (hp ${knight.hp})`);
  check(mus.dead || mus.hp < 720, 'musketeer not hit');
  check(knight.stunT > 0.4, `knight not stunned (stunT ${knight.stunT})`);
  check(archers.every((a) => a.hp === 304), 'a lower-hp archer was hit');
  check(skels.every((s) => s.hp === 81), 'a lower-hp skeleton was hit');
});

test('26 electro wizard zaps 2 targets per attack and stuns each; deploy zap hits nearby units', () => {
  const g = makeGame(['electrowizard', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons'], 52);
  // Deploy zap: an enemy giant sits 1.3 tiles from the drop point before the wizard lands.
  check(dep(g, 1, 'giant', 9, 12), 'enemy giant deploys');
  const giant = unitsOf(g, 'giant', 1)[0];
  place(giant, 9, 18.2);
  freeze(giant);
  const hpBefore = giant.hp;
  check(dep(g, 0, 'electrowizard', 9, 19.5), 'electro wizard deploys');
  check(near(hpBefore - giant.hp, 192, 0.5), `deploy zap dealt ${hpBefore - giant.hp}, want 192`);
  place(giant, 2, 10); // out of the wizard's sight so it picks the knights
  // Two enemy knights in attack range, frozen so they only take hits.
  check(dep(g, 1, 'knight', 8.6, 14.2), 'enemy knight A deploys');
  check(dep(g, 1, 'knight', 9.4, 14.2), 'enemy knight B deploys');
  const [ka, kb] = unitsOf(g, 'knight', 1);
  freeze(ka);
  freeze(kb);
  const ha = ka.hp;
  const hb = kb.hp;
  step(g, 4);
  const dA = ha - ka.hp;
  const dB = hb - kb.hp;
  check(dA > 0 && near(dA, dB, 0.01), `both knights should take the same zap hits (A ${dA}, B ${dB})`);
  check(dA > 0 && near(dA % 110, 0, 0.01), `zap damage not a multiple of 110 (A ${dA})`);
});

test('27 miner deploys anywhere but the river, burrows in after a travel delay, and does 25 percent damage to towers', () => {
  const g = makeGame(['miner', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons'], 53);
  check(g.isInDeployZone(0, 'miner', 9, 8), 'miner zone rejects the enemy half');
  check(!g.isInDeployZone(0, 'miner', 9, 16), 'miner zone accepts the river');
  check(!g.isInDeployZone(0, 'knight', 9, 8), 'knight zone accepts the enemy half');
  check(dep(g, 0, 'miner', 3.5, 9.5), 'miner deploys in the enemy half');
  const m = unitsOf(g, 'miner', 0)[0];
  const want = 0.5 + Math.hypot(9 - 3.5, 29 - 9.5) / 12;
  check(m && near(m.deployT, want, 0.05), `burrow delay ${m && m.deployT}, want ${want.toFixed(2)}`);
  const tower = towerOf(g, 1, 'princess', 0);
  let first = null;
  let last = tower.hp;
  for (let i = 0; i < 8 / DT && first === null; i++) {
    g.update(DT);
    if (tower.hp < last) first = last - tower.hp;
    last = tower.hp;
  }
  check(first !== null && near(first, 193 * 0.25, 1), `first hit on the tower ${first}, want about 48`);
});

test('28 mega knight deals 444 on landing and jumps onto a target 3.5 to 5 tiles away', () => {
  // Landing: an enemy knight 1.8 tiles from the drop point takes the 444 landing hit at once.
  const g1 = makeGame(['megaknight', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons'], 54);
  check(dep(g1, 1, 'knight', 9, 12), 'enemy knight deploys');
  const near1 = unitsOf(g1, 'knight', 1)[0];
  place(near1, 9, 17.2);
  freeze(near1);
  const before = near1.hp;
  check(dep(g1, 0, 'megaknight', 9, 19), 'mega knight deploys');
  check(near(before - near1.hp, 444, 0.5), `landing hit ${before - near1.hp}, want 444`);

  // Jump: an enemy knight 4.25 tiles (edge) away is jumped onto after the 1 s deploy and takes 444 on landing.
  const g2 = makeGame(['megaknight', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons'], 55);
  check(dep(g2, 1, 'knight', 9, 13.5), 'far enemy knight deploys');
  const far = unitsOf(g2, 'knight', 1)[0];
  freeze(far);
  check(dep(g2, 0, 'megaknight', 9, 19), 'mega knight deploys for the jump');
  const mk = unitsOf(g2, 'megaknight', 0)[0];
  const hp0 = far.hp;
  step(g2, 2.2);
  check(near(hp0 - far.hp, 444, 0.5), `jump landing hit ${hp0 - far.hp}, want 444`);
  check(Math.hypot(mk.x - far.x, mk.y - far.y) < 1.5, `mega knight did not land next to the target (dist ${Math.hypot(mk.x - far.x, mk.y - far.y).toFixed(2)})`);
});

test('29 bandit dashes 3.5 to 6 tiles to a target and takes no damage while dashing', () => {
  const g = makeGame(['bandit', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons'], 56);
  check(dep(g, 1, 'knight', 9, 13.5), 'enemy knight deploys');
  const knight = unitsOf(g, 'knight', 1)[0];
  freeze(knight);
  check(dep(g, 0, 'bandit', 9, 19), 'bandit deploys');
  const bandit = unitsOf(g, 'bandit', 0)[0];
  const kHp = knight.hp;
  let guard = 0;
  while (!bandit.dash && guard++ < 6 / DT) g.update(DT);
  check(!!bandit.dash, 'bandit never started a dash');
  if (bandit.dash) {
    const bHp = bandit.hp;
    check(dep(g, 1, 'zap', bandit.x, bandit.y), 'enemy zap deploys on the dashing bandit');
    check(bandit.hp === bHp, `dashing bandit took ${bHp - bandit.hp} damage`);
  }
  // The first hit on the knight is the landing (200); its melee swing follows 0.4 s later.
  let firstDrop = null;
  let last = knight.hp;
  for (let i = 0; i < 3 / DT && firstDrop === null; i++) {
    g.update(DT);
    if (knight.hp < last) firstDrop = last - knight.hp;
    last = knight.hp;
  }
  check(firstDrop !== null && near(firstDrop, 200, 0.5), `landing hit on the knight ${firstDrop}, want 200`);
  check(kHp - knight.hp > 0, 'knight was never hit');
});

test('30 tornado pulls enemy troops to its centre over 1.05 s, deals small damage, and wakes an inactive king', () => {
  const g = makeGame(['tornado', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons'], 57);
  check(dep(g, 1, 'giant', 9, 9), 'enemy giant deploys');
  const giant = unitsOf(g, 'giant', 1)[0];
  freeze(giant);
  const king = towerOf(g, 1, 'king');
  check(!king.active, 'enemy king starts inactive');
  const hp0 = giant.hp;
  check(dep(g, 0, 'tornado', 9, 12), 'tornado deploys');
  step(g, 0.5);
  const d = Math.hypot(giant.x - 9, giant.y - 12);
  check(near(d, 3 * (1 - 0.5 / 1.05), 0.1), `distance to centre after 0.5 s is ${d.toFixed(2)}`);
  step(g, 0.6);
  check(Math.hypot(giant.x - 9, giant.y - 12) < 0.1, 'giant was not pulled to the centre');
  const dmg = hp0 - giant.hp;
  check(dmg > 100 && dmg < 112, `tornado damage ${dmg.toFixed(1)}, want about 106`);
  check(king.active, 'pulled giant did not activate the king tower');
});

test('31 tesla stays hidden and untargetable until an enemy enters its range, then fires', () => {
  const g = makeGame(['tesla', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons'], 58);
  check(dep(g, 0, 'tesla', 9, 20), 'tesla deploys');
  const tesla = unitsOf(g, 'tesla', 0)[0];
  step(g, 1.5);
  check(tesla.hidden, 'tesla is not hidden with no enemy near');
  const hp0 = tesla.hp;
  check(dep(g, 1, 'zap', tesla.x, tesla.y), 'enemy zap deploys on the hidden tesla');
  check(tesla.hp === hp0, `hidden tesla took ${hp0 - tesla.hp} damage`);
  check(dep(g, 1, 'knight', 9, 14.5), 'enemy knight deploys in range');
  const knight = unitsOf(g, 'knight', 1)[0];
  freeze(knight);
  step(g, 0.2);
  check(!tesla.hidden, 'tesla did not rise when an enemy entered its range');
  step(g, 3);
  check(knight.hp < 1766, 'revealed tesla did not shoot the knight');
});

test('32 princess shoots from 9 tiles and its arrow splashes a second unit on impact', () => {
  const g = makeGame(['princess', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons'], 59);
  check(dep(g, 1, 'giant', 9, 11), 'enemy giant deploys');
  check(dep(g, 1, 'knight', 9.8, 11), 'enemy knight deploys beside it');
  const giant = unitsOf(g, 'giant', 1)[0];
  const knight = unitsOf(g, 'knight', 1)[0];
  freeze(giant);
  freeze(knight);
  check(dep(g, 0, 'princess', 9, 20), 'princess deploys');
  let shot = null;
  let gLast = giant.hp;
  let kLast = knight.hp;
  for (let i = 0; i < 8 / DT && shot === null; i++) {
    g.update(DT);
    if (giant.hp < gLast) shot = { g: gLast - giant.hp, k: kLast - knight.hp };
    gLast = giant.hp;
    kLast = knight.hp;
  }
  check(shot !== null, 'princess never hit the giant from 9 tiles');
  if (shot) {
    check(near(shot.g, 169, 0.5), `giant took ${shot.g}, want 169`);
    check(near(shot.k, 169, 0.5), `splash on the knight was ${shot.k}, want 169`);
  }
});

test('33 ice wizard slows what it hits for 2.5 s, and its deploy burst hits units beside it', () => {
  const g = makeGame(['icewizard', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons'], 60);
  check(dep(g, 1, 'giant', 9, 12), 'enemy giant deploys');
  const giant = unitsOf(g, 'giant', 1)[0];
  place(giant, 9, 18.2);
  freeze(giant);
  const gHp = giant.hp;
  check(dep(g, 0, 'icewizard', 9, 19.5), 'ice wizard deploys');
  check(near(gHp - giant.hp, 90, 0.5), `deploy burst ${gHp - giant.hp}, want 90`);
  place(giant, 2, 10);
  check(dep(g, 1, 'knight', 9, 14), 'enemy knight deploys in range');
  const knight = unitsOf(g, 'knight', 1)[0];
  freeze(knight);
  let guard = 0;
  while (knight.slowAmount === 0 && guard++ < 8 / DT) g.update(DT);
  check(knight.slowAmount > 0, 'knight was never slowed');
  check(near(knight.slowAmount, 0.35, 0.01), `slow amount ${knight.slowAmount}, want 0.35`);
  check(near(knight.slowT, 2.5, 0.05), `slow lasts ${knight.slowT.toFixed(2)} s, want 2.5`);
});

test('34 lava hound flies past troops to hit buildings only, and on death releases 6 lava pups', () => {
  const g = makeGame(['lavahound', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons'], 61);
  check(dep(g, 1, 'knight', 9, 14), 'enemy knight deploys in the hound\'s path');
  const knight = unitsOf(g, 'knight', 1)[0];
  freeze(knight);
  check(dep(g, 0, 'lavahound', 9, 20), 'lava hound deploys');
  const hound = unitsOf(g, 'lavahound', 0)[0];
  let troopTarget = false;
  for (let i = 0; i < 4 / DT; i++) {
    g.update(DT);
    if (hound.target && hound.target.kind === 'troop') troopTarget = true;
  }
  check(!troopTarget, 'lava hound targeted a troop');
  check(hound.air, 'lava hound is not an air unit');
  hound.hp = 1; // test setup: leave it one zap from death
  check(dep(g, 1, 'zap', hound.x, hound.y), 'enemy zap deploys on the hound');
  check(hound.dead, `hound survived (hp ${hound.hp})`);
  step(g, 0.1);
  const pups = unitsOf(g, 'lavapup', 0);
  check(pups.length === 6, `lava pups after death: ${pups.length}, want 6`);
  check(pups.every((p) => p.air), 'lava pups are not air units');
});

test('35 dark prince shield absorbs damage before hp, and the charge builds after 3.5 tiles', () => {
  const g = makeGame(['darkprince', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons'], 62);
  check(dep(g, 0, 'darkprince', 9, 22), 'dark prince deploys');
  const dp = unitsOf(g, 'darkprince', 0)[0];
  step(g, 1.1);
  check(dp.shield === 150, `shield starts at ${dp.shield}, want 150`);
  const hp0 = dp.hp;
  check(dep(g, 1, 'zap', dp.x, dp.y), 'enemy zap deploys on the dark prince');
  // Zap does 192: the 150 shield takes the first 150, hp takes the other 42.
  check(dp.shield === 0, `shield after zap ${dp.shield}, want 0`);
  check(near(hp0 - dp.hp, 42, 0.5), `hp lost ${hp0 - dp.hp}, want 42`);
  let guard = 0;
  let walked = 0;
  let px = dp.x;
  let py = dp.y;
  while (!dp.charging && guard++ < 10 / DT) {
    g.update(DT);
    walked += Math.hypot(dp.x - px, dp.y - py);
    px = dp.x;
    py = dp.y;
  }
  check(dp.charging, 'dark prince never started its charge');
  check(walked > 3.3 && walked < 3.8, `charge built after ${walked.toFixed(2)} tiles, want about 3.5`);
});

test('36 graveyard drops about 15 skeletons at random points inside its radius over about 10 s', () => {
  const g = makeGame(['graveyard', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons'], 63);
  check(dep(g, 0, 'graveyard', 9, 20), 'graveyard casts');
  const seen = {};
  let maxD = 0;
  for (let i = 0; i < 10 / DT; i++) {
    g.update(DT);
    for (const e of g.entities) {
      if (e.team !== 0 || e.cardId !== 'graveyard' || seen[e.id]) continue;
      seen[e.id] = true;
      maxD = Math.max(maxD, Math.hypot(e.x - 9, e.y - 20));
    }
  }
  const n = Object.keys(seen).length;
  check(n >= 14 && n <= 16, `graveyard spawned ${n} skeletons, want about 15`);
  check(maxD <= 4.6, `a skeleton spawned ${maxD.toFixed(2)} tiles from the centre, want at most 4`);
});

test('37 earthquake does 39 per second to ground units, slows them by half, and ignores air units', () => {
  const g = makeGame(['earthquake', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'babydragon'], 64);
  check(dep(g, 1, 'knight', 9, 12), 'enemy knight deploys');
  check(dep(g, 1, 'babydragon', 9, 12), 'enemy baby dragon deploys');
  const knight = unitsOf(g, 'knight', 1)[0];
  const dragon = unitsOf(g, 'babydragon', 1)[0];
  place(knight, 9, 12);
  place(dragon, 9.5, 12); // away from our towers
  freeze(knight);
  freeze(dragon);
  check(dep(g, 0, 'earthquake', 9, 12), 'earthquake casts');
  step(g, 1.05);
  check(near(1766 - knight.hp, 39, 0.5), `ground knight took ${1766 - knight.hp} in one second, want 39`);
  check(knight.slowAmount === 0.5, `knight slow ${knight.slowAmount}, want 0.5`);
  check(dragon.hp === 1152, `air baby dragon took ${1152 - dragon.hp} damage`);
});

test('38a electro spirit chains its kamikaze through up to 9 nearby enemies, stunning each', () => {
  const g = makeGame(['electrospirit', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons'], 65);
  const xs = [9, 10.5, 12, 13.5];
  for (const x of xs) check(dep(g, 1, 'knight', x, 13.5), `enemy knight at x ${x} deploys`);
  const ks = unitsOf(g, 'knight', 1);
  for (const k of ks) freeze(k);
  check(dep(g, 0, 'electrospirit', 9, 19), 'electro spirit deploys');
  place(unitsOf(g, 'electrospirit', 0)[0], 9, 15.2); // across the river, so it does not walk round by the bridge
  step(g, 3);
  const hit = ks.filter((k) => k.hp === 1766 - 99);
  check(hit.length === 4, `electro spirit chain hit ${hit.length} of 4 knights, want all 4`);
  check(ks.every((k) => k.hp === 1766 - 99 || k.hp === 1766), 'a knight took a non-chain amount of damage');
});

test('38b fire spirit explodes with splash that hits the whole cluster', () => {
  const g = makeGame(['firespirit', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons'], 66);
  check(dep(g, 1, 'knight', 9, 13.5), 'enemy knight A deploys');
  check(dep(g, 1, 'knight', 10, 13.5), 'enemy knight B deploys');
  check(dep(g, 1, 'knight', 9.5, 12.7), 'enemy knight C deploys');
  const ks = unitsOf(g, 'knight', 1);
  for (const k of ks) freeze(k);
  check(dep(g, 0, 'firespirit', 9, 19), 'fire spirit deploys');
  place(unitsOf(g, 'firespirit', 0)[0], 9, 15.2);
  step(g, 3);
  check(ks.every((k) => k.hp === 1766 - 207), `knight hp ${ks.map((k) => k.hp).join(', ')}, want all ${1766 - 207}`);
});

test('39 executioner axe hits a unit on the way out and again on the way back', () => {
  const g = makeGame(['executioner', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons'], 67);
  check(dep(g, 1, 'knight', 9, 14), 'enemy knight deploys on the axe line');
  const knight = unitsOf(g, 'knight', 1)[0];
  freeze(knight);
  check(dep(g, 0, 'executioner', 9, 19), 'executioner deploys');
  const hp0 = knight.hp;
  step(g, 2.5);
  const dmg = hp0 - knight.hp;
  // Two passes per throw at 250 each. The first throw lands by 2.5 s, so at least two passes.
  check(dmg >= 500 && dmg % 250 === 0, `axe damage ${dmg}, want a multiple of 250 with at least 2 passes`);
});

test('40 lumberjack drops a rage zone on death; friendly units inside get the rage buff', () => {
  const g = makeGame(['lumberjack', 'archers', 'zap', 'musketeer', 'giant', 'fireball', 'knight', 'babydragon'],
    ['giant', 'archers', 'zap', 'musketeer', 'minipekka', 'fireball', 'knight', 'skeletons'], 68);
  check(dep(g, 0, 'lumberjack', 9, 20), 'lumberjack deploys');
  check(dep(g, 0, 'knight', 10.2, 20), 'friendly knight deploys beside it');
  const lj = unitsOf(g, 'lumberjack', 0)[0];
  const friend = unitsOf(g, 'knight', 0)[0];
  step(g, 0.1);
  lj.hp = 1; // test setup: one zap from death
  check(dep(g, 1, 'zap', lj.x, lj.y), 'enemy zap deploys on the lumberjack');
  check(lj.dead, 'lumberjack survived the zap');
  check(g.spells.some((s) => s.kind === 'rage'), 'no rage zone appeared on death');
  step(g, 0.1);
  check(friend.rageT > 0, 'friendly knight did not get the rage buff');
});

// ---- runner ----------------------------------------------------------------

function main() {
  let failed = 0;
  for (const t of TESTS) {
    currentFails = [];
    try {
      t.fn();
    } catch (err) {
      currentFails.push(`threw: ${err.stack || err}`);
    }
    const ok = currentFails.length === 0;
    if (!ok) failed++;
    console.log(`[${ok ? 'ok' : 'FAIL'}] ${t.name}`);
    for (const m of currentFails) console.log(`       - ${m}`);
    results.push({ name: t.name, ok });
    currentFails = null;
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed) process.exitCode = 1;
}

main();
