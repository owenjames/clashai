// Computer opponent (CR.AI). A thin adapter over CR.Bot (js/bot.js): it picks a preset that fits the
// deck's archetype, then applies the difficulty overlay below. The bot reads only the public engine
// API (game.canDeploy, game.deploy), plays by the same elixir rules as the player, and uses a seeded
// RNG, so matches replay identically.
//
// Usage (unchanged): new CR.AI(game, team, { difficulty: 'easy' | 'normal' | 'hard', seed }) and
// ai.update(dt) every simulation step.
var CR = (globalThis.CR = globalThis.CR || {});

(function () {
  'use strict';

  if (typeof require === 'function') {
    if (!CR.CARDS) require('./cards.js');
    if (!CR.Game) require('./engine.js');
    if (!CR.botConfig) require('./botconfig.js');
    if (!CR.Bot) require('./bot.js');
  }

  // Difficulty overlays, as dotted bot parameters. Each tier changes what decides games: how fast it
  // answers, how much elixir it lets go to waste, how sharp its counters are, and how it spends spells.
  //   easy:   slow to answer, sloppy drops, second-best counters often, leaks elixir, no counter-pushes.
  //   normal: a human-like delay, some leak, occasional second-best counter.
  //   hard:   quick, precise answers; never leaks; counter-pushes when a threat is cleared.
  var DIFFICULTY = {
    easy: {
      'timing.reactionMin': 2, 'timing.reactionMax': 3, 'timing.placementJitter': 1.2,
      'timing.actionCooldown': 2.4,
      'elixir.pushThreshold': 8, 'elixir.maxHold': 10, 'elixir.leakTolerance': 3,
      'defense.pickNoise': 0.5, 'defense.overcommit': 0.5, 'defense.threatThreshold': 1.5,
      'spells.minValueRatio': 1.8,
      'offense.aggression': 0.15, 'offense.counterPush': false, 'offense.splitPushChance': 0,
      'offense.tankPlacement': 'bridge', 'offense.laneMode': 'weakest',
      'cycle.playCheapestWhenIdle': false,
    },
    normal: {
      'timing.reactionMin': 1.2, 'timing.reactionMax': 2, 'timing.placementJitter': 0.9,
      'timing.actionCooldown': 1.2,
      'elixir.pushThreshold': 8, 'elixir.maxHold': 10, 'elixir.leakTolerance': 2,
      'defense.pickNoise': 0.35, 'defense.overcommit': 0.7, 'defense.threatThreshold': 1.5,
      'offense.aggression': 0.6, 'offense.counterPush': true,
      'offense.tankPlacement': 'bridge', 'offense.laneMode': 'weakest',
    },
    hard: {
      'timing.reactionMin': 0.25, 'timing.reactionMax': 0.5, 'timing.placementJitter': 0.15,
      'timing.actionCooldown': 0.9,
      'elixir.pushThreshold': 8, 'elixir.maxHold': 9.5, 'elixir.leakTolerance': 0,
      'elixir.defenseReserve': 1,
      'defense.pickNoise': 0, 'defense.overcommit': 1, 'defense.threatThreshold': 1,
      'offense.pushCooldown': 1.5, 'offense.supportDelay': 0.75,
      'offense.aggression': 0.7, 'offense.counterPush': true,
      'offense.tankPlacement': 'bridge', 'offense.laneMode': 'weakest',
    },
  };

  // Deck archetype from the card roles. Order matters: the most specific signature wins.
  function archetypeOf(deck) {
    var ids = deck || [];
    var has = function (id) { return ids.indexOf(id) >= 0; };
    var cards = ids.map(function (id) { return CR.CARDS[id]; }).filter(Boolean);
    var buildings = cards.filter(function (c) { return c.type === 'building'; }).length;
    var tanks = cards.filter(function (c) {
      var u = c.unit && CR.UNITS[c.unit];
      return u && u.kind === 'troop' && u.hp >= 2500;
    }).length;
    if (cards.some(function (c) { return !!c.spawnUnit; })) return 'bait';          // Goblin Barrel
    if (has('hogrider')) return 'cycle';                                             // Hog Rider cycle
    if (buildings >= 2) return 'turtle';                                             // defensive buildings
    if (tanks > 0 && !has('pekka')) return 'beatdown';                               // big tank pushes
    if (has('pekka')) return 'control';
    if (cards.filter(function (c) { return c.cost <= 3 && c.type === 'troop'; }).length >= 4) return 'bridgespam';
    return 'control';
  }

  function AI(game, team, opts) {
    opts = opts || {};
    this.game = game;
    this.team = team;
    this.difficulty = DIFFICULTY[opts.difficulty] ? opts.difficulty : 'normal';
    var deck = (game.players && game.players[team] && game.players[team].deck) || CR.DEFAULT_DECK;
    this.archetype = archetypeOf(deck);
    var cfg = CR.botConfig(this.archetype);
    var over = DIFFICULTY[this.difficulty];
    Object.keys(over).forEach(function (k) { CR.botSet(cfg, k, over[k]); });
    cfg.general.seed = ((opts.seed | 0) ^ Math.imul(team + 1, 0x9e3779b1)) >>> 0;
    this.config = cfg;
    this.bot = new CR.Bot(game, team, cfg);
  }

  AI.archetypeOf = archetypeOf;
  AI.DIFFICULTY = DIFFICULTY;
  AI.roles = CR.Bot.buildRoles(CR.botConfig('control').offense.tankHp).roles;

  AI.prototype.update = function (dt) {
    this.bot.update(dt);
  };

  CR.AI = AI;
})();

if (typeof module !== 'undefined') module.exports = CR;
