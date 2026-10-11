// Player bot configuration: every tunable parameter, its UI schema, and named presets.
// Read by js/bot.js (CR.Bot) and tools/botlab.js. Pure data plus small helpers, Node and browser safe.
//
// Parameters are nested groups: CR.BOT_DEFAULTS.offense.aggression is addressed as 'offense.aggression'
// in the schema, the CLI (--set, --param) and preset overrides.
var CR = (globalThis.CR = globalThis.CR || {});

(function () {
  'use strict';

  // Defaults. Plain data: a UI can clone it, override it, and render it with CR.BOT_SCHEMA.
  CR.BOT_DEFAULTS = {
    general: {
      seed: 1,            // RNG seed. Same seed and config replay the same match.
      randomPlay: false,  // baseline: ignore tactics, play a random affordable card at a random legal spot
      trace: false,       // record every play with its reason in bot.trace (used by the review log)
    },
    timing: {
      thinkInterval: 0.25,  // seconds between decisions
      reactionMin: 0.4,     // seconds before answering a new threat, lower bound
      reactionMax: 0.8,     // seconds before answering a new threat, upper bound
      actionCooldown: 1.0,  // seconds between two plays (jittered +/-15 percent)
      placementJitter: 0.4, // random offset in tiles added to every drop
    },
    elixir: {
      pushThreshold: 8,     // elixir needed before starting a push
      maxHold: 9.5,         // at this elixir the bot must play (forced play, stops leaks)
      leakTolerance: 0,     // seconds at maxHold before the forced play fires
      defenseReserve: 2,    // elixir kept back for defence when spending on filler and support
      doubleMult: 1,        // aggression multiplier during 2x elixir
      tripleMult: 1,        // aggression multiplier during 3x elixir
    },
    offense: {
      aggression: 0.6,          // 0 never pushes on its own, 1 pushes as soon as elixir allows
      laneMode: 'weakest',      // weakest | sameLast | opposite | random (lane for the next push)
      tankPlacement: 'back',    // back: near own princess tower, bridge: at the river
      supportDelay: 1.5,        // seconds after the tank before support is played
      supportGap: 2,            // tiles behind the tank where support lands
      splitPushChance: 0.1,     // chance to open a second push in the other lane once the first has support
      pocketUsage: 'always',    // always | tankOnly | never: place in the pocket once the lane princess is down
      baitChance: 0,            // chance to send a cheap bait card ahead of each push
      counterPush: true,        // push right after an enemy threat is cleared without tower loss
      counterWindow: 8,         // seconds the counter-push window stays open
      counterElixir: 5,         // elixir needed for a counter push
      pushTimeout: 45,          // seconds before a push is abandoned
      pushCooldown: 3,          // seconds between pushes
      tankHp: 2500,             // troop hp at which it counts as a tank
    },
    defense: {
      threatLine: 21,          // enemies below this line (own frame) are threats
      threatThreshold: 0.5,    // threat value (elixir-equivalent) needed before responding
      defenceCredit: 0.8,      // how much existing defence in the lane reduces the threat value
      swarmHp: 400,            // troops at or below this hp count toward a swarm
      frontDistance: 3,        // tiles in front of the princess tower for melee defence
      backDistance: 2,         // tiles behind the princess tower for ranged defence
      buildingDepth: 1,        // tiles in front of the princess line for building pulls
      weightDps: 1,            // counter score weight: damage per second
      weightSplash: 1,         // counter score weight: splash vs swarms
      weightBuilding: 1,       // counter score weight: building pulls vs win conditions
      weightSwarm: 1,          // counter score weight: multi-unit cards vs swarms
      costBias: 0.1,           // score penalty per elixir spent on a counter
      overkillPenalty: 0.25,   // score penalty per elixir above what the threat needs
      overcommit: 1,           // max elixir for one answer = threat value * overcommit + 2
      pickNoise: 0,            // chance to pick the second-best answer instead of the best
      kiteBuildings: true,     // kite tanks with buildings as well as troops
      kiteMaxCost: 3,          // most elixir a kite drop may cost
      kiteOffset: 1,           // tiles in front of the melee defence spot where a kite lands
    },
    spells: {
      towerFinish: true,       // cast a damage spell on a princess tower it can finish
      minValueRatio: 1,        // spell value must reach cost * ratio before it is cast
      predictLead: 0.7,        // fraction of the spell flight time used to lead moving enemies
      swarmOnlyZapLog: false,  // only cast Zap and Log when they hit 3 or more units
      keyUnitBonus: 1,         // value bonus for key ranged units and inferno towers hit
    },
    cycle: {
      playCheapestWhenIdle: true, // play the cheapest troop when nothing else is planned
      cardsPer10s: 4,             // target cards per 10 seconds for idle cycling
      holdWinConUntil: 6,         // do not play a win condition below this elixir
    },
    deck: {
      cards: null,             // 8 card ids; null uses CR.DEFAULT_DECK
    },
  };

  // Schema for UI rendering. Keys are dotted paths into CR.BOT_DEFAULTS.
  // type: number | int | bool | enum | deck. Enums list their values in options.
  var S = function (key, group, label, type, min, max, step, def, description, options) {
    var e = { key: key, group: group, label: label, type: type, description: description, default: def };
    if (type === 'number' || type === 'int') { e.min = min; e.max = max; e.step = step; }
    if (type === 'enum') e.options = options;
    return e;
  };
  CR.BOT_SCHEMA = [
    S('general.seed', 'General', 'Seed', 'int', 0, 99999, 1, 1, 'RNG seed for this bot'),
    S('general.randomPlay', 'General', 'Random play', 'bool', 0, 1, 1, false, 'Baseline: random cards at random spots'),
    S('general.trace', 'General', 'Record decisions', 'bool', 0, 1, 1, false, 'Keep a log of each play and why'),

    S('timing.thinkInterval', 'Timing', 'Think interval', 'number', 0.1, 0.5, 0.05, 0.25, 'Seconds between decisions'),
    S('timing.reactionMin', 'Timing', 'Reaction min', 'number', 0.1, 2.0, 0.05, 0.4, 'Shortest delay before answering a threat'),
    S('timing.reactionMax', 'Timing', 'Reaction max', 'number', 0.1, 2.5, 0.05, 0.8, 'Longest delay before answering a threat'),
    S('timing.actionCooldown', 'Timing', 'Action cooldown', 'number', 0.2, 3.0, 0.05, 1.0, 'Seconds between plays'),
    S('timing.placementJitter', 'Timing', 'Placement jitter', 'number', 0, 1.5, 0.05, 0.4, 'Random tile offset on each drop'),

    S('elixir.pushThreshold', 'Elixir', 'Push threshold', 'number', 4, 10, 0.5, 8, 'Elixir needed to start a push'),
    S('elixir.maxHold', 'Elixir', 'Max hold', 'number', 8, 10, 0.1, 9.5, 'Elixir at which a forced play fires'),
    S('elixir.leakTolerance', 'Elixir', 'Leak tolerance', 'number', 0, 3, 0.25, 0, 'Seconds at max hold before the forced play'),
    S('elixir.defenseReserve', 'Elixir', 'Defence reserve', 'number', 0, 6, 0.5, 2, 'Elixir kept back for defence on filler and support'),
    S('elixir.doubleMult', 'Elixir', '2x aggression mult', 'number', 0.25, 2, 0.05, 1, 'Aggression multiplier during double elixir'),
    S('elixir.tripleMult', 'Elixir', '3x aggression mult', 'number', 0.25, 2, 0.05, 1, 'Aggression multiplier during triple elixir'),

    S('offense.aggression', 'Offense', 'Aggression', 'number', 0, 1, 0.05, 0.6, 'How soon a push starts once elixir allows'),
    S('offense.laneMode', 'Offense', 'Lane choice', 'enum', null, null, null, 'weakest', 'Which lane the next push takes', ['weakest', 'sameLast', 'opposite', 'random']),
    S('offense.tankPlacement', 'Offense', 'Tank placement', 'enum', null, null, null, 'back', 'Tank drop spot: back or at the bridge', ['back', 'bridge']),
    S('offense.supportDelay', 'Offense', 'Support delay', 'number', 0, 5, 0.25, 1.5, 'Seconds after the tank before support'),
    S('offense.supportGap', 'Offense', 'Support gap', 'number', 0, 5, 0.25, 2, 'Tiles behind the tank for support'),
    S('offense.splitPushChance', 'Offense', 'Split push chance', 'number', 0, 1, 0.05, 0.1, 'Chance to open a second lane push'),
    S('offense.pocketUsage', 'Offense', 'Pocket usage', 'enum', null, null, null, 'always', 'Use the pocket once a princess is down', ['always', 'tankOnly', 'never']),
    S('offense.baitChance', 'Offense', 'Bait chance', 'number', 0, 1, 0.05, 0, 'Chance to bait with a cheap card before a push'),
    S('offense.counterPush', 'Offense', 'Counter push', 'bool', 0, 1, 1, true, 'Push right after a threat is cleared'),
    S('offense.counterWindow', 'Offense', 'Counter window', 'int', 0, 20, 1, 8, 'Seconds the counter-push window stays open'),
    S('offense.counterElixir', 'Offense', 'Counter elixir', 'number', 3, 10, 0.5, 5, 'Elixir needed for a counter push'),
    S('offense.pushTimeout', 'Offense', 'Push timeout', 'number', 20, 60, 1, 45, 'Seconds before a push is abandoned'),
    S('offense.pushCooldown', 'Offense', 'Push cooldown', 'number', 0, 10, 0.5, 3, 'Seconds between pushes'),
    S('offense.tankHp', 'Offense', 'Tank hp', 'number', 1000, 5000, 100, 2500, 'Troop hp that counts as a tank'),

    S('defense.threatLine', 'Defence', 'Threat line', 'number', 16, 28, 0.5, 21, 'Enemies below this line are threats'),
    S('defense.threatThreshold', 'Defence', 'Threat threshold', 'number', 0, 5, 0.1, 0.5, 'Threat value needed before responding'),
    S('defense.defenceCredit', 'Defence', 'Defence credit', 'number', 0, 1.5, 0.05, 0.8, 'Credit for defence already in the lane'),
    S('defense.swarmHp', 'Defence', 'Swarm hp', 'number', 100, 1000, 50, 400, 'Troops at or below this hp count as swarm'),
    S('defense.frontDistance', 'Defence', 'Front distance', 'number', 1, 8, 0.25, 3, 'Melee defence tiles in front of the princess'),
    S('defense.backDistance', 'Defence', 'Back distance', 'number', 0, 5, 0.25, 2, 'Ranged defence tiles behind the princess'),
    S('defense.buildingDepth', 'Defence', 'Building depth', 'number', 0, 5, 0.25, 1, 'Building pull tiles in front of the princess'),
    S('defense.weightDps', 'Defence', 'Weight: dps', 'number', 0, 3, 0.1, 1, 'Counter preference for damage per second'),
    S('defense.weightSplash', 'Defence', 'Weight: splash', 'number', 0, 3, 0.1, 1, 'Counter preference for splash vs swarms'),
    S('defense.weightBuilding', 'Defence', 'Weight: building', 'number', 0, 3, 0.1, 1, 'Counter preference for building pulls'),
    S('defense.weightSwarm', 'Defence', 'Weight: swarm', 'number', 0, 3, 0.1, 1, 'Counter preference for multi-unit cards'),
    S('defense.costBias', 'Defence', 'Cost bias', 'number', 0, 0.5, 0.01, 0.1, 'Score penalty per elixir spent'),
    S('defense.overkillPenalty', 'Defence', 'Overkill penalty', 'number', 0, 1, 0.05, 0.25, 'Penalty for cards costing above the threat'),
    S('defense.overcommit', 'Defence', 'Overcommit', 'number', 0, 3, 0.1, 1, 'Max elixir per answer = threat x this + 2'),
    S('defense.pickNoise', 'Defence', 'Pick noise', 'number', 0, 0.5, 0.01, 0, 'Chance to pick the second-best answer'),
    S('defense.kiteBuildings', 'Defence', 'Kite with buildings', 'bool', 0, 1, 1, true, 'Allow buildings as kite drops'),
    S('defense.kiteMaxCost', 'Defence', 'Kite max cost', 'int', 1, 6, 1, 3, 'Most elixir a kite drop may cost'),
    S('defense.kiteOffset', 'Defence', 'Kite offset', 'number', 0, 4, 0.25, 1, 'Tiles in front of the melee spot for kites'),

    S('spells.towerFinish', 'Spells', 'Tower finish', 'bool', 0, 1, 1, true, 'Spell a princess tower it can finish'),
    S('spells.minValueRatio', 'Spells', 'Min value ratio', 'number', 0.5, 2, 0.05, 1, 'Spell value / cost needed to cast'),
    S('spells.predictLead', 'Spells', 'Predict lead', 'number', 0, 1.5, 0.05, 0.7, 'Lead moving enemies by this share of flight time'),
    S('spells.swarmOnlyZapLog', 'Spells', 'Zap and Log on swarms only', 'bool', 0, 1, 1, false, 'Skip Zap and Log unless 3+ units hit'),
    S('spells.keyUnitBonus', 'Spells', 'Key unit bonus', 'number', 0, 3, 0.1, 1, 'Value bonus for ranged or inferno units hit'),

    S('cycle.playCheapestWhenIdle', 'Cycle', 'Cycle when idle', 'bool', 0, 1, 1, true, 'Play the cheapest troop when nothing else is planned'),
    S('cycle.cardsPer10s', 'Cycle', 'Cards per 10 s', 'number', 2, 8, 0.5, 4, 'Target cards per 10 s for idle cycling'),
    S('cycle.holdWinConUntil', 'Cycle', 'Hold win con until', 'number', 0, 10, 0.5, 6, 'No win condition below this elixir'),

    S('deck.cards', 'Deck', 'Deck', 'deck', null, null, null, null, '8 card ids, empty uses the default deck'),
  ];

  // Presets: each one is a partial config layered over CR.BOT_DEFAULTS. `deck` may be an array of
  // 8 card ids (shorthand for deck.cards).
  CR.BOT_PRESETS = {
    beatdown: {
      label: 'Beatdown',
      description: 'Big tank pushes from behind, saves elixir for a heavy push, cycles little.',
      deck: ['golem', 'babydragon', 'witch', 'minions', 'zap', 'poison', 'bomber', 'tombstone'],
      elixir: { pushThreshold: 8, defenseReserve: 3, maxHold: 9.8 },
      offense: { aggression: 0.35, laneMode: 'weakest', tankPlacement: 'back', supportDelay: 2, splitPushChance: 0, counterPush: false, pushTimeout: 60, pocketUsage: 'always' },
      defense: { overcommit: 1.5, weightSplash: 1.5, frontDistance: 3.5 },
      cycle: { playCheapestWhenIdle: false, holdWinConUntil: 0 },
      timing: { actionCooldown: 1.2 },
    },
    cycle: {
      label: 'Cycle',
      description: 'Cheap fast cards, keeps the cycle moving, pushes with a Hog win condition.',
      deck: ['hogrider', 'icespirit', 'skeletons', 'goblins', 'zap', 'fireball', 'knight', 'bats'],
      elixir: { pushThreshold: 5, defenseReserve: 1, maxHold: 9.5 },
      offense: { aggression: 0.9, laneMode: 'sameLast', tankPlacement: 'bridge', supportDelay: 0.5, counterPush: true, splitPushChance: 0 },
      defense: { overcommit: 1.2, weightDps: 1.2 },
      cycle: { playCheapestWhenIdle: true, cardsPer10s: 5, holdWinConUntil: 5 },
      timing: { actionCooldown: 0.8 },
    },
    control: {
      label: 'Control',
      description: 'Defends at the right distance, counter-pushes when the attack is cleared, values spells.',
      deck: ['pekka', 'musketeer', 'wizard', 'skeletons', 'zap', 'freeze', 'archers', 'icespirit'],
      elixir: { pushThreshold: 8, defenseReserve: 3, maxHold: 9.5 },
      offense: { aggression: 0.4, laneMode: 'opposite', tankPlacement: 'back', pocketUsage: 'tankOnly', counterPush: true, splitPushChance: 0 },
      defense: { overcommit: 1.5, threatThreshold: 0.4, weightSplash: 1.5, kiteBuildings: false, frontDistance: 3.5, costBias: 0.15 },
      spells: { minValueRatio: 1, towerFinish: true },
      cycle: { playCheapestWhenIdle: false },
    },
    bait: {
      label: 'Bait',
      description: 'Sends a cheap bait card ahead of each push to draw out spells, then the barrel and swarm.',
      deck: ['goblinbarrel', 'knight', 'archers', 'goblins', 'skeletons', 'zap', 'arrows', 'prince'],
      elixir: { pushThreshold: 7, leakTolerance: 0.5, defenseReserve: 2 },
      offense: { aggression: 0.7, baitChance: 0.8, laneMode: 'weakest', tankPlacement: 'bridge', supportDelay: 1, splitPushChance: 0.05 },
      spells: { minValueRatio: 1.4 },
      cycle: { holdWinConUntil: 5 },
    },
    bridgespam: {
      label: 'Bridge spam',
      description: 'Constant cheap pressure at the bridge in random lanes, splits pushes often.',
      deck: ['knight', 'bats', 'minions', 'speargoblins', 'zap', 'skeletons', 'valkyrie', 'bomber'],
      elixir: { pushThreshold: 5, defenseReserve: 0, maxHold: 9.5 },
      offense: { aggression: 1, laneMode: 'random', tankPlacement: 'bridge', supportDelay: 0.5, splitPushChance: 0.35, pushCooldown: 1, counterPush: true },
      defense: { overcommit: 0.8, threatThreshold: 1, kiteBuildings: true },
      timing: { actionCooldown: 0.6, reactionMin: 0.3, reactionMax: 0.6 },
    },
    turtle: {
      label: 'Turtle',
      description: 'Defence with buildings, no own pushes, counter-pushes after a cleared attack, cycles slowly.',
      deck: ['cannon', 'infernotower', 'musketeer', 'wizard', 'skeletons', 'zap', 'arrows', 'tombstone'],
      elixir: { pushThreshold: 9, defenseReserve: 4, maxHold: 9.8 },
      offense: { aggression: 0, counterPush: true, counterWindow: 10, pushTimeout: 30 },
      defense: { threatThreshold: 0.3, overcommit: 2, frontDistance: 3, backDistance: 3, weightBuilding: 1.5, kiteBuildings: true, kiteMaxCost: 4 },
      spells: { minValueRatio: 0.8 },
      cycle: { playCheapestWhenIdle: true, cardsPer10s: 3 },
    },
    random: {
      label: 'Random',
      description: 'Baseline: random cards at random legal spots, same timing as the default bot.',
      general: { randomPlay: true },
    },
  };

  function isPlain(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function clone(v) {
    if (Array.isArray(v)) return v.map(clone);
    if (isPlain(v)) {
      var o = {};
      Object.keys(v).forEach(function (k) { o[k] = clone(v[k]); });
      return o;
    }
    return v;
  }

  // Deep merge: plain objects merge key by key, everything else (arrays, numbers) replaces.
  function merge(base, over) {
    var out = clone(base);
    Object.keys(over || {}).forEach(function (k) {
      if (isPlain(out[k]) && isPlain(over[k])) out[k] = merge(out[k], over[k]);
      else out[k] = clone(over[k]);
    });
    return out;
  }

  function schemaEntry(key) {
    for (var i = 0; i < CR.BOT_SCHEMA.length; i++) if (CR.BOT_SCHEMA[i].key === key) return CR.BOT_SCHEMA[i];
    return null;
  }

  function getPath(obj, key) {
    var parts = key.split('.'), cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (!isPlain(cur)) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function setPath(obj, key, value) {
    var parts = key.split('.'), cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!isPlain(cur[parts[i]])) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    return obj;
  }

  // Coerce a raw value (string from the CLI, or typed) to the parameter's type, clamped to its range.
  // Throws on an unknown key or a value that cannot be read.
  function coerce(key, raw) {
    var e = schemaEntry(key);
    if (!e) throw new Error('Unknown bot parameter: ' + key);
    var v = raw;
    if (e.type === 'bool') {
      if (typeof raw === 'boolean') v = raw;
      else if (/^(true|1|yes|on)$/i.test(String(raw))) v = true;
      else if (/^(false|0|no|off)$/i.test(String(raw))) v = false;
      else throw new Error(key + ' expects true or false, got ' + raw);
    } else if (e.type === 'enum') {
      v = String(raw);
      if (e.options.indexOf(v) < 0) throw new Error(key + ' must be one of ' + e.options.join(', ') + ', got ' + raw);
    } else if (e.type === 'deck') {
      v = Array.isArray(raw) ? raw.slice() : String(raw).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    } else {
      v = typeof raw === 'number' ? raw : Number(raw);
      if (!isFinite(v)) throw new Error(key + ' expects a number, got ' + raw);
      if (e.type === 'int') v = Math.round(v);
      if (v < e.min) v = e.min;
      if (v > e.max) v = e.max;
    }
    return v;
  }

  function normalise(over) {
    if (!isPlain(over)) return {};
    var out = clone(over);
    if (Array.isArray(out.deck)) out.deck = { cards: out.deck };
    delete out.preset;
    delete out.label;
    delete out.description;
    return out;
  }

  // Build a full config. input: a preset name, a config object (may carry `preset`), or undefined.
  // overrides: optional nested object or flat { 'group.key': value } map, applied last.
  CR.botConfig = function (input, overrides) {
    var preset = null, body = {};
    if (typeof input === 'string') {
      preset = CR.BOT_PRESETS[input];
      if (!preset) throw new Error('Unknown bot preset: ' + input + ' (have ' + Object.keys(CR.BOT_PRESETS).join(', ') + ')');
    } else if (isPlain(input) && input.preset) {
      preset = CR.BOT_PRESETS[input.preset];
      if (!preset) throw new Error('Unknown bot preset: ' + input.preset);
    }
    var cfg = clone(CR.BOT_DEFAULTS);
    if (preset) cfg = merge(cfg, normalise(preset));
    if (isPlain(input)) cfg = merge(cfg, normalise(input));
    if (isPlain(overrides)) {
      // Nested groups merge as they are. Dotted keys are coerced and clamped.
      var nested = {};
      Object.keys(overrides).forEach(function (k) {
        if (k.indexOf('.') >= 0) setPath(cfg, k, coerce(k, overrides[k]));
        else nested[k] = overrides[k];
      });
      cfg = merge(cfg, normalise(nested));
    }
    return cfg;
  };

  // Set one dotted parameter on a config object, coercing and clamping. Returns the coerced value.
  CR.botSet = function (cfg, key, raw) {
    var v = coerce(key, raw);
    setPath(cfg, key, v);
    return v;
  };

  CR.botGet = getPath;
  CR.botCoerce = coerce;

  // The 8 card ids a bot plays with.
  CR.botDeck = function (cfg) {
    var d = cfg && cfg.deck && cfg.deck.cards;
    return d && d.length ? d.slice() : CR.DEFAULT_DECK.slice();
  };

  // Problems with a config: unknown deck cards, short decks. Empty array when fine.
  CR.botProblems = function (cfg) {
    var out = [];
    var deck = CR.botDeck(cfg);
    if (deck.length < 5) out.push('deck has ' + deck.length + ' cards, needs at least 5');
    deck.forEach(function (id) { if (!CR.CARDS || !CR.CARDS[id]) out.push('unknown card in deck: ' + id); });
    CR.BOT_SCHEMA.forEach(function (e) {
      if (e.type === 'deck') return;
      var v = getPath(cfg, e.key);
      if (v === undefined) out.push('missing ' + e.key);
      else if (e.type === 'enum' && e.options.indexOf(v) < 0) out.push(e.key + ' not in ' + e.options.join(', '));
      else if (e.type === 'bool' && typeof v !== 'boolean') out.push(e.key + ' should be true or false');
      else if ((e.type === 'number' || e.type === 'int') && (typeof v !== 'number' || v < e.min || v > e.max)) out.push(e.key + ' out of range ' + e.min + '..' + e.max);
    });
    return out;
  };

  CR.botSchemaEntry = schemaEntry;
})();

if (typeof module !== 'undefined') module.exports = CR;
