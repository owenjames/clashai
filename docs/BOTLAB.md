# Bot lab

A configurable player bot for the Clash Royale clone, a headless test lab that plays it against the
computer opponent (`CR.AI`) and against other bots, and a review tool that writes a gameplay log with
findings. Node built-ins only. No rendering. Simulation steps at dt = 1/30.

## Files

| File | What it is |
| --- | --- |
| `js/botconfig.js` | `CR.BOT_DEFAULTS` (every tunable value), `CR.BOT_SCHEMA` (UI metadata per value), `CR.BOT_PRESETS` (7 named strategies), config helpers. |
| `js/bot.js` | `CR.Bot(game, team, config)`. `update(dt)` plays through `game.canDeploy` and `game.deploy` only. Keeps `bot.stats`. |
| `tools/botlab.js` | The CLI: `match`, `sweep`, `tournament`, `review`, `schema`, `presets`. |
| `docs/reviews/` | Saved outputs of the runs below, and the review logs. |

The bot reads only the public engine API and the card and tower data (`CR.CARDS`, `CR.UNITS`,
`CR.TOWERS`, `CR.ARENA`). Its roles and board layout are rebuilt from that data when it starts, so new
cards are picked up. `js/engine.js` and `js/cards.js` are not changed by the lab. `js/ai.js` is a thin adapter over the bot.

The bot is not wired into the browser app. `index.html` and `main.js` are untouched. It runs in Node only
for now.

## Quick start

```sh
node tools/botlab.js presets
node tools/botlab.js match --bot cycle --vs ai:hard --n 20
node tools/botlab.js match --bot control --vs ai:normal --n 40 --set offense.aggression=0.8
node tools/botlab.js sweep --bot cycle --vs ai:normal --param offense.aggression=0:1:0.25 --param timing.reactionMax=0.3:1.5:0.4 --n 10
node tools/botlab.js tournament --n 10
node tools/botlab.js review --bot control --vs ai:hard --seed 7
node tools/botlab.js schema --md
```

Add `--json` to any command to get machine-readable output on stdout instead of the table.

## CLI reference

### match

Runs `--n` matches between `--bot` and `--vs`. `--bot` may also be `ai:easy|normal|hard` to measure the computer opponent against another competitor. The bot takes team 0 on even match indices and team 1 on
odd ones. Prints one row for the matchup and, for a bot, a table of its average stats per match.

```
node tools/botlab.js match --bot <preset|file.json|ai:level> --vs <ai:easy|ai:normal|ai:hard|bot:<preset>|file.json> [--n 10] [--seed 1] [--set key=value]...
```

Columns:

- W, L, D, and win rate. A draw counts as neither a win nor a loss. The 95 percent interval is a Wilson
  score interval.
- Crowns for and against, per match.
- Tower damage for and against: princess and king hit points removed from the other side's towers.
- Leak s: seconds per match with elixir at 10.
- Cards/min: cards played by the first competitor per minute of match time.
- Avg length: match length, mm:ss.
- OT rate: share of matches that reached overtime.

The AI deck rotates through `CR.AI_DECKS` by match index, so `--n 6` covers each AI deck once. A bot uses
its own deck (`deck.cards`, or the preset's deck), or `CR.DEFAULT_DECK` when none is given.

### sweep

Grid search over one or more parameters. Each point runs `--n` matches against the opponent and reports
the record, the win rate with its interval, the crown difference and the tower-damage difference.

```
node tools/botlab.js sweep --bot <...> --vs <...> --param key=min:max:step [--param key=a,b,c ...] [--n 10] [--top 10]
```

`--param` accepts a range `min:max:step` (inclusive) or a comma list. Repeat it for a grid. Grids larger
than 2000 points are refused. Points are sorted by win rate, then by crown difference.

### tournament

Round-robin of all seven presets and `ai:easy`, `ai:normal`, `ai:hard`, `--n` matches per pair. Points are
3 per win and 1 per draw. Also prints a head-to-head matrix (row against column, W-L-D from the row's side).

```
node tools/botlab.js tournament [--n 10] [--seed 1] [--set key=value]...
```

`--set` applies to every bot in the tournament.

### review

Runs one match and writes `docs/reviews/<name>.md`, where the name defaults to
`<bot>-vs-<opponent>-seed<N>`. Use `--name` to choose another. The file has the result, a per-side summary,
the bot's decisions by reason, the findings, and the gameplay log. `--team 0|1` puts the bot on team 1.

```
node tools/botlab.js review --bot <...> --vs <...> [--seed 1] [--team 0|1] [--name file-name] [--set key=value]...
```

### schema and presets

```
node tools/botlab.js schema [--md | --json]   # parameter table, Markdown for this file, or JSON
node tools/botlab.js presets [--json]         # presets with descriptions and decks
```

### Bot config files and overrides

`--bot` and `--vs` take a preset name, or a path to a JSON file. A file is an object of nested groups with an
optional `preset` key that names the base preset. A `deck` array of 8 card ids is shorthand for
`deck.cards`.

```json
{
  "preset": "cycle",
  "offense": { "aggression": 0.4 },
  "deck": ["hogrider", "icespirit", "skeletons", "goblins", "zap", "fireball", "knight", "bats"]
}
```

`--set key=value` overrides a dotted parameter after the preset and file are applied. Values are checked
against the schema: numbers are clamped to their range, enums must be one of their options, and unknown keys
are refused. The same rules apply to `--param` values in a sweep.

Bot configs are validated before a run (`CR.botProblems`). Unknown card ids, short decks and out-of-range
values stop the command with the list of problems.

## Presets

Each preset is a partial config layered over the defaults. The table below gives the intent and the deck.
The presets are starting points, not tuned champions. Several of them lose to the computer opponent today.
See the findings.

| Preset | Name | Intent | Deck |
| --- | --- | --- | --- |
| `beatdown` | Beatdown | Big tank pushes from behind. Saves elixir for a heavy push and cycles little. | golem, babydragon, witch, minions, zap, poison, bomber, tombstone |
| `cycle` | Cycle | Cheap fast cards that keep the cycle moving. Pushes with a Hog Rider win condition. | hogrider, icespirit, skeletons, goblins, zap, fireball, knight, bats |
| `control` | Control | Defends at the right distance. Counter-pushes when an attack is cleared. Values spells. | pekka, musketeer, wizard, skeletons, zap, freeze, archers, icespirit |
| `bait` | Bait | Sends a cheap bait card ahead of each push, then the barrel and swarm. | goblinbarrel, knight, archers, goblins, skeletons, zap, arrows, prince |
| `bridgespam` | Bridge spam | Constant cheap pressure at the bridge in random lanes. Splits pushes often. | knight, bats, minions, speargoblins, zap, skeletons, valkyrie, bomber |
| `turtle` | Turtle | Defence with buildings, no own pushes, counter-pushes after a cleared attack. | cannon, infernotower, musketeer, wizard, skeletons, zap, arrows, tombstone |
| `random` | Random | Baseline. Random affordable card at a random legal spot, on the same timing. | default deck |

## How the bot decides

Each decision (every `timing.thinkInterval` seconds, and only after `timing.actionCooldown` since the last
play) runs in this order:

1. Tower finish. A damage spell whose tower damage covers the remaining hit points of an enemy princess tower.
2. Defence. Threats in each lane (enemy troops below `defense.threatLine`, in the bot's frame) are valued in elixir. A threat is
   answered after a random reaction delay in `timing.reactionMin` to `timing.reactionMax`. The best counter
   by score is played at the front or back of the lane, or as a building pull. A tank with no counter is
   kited with a cheap card. Damage spells are placed on clusters where the value reaches the cost times
   `spells.minValueRatio`.
3. Forced play. At `elixir.maxHold` elixir, after `elixir.leakTolerance` seconds, the cheapest troop goes out.
4. Offence. A push starts when elixir reaches `elixir.pushThreshold` and a roll with `offense.aggression`
   succeeds, or in the counter-push window after an enemy threat is cleared. A push runs in four steps: an
   optional bait card, the tank (a tank, or a win condition held until `cycle.holdWinConUntil` elixir), support
   after `offense.supportDelay`, then filler. A barrel is aimed at the princess tower once the tank is down.
   The lane follows `offense.laneMode`. A push ends after `offense.pushTimeout` seconds, when its tank dies,
   or on timeout, and then waits `offense.pushCooldown`.
5. Idle cycle. With nothing else planned and elixir at or above the push threshold, the cheapest troop goes
   out whenever fewer than `cycle.cardsPer10s` cards have been played in the last 10 seconds.

A threat only blocks offence while the bot is still reacting to it. A threat it cannot answer does not stop
its own push.

The bot never spends below `elixir.defenseReserve` on filler or support, except at the forced-play cap.
Tanks are exempt.

`bot.stats` records what happened during the match:

| Stat | Meaning |
| --- | --- |
| `cardsPlayed`, `elixirSpent` | Plays made, and the elixir they cost. |
| `leakSeconds` | Seconds with elixir at 9.99 or above. |
| `spellsCast`, `spellValueEst` | Damage spells cast, and the value the bot predicted for them. |
| `spellValueHit`, `spellUnitsHit`, `spellKills`, `spellDamageHit` | Measured at impact: the elixir value of the enemy hp removed, units hit, units killed, hit points removed. Checked after the flight time. Approximate: units can move during flight. |
| `defenses`, `kitePlays` | Answers to threats, and kite drops inside them. |
| `pushesStarted` | Pushes begun. |
| `baitPlays`, `supportPlays`, `forcedPlays`, `idlePlays`, `randomPlays` | Plays by kind. |
| `towerDamage` | Hit points removed from enemy towers, from any source, while the bot runs. |

With `general.trace` on, `bot.trace` holds each play with its time, card, position, cost and reason. The
review log uses it to name the reason for every bot play.

Randomness is a seeded mulberry32 stream, so the same config and seed replay the same match.

## Parameter reference

Generated from `CR.BOT_SCHEMA` by `node tools/botlab.js schema --md`. Keys are dotted paths into
`CR.BOT_DEFAULTS`. The "Range" column is the allowed range for `--set` and `--param`.

<!-- BEGIN SCHEMA -->
### General

| Parameter | Type | Default | Range or options | Meaning |
| --- | --- | --- | --- | --- |
| `general.seed` | int | 1 | 0 to 99999 (step 1) | RNG seed for this bot |
| `general.randomPlay` | bool | off | on / off | Baseline: random cards at random spots |
| `general.trace` | bool | off | on / off | Keep a log of each play and why |

### Timing

| Parameter | Type | Default | Range or options | Meaning |
| --- | --- | --- | --- | --- |
| `timing.thinkInterval` | number | 0.25 | 0.1 to 0.5 (step 0.05) | Seconds between decisions |
| `timing.reactionMin` | number | 0.4 | 0.1 to 2 (step 0.05) | Shortest delay before answering a threat |
| `timing.reactionMax` | number | 0.8 | 0.1 to 2.5 (step 0.05) | Longest delay before answering a threat |
| `timing.actionCooldown` | number | 1 | 0.2 to 3 (step 0.05) | Seconds between plays |
| `timing.placementJitter` | number | 0.4 | 0 to 1.5 (step 0.05) | Random tile offset on each drop |

### Elixir

| Parameter | Type | Default | Range or options | Meaning |
| --- | --- | --- | --- | --- |
| `elixir.pushThreshold` | number | 8 | 4 to 10 (step 0.5) | Elixir needed to start a push |
| `elixir.maxHold` | number | 9.5 | 8 to 10 (step 0.1) | Elixir at which a forced play fires |
| `elixir.leakTolerance` | number | 0 | 0 to 3 (step 0.25) | Seconds at max hold before the forced play |
| `elixir.defenseReserve` | number | 2 | 0 to 6 (step 0.5) | Elixir kept back for defence on filler and support |
| `elixir.doubleMult` | number | 1 | 0.25 to 2 (step 0.05) | Aggression multiplier during double elixir |
| `elixir.tripleMult` | number | 1 | 0.25 to 2 (step 0.05) | Aggression multiplier during triple elixir |

### Offense

| Parameter | Type | Default | Range or options | Meaning |
| --- | --- | --- | --- | --- |
| `offense.aggression` | number | 0.6 | 0 to 1 (step 0.05) | How soon a push starts once elixir allows |
| `offense.laneMode` | enum | weakest | weakest | sameLast | opposite | random | Which lane the next push takes |
| `offense.tankPlacement` | enum | back | back | bridge | Tank drop spot: back or at the bridge |
| `offense.supportDelay` | number | 1.5 | 0 to 5 (step 0.25) | Seconds after the tank before support |
| `offense.supportGap` | number | 2 | 0 to 5 (step 0.25) | Tiles behind the tank for support |
| `offense.splitPushChance` | number | 0.1 | 0 to 1 (step 0.05) | Chance to open a second lane push |
| `offense.pocketUsage` | enum | always | always | tankOnly | never | Use the pocket once a princess is down |
| `offense.baitChance` | number | 0 | 0 to 1 (step 0.05) | Chance to bait with a cheap card before a push |
| `offense.counterPush` | bool | on | on / off | Push right after a threat is cleared |
| `offense.counterWindow` | int | 8 | 0 to 20 (step 1) | Seconds the counter-push window stays open |
| `offense.counterElixir` | number | 5 | 3 to 10 (step 0.5) | Elixir needed for a counter push |
| `offense.pushTimeout` | number | 45 | 20 to 60 (step 1) | Seconds before a push is abandoned |
| `offense.pushCooldown` | number | 3 | 0 to 10 (step 0.5) | Seconds between pushes |
| `offense.tankHp` | number | 2500 | 1000 to 5000 (step 100) | Troop hp that counts as a tank |

### Defence

| Parameter | Type | Default | Range or options | Meaning |
| --- | --- | --- | --- | --- |
| `defense.threatLine` | number | 21 | 16 to 28 (step 0.5) | Enemies below this line are threats |
| `defense.threatThreshold` | number | 0.5 | 0 to 5 (step 0.1) | Threat value needed before responding |
| `defense.defenceCredit` | number | 0.8 | 0 to 1.5 (step 0.05) | Credit for defence already in the lane |
| `defense.swarmHp` | number | 400 | 100 to 1000 (step 50) | Troops at or below this hp count as swarm |
| `defense.frontDistance` | number | 3 | 1 to 8 (step 0.25) | Melee defence tiles in front of the princess |
| `defense.backDistance` | number | 2 | 0 to 5 (step 0.25) | Ranged defence tiles behind the princess |
| `defense.buildingDepth` | number | 1 | 0 to 5 (step 0.25) | Building pull tiles in front of the princess |
| `defense.weightDps` | number | 1 | 0 to 3 (step 0.1) | Counter preference for damage per second |
| `defense.weightSplash` | number | 1 | 0 to 3 (step 0.1) | Counter preference for splash vs swarms |
| `defense.weightBuilding` | number | 1 | 0 to 3 (step 0.1) | Counter preference for building pulls |
| `defense.weightSwarm` | number | 1 | 0 to 3 (step 0.1) | Counter preference for multi-unit cards |
| `defense.costBias` | number | 0.1 | 0 to 0.5 (step 0.01) | Score penalty per elixir spent |
| `defense.overkillPenalty` | number | 0.25 | 0 to 1 (step 0.05) | Penalty for cards costing above the threat |
| `defense.overcommit` | number | 1 | 0 to 3 (step 0.1) | Max elixir per answer = threat x this + 2 |
| `defense.pickNoise` | number | 0 | 0 to 0.5 (step 0.01) | Chance to pick the second-best answer |
| `defense.kiteBuildings` | bool | on | on / off | Allow buildings as kite drops |
| `defense.kiteMaxCost` | int | 3 | 1 to 6 (step 1) | Most elixir a kite drop may cost |
| `defense.kiteOffset` | number | 1 | 0 to 4 (step 0.25) | Tiles in front of the melee spot for kites |

### Spells

| Parameter | Type | Default | Range or options | Meaning |
| --- | --- | --- | --- | --- |
| `spells.towerFinish` | bool | on | on / off | Spell a princess tower it can finish |
| `spells.minValueRatio` | number | 1 | 0.5 to 2 (step 0.05) | Spell value / cost needed to cast |
| `spells.predictLead` | number | 0.7 | 0 to 1.5 (step 0.05) | Lead moving enemies by this share of flight time |
| `spells.swarmOnlyZapLog` | bool | off | on / off | Skip Zap and Log unless 3+ units hit |
| `spells.keyUnitBonus` | number | 1 | 0 to 3 (step 0.1) | Value bonus for ranged or inferno units hit |

### Cycle

| Parameter | Type | Default | Range or options | Meaning |
| --- | --- | --- | --- | --- |
| `cycle.playCheapestWhenIdle` | bool | on | on / off | Play the cheapest troop when nothing else is planned |
| `cycle.cardsPer10s` | number | 4 | 2 to 8 (step 0.5) | Target cards per 10 s for idle cycling |
| `cycle.holdWinConUntil` | number | 6 | 0 to 10 (step 0.5) | No win condition below this elixir |

### Deck

| Parameter | Type | Default | Range or options | Meaning |
| --- | --- | --- | --- | --- |
| `deck.cards` | deck | default deck | 8 card ids | 8 card ids, empty uses the default deck |
<!-- END SCHEMA -->

### Fixed model constants

These are not exposed as parameters. They are board geometry, scoring weights and measurement thresholds
that describe the model rather than a playing style.

- Board: pocket depth (3.5 tiles past the river), the own-side bridge spot (2 tiles behind the river), the
  princess and king positions, which are read from `CR.TOWERS.layout`.
- Scoring: counter-score bonuses (2.5 for splash against swarms, 0.5 for swarm cards, 0.5 for tanks, 2 for
  building pulls, 1.5 for a building against a win condition, 0.5 penalty for a building that is not a pull),
  the 250 dps scale, the 1.3 and 1.5 offsets in the overkill penalty, the 1.5 threshold for a kite, and the
  0.3 value of a freeze. Changing these changes the model, so the sweep does not touch them.
- Spells: a 2 tile radius for the log's cluster, a 3 tile start behind the cluster, and a 0.2 s pad on the
  impact check.
- Measurement: elixir at 9.99 counts as leaking, and a unit's value is its cost-based value scaled by hp.
- Placement: the tank's back spot (2 tiles in front of the princess line), the spiral search for a valid spot
  (8 rings of 12 points), and the random mode's spot range.

## Reviews: what the log and findings mean

A review log has a state line every 5 seconds: phase and elixir multiplier, crowns, elixir of each side, the
hit points of every tower (L, R, K), and the unit count. Plays and key events come between state lines.
Each play shows its position and cost, and for the bot the reason from `bot.trace`.

Findings are grouped by section. Each names the side (BOT, AI, or OPP for a bot opponent):

| Section | Finding | How it is detected |
| --- | --- | --- |
| Elixir | Time at 10 elixir | Stretches at 9.99 or above, totalled. Reported at 1 second or more. |
| Pushes and defence | Tower hit with no defender | Tower hp drops and no own troop or building is within 6 tiles, and no damage spell landed nearby within 0.6 s. Episodes merge within 8 s. |
| Pushes and defence | Troop lost in the enemy half without reaching a tower | A troop dies past the river and never came within its range plus 0.5 of an enemy tower. |
| Spells | Spell that hit nothing | At impact (flight time after the cast), no enemy unit or tower was within radius. Dead units count, since a spell can kill what it hits. Logs and barrels are not checked. |
| Units and tactics | Troop into a tower alone | A troop reaches an enemy tower's range with no friendly troop within 3 tiles. Counted once per troop. |
| Units and tactics | Stall, no target | Speed under 0.25 tiles/s over a 5 s window, with no target for the whole window. Split into: idle (no visible cause), jam (packed against other units), blocked (crawling along a tower footprint). |
| Units and tactics | Stall, target out of range | Speed under 0.25 tiles/s over a 5 s window with a live target out of range. |
| Units and tactics | Overtime | Match reached overtime. |
| Cards | Cards never played | Cards in the 8-card deck that were never played in the match. |
| Engine | River | A ground troop sits in the river outside a bridge for 0.5 s or more. |
| Engine | Projectile with no target | A projectile is first seen with no target and no entity, living or just dead, at its aim point. |
| Engine | Left the arena | A troop is outside the 18 by 32 arena. |

The 0.25 tiles/s stall threshold is the main approximation. A unit that is slowed, not stopped, is
not reported, and a unit that stands still because its crowd is moving can appear as a jam.

## Findings

Snapshot `b6be1285b0` (sha1 of the engine, cards, AI and bot files, printed in every run's header). The
engine now steers ground troops around towers and buildings, `CR.AI` is a thin adapter over `CR.Bot`, and the
bot's forced play can use buildings. The baseline numbers below come from the code before those changes.

### Before and after

| Measure | Before | After |
| --- | --- | --- |
| AI vs AI, towers destroyed per match (both sides, n=60) | 0.78 | 0.78 to 0.93 (n=300, seeds 1 to 3) |
| AI vs AI, overtime rate | 77.5 to 90% | 75 to 81% |
| `ai:hard` vs `ai:normal` win rate | 47.5% (n=40) | 63% (seed 1), 51 to 55% (seeds 2, 3) |
| `ai:normal` vs `ai:easy` win rate | 37.5% (n=40) | 79% (seed 1), 72 to 75% (seeds 2, 3) |
| `ai:hard` vs `ai:easy` win rate | 50% (n=40) | 80% (seed 1), 77 to 79% (seeds 2, 3) |
| `bot:control` vs `ai:normal` (n=120) | 80% (n=40) | 77.5% |
| `bot:cycle` vs `ai:normal` (n=120) | 5% (n=40) | 10% |
| `bot:turtle` vs `ai:normal` (n=120) | 5% (n=40) | 15%, leak 0.0 s (was 17.6 s) |
| `bot:bridgespam` vs `ai:normal` (n=120) | 13% (n=40) | 28% |
| Walk windows under 70% speed touching a tower or building, by the same test | 889 | 56 (see Limits) |
| Walk windows under 70% speed, all causes (simtest, 40 matches) | 2629 | 1660 (1549 with troop crowding) |

Tournament at n=10 (snapshot `b6be1285b0`): `control` 87.8%, `ai:hard` 75.6%, `bait` 72.2%, `beatdown`
66.7%, `ai:normal` 57.8%, `ai:easy` 42.2%, `turtle` 40.0%, `bridgespam` 30.0%, `cycle` 16.7%, `random` 11.1%.

### What changed

1. Tower footprints. A ground troop whose straight walk to its goal enters a tower or building circle turns
   onto that circle's tangent at full speed, on the side that leads to the goal, and keeps that side for 1.5 s.
   Towers use the corner of their footprint as the steering radius. A troop that makes no headway for 0.6 s
   flips its side and steps away from the nearby obstacles. The Musketeer behind its own princess tower now
   walks round it at about full speed (mechtest 41a), and a Knight walks round a cannon on the bridge approach
   and reaches the king's range (41b). The Hog Rider crawl near its own princess is gone.
2. `CR.AI` is a thin adapter. It classifies the AI's deck (`beatdown`, `cycle`, `control`, `bait`, `bridgespam`
   or `turtle`), builds a `CR.Bot` from that preset, and applies a difficulty overlay (`js/ai.js`,
   `DIFFICULTY`). Easy reacts in 2 to 3 s, leaks elixir, picks the second-best counter half the time and does
   not counter-push. Normal reacts in 1.2 to 2 s and counter-picks a third of the time. Hard reacts in 0.25 to
   0.5 s, never leaks, answers threats at lower value, and pushes on a 1.5 s cooldown.
3. Pushes. The tank drops at the bridge (not behind the princess), the lane is the weakest princess, and the
   defence answers threats at a lower threshold. Tank placement at the bridge is the single biggest change:
   overtime went from about 85% to 72% on its own.
4. Forced plays can place buildings, so turtle no longer leaks elixir at the cap.
5. Schema audit: all 55 keys in `CR.BOT_SCHEMA` are read by `js/bot.js` (checked by grep on the last key
   segment). `offense.pocketUsage` value `tankOnly` behaves like `always` for the tank; only `never` and the
   support spot differ. That is a known gap, not a dead parameter.

### Round 3

Changes: a wedge fix in the engine (a local sampling planner for blocked steps, walls and the river as
obstacles, a one-way bridge commitment, a knockback timer), a spend-based punish trigger in the bot (counter-push
when the opponent has spent 6 elixir or more in 8 s; neutral within noise), and forced plays that place
buildings.

| Measure | Round 2 | Round 3 |
| --- | --- | --- |
| simtest walk windows below 70%, without troop crowding (crowd radius 1 tile) | 111 | 11 |
| simtest walk windows touching a tower or building | 56 | 3 |
| AI vs AI towers destroyed per match (n=300, seed 1) | 0.92 | 1.01 |
| AI vs AI overtime (n=300, seed 1) | 75% | 78% |
| `ai:hard` vs `ai:normal` (n=300, seed 1) | 63% | 60% |
| `ai:normal` vs `ai:easy` (n=300, seed 1) | 79% | 71 to 74% |
| `ai:hard` vs `ai:easy` (n=300, seed 1) | 80% | 80 to 81% |
| Tournament n=10, `bot:control` / `ai:hard` / `ai:normal` | 87.8 / 75.6 / 57.8% | 80.0 / 74.4 / 60.0% |

Not reached in this round: overtime under 50%, towers per match at least 1.2, hard over normal at 65%, and
lone-troop halving. The remaining simtest windows are corner and wedge cases (a unit between a wall or river edge
and a building) that the local planner does not clear; they are listed under Limits.

### Remaining problems

- Stalemates remain. AI vs AI matches still end 0-0 on crowns about half the time, so 75 to 81% reach
  overtime. Two crowns in three minutes is what the 40% overtime target needs, and the current push rate gives
  about 0.5 crowns per side. Crowns per side are roughly Poisson at this rate, which alone gives a tie of about
  50%. The 40% target needs more decisive games (focus on one princess, a second push after a kill), not only
  more pushes. Towers per match now clear the 0.8 target.
- Difficulty tiers: `ai:normal` over `ai:easy` and `ai:hard` over `ai:easy` clear 65% and 80%. `ai:hard` over
  `ai:normal` is 51 to 63% across seeds, short of 65%. Counter errors and reaction time matter less than
  expected, so the gap is set by shared bot logic, not by overlay values.
- Presets. `cycle` (10 to 25%) and `turtle` (15%) and `bridgespam` (28%) are below 40%. `cycle` makes about
  57 defensive plays and 2 pushes per match, and its cheap troops die chasing into the enemy half. `turtle`
  rarely pushes and gets outscored. Neither is fixed by the knobs I swept (`defense.threatThreshold`,
  `defense.overcommit`, `elixir.pushThreshold`, `offense.aggression`, `cycle.cardsPer10s`).
- Units still get stuck in pockets between two of their own buildings (a Hog Rider beside its own princess and
  cannon, for example), and crowds at the bridge mouths slow troops. simtest counts the windows these cause; see
  Limits.

## Limits

- Sample sizes. n=6 in the tournament is too small to rank the close presets. n=40 separates the strong
  ones from the weak. Differences below about 15 percentage points do not show at n=40.
- Decks. A bot plays its preset's deck. The AI rotates through its six decks, so bot and AI decks differ in
  each matchup. The head-to-head numbers mix strategy and deck.
- Spell measurement is approximate. Impact is checked after the flight time, so units that move during the
  flight can be counted as hits or misses. Logs and barrels are not checked in the reviews.
- simtest's walk-speed check (`trackWalk`) still fails: 11 open-ground and 3 building-touching windows over 40
  random-bot matches, all in corners or wedges between a wall or the river edge and a building. Troops queued
  within one tile of another troop are excluded as crowding; troops knocked back by a spell are excluded for 0.6 s.
  The check is strict otherwise and does not pass yet.
- The stall threshold (0.25 tiles/s over 5 s) is a heuristic. It catches the crawls described above. It will
  also report a unit held by a large crowd, under the "jam" label.
- The engine and card data are being changed by another agent. These results are for the state at the time
  of each run. Re-run `tournament`, `sweep` and the reviews after engine changes.
- `CR.AI` is now a preset-based adapter over `CR.Bot`, so the lab measures the computer opponent through the bot.
- Not done: worker-thread parallelism (matches run in about 10 seconds for a full tournament at n=6 without
  it), browser wiring for the bot, and a test suite for `js/bot.js`. The checks run during development were a
  deterministic replay of one match, a schema against defaults check, and all CLI paths including errors.

