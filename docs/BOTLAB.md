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
cards are picked up. `js/engine.js`, `js/cards.js` and `js/ai.js` are not changed by the lab.

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

Snapshot `2a7f3da9b6` (the sha1 of `js/engine.js`, `js/cards.js`, `js/ai.js`, `js/bot.js` and
`js/botconfig.js`, printed in every run's header). The mechanics agent is still adding cards and rules to the
engine, so these numbers are for this snapshot. Re-run the commands to refresh them. Outputs are in
`docs/reviews/`.

### Tournament (n=6, 54 games per competitor)

```
Tournament: 10 competitors, n=6 per pair (45 pairs), seed=1, snapshot=2a7f3da9b6
Points: 3 per win, 1 per draw. Crowns and tower damage are per game.

Competitor      Pts   W  D   L  Win rate  Crowns for  Crowns vs  Tower dmg for  Tower dmg vs  Games
--------------  ---  --  -  --  --------  ----------  ---------  -------------  ------------  -----
bot:control     126  42  0  12     77.8%        0.65       0.04         3628.5        1272.9     54
ai:hard         121  40  1  13     74.1%        0.83       0.20         3465.9        1903.1     54
bot:beatdown    111  37  0  17     68.5%        0.61       0.20         3302.9        1756.0     54
bot:bait        111  37  0  17     68.5%        0.41       0.15         2516.4        1457.0     54
ai:normal       111  37  0  17     68.5%        0.46       0.28         3100.9        2347.2     54
ai:easy         105  35  0  19     64.8%        0.56       0.30         2958.8        2369.4     54
bot:cycle        37  12  1  41     22.2%        0.11       0.67         1132.0        2950.8     54
bot:turtle       33  11  0  43     20.4%        0.07       0.43         1366.6        2964.3     54
bot:bridgespam   27   9  0  45     16.7%        0.07       0.44          950.6        2754.9     54
bot:random       27   9  0  45     16.7%        0.11       1.19         2524.4        5171.4     54

Head to head, row A vs column B, W-L-D from A's side:

A \ B                 1      2      3      4      5      6      7      8      9     10
----------------  -----  -----  -----  -----  -----  -----  -----  -----  -----  -----
1 bot:control         -  4-2-0  2-4-0  4-2-0  3-3-0  5-1-0  6-0-0  6-0-0  6-0-0  6-0-0
2 ai:hard         2-4-0      -  4-2-0  3-3-0  4-2-0  4-2-0  5-0-1  6-0-0  6-0-0  6-0-0
3 bot:beatdown    4-2-0  2-4-0      -  3-3-0  2-4-0  3-3-0  6-0-0  5-1-0  6-0-0  6-0-0
4 bot:bait        2-4-0  3-3-0  3-3-0      -  3-3-0  3-3-0  6-0-0  6-0-0  5-1-0  6-0-0
5 ai:normal       3-3-0  2-4-0  4-2-0  3-3-0      -  2-4-0  6-0-0  6-0-0  5-1-0  6-0-0
6 ai:easy         1-5-0  2-4-0  3-3-0  3-3-0  4-2-0      -  5-1-0  6-0-0  5-1-0  6-0-0
7 bot:cycle       0-6-0  0-5-1  0-6-0  0-6-0  0-6-0  1-5-0      -  3-3-0  4-2-0  4-2-0
8 bot:turtle      0-6-0  0-6-0  1-5-0  0-6-0  0-6-0  0-6-0  3-3-0      -  4-2-0  3-3-0
9 bot:bridgespam  0-6-0  0-6-0  0-6-0  1-5-0  1-5-0  1-5-0  2-4-0  2-4-0      -  2-4-0
10 bot:random     0-6-0  0-6-0  0-6-0  0-6-0  0-6-0  0-6-0  2-4-0  3-3-0  4-2-0      -
```

At this size a pair of competitors is 6 games, so only large gaps show. `control` leads with 42 wins in 54 and
deals about 2.9 times the tower damage it takes per game. The n=40 runs below check its strength against each
AI.

### Matchups at n=40

From `docs/reviews/matchups-n40.txt`. Win rate from the first competitor's side, with the Wilson 95 percent
interval.

| Matchup | Win rate (95% CI) | Crowns for / vs | Tower dmg for / vs | Overtime |
| --- | --- | --- | --- | --- |
| AI easy vs AI normal | 50.0% (35.2, 64.8) | 0.28 / 0.33 | 2368 / 2245 | 65.0% |
| AI hard vs AI normal | 47.5% (32.9, 62.5) | 0.38 / 0.33 | 2274 / 2511 | 77.5% |
| AI hard vs AI easy | 50.0% (35.2, 64.8) | 0.50 / 0.43 | 2716 / 2641 | 67.5% |
| control vs AI normal | 80.0% (65.2, 89.5) | 0.55 / 0.10 | 3501 / 1561 | 67.5% |
| control vs AI hard | 75.0% (59.8, 85.8) | 0.60 / 0.10 | 3622 / 1587 | 65.0% |
| beatdown vs AI hard | 57.5% (42.2, 71.5) | 0.60 / 0.53 | 2982 / 2636 | 52.5% |
| cycle vs AI hard | 5.0% (1.4, 16.5), 2-37-1 | 0.05 / 1.00 | 980 / 4216 | 50.0% |

### Reviews

Reviews of `control` at seed 7 against `ai:normal` and `ai:hard`, and an extra review of `cycle` against
`ai:normal` at seed 3 (`docs/reviews/`).

- Against `ai:normal` the match ended 0-0 on crowns and went to the tiebreak, which the bot won. The bot dealt
  541 tower damage and took 214. Its findings: one AI tower hit with no defender present, 20 bot troops lost in
  the enemy half, 12 bot troops crawling along a tower footprint, 7 AI units doing the same, and 4 AI troops sent
  into a tower alone.
- Against `ai:hard` the match also ended 0-0 and went to the tiebreak, which the bot won. The bot dealt 2158 and
  took 651. Its findings: 18 bot troops lost in the enemy half, 10 bot units crawling along a tower footprint, 5
  AI units doing the same, one AI Giant standing still with no visible cause, and 6 AI troops sent into a tower
  alone.
- Against `ai:normal` at seed 3, `cycle` lost 0-1 on crowns. It took 3162 tower damage and dealt 1272. It cast
  56 defences and one push. Its findings: 26 bot troops lost in the enemy half (12 Goblins, 7 Skeletons, 4 Bats,
  3 Knights).

### What the runs show about the computer opponent (CR.AI)

1. Its difficulty tiers are not distinguishable at n=40. `easy` against `normal` is 50 percent, `hard` against
   `normal` is 47.5 percent, and `hard` against `easy` is 50 percent. Every interval runs from about 33 to 65
   percent. The tiers differ in reaction time, gap, error chance, push threshold and counter-push, and none of
   these moves the win rate beyond the noise at this size. Differences below about 15 points would not show.
   The n=6 tournament matrix, which has `ai:easy` beating `ai:normal` 4-2, shows the same thing.
2. Its ranged defenders stand directly behind the princess tower (`BACK_FY` at the lane's x). The path to the
   bridge runs through the tower's footprint, so they crawl along it. Each review counts 5 to 7 AI units crawling
   per match, mostly Musketeers, Archers and Electro Wizards between x 2.7 and 15.2 at y 4.5 to 5.1.
3. It sends troops into towers alone. The reviews count 4 to 6 AI troops per match going into a princess tower
   with no friendly troop within 3 tiles: Giants, Knights, Musketeers, Archers and Mini P.E.K.K.A. It also loses 10 to 11
   troops per match in the bot's half without reaching a tower.
4. It leaks elixir at every tier, 0.6 to 1.2 seconds per match, with no ordering by tier. Its damage spells hit
   their targets: 9 of 9 and 12 of 12 in the two reviews. Its unanswered tower hits are rare: one in the
   `ai:normal` review, none in the `ai:hard` review.

### What the runs show about the engine and the game

1. Matches are stalemates. In AI-against-AI matches 65 to 78 percent go to overtime. Each side loses 2200 to
   2700 hit points of its roughly 10,900 total tower hit points in 3 minutes, which is 20 to 25 percent. Average
   crowns per side are 0.3 to 0.5.
2. Towers avoid units by sliding, not steering. A unit whose straight path crosses a tower footprint slides
   along it at about 0.1 tiles/s instead of its speed, and can stay there for 10 seconds or more. The engine's
   rule ("slide around them") leaves a unit behind a tower stuck. Both sides show it. Over the two `control`
   reviews the bot had 10 to 12 such units per match and the AI 5 to 7.
3. Units crowd at the bridge mouths and behind the towers. The reviews count 2 to 3 units per side per match
   packed against each other with no target: at the bridge mouths (x 3 to 4 and 14 to 15, y 15 to 17), behind
   the AI's towers (x 13.6 to 15.0, y 4.6 to 4.8) and behind the bot's towers (x 13.7 to 15.2, y 27.2 to 27.4).
4. The other engine checks came back nearly clean in the final reviews. One AI Giant stood still with no target
   and no visible cause in the hard review, and no other unit did. No troop sat in the river outside a bridge,
   no projectile was launched with nothing at its aim point, and no unit left the arena. Earlier versions of the review did flag idle units and
   target-less projectiles. Both were false positives: a unit shooting a stationary target, and a target killed
   in the same step. The fixes were in the review, not the engine.

### Bot findings

1. The bot's ranged defenders have the same footprint crawl problem as the AI's. `defense.backDistance` places
   them directly behind the tower, which is where the crawl starts. The control reviews count 10 to 12 bot
   units crawling per match, more than the AI does.
2. `cycle` loses nearly every game (2-37-1 against `ai:hard`). It answers threats 53 times per match, mostly with
   cheap cards that die in the enemy half. It deals about 980 tower damage per match and takes about 4200.
   Its defence is too cheap and too reactive, and its pushes are rare (3.4 per match).
3. `control` is strong: 80 and 75 percent against the two AI tiers, with 3500 tower damage per match and 0.0
   seconds of leak. Its pushes start 7 to 8 times per match, and its forced plays run 3 to 5 per match.
4. The spells it casts are mostly Zap, 5 of 6 in each control review, with Freeze about once per match. Fireball
   is not in its deck. Measured spell value runs about 30 percent above the value the bot predicted (31 against 24
   in the normal review), so the spell valuation is conservative.
5. Pushes lose troops in the enemy half before they reach a tower (18 to 20 per match for `control`). The
   tank-and-support sequence works, but the filler units spent after support feed those losses.

### Prioritised improvement list

Priority reflects the effect on how useful the computer opponent is as a test, and on play quality.

1. **Engine: steer around tower footprints.** A unit whose path crosses a footprint should route around the
   corner, not slide along it. This is the largest stall in both sides' play. Owner: the engine. Verify with
   `review`: the "crawled along a tower footprint" findings should go away.
2. **AI: move ranged defence beside the princess tower, not behind it.** Replace `BACK_FY` at the lane's x with
   a spot about 2.5 tiles to the side of the tower's centre. Owner: `js/ai.js`.
3. **Bot: the same change for ranged defence.** Apply it to `troopSpot` in `js/bot.js` for ranged cards, and
   test with `review` at once. This is the bot's most common stall.
4. **Balance: stalemates and tower hit points.** Between 65 and 78 percent of AI-against-AI matches go to
   overtime, and towers lose 20 to 25 percent of their hit points in 3 minutes. Check unit damage per second
   against princess and king hit points, and whether AI pushes are too slow. Measure with
   `match --bot ai:normal --vs ai:normal --n 40`.
5. **AI: make the difficulty tiers differ in things that decide games.** Candidates: push frequency, whether it
   counter-pushes, how many units it commits to a defence, and how well it uses spells. Measure with `match` at
   n=40 or more. The target is a ladder in which each tier beats the one below it at 60 percent or more.
6. **AI: stop sending tanks alone into towers.** The AI sends 4 to 6 troops alone into a tower per match. Hold a
   tank until support is in the lane or a counter is ready. Owner: `js/ai.js`.
7. **Bot: cycle defence and cheap cards.** Answer small threats with less, or weigh what a cheap card dies to.
   Retune `cycle` with `sweep`. The sweep shows `defense.threatThreshold` and `timing.reactionMax` matter more
   than `offense.aggression` for this preset.
8. **Engine: defenders should not chase across the river.** Troops answering a threat chase it over the bridge
   and die there. A leash to their own half would keep them alive for the next wave. Owner: the engine.
9. **Bot: value Freeze and Fireball.** Include the tower-damage term and the value of hitting one large unit, so
   the big spells are cast when they should be.
10. **Engine and AI: keep the bridge mouth and tower back edge clear.** The packed units there are a crowding
    issue that a spacing rule at deploy would ease.

## Limits

- Sample sizes. n=6 in the tournament is too small to rank the close presets. n=40 separates the strong
  ones from the weak. Differences below about 15 percentage points do not show at n=40.
- Decks. A bot plays its preset's deck. The AI rotates through its six decks, so bot and AI decks differ in
  each matchup. The head-to-head numbers mix strategy and deck.
- Spell measurement is approximate. Impact is checked after the flight time, so units that move during the
  flight can be counted as hits or misses. Logs and barrels are not checked in the reviews.
- The stall threshold (0.25 tiles/s over 5 s) is a heuristic. It catches the crawls described above. It will
  also report a unit held by a large crowd, under the "jam" label.
- The engine and card data are being changed by another agent. These results are for the state at the time
  of each run. Re-run `tournament`, `sweep` and the reviews after engine changes.
- `CR.AI`, the engine and the cards are not changed by the lab, so the findings are for the current code.
- Not done: worker-thread parallelism (matches run in about 10 seconds for a full tournament at n=6 without
  it), browser wiring for the bot, and a test suite for `js/bot.js`. The checks run during development were a
  deterministic replay of one match, a schema against defaults check, and all CLI paths including errors.

