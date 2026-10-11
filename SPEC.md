# ClashAI spec

A single-player Clash Royale clone that runs as an installable iPhone web app (PWA).
Plain JavaScript, no build tools, no dependencies, no ES modules. Every file starts with

```js
var CR = (globalThis.CR = globalThis.CR || {});
```

and attaches its exports to `CR`. Files must also load in Node (`require('./js/cards.js')` etc.)
without touching `window`/`document` at load time, except `render.js`, `ui.js`, `main.js`, which
are browser-only.

Script load order in `index.html`: `cards.js, engine.js, ai.js, render.js, audio.js, ui.js, main.js`.

## Files and owners

| File | Contents |
| --- | --- |
| `js/cards.js` | DONE. `CR.ARENA`, `CR.TOWERS`, `CR.ELIXIR`, `CR.MATCH`, `CR.UNITS`, `CR.CARDS`, `CR.DEFAULT_DECK`, `CR.AI_DECKS`, `CR.TEAM_COLORS`. Read it first. |
| `js/engine.js` | Deterministic battle simulation: `CR.Game`. |
| `js/ai.js` | Opponent bot: `CR.AI`. |
| `js/render.js` | Canvas renderer + layout + hit testing: `CR.Renderer`. |
| `js/audio.js`, `js/ui.js`, `js/main.js`, `index.html`, `manifest.webmanifest`, `sw.js`, `tools/build.js` | App shell, menus, input, game loop, PWA. |

## Coordinates

Tiles. Arena is 18 wide (x in [0,18]) by 32 tall (y in [0,32]). y grows downward on screen.
Team 0 = the human, bottom half (y > 17). Team 1 = the AI, top half (y < 15).
River is y in [15,17]. Two bridges, centred at x = 3.5 and x = 14.5, each 3 tiles wide.
Team 1's towers mirror team 0's with `y' = 32 - y`. Lane 0 = left (x < 9), lane 1 = right.

## Engine: `CR.Game`

```js
const game = new CR.Game({ decks: [deck0, deck1], seed: 12345 });
game.update(dt);                 // advance simulation; main loop always passes dt = 1/30
game.deploy(team, handIndex, x, y) // -> true if deployed (enough elixir, valid spot); spends elixir, cycles card
game.canDeploy(team, handIndex, x, y) // -> boolean, same checks without side effects
game.isInDeployZone(team, cardId, x, y) // -> boolean. Spells: anywhere in arena. Troops/buildings: own side, not in river, not overlapping a living tower footprint, plus "pocket" (see below)
game.getUnitsOf(team)            // living troops+buildings (not towers) of team
game.getTowers(team)             // living towers of team
```

State the renderer/AI/UI read (plain properties, read-only for them):

```js
game.time            // seconds elapsed
game.timeLeft        // seconds left in the current phase (regulation counts 180 -> 0, overtime 120 -> 0)
game.phase           // 'regulation' | 'overtime' | 'ended'
game.elixirMult      // 1 | 2 | 3
game.players[t]      // { elixir (float 0..10), hand: [cardId x4], next: cardId, crowns: 0..3, deck: [8 ids] }
game.entities        // array of Entity (towers, troops, buildings). Dead ones are removed at end of update.
game.projectiles     // array of Projectile
game.spells          // array of in-flight / lingering spells (fireball flying, poison cloud, log rolling)
game.effects         // array of visual-only effects, engine pushes, engine ages and removes them
game.events          // array of events produced during the LAST update() call (cleared at start of each update). For audio.
game.result          // null, or { winner: 0 | 1 | -1, crowns: [c0, c1], reason: 'crowns'|'king'|'tiebreak'|'draw' }
```

Entity:

```js
{
  id, team, kind: 'tower'|'troop'|'building',
  unitId,            // key into CR.UNITS (troops/buildings), or 'king'/'princess' for towers
  cardId,            // card that produced it (null for towers/spawned units)
  towerType,         // 'king' | 'princess' | null
  lane,              // 0 | 1 | -1 (king)
  x, y, r, air,      // position, radius, flying?
  hp, maxHp,
  deployT,           // seconds of deploy time remaining (1.0 on spawn for troops/buildings; 0 for towers). Inactive while > 0.
  active,            // king tower: false until activated. Everything else true.
  target,            // Entity or null
  attackCooldown,    // seconds until next attack can land
  lastAttackT,       // game.time of most recent attack (renderer flashes/lunges)
  facing,            // radians, direction of travel/attack
  stunT, freezeT, slowT, slowAmount,
  charging,          // Prince charge active
  rampStage,         // Inferno: 0..2
  beamTarget,        // Inferno: entity currently beamed (for drawing)
  dead
}
```

Projectile: `{ x, y, team, kind, target /*Entity|null*/, tx, ty, speed, damage, splash, fromTower, ... }`.
Spell: `{ cardId, team, x, y, kind: 'flying'|'poison'|'log', sx, sy /*start*/, t, ... , radius }`.
Effect: `{ type, x, y, radius, t /*age s*/, dur, team }` where type is one of
`'hit','splash','zap','arrows','fireball','rocket','freeze','poison','death','deploy','towerDown','spawn','elixir'`
(`'elixir'` carries `text: '-4'` shown where a card was played).
Event: `{ type: 'deploy'|'hit'|'towerDown'|'kingActivate'|'spell'|'death'|'gameOver', team, x, y, cardId? }`.

### Mechanics (match Clash Royale as closely as practical)

- **Elixir**: start 5, cap 10, +1 per 2.8 s at 1x. 2x during the last 60 s of regulation and the first 60 s of overtime, 3x for the last 60 s of overtime.
- **Hand**: deck of 8 is shuffled with the seeded RNG. Hand = first 4, `next` = 5th, the rest queue behind. Playing a card puts it at the back of the queue, `next` fills the slot, and the queue front becomes `next`. So a card returns after 4 others are played.
- **Match**: 3:00 regulation. If crowns differ at 0:00, more crowns wins. If tied, overtime 2:00 sudden death: first crown change ends the game. If still tied at 0:00 of overtime: tiebreak, the team whose lowest-HP living tower has less HP loses; exact tie is a draw. Destroying the King Tower gives 3 crowns and ends the game immediately.
- **Towers**: princess and king stats from `CR.TOWERS`. King is inactive (does not shoot) until it takes any damage or one of its own princess towers is destroyed. Towers target the closest enemy (ground or air) in range and keep shooting it until it dies or leaves range. Towers are never pushed.
- **Deploy zone**: own half (team 0: y >= 17, team 1: y <= 15), minus tower footprints (princess 3x3, king 4x4 squares). Pocket: once the enemy's princess tower in lane L is destroyed, you may also deploy in that lane on the enemy side up to 4 tiles past the river (team 0: x on lane L side of 9 and y >= 11; team 1: y <= 21). Spells deploy anywhere inside the arena. Clamp deploy positions to the arena.
- **Spawning**: troops/buildings appear with `deployT = 1.0` (inactive, untargetable is NOT true: they can be hit while deploying). Multi-unit cards are placed in a tight formation around the drop point (2 side by side; 3 in a triangle; 4-5 in a ring of radius ~0.8; 15 skeletons in rings), clamped to valid ground (not river unless on a bridge).
- **Targeting**: a unit's valid targets come from `targets`: `ground` (ground troops, buildings, towers), `both` (also air), `buildings` (buildings + towers only). A unit not yet locked picks the closest valid enemy within `sight` (edge-to-edge), re-evaluated every 0.2 s. If nothing is in sight it walks toward the default target: the nearest enemy tower/building, preferring the princess tower in its own lane (by x) if alive, else the king tower. Once a unit is in range and attacking it is **locked** and keeps the target until the target dies, it is stunned/frozen/knocked back, or the target leaves range + 0.5 (then it re-targets).
- **Attacking**: when the target first comes into range, the first hit lands after `loadTime`; then every `hitSpeed`. Melee damage applies instantly. Ranged units fire a homing projectile (`projectile.speed`), damage applies on arrival (if target died mid-flight, the projectile lands at the last position and splash still applies). `splash` damages all valid enemies within that radius of the impact; `splashAroundSelf` centres it on the attacker. Air units can only be hit by `both` attackers and towers; `ground` attackers ignore air.
- **Movement**: speed in tiles/s. Ground troops cannot enter the river except on a bridge; to cross they path to the nearer bridge (by total path length), walk across, then continue. `jumpsRiver` (Hog Rider) and air units go straight. Troops never walk into tower footprints (treat towers/buildings as immovable circles and slide around them).
- **Collision**: troops are circles. Overlapping troops of the same layer (ground vs ground, air vs air) push apart, split by mass (heavier moves less). Towers and buildings are immovable obstacles for ground troops. Deploying units also collide.
- **Charge** (Prince): after moving `charge.dist` tiles without attacking, stun, or knockback, set `charging = true`, speed becomes `charge.speed`, next hit deals `damage * damageMult` then charge ends.
- **Ramp** (Inferno Tower): while locked on one target, damage per hit is `stages[0]` for `stageTime`, then `stages[1]`, then `stages[2]`. Retarget, stun, or freeze resets to stage 0.
- **Kamikaze** (Ice Spirit): on its first attack it jumps to the target and dies; impact deals splash damage and freezes everything hit for `kamikaze.freeze` s.
- **Spawners**: `spawn` creates `count` units every `interval` s (first after `first` s once deployed) at the spawner's front (toward the enemy).
- **Death**: `deathDamage` explodes after death (radius, hits ground units and buildings and towers, Balloon bomb). `deathSpawn` spawns units at the death position.
- **Buildings**: lose `maxHp / lifetime` hp per second. Buildings pull building-targeting troops (they count as buildings for targeting and for default target selection).
- **Stun** (Zap): stops movement and attacks for `stun` s, resets attack to `loadTime`, resets ramp and charge, breaks lock.
- **Freeze**: like stun but longer; frozen units render tinted blue.
- **Knockback**: ground troops with mass < 15 pushed away from the spell centre by `knockback` tiles (Log pushes toward the log's travel direction). Resets lock and charge.
- **Spells**: travel from the caster's King Tower position to the target at `travelSpeed` (0 = instant). On impact: `damage` to all enemy troops/buildings in `radius`, `towerDamage` to enemy towers in radius. Arrows/Fireball/Zap/Rocket/Freeze hit ground and air; Log hits ground only. Poison: every 1 s for `duration`, `dps` to troops/buildings, `towerDps` to towers, slow units inside by `slow`. Log: starts at the deploy point and rolls `length` tiles toward the enemy (team 0 rolls to smaller y), `width` wide, hits each ground enemy once. Goblin Barrel: on impact spawns `spawnCount` of `spawnUnit` (deployT 1.0) and no damage.
- **Determinism**: use a small seeded RNG (mulberry32) stored on the game, never `Math.random`.

## AI: `CR.AI`

```js
const ai = new CR.AI(game, team /* 1 */, { difficulty: 'easy'|'normal'|'hard' });
ai.update(dt); // called every simulation step after game.update; calls game.deploy(team, handIndex, x, y)
```

Must only use the public engine API above (read state, call `game.deploy`). Plays by the same elixir rules.

## Renderer: `CR.Renderer`

```js
const r = new CR.Renderer(canvas);
r.resize(cssWidth, cssHeight, devicePixelRatio, safeInsets /* {top,bottom,left,right} css px */);
r.draw(game, uiState);
r.screenToTile(px, py)  // canvas css px -> {x, y} in tiles (may be out of arena)
r.tileToScreen(x, y)    // -> {x, y} css px
r.hitTestCard(px, py)   // -> hand index 0..3 or -1
r.isInArena(px, py)
```

Layout (portrait): top bar (enemy crowns, timer, 2x/3x badge), arena 18x32 tiles scaled to fit,
bottom panel (next-card preview at left, 4 hand cards, elixir bar 0..10 with segment number).
`uiState = { selected: handIndex|-1, drag: {x, y} | null /* css px of finger while dragging */, team: 0 }`.

## UI shell

`main.js` owns the loop (requestAnimationFrame, fixed 1/30 s steps, max 5 steps/frame), pointer input
(tap card then tap arena, or drag card onto arena; release over arena deploys), screens
(home, deck builder, battle, result), persistence in localStorage (deck, trophies, wins/losses, difficulty),
and PWA setup.
