// Configurable player bot (CR.Bot). Plays either team through the public engine API only:
// reads state, calls game.canDeploy and game.deploy. Every tunable value comes from its config
// (see js/botconfig.js); the only constants left are board geometry and measurement thresholds.
//
// Geometry is done in the bot's own frame, like js/ai.js: fy = y for team 1 (top), fy = 32 - y for
// team 0. In that frame the bot's princess towers sit near fy 6.5, the river is fy 15..17, and the bot's
// own troops walk toward increasing fy (the enemy side). Enemies walk toward decreasing fy. x is the same
// in both frames.
//
// Randomness comes from a seeded mulberry32 (never Math.random), so a config and seed replay exactly.
var CR = (globalThis.CR = globalThis.CR || {});

(function () {
  'use strict';

  if (typeof require === 'function') {
    if (!CR.CARDS) require('./cards.js');
    if (!CR.Game) require('./engine.js');
    if (!CR.botConfig) require('./botconfig.js');
  }

  var W = CR.ARENA.W;
  var H = CR.ARENA.H;
  var RIVER_TOP = CR.ARENA.RIVER_TOP;
  var OWN_LINE = RIVER_TOP;          // own half in the bot frame is fy < 15
  var POCKET_FY = RIVER_TOP + 3.5;   // pocket reaches 4 tiles past the river
  var BRIDGE_FY = RIVER_TOP - 2;     // bridge placement on the own side
  var CHECK_PAD = 0.2;               // extra seconds before a spell's hits are measured
  var SPIRAL = [[0, 0]];
  (function () {
    [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].forEach(function (r) {
      for (var k = 0; k < 12; k++) {
        var a = (k * Math.PI) / 6;
        SPIRAL.push([r * Math.cos(a), r * Math.sin(a)]);
      }
    });
  })();

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

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function alive(e) { return !!e && !e.dead && e.hp > 0; }
  function fyOf(team, y) { return team === 1 ? y : H - y; }
  function realY(team, fy) { return team === 1 ? fy : H - fy; }
  function laneOf(x) { return x < W / 2 ? 0 : 1; }

  // Board layout read from the card and tower data, so a changed layout still works.
  function layout() {
    var princessX = [3.5, 14.5], princessFy = 6.5, kingX = W / 2, kingFy = 3;
    CR.TOWERS.layout.forEach(function (entry) {
      var fy = H - entry.y;
      if (entry.type === 'princess' && entry.lane >= 0) { princessX[entry.lane] = entry.x; princessFy = fy; }
      if (entry.type === 'king') { kingX = entry.x; kingFy = fy; }
    });
    return { princessX: princessX, princessFy: princessFy, kingX: kingX, kingFy: kingFy };
  }

  // Card roles from CR.CARDS and CR.UNITS. Rebuilt per bot so newly added cards are picked up.
  function buildRoles(tankHp) {
    var ROLE = {}, costSum = {}, costN = {};
    Object.keys(CR.CARDS).forEach(function (id) {
      var c = CR.CARDS[id];
      var u = c.unit ? CR.UNITS[c.unit] : null;
      var count = c.count || 1;
      var R = {
        id: id, cost: c.cost, type: c.type, count: count,
        troop: c.type === 'troop', building: c.type === 'building', spell: c.type === 'spell',
        unitId: c.unit || null,
        winCon: false, tank: false, splash: false, airCapable: false, swarm: false,
        counters: false, ranged: false, range: 0, dps: 0,
        damage: c.damage || 0, towerDamage: c.towerDamage || 0, radius: c.radius || 0,
        travelSpeed: c.travelSpeed || 0, freeze: c.freeze || 0,
        effDamage: 0, damageSpell: false, barrel: !!c.spawnUnit,
        log: !!c.log, zapLike: !!(c.stun || c.log),
      };
      if (u) {
        R.range = u.range;
        R.ranged = !!u.projectile || u.range >= 3;
        R.dps = u.hitSpeed ? (u.ramp ? u.ramp.stages[1] : u.damage) / u.hitSpeed : 0;
        R.winCon = u.targets === 'buildings';
        R.tank = u.kind === 'troop' && u.hp >= tankHp;
        R.splash = !!(u.splash || u.splashAroundSelf);
        R.airCapable = u.targets === 'both';
        R.swarm = R.troop && count >= 3;
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
      }
      ROLE[id] = R;
    });
    var unitCost = {};
    Object.keys(costSum).forEach(function (n) { unitCost[n] = costSum[n] / costN[n]; });
    return { roles: ROLE, unitCost: unitCost };
  }

  function newStats() {
    return {
      cardsPlayed: 0, elixirSpent: 0, leakSeconds: 0,
      spellsCast: 0, spellValueEst: 0, spellValueHit: 0, spellUnitsHit: 0, spellKills: 0, spellDamageHit: 0,
      defenses: 0, kitePlays: 0, pushesStarted: 0,
      baitPlays: 0, supportPlays: 0, forcedPlays: 0, idlePlays: 0, randomPlays: 0,
      towerDamage: 0,
      // Planner. Counts of plans by kind, and plays made inside them.
      punishPushes: 0, counterPushes: 0, planPlays: 0, planSpells: 0, endgamePlays: 0, endgameTowerSpells: 0,
      // Mean over the match: the opponent elixir estimate as the bot read it, and the elixir advantage.
      oppElixir: 0, elixirAdv: 0,
    };
  }

  function Bot(game, team, config) {
    var cfg = CR.botConfig(config === undefined ? {} : config);
    var built = buildRoles(cfg.offense.tankHp);
    this.game = game;
    this.team = team;
    this.enemy = 1 - team;
    this.cfg = cfg;
    this.deck = CR.botDeck(cfg);
    this.roles = built.roles;
    this.unitCost = built.unitCost;
    this.lay = layout();
    this.rng = mulberry32(((cfg.general.seed | 0) ^ Math.imul(team + 1, 0x9e3779b1)) >>> 0);
    this.stats = newStats();
    this.trace = [];
    this.thinkT = 0;
    this.nextPlayT = 0;
    this.reactAt = [null, null];
    this.threatTowers = 0;
    this.counterUntil = -1;
    this.pushes = [];
    this.pushCooldownUntil = 0;
    this.prev = {};              // enemy id -> { x, y, t, vx, vy } for leading spells
    this.recentPlays = [];       // own play times, for cards per 10 s
    this.cycleLane = 0;
    this.capSince = null;        // time elixir first reached maxHold in this run
    this.enemyPlays = [];        // { t, cardId, lane }
    this.enemySpends = [];       // { t, cost } of the opponent's recent plays
    this.enemyLastLane = -1;
    this.lastPushLane = -1;
    this.oppEl = CR.ELIXIR.start;  // the opponent's elixir, tracked from the engine's regen rule and their deploys
    this.noiseVal = 0;           // current error on the estimate (planner, normal tier)
    this.noiseUntil = -1;
    this.plans = [];             // active planner pushes
    this.plannedCooldownUntil = 0;
    this.prevOwn = {};           // own unit id -> { x, y, t, vx, vy }, for counter-push heading
    this.advantage = 0;          // elixir advantage, last think
    this.sumOpp = 0; this.sumAdv = 0; this.sumN = 0;
    this.towerHp = new Map();    // enemy tower -> last hp seen
    var self = this;
    game.entities.forEach(function (e) {
      if (e.kind === 'tower' && e.team === self.enemy) self.towerHp.set(e, e.hp);
    });
    this.pending = [];           // spells waiting for their impact check
    this.enemyHand = game.players[this.enemy] ? game.players[this.enemy].hand.slice() : null;
    this.enemyMaxId = 0;
    this.lastEnemyPlayT = -1;    // last time the opponent played a card
    this.lastPunishT = -1;       // a punish answers one enemy play, not every low-elixir moment after it
    game.entities.forEach(function (e) { if (e.id > self.enemyMaxId) self.enemyMaxId = e.id; });
  }

  Bot.prototype.R = function (cardId) { return this.roles[cardId] || null; };
  Bot.prototype.rand = function (lo, hi) { return lo + (hi - lo) * this.rng(); };
  Bot.prototype.unitBase = function (unitId) {
    if (this.unitCost[unitId] !== undefined) return this.unitCost[unitId];
    var u = CR.UNITS[unitId];
    return u ? clamp(u.hp / 400, 0.2, 6) : 0.5;
  };
  Bot.prototype.unitValue = function (e) {
    return this.unitBase(e.unitId) * Math.max(0.2, e.hp / e.maxHp);
  };
  Bot.prototype.isHeavy = function (e) {
    var u = CR.UNITS[e.unitId];
    return !!u && u.kind === 'troop' && (u.hp >= this.cfg.offense.tankHp || u.targets === 'buildings');
  };

  // ---- update loop ------------------------------------------------------

  Bot.prototype.update = function (dt) {
    var g = this.game;
    if (!g) return;
    // Sample before the end check so damage in the final step still counts.
    this.sample(dt);
    if (g.result || g.phase === 'ended') return;
    var me = g.players[this.team];
    if (me && me.elixir >= 9.99) this.stats.leakSeconds += dt;
    this.thinkT -= dt;
    if (this.thinkT > 0) return;
    var interval = this.cfg.timing.thinkInterval;
    this.thinkT += interval;
    if (this.thinkT <= 0) this.thinkT = interval;
    this.think();
  };

  // Per step bookkeeping: enemy plays, tower damage, spell impact checks.
  Bot.prototype.sample = function (dt) {
    var g = this.game, t = g.time, self = this;
    // Opponent elixir: the engine's regen rule (1 per regen seconds at the current multiplier, capped), less the
    // cost of each card they deploy. Exact, since the rule and the deploy events are both public.
    this.oppEl = Math.min(CR.ELIXIR.max, this.oppEl + (dt * (g.elixirMult || 1)) / CR.ELIXIR.regen);
    // The opponent's plays come from their hand: a card that leaves it was played. The engine clears its
    // events every step, and the other side may deploy after this bot has sampled, so events miss some plays.
    // The lane comes from the newest enemy entities (engine ids only grow).
    var eh = g.players[this.enemy].hand.slice();
    var left = this.enemyHand ? this.enemyHand.slice() : eh.slice();
    eh.forEach(function (cid) { var i = left.indexOf(cid); if (i >= 0) left.splice(i, 1); });
    this.enemyHand = eh;
    var firstNew = null, maxId = this.enemyMaxId;
    g.entities.forEach(function (e) {
      if (e.team !== self.enemy || e.kind === 'tower' || e.id <= self.enemyMaxId) return;
      if (!firstNew || e.id < firstNew.id) firstNew = e;
      if (e.id > maxId) maxId = e.id;
    });
    this.enemyMaxId = maxId;
    left.forEach(function (cid) {
      var ec = CR.CARDS[cid] ? CR.CARDS[cid].cost : 0;
      var R = self.R(cid);
      self.oppEl = Math.max(0, self.oppEl - ec);
      // Elixir the opponent spent in the last 8 s. A big spend leaves it short, so a push now is punished.
      self.enemySpends.push({ t: t, cost: ec });
      var lane = firstNew ? laneOf(firstNew.x) : -1;
      self.enemyPlays.push({ t: t, cardId: cid, lane: lane });
      self.lastEnemyPlayT = t;
      if (self.enemyPlays.length > 20) self.enemyPlays.shift();
      if (R && !R.spell && firstNew) self.enemyLastLane = laneOf(firstNew.x);
    });
    this.enemySpends = this.enemySpends.filter(function (x) { return x.t >= t - 8; });
    this.towerHp.forEach(function (hp0, tw) {
      var drop = hp0 - tw.hp;
      if (drop > 0) self.stats.towerDamage += drop;
      self.towerHp.set(tw, tw.hp);
    });
    if (this.pending.length) {
      var still = [];
      this.pending.forEach(function (p) {
        if (t < p.due) { still.push(p); return; }
        self.settleSpell(p);
      });
      this.pending = still;
    }
  };

  Bot.prototype.settleSpell = function (p) {
    var st = this.stats, self = this;
    p.victims.forEach(function (v) {
      var drop = v.e.dead ? v.hp : Math.max(0, v.hp - v.e.hp);
      if (drop <= 0) return;
      st.spellDamageHit += drop;
      st.spellUnitsHit++;
      if (v.e.dead) st.spellKills++;
      st.spellValueHit += self.unitBase(v.e.unitId) * Math.min(1, drop / Math.max(1, v.hp));
    });
  };

  // ---- decisions ----------------------------------------------------------

  Bot.prototype.think = function () {
    var g = this.game, t = g.time, team = this.team, me = g.players[team];
    if (!me) return;
    var cfg = this.cfg;
    var enemies = g.getUnitsOf(this.enemy).filter(alive);
    var eTowers = g.getTowers(this.enemy).filter(alive);
    var myUnits = g.getUnitsOf(team).filter(alive);
    var myTowers = g.getTowers(team).filter(alive);

    this.trackVelocities(enemies, t, 'prev');
    this.trackVelocities(myUnits, t, 'prevOwn');
    if (cfg.general.randomPlay) {
      if (t >= this.nextPlayT) {
        var rp = this.randomOption(me);
        if (rp) this.play(rp, t);
      }
      return;
    }

    var threats = this.assessThreats(enemies, myUnits);
    this.updateReactions(threats, myTowers.length, t);
    if (me.elixir >= cfg.elixir.maxHold) {
      if (this.capSince === null) this.capSince = t;
    } else {
      this.capSince = null;
    }
    // Planner inputs: the opponent elixir as read (with the normal tier's error), the elixir advantage, endgame state.
    var eg = this.endgameState(me);
    if (cfg.plan.elixirNoise > 0 && t >= this.noiseUntil) {
      this.noiseVal = this.rand(-cfg.plan.elixirNoise, cfg.plan.elixirNoise);
      this.noiseUntil = t + 2;
    }
    var oppRead = this.oppElRead();
    this.advantage = (me.elixir - oppRead) + 0.5 * (this.boardValue(myUnits) - this.boardValue(enemies));
    this.sumOpp += oppRead; this.sumAdv += this.advantage; this.sumN++;
    this.stats.oppElixir = this.sumOpp / this.sumN;
    this.stats.elixirAdv = this.sumAdv / this.sumN;
    var ctx = { oppEl: oppRead, eg: eg, adv: this.advantage };

    if (t < this.nextPlayT) return;

    var self0 = this;
    var opt = null;
    if (cfg.spells.towerFinish) opt = this.towerFinish(me, eTowers);
    var thr = cfg.defense.threatThreshold;
    // A threat blocks offence only while the bot is still reacting to it. One it cannot answer
    // does not hold the bot back from its own push.
    var uncovered = threats.some(function (T) {
      return T.need > thr && (self0.reactAt[T.lane] === null || t < self0.reactAt[T.lane]);
    });
    if (!opt) {
      var self = this;
      var ready = threats.filter(function (T) {
        return T.need > thr && self.reactAt[T.lane] !== null && t >= self.reactAt[T.lane];
      });
      ready.sort(function (a, b) { return b.value - a.value; });
      for (var i = 0; i < ready.length && !opt; i++) opt = this.bestDefence(ready[i], me, enemies);
    }
    if (!opt && this.capSince !== null && t - this.capSince >= cfg.elixir.leakTolerance) {
      opt = this.forcedPlay(me);
    }
    if (!opt && !uncovered) {
      opt = cfg.plan.enabled ? this.planOffence(me, myUnits, eTowers, enemies, t, ctx) : this.offence(me, myUnits, eTowers, t);
    }
    if (!opt && !uncovered) opt = this.idlePlay(me, t);
    if (opt) this.play(opt, t);
  };

  // Velocity of each unit since the last think. store is 'prev' (enemies) or 'prevOwn' (own units).
  Bot.prototype.trackVelocities = function (units, t, store) {
    var old = this[store], next = {};
    units.forEach(function (e) {
      var p = old[e.id], vx = 0, vy = 0;
      if (p && t > p.t) {
        vx = (e.x - p.x) / (t - p.t);
        vy = (e.y - p.y) / (t - p.t);
      }
      next[e.id] = { x: e.x, y: e.y, t: t, vx: vx, vy: vy };
    });
    this[store] = next;
  };

  Bot.prototype.ourDefence = function (myUnits, lane) {
    var sum = 0, self = this;
    myUnits.forEach(function (u) {
      if (laneOf(u.x) === lane && fyOf(self.team, u.y) < OWN_LINE) sum += self.unitValue(u);
    });
    return sum;
  };

  // Threats: enemy units inside the threat line, grouped by lane.
  Bot.prototype.assessThreats = function (enemies, myUnits) {
    var self = this, cfg = this.cfg;
    var lanes = [null, null];
    enemies.forEach(function (e) {
      var fy = fyOf(self.team, e.y);
      if (fy >= cfg.defense.threatLine) return;
      var u = CR.UNITS[e.unitId];
      if (!u) return;
      var L = laneOf(e.x);
      var T = lanes[L] || (lanes[L] = {
        lane: L, value: 0, airValue: 0, count: 0, lowHp: 0,
        tank: false, winCon: false, air: false, swarm: false, need: 0,
      });
      var v = self.unitValue(e);
      T.value += v;
      T.count++;
      if (e.air) { T.air = true; T.airValue += v; }
      if (u.hp >= cfg.offense.tankHp) T.tank = true;
      if (u.targets === 'buildings') T.winCon = true;
      if (u.kind === 'troop' && u.hp <= cfg.defense.swarmHp) T.lowHp++;
    });
    var out = [];
    lanes.forEach(function (T) {
      if (!T) return;
      T.swarm = T.lowHp >= 3;
      T.need = T.value - cfg.defense.defenceCredit * self.ourDefence(myUnits, T.lane);
      out.push(T);
    });
    return out;
  };

  Bot.prototype.updateReactions = function (threats, towers, t) {
    var cfg = this.cfg;
    var has = [false, false];
    threats.forEach(function (T) { if (T.need > cfg.defense.threatThreshold) has[T.lane] = true; });
    var wasAny = this.reactAt[0] !== null || this.reactAt[1] !== null;
    var anyNow = has[0] || has[1];
    if (anyNow && !wasAny) this.threatTowers = towers;
    var lo = Math.min(cfg.timing.reactionMin, cfg.timing.reactionMax);
    var hi = Math.max(cfg.timing.reactionMin, cfg.timing.reactionMax);
    for (var L = 0; L < 2; L++) {
      if (has[L] && this.reactAt[L] === null) {
        this.reactAt[L] = t + this.rand(lo, hi);
      } else if (!has[L]) {
        this.reactAt[L] = null;
      }
    }
    if (wasAny && !anyNow && towers >= this.threatTowers) {
      this.counterUntil = t + cfg.offense.counterWindow;
    }
  };

  // Frame spots for a drop, by card role.
  Bot.prototype.frontFy = function () { return this.lay.princessFy + this.cfg.defense.frontDistance; };
  Bot.prototype.backFy = function () { return this.lay.princessFy - this.cfg.defense.backDistance; };

  Bot.prototype.troopSpot = function (R, T) {
    var lx = this.lay.princessX[T.lane];
    if (R.building) {
      return T.winCon
        ? { fx: this.lay.kingX, fy: this.lay.princessFy + this.cfg.defense.buildingDepth }
        : { fx: lx, fy: this.backFy() };
    }
    if (R.ranged) return { fx: lx, fy: this.backFy() };
    return { fx: lx, fy: this.frontFy() };
  };

  Bot.prototype.counterScore = function (R, T) {
    var d = this.cfg.defense;
    if (!R.counters) return (R.building && T.winCon) ? 1.5 * d.weightBuilding : 0;
    var airFrac = T.value > 0 ? T.airValue / T.value : 0;
    if (airFrac > 0.5 && !R.airCapable) return 0;
    var s = 1;
    if (airFrac > 0 && R.airCapable) s += 1 + 2 * airFrac;
    if (T.swarm) {
      if (R.splash) s += 2.5 * d.weightSplash;
      if (R.swarm) s += 0.5 * d.weightSwarm;
    }
    if (T.tank || T.winCon) {
      s += Math.min(3, R.dps / 250) * d.weightDps;
      if (R.tank) s += 0.5;
      if (R.building && T.winCon) s += 2 * d.weightBuilding;
    }
    if (R.building && !T.winCon) s -= 0.5;
    return s;
  };

  Bot.prototype.bestDefence = function (T, me, enemies) {
    var self = this, cfg = this.cfg, d = cfg.defense, opts = [];
    var zone = enemies.filter(function (e) { return fyOf(self.team, e.y) < d.threatLine; });
    var maxCost = T.need * d.overcommit + 2 + ((T.tank || T.winCon) ? d.heavyAllowance : 0);
    me.hand.forEach(function (cid, hIdx) {
      var R = self.R(cid);
      if (!R || R.cost > me.elixir + 1e-6 || R.cost > maxCost) return;
      if (R.spell) {
        var sp = self.spellPlay(R, hIdx, zone);
        if (sp) { sp.reason = 'defend spell ' + R.id; opts.push(sp); }
        return;
      }
      var s = self.counterScore(R, T);
      if (s <= 0) return;
      s -= R.cost * d.costBias + Math.max(0, R.cost - (T.need * 1.3 + 1.5)) * d.overkillPenalty;
      var p = self.troopSpot(R, T);
      opts.push({ kind: 'troop', hIdx: hIdx, fx: p.fx, fy: p.fy, score: s, cost: R.cost, reason: 'defend lane ' + T.lane });
    });
    var best = opts.reduce(function (m, o) { return Math.max(m, o.score); }, -Infinity);
    if (T.tank && best < 1.5) {
      var kite = null;
      me.hand.forEach(function (cid, hIdx) {
        var R = self.R(cid);
        if (!R || R.spell || R.cost > Math.min(d.kiteMaxCost, me.elixir)) return;
        if (R.building && !d.kiteBuildings) return;
        if (!kite || R.cost < kite.cost) kite = { hIdx: hIdx, cost: R.cost };
      });
      if (kite) {
        opts.push({
          kind: 'troop', hIdx: kite.hIdx, cost: kite.cost, score: 1.0,
          fx: self.lay.princessX[T.lane], fy: self.frontFy() + d.kiteOffset,
          reason: 'kite lane ' + T.lane, kite: true,
        });
      }
    }
    if (!opts.length) return null;
    opts.sort(function (a, b) { return b.score - a.score; });
    var pick = opts[0];
    if (opts.length > 1 && d.pickNoise > 0 && this.rng() < d.pickNoise) {
      pick = opts[1 + Math.floor(this.rng() * (opts.length - 1))];
    }
    return pick;
  };

  Bot.prototype.kingReal = function () {
    var self = this;
    var ks = this.game.getTowers(this.team).filter(function (tw) { return tw.towerType === 'king' && alive(tw); });
    if (ks.length) return { x: ks[0].x, y: ks[0].y };
    return { x: self.lay.kingX, y: realY(self.team, self.lay.kingFy) };
  };

  // Value of a damage spell against one enemy, in elixir-equivalent value.
  Bot.prototype.spellValueOn = function (R, u, fy) {
    var dmg = R.effDamage;
    var base = this.unitBase(u.unitId);
    var k = this.cfg.spells.keyUnitBonus;
    var v = u.hp <= dmg ? base : base * 0.5 * Math.min(1, dmg / u.hp);
    if (R.freeze) v += base * 0.3;
    if (u.unitId === 'infernotower' && (R.id === 'zap' || R.log)) v += 1.5 * k * (1 + (u.rampStage || 0));
    var ranged = CR.UNITS[u.unitId] && (CR.UNITS[u.unitId].projectile || CR.UNITS[u.unitId].range >= 3);
    if (ranged && u.hp <= dmg && fy <= 12) v += k;
    return v;
  };

  // Best aim for a damage spell against enemy clusters in the threat zone. Returns an option or null.
  // zone: the enemy units the spell may land on (threats for defence, the push's contact for the planner).
  Bot.prototype.spellPlay = function (R, hIdx, zone) {
    var self = this, cfg = this.cfg, team = this.team;
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
    if (!best || best.V < R.cost * cfg.spells.minValueRatio) return null;
    if (cfg.spells.swarmOnlyZapLog && R.zapLike && best.cluster.length < 3) return null;

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
      var k = this.kingReal();
      var tt = dist(k.x, k.y, cx, cy) / R.travelSpeed;
      ax += (vx / n) * tt * cfg.spells.predictLead;
      ay += (vy / n) * tt * cfg.spells.predictLead;
    }
    ax = clamp(ax, 0.2, W - 0.2);
    ay = clamp(ay, 0.2, H - 0.2);
    return {
      kind: 'spell', hIdx: hIdx, x: ax, y: ay, cost: R.cost,
      score: Math.min(6, (2 * best.V) / R.cost), value: best.V, reason: 'spell ' + R.id, exactSpot: true,
    };
  };

  // Finish an enemy princess tower with a damage spell that covers its hp.
  Bot.prototype.towerFinish = function (me, eTowers) {
    var self = this, best = null;
    me.hand.forEach(function (cid, hIdx) {
      var R = self.R(cid);
      if (!R || !R.spell || R.cost > me.elixir || R.towerDamage <= 0 || !R.damageSpell || R.log || R.barrel) return;
      eTowers.forEach(function (tw) {
        if (tw.hp > R.towerDamage) return;
        if (!best || R.cost < best.cost) {
          best = { kind: 'spell', hIdx: hIdx, x: tw.x, y: tw.y, cost: R.cost, exactSpot: true, reason: 'tower finish ' + R.id };
        }
      });
    });
    return best;
  };

  // Elixir is pinned at the cap: play the cheapest troop instead of leaking.
  Bot.prototype.forcedPlay = function (me) {
    var self = this, best = null;
    me.hand.forEach(function (cid, hIdx) {
      var R = self.R(cid);
      if (!R || !(R.troop || (R.building && !R.winCon)) || R.cost > me.elixir) return;
      if (!best || R.cost < best.R.cost) best = { hIdx: hIdx, R: R };
    });
    if (!best) return null;
    var lane = this.cycleLane;
    this.cycleLane = 1 - this.cycleLane;
    return {
      kind: 'troop', hIdx: best.hIdx, cost: best.R.cost, forced: true,
      fx: this.lay.princessX[lane], fy: best.R.ranged || best.R.building ? this.backFy() : this.frontFy(),
      reason: 'leak fix',
    };
  };

  // Random baseline: any affordable card at a random legal spot.
  Bot.prototype.randomOption = function (me) {
    var g = this.game, team = this.team, self = this;
    var cands = [];
    me.hand.forEach(function (cid, i) {
      var R = self.R(cid);
      if (R && R.cost <= me.elixir + 1e-9) cands.push(i);
    });
    if (!cands.length) return null;
    for (var tries = 0; tries < 16; tries++) {
      var hIdx = cands[Math.floor(this.rng() * cands.length)];
      var R = this.R(me.hand[hIdx]);
      var x, y;
      if (R.spell) {
        x = this.rand(0.5, W - 0.5);
        y = this.rand(0.5, H - 0.5);
      } else {
        x = this.rand(0.5, W - 0.5);
        y = realY(team, this.rand(1, OWN_LINE - 1));
      }
      if (g.canDeploy(team, hIdx, x, y)) {
        return { kind: R.spell ? 'spell' : 'troop', hIdx: hIdx, x: x, y: y, cost: R.cost, exactSpot: true, reason: 'random', random: true };
      }
    }
    return null;
  };

  // Lane choice for a new push. Returns 0 or 1.
  Bot.prototype.pickLane = function (eTowers, exclude, modeOverride) {
    var self = this, mode = modeOverride || this.cfg.offense.laneMode;
    var best = -1, bestScore = -Infinity;
    for (var L = 0; L < 2; L++) {
      if (exclude === L) continue;
      var pr = eTowers.filter(function (tw) { return tw.towerType === 'princess' && laneOf(tw.x) === L; })[0];
      var s;
      if (mode === 'weakest') s = pr ? -pr.hp : 1e6;
      else if (mode === 'sameLast') s = (L === this.lastPushLane) ? 1 : 0;
      else if (mode === 'opposite') s = (this.enemyLastLane >= 0 && L !== this.enemyLastLane) ? 1 : 0;
      else s = 0;
      s += this.rng() * (mode === 'random' ? 1 : 0.5);
      if (s > bestScore) { bestScore = s; best = L; }
    }
    return best < 0 ? 0 : best;
  };

  Bot.prototype.newPush = function (t, eTowers, exclude) {
    var P = {
      lane: this.pickLane(eTowers, exclude), start: t,
      tankPlaced: false, tankPlacedAt: -1, supportDone: false,
      bait: this.rng() < this.cfg.offense.baitChance, baitDone: false,
      splitRolled: false, done: false,
    };
    this.lastPushLane = P.lane;
    this.pushes.push(P);
    this.stats.pushesStarted++;
    return P;
  };

  // Elixir spent on a non-tank card must leave the defence reserve, unless elixir is at the forced-play cap.
  Bot.prototype.canSpend = function (me, cost, isTank) {
    if (me.elixir + 1e-9 < cost) return false;
    if (isTank) return true;
    return me.elixir - cost >= this.cfg.elixir.defenseReserve - 1e-9 || me.elixir >= this.cfg.elixir.maxHold;
  };

  // Best card in hand matching pred, by dps then cost. Returns { idx, R } or null.
  Bot.prototype.bestInHand = function (me, pred) {
    var self = this, best = null;
    me.hand.forEach(function (cid, idx) {
      var R = self.R(cid);
      if (!R || !pred(R)) return;
      if (!best || R.dps > best.R.dps || (R.dps === best.R.dps && R.cost < best.R.cost)) best = { idx: idx, R: R };
    });
    return best;
  };

  Bot.prototype.offence = function (me, myUnits, eTowers, t) {
    var g = this.game, cfg = this.cfg, oc = cfg.offense, el = cfg.elixir;
    var mult = g.elixirMult || 1;
    var aggMult = mult >= 3 ? el.tripleMult : mult >= 2 ? el.doubleMult : 1;
    var agg = clamp(oc.aggression * aggMult, 0, 1);
    var enemyEl = (g.players[this.enemy] && g.players[this.enemy].elixir) || 0;

    if (this.pushes.length === 0) {
      var spent8 = this.enemySpends.reduce(function (s, x) { return s + x.cost; }, 0);
      var punish = oc.counterPush && spent8 >= 6 && me.elixir >= oc.counterElixir;
      var counter = oc.counterPush && t < this.counterUntil && me.elixir >= oc.counterElixir && me.elixir >= enemyEl;
      counter = counter || punish;
      var roll = agg > 0 && me.elixir >= el.pushThreshold && this.rng() < agg * 0.5;
      if (t >= this.pushCooldownUntil && (counter || roll)) {
        if (counter) this.counterUntil = -1;
        this.newPush(t, eTowers, -1);
      }
    }

    // Split: once the first push has its support out, maybe open the other lane too.
    if (this.pushes.length === 1 && this.pushes[0].supportDone && !this.pushes[0].splitRolled) {
      this.pushes[0].splitRolled = true;
      if (me.elixir >= el.pushThreshold && this.rng() < oc.splitPushChance) {
        this.newPush(t, eTowers, this.pushes[0].lane);
      }
    }

    var opt = null;
    for (var i = 0; i < this.pushes.length && !opt; i++) {
      opt = this.advancePush(this.pushes[i], me, myUnits, eTowers, t);
    }
    this.pushes = this.pushes.filter(function (P) { return !P.done; });
    return opt;
  };

  Bot.prototype.endPush = function (P, t) {
    P.done = true;
    this.pushCooldownUntil = t + this.cfg.offense.pushCooldown;
    return null;
  };

  Bot.prototype.advancePush = function (P, me, myUnits, eTowers, t) {
    var self = this, cfg = this.cfg, oc = cfg.offense, el = cfg.elixir;
    if (t - P.start > oc.pushTimeout) return this.endPush(P, t);
    var L = P.lane, lx = this.lay.princessX[L];
    var pr = eTowers.filter(function (tw) { return tw.towerType === 'princess' && laneOf(tw.x) === L; })[0];
    var pocket = !pr && oc.pocketUsage !== 'never';
    var tankFy = pocket ? POCKET_FY : (oc.tankPlacement === 'bridge' ? BRIDGE_FY : this.lay.princessFy + 2);
    var supportFy = (pocket && oc.pocketUsage === 'always') ? POCKET_FY : tankFy;
    var heavies = myUnits.filter(function (u) { return laneOf(u.x) === L && self.isHeavy(u); });

    if (P.tankPlaced && heavies.length === 0) return this.endPush(P, t);

    // Win condition barrel onto the princess tower.
    if (pr && P.tankPlaced) {
      var barrel = this.bestInHand(me, function (R) { return R.barrel && R.cost <= me.elixir; });
      if (barrel && this.canSpend(me, barrel.R.cost, true)) {
        return { kind: 'spell', hIdx: barrel.idx, x: pr.x, y: pr.y, cost: barrel.R.cost, exactSpot: true, reason: 'barrel lane ' + L };
      }
    }

    if (!P.tankPlaced) {
      if (P.bait && !P.baitDone) {
        var bait = this.bestInHand(me, function (R) {
          return R.troop && !R.tank && !R.winCon && R.cost <= 3 && R.cost <= me.elixir;
        });
        P.baitDone = true;
        if (bait && this.canSpend(me, bait.R.cost, false)) {
          return {
            kind: 'troop', hIdx: bait.idx, cost: bait.R.cost, fx: lx, fy: this.frontFy(),
            reason: 'bait lane ' + L, bait: true,
          };
        }
      }
      var heavy = this.bestInHand(me, function (R) {
        if (R.troop !== true) return false;
        if (!(R.tank || R.winCon)) return false;
        if (R.winCon && !R.tank && me.elixir < cfg.cycle.holdWinConUntil) return false;
        return R.cost <= me.elixir;
      });
      if (heavy) {
        var hfy = (heavy.R.winCon && !heavy.R.tank && !pocket) ? BRIDGE_FY : tankFy;
        P.tankPlaced = true;
        P.tankPlacedAt = t;
        return { kind: 'troop', hIdx: heavy.idx, cost: heavy.R.cost, fx: lx, fy: hfy, tank: true, reason: 'tank lane ' + L };
      }
      // No heavy in hand: lead with the best troop affordable.
      var lead = this.bestInHand(me, function (R) { return R.troop && R.cost <= me.elixir; });
      if (lead && me.elixir >= el.pushThreshold && this.canSpend(me, lead.R.cost, true)) {
        P.tankPlaced = true;
        P.tankPlacedAt = t;
        return { kind: 'troop', hIdx: lead.idx, cost: lead.R.cost, fx: lx, fy: tankFy, tank: true, reason: 'lead lane ' + L };
      }
      return null;
    }

    var tankX = heavies.length ? heavies[0].x : lx;
    var since = t - P.tankPlacedAt;
    if (!P.supportDone && since >= oc.supportDelay) {
      var sup = this.bestInHand(me, function (R) {
        return R.troop && !R.tank && !R.winCon && (R.ranged || R.splash) && R.cost <= me.elixir;
      }) || this.bestInHand(me, function (R) {
        return R.troop && !R.tank && !R.winCon && R.cost <= me.elixir;
      });
      if (sup && this.canSpend(me, sup.R.cost, false)) {
        P.supportDone = true;
        return {
          kind: 'troop', hIdx: sup.idx, cost: sup.R.cost, fx: tankX, fy: supportFy - oc.supportGap,
          reason: 'support lane ' + L, support: true,
        };
      }
    }
    if (P.supportDone && me.elixir >= el.pushThreshold) {
      var filler = this.bestInHand(me, function (R) { return R.troop && !R.winCon && R.cost <= me.elixir; });
      if (filler && this.canSpend(me, filler.R.cost, false)) {
        return { kind: 'troop', hIdx: filler.idx, cost: filler.R.cost, fx: tankX, fy: tankFy, reason: 'filler lane ' + L };
      }
    }
    return null;
  };

  // Cheapest troop when nothing else is planned, to keep the cycle moving.
  // Idle cycling only spends above the push threshold, so the cycle never starves a push.
  Bot.prototype.idlePlay = function (me, t) {
    var cfg = this.cfg;
    if (!cfg.cycle.playCheapestWhenIdle) return null;
    if (this.pushes.length || this.plans.length) return null;
    if (me.elixir < cfg.elixir.pushThreshold) return null;
    var cutoff = t - 10;
    var recent = this.recentPlays.filter(function (p) { return p >= cutoff; }).length;
    if (recent >= cfg.cycle.cardsPer10s) return null;
    var cheapest = null;
    var self = this;
    me.hand.forEach(function (cid, idx) {
      var R = self.R(cid);
      if (!R || !R.troop || R.winCon || R.tank) return;
      if (!cheapest || R.cost < cheapest.R.cost) cheapest = { idx: idx, R: R };
    });
    var pick = cheapest;
    if (!pick || !this.canSpend(me, pick.R.cost, false)) return null;
    var lane = this.cycleLane;
    this.cycleLane = 1 - this.cycleLane;
    return {
      kind: 'troop', hIdx: pick.idx, cost: pick.R.cost, idle: true,
      fx: this.lay.princessX[lane], fy: pick.R.ranged ? this.backFy() : this.frontFy(),
      reason: 'cycle',
    };
  };

  // ---- push planner -------------------------------------------------------
  // Used when plan.enabled is on (normal and hard). One plan at a time. A regular push is a plan of 2 to
  // plan.maxCards cards: a lead (tank, or a win condition, or the best troop when neither fits), then support
  // timed to land just behind it, then extra cards. Damage spells join when an enemy cluster forms near the
  // lead. Three other starts share the same plan object: punish (opponent elixir nearly spent), counter
  // (surviving troops heading out get support at once) and endgame (behind or tied late in the match, which
  // raises the push roll and keeps one lane).

  // Opponent elixir as the bot reads it: the tracked value plus the tier's error.
  Bot.prototype.oppElRead = function () {
    var n = this.cfg.plan.elixirNoise;
    return clamp(this.oppEl + (n > 0 ? this.noiseVal : 0), 0, CR.ELIXIR.max);
  };

  Bot.prototype.boardValue = function (units) {
    var s = 0, self = this;
    units.forEach(function (u) { s += self.unitValue(u); });
    return s;
  };

  // Endgame: the last endgame.window seconds of regulation, and all of overtime, while behind or tied.
  Bot.prototype.endgameState = function (me) {
    var g = this.game;
    var late = g.phase === 'overtime' || (g.phase === 'regulation' && g.timeLeft <= this.cfg.endgame.window);
    var them = g.players[this.enemy];
    return { late: late, active: late && me.crowns <= them.crowns };
  };

  Bot.prototype.enemyPrincessFy = function () { return H - this.lay.princessFy; };

  // Seconds for a unit at speed to get from a frame point to the enemy princess in a lane.
  Bot.prototype.etaTo = function (fx, fy, lane, speed) {
    return dist(fx, fy, this.lay.princessX[lane], this.enemyPrincessFy()) / Math.max(0.1, speed);
  };

  // Drop spot for a lead. In the pocket when the enemy princess in the lane is down. Win conditions that
  // are not tanks use the bridge. Otherwise slow units (at or below plan.tankDropSpeed) drop on the bridge
  // to get the head start, and faster ones drop at the back to arrive with their support.
  Bot.prototype.leadSpot = function (R, lane, pocket) {
    var u = CR.UNITS[R.unitId] || {};
    var speed = u.speed || 1;
    var fy;
    if (pocket) fy = POCKET_FY;
    else if (R.winCon && !R.tank) fy = BRIDGE_FY;
    else fy = speed <= this.cfg.plan.tankDropSpeed ? BRIDGE_FY : this.lay.princessFy + 2;
    return { fx: this.lay.princessX[lane], fy: fy, speed: speed };
  };

  // Cards for a push from hand. Returns [{ role, id, cost }] (lead first), or null if no set fits.
  // Every subset of the troops in hand (at most 16 with 4 cards) with minCards to maxCards members is tried.
  // A set fits when its total cost is within budget and its lead is affordable now. The lead is a tank, or
  // a win condition (always when punishing, else after cycle.holdWinConUntil). With no lead in hand, the set
  // is led by its best member. The set with the most value wins: lead hp, support damage per second.
  // opts: punish, supportOnly (no lead), requireLead, minCards, maxCards.
  Bot.prototype.buildComp = function (me, budget, opts) {
    var self = this, pc = this.cfg.plan;
    opts = opts || {};
    var maxCards = opts.maxCards || pc.maxCards;
    var minCards = opts.minCards || 2;
    var winOk = opts.punish || me.elixir >= this.cfg.cycle.holdWinConUntil;
    var cards = [];
    me.hand.forEach(function (cid, idx) {
      var R = self.R(cid);
      if (R && R.troop) cards.push({ idx: idx, R: R });
    });
    var hp = function (R) { var u = CR.UNITS[R.unitId]; return u ? u.hp : 0; };
    var leadOk = function (R) { return (R.tank || (R.winCon && winOk)) && R.cost <= me.elixir + 1e-9; };
    var leadValue = function (R) { return hp(R) / 400 + (R.winCon ? 1 : 0); };
    var supValue = function (R) { return (R.dps / 60) * (R.ranged || R.splash ? 1.3 : 1); };
    var best = null, n = cards.length;
    for (var mask = 1; mask < (1 << n); mask++) {
      var set = [], cost = 0;
      for (var b = 0; b < n; b++) if (mask & (1 << b)) { set.push(cards[b]); cost += cards[b].R.cost; }
      if (set.length < minCards || set.length > maxCards || cost > budget + 1e-9) continue;
      var lead = null, value = 0;
      if (!opts.supportOnly) {
        set.forEach(function (c) {
          if (leadOk(c.R) && (!lead || leadValue(c.R) > leadValue(lead.R))) lead = c;
        });
        if (!lead && opts.requireLead) continue;
        if (!lead) {
          // No lead in hand: the best affordable member leads.
          set.forEach(function (c) {
            if (c.R.cost <= me.elixir + 1e-9 && (!lead || supValue(c.R) > supValue(lead.R))) lead = c;
          });
          if (!lead) continue;
        }
        value += leadValue(lead.R);
      }
      set.forEach(function (c) { if (c !== lead) value += supValue(c.R); });
      if (!best || value > best.value) best = { value: value, set: set, lead: lead };
    }
    if (!best) return null;
    var out = [];
    var rest = best.set.filter(function (c) { return c !== best.lead; })
      .sort(function (a, c) { return supValue(c.R) - supValue(a.R); });
    if (best.lead) out.push({ role: 'lead', id: best.lead.R.id, cost: best.lead.R.cost, idx: best.lead.idx });
    rest.forEach(function (c, i) {
      out.push({ role: opts.supportOnly || i === 0 ? 'support' : 'extra', id: c.R.id, cost: c.R.cost, idx: c.idx });
    });
    return out;
  };

  Bot.prototype.newPlan = function (kind, lane, comp, t) {
    this.stats.pushesStarted++;
    if (kind === 'punish') this.stats.punishPushes++;
    if (kind === 'counter') this.stats.counterPushes++;
    this.lastPushLane = lane;
    return {
      kind: kind, lane: lane, start: t, cards: comp,
      leadDone: false, leadAt: -1, leadHeavy: false, nextDue: -1, anchorX: 0, anchorFy: 0, done: false,
    };
  };

  // Survivors per lane: own troops in the own half that are moving toward the bridge, valued in elixir.
  Bot.prototype.survivors = function (myUnits) {
    var self = this, pf = this.lay.princessFy;
    var out = [{ value: 0, x: 0, fy: 0, n: 0 }, { value: 0, x: 0, fy: 0, n: 0 }];
    myUnits.forEach(function (u) {
      if (u.kind !== 'troop') return;
      var fy = fyOf(self.team, u.y);
      if (fy < pf - 1 || fy >= RIVER_TOP + 1) return;
      var v = self.prevOwn[u.id];
      if (!v) return;
      var vfy = self.team === 1 ? v.vy : -v.vy;
      if (vfy <= 0.1) return;
      var S = out[laneOf(u.x)];
      S.value += self.unitValue(u); S.x += u.x; S.fy += fy; S.n++;
    });
    out.forEach(function (S) { if (S.n) { S.x /= S.n; S.fy /= S.n; } });
    return out;
  };

  // Starts a plan when none is active. Order: punish, counter, regular.
  Bot.prototype.planStart = function (me, myUnits, eTowers, t, ctx) {
    var pc = this.cfg.plan, oc = this.cfg.offense, el = this.cfg.elixir, eg = ctx.eg;
    var slack = (this.game.elixirMult || 1) >= 2 ? pc.doubleSlack : 0;

    // Punish: the opponent has just spent down. Hit the opposite lane with a win condition now.
    if (ctx.oppEl < pc.punishBelow && this.enemyLastLane >= 0 && this.lastEnemyPlayT > this.lastPunishT) {
      var pcomp = this.buildComp(me, me.elixir + slack, { punish: true, minCards: 2, requireLead: true });
      if (pcomp) {
        this.lastPunishT = t;
        return this.newPlan('punish', 1 - this.enemyLastLane, pcomp, t);
      }
    }

    // Counter: surviving troops are heading out after a cleared attack. Add support behind them now.
    if (oc.counterPush && t < this.counterUntil && me.elixir >= oc.counterElixir && t >= this.plannedCooldownUntil) {
      var sv = this.survivors(myUnits);
      var lane = sv[0].value >= sv[1].value ? 0 : 1;
      if (sv[lane].value >= pc.counterValue) {
        var ccomp = this.buildComp(me, me.elixir + slack, { supportOnly: true, minCards: 1, maxCards: 2 });
        if (ccomp) {
          this.counterUntil = -1;
          var CP = this.newPlan('counter', lane, ccomp, t);
          CP.anchorX = sv[lane].x; CP.anchorFy = sv[lane].fy; CP.leadDone = true; CP.nextDue = t;
          return CP;
        }
      }
    }

    // Regular push. Same roll as the simple offence, boosted in the endgame. Its cards must be affordable now.
    if (t < this.plannedCooldownUntil) return null;
    var mult = this.game.elixirMult || 1;
    var aggMult = mult >= 3 ? el.tripleMult : mult >= 2 ? el.doubleMult : 1;
    var agg = clamp(oc.aggression * aggMult + (eg.active ? this.cfg.endgame.aggression : 0), 0, 1);
    if (!(this.rng() < agg * 0.5)) return null;
    if (!eg.active && ctx.adv < pc.advantageGate) return null;
    // The defence reserve stays back unless the bot is at the cap, the endgame is on, or it is double elixir.
    var reserve = eg.active || me.elixir >= el.maxHold ? 0 : el.defenseReserve;
    var comp = this.buildComp(me, me.elixir + slack - reserve, {});
    if (!comp) return null;
    var lane2 = eg.active ? this.pickLane(eTowers, -1, 'weakest') : this.pickLane(eTowers, -1);
    return this.newPlan('push', lane2, comp, t);
  };

  Bot.prototype.endPlan = function (P, t, ctx) {
    P.done = true;
    this.plannedCooldownUntil = t + (ctx.eg.active ? this.cfg.offense.pushCooldown * 0.5 : this.cfg.offense.pushCooldown);
    return null;
  };

  Bot.prototype.planPlay = function (me, hIdx, cost, fx, fy, P, role) {
    return {
      kind: 'troop', hIdx: hIdx, cost: cost, fx: fx, fy: fy,
      tank: role === 'lead', support: role === 'support', plan: P.kind,
      reason: P.kind + ' ' + role + ' lane ' + P.lane,
    };
  };

  // Best damage spell on the enemy cluster near the anchor. Uses the value check in spellPlay.
  Bot.prototype.planSpell = function (me, anchor, enemies) {
    var self = this, best = null, range = this.cfg.plan.spellRange;
    var near = enemies.filter(function (e) { return dist(e.x, e.y, anchor.x, anchor.y) <= range; });
    if (!near.length) return null;
    me.hand.forEach(function (cid, hIdx) {
      var R = self.R(cid);
      if (!R || !R.spell || R.barrel || !R.damageSpell || R.cost > me.elixir + 1e-9) return;
      var sp = self.spellPlay(R, hIdx, near);
      if (sp && (!best || sp.score > best.score)) {
        sp.reason = 'push spell lane'; sp.plan = 'push';
        best = sp;
      }
    });
    return best;
  };

  // Damage spell on an enemy tower that is out of elixir to answer. Biggest tower damage first.
  Bot.prototype.towerSpell = function (me, tw) {
    var self = this, best = null;
    me.hand.forEach(function (cid, hIdx) {
      var R = self.R(cid);
      if (!R || !R.spell || R.barrel || R.towerDamage <= 0 || R.cost > me.elixir + 1e-9) return;
      if (!best || R.towerDamage > best.dmg) best = { hIdx: hIdx, R: R, dmg: R.towerDamage };
    });
    if (!best) return null;
    return {
      kind: 'spell', hIdx: best.hIdx, x: tw.x, y: tw.y, cost: best.R.cost, exactSpot: true,
      reason: 'endgame tower ' + best.R.id, towerSpell: true,
    };
  };

  // Advances the active plan one step. Returns an option to play, or null.
  Bot.prototype.advancePlan = function (P, me, myUnits, eTowers, enemies, t, ctx) {
    var self = this, cfg = this.cfg, oc = cfg.offense, pc = cfg.plan;
    var L = P.lane;
    var pr = eTowers.filter(function (tw) { return tw.towerType === 'princess' && laneOf(tw.x) === L; })[0];
    var king = eTowers.filter(function (tw) { return tw.towerType === 'king'; })[0];
    var pocket = !pr && oc.pocketUsage !== 'never';
    if (t - P.start > oc.pushTimeout) return this.endPlan(P, t, ctx);
    if (!P.cards.length && P.leadDone) return this.endPlan(P, t, ctx);

    // Lead stage: drop the lead when it is affordable. The lead must still be in hand.
    if (!P.leadDone) {
      var lead = P.cards[0];
      var li = me.hand.indexOf(lead.id);
      if (li < 0) return this.endPlan(P, t, ctx);
      if (me.elixir + 1e-9 < lead.cost) return null;
      var LR = this.R(lead.id);
      var spot = this.leadSpot(LR, L, pocket);
      P.cards.shift();
      P.leadDone = true; P.leadAt = t; P.leadHeavy = LR.tank || LR.winCon;
      P.anchorX = spot.fx; P.anchorFy = spot.fy;
      // Support lands `supportGapTime` behind the lead: it waits for the time gap between their arrivals.
      var sup = P.cards[0];
      if (sup) {
        var su = (CR.UNITS[this.R(sup.id).unitId] || {}).speed || 1;
        var etaLead = this.etaTo(spot.fx, spot.fy, L, spot.speed);
        var etaSup = this.etaTo(spot.fx, spot.fy - oc.supportGap, L, su);
        P.nextDue = t + Math.max(0, etaLead - etaSup + pc.supportGapTime);
      }
      return this.planPlay(me, li, lead.cost, spot.fx, spot.fy, P, 'lead');
    }

    var heavies = myUnits.filter(function (u) { return laneOf(u.x) === L && self.isHeavy(u); });
    // The heavy lead is gone: the push ends, its queued cards stay in hand.
    if (P.leadHeavy && !heavies.length && t - P.leadAt > 0.5) return this.endPlan(P, t, ctx);

    var anchor = heavies.length
      ? { x: heavies[0].x, y: heavies[0].y, fy: fyOf(this.team, heavies[0].y) }
      : { x: P.anchorX, y: realY(this.team, P.anchorFy), fy: P.anchorFy };
    var eg = ctx.eg;

    // Barrel onto the lane princess once the lead is down, as the simple offence does.
    if (pr) {
      var barrel = this.bestInHand(me, function (R) { return R.barrel && R.cost <= me.elixir; });
      if (barrel) {
        return { kind: 'spell', hIdx: barrel.idx, x: pr.x, y: pr.y, cost: barrel.R.cost, exactSpot: true, reason: 'barrel lane ' + L, plan: P.kind };
      }
    }

    // Spell on a cluster forming around the lead (value check inside spellPlay).
    var sp = this.planSpell(me, anchor, enemies);
    if (sp) { sp.plan = P.kind; return sp; }

    // Tower spell on the lane princess (or the king) when the push has arrived at it, or in the endgame or when the
    // opponent is nearly out of elixir.
    var tgt = pr || king;
    if (tgt && (eg.active && ctx.oppEl < cfg.endgame.spellBelow || (pr && dist(anchor.x, anchor.y, pr.x, pr.y) <= pc.towerSpellRange))) {
      var ts = this.towerSpell(me, tgt);
      if (ts) { ts.plan = P.kind; return ts; }
    }

    // Queued cards: each goes out at its due time, behind the lead.
    if (P.cards.length && t >= P.nextDue) {
      var c = P.cards[0];
      var idx = me.hand.indexOf(c.id);
      if (idx < 0) { P.cards.shift(); return null; }
      if (me.elixir + 1e-9 < c.cost) return null;
      P.cards.shift();
      P.nextDue = t + 1.0;
      var fy = anchor.fy - oc.supportGap;
      return this.planPlay(me, idx, c.cost, anchor.x, fy, P, 'support');
    }
    return null;
  };

  // Plan step for the bot. One plan runs at a time; a new one starts when none is active.
  Bot.prototype.planOffence = function (me, myUnits, eTowers, enemies, t, ctx) {
    if (!this.plans.length) {
      var P = this.planStart(me, myUnits, eTowers, t, ctx);
      if (P) this.plans.push(P);
    }
    var opt = null;
    for (var i = 0; i < this.plans.length && !opt; i++) {
      opt = this.advancePlan(this.plans[i], me, myUnits, eTowers, enemies, t, ctx);
    }
    if (opt) opt.endgame = ctx.eg.active;
    this.plans = this.plans.filter(function (Q) { return !Q.done; });
    return opt;
  };

  // Spawn-spot search: the ideal frame point first, then a spiral of nearby points.
  Bot.prototype.spot = function (hIdx, fx, fy) {
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

  // Impact check for a spell: enemy units and towers inside its radius now, measured after flight.
  Bot.prototype.spellCheck = function (R, cardId, x, y) {
    var g = this.game, team = this.team, self = this;
    var r = R.radius || 1.5;
    var victims = [], towers = [];
    g.entities.forEach(function (e) {
      if (e.dead || e.team !== self.enemy) return;
      if (dist(e.x, e.y, x, y) > r + (e.r || 0)) return;
      if (e.kind === 'tower') towers.push({ e: e, hp: e.hp });
      else victims.push({ e: e, hp: e.hp });
    });
    var flight = 0;
    if (R.travelSpeed > 0) {
      var k = this.kingReal();
      flight = dist(k.x, k.y, x, y) / R.travelSpeed;
    }
    return { due: g.time + flight + CHECK_PAD, cardId: cardId, victims: victims, towers: towers };
  };

  Bot.prototype.play = function (opt, t) {
    var g = this.game, team = this.team, me = g.players[team], cfg = this.cfg;
    var cardId = me.hand[opt.hIdx];
    var R = this.R(cardId);
    if (!R) return false;
    var jit = cfg.timing.placementJitter;
    var x, y;
    if (opt.exactSpot) {
      x = clamp(opt.x, 0.2, W - 0.2);
      y = clamp(opt.y, 0.2, H - 0.2);
      if (!g.canDeploy(team, opt.hIdx, x, y)) return false;
    } else if (opt.kind === 'troop') {
      var fx0 = opt.fx + (this.rng() * 2 - 1) * jit;
      var fy0 = opt.fy + (this.rng() * 2 - 1) * jit;
      // Sloppy play: an occasional drop lands a few tiles off the planned spot.
      if (cfg.timing.misplaceChance > 0 && this.rng() < cfg.timing.misplaceChance) {
        fx0 += (this.rng() * 2 - 1) * 3.5;
        fy0 += (this.rng() * 2 - 1) * 3.5;
      }
      var s = this.spot(opt.hIdx, fx0, fy0);
      if (!s) return false;
      x = s.x;
      y = s.y;
    } else {
      x = clamp(opt.x + (this.rng() * 2 - 1) * jit * 0.5, 0.2, W - 0.2);
      y = clamp(opt.y + (this.rng() * 2 - 1) * jit * 0.5, 0.2, H - 0.2);
      if (!g.canDeploy(team, opt.hIdx, x, y)) return false;
    }
    var pending = null;
    if (R.spell && !R.barrel) pending = this.spellCheck(R, cardId, x, y);
    var cost = R.cost;
    if (!g.deploy(team, opt.hIdx, x, y)) return false;

    var st = this.stats;
    st.cardsPlayed++;
    st.elixirSpent += cost;
    var reason = opt.reason || '';
    if (R.spell) {
      st.spellsCast++;
      st.spellValueEst += opt.value || 0;
      if (pending) this.pending.push(pending);
    }
    if (opt.reason && /^defend|^kite/.test(opt.reason)) st.defenses++;
    if (opt.kite) st.kitePlays++;
    if (opt.bait) st.baitPlays++;
    if (opt.support) st.supportPlays++;
    if (opt.forced) st.forcedPlays++;
    if (opt.idle) st.idlePlays++;
    if (opt.random) st.randomPlays++;
    if (opt.plan) {
      st.planPlays++;
      if (R.spell) st.planSpells++;
    }
    if (opt.endgame) st.endgamePlays++;
    if (opt.towerSpell) st.endgameTowerSpells++;

    this.nextPlayT = t + this.rand(cfg.timing.actionCooldown * 0.85, cfg.timing.actionCooldown * 1.15);
    this.recentPlays.push(t);
    var cutoff = t - 10;
    while (this.recentPlays.length && this.recentPlays[0] < cutoff) this.recentPlays.shift();

    if (cfg.general.trace) {
      this.trace.push({
        t: Math.round(t * 100) / 100, card: cardId, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100,
        cost: cost, reason: reason || (R.spell ? 'spell' : 'troop'), elixir: Math.round(me.elixir * 100) / 100,
      });
    }
    return true;
  };

  CR.Bot = Bot;
  Bot.buildRoles = buildRoles;
})();

if (typeof module !== 'undefined') module.exports = CR;
