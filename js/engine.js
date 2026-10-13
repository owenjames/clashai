var CR = (globalThis.CR = globalThis.CR || {});

// Deterministic battle simulation. All randomness comes from the game's seeded mulberry32 stream.
(function () {
  'use strict';

  // Under Node, pull in the card data when it was not loaded first.
  if (!CR.ARENA && typeof require === 'function') require('./cards.js');

  var ARENA = CR.ARENA;
  var TOWERS = CR.TOWERS;
  var ELIXIR = CR.ELIXIR;
  var MATCH = CR.MATCH;
  var UNITS = CR.UNITS;
  var CARDS = CR.CARDS;

  var W = ARENA.W;
  var H = ARENA.H;
  var RIVER_TOP = ARENA.RIVER_TOP;
  var RIVER_BOTTOM = ARENA.RIVER_BOTTOM;
  var BANK_BOTTOM = RIVER_BOTTOM + 0.5; // bridge entrance on the team 0 side
  var BANK_TOP = RIVER_TOP - 0.5; // bridge entrance on the team 1 side
  var LANE_SPLIT = 9;
  var POCKET_REACH = 4; // tiles past the river that a pocket extends
  var SPAWN_FRONT = 1.2; // spawners drop units this far toward the enemy
  var RETARGET_EVERY = 0.2;
  var LOCK_BREAK = 0.5; // a locked unit re-targets once the target is this far out of range
  var POISON_SLOW_TIME = 0.25;
  var RAGE_MULT = 1.35; // Rage: +35 percent move and attack speed
  var RAGE_LINGER = 2; // seconds a unit keeps the rage buff after leaving a Rage zone
  var EPS = 1e-9;
  var EFFECT_FOR_CARD = {
    arrows: 'arrows',
    fireball: 'fireball',
    zap: 'zap',
    rocket: 'rocket',
    freeze: 'freeze',
    poison: 'poison',
    log: 'splash',
    goblinbarrel: 'spawn',
    graveyard: 'spawn',
    earthquake: 'splash',
    lightning: 'lightning',
    tornado: 'tornado',
  };

  function mulberry32(seed) {
    var a = seed | 0;
    return function () {
      var t = (a = (a + 0x6d2b79f5) | 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  // Edge-to-edge gap between two circles.
  function edgeDist(a, b) {
    return dist(a, b) - a.r - b.r;
  }

  function isNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function isRiverY(y) {
    return y > RIVER_TOP && y < RIVER_BOTTOM;
  }

  // 0 = bottom half (team 0 side), 1 = top half (team 1 side).
  function sideOf(y) {
    return y < (RIVER_TOP + RIVER_BOTTOM) / 2 ? 1 : 0;
  }

  function nearestBridge(x) {
    var best = ARENA.BRIDGES[0];
    for (var i = 1; i < ARENA.BRIDGES.length; i++) {
      if (Math.abs(x - ARENA.BRIDGES[i].x) < Math.abs(x - best.x)) best = ARENA.BRIDGES[i];
    }
    return best;
  }

  function towerLayoutPos(team, entry) {
    return { x: entry.x, y: team === 0 ? entry.y : H - entry.y };
  }

  function kingPos(team) {
    var L = TOWERS.layout;
    for (var i = 0; i < L.length; i++) {
      if (L[i].type === 'king') return towerLayoutPos(team, L[i]);
    }
    return { x: W / 2, y: team === 0 ? H - 3 : 3 };
  }

  // Offsets for a multi-unit drop. Ring sizes keep 15 skeletons compact.
  function formationOffsets(count) {
    var out = [];
    var i;
    if (count === 1) return [[0, 0]];
    if (count === 2) return [[-0.5, 0], [0.5, 0]];
    if (count === 3) return [[-0.6, 0.35], [0.6, 0.35], [0, -0.45]];
    if (count <= 5) {
      for (i = 0; i < count; i++) {
        var a = -Math.PI / 2 + (i * 2 * Math.PI) / count;
        out.push([0.8 * Math.cos(a), 0.8 * Math.sin(a)]);
      }
      return out;
    }
    for (i = 0; i < count; i++) {
      var ring = Math.floor(i / 6);
      var k = i % 6;
      var n = Math.min(6, count - ring * 6);
      var ang = (k * 2 * Math.PI) / n + ring * 0.5;
      var rad = 0.6 + 0.8 * ring;
      out.push([rad * Math.cos(ang), rad * Math.sin(ang)]);
    }
    return out;
  }

  function towerDef(type) {
    var s = TOWERS[type];
    if (!s) throw new Error('Unknown tower: ' + type);
    return Object.assign({}, s, {
      kind: 'tower',
      targets: 'both',
      speed: 0,
      mass: 0,
      loadTime: 0,
      sight: s.range,
      air: false,
    });
  }

  function makeEntity(game, o) {
    var def = o.def;
    return {
      id: game.nextId++,
      team: o.team,
      kind: o.kind,
      unitId: o.unitId,
      cardId: o.cardId || null,
      towerType: o.towerType || null,
      lane: o.lane === undefined ? -1 : o.lane,
      x: o.x,
      y: o.y,
      r: def.r,
      air: !!def.air,
      size: def.size || 0,
      hp: def.hp,
      maxHp: def.hp,
      deployT: o.deployT || 0,
      active: o.active !== false,
      target: null,
      attackCooldown: 0,
      lastAttackT: -1e9,
      facing: o.team === 0 ? -Math.PI / 2 : Math.PI / 2,
      stunT: 0,
      freezeT: 0,
      slowT: 0,
      slowAmount: 0,
      charging: false,
      rampStage: 0,
      beamTarget: null,
      dead: false,
      def: def,
      range: def.range || 0,
      sight: def.sight || 0,
      locked: false,
      retargetT: 0,
      chargeDist: 0,
      rampT: 0,
      bridgeX: null,
      spawnTimer: def.spawn ? def.spawn.first : 0,
      shield: def.shield || 0, // Dark Prince: shield hp absorbs damage first
      hidden: false, // Tesla: untargetable until an enemy enters range
      rageT: 0, // seconds left of the Rage buff
      dash: null, // { tx, ty, t } while dashing (Mega Knight, Bandit)
      dashCD: 0,
      invulnT: 0, // > 0 means no damage taken (Bandit dash)
      avoid: null, // { id, side, until }: obstacle steering side kept for a moment
      stallT: 0, // seconds steering without headway
      stepX: null, // position at the start of the last walk step
      lastDir: null, // unit direction of the last local steer
      crossing: false, // committed to crossing a bridge
      knockT: 0, // seconds left of a knockback
      escapeT: 0, // seconds left of a wedge escape
      escapeDir: null,
      stepY: null,
    };
  }

  function arenaClamp(e) {
    e.x = clamp(e.x, e.r, W - e.r);
    e.y = clamp(e.y, e.r, H - e.r);
  }

  // Ground troops never rest in river water unless they are on a bridge.
  function riverClamp(e) {
    if (e.kind !== 'troop' || e.air || e.def.jumpsRiver) return;
    if (!isRiverY(e.y)) return;
    var br = nearestBridge(e.x);
    if (Math.abs(e.x - br.x) <= br.halfWidth) return;
    e.y = e.y - RIVER_TOP < RIVER_BOTTOM - e.y ? RIVER_TOP - 0.05 : RIVER_BOTTOM + 0.05;
  }

  function spawnUnit(game, team, unitId, x, y, cardId) {
    var def = UNITS[unitId];
    if (!def) throw new Error('Unknown unit: ' + unitId);
    var e = makeEntity(game, {
      team: team,
      kind: def.kind === 'building' ? 'building' : 'troop',
      unitId: unitId,
      cardId: cardId,
      x: x,
      y: y,
      def: def,
      deployT: def.deployTime === undefined ? 1.0 : def.deployTime,
    });
    // Miner: burrows in after travelling from the king tower.
    if (def.burrow) e.deployT = def.burrow.time + dist(kingPos(team), { x: x, y: y }) / def.burrow.speed;
    if (def.hidden) e.hidden = true;
    arenaClamp(e);
    riverClamp(e);
    game.entities.push(e);
    // Landing damage (Electro Wizard zap, Mega Knight, Ice Wizard).
    if (def.spawnHit) {
      var sh = def.spawnHit;
      splashHit(game, team, sh.targets || 'both', e.x, e.y, sh.radius, sh.damage, 0, sh);
    }
    return e;
  }

  function spawnFormation(game, team, unitId, count, x, y, cardId) {
    var offs = formationOffsets(count);
    var out = [];
    for (var i = 0; i < offs.length; i++) {
      out.push(spawnUnit(game, team, unitId, x + offs[i][0], y + offs[i][1], cardId));
    }
    return out;
  }

  // ---- targeting -------------------------------------------------------

  // Whether an attacker with `targets` may hit entity `en`.
  function canHitBy(targets, en) {
    if (targets === 'none') return false;
    if (en.hidden) return false; // Tesla underground is untargetable
    if (en.air && targets !== 'both') return false;
    if (targets === 'buildings') return en.kind !== 'troop';
    return true;
  }

  function canHit(att, en) {
    return !en.dead && en.team !== att.team && canHitBy(att.def.targets, en);
  }

  // Closest valid enemy whose edge-to-edge gap is within `limit`.
  function findTarget(game, e, limit) {
    var best = null;
    var bestD = Infinity;
    var list = game.entities;
    for (var i = 0; i < list.length; i++) {
      var en = list[i];
      if (!canHit(e, en)) continue;
      var d = edgeDist(e, en);
      if (d <= limit && d < bestD) {
        best = en;
        bestD = d;
      }
    }
    return best;
  }

  function findTower(game, team, type, lane) {
    var list = game.entities;
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (t.dead || t.kind !== 'tower' || t.team !== team) continue;
      if (t.towerType !== type) continue;
      if (lane !== undefined && t.lane !== lane) continue;
      return t;
    }
    return null;
  }

  // Default walk goal: the princess tower in the unit's lane if alive, else the enemy king.
  function defaultGoal(game, e) {
    var enemy = 1 - e.team;
    var lane = e.x < LANE_SPLIT ? 0 : 1;
    var princess = findTower(game, enemy, 'princess', lane);
    if (princess) return princess;
    return findTower(game, enemy, 'king');
  }

  function setTarget(e, t) {
    if (e.target === t) return;
    e.target = t;
    e.rampStage = 0;
    e.rampT = 0;
  }

  function dropTarget(e) {
    e.locked = false;
    setTarget(e, null);
    e.retargetT = 0;
  }

  // ---- status effects and damage --------------------------------------

  // Stun and freeze both reset the attack, ramp, charge and lock.
  function applyDisable(e, stun, freeze) {
    if (e.kind === 'tower') return;
    if (stun) e.stunT = Math.max(e.stunT, stun);
    if (freeze) e.freezeT = Math.max(e.freezeT, freeze);
    e.attackCooldown = e.def.loadTime || 0;
    e.rampStage = 0;
    e.rampT = 0;
    e.charging = false;
    e.chargeDist = 0;
    e.locked = false;
    e.retargetT = 0;
  }

  function knockback(e, dx, dy, amount) {
    var d = Math.hypot(dx, dy);
    if (d < EPS) {
      dx = 1;
      dy = 0;
      d = 1;
    }
    e.x += (dx / d) * amount;
    e.y += (dy / d) * amount;
    e.knockT = KNOCK_TIME;
    e.locked = false;
    e.charging = false;
    e.chargeDist = 0;
    e.retargetT = 0;
  }

  function endGame(game, winner, reason) {
    if (game.phase === 'ended') return;
    game.phase = 'ended';
    game.timeLeft = 0;
    game.result = {
      winner: winner,
      crowns: [game.players[0].crowns, game.players[1].crowns],
      reason: reason,
    };
    game.events.push({ type: 'gameOver', team: winner, x: W / 2, y: H / 2 });
  }

  function activateKing(game, king) {
    if (king.active) return;
    king.active = true;
    game.events.push({ type: 'kingActivate', team: king.team, x: king.x, y: king.y });
  }

  function towerDown(game, t) {
    t.dead = true;
    t.hp = 0;
    var att = 1 - t.team;
    var p = game.players[att];
    game.events.push({ type: 'towerDown', team: t.team, x: t.x, y: t.y });
    game.effects.push({ type: 'towerDown', x: t.x, y: t.y, radius: t.r, t: 0, dur: 1.0, team: t.team });
    if (t.towerType === 'king') {
      p.crowns = 3;
      endGame(game, att, 'king');
      return;
    }
    p.crowns = Math.min(3, p.crowns + 1);
    var king = findTower(game, t.team, 'king');
    if (king) activateKing(game, king);
    if (game.phase === 'overtime') endGame(game, att, 'crowns');
  }

  function killEntity(game, e) {
    if (e.dead) return;
    e.dead = true;
    game.events.push({ type: 'death', team: e.team, x: e.x, y: e.y, cardId: e.cardId });
    game.effects.push({ type: 'death', x: e.x, y: e.y, radius: e.r, t: 0, dur: 0.4, team: e.team });
    var def = e.def;
    if (def.deathRage) {
      // Lumberjack drops a Rage zone where it dies.
      game.spells.push({
        kind: 'rage',
        cardId: null,
        team: e.team,
        x: e.x,
        y: e.y,
        radius: def.deathRage.radius,
        remaining: def.deathRage.duration,
        done: false,
      });
      game.effects.push({ type: 'rage', x: e.x, y: e.y, radius: def.deathRage.radius, t: 0, dur: def.deathRage.duration, team: e.team });
    }
    if (def.deathDamage) {
      splashHit(game, e.team, 'ground', e.x, e.y, def.deathDamage.radius, def.deathDamage.damage, 0);
    }
    if (def.deathSpawn) {
      spawnFormation(game, e.team, def.deathSpawn.unit, def.deathSpawn.count, e.x, e.y, null);
    }
  }

  function damageEntity(game, en, amount) {
    if (en.dead || !(amount > 0)) return;
    if (en.invulnT > 0) return; // Bandit dash
    if (en.shield > 0) {
      var absorbed = Math.min(en.shield, amount);
      en.shield -= absorbed;
      amount -= absorbed;
      if (!(amount > 0)) return;
    }
    en.hp -= amount;
    if (en.kind === 'tower' && en.towerType === 'king') activateKing(game, en);
    if (en.hp <= 0) {
      en.hp = 0;
      if (en.kind === 'tower') towerDown(game, en);
      else killEntity(game, en);
    }
  }

  function applySlow(e, amount, time) {
    if (e.kind === 'tower' || !(time > 0)) return;
    e.slowT = Math.max(e.slowT, time);
    e.slowAmount = Math.max(e.slowAmount, amount);
  }

  // Area damage around (x, y). Targets must pass the attacker's targeting rules.
  // fx (optional): { stun, slow: { amount, time } } applied to every unit hit.
  function splashHit(game, team, targets, x, y, radius, dmg, freezeT, fx) {
    var pt = { x: x, y: y, r: 0 };
    var list = game.entities.slice();
    for (var i = 0; i < list.length; i++) {
      var en = list[i];
      if (en.dead || en.team === team || !canHitBy(targets, en)) continue;
      if (dist(en, pt) > (radius || 0) + en.r) continue;
      if (freezeT && en.kind === 'troop') applyDisable(en, 0, freezeT);
      if (fx && fx.stun) applyDisable(en, fx.stun, 0);
      if (fx && fx.slow) applySlow(en, fx.slow.amount, fx.slow.time);
      damageEntity(game, en, dmg);
    }
    game.effects.push({ type: 'splash', x: x, y: y, radius: radius || 0, t: 0, dur: 0.35, team: team });
  }

  // ---- movement and pathing --------------------------------------------

  function currentSpeed(e) {
    var base = e.charging && e.def.charge ? e.def.charge.speed : e.def.speed;
    return base * (1 - e.slowAmount) * (e.rageT > 0 ? RAGE_MULT : 1);
  }

  function stepToward(e, tx, ty, dt, speed) {
    var dx = tx - e.x;
    var dy = ty - e.y;
    var d = Math.hypot(dx, dy);
    if (d < EPS || speed <= 0) return 0;
    e.facing = Math.atan2(dy, dx);
    var step = Math.min(d, speed * dt);
    e.x += (dx / d) * step;
    e.y += (dy / d) * step;
    return step;
  }

  // Bridge whose total path (start -> entrance -> exit -> goal) is shortest.
  function chooseBridgeX(e, gx, gy, side) {
    var entY = side === 0 ? BANK_BOTTOM : BANK_TOP;
    var exY = side === 0 ? BANK_TOP : BANK_BOTTOM;
    var best = ARENA.BRIDGES[0].x;
    var bestD = Infinity;
    for (var i = 0; i < ARENA.BRIDGES.length; i++) {
      var bx = ARENA.BRIDGES[i].x;
      var d =
        dist(e, { x: bx, y: entY }) +
        Math.abs(entY - exY) +
        dist({ x: bx, y: exY }, { x: gx, y: gy });
      if (d < bestD) {
        bestD = d;
        best = bx;
      }
    }
    return best;
  }

  // Next point a ground unit should walk to on its way to (gx, gy).
  function nextWaypoint(e, gx, gy) {
    if (e.air || e.def.jumpsRiver) return { x: gx, y: gy };
    var gSide = sideOf(gy);
    if (isRiverY(e.y)) {
      // Already on a bridge: leave by the bank on the goal's side.
      var bx = e.bridgeX !== null ? e.bridgeX : nearestBridge(e.x).x;
      return { x: bx, y: gSide === 0 ? BANK_BOTTOM : BANK_TOP };
    }
    var side = sideOf(e.y);
    if (side === gSide) {
      e.bridgeX = null;
      e.crossing = false;
      return { x: gx, y: gy };
    }
    if (e.bridgeX === null) e.bridgeX = chooseBridgeX(e, gx, gy, side);
    var entY = side === 0 ? BANK_BOTTOM : BANK_TOP;
    var exY = side === 0 ? BANK_TOP : BANK_BOTTOM;
    // Once at the entrance, commit to the crossing. The commit is one-way: testing the distance again
    // each step makes a unit flip between the entrance and the exit at the 0.6 boundary and stall there.
    if (e.crossing || dist(e, { x: e.bridgeX, y: entY }) <= 0.6) {
      e.crossing = true;
      return { x: e.bridgeX, y: exY };
    }
    return { x: e.bridgeX, y: entY };
  }

  // Obstacle steering. Towers and buildings are immovable circles for ground troops. When the straight
  // walk to the goal would enter one, the troop turns onto the tangent of that circle at full speed
  // (it never pushes into the obstacle, so it does not crawl along it). The side is kept for
  // AVOID_HOLD seconds so the unit does not dither between the two.
  var AVOID_SKIN = 0.1;
  var KNOCK_TIME = 0.6; // a knocked-back unit is not walking for this long
  var AVOID_HOLD = 1.5;
  var ESCAPE_TIME = 0.5; // seconds a wedged unit steps straight off the nearest obstacle
  var STALL_TIME = 0.6; // seconds of no headway before a steering unit flips its side

  // Centre distance a ground troop keeps from a tower or building while steering. Towers use the
  // corner of their square footprint so troops go round the corners, not through them.
  function avoidRadius(en) {
    var r = en.r;
    if (en.kind === 'tower' && en.size) r = Math.max(r, en.size / Math.SQRT2);
    return r;
  }

  // Unit direction to walk in when the straight line to (gx, gy) is blocked, else null.
  // skip: the entity being walked to (never avoided, so the unit can reach its own target).
  function steerDir(game, e, gx, gy, skip) {
    var dx = gx - e.x;
    var dy = gy - e.y;
    var L = Math.hypot(dx, dy);
    if (L < EPS) return null;
    var ux = dx / L;
    var uy = dy / L;
    var best = null;
    var bestEntry = Infinity;
    var list = game.entities;
    for (var i = 0; i < list.length; i++) {
      var en = list[i];
      if (en.dead || en.kind === 'troop' || en === skip) continue;
      var Rc = avoidRadius(en) + e.r + AVOID_SKIN;
      var rx = en.x - e.x;
      var ry = en.y - e.y;
      var ahead = rx * ux + ry * uy; // distance along the walk to the obstacle centre
      if (ahead <= 0) continue;
      var perp = Math.abs(rx * uy - ry * ux);
      if (perp >= Rc - 0.01) continue;
      var entry = ahead - Math.sqrt(Rc * Rc - perp * perp); // where the walk meets the circle
      if (entry > L) continue;
      if (entry < bestEntry) {
        bestEntry = entry;
        best = { en: en, rx: rx, ry: ry };
      }
    }
    if (!best) return null;

    var d = Math.hypot(best.rx, best.ry) || EPS;
    var nx = best.rx / d; // toward the obstacle centre
    var ny = best.ry / d;
    var px = -ny; // one tangent of the circle at the unit
    var py = nx;
    var along = ux * nx + uy * ny;
    var gtx = ux - along * nx; // goal direction, tangential part (no inward component)
    var gty = uy - along * ny;
    var sideDot = px * gtx + py * gty;
    var side;
    if (e.avoid && e.avoid.id === best.en.id && game.time < e.avoid.until) {
      side = e.avoid.side;
    } else {
      // Take the side that leads toward the goal. With no preference, pass on the arena-centre side.
      if (sideDot > 1e-6) side = 1;
      else if (sideDot < -1e-6) side = -1;
      else side = px * (W / 2 - e.x) >= 0 ? 1 : -1;
      e.avoid = { id: best.en.id, side: side, until: game.time + AVOID_HOLD };
    }
    return localSteer(game, e, ux, uy, skip) || alongEdge(e, steerVector(side, px, py, gtx, gty));
  }

  function onBridgeX(x, r) {
    for (var i = 0; i < ARENA.BRIDGES.length; i++) {
      if (Math.abs(x - ARENA.BRIDGES[i].x) <= ARENA.BRIDGES[i].halfWidth - r) return true;
    }
    return false;
  }

  // Local planner for a blocked step. Samples 24 directions, keeps those whose short step stays clear of every
  // other tower or building, and takes the one that makes the most progress toward the goal, preferring the
  // direction the unit was already taking. When no direction is clear it takes the one that moves away from the
  // obstacles, so a wedged unit climbs out instead of pushing back in.
  function localSteer(game, e, gux,guy, skip) {
    var best = null;
    var bestScore = -Infinity;
    var look = 0.4;
    for (var k = 0; k < 24; k++) {
      var a = Math.atan2(guy, gux) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 12);
      var cx = Math.cos(a);
      var cy = Math.sin(a);
      var qx = e.x + cx * look;
      var qy = e.y + cy * look;
      var pen = 0;
      for (var i = 0; i < game.entities.length; i++) {
        var en = game.entities[i];
        if (en.dead || en.kind === 'troop' || en === skip) continue;
        var need = avoidRadius(en) + e.r;
        var dq = Math.hypot(en.x - qx, en.y - qy);
        if (dq < need) pen += (need - dq) * 4;
      }
      // Walls and the river are obstacles too: a ground step into the river off a bridge is pushed back out.
      if (qx < e.r || qx > W - e.r || qy < e.r || qy > H - e.r) pen += 2;
      if (!e.air && !e.def.jumpsRiver && isRiverY(qy) && !onBridgeX(qx, e.r)) pen += 2;
      var score = cx * gux + cy * guy - pen;
      if (e.lastDir) score += 0.8 * (cx * e.lastDir.x + cy * e.lastDir.y);
      if (score > bestScore) {
        bestScore = score;
        best = { x: cx, y: cy };
      }
    }
    if (!best) return null;
    e.lastDir = best;
    return best;
  }

  // Drops the part of v that points into an arena edge the unit is touching, so a tangent along a wall
  // slides along it instead of pinning the unit there.
  function alongEdge(e, v) {
    var vx = v.x;
    var vy = v.y;
    if ((e.x < e.r + 0.6 && vx < 0) || (e.x > W - e.r - 0.6 && vx > 0)) vx = 0;
    if ((e.y < e.r + 0.6 && vy < 0) || (e.y > H - e.r - 0.6 && vy > 0)) vy = 0;
    var vl = Math.hypot(vx, vy);
    if (vl < EPS) return v;
    return { x: vx / vl, y: vy / vl };
  }

  function steerVector(side, px, py, gtx, gty) {
    var vx = side * px + gtx;
    var vy = side * py + gty;
    var vl = Math.hypot(vx, vy) || 1;
    return { x: vx / vl, y: vy / vl };
  }

  // Unit direction away from every tower or building within reach of e (not skip), weighted by closeness.
  // Used to climb out of a V between two obstacles, where the nearest one alone points back in.
  function awayFromObstacles(game, e, skip) {
    var rx = 0;
    var ry = 0;
    for (var i = 0; i < game.entities.length; i++) {
      var en = game.entities[i];
      if (en.dead || en.kind === 'troop' || en === skip) continue;
      var dx = e.x - en.x;
      var dy = e.y - en.y;
      var d = Math.hypot(dx, dy);
      if (d < EPS || d > avoidRadius(en) + e.r + 2) continue;
      rx += dx / (d * d);
      ry += dy / (d * d);
    }
    var l = Math.hypot(rx, ry);
    if (l < EPS) return null;
    return { x: rx / l, y: ry / l };
  }

  // Walks e along a unit direction for one step. Returns the distance moved.
  function stepDir(e, dir, dt, speed) {
    var step = speed * dt;
    e.x += dir.x * step;
    e.y += dir.y * step;
    e.facing = Math.atan2(dir.y, dir.x);
    return step;
  }

  // ---- attacks ----------------------------------------------------------

  // Closest valid enemy of e to point `from` (edge distance within limit), skipping ids in skip.
  function nearestEnemy(game, e, from, limit, skip) {
    var best = null;
    var bestD = Infinity;
    for (var i = 0; i < game.entities.length; i++) {
      var en = game.entities[i];
      if (!canHit(e, en) || (skip && skip[en.id])) continue;
      var d = dist(en, from) - en.r - (from.r || 0);
      if (d <= limit && d < bestD) {
        best = en;
        bestD = d;
      }
    }
    return best;
  }

  // Electro Spirit: the kamikaze jump chains from victim to victim, up to ch.count targets.
  function chainHit(game, e, first, dmg, ch) {
    var skip = {};
    var cur = first;
    var from = { x: e.x, y: e.y, r: 0 };
    for (var n = 0; cur && n < ch.count; n++) {
      skip[cur.id] = true;
      damageEntity(game, cur, dmg);
      if (ch.stun) applyDisable(cur, ch.stun, 0);
      game.effects.push({ type: 'chain', x: cur.x, y: cur.y, x0: from.x, y0: from.y, radius: 0, t: 0, dur: 0.3, team: e.team });
      from = { x: cur.x, y: cur.y, r: 0 };
      cur = nearestEnemy(game, e, from, ch.range, skip);
    }
  }

  // Mega Knight / Bandit: start a jump toward the current target.
  function startDash(game, e) {
    var t = e.target;
    e.dash = { tx: t.x, ty: t.y, t: e.def.dash.time || 0.5 };
    e.locked = false;
    e.charging = false;
    e.chargeDist = 0;
    game.effects.push({ type: 'dash', x: e.x, y: e.y, radius: e.r, t: 0, dur: 0.4, team: e.team });
  }

  // Moves a dashing unit to its landing point, then deals landing damage.
  function updateDash(game, e, dt) {
    var d = e.dash;
    var def = e.def.dash;
    var rem = d.t;
    d.t = rem - dt;
    if (def.invuln) e.invulnT = Math.max(e.invulnT, dt * 2);
    if (d.t > 0) {
      var f = Math.min(1, dt / rem);
      e.x += (d.tx - e.x) * f;
      e.y += (d.ty - e.y) * f;
      e.facing = Math.atan2(d.ty - e.y, d.tx - e.x);
      return;
    }
    e.x = d.tx;
    e.y = d.ty;
    e.dash = null;
    e.invulnT = 0;
    e.dashCD = def.cooldown;
    splashHit(game, e.team, def.targets || 'ground', d.tx, d.ty, def.radius, def.damage, 0);
    game.effects.push({ type: 'dash', x: d.tx, y: d.ty, radius: def.radius, t: 0, dur: 0.4, team: e.team });
  }

  // Fires one attack from e at its current target. Melee lands now; ranged spawns a projectile.
  function fire(game, e) {
    var def = e.def;
    var tgt = e.target;
    if (!tgt) return;
    var dmg = def.damage;
    if (def.ramp) dmg = def.ramp.stages[e.rampStage];
    if (e.charging && def.charge) {
      dmg = def.damage * def.charge.damageMult;
      e.charging = false;
    }
    e.chargeDist = 0;
    e.lastAttackT = game.time;
    e.facing = Math.atan2(tgt.y - e.y, tgt.x - e.x);

    if (def.kamikaze) {
      // Kamikaze: the jump is an instant impact, then the unit is gone.
      if (def.kamikaze.chain) {
        chainHit(game, e, tgt, dmg, def.kamikaze.chain);
      } else {
        splashHit(game, e.team, def.targets, tgt.x, tgt.y, def.splash || 0, dmg, def.kamikaze.freeze);
      }
      game.events.push({ type: 'hit', team: e.team, x: tgt.x, y: tgt.y, cardId: e.cardId });
      killEntity(game, e);
      return;
    }

    if (def.boomerang) {
      // Executioner: the axe flies out along the line to the target, then comes back.
      var bdx = tgt.x - e.x;
      var bdy = tgt.y - e.y;
      var bd = Math.hypot(bdx, bdy) || 1;
      var bl = def.boomerang.length;
      game.spells.push({
        kind: 'boomerang',
        cardId: e.cardId,
        team: e.team,
        x: e.x,
        y: e.y,
        dx: bdx / bd,
        dy: bdy / bd,
        length: bl,
        width: def.boomerang.width,
        damage: dmg,
        targets: def.targets,
        speed: bl / (def.boomerang.time || 0.5),
        p: 0,
        phase: 1,
        hit: {},
        done: false,
      });
      game.events.push({ type: 'hit', team: e.team, x: tgt.x, y: tgt.y, cardId: e.cardId });
      return;
    }

    if (def.projectile) {
      game.projectiles.push({
        x: e.x,
        y: e.y,
        team: e.team,
        kind: def.projectile.kind,
        target: tgt,
        tx: tgt.x,
        ty: tgt.y,
        speed: def.projectile.speed,
        damage: dmg,
        splash: def.splash || 0,
        targets: def.targets,
        slow: def.slowOnHit || null,
        fromTower: e.kind === 'tower',
        done: false,
      });
    } else {
      if (def.splashAroundSelf) {
        splashHit(game, e.team, def.targets, e.x, e.y, def.splash, dmg, 0);
      } else if (def.splash) {
        splashHit(game, e.team, def.targets, tgt.x, tgt.y, def.splash, dmg, 0);
      } else {
        if (def.hitStun) applyDisable(tgt, def.hitStun, 0);
        damageEntity(game, tgt, tgt.kind === 'tower' && def.towerDamageMult ? dmg * def.towerDamageMult : dmg);
        if (def.multiTargets > 1) {
          // Electro Wizard: the zap also reaches the nearest other enemies in range.
          var skip = {};
          skip[tgt.id] = true;
          for (var k = 1; k < def.multiTargets; k++) {
            var extra = nearestEnemy(game, e, e, def.range, skip);
            if (!extra) break;
            skip[extra.id] = true;
            if (def.hitStun) applyDisable(extra, def.hitStun, 0);
            damageEntity(game, extra, dmg);
            game.effects.push({ type: def.effect || 'hit', x: extra.x, y: extra.y, radius: extra.r, t: 0, dur: 0.25, team: e.team });
          }
        }
      }
      game.events.push({ type: 'hit', team: e.team, x: tgt.x, y: tgt.y, cardId: e.cardId });
      game.effects.push({ type: def.effect || 'hit', x: tgt.x, y: tgt.y, radius: tgt.r, t: 0, dur: 0.25, team: e.team });
    }
  }

  function updateTower(game, t, dt) {
    if (!t.active) return;
    var def = t.def;
    if (t.target && (t.target.dead || edgeDist(t, t.target) > def.range)) dropTarget(t);
    if (!t.target) {
      setTarget(t, findTarget(game, t, def.range));
      if (!t.target) {
        t.attackCooldown = 0;
        return;
      }
    }
    t.facing = Math.atan2(t.target.y - t.y, t.target.x - t.x);
    t.attackCooldown -= dt;
    if (t.attackCooldown <= 0) {
      fire(game, t);
      t.attackCooldown += def.hitSpeed;
    }
  }

  // ---- per-unit update --------------------------------------------------

  function updateUnit(game, e, dt) {
    var def = e.def;

    if (def.lifetime) {
      e.hp -= (e.maxHp / def.lifetime) * dt;
      if (e.hp <= 0) {
        e.hp = 0;
        killEntity(game, e);
        return;
      }
    }
    if (e.deployT > 0) {
      e.deployT = Math.max(0, e.deployT - dt);
      return;
    }
    if (e.hidden) {
      // Tesla: stays underground until an enemy enters its range, then pops up.
      if (findTarget(game, e, def.range)) {
        e.hidden = false;
        e.deployT = def.upTime || 0.8;
      }
      return;
    }

    e.stunT = Math.max(0, e.stunT - dt);
    e.freezeT = Math.max(0, e.freezeT - dt);
    e.slowT = Math.max(0, e.slowT - dt);
    if (e.slowT === 0) e.slowAmount = 0;
    e.rageT = Math.max(0, e.rageT - dt);
    e.knockT = Math.max(0, e.knockT - dt);
    var disabled = e.stunT > 0 || e.freezeT > 0;

    if (def.spawn) {
      e.spawnTimer -= dt;
      if (e.spawnTimer <= 0) {
        e.spawnTimer += def.spawn.interval;
        var fy = e.y + (e.team === 0 ? -SPAWN_FRONT : SPAWN_FRONT);
        spawnFormation(game, e.team, def.spawn.unit, def.spawn.count, e.x, fy, null);
        game.effects.push({ type: 'spawn', x: e.x, y: fy, radius: 0.8, t: 0, dur: 0.5, team: e.team });
      }
    }

    // Targeting: locked units keep their target; others re-scan every RETARGET_EVERY seconds.
    if (e.target && !canHit(e, e.target)) dropTarget(e);
    if (e.target && e.locked && edgeDist(e, e.target) > def.range + LOCK_BREAK) dropTarget(e);
    e.retargetT -= dt;
    if (!e.locked && e.retargetT <= 0) {
      e.retargetT = RETARGET_EVERY;
      setTarget(e, findTarget(game, e, e.sight));
    }

    if (def.ramp) {
      if (e.target && e.locked && !disabled) {
        e.rampT += dt;
        var st = def.ramp.stageTime;
        e.rampStage = e.rampT >= 2 * st ? 2 : e.rampT >= st ? 1 : 0;
        e.beamTarget = e.target;
      } else {
        e.beamTarget = null;
      }
    }

    if (def.dash) {
      e.dashCD = Math.max(0, e.dashCD - dt);
      if (e.dash) {
        updateDash(game, e, dt);
        return;
      }
      if (!disabled && e.target && e.dashCD <= 0) {
        var gap = edgeDist(e, e.target);
        if (gap >= def.dash.minRange && gap <= def.dash.maxRange) {
          startDash(game, e);
          updateDash(game, e, dt);
          return;
        }
      }
    }

    var canAttack = def.damage > 0 && def.hitSpeed > 0;
    var inRange = !!e.target && edgeDist(e, e.target) <= def.range + EPS;

    if (!disabled && canAttack && inRange) {
      if (!e.locked) {
        e.locked = true;
        e.attackCooldown = def.loadTime || 0;
      }
      e.chargeDist = 0;
      e.attackCooldown -= dt * (e.rageT > 0 ? RAGE_MULT : 1);
      if (e.attackCooldown <= 0) {
        fire(game, e);
        e.attackCooldown += def.hitSpeed;
      }
      return;
    }

    if (disabled || def.speed <= 0) return;

    var gx = null;
    var gy = null;
    if (e.target) {
      if (!inRange) {
        gx = e.target.x;
        gy = e.target.y;
      }
    } else {
      var g = defaultGoal(game, e);
      if (g) {
        gx = g.x;
        gy = g.y;
      }
    }
    if (gx === null) return;

    var wp = nextWaypoint(e, gx, gy);
    var goalEnt = e.target && !inRange ? e.target : defaultGoal(game, e);
    var dir = e.air ? null : steerDir(game, e, wp.x, wp.y, goalEnt);
    // Headway is the real displacement since the last step (collisions can undo a commanded step).
    if (dir && e.stepX !== null) {
      if (Math.hypot(e.x - e.stepX, e.y - e.stepY) < 0.5 * currentSpeed(e) * dt) e.stallT += dt;
      else e.stallT = 0;
      if (e.stallT > STALL_TIME && e.avoid) {
        // Wedged between obstacles: try the other side, and step straight off the nearest one for a moment.
        e.avoid.side = -e.avoid.side;
        e.avoid.until = game.time + AVOID_HOLD;
        e.stallT = 0;
        e.escapeT = ESCAPE_TIME;
        e.escapeDir = awayFromObstacles(game, e, goalEnt);
      }
    } else {
      e.stallT = 0;
    }
    e.stepX = e.x;
    e.stepY = e.y;
    if (e.escapeT > 0 && e.escapeDir) {
      e.escapeT -= dt;
      dir = e.escapeDir;
    }
    var moved = dir ? stepDir(e, dir, dt, currentSpeed(e)) : stepToward(e, wp.x, wp.y, dt, currentSpeed(e));
    if (moved > 0) {
      e.chargeDist += moved;
      if (def.charge && !e.charging && e.chargeDist >= def.charge.dist) e.charging = true;
    }
  }

  // ---- spells -----------------------------------------------------------

  function spellImpact(game, cardId, team, x, y) {
    var card = CARDS[cardId];
    if (card.spawnUnit) {
      spawnFormation(game, team, card.spawnUnit, card.spawnCount || 1, x, y, cardId);
      game.effects.push({ type: 'spawn', x: x, y: y, radius: card.radius || 1, t: 0, dur: 0.5, team: team });
      return;
    }
    var pt = { x: x, y: y, r: 0 };
    var radius = card.radius || 0;
    var list = game.entities.slice();

    if (card.lightning) {
      // Lightning: the highest-hp enemies in radius, up to lightning.targets of them. Towers take reduced damage.
      var cands = list.filter(function (en) {
        return !en.dead && en.team !== team && !en.hidden && dist(en, pt) <= radius + en.r;
      });
      cands.sort(function (a, b) {
        return b.hp - a.hp || a.id - b.id;
      });
      var n = Math.min(card.lightning.targets, cands.length);
      for (var j = 0; j < n; j++) {
        var lt = cands[j];
        if (lt.kind === 'tower') {
          damageEntity(game, lt, card.towerDamage || 0);
          continue;
        }
        if (card.lightning.stun) applyDisable(lt, card.lightning.stun, 0);
        damageEntity(game, lt, card.damage || 0);
      }
      game.effects.push({ type: 'lightning', x: x, y: y, radius: radius, t: 0, dur: 0.5, team: team });
      return;
    }

    for (var i = 0; i < list.length; i++) {
      var en = list[i];
      if (en.dead || en.team === team || en.hidden) continue;
      if (dist(en, pt) > radius + en.r) continue;
      if (en.kind === 'tower') {
        damageEntity(game, en, card.towerDamage || 0);
        continue;
      }
      if (en.air && card.log) continue; // the log only hits ground
      if (card.stun || card.freeze) applyDisable(en, card.stun || 0, card.freeze || 0);
      if (card.knockback && en.kind === 'troop' && !en.air && en.def.mass < 15) {
        knockback(en, en.x - x, en.y - y, card.knockback);
      }
      damageEntity(game, en, card.damage || 0);
    }
    game.effects.push({
      type: EFFECT_FOR_CARD[cardId] || 'hit',
      x: x,
      y: y,
      radius: radius,
      t: 0,
      dur: 0.5,
      team: team,
    });
  }

  function castSpell(game, team, cardId, x, y) {
    var card = CARDS[cardId];
    game.events.push({ type: 'spell', team: team, x: x, y: y, cardId: cardId });
    if (card.log) {
      game.spells.push({
        kind: 'log',
        cardId: cardId,
        team: team,
        x: x,
        y: y,
        sx: x,
        sy: y,
        dir: team === 0 ? -1 : 1,
        traveled: 0,
        length: card.log.length,
        width: card.log.width,
        speed: card.log.speed,
        hit: new Set(),
        done: false,
      });
    } else if (card.duration) {
      game.spells.push({
        kind: 'poison',
        cardId: cardId,
        team: team,
        x: x,
        y: y,
        radius: card.radius,
        remaining: card.duration,
        tickT: 1,
        done: false,
      });
      game.effects.push({ type: EFFECT_FOR_CARD[cardId] || 'poison', x: x, y: y, radius: card.radius, t: 0, dur: 0.5, team: team });
    } else if (card.graveyard) {
      game.spells.push({
        kind: 'graveyard',
        cardId: cardId,
        team: team,
        x: x,
        y: y,
        radius: card.graveyard.radius,
        remaining: card.graveyard.duration,
        nextT: card.graveyard.first,
        interval: card.graveyard.interval,
        unit: card.graveyard.unit,
        done: false,
      });
      game.effects.push({ type: 'spawn', x: x, y: y, radius: card.graveyard.radius, t: 0, dur: 0.5, team: team });
    } else if (card.tornado) {
      game.spells.push({
        kind: 'tornado',
        cardId: cardId,
        team: team,
        x: x,
        y: y,
        radius: card.radius,
        remaining: card.tornado.duration,
        dps: card.tornado.dps,
        tickT: 0.5,
        done: false,
      });
      game.effects.push({ type: 'tornado', x: x, y: y, radius: card.radius, t: 0, dur: card.tornado.duration, team: team });
    } else if (card.travelSpeed > 0) {
      var k = kingPos(team);
      game.spells.push({
        kind: 'flying',
        cardId: cardId,
        team: team,
        x: k.x,
        y: k.y,
        tx: x,
        ty: y,
        travelSpeed: card.travelSpeed,
        done: false,
      });
    } else {
      spellImpact(game, cardId, team, x, y);
    }
  }

  function poisonTick(game, s) {
    var card = CARDS[s.cardId];
    var pt = { x: s.x, y: s.y, r: 0 };
    var list = game.entities.slice();
    for (var i = 0; i < list.length; i++) {
      var en = list[i];
      if (en.dead || en.team === s.team || en.hidden) continue;
      if (card.groundOnly && en.air) continue;
      if (dist(en, pt) > s.radius + en.r) continue;
      var dmg = en.kind === 'tower' ? card.towerDps : card.dps;
      if (en.kind === 'building' && card.buildingMult) dmg *= card.buildingMult;
      damageEntity(game, en, dmg);
    }
  }

  // Tornado: pulls enemy troops to the centre over its lifetime and deals small damage ticks.
  function updateTornado(game, s, dt) {
    var rem = s.remaining;
    s.remaining = rem - dt;
    s.tickT -= dt;
    var frac = Math.min(1, dt / Math.max(EPS, rem)); // reaches the centre on the last frame
    var pulled = [];
    var list = game.entities.slice();
    for (var i = 0; i < list.length; i++) {
      var en = list[i];
      if (en.dead || en.kind !== 'troop' || en.team === s.team) continue;
      if (dist(en, s) > s.radius + en.r) continue;
      en.x += (s.x - en.x) * frac;
      en.y += (s.y - en.y) * frac;
      pulled.push(en);
    }
    if (s.tickT <= 0) {
      s.tickT += 0.5;
      for (var p = 0; p < pulled.length; p++) damageEntity(game, pulled[p], s.dps * 0.5);
    }
    // A pulled unit inside an inactive enemy King Tower's range wakes it.
    for (var t = 0; t < game.entities.length; t++) {
      var king = game.entities[t];
      if (king.dead || king.kind !== 'tower' || king.towerType !== 'king' || king.team === s.team || king.active) continue;
      for (var q = 0; q < pulled.length; q++) {
        if (edgeDist(pulled[q], king) <= king.def.range) {
          activateKing(game, king);
          break;
        }
      }
    }
    if (s.remaining <= 0) s.done = true;
  }

  // Graveyard: skeletons appear at random points inside the radius, one every interval after the first.
  function updateGraveyard(game, s, dt) {
    s.remaining -= dt;
    s.nextT -= dt;
    if (s.nextT <= 0 && s.remaining > 0) {
      s.nextT += s.interval;
      var a = game.rng() * 2 * Math.PI;
      var rr = s.radius * Math.sqrt(game.rng());
      var px = clamp(s.x + rr * Math.cos(a), 0.5, W - 0.5);
      var py = clamp(s.y + rr * Math.sin(a), 0.5, H - 0.5);
      spawnUnit(game, s.team, s.unit, px, py, s.cardId);
      game.effects.push({ type: 'spawn', x: px, y: py, radius: 0.5, t: 0, dur: 0.5, team: s.team });
    }
    if (s.remaining <= 0) s.done = true;
  }

  // Rage zone (Rage spell or a Lumberjack death): own troops inside get the buff.
  function updateRage(game, s, dt) {
    s.remaining -= dt;
    var list = game.entities;
    for (var i = 0; i < list.length; i++) {
      var en = list[i];
      if (en.dead || en.kind !== 'troop' || en.team !== s.team) continue;
      if (dist(en, s) > s.radius + en.r) continue;
      en.rageT = RAGE_LINGER;
    }
    if (s.remaining <= 0) s.done = true;
  }

  // Executioner axe: out to the far end, then back to the start. Each leg hits a unit once.
  function updateBoomerang(game, s, dt) {
    s.p += s.speed * dt * s.phase;
    if (s.phase === 1 && s.p >= s.length) {
      s.p = s.length;
      s.phase = -1;
      s.hit = {};
    }
    if (s.phase === -1 && s.p <= 0) {
      s.done = true;
      return;
    }
    var pt = { x: s.x + s.dx * s.p, y: s.y + s.dy * s.p, r: 0 };
    var list = game.entities.slice();
    for (var i = 0; i < list.length; i++) {
      var en = list[i];
      if (en.dead || en.team === s.team || !canHitBy(s.targets, en) || s.hit[en.id]) continue;
      if (dist(en, pt) > s.width + en.r) continue;
      s.hit[en.id] = true;
      damageEntity(game, en, s.damage);
    }
  }

  function updateSpells(game, dt) {
    for (var i = 0; i < game.spells.length; i++) {
      var s = game.spells[i];
      if (s.done) continue;
      var card = CARDS[s.cardId];
      if (s.kind === 'flying') {
        var dx = s.tx - s.x;
        var dy = s.ty - s.y;
        var d = Math.hypot(dx, dy);
        var step = s.travelSpeed * dt;
        if (d <= step || d < EPS) {
          s.x = s.tx;
          s.y = s.ty;
          s.done = true;
          spellImpact(game, s.cardId, s.team, s.tx, s.ty);
        } else {
          s.x += (dx / d) * step;
          s.y += (dy / d) * step;
        }
      } else if (s.kind === 'poison') {
        s.remaining -= dt;
        s.tickT -= dt;
        if (s.tickT <= 0) {
          s.tickT += 1;
          poisonTick(game, s);
        }
        var pt = { x: s.x, y: s.y, r: 0 };
        var list = game.entities;
        for (var j = 0; j < list.length; j++) {
          var en = list[j];
          if (en.dead || en.team === s.team || en.kind === 'tower' || en.hidden) continue;
          if (card.groundOnly && en.air) continue;
          if (dist(en, pt) > s.radius + en.r) continue;
          en.slowT = Math.max(en.slowT, POISON_SLOW_TIME);
          en.slowAmount = card.slow;
        }
        if (s.remaining <= 0) s.done = true;
      } else if (s.kind === 'log') {
        s.traveled = Math.min(s.length, s.traveled + s.speed * dt);
        var front = s.sy + s.dir * s.traveled;
        var targets = game.entities.slice();
        for (var q = 0; q < targets.length; q++) {
          var t = targets[q];
          if (t.dead || t.team === s.team || t.air) continue;
          if (s.hit.has(t.id)) continue;
          if (Math.abs(t.x - s.x) > s.width / 2 + t.r) continue;
          if (Math.abs(t.y - front) > 0.6 + t.r) continue;
          s.hit.add(t.id);
          if (t.kind === 'tower') {
            damageEntity(game, t, card.towerDamage);
          } else {
            if (t.kind === 'troop' && t.def.mass < 15) knockback(t, 0, s.dir, card.knockback);
            damageEntity(game, t, card.damage);
          }
        }
        if (s.traveled >= s.length) s.done = true;
      } else if (s.kind === 'tornado') {
        updateTornado(game, s, dt);
      } else if (s.kind === 'graveyard') {
        updateGraveyard(game, s, dt);
      } else if (s.kind === 'rage') {
        updateRage(game, s, dt);
      } else if (s.kind === 'boomerang') {
        updateBoomerang(game, s, dt);
      }
    }
  }

  // ---- projectiles ------------------------------------------------------

  function impactProjectile(game, p) {
    var fx = p.slow ? { slow: p.slow } : undefined;
    if (p.splash > 0) {
      splashHit(game, p.team, p.targets, p.x, p.y, p.splash, p.damage, 0, fx);
    } else if (p.target && !p.target.dead) {
      damageEntity(game, p.target, p.damage);
      if (p.slow) applySlow(p.target, p.slow.amount, p.slow.time);
    }
    game.events.push({ type: 'hit', team: p.team, x: p.x, y: p.y });
    game.effects.push({ type: 'hit', x: p.x, y: p.y, radius: 0.5, t: 0, dur: 0.3, team: p.team });
  }

  function updateProjectiles(game, dt) {
    for (var i = 0; i < game.projectiles.length; i++) {
      var p = game.projectiles[i];
      if (p.done) continue;
      if (p.target && !p.target.dead) {
        p.tx = p.target.x;
        p.ty = p.target.y;
      }
      var dx = p.tx - p.x;
      var dy = p.ty - p.y;
      var d = Math.hypot(dx, dy);
      var step = p.speed * dt;
      if (d <= Math.max(step, 0.3)) {
        p.x = p.tx;
        p.y = p.ty;
        p.done = true;
        impactProjectile(game, p);
      } else {
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      }
    }
  }

  // ---- collisions and bounds -------------------------------------------

  // Pairwise push-apart within the same layer (ground or air). Towers and buildings are immovable.
  function resolveCollisions(game) {
    var list = game.entities;
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i < list.length; i++) {
        var a = list[i];
        if (a.dead) continue;
        for (var j = i + 1; j < list.length; j++) {
          var b = list[j];
          if (b.dead) continue;
          if (a.kind !== 'troop' && b.kind !== 'troop') continue;
          if (a.air !== b.air) continue;
          var dx = b.x - a.x;
          var dy = b.y - a.y;
          var minD = a.r + b.r;
          var d2 = dx * dx + dy * dy;
          if (d2 >= minD * minD) continue;
          var d = Math.sqrt(d2);
          var nx = 1;
          var ny = 0;
          if (d >= EPS) {
            nx = dx / d;
            ny = dy / d;
          } else {
            d = 0;
          }
          var overlap = minD - d;
          var aFixed = a.kind !== 'troop';
          var bFixed = b.kind !== 'troop';
          var fa;
          var fb;
          if (aFixed) {
            fa = 0;
            fb = 1;
          } else if (bFixed) {
            fa = 1;
            fb = 0;
          } else {
            var ma = a.def.mass;
            var mb = b.def.mass;
            fa = mb / (ma + mb);
            fb = ma / (ma + mb);
          }
          a.x -= nx * overlap * fa;
          a.y -= ny * overlap * fa;
          b.x += nx * overlap * fb;
          b.y += ny * overlap * fb;
        }
      }
      for (i = 0; i < list.length; i++) {
        var e = list[i];
        if (e.dead || e.kind === 'tower') continue;
        riverClamp(e);
        arenaClamp(e);
      }
    }
  }

  // ---- match phases and cleanup ----------------------------------------

  function lowestTowerHp(game, team) {
    var m = Infinity;
    for (var i = 0; i < game.entities.length; i++) {
      var t = game.entities[i];
      if (!t.dead && t.kind === 'tower' && t.team === team && t.hp < m) m = t.hp;
    }
    return m === Infinity ? 0 : m;
  }

  function updatePhase(game) {
    if (game.phase === 'regulation') {
      game.timeLeft = Math.max(0, MATCH.regulation - game.time);
      game.elixirMult = game.time >= MATCH.regulation - MATCH.doubleAt ? 2 : 1;
      if (game.time >= MATCH.regulation) {
        var c0 = game.players[0].crowns;
        var c1 = game.players[1].crowns;
        if (c0 !== c1) {
          endGame(game, c0 > c1 ? 0 : 1, 'crowns');
        } else {
          game.phase = 'overtime';
          game.overtimeStart = game.time;
          game.timeLeft = MATCH.overtime;
          game.elixirMult = 2;
        }
      }
    }
    if (game.phase === 'overtime') {
      var el = game.time - game.overtimeStart;
      game.timeLeft = Math.max(0, MATCH.overtime - el);
      game.elixirMult = el < MATCH.overtime / 2 ? 2 : 3;
      if (el >= MATCH.overtime) {
        var h0 = lowestTowerHp(game, 0);
        var h1 = lowestTowerHp(game, 1);
        if (h0 === h1) endGame(game, -1, 'draw');
        else endGame(game, h0 < h1 ? 1 : 0, 'tiebreak');
      }
    }
  }

  function ageEffects(game, dt) {
    for (var i = 0; i < game.effects.length; i++) game.effects[i].t += dt;
    game.effects = game.effects.filter(function (f) {
      return f.t < f.dur;
    });
  }

  // Removes dead entities and finished projectiles/spells, and drops references to dead targets.
  function cleanup(game) {
    game.entities = game.entities.filter(function (e) {
      return !e.dead;
    });
    for (var i = 0; i < game.entities.length; i++) {
      var e = game.entities[i];
      if (e.target && e.target.dead) {
        e.target = null;
        e.locked = false;
        e.retargetT = 0;
      }
      if (e.beamTarget && e.beamTarget.dead) e.beamTarget = null;
    }
    game.projectiles = game.projectiles.filter(function (p) {
      if (p.target && p.target.dead) p.target = null;
      return !p.done;
    });
    game.spells = game.spells.filter(function (s) {
      return !s.done;
    });
  }

  // ---- players and deploy zone -----------------------------------------

  function makePlayer(game, deckIn) {
    if (!deckIn || deckIn.length < 5) throw new Error('A deck needs at least 5 cards');
    var deck = deckIn.slice();
    for (var i = 0; i < deck.length; i++) {
      if (!CARDS[deck[i]]) throw new Error('Unknown card: ' + deck[i]);
    }
    for (i = deck.length - 1; i > 0; i--) {
      var j = Math.floor(game.rng() * (i + 1));
      var tmp = deck[i];
      deck[i] = deck[j];
      deck[j] = tmp;
    }
    return {
      elixir: ELIXIR.start,
      crowns: 0,
      deck: deck,
      hand: deck.slice(0, 4),
      next: deck[4],
      queue: deck.slice(5),
    };
  }

  // Pocket: once the enemy princess tower in the point's lane is gone, the point may be on the enemy side.
  function inPocket(game, team, x, y) {
    var lane = x < LANE_SPLIT ? 0 : 1;
    if (findTower(game, 1 - team, 'princess', lane)) return false;
    if (team === 0) return y >= RIVER_TOP - POCKET_REACH && y <= RIVER_TOP;
    return y >= RIVER_BOTTOM && y <= RIVER_BOTTOM + POCKET_REACH;
  }

  // ---- public API -------------------------------------------------------

  class Game {
    constructor(opts) {
      opts = opts || {};
      var decks = opts.decks || [CR.DEFAULT_DECK, CR.DEFAULT_DECK];
      this.seed = opts.seed === undefined ? 1 : opts.seed;
      this.rng = mulberry32(this.seed);
      this.nextId = 1;
      this.time = 0;
      this.phase = 'regulation';
      this.timeLeft = MATCH.regulation;
      this.elixirMult = 1;
      this.overtimeStart = 0;
      this.entities = [];
      this.projectiles = [];
      this.spells = [];
      this.effects = [];
      this.events = [];
      this.result = null;
      this.players = [makePlayer(this, decks[0]), makePlayer(this, decks[1])];
      for (var t = 0; t < 2; t++) this._spawnTowers(t);
    }

    _spawnTowers(team) {
      var L = TOWERS.layout;
      for (var k = 0; k < L.length; k++) {
        var entry = L[k];
        var pos = towerLayoutPos(team, entry);
        this.entities.push(
          makeEntity(this, {
            team: team,
            kind: 'tower',
            unitId: entry.type,
            towerType: entry.type,
            lane: entry.lane,
            x: pos.x,
            y: pos.y,
            def: towerDef(entry.type),
            deployT: 0,
            active: entry.type !== 'king',
          })
        );
      }
    }

    update(dt) {
      this.events = [];
      if (!isNum(dt) || dt <= 0) return;
      if (this.phase === 'ended') {
        ageEffects(this, dt);
        cleanup(this);
        return;
      }
      this.time += dt;
      updatePhase(this);
      if (this.phase !== 'ended') {
        for (var t = 0; t < 2; t++) {
          var p = this.players[t];
          p.elixir = Math.min(ELIXIR.max, p.elixir + (dt * this.elixirMult) / ELIXIR.regen);
        }
        var list = this.entities.slice();
        for (var i = 0; i < list.length; i++) {
          var e = list[i];
          if (e.dead) continue;
          if (e.kind === 'tower') updateTower(this, e, dt);
          else updateUnit(this, e, dt);
          if (this.phase === 'ended') break;
        }
      }
      if (this.phase !== 'ended') {
        updateSpells(this, dt);
        updateProjectiles(this, dt);
        resolveCollisions(this);
      }
      ageEffects(this, dt);
      cleanup(this);
    }

    isInDeployZone(team, cardId, x, y) {
      var card = CARDS[cardId];
      if (!card || !isNum(x) || !isNum(y)) return false;
      if (x < 0 || x > W || y < 0 || y > H) return false;
      if (card.type === 'spell') return true;
      if (card.deployAnywhere) {
        // Miner: anywhere except the river. Tower footprints are checked below.
        if (isRiverY(y)) return false;
      } else {
        var own = team === 0 ? y >= RIVER_BOTTOM : y <= RIVER_TOP;
        if (!own && !inPocket(this, team, x, y)) return false;
      }
      for (var i = 0; i < this.entities.length; i++) {
        var t = this.entities[i];
        if (t.dead || t.kind !== 'tower') continue;
        var half = t.size / 2;
        if (Math.abs(x - t.x) < half && Math.abs(y - t.y) < half) return false;
      }
      return true;
    }

    canDeploy(team, handIndex, x, y) {
      var p = this.players[team];
      if (!p || this.phase === 'ended') return false;
      if (!(Number.isInteger(handIndex) && handIndex >= 0 && handIndex < p.hand.length)) return false;
      if (!isNum(x) || !isNum(y)) return false;
      var cardId = p.hand[handIndex];
      var card = CARDS[cardId];
      if (!card || p.elixir + 1e-9 < card.cost) return false;
      return this.isInDeployZone(team, cardId, clamp(x, 0, W), clamp(y, 0, H));
    }

    deploy(team, handIndex, x, y) {
      if (!this.canDeploy(team, handIndex, x, y)) return false;
      var p = this.players[team];
      var cardId = p.hand[handIndex];
      var card = CARDS[cardId];
      var px = clamp(x, 0, W);
      var py = clamp(y, 0, H);

      p.elixir = Math.max(0, p.elixir - card.cost);
      p.queue.push(cardId);
      p.hand[handIndex] = p.next;
      p.next = p.queue.shift();

      this.events.push({ type: 'deploy', team: team, x: px, y: py, cardId: cardId });
      this.effects.push({ type: 'deploy', x: px, y: py, radius: 1, t: 0, dur: 0.5, team: team });
      this.effects.push({ type: 'elixir', x: px, y: py, radius: 0, t: 0, dur: 0.8, team: team, text: '-' + card.cost });

      if (card.type === 'spell') {
        castSpell(this, team, cardId, px, py);
      } else if (card.type === 'building') {
        spawnUnit(this, team, card.unit, px, py, cardId);
      } else {
        spawnFormation(this, team, card.unit, card.count, px, py, cardId);
      }
      return true;
    }

    getUnitsOf(team) {
      return this.entities.filter(function (e) {
        return !e.dead && e.team === team && e.kind !== 'tower';
      });
    }

    getTowers(team) {
      return this.entities.filter(function (e) {
        return !e.dead && e.team === team && e.kind === 'tower';
      });
    }
  }

  CR.Game = Game;
})();

if (typeof module !== 'undefined') module.exports = CR;
