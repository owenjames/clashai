// Computer opponent (CR.AI). Uses only the public engine API: reads state, calls
// game.canDeploy and game.deploy. Thinks every THINK seconds. Randomness comes from a
// seeded mulberry32 (never Math.random), so matches replay identically.
//
// All geometry is done in the AI's own frame: fy = y for team 1 (top), fy = 32 - y for
// team 0. In that frame the AI's towers sit near fy 3..6.5, the river is fy 15..17, and
// enemy troops walk toward decreasing fy. x is the same in both frames.
var CR = (globalThis.CR = globalThis.CR || {});

(function () {
  var W = CR.ARENA.W;
  var H = CR.ARENA.H;
  var KING_X = 9;
  var PRINCESS_X = [3.5, 14.5];
  var THINK = 0.25;
  var THREAT_FY = 21;   // enemies above this line (own frame) are threats
  var OWN_FY = 15;      // own half in own frame is fy < 15
  var FRONT_FY = 9.5;   // melee defenders, just in front of the princess tower
  var BACK_FY = 4.5;    // ranged defenders, just behind the princess tower
  var CENTRE_FY = 7.5;  // building pulls for win conditions, centre, in front of the king
  var PUSH_FY = 8.5;    // push tank or filler spot
  var POCKET_FY = 19;   // pocket spot when the enemy princess in that lane is down
  var BRIDGE_FY = 13;   // win condition waits on its side of the bridge
  var TANK_HP = 2500;
  var SWARM_HP = 400;
  var KEY_RANGED = { musketeer: 1, wizard: 1, witch: 1, archer: 1, speargoblin: 1 };

  var DIFF = {
    easy: {
      react: [1.2, 2.0], gap: [1.8, 2.6], jitter: 1.0, pushAt: 9, leak: 0.5,
      errChance: 0.3, costBias: 0.04, spellBias: 1.5, counterPush: false
    },
    normal: {
      react: [0.6, 1.1], gap: [1.1, 1.6], jitter: 0.4, pushAt: 8, leak: 0,
      errChance: 0.05, costBias: 0.1, spellBias: 1.15, counterPush: false
    },
    hard: {
      react: [0.25, 0.5], gap: [0.7, 1.0], jitter: 0.15, pushAt: 8, leak: 0,
      errChance: 0, costBias: 0.1, spellBias: 1.0, counterPush: true
    }
  };

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Card roles, derived from CR.CARDS and CR.UNITS data only.
  var ROLE = {};
  var UNIT_COST = {}; // elixir per spawned unit, averaged over the cards that make it
  (function classify() {
    var costSum = {}, costN = {};
    Object.keys(CR.CARDS).forEach(function (id) {
      var c = CR.CARDS[id];
      var u = c.unit ? CR.UNITS[c.unit] : null;
      var count = c.count || 1;
      var R = {
        id: id, cost: c.cost, type: c.type, count: count,
        troop: c.type === 'troop', building: c.type === 'building', spell: c.type === 'spell',
        unitId: c.unit || null,
        winCon: false,        // targets buildings, or Goblin Barrel
        tank: false,          // troop with hp >= TANK_HP
        splash: false,
        airCapable: false,    // hits air
        swarm: false,         // multi-unit card
        groundSwarm: false,   // multi-unit card that only hits ground
        counters: false,      // can damage something at all
        ranged: false, range: 0, dps: 0,
        damage: c.damage || 0, towerDamage: c.towerDamage || 0, radius: c.radius || 0,
        travelSpeed: c.travelSpeed || 0, freeze: c.freeze || 0,
        effDamage: 0,         // spells: direct damage, or total poison damage
        damageSpell: false, cheap: false, heavy: false,
        barrel: !!c.spawnUnit, log: !!c.log
      };
      if (u) {
        R.range = u.range;
        R.ranged = !!u.projectile || u.range >= 3;
        R.dps = u.hitSpeed ? (u.ramp ? u.ramp.stages[1] : u.damage) / u.hitSpeed : 0;
        R.winCon = u.targets === 'buildings';
        R.tank = u.kind === 'troop' && u.hp >= TANK_HP;
        R.splash = !!(u.splash || u.splashAroundSelf);
        R.airCapable = u.targets === 'both';
        R.swarm = R.troop && count >= 3;
        R.groundSwarm = R.swarm && u.targets === 'ground';
        R.counters = u.targets !== 'none' && (u.damage > 0 || !!u.ramp);
        costSum[c.unit] = (costSum[c.unit] || 0) + c.cost / count;
        costN[c.unit] = (costN[c.unit] || 0) + 1;
      } else {
        R.winCon = !!c.spawnUnit;
        R.splash = (c.radius || 0) > 0;
        R.airCapable = !c.log && !c.spawnUnit;
        R.effDamage = (c.damage || 0) || (c.dps || 0) * (c.duration || 0);
        R.damageSpell = R.effDamage > 0;
        R.counters = R.damageSpell;
        R.cheap = R.damageSpell && c.cost <= 2;
        R.heavy = R.effDamage >= 1000;
      }
      ROLE[id] = R;
    });
    Object.keys(costSum).forEach(function (n) { UNIT_COST[n] = costSum[n] / costN[n]; });
  })();

  // Coordinates in the AI's frame (see header). The mapping is its own inverse.
  function fyOf(team, y) { return team === 1 ? y : H - y; }
  function realY(team, fy) { return team === 1 ? fy : H - fy; }
  function laneOf(x) { return x < KING_X ? 0 : 1; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function alive(e) { return !!e && !e.dead && e.hp > 0; }

  function unitBase(unitId) {
    if (UNIT_COST[unitId] !== undefined) return UNIT_COST[unitId];
    var u = CR.UNITS[unitId];
    return u ? clamp(u.hp / 400, 0.2, 6) : 0.5;
  }
  // Elixir-equivalent value of a live unit, scaled by its remaining hp.
  function unitValue(e) { return unitBase(e.unitId) * Math.max(0.2, e.hp / e.maxHp); }

  function isHeavy(e) {
    var u = CR.UNITS[e.unitId];
    return !!u && u.kind === 'troop' && (u.hp >= TANK_HP || u.targets === 'buildings');
  }

  // Offsets tried in order when the ideal deploy spot is invalid.
  var SPIRAL = [[0, 0]];
  (function () {
    [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].forEach(function (r) {
      for (var k = 0; k < 12; k++) {
        var a = (k * Math.PI) / 6;
        SPIRAL.push([r * Math.cos(a), r * Math.sin(a)]);
      }
    });
  })();

  function AI(game, team, opts) {
    opts = opts || {};
    this.game = game;
    this.team = team;
    this.enemy = 1 - team;
    this.difficulty = DIFF[opts.difficulty] ? opts.difficulty : 'normal';
    this.cfg = DIFF[this.difficulty];
    var seed = (Math.floor((game.time || 0) * 1000) ^ Math.imul(team + 1, 0x9e3779b1) ^ (opts.seed | 0)) >>> 0;
    this.rng = mulberry32(seed);
    this.thinkT = 0;
    this.nextPlayT = 0;
    this.reactAt = [null, null];   // per lane: game time when the AI starts reacting to a threat
    this.threatTowers = 0;         // own tower count when the current threat began
    this.counterUntil = -1;        // hard: window for an opportunistic counter-push
    this.push = null;              // { lane, start } while pushing
    this.pushCooldownUntil = 0;
    this.prev = {};                // enemy id -> { x, y, t, vx, vy } for lead aiming
  }

  AI.roles = ROLE;
  AI.unitCost = UNIT_COST;

  AI.prototype.rand = function (range) {
    return range[0] + (range[1] - range[0]) * this.rng();
  };

  AI.prototype.update = function (dt) {
    var g = this.game;
    if (!g || g.result || g.phase === 'ended') return;
    this.thinkT -= dt;
    if (this.thinkT > 0) return;
    this.thinkT += THINK;
    if (this.thinkT <= 0) this.thinkT = THINK;
    this.think();
  };

  AI.prototype.think = function () {
    var g = this.game, t = g.time, me = g.players[this.team];
    if (!me) return;
    var enemies = g.getUnitsOf(this.enemy).filter(alive);
    var eTowers = g.getTowers(this.enemy).filter(alive);
    var myUnits = g.getUnitsOf(this.team).filter(alive);
    var myTowers = g.getTowers(this.team).filter(alive);

    this.trackVelocities(enemies, t);
    var threats = this.assessThreats(enemies, myUnits);
    this.updateReactions(threats, myTowers.length, t);
    if (t < this.nextPlayT) return;

    var opt = this.towerFinish(me, eTowers);
    if (!opt) {
      var self = this;
      var ready = threats.filter(function (T) {
        return T.need > 0.5 && self.reactAt[T.lane] !== null && t >= self.reactAt[T.lane];
      });
      ready.sort(function (a, b) { return b.value - a.value; });
      for (var i = 0; i < ready.length && !opt; i++) {
        opt = this.bestDefence(ready[i], me, enemies);
      }
    }
    var uncovered = threats.some(function (T) { return T.need > 0.5; });
    if (!opt && me.elixir >= 9.5) opt = this.leakFix(me);
    if (!opt && !uncovered) opt = this.offence(me, myUnits, eTowers, t);
    if (opt) this.play(opt, t);
  };

  // Velocity from the last think, used to lead spells at moving clusters.
  AI.prototype.trackVelocities = function (enemies, t) {
    var next = {};
    enemies.forEach(function (e) {
      var p = this.prev[e.id], vx = 0, vy = 0;
      if (p && t > p.t) {
        vx = (e.x - p.x) / (t - p.t);
        vy = (e.y - p.y) / (t - p.t);
      }
      next[e.id] = { x: e.x, y: e.y, t: t, vx: vx, vy: vy };
    }, this);
    this.prev = next;
  };

  AI.prototype.ourDefence = function (myUnits, lane) {
    var sum = 0, team = this.team;
    myUnits.forEach(function (u) {
      if (laneOf(u.x) === lane && fyOf(team, u.y) < OWN_FY) sum += unitValue(u);
    });
    return sum;
  };

  // Threats: enemy units (and buildings) inside THREAT_FY, grouped by lane.
  AI.prototype.assessThreats = function (enemies, myUnits) {
    var self = this;
    var lanes = [null, null];
    enemies.forEach(function (e) {
      var fy = fyOf(self.team, e.y);
      if (fy >= THREAT_FY) return;
      var u = CR.UNITS[e.unitId];
      if (!u) return;
      var L = laneOf(e.x);
      var T = lanes[L] || (lanes[L] = {
        lane: L, value: 0, airValue: 0, count: 0, lowHp: 0,
        tank: false, winCon: false, air: false, swarm: false,
        minFy: 99, units: [], need: 0
      });
      var v = unitValue(e);
      T.value += v;
      T.count++;
      T.units.push(e);
      if (e.air) { T.air = true; T.airValue += v; }
      if (u.hp >= TANK_HP) T.tank = true;
      if (u.targets === 'buildings') T.winCon = true;
      if (u.kind === 'troop' && u.hp <= SWARM_HP) T.lowHp++;
      if (fy < T.minFy) T.minFy = fy;
    });
    var out = [];
    lanes.forEach(function (T) {
      if (!T) return;
      T.swarm = T.lowHp >= 3;
      T.need = T.value - 0.8 * self.ourDefence(myUnits, T.lane);
      out.push(T);
    });
    return out;
  };

  AI.prototype.updateReactions = function (threats, towers, t) {
    var has = [false, false];
    threats.forEach(function (T) { has[T.lane] = true; });
    var wasAny = this.reactAt[0] !== null || this.reactAt[1] !== null;
    var anyNow = has[0] || has[1];
    if (anyNow && !wasAny) this.threatTowers = towers;
    for (var L = 0; L < 2; L++) {
      if (has[L] && this.reactAt[L] === null) {
        this.reactAt[L] = t + this.rand(this.cfg.react);
      } else if (!has[L]) {
        this.reactAt[L] = null;
      }
    }
    if (wasAny && !anyNow && towers >= this.threatTowers) {
      // Threat cleared without losing a tower: a good moment to counter-push (hard).
      this.counterUntil = t + 8;
    }
  };

  // Troop placement in the AI frame for a counter against threat T.
  AI.prototype.troopSpot = function (R, T) {
    var lx = PRINCESS_X[T.lane];
    if (R.building) return T.winCon ? { fx: KING_X, fy: CENTRE_FY } : { fx: lx, fy: BACK_FY };
    if (R.ranged) return { fx: lx, fy: BACK_FY };
    return { fx: lx, fy: FRONT_FY };
  };

  AI.prototype.counterScore = function (R, T) {
    // Non-damaging buildings (tombstone, goblin hut) still pull building-targeting win conditions.
    if (!R.counters) return (R.building && T.winCon) ? 1.5 : 0;
    var airFrac = T.value > 0 ? T.airValue / T.value : 0;
    if (airFrac > 0.5 && !R.airCapable) return 0;
    var s = 1;
    if (airFrac > 0 && R.airCapable) s += 1 + 2 * airFrac;
    if (T.swarm) {
      if (R.splash) s += 2.5;
      if (R.swarm) s += 0.5;
    }
    if (T.tank || T.winCon) {
      s += Math.min(3, R.dps / 250);
      if (R.tank) s += 0.5;
      if (R.building && T.winCon) s += 2;
    }
    if (R.building && !T.winCon) s -= 0.5;
    return s;
  };

  AI.prototype.bestDefence = function (T, me, enemies) {
    var self = this, cfg = this.cfg, opts = [];
    me.hand.forEach(function (cid, hIdx) {
      var R = ROLE[cid];
      if (!R || R.cost > me.elixir + 1e-6) return;
      if (R.spell) {
        var sp = self.spellPlay(R, hIdx, enemies);
        if (sp) opts.push(sp);
        return;
      }
      var s = self.counterScore(R, T);
      if (s <= 0) return;
      s -= R.cost * cfg.costBias + Math.max(0, R.cost - (T.need * 1.3 + 1.5)) * 0.25;
      var p = self.troopSpot(R, T);
      opts.push({ kind: 'troop', hIdx: hIdx, fx: p.fx, fy: p.fy, score: s, cost: R.cost });
    });
    var best = opts.reduce(function (m, o) { return Math.max(m, o.score); }, -Infinity);
    if (T.tank && best < 1.5) {
      // Kite: no real counter for a tank, so drop the cheapest troop into the centre to pull it.
      var kite = null;
      me.hand.forEach(function (cid, hIdx) {
        var R = ROLE[cid];
        if (!R || !R.troop || R.cost > Math.min(3, me.elixir)) return;
        if (!kite || R.cost < kite.cost) kite = { hIdx: hIdx, cost: R.cost };
      });
      if (kite) opts.push({ kind: 'troop', hIdx: kite.hIdx, fx: KING_X, fy: FRONT_FY, score: 1.0, cost: kite.cost });
    }
    if (!opts.length) return null;
    opts.sort(function (a, b) { return b.score - a.score; });
    var pick = opts[0];
    if (opts.length > 1 && this.rng() < cfg.errChance) {
      pick = opts[1 + Math.floor(this.rng() * (opts.length - 1))];
    }
    return pick;
  };

  AI.prototype.kingReal = function () {
    var ks = this.game.getTowers(this.team).filter(function (tw) { return tw.towerType === 'king' && alive(tw); });
    if (ks.length) return { x: ks[0].x, y: ks[0].y };
    return { x: KING_X, y: realY(this.team, 3) };
  };

  // Damage a spell does to one unit, in elixir-equivalent value.
  AI.prototype.spellValueOn = function (R, u, fy) {
    var dmg = R.effDamage;
    var base = unitBase(u.unitId);
    var v = u.hp <= dmg ? base : base * 0.5 * Math.min(1, dmg / u.hp);
    if (R.freeze) v += base * 0.3;
    if (u.unitId === 'infernotower' && (R.id === 'zap' || R.log)) v += 1.5 * (1 + (u.rampStage || 0));
    if (KEY_RANGED[u.unitId] && u.hp <= dmg && fy <= 12) v += 1;
    return v;
  };

  // Best aim for a damage spell against enemy clusters in the threat zone.
  // Returns a spell option or null.
  AI.prototype.spellPlay = function (R, hIdx, enemies) {
    var self = this, cfg = this.cfg, team = this.team;
    var zone = enemies.filter(function (e) { return fyOf(team, e.y) < THREAT_FY; });
    if (!zone.length || !R.counters || R.barrel) return null;
    var rad = R.log ? 2.0 : (R.radius || 1.5);
    var best = null;
    zone.forEach(function (c) {
      var V = 0, cluster = [];
      zone.forEach(function (u) {
        if (dist(c.x, c.y, u.x, u.y) > rad + u.r) return;
        if (u.air && !R.airCapable) return;
        var v = self.spellValueOn(R, u, fyOf(team, u.y));
        if (v <= 0) return;
        V += v;
        cluster.push(u);
      });
      if (cluster.length && (!best || V > best.V)) best = { V: V, cluster: cluster };
    });
    if (!best || best.V < R.cost * cfg.spellBias) return null;

    var n = best.cluster.length, sx = 0, sy = 0, vx = 0, vy = 0;
    best.cluster.forEach(function (u) {
      sx += u.x; sy += u.y;
      var p = self.prev[u.id];
      if (p) { vx += p.vx; vy += p.vy; }
    });
    var cx = sx / n, cy = sy / n;
    var ax = cx, ay = cy;
    if (R.log) {
      // The log rolls toward the enemy (increasing fy), so start it behind the cluster.
      var fy0 = clamp(fyOf(team, cy) - 3, 0.5, H - 0.5);
      ay = realY(team, fy0);
    } else if (R.travelSpeed > 0) {
      var k = self.kingReal();
      var tt = dist(k.x, k.y, cx, cy) / R.travelSpeed;
      ax += (vx / n) * tt * 0.7;
      ay += (vy / n) * tt * 0.7;
    }
    ax = clamp(ax, 0.2, W - 0.2);
    ay = clamp(ay, 0.2, H - 0.2);
    return { kind: 'spell', hIdx: hIdx, x: ax, y: ay, cost: R.cost, score: Math.min(6, (2 * best.V) / R.cost) };
  };

  // Finish a tower with a damage spell when the spell's tower damage covers its hp.
  AI.prototype.towerFinish = function (me, eTowers) {
    var best = null;
    me.hand.forEach(function (cid, hIdx) {
      var R = ROLE[cid];
      if (!R || !R.spell || R.cost > me.elixir || R.towerDamage <= 0 || !R.damageSpell || R.log) return;
      eTowers.forEach(function (tw) {
        if (tw.hp > R.towerDamage) return;
        if (!best || R.cost < best.cost) best = { kind: 'spell', hIdx: hIdx, x: tw.x, y: tw.y, cost: R.cost };
      });
    });
    return best;
  };

  // Elixir at the cap: play the cheapest troop at the back instead of leaking.
  AI.prototype.leakFix = function (me) {
    if (me.elixir < 9.5) return null;
    if (this.cfg.leak && this.rng() < this.cfg.leak) return null;
    var best = null;
    me.hand.forEach(function (cid, hIdx) {
      var R = ROLE[cid];
      if (!R || !R.troop || R.cost > me.elixir) return;
      if (!best || R.cost < best.cost) best = { hIdx: hIdx, cost: R.cost, ranged: R.ranged || R.building };
    });
    if (!best) return null;
    var lx = PRINCESS_X[this.rng() < 0.5 ? 0 : 1];
    return {
      kind: 'troop', hIdx: best.hIdx, cost: best.cost, score: 0,
      fx: lx, fy: best.ranged ? BACK_FY : FRONT_FY
    };
  };

  AI.prototype.pickLane = function (eTowers) {
    var best = 0, bestScore = -Infinity;
    for (var L = 0; L < 2; L++) {
      var pr = eTowers.filter(function (tw) { return tw.towerType === 'princess' && laneOf(tw.x) === L; })[0];
      var s = pr ? -pr.hp : 1e6;   // a downed princess opens the pocket, which is preferred
      s += this.rng() * 50;
      if (s > bestScore) { bestScore = s; best = L; }
    }
    return best;
  };

  // Best card in hand matching pred by dps (ties by cheaper cost). Returns { idx, R } or null.
  function bestInHand(me, pred) {
    var best = null;
    me.hand.forEach(function (cid, idx) {
      var R = ROLE[cid];
      if (!R || !pred(R)) return;
      if (!best || R.dps > best.R.dps || (R.dps === best.R.dps && R.cost < best.R.cost)) best = { idx: idx, R: R };
    });
    return best;
  }

  AI.prototype.offence = function (me, myUnits, eTowers, t) {
    var g = this.game, cfg = this.cfg, team = this.team;
    var mult = g.elixirMult || 1;
    var thr = Math.max(5, cfg.pushAt - (mult >= 2 ? 2 : 0) - (mult >= 3 ? 1 : 0));
    if (!this.push) {
      var enemyElixir = (g.players[this.enemy] && g.players[this.enemy].elixir) || 0;
      var counter = cfg.counterPush && t < this.counterUntil && me.elixir >= 5 && me.elixir >= enemyElixir;
      if (t < this.pushCooldownUntil || (me.elixir < thr && !counter)) return null;
      this.push = { lane: this.pickLane(eTowers), start: t };
    }
    var P = this.push;
    if (t - P.start > 45) {
      this.push = null;
      this.pushCooldownUntil = t + 4;
      return null;
    }
    var L = P.lane, lx = PRINCESS_X[L];
    var pr = eTowers.filter(function (tw) { return tw.towerType === 'princess' && laneOf(tw.x) === L; })[0];
    var tankFy = pr ? PUSH_FY : POCKET_FY;

    if (pr) {
      var barrel = bestInHand(me, function (R) { return R.barrel && R.cost <= me.elixir; });
      if (barrel) return { kind: 'spell', hIdx: barrel.idx, x: pr.x, y: pr.y, cost: barrel.R.cost, score: 0 };
    }

    var tank = myUnits.filter(function (u) { return laneOf(u.x) === L && isHeavy(u); })[0];
    if (!tank) {
      var heavyAny = bestInHand(me, function (R) { return R.troop && (R.tank || R.winCon); });
      if (heavyAny) {
        if (heavyAny.R.cost > me.elixir) return null;
        return {
          kind: 'troop', hIdx: heavyAny.idx, cost: heavyAny.R.cost, score: 0,
          fx: lx, fy: (heavyAny.R.winCon && !heavyAny.R.tank) ? BRIDGE_FY : tankFy
        };
      }
      if (me.elixir < thr) return null;
      var filler = bestInHand(me, function (R) { return R.troop && R.cost <= me.elixir; });
      if (!filler) return null;
      return { kind: 'troop', hIdx: filler.idx, cost: filler.R.cost, score: 0, fx: lx, fy: tankFy };
    }

    var tfy = fyOf(team, tank.y);
    if (tfy < OWN_FY) return null;   // tank has not reached the bridge yet
    var support = bestInHand(me, function (R) {
      return R.troop && !R.tank && !R.winCon && (R.ranged || R.splash) && R.cost <= me.elixir;
    });
    if (!support) {
      support = bestInHand(me, function (R) {
        return R.troop && !R.tank && !R.winCon && R.cost <= me.elixir && me.elixir >= thr;
      });
    }
    if (!support) return null;
    return {
      kind: 'troop', hIdx: support.idx, cost: support.R.cost, score: 0,
      fx: tank.x, fy: tfy - 2
    };
  };

  // Spawn-spot search: the ideal frame point first, then a spiral of nearby points.
  AI.prototype.spot = function (hIdx, fx, fy) {
    var g = this.game, team = this.team;
    fx = clamp(fx, 0.5, W - 0.5);
    fy = clamp(fy, 0.5, H - 0.5);
    for (var i = 0; i < SPIRAL.length; i++) {
      var cx = clamp(fx + SPIRAL[i][0], 0.2, W - 0.2);
      var cfy = clamp(fy + SPIRAL[i][1], 0.2, H - 0.2);
      var ry = realY(team, cfy);
      if (g.canDeploy(team, hIdx, cx, ry)) return { x: cx, y: ry };
    }
    return null;
  };

  AI.prototype.play = function (opt, t) {
    var g = this.game, team = this.team, cfg = this.cfg;
    var x = opt.x, y = opt.y;
    if (opt.kind === 'troop') {
      var s = this.spot(
        opt.hIdx,
        opt.fx + (this.rng() * 2 - 1) * cfg.jitter,
        opt.fy + (this.rng() * 2 - 1) * cfg.jitter
      );
      if (!s) return false;
      x = s.x;
      y = s.y;
    } else {
      x = clamp(x + (this.rng() * 2 - 1) * cfg.jitter * 0.5, 0.2, W - 0.2);
      y = clamp(y + (this.rng() * 2 - 1) * cfg.jitter * 0.5, 0.2, H - 0.2);
      if (!g.canDeploy(team, opt.hIdx, x, y)) return false;
    }
    if (!g.deploy(team, opt.hIdx, x, y)) return false;
    this.nextPlayT = t + this.rand(cfg.gap);
    return true;
  };

  CR.AI = AI;
})();

if (typeof module !== 'undefined') module.exports = CR;
