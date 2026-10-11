// Card and unit data. Stats approximate Clash Royale tournament standard (level 11).
// Distances are in tiles, times in seconds, speeds in tiles/second.
// Speed tiers: slow 0.75, medium 1.0, fast 1.5, very fast 2.0.
var CR = (globalThis.CR = globalThis.CR || {});

CR.ARENA = {
  W: 18,
  H: 32,
  RIVER_TOP: 15, // river occupies y in [15, 17]
  RIVER_BOTTOM: 17,
  BRIDGES: [
    { x: 3.5, halfWidth: 1.5 },
    { x: 14.5, halfWidth: 1.5 },
  ],
};

// Tower layout for team 0 (bottom). Team 1 mirrors with y' = 32 - y.
CR.TOWERS = {
  princess: { hp: 3052, damage: 109, hitSpeed: 0.8, range: 7.5, r: 1.5, size: 3, projectile: { speed: 14, kind: 'arrow' } },
  king: { hp: 4824, damage: 109, hitSpeed: 1.0, range: 7.0, r: 2.0, size: 4, projectile: { speed: 12, kind: 'cannonball' } },
  layout: [
    { type: 'princess', lane: 0, x: 3.5, y: 25.5 },
    { type: 'princess', lane: 1, x: 14.5, y: 25.5 },
    { type: 'king', lane: -1, x: 9, y: 29 },
  ],
};

CR.ELIXIR = {
  start: 5,
  max: 10,
  regen: 2.8, // seconds per elixir at 1x
};

CR.MATCH = {
  regulation: 180,
  doubleAt: 60, // seconds remaining in regulation when 2x starts
  overtime: 120, // sudden death, 2x for first 60s, 3x for last 60s
};

// kind: 'troop' | 'building'
// targets: 'ground' | 'both' | 'buildings'
// range is edge-to-edge (distance between centers minus both radii).
// loadTime: delay before the first hit after locking onto a target (also used after stun reset).
// Optional specials:
//   splash: radius of area damage around the impact point
//   splashAroundSelf: true -> splash centred on the attacker (Valkyrie)
//   projectile: { speed, kind } -> ranged; damage applies on arrival
//   charge: { dist, damageMult, speed } -> after moving dist tiles uninterrupted, next hit deals damageMult and moves at speed
//   jumpsRiver: ground unit that ignores the river (Hog Rider)
//   deathDamage: { damage, radius }
//   deathSpawn: { unit, count }
//   spawn: { unit, count, interval, first } -> periodic spawner (Witch, Tombstone, Goblin Hut)
//   ramp: { stages: [dmgPerHit...], stageTime } -> Inferno: damage per hit increases while locked on
//   kamikaze: { freeze } -> unit dies when it attacks, splash applies freeze seconds (Ice Spirit)
//   lifetime: building decay time; hp drains linearly to 0 over lifetime
CR.UNITS = {
  knight: { name: 'Knight', kind: 'troop', hp: 1766, damage: 202, hitSpeed: 1.2, loadTime: 0.7, range: 0.8, sight: 5.5, speed: 1.0, targets: 'ground', r: 0.5, mass: 6 },
  archer: { name: 'Archer', kind: 'troop', hp: 304, damage: 107, hitSpeed: 0.9, loadTime: 0.4, range: 5, sight: 5.5, speed: 1.0, targets: 'both', r: 0.4, mass: 3, projectile: { speed: 10, kind: 'arrow' } },
  giant: { name: 'Giant', kind: 'troop', hp: 4091, damage: 254, hitSpeed: 1.5, loadTime: 1.0, range: 0.8, sight: 7.5, speed: 0.75, targets: 'buildings', r: 0.75, mass: 18 },
  musketeer: { name: 'Musketeer', kind: 'troop', hp: 720, damage: 217, hitSpeed: 1.0, loadTime: 0.5, range: 6, sight: 6, speed: 1.0, targets: 'both', r: 0.45, mass: 5, projectile: { speed: 12, kind: 'bullet' } },
  minipekka: { name: 'Mini P.E.K.K.A', kind: 'troop', hp: 1361, damage: 720, hitSpeed: 1.6, loadTime: 0.5, range: 0.8, sight: 5.5, speed: 1.5, targets: 'ground', r: 0.5, mass: 4 },
  goblin: { name: 'Goblin', kind: 'troop', hp: 202, damage: 120, hitSpeed: 1.1, loadTime: 0.4, range: 0.5, sight: 5.5, speed: 2.0, targets: 'ground', r: 0.35, mass: 2 },
  speargoblin: { name: 'Spear Goblin', kind: 'troop', hp: 133, damage: 81, hitSpeed: 1.7, loadTime: 0.5, range: 5, sight: 5.5, speed: 2.0, targets: 'both', r: 0.35, mass: 2, projectile: { speed: 10, kind: 'spear' } },
  skeleton: { name: 'Skeleton', kind: 'troop', hp: 81, damage: 81, hitSpeed: 1.0, loadTime: 0.5, range: 0.5, sight: 5.5, speed: 1.5, targets: 'ground', r: 0.3, mass: 1 },
  babydragon: { name: 'Baby Dragon', kind: 'troop', air: true, hp: 1152, damage: 161, hitSpeed: 1.5, loadTime: 0.5, range: 3.5, sight: 5.5, speed: 1.5, targets: 'both', r: 0.6, mass: 5, splash: 1.5, projectile: { speed: 8, kind: 'fire' } },
  hogrider: { name: 'Hog Rider', kind: 'troop', hp: 1696, damage: 318, hitSpeed: 1.6, loadTime: 0.6, range: 0.8, sight: 9.5, speed: 2.0, targets: 'buildings', r: 0.6, mass: 8, jumpsRiver: true },
  valkyrie: { name: 'Valkyrie', kind: 'troop', hp: 1907, damage: 267, hitSpeed: 1.5, loadTime: 0.6, range: 0.8, sight: 5.5, speed: 1.0, targets: 'ground', r: 0.5, mass: 8, splash: 2.0, splashAroundSelf: true },
  wizard: { name: 'Wizard', kind: 'troop', hp: 755, damage: 281, hitSpeed: 1.4, loadTime: 0.6, range: 5.5, sight: 5.5, speed: 1.0, targets: 'both', r: 0.45, mass: 5, splash: 1.5, projectile: { speed: 10, kind: 'fire' } },
  minion: { name: 'Minion', kind: 'troop', air: true, hp: 230, damage: 107, hitSpeed: 1.0, loadTime: 0.5, range: 1.6, sight: 5.5, speed: 1.5, targets: 'both', r: 0.35, mass: 2, projectile: { speed: 12, kind: 'goo' } },
  prince: { name: 'Prince', kind: 'troop', hp: 1920, damage: 392, hitSpeed: 1.4, loadTime: 0.9, range: 1.6, sight: 5.5, speed: 1.0, targets: 'ground', r: 0.6, mass: 15, charge: { dist: 2.5, damageMult: 2, speed: 2.0 } },
  balloon: { name: 'Balloon', kind: 'troop', air: true, hp: 1679, damage: 640, hitSpeed: 2.0, loadTime: 1.0, range: 0.1, sight: 7.7, speed: 1.0, targets: 'buildings', r: 0.6, mass: 9, deathDamage: { damage: 272, radius: 3 } },
  bomber: { name: 'Bomber', kind: 'troop', hp: 304, damage: 225, hitSpeed: 1.8, loadTime: 0.6, range: 4.5, sight: 5.5, speed: 1.0, targets: 'ground', r: 0.4, mass: 3, splash: 1.5, projectile: { speed: 8, kind: 'bomb' } },
  pekka: { name: 'P.E.K.K.A', kind: 'troop', hp: 3760, damage: 816, hitSpeed: 1.8, loadTime: 0.7, range: 0.8, sight: 5, speed: 0.75, targets: 'ground', r: 0.65, mass: 18 },
  icespirit: { name: 'Ice Spirit', kind: 'troop', hp: 230, damage: 110, hitSpeed: 0.3, loadTime: 0.1, range: 2.5, sight: 5.5, speed: 2.0, targets: 'both', r: 0.35, mass: 1, splash: 1.5, kamikaze: { freeze: 1.2 }, projectile: { speed: 8, kind: 'ice' } },
  witch: { name: 'Witch', kind: 'troop', hp: 838, damage: 134, hitSpeed: 1.1, loadTime: 0.5, range: 5.5, sight: 5.5, speed: 1.0, targets: 'both', r: 0.45, mass: 5, splash: 1.0, projectile: { speed: 10, kind: 'magic' }, spawn: { unit: 'skeleton', count: 4, interval: 7, first: 1 } },
  golem: { name: 'Golem', kind: 'troop', hp: 5120, damage: 312, hitSpeed: 2.5, loadTime: 1.0, range: 0.8, sight: 7, speed: 0.75, targets: 'buildings', r: 0.8, mass: 20, deathDamage: { damage: 312, radius: 2 }, deathSpawn: { unit: 'golemite', count: 2 } },
  golemite: { name: 'Golemite', kind: 'troop', hp: 1040, damage: 63, hitSpeed: 2.5, loadTime: 1.0, range: 0.8, sight: 7, speed: 0.75, targets: 'buildings', r: 0.5, mass: 6, deathDamage: { damage: 63, radius: 2 } },
  barbarian: { name: 'Barbarian', kind: 'troop', hp: 670, damage: 192, hitSpeed: 1.4, loadTime: 0.6, range: 0.8, sight: 5.5, speed: 1.0, targets: 'ground', r: 0.45, mass: 5 },
  bat: { name: 'Bat', kind: 'troop', air: true, hp: 81, damage: 81, hitSpeed: 1.3, loadTime: 0.4, range: 1.2, sight: 5.5, speed: 2.0, targets: 'both', r: 0.3, mass: 1 },
  royalgiant: { name: 'Royal Giant', kind: 'troop', hp: 3164, damage: 307, hitSpeed: 1.7, loadTime: 0.8, range: 5, sight: 7.5, speed: 0.75, targets: 'buildings', r: 0.75, mass: 18, projectile: { speed: 14, kind: 'cannonball' } },

  cannon: { name: 'Cannon', kind: 'building', hp: 824, damage: 212, hitSpeed: 0.9, loadTime: 0.4, range: 5.5, sight: 5.5, speed: 0, targets: 'ground', r: 1.0, mass: 0, lifetime: 30, projectile: { speed: 14, kind: 'cannonball' } },
  infernotower: { name: 'Inferno Tower', kind: 'building', hp: 1749, damage: 35, hitSpeed: 0.4, loadTime: 0.4, range: 6, sight: 6, speed: 0, targets: 'both', r: 1.0, mass: 0, lifetime: 30, ramp: { stages: [35, 127, 422], stageTime: 2 } },
  tombstone: { name: 'Tombstone', kind: 'building', hp: 534, damage: 0, hitSpeed: 0, loadTime: 0, range: 0, sight: 0, speed: 0, targets: 'none', r: 0.9, mass: 0, lifetime: 30, spawn: { unit: 'skeleton', count: 2, interval: 3.5, first: 1 }, deathSpawn: { unit: 'skeleton', count: 4 } },
  goblinhut: { name: 'Goblin Hut', kind: 'building', hp: 1100, damage: 0, hitSpeed: 0, loadTime: 0, range: 0, sight: 0, speed: 0, targets: 'none', r: 1.2, mass: 0, lifetime: 29, spawn: { unit: 'speargoblin', count: 1, interval: 4.7, first: 1 } },
};

// type: 'troop' | 'building' | 'spell'
// troop/building cards: unit id + count (formation is the engine's job).
// spell fields:
//   radius, damage, towerDamage (crown towers take reduced spell damage)
//   travelSpeed: flies from the caster's King Tower at this speed (0 = instant)
//   stun: seconds, resets attacks and inferno ramp
//   freeze: seconds, unit fully stops (no move, no attack)
//   knockback: tiles pushed away from the centre (ground, non-building, mass < 15)
//   duration + dps + towerDps + slow: lingering area (Poison)
//   log: { length, width, speed } rolls toward the enemy side, ground only
//   spawnUnit + spawnCount: lands units at the target (Goblin Barrel)
CR.CARDS = {
  knight: { name: 'Knight', cost: 3, type: 'troop', unit: 'knight', count: 1, emoji: '🤺', rarity: 'common' },
  archers: { name: 'Archers', cost: 3, type: 'troop', unit: 'archer', count: 2, emoji: '🏹', rarity: 'common' },
  giant: { name: 'Giant', cost: 5, type: 'troop', unit: 'giant', count: 1, emoji: '🗿', rarity: 'rare' },
  musketeer: { name: 'Musketeer', cost: 4, type: 'troop', unit: 'musketeer', count: 1, emoji: '💂', rarity: 'rare' },
  minipekka: { name: 'Mini P.E.K.K.A', cost: 4, type: 'troop', unit: 'minipekka', count: 1, emoji: '🤖', rarity: 'rare' },
  goblins: { name: 'Goblins', cost: 2, type: 'troop', unit: 'goblin', count: 3, emoji: '👺', rarity: 'common' },
  speargoblins: { name: 'Spear Goblins', cost: 2, type: 'troop', unit: 'speargoblin', count: 3, emoji: '🔱', rarity: 'common' },
  skeletonarmy: { name: 'Skeleton Army', cost: 3, type: 'troop', unit: 'skeleton', count: 15, emoji: '💀', rarity: 'epic' },
  skeletons: { name: 'Skeletons', cost: 1, type: 'troop', unit: 'skeleton', count: 3, emoji: '☠️', rarity: 'common' },
  babydragon: { name: 'Baby Dragon', cost: 4, type: 'troop', unit: 'babydragon', count: 1, emoji: '🐲', rarity: 'epic' },
  hogrider: { name: 'Hog Rider', cost: 4, type: 'troop', unit: 'hogrider', count: 1, emoji: '🐗', rarity: 'rare' },
  valkyrie: { name: 'Valkyrie', cost: 4, type: 'troop', unit: 'valkyrie', count: 1, emoji: '🪓', rarity: 'rare' },
  wizard: { name: 'Wizard', cost: 5, type: 'troop', unit: 'wizard', count: 1, emoji: '🧙', rarity: 'rare' },
  minions: { name: 'Minions', cost: 3, type: 'troop', unit: 'minion', count: 3, emoji: '👿', rarity: 'common' },
  prince: { name: 'Prince', cost: 5, type: 'troop', unit: 'prince', count: 1, emoji: '🏇', rarity: 'epic' },
  balloon: { name: 'Balloon', cost: 5, type: 'troop', unit: 'balloon', count: 1, emoji: '🎈', rarity: 'epic' },
  bomber: { name: 'Bomber', cost: 2, type: 'troop', unit: 'bomber', count: 1, emoji: '💣', rarity: 'common' },
  pekka: { name: 'P.E.K.K.A', cost: 7, type: 'troop', unit: 'pekka', count: 1, emoji: '🦾', rarity: 'epic' },
  icespirit: { name: 'Ice Spirit', cost: 1, type: 'troop', unit: 'icespirit', count: 1, emoji: '❄️', rarity: 'common' },
  witch: { name: 'Witch', cost: 5, type: 'troop', unit: 'witch', count: 1, emoji: '🧙‍♀️', rarity: 'epic' },
  golem: { name: 'Golem', cost: 8, type: 'troop', unit: 'golem', count: 1, emoji: '🪨', rarity: 'epic' },
  barbarians: { name: 'Barbarians', cost: 5, type: 'troop', unit: 'barbarian', count: 5, emoji: '🧔', rarity: 'common' },
  bats: { name: 'Bats', cost: 2, type: 'troop', unit: 'bat', count: 5, emoji: '🦇', rarity: 'common' },
  royalgiant: { name: 'Royal Giant', cost: 6, type: 'troop', unit: 'royalgiant', count: 1, emoji: '🧌', rarity: 'common' },

  cannon: { name: 'Cannon', cost: 3, type: 'building', unit: 'cannon', count: 1, emoji: '🛡️', rarity: 'common' },
  infernotower: { name: 'Inferno Tower', cost: 5, type: 'building', unit: 'infernotower', count: 1, emoji: '🔥', rarity: 'rare' },
  tombstone: { name: 'Tombstone', cost: 3, type: 'building', unit: 'tombstone', count: 1, emoji: '🪦', rarity: 'rare' },
  goblinhut: { name: 'Goblin Hut', cost: 5, type: 'building', unit: 'goblinhut', count: 1, emoji: '🛖', rarity: 'rare' },

  arrows: { name: 'Arrows', cost: 3, type: 'spell', emoji: '🎯', rarity: 'common', radius: 4, damage: 366, towerDamage: 93, travelSpeed: 14 },
  fireball: { name: 'Fireball', cost: 4, type: 'spell', emoji: '☄️', rarity: 'rare', radius: 2.5, damage: 689, towerDamage: 207, travelSpeed: 10, knockback: 1.0 },
  zap: { name: 'Zap', cost: 2, type: 'spell', emoji: '⚡', rarity: 'common', radius: 2.5, damage: 192, towerDamage: 58, travelSpeed: 0, stun: 0.5 },
  rocket: { name: 'Rocket', cost: 6, type: 'spell', emoji: '🚀', rarity: 'rare', radius: 2, damage: 1484, towerDamage: 445, travelSpeed: 6, knockback: 1.5 },
  log: { name: 'The Log', cost: 2, type: 'spell', emoji: '🪵', rarity: 'legendary', damage: 290, towerDamage: 58, knockback: 0.7, log: { length: 11.1, width: 3.9, speed: 4.6 } },
  poison: { name: 'Poison', cost: 4, type: 'spell', emoji: '☠', rarity: 'epic', radius: 3.5, duration: 8, dps: 91, towerDps: 27, slow: 0.15, travelSpeed: 0 },
  freeze: { name: 'Freeze', cost: 4, type: 'spell', emoji: '🧊', rarity: 'epic', radius: 3, damage: 115, towerDamage: 35, freeze: 4, travelSpeed: 0 },
  goblinbarrel: { name: 'Goblin Barrel', cost: 3, type: 'spell', emoji: '🛢️', rarity: 'epic', radius: 1.5, damage: 0, towerDamage: 0, travelSpeed: 6, spawnUnit: 'goblin', spawnCount: 3 },
};

CR.DEFAULT_DECK = ['knight', 'archers', 'giant', 'musketeer', 'minipekka', 'fireball', 'zap', 'babydragon'];

// Decks the AI picks from at random.
CR.AI_DECKS = [
  ['giant', 'musketeer', 'minipekka', 'archers', 'fireball', 'zap', 'knight', 'skeletons'],
  ['hogrider', 'valkyrie', 'musketeer', 'cannon', 'icespirit', 'log', 'fireball', 'skeletons'],
  ['golem', 'babydragon', 'witch', 'minions', 'zap', 'poison', 'bomber', 'tombstone'],
  ['pekka', 'prince', 'wizard', 'bats', 'arrows', 'zap', 'goblins', 'infernotower'],
  ['balloon', 'babydragon', 'minions', 'freeze', 'arrows', 'knight', 'speargoblins', 'icespirit'],
  ['royalgiant', 'barbarians', 'goblinhut', 'archers', 'rocket', 'zap', 'skeletonarmy', 'goblinbarrel'],
];

CR.TEAM_COLORS = [
  { main: '#2f7cf6', dark: '#1a4fa8', light: '#9cc3ff' },
  { main: '#e5413b', dark: '#9c1f1b', light: '#ffaaa6' },
];

if (typeof module !== 'undefined') module.exports = CR;
