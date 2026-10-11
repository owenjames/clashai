# Clash Royale research for ClashAI

Date of research: 2026-10-11. Compared against `SPEC.md`, `js/cards.js`, `js/engine.js`, `js/ai.js` as they were read at that date.

Read this first. Most card-level numbers below come from a machine-readable snapshot that was last updated on 2023-10-18. Several of the best-known sites blocked automated access during this research (see section 0). Anything not read from a page this session is tagged, so nothing is presented as more certain than it is.

## 0. Sources and confidence

### 0.1 Legend

| Tag | Meaning |
| --- | --- |
| [V] | Read from the page this session. Quoted or paraphrased from the cited URL. |
| [S] | Seen only in a search-result summary. The page itself was blocked or not fetched. Check before relying on it. |
| [D] | Value from the RoyaleAPI `cr-api-data` snapshot (last commit 2023-10-18). Machine-readable, per-level, but about 3 years old. |
| [R] | Recalled from general Clash Royale knowledge. Not checked this session. Treat as a hypothesis. |

### 0.2 Source status

| Source | Status | Used for |
| --- | --- | --- |
| [Supercell release notes, 26 Nov 2019](https://supercell.com/en/games/clashroyale/blog/release-notes/november-update) | [V] | Overtime is 2 minutes, with x3 Elixir in its last minute. |
| [Wikipedia, Clash Royale](https://en.wikipedia.org/wiki/Clash_Royale) | [V] | Match flow, tiebreak rule, King Tower activation, hand size, deck size. |
| [PocketGamer troop guide](https://www.pocketgamer.com/clash-royale/clash-royale-cheats-and-tips-a-guide-to-every-troop-card-update/) | [V] | Explicitly labelled level 1 base values. Cross-check only. Not tournament standard. |
| [RoyaleAPI cr-api-data, character stats](https://github.com/RoyaleAPI/cr-api-data/blob/master/docs/json/cards_stats_characters.json) | [D] | Per-level HP, damage, hit speed, load time, range, sight, speed, mass, deploy time for troops. Raw file: `https://raw.githubusercontent.com/RoyaleAPI/cr-api-data/master/docs/json/cards_stats_characters.json`. |
| [RoyaleAPI cr-api-data, building stats](https://github.com/RoyaleAPI/cr-api-data/blob/master/docs/json/cards_stats_building.json) | [D] | Towers, Cannon, Inferno Tower, Tombstone, Goblin Hut. |
| [RoyaleAPI cr-api-data, projectile stats](https://github.com/RoyaleAPI/cr-api-data/blob/master/docs/json/cards_stats_projectile.json) | [D] | Per-level damage for ranged shots and spell impacts (Arrows, Fireball, Rocket, The Log). |
| [RoyaleAPI cr-api-data, spell stats](https://github.com/RoyaleAPI/cr-api-data/blob/master/docs/json/cards_stats_spell.json) | [D] | Zap, Freeze, Poison, Lightning, Tornado, Graveyard. Includes `crown_tower_damage_percent`. |
| [RoyaleAPI cr-api-data, card list](https://github.com/RoyaleAPI/cr-api-data/blob/master/docs/json/cards.json) | [D] | Card roster. Elixir cost is in `cards_stats_troop.json` as `mana_cost`. |
| [RoyaleAPI Musketeer rework, Nov 2025](https://royaleapi.com/blog/three-musketeers-rework-november-2025) | [S] | Standard Musketeer 721 HP, 217 damage, 1.0 s hit, 6.0 range, medium speed. The page returned 403. |
| [Supercell support, Elixir](https://support.clashroyale.com/hc/en-us/articles/49484936933403-Elixir) | [S] | Overtime elixir by minute: x2 in minute 4 and x3 in minute 5 of the match. The page returned 403. |
| [Liquipedia, Tower Princess](https://liquipedia.net/clashroyale/Tower_Princess) | [S] | Tower Princess (a tower troop card, not the building) at level 11: 3052 HP, 109 damage, 0.8 s hit, 7.5 range. The page returned 403. |
| [Clash Royale Fandom wiki](https://clashroyale.fandom.com/wiki/Princess_Tower) | Blocked (402) | Not read. Speed tier mapping was seen only as a search summary. |
| [Liquipedia Clash Royale](https://liquipedia.net/clashroyale/Overtime) | Blocked (403) | Not read. |
| [RoyaleAPI site](https://royaleapi.com/cards/popular) | Blocked (403) | Not read. |
| [cr-api.com](https://cr-api.com/cards) | Blocked (bot challenge) | Not read. |
| Deckshop | Not found in search | Not read. |

Blocked pages were not accessed by any workaround. Where a block prevents a check, the value stays [R] or [S] and is listed in section 6 as needing verification.

### 0.3 The main caveat

The per-level snapshot shows the structure of the stat curves, and it agrees with several of our values, but it is old. Two concrete signs of that:

1. The 2025 Musketeer rework article gives 721 HP and 217 damage at standard. The 2023 snapshot gives 870 HP and 263 damage at level 11. Our `cards.js` value (720 and 217) matches the 2025 article, not the snapshot.
2. The snapshot has no entries for several cards that exist in the current game (Bandit, Sparky, Lumberjack, Magic Archer, Elite Barbarians, X-Bow, Executioner, Furnace). Those are marked "not in snapshot" below.

Recommendation: before tuning numbers, verify the tower and the top 20 troop stats against a current source that the fetch tool can read, or against an in-game card info screen at the chosen level.

---

## 1. Core rules as they are today

| Item | Value | Tag | Source and notes |
| --- | --- | --- | --- |
| Arena size | 18 wide by 32 tall tiles | [R] | Matches `CR.ARENA`. Not checked this session. |
| River | Two tiles deep, between rows 15 and 17 in our frame | [R] | Matches `RIVER_TOP`/`RIVER_BOTTOM`. Not checked. |
| Bridges | Two, one each side of the centre line | [R] | Our bridges are 3 tiles wide (`halfWidth` 1.5). Real width not verified this session. |
| Tower footprint | Princess 3x3, King 4x4 | [R] | Matches `TOWERS.*.size`. Not checked. |
| Starting hand | 4 cards in hand, 4 in the cycle queue | [V] | [Wikipedia](https://en.wikipedia.org/wiki/Clash_Royale): "Each deck has eight cards, with four available in hand at any time." |
| Card cycle | 8-card deck, played card returns after the other 4 cards are played | [V] | Same source. Matches `SPEC.md`. |
| Elixir rate | 1 per 2.8 s at 1x, cap 10 | [R] | Matches `CR.ELIXIR`. Not re-checked this session. |
| Starting elixir | 5 | [R] | Matches `CR.ELIXIR.start`. Not checked this session. |
| Regulation length | 3:00 | [V] | [Wikipedia](https://en.wikipedia.org/wiki/Clash_Royale): "Normal time lasts up to three minutes." |
| Double elixir | Last minute of regulation (last 60 s) | [V] | [Wikipedia](https://en.wikipedia.org/wiki/Clash_Royale): "Elixir generation doubles during the final minute." Matches our 60 s. |
| Overtime length | 2:00 | [V] | [Supercell, 26 Nov 2019](https://supercell.com/en/games/clashroyale/blog/release-notes/november-update): "Overtime now lasts for 2 minutes instead of 3, and includes x3 Elixir generation in the last minute." |
| Overtime elixir | x2 for the first minute, x3 for the second | [V] for x3 in the last minute, [S] for the x2 minute | Supercell 2019 (x3 last minute). Support article summary (x2 minute 4, x3 minute 5 of match). Our engine: x2 for first 60 s, x3 for second 60 s. Matches. |
| Overtime win | First tower destroyed wins; the first crown change ends the game | [V] | [Wikipedia](https://en.wikipedia.org/wiki/Clash_Royale): "the first player to destroy a tower wins." |
| Tiebreaker | If no tower falls in overtime, the player whose remaining tower has the lowest HP loses | [V] | [Wikipedia](https://en.wikipedia.org/wiki/Clash_Royale): "the player whose remaining tower has the lowest health loses." |
| Tiebreaker tie | Draw if the lowest-HP towers are equal | [S] | Fan summary (Speakerdeck), not official. Our engine uses a draw. Confirm in game. |
| King destroyed | Immediate win, 3 crowns | [V] for the win, [R] for 3 crowns | [Wikipedia](https://en.wikipedia.org/wiki/Clash_Royale) says destroying the King Tower wins. |
| King Tower activation | Starts shooting after its own damage or after either Princess Tower is destroyed | [V] | [Wikipedia](https://en.wikipedia.org/wiki/Clash_Royale): "The King Tower activates after a Princess Tower is destroyed or after it takes damage." Matches our engine. |
| Deploy zone | Own half only for troops and buildings; spells anywhere | [V] | Wikipedia (same URL). Matches `SPEC.md`. |
| Pocket | After a Princess Tower falls, its lane opens partly onto the enemy side | [V] for the mechanic, [R] for depth | Wikipedia says the pocket "partially expands". Depth not stated in any source read. Ours is 4 tiles past the river. Verify. |
| Deploy time | 1 s for most troops and buildings; Golem 3 s | [D] | Snapshot `deploy_time`: 1000 ms on almost every unit and building. Golem 3000 ms in [cards_stats_characters.json](https://github.com/RoyaleAPI/cr-api-data/blob/master/docs/json/cards_stats_characters.json). Our engine uses 1.0 s for all, so Golem is wrong. |
| Spell deploy | No deploy delay | [R] | Not checked. |
| Spawn formations | Archers 2, Goblins 3, Spear Goblins 3, Skeletons 3, Skeleton Army 15, Minions 3, Barbarians 5, Bats 5 | [D] | Count per card matches `cards.js`. The geometry of the formation is not in the data and is [R]. |

### 1.1 Towers at tournament standard (level 11)

| Tower | Our value | Snapshot value (level 11) | Tag | Notes |
| --- | --- | --- | --- | --- |
| Princess HP | 3052 | 3584 | [D] | Snapshot `hitpoints_per_level[10]` on `PrincessTower` in [cards_stats_building.json](https://github.com/RoyaleAPI/cr-api-data/blob/master/docs/json/cards_stats_building.json). |
| Princess damage per shot | 109 | 128 | [D] | `TowerPrincessProjectile` `damage_per_level[10]` in [cards_stats_projectile.json](https://github.com/RoyaleAPI/cr-api-data/blob/master/docs/json/cards_stats_projectile.json). |
| Princess hit speed | 0.8 s | 0.8 s | [D] | Matches. |
| Princess range | 7.5 tiles | 7.5 tiles | [D] | Matches. |
| King HP | 4824 | 6144 | [D] | `KingTower` in the building snapshot. |
| King damage per shot | 109 | 128 | [D] | `KingProjectile`. |
| King hit speed | 1.0 s | 1.0 s | [D] | Matches. |
| King range | 7.0 tiles | 7.0 tiles | [D] | Matches. |

Our Princess numbers (3052 HP, 109 damage, 0.8 s, 7.5) match the [Liquipedia Tower Princess](https://liquipedia.net/clashroyale/Tower_Princess) troop card at level 11 [S]. That is a different card from the Princess Tower building. Our tower numbers were probably taken from the troop card. The building values in the snapshot are higher. Our King HP (4824) does not match any level in the snapshot. Resolve which tower level is the tournament standard before changing numbers.

---

## 2. Unit behaviour rules

Each item has its tag. Engine references are to `js/engine.js`.

### 2.1 Targeting

- **Closest valid target in sight.** A unit with no current target picks the nearest valid enemy inside its sight range. [S] The Liquipedia troop page summary says "troops have a sight range, and they target the closest enemy within it." Engine: `findTarget` at `sight`, edge to edge, every 0.2 s (`RETARGET_EVERY`). Matches the stated behaviour.
- **Sight versus range.** Sight is how far a unit notices a target. Range is how far it can attack. Snapshot `sight_range` is the noticing distance: Knight 5.5, Giant 7.5, Hog Rider 9.5, Balloon 7.7. [D]
- **Lock on.** Once a target is in attack range, the unit stays on it. [S] RoyaleAPI's Cannoneer test found a tower troop keeps firing at an acquired target while it stays in attack range, even outside its sight. Our engine: `locked` is set when a unit starts attacking, and it drops the lock when the target leaves range plus `LOCK_BREAK` (0.5 tiles).
- **What resets the lock.** Stun, freeze, knockback, or the target dying. [R] Engine matches this list in `applyDisable`, `knockback`, `dropTarget`.
- **Retargeting while attacking.** Whether a locked unit switches to a closer target is not verified. [R] Real game behaviour should be tested in game before tuning.
- **Building-targeting units.** Giant, Golem, Golemite, Hog Rider, Balloon, Royal Giant and Lava Hound ignore troops and attack buildings and towers only. [D] The snapshot marks them with `target_only_buildings: true`. Their walk goal when no building is in sight is [R].
- **Tower target priority.** Towers shoot the closest enemy ground or air unit in range and keep it until it dies or leaves range. [R] Engine matches. The real priority among multiple units at equal range is not verified.
- **Kiting.** Ranged units step back to keep out of melee range. [R] Not implemented in our engine. Our units walk straight toward their target and then stop.

### 2.2 First hit, load time, hit speed

- **Load time (first hit).** Delay after a target enters range before the first hit lands. [D] The snapshot has a separate `load_time` field, for example Knight `load_time` 700 ms and `hit_speed` 1200 ms. Our engine does this in `updateUnit`, with `loadTime` from `CR.UNITS`. Data for our units is in section 3.
- **Hit speed.** Time between hits after the first. [D] `hit_speed` in ms. Matches our `hitSpeed` for all listed units.
- **Stun and freeze reset the attack.** [R] Our `applyDisable` resets `attackCooldown` to `loadTime`, which matches the usual rule that a stun resets the first-hit delay.

### 2.3 Attack range

- **Measured edge to edge.** [R] The snapshot `range` is in tiles, but the snapshot does not say whether it is measured from centre or edge. Example: Knight snapshot range 1.2, our range 0.8 (edge to edge). If the snapshot figure is centre to centre with a 0.5 radius, the edge-to-edge equivalent would be 0.7, which is close to our 0.8. This needs an in-game test (stand two units at a known gap and watch when attacks start).
- **Projectile range.** Ranged units fire when the target is inside `range`. [R]

### 2.4 Collision radius, mass, pushing

- **Collision radius.** [D] `collision_radius` in the snapshot (for example Knight 0.5 tiles, Giant 0.75, Golem 0.75, Skeleton 0.5). Our `CR.UNITS.r` values differ for several units; see section 3.
- **Mass.** [D] `mass` in the snapshot. Knight 6, Giant 18, Golem 20, Skeleton 1, Minion 2, Prince 6 (not 15 as in our code; see section 3). Pushing splits overlap by mass, which our `resolveCollisions` already does.
- **Heavy units and knockback.** Units with high mass resist knockback. [R] Our engine uses `mass < 15` as the knockback cutoff. The real threshold is not verified.

### 2.5 Speed tiers

Snapshot `speed` values map to tiers as follows. The mapping is from a [Fandom search summary](https://clashroyale.fandom.com/wiki/Cards) [S] and matches the snapshot. The tiles-per-second conversion is [R] and inferred from our `cards.js`, which already uses these values.

| Tier | Snapshot value | Tiles per second (our assumption) | Example units [D] |
| --- | --- | --- | --- |
| Slow | 45 | 0.75 | Giant, Golem, P.E.K.K.A, Royal Giant, Lava Hound |
| Medium | 60 | 1.0 | Knight, Archer, Musketeer, Barbarian, Prince, Balloon, Witch |
| Fast | 90 | 1.5 | Skeleton, Mini P.E.K.K.A, Baby Dragon, Minion, Electro Wizard, Miner |
| Very fast | 120 | 2.0 | Goblin, Spear Goblin, Hog Rider, Ice Spirit, Bat |

Bat is listed as very fast in the snapshot (120). Our `cards.js` lists Bat at 2.0, which matches.

### 2.6 Bridges and pathing

- **Ground units cross on bridges only.** [R] Our engine matches this. Units pick the bridge with the shorter total path from start, across, to goal (`chooseBridgeX`).
- **River jump (Hog Rider).** [R] Our engine: `jumpsRiver` for Hog Rider. Snapshot: Hog Rider does not have a `jump_enabled` field, so the jump behaviour is [R].
- **Ram and Ram Rider jump.** [D] `jump_enabled` is true on `Ram` in the snapshot. Dark Prince also has `jump_enabled`. Our engine does not model jumps for these units.

### 2.7 Charge, dash, spawn, death

- **Prince charge.** [D] Snapshot `charge_range` 300 (3.0 tiles) and `charge_speed_multiplier` 200 (2x speed). Our `CR.UNITS.prince.charge` says 2.5 tiles and speed 2.0. The charge range is 17 percent short of the snapshot. Flagged in section 3.
- **Mega Knight jump (dash).** [D] `dash_damage` 444, `dash_max_range` 5.0 tiles, `dash_radius` in snapshot. Our engine has no dash.
- **Golem death.** [D] `death_damage_radius` 2.0 tiles, `death_spawn_character` Golemite, `death_spawn_count` 2. The death damage field in the snapshot (140) is not per level, so the level basis is unknown. Our value is 312.
- **Spawner units (Witch, Tombstone, Goblin Hut).** [D] Witch spawns 4 Skeletons (`spawn_number` 4). Tombstone spawn interval in the snapshot is 500 ms, which looks wrong; treat Tombstone and Goblin Hut spawn timing as [R] until verified.

### 2.8 Ramp (Inferno Tower)

- [D] The snapshot gives Inferno Tower base damage per tick by level: 20 at level 1, 35 at level 7, 51 at level 11. Our ramp stages (35, 127, 422) are not in the snapshot. Stage multipliers and stage timings are [R].

### 2.9 Stun, freeze, slow

- **Zap stun.** [D] Zap has `radius` 2.5 tiles and `crown_tower_damage_percent` -70. Stun duration is not in the snapshot. Our 0.5 s is [R].
- **Freeze spell.** [D] `radius` 3.0 tiles. Duration not in snapshot. Our 4 s is [R].
- **Poison.** [D] `radius` 3.5 tiles. DPS and slow amount are not in the snapshot. Our 91 DPS and 15 percent slow are [R].

### 2.10 Spells and crown towers

- **Crown tower damage.** [D] `crown_tower_damage_percent` is a negative number. Towers take the remaining fraction.
  - Zap -70: towers take 30 percent.
  - Arrows -70: 30 percent.
  - Fireball -70: 30 percent.
  - Freeze -70: 30 percent.
  - Rocket -75: 25 percent.
  - The Log (LogProjectileRolling) -80: 20 percent.
  - Lightning and Poison: 0 in the snapshot, so the percentage is not defined there.
- **Damage timing.** Projectiles deal damage on arrival. [R] Our engine matches this in `updateProjectiles`/`impactProjectile`.
- **Spell travel.** Spells fly from the caster's King Tower at a fixed speed. [R] Our `travelSpeed` model is an approximation.

### 2.11 Splash radius

[D] Snapshot values, converted to tiles:

| Unit or spell | Splash radius (snapshot) | Ours |
| --- | --- | --- |
| Valkyrie (`area_damage_radius`) | 2.0 | 2.0 |
| Baby Dragon (projectile `radius`) | 1.2 | 1.5 |
| Wizard (projectile `radius`) | 1.5 | 1.5 |
| Bomber (projectile `radius`) | 1.5 | 1.5 |
| Ice Spirit (projectile `radius`) | 1.5 | 1.5 |
| Witch (projectile `radius`) | 1.0 | 1.0 |
| Fireball (spell `radius`) | 2.5 | 2.5 |
| Zap (spell `radius`) | 2.5 | 2.5 |
| Rocket (spell `radius`) | 2.0 | 2.0 |
| Freeze (spell `radius`) | 3.0 | 3.0 |
| Poison (spell `radius`) | 3.5 | 3.5 |
| Goblin Barrel (spell `radius`) | 1.5 | 1.5 |
| Arrows (projectile `radius`, per arrow) | 1.4 | 4.0 (unclear, see section 3) |

### 2.12 Air versus ground

- [D] `attacks_air` and `attacks_ground` fields. Ground-only attackers: Knight, Giant, P.E.K.K.A, Hog Rider, Golem, Barbarian, Prince, Valkyrie, Mini P.E.K.K.A, Goblin, Skeleton, Bomber, Balloon (buildings only). Ground and air attackers: Archer, Musketeer, Baby Dragon, Wizard, Minion, Spear Goblin, Ice Spirit, Witch, Bat. This matches the `targets` values in `cards.js` for every unit in section 3.1.

### 2.13 Log rolling

- [D] `LogProjectileRolling`: `projectile_range` 10100 (10.1 tiles, ours 11.1), `pushback_all` true, damage 614 at level 11 (ours 290, which is the level 3 value), `crown_tower_damage_percent` -80. The log's width is `LogProjectile` `radius` 1950, so a width of 3.9 tiles (ours 3.9) matches.

---

## 3. Per-card table at tournament standard (level 11)

Columns: ours is `js/cards.js` and `js/engine.js` (`CR.UNITS`). Data is the snapshot value at level 11 [D]. Values more than 5 percent away from the snapshot are shown in bold with the percentage difference. Speed compares our tiles per second with the snapshot value divided by 60.

Source for every "data" column: [cards_stats_characters.json](https://github.com/RoyaleAPI/cr-api-data/blob/master/docs/json/cards_stats_characters.json), [cards_stats_building.json](https://github.com/RoyaleAPI/cr-api-data/blob/master/docs/json/cards_stats_building.json), and [cards_stats_projectile.json](https://github.com/RoyaleAPI/cr-api-data/blob/master/docs/json/cards_stats_projectile.json) for projectile damage. Elixir cost for troops, buildings and spells is `mana_cost` in the snapshot and matches our cost in every card checked.

### 3.1 Units at level 11

| Card (cards.js id) | Cost | HP L11 ours / data | Damage ours / data | Hit s ours / data | Load s ours / data | Range ours / data | Sight ours / data | Speed ours / data (tier) | Deploy s | Mass | Targets | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Knight (knight) | 3 | 1766 / 1766 | 202 / 202 | 1.2 / 1.2 | 0.7 / 0.7 | 0.8 / 1.2 **(-33%)** | 5.5 / 5.5 | 1.0 / 1.0 (medium) | 1 | 6 / 6 | ground |  |
| Archer (archer) | 3 | 304 / 304 | 107 / 107 | 0.9 / 0.9 | 0.4 / 0.4 | 5 / 5.0 | 5.5 / 5.5 | 1.0 / 1.0 (medium) | 1 | 3 / 3 | ground+air | proj ArcherArrow |
| Giant (giant) | 5 | 4091 / 4940 **(-17%)** | 254 / 307 **(-17%)** | 1.5 / 1.5 | 1.0 / 1.0 | 0.8 / 1.2 **(-33%)** | 7.5 / 7.5 | 0.75 / 0.75 (slow) | 1 | 18 / 18 | buildings |  |
| Musketeer (musketeer) | 4 | 720 / 870 **(-17%)** | 217 / 263 **(-17%)** | 1.0 / 1.0 | 0.5 / 0.2 **(+150%)** | 6 / 6.0 | 6 / 6.0 | 1.0 / 1.0 (medium) | 1 | 5 / 5 | ground+air | proj MusketeerProjectile. Our 720/217 matches the Nov 2025 rework article [S], so keep ours. Load time in snapshot is 0.2 s. |
| Mini P.E.K.K.A (minipekka) | 4 | 1361 / 1643 **(-17%)** | 720 / 870 **(-17%)** | 1.6 / 1.6 | 0.5 / 1.1 **(-55%)** | 0.8 / 0.8 | 5.5 / 5.5 | 1.5 / 1.5 (fast) | 1 | 4 / 4 | ground |  |
| Goblin (goblin) | 2 | 202 / 202 | 120 / 120 | 1.1 / 1.1 | 0.4 / 0.7 **(-43%)** | 0.5 / 0.5 | 5.5 / 5.5 | 2.0 / 2.0 (very fast) | 1 | 2 / 2 | ground |  |
| Spear Goblin (speargoblin) | 2 | 133 / 133 | 81 / 81 | 1.7 / 1.7 | 0.5 / 1.2 **(-58%)** | 5 / 5.5 **(-9%)** | 5.5 / 5.5 | 2.0 / 2.0 (very fast) | 1 | 2 / 1 | ground+air | proj SpearGoblinProjectile |
| Skeleton (skeleton) | 1 | 81 / 81 | 81 / 81 | 1.0 / 1.0 | 0.5 / 0.5 | 0.5 / 0.5 | 5.5 / 5.5 | 1.5 / 1.5 (fast) | 1 | 1 / 1 | ground |  |
| Baby Dragon (babydragon) | 4 | 1152 / 1843 **(-37%)** | 161 / 256 **(-37%)** | 1.5 / 1.5 | 0.5 / 1.2 **(-58%)** | 3.5 / 3.5 | 5.5 / 5.5 | 1.5 / 1.5 (fast) | 1 | 5 / 5 | ground+air | proj BabyDragonProjectile. Splash ours 1.5, snapshot 1.2 |
| Hog Rider (hogrider) | 4 | 1696 / 2048 **(-17%)** | 318 / 384 **(-17%)** | 1.6 / 1.6 | 0.6 / 1.0 **(-40%)** | 0.8 / 0.8 | 9.5 / 9.5 | 2.0 / 2.0 (very fast) | 1 | 8 / 4 | buildings |  |
| Valkyrie (valkyrie) | 4 | 1907 / 2304 **(-17%)** | 267 / 322 **(-17%)** | 1.5 / 1.5 | 0.6 / 1.4 **(-57%)** | 0.8 / 1.2 **(-33%)** | 5.5 / 5.5 | 1.0 / 1.0 (medium) | 1 | 8 / 5 | ground | splash ours 2.0, snapshot 2.0 |
| Wizard (wizard) | 5 | 755 / 870 **(-13%)** | 281 / 340 **(-17%)** | 1.4 / 1.4 | 0.6 / 1.0 **(-40%)** | 5.5 / 5.5 | 5.5 / 5.5 | 1.0 / 1.0 (medium) | 1 | 5 / 5 | ground+air | proj chr_wizardProjectile, splash 1.5 |
| Minion (minion) | 3 | 230 / 230 | 107 / 117 **(-9%)** | 1.0 / 1.0 | 0.5 / 0.5 | 1.6 / 1.6 | 5.5 / 5.5 | 1.5 / 1.5 (fast) | 1 | 2 / 2 | ground+air | proj MinionSpit |
| Prince (prince) | 5 | 1920 / 3072 **(-38%)** | 392 / 627 **(-37%)** | 1.4 / 1.4 | 0.9 / 0.9 | 1.6 / 1.6 | 5.5 / 5.5 | 1.0 / 1.0 (medium) | 1 | 15 / 6 | ground | Charge range: ours 2.5, snapshot 3.0. Mass: ours 15, snapshot 6. |
| Balloon (balloon) | 5 | 1679 / 2688 **(-38%)** | 640 / 1024 **(-38%)** | 2.0 / 2.0 | 1.0 / 1.8 **(-44%)** | 0.1 / 0.1 | 7.7 / 7.7 | 1.0 / 1.0 (medium) | 1 | 9 / 6 | buildings | Death bomb: ours 272 radius 3.0, snapshot death spawn BalloonBomb (value not per level in snapshot) |
| Bomber (bomber) | 2 | 304 / 332 **(-8%)** | 225 / 222 | 1.8 / 1.8 | 0.6 / 1.6 **(-62%)** | 4.5 / 4.5 | 5.5 / 5.5 | 1.0 / 1.0 (medium) | 1 | 3 / 4 | ground | proj BombSkeletonProjectile, splash 1.5 |
| P.E.K.K.A (pekka) | 7 | 3760 / 6016 **(-38%)** | 816 / 1305 **(-37%)** | 1.8 / 1.8 | 0.7 / 1.3 **(-46%)** | 0.8 / 1.2 **(-33%)** | 5 / 5.0 | 0.75 / 0.75 (slow) | 1 | 18 / 18 | ground |  |
| Ice Spirit (icespirit) | 1 | 230 / 230 | 110 / 110 | 0.3 / 0.3 | 0.1 / 0.1 | 2.5 / 2.5 | 5.5 / 5.5 | 2.0 / 2.0 (very fast) | 1 | 1 / 1 | ground+air | proj IceSpiritsProjectile, splash 1.5 |
| Witch (witch) | 5 | 838 / 1341 **(-38%)** | 134 / 215 **(-38%)** | 1.1 / 1.1 | 0.5 / 0.4 **(+25%)** | 5.5 / 5.5 | 5.5 / 5.5 | 1.0 / 1.0 (medium) | 1 | 5 / 8 | ground+air | proj WitchProjectile, splash 1.0. Spawns 4 Skeletons. |
| Golem (golem) | 8 | 5120 / 8192 **(-38%)** | 312 / 499 **(-37%)** | 2.5 / 2.5 | 1.0 / 1.5 **(-33%)** | 0.8 / 0.75 **(+7%)** | 7 / 7.0 | 0.75 / 0.75 (slow) | **3** / 3 | 20 / 20 | buildings | Deploy time 3 s in snapshot, ours 1 s. Death: 2 Golemites. |
| Golemite (golemite) | not in deck | 1040 / 1664 **(-38%)** | 63 / 79 **(-20%)** | 2.5 / 2.5 | 1.0 / 1.5 **(-33%)** | 0.8 / 0.25 **(+220%)** | 7 / 7.0 | 0.75 / 0.75 (slow) | 1 | 6 / 6 | buildings | Range: snapshot 0.25 |
| Barbarian (barbarian) | 5 for 5 | 670 / 670 | 192 / 192 | 1.4 / 1.3 **(+8%)** | 0.6 / 0.9 **(-33%)** | 0.8 / 0.7 **(+14%)** | 5.5 / 5.5 | 1.0 / 1.0 (medium) | 1 | 5 / 4 | ground |  |
| Bat (bat) | 2 for 5 | 81 / 81 | 81 / 81 | 1.3 / 1.3 | 0.4 / 0.7 **(-43%)** | 1.2 / 1.2 | 5.5 / 5.5 | 2.0 / 2.0 (very fast) | 1 | 1 / 1 | ground+air |  |
| Royal Giant (royalgiant) | 6 | 3164 / 3072 | 307 / 307 | 1.7 / 1.7 | 0.8 / 0.8 | 5 / 5.0 | 7.5 / 7.5 | 0.75 / 0.75 (slow) | 1 | 18 / 18 | buildings | proj RoyalGiantProjectile. HP is within 3 percent. |

Notes on the units table:

- **Cost**: from `cards.js`. The snapshot `mana_cost` matches for every card checked (Knight 3, Archers 3, Giant 5, Musketeer 4, Golem 8, Witch 5). Golemite and Barbarian costs are not used by a card directly (they come from Golem and Barbarians).
- **Golem deploy**: the snapshot says 3 s. Our engine uses 1 s.
- **Bat cost and count**: the card is "Bats" at 2 elixir for 5 bats.
- **Musketeer**: our 720 HP and 217 damage match the Nov 2025 article [S]. The snapshot is older, so the difference is probably a real balance change, not an error. Keep ours, and mark the snapshot as stale for this card.

### 3.2 Buildings and towers at level 11

| Card (cards.js id) | Cost | HP ours / data | Damage ours / data | Hit s ours / data | Range ours / data | Lifetime s ours / data | Notes |
|---|---|---|---|---|---|---|---|
| Cannon (cannon) | 3 | 824 / 824 | 212 / 212 | 0.9 / 0.9 | 5.5 / 5.5 | 30 / 30 | Matches. Projectile TowerCannonball. |
| Inferno Tower (infernotower) | 5 | 1749 / 2112 **(-17%)** | 35 / 51 **(-31%)** | 0.4 / 0.4 | 6.0 / 6.0 | 30 / 30 | Ours looks like level 9 HP and level 7 damage. Ramp stages not in snapshot. |
| Tombstone (tombstone) | 3 | 534 / 640 **(-17%)** | not a direct damage | not a direct hit | n/a | 30 / 30 | HP snapshot 640 (ours 534). Spawn timing in snapshot looks wrong, so keep ours until checked. |
| Goblin Hut (goblinhut) | 5 | 1100 / 1024 **(+7%)** | not a direct damage | not a direct hit | n/a | 29 / 29 | HP snapshot 1024. Spawn stats in snapshot unclear. |
| King Tower (engine tower) | - | 4824 / 6144 **(-21%)** | 109 / 128 **(-15%)** | 1.0 / 1.0 | 7.0 / 7.0 | not applicable | See section 1.1. |
| Princess Tower (engine tower) | - | 3052 / 3584 **(-15%)** | 109 / 128 **(-15%)** | 0.8 / 0.8 | 7.5 / 7.5 | not applicable | See section 1.1. |

### 3.3 Spells at level 11

Spell damage is per impact. Ours is the value in `cards.js`. Data is the snapshot value at level 11.

Elixir costs in this table match the snapshot `mana_cost` for every card checked, including Zap (2), Poison (4), Freeze (4), Cannon (3), Musketeer (4), Witch (5), Golem (8).

| Card (cards.js id) | Cost | Damage ours / data | Tower damage ours / data | Radius ours / data | Other | Notes |
|---|---|---|---|---|---|---|
| Arrows (arrows) | 3 | 366 total / 122 per arrow (snapshot) **(unclear)** | 93 / 30% of 122 = 37 per arrow | 4 / 1.4 per arrow (snapshot) | Snapshot has the per-arrow hit, not the number of arrows | Our 366 equals 3 times 122. The snapshot does not give the number of arrows, so the total per cast is [R]. Verify in game. |
| Fireball (fireball) | 4 | 689 / 832 **(-17%)** | 207 / 30% of 832 = 250 **(-17%)** | 2.5 / 2.5 | Knockback 1.0 (ours) | Ours is the level 9 value (689 in snapshot). Snapshot level 11 is 832. |
| Zap (zap) | 2 | 192 / 192 | 58 / 30% of 192 = 58 | 2.5 / 2.5 | Stun 0.5 s (ours) | Matches. |
| Rocket (rocket) | 6 | 1484 / 1792 **(-17%)** | 445 / 25% of 1792 = 448 | 2.0 / 2.0 | Knockback 1.5 (ours) | Ours is the level 9 value (1484). Snapshot tower reduction is -75 percent (25 percent taken). Ours takes 30 percent. |
| The Log (log) | 2 | 290 / 614 **(-53%)** | 58 / 20% of 614 = 123 **(-53%)** | width 3.9 / radius 1.95 (width 3.9) | Length: ours 11.1, snapshot 10.1 | Ours is the level 3 damage (290). The snapshot has -80 percent tower reduction (20 percent taken). |
| Poison (poison) | 4 | 91 DPS (ours) / not in snapshot | 27 / not in snapshot | 3.5 / 3.5 | Duration 8 s, slow 15 percent (ours) | Radius matches. DPS and slow are [R]. |
| Freeze (freeze) | 4 | 115 / 184 **(-38%)** | 35 / 30% of 184 = 55 **(-36%)** | 3.0 / 3.0 | Freeze 4 s (ours) | Ours is a low level value (snapshot level 5 is 115). |
| Goblin Barrel (goblinbarrel) | 3 | 0 direct, spawns 3 Goblins / not in snapshot | 0 | 1.5 / 1.5 | Projectile speed 400 in snapshot | Radius matches. Spawn count not extracted; [R] for 3. |

Summary of spell mismatches: Fireball, Rocket, The Log, and Freeze are all below the snapshot level 11 damage by 17 to 53 percent. Zap matches exactly, and Arrows is unclear.

### 3.4 Corrected numbers for the flagged values

Every flagged value above has a corrected number from the snapshot. Each source link is in section 0.2. Summary of the corrections to make if the snapshot is taken as the reference:

- Giant: HP 4091 to 4940, damage 254 to 307, range 0.8 to 1.2 (edge or centre frame to be confirmed).
- Mini P.E.K.K.A: HP 1361 to 1643, damage 720 to 870, load 0.5 to 1.1.
- Baby Dragon: HP 1152 to 1843, damage 161 to 256, load 0.5 to 1.2, splash 1.5 to 1.2.
- Hog Rider: HP 1696 to 2048, damage 318 to 384, load 0.6 to 1.0, mass 8 to 4.
- Valkyrie: HP 1907 to 2304, damage 267 to 322, load 0.6 to 1.4, range 0.8 to 1.2, mass 8 to 5.
- Wizard: HP 755 to 870, damage 281 to 340, load 0.6 to 1.0.
- Prince: HP 1920 to 3072, damage 392 to 627, mass 15 to 6, charge range 2.5 to 3.0.
- Balloon: HP 1679 to 2688, damage 640 to 1024, load 1.0 to 1.8.
- P.E.K.K.A: HP 3760 to 6016, damage 816 to 1305, range 0.8 to 1.2.
- Witch: HP 838 to 1341, damage 134 to 215, load 0.5 to 0.4.
- Golem: HP 5120 to 8192, damage 312 to 499, load 1.0 to 1.5, deploy 1 s to 3 s.
- Golemite: HP 1040 to 1664, damage 63 to 79, range 0.8 to 0.25.
- Inferno Tower: HP 1749 to 2112, base damage 35 to 51 (ramp stages not in snapshot).
- Tower HP and damage: see section 1.1.
- Spells: Fireball 689 to 832, Rocket 1484 to 1792, The Log 290 to 614, Freeze 115 to 184.

Do not apply all of these blindly. The snapshot is from 2023 and some of our values (Musketeer and possibly others) reflect later balance. The mixed-level pattern below is the stronger reason to pick one level.

### 3.5 Our values come from mixed levels

Matching each of our HP and damage values to the snapshot level where it occurs:

| Level in snapshot | Cards whose HP or damage matches exactly |
|---|---|
| Level 11 | Knight, Archer, Goblin, Spear Goblin, Skeleton, Minion, Ice Spirit, Barbarian, Bat, Cannon |
| Level 9 | Giant (HP and damage), Mini P.E.K.K.A (HP and damage), Hog Rider (HP and damage), Musketeer (HP only; its shot is 218 at level 9, not 217), Valkyrie (damage), Wizard (damage, projectile), Inferno Tower (HP) |
| Level 6 | Prince (HP and damage), P.E.K.K.A (HP and damage), Golem (HP and damage), Witch (HP and damage, projectile), Balloon (damage), Baby Dragon (HP), Golemite (HP) |
| No match | Valkyrie HP, Wizard HP, Balloon HP, Bomber HP, Royal Giant HP, Goblin Hut HP, Tombstone HP, Musketeer damage (217 is not a snapshot value; the Nov 2025 article gives 217 at standard) |

So `cards.js` mixes levels 6, 9, and 11, and several values match no level. That is the single biggest source of inconsistency. Pick one level (the tournament standard) and regenerate every card from it.

---

## 4. Additional cards that would make the game feel like Clash Royale

Ranked by how iconic and how feasible for our engine. Stats are at level 11 from the snapshot [D] unless marked. Costs are from the snapshot `mana_cost`. Source links: [characters](https://github.com/RoyaleAPI/cr-api-data/blob/master/docs/json/cards_stats_characters.json), [troop cost](https://github.com/RoyaleAPI/cr-api-data/blob/master/docs/json/cards_stats_troop.json), [spell](https://github.com/RoyaleAPI/cr-api-data/blob/master/docs/json/cards_stats_spell.json).

| Rank | Card | Cost | Type | HP L11 | Damage L11 | Hit s | Range | Speed | Mechanic it needs | Feasibility |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Mega Knight | 7 | troop, legendary | 8448 | 568 | 1.7 | 1.2 | medium | Splash on attack (1.3 tile radius) and a dash (444 damage, up to 5.0 tiles) per snapshot. Deploy-time jump behaviour is [R]. | Medium. Needs a dash state and a splash on spawn. |
| 2 | Electro Wizard | 4 | troop, legendary | 1510 | 232 | 1.8 | 5.0 | fast (90) | Stuns on hit (chain of targets) and hits both ground and air. Needs a stun-reset on target change and a short chain. | Medium. |
| 3 | Miner | 3 | troop, legendary | 2560 | 409 | 1.2 | 1.2 | fast (90) | Deploys anywhere on the board (deploy in opponent's half), ground-only, does 75 percent less damage to towers (`crown_tower_damage_percent` -75) | Easy: deploy-anywhere flag and tower damage reduction. |
| 4 | Lava Hound | 7 | troop, legendary, air | 8064 | 115 | 1.3 | 3.5 | slow (45) | Air attacker, buildings only (snapshot). Spawns Lava Pups on death (spawn count not extracted). Needs buildings-only targeting and death spawn. | Easy: already have air, death spawn, buildings-only. |
| 5 | Ice Wizard | 3 | troop, legendary | 1456 | 192 | 1.7 | 5.5 | medium | Slow on hit (speed reduction), splash, both targets | Easy: slowAmount is already in the engine. |
| 6 | Lightning | 6 | spell, epic | n/a | 0 direct | n/a | 3.5 radius | n/a | Hits the three highest-HP targets in radius (not in snapshot as damage; per-target damage not extracted) | Medium: needs targeting by HP ranking. |
| 7 | Tornado | 3 | spell, epic | n/a | 0 | n/a | 5.5 radius | n/a | Pulls every ground unit in radius toward the centre for a period | Medium: needs a pull effect. |
| 8 | Earthquake | 3 | spell, rare | n/a | 0 | n/a | 3.5 radius | n/a | Damage over time to ground units and buildings, with building damage bonus | Easy: poison-like lingering area. |
| 9 | Graveyard | 5 | spell, legendary | n/a | n/a | n/a | 4.0 radius | n/a | Spawns Skeletons continuously for a duration at the target | Easy: spawner lingering area, like Poison plus spawn. |
| 10 | Electro Spirit | 1 | troop, common | 230 | 99 | 0.3 | 2.5 | very fast (120) | Kamikaze, stuns on hit (group) | Easy: existing kamikaze plus stun. |
| 11 | Fire Spirit | 1 | troop, common | 230 | 207 | 0.3 | 2.0 | very fast (120) | Kamikaze, splash | Easy: existing kamikaze. |
| 12 | Dark Prince | 4 | troop, epic | 1920 | 396 | 1.3 | 1.2 | medium | Splash (1.1 tile radius) and a charge (x2 after 0.35 tiles) per snapshot. Shield is [R]. | Medium: splash and shield. |
| 13 | Battle Ram | 4 | troop, rare | 1167 | 345 | 0.4 | 0.5 | medium | Building-targeting, charge (x2 after 0.3 tiles), spawns Barbarian on death | Medium. |
| 14 | Royal Hogs | 5 | troop, rare | n/a in snapshot | n/a | n/a | n/a | n/a | Four Hogs, spawner-like group | Easy if Hog Rider exists (count 4). Stats not extracted. |
| 15 | X-Bow | 6 | building, epic | not in snapshot | n/a | n/a | n/a | n/a | Long-range building that charges then fires projectiles at lowest-HP target | Medium: needs a windup and HP-ranked targeting. Not in snapshot. |

Notes:

- **Princess**: cost 3, 552 HP, range 9.0, sight 9.5, splash radius 2.5, all from the snapshot. Damage was not extracted. It is a long-range splash hitter that suits the bot's back-line role. Musketeer evolutions are out of scope.
- **Not in snapshot**: Bandit, Sparky, Lumberjack, Magic Archer, Elite Barbarians, Executioner, Furnace, X-Bow (as a stat row), Firecracker stats. Use a current source before adding.
- **Scope note**: Champions and evolutions are out of scope for this clone. Note only.

---

## 5. Gap analysis

Ordered by impact on gameplay feel. Difficulty: Easy (under a day), Medium (a few days), Hard (a week or more).

1. **Mixed stat levels across cards.** What we do: `cards.js` values come from levels 6, 9, and 11, and some match no level. What CR does: all cards at one tournament level. Fix: pick one level and regenerate every unit, building, and spell from one source table. Difficulty: Easy (data work) but needs verification.

2. **Tower HP and damage.** What we do: King 4824 HP, Princess 3052 HP, both 109 damage. What CR does (snapshot, level 11): King 6144, Princess 3584, both 128. The Princess numbers match the Tower Princess troop card, not the building. Fix: decide the tower level, set both from one source, verify in game. Difficulty: Easy.

3. **Golem deploy time.** What we do: 1 s for every card. What CR does: 3 s for Golem [D]. Fix: per-unit `deployTime`, Golem 3.0, and render the longer deploy animation. Difficulty: Easy.

4. **HP and damage on Prince, Golem, P.E.K.K.A, Giant, Hog Rider, Valkyrie, Wizard, Balloon, Witch, Baby Dragon.** What we do: values from levels 6 to 9 (see section 3.5). What CR does: snapshot level 11 values 13 to 38 percent higher. Fix: regenerate from the snapshot once the level is chosen. Difficulty: Easy once item 1 is done.

5. **Melee ranges.** What we do: 0.8 for Knight, Giant, P.E.K.K.A and Valkyrie. What CR does: snapshot 1.2 for these. Barbarian is the opposite (ours 0.8, snapshot 0.7). Range frame (centre or edge) is not known. Fix: measure in game, then set edge-to-edge values. Difficulty: Easy to measure, Easy to apply.

6. **Prince charge.** What we do: charge distance 2.5 tiles, mass 15, charge speed 2.0. What CR does: charge range 3.0 tiles, mass 6, charge doubles speed (x2 of medium = 2.0, which matches). Fix: charge dist 3.0; set mass to snapshot 6. Note: mass 15 also controls knockback eligibility, so changing mass changes whether Prince gets knocked back. Difficulty: Easy.

7. **The Log.** What we do: 290 damage, length 11.1 tiles. What CR does (snapshot level 11): 614 damage, length 10.1 tiles, tower damage -80 percent. Fix: set damage to the chosen level, length 10.1, tower damage 20 percent of that. Difficulty: Easy.

8. **Fireball, Rocket, Freeze damage.** What we do: 689, 1484, 115. What CR does (snapshot level 11): 832, 1792, 184. Fix: set from the snapshot once the level is chosen. Difficulty: Easy.

9. **Crown tower damage on Rocket.** What we do: 30 percent (445 of 1484). What CR does: 25 percent (snapshot -75). Fix: towerDamage = 0.25 x damage. Difficulty: Easy.

10. **Arrows model.** What we do: a single 366 damage spell with 4 tile radius. What CR does: per-arrow 122 damage, 1.4 tile arrow scatter, and an unknown number of arrows per cast. Fix: model arrows as N projectiles, each with splash; verify the cast total in game first. Difficulty: Medium.

11. **Lightning, Tornado, Earthquake, Graveyard, Rage, Electro Wizard stun-chain.** What we do: none exist. What CR does: each a distinct behaviour listed in section 4. Fix: add the cards in the order of section 4. Difficulty: Medium each.

12. **Mega Knight dash and spawn splash, Battle Ram and Ram jump behaviour.** What we do: none. What CR does: dash state and spawn damage. Fix: a "dash" state that moves toward a target and resolves splash on landing. Difficulty: Medium.

13. **Deploy-anywhere units (Miner).** What we do: troops and buildings only from own half plus pocket. What CR does: Miner and similar deploy in the enemy half. Fix: a per-card `deployAnywhere` flag that skips the zone check. Difficulty: Easy.

14. **Inferno Tower ramp.** What we do: 35, 127, 422 per stage, 2 s per stage. What CR does: snapshot base damage 51 at level 11 with stage multipliers not in snapshot. Fix: verify stage values, set base to snapshot. Difficulty: Easy after verification.

15. **Retargeting while attacking.** What we do: a locked unit keeps its target until it leaves range plus 0.5 tiles. What CR does: [R] some units switch to a closer target. Fix: test in game, then add a switch rule if needed. Difficulty: Medium.

16. **Kiting.** What we do: units walk straight to their target and stop in range. What CR does: [R] ranged units step back out of melee. Fix: a simple "keep distance" state for ranged units with a retreat speed. Difficulty: Medium.

17. **Splash radius for Baby Dragon.** What we do: 1.5. What CR does: 1.2 (snapshot projectile radius). Fix: change to 1.2. Difficulty: Easy.

18. **Golem death.** What we do: 312 damage in 2 tile radius, spawns 2 Golemites. What CR does: snapshot death damage 140, radius 2.0, 2 Golemites. The death damage field is not per level in the snapshot, so the level basis is unknown. Fix: verify in game. Difficulty: Easy.

19. **Death and spawn timing.** What we do: Tombstone and Goblin Hut spawn values as in cards.js. What CR does: the snapshot values look wrong for Tombstone and Goblin Hut spawn timing. Fix: verify in game. Difficulty: Easy.

20. **Knockback eligibility by mass.** What we do: knockback is skipped for mass 15 or more, so Prince (mass 15) cannot be knocked back. What CR does: [R] heavy units resist knockback without a fixed mass cutoff. Fix: set a per-unit "knockback resist" flag rather than mass. Difficulty: Easy.

21. **Deploy animation and unit facing.** What we do: `deployT` counts down, `facing` stored in the engine. What CR does: [R] a spawn animation, then the unit faces its target. Fix: renderer should use `deployT` for a fade or grow effect and `facing` for sprite direction. Difficulty: Medium (render side).

22. **Hit pause, damage flash, knockback visuals.** What we do: `effects` array with `hit`, `splash`, `death`. What CR does: [R] a short hit flash on the unit and a small freeze-frame on big hits. Fix: add a `flash` timer on entities and a 0.05 to 0.1 s render hold on high-damage hits (renderer only, engine untouched). Difficulty: Easy.

23. **King Tower activation animation.** What we do: `kingActivate` event and `activateKing`. What CR does: [R] a visible crown and a short animation when the King wakes up. Fix: renderer draws the King with an inactive style and plays a short animation on `kingActivate`. Difficulty: Easy.

24. **Overtime banner and timer.** What we do: `phase` and `timeLeft` are in the engine. What CR does: [R] a visible "Overtime" banner, and the double elixir announcement at the minute mark. Fix: render banner on `phase` change, announce "Double Elixir" at 60 s. Difficulty: Easy.

25. **Last-10-seconds countdown.** What we do: timer shows seconds. What CR does: [R] a more prominent countdown in the final 10 seconds. Fix: render change only. Difficulty: Easy.

26. **Emotes and crown animations.** What we do: not implemented. What CR does: [R] emotes and crown pop-ups. Out of scope for a single-player clone unless wanted. Difficulty: Medium.

27. **Elixir leak handling for the bot.** What we do: `leakFix` plays a cheap troop at 9.5 elixir. What CR does: [R] good players spend at 9 to 10 elixir but do not leak for long. Covered in section 6.

28. **Card visual feedback on elixir spend.** What we do: `elixir` effect shows `-N` text. What CR does: the same, [R]. No change needed.

29. **Evolutions and champions.** Out of scope.

30. **Overtime tie draw.** What we do: draw when both lowest-HP towers are equal. What CR does: [S] fan summary says draw. Confirm in game. Difficulty: Easy.

---

## 6. AI opponent behaviour

### 6.1 How strong players play, as concrete rules

These are general strategy rules. They are [R] unless marked. Use them as bot rules, not as facts about the engine.

1. **Defend at the right distance.** Place a defender in front of the Princess Tower so it engages the attacker before the attacker reaches the tower. Ranged defenders sit just behind the tower. Melee defenders sit a few tiles in front.
2. **Count the enemy elixir.** Track the opponent's played cards and estimate their current elixir. A push needs more elixir than the opponent can answer.
3. **Cycle.** Keep the cycle moving: play cheap cards when elixir is low, play a big card when elixir is near 10. Do not hold elixir at 10.
4. **Spell value threshold.** Spend a spell only if it kills or nearly kills the enemy group, or saves a tower. Use a value check: total damage divided by enemy total HP, compared to the spell's cost.
5. **Bait.** Play a cheap card (Goblins, Skeletons, Spear Goblins) to force the opponent's spell or key troop before the real push.
6. **Counter-push.** When the enemy's push is answered and their elixir is low, drop a tank or win condition on their side immediately.
7. **4-3 play.** Place a defender that can handle a push alone (a 4-elixir card such as Musketeer) and a 3-elixir support card in the same lane.
8. **Pig push (Hog Rider cycle).** Hog Rider plus a spell (Fireball or Zap) to clear defenders, timed so the Hog arrives when the tower is open.
9. **Lane choice.** Push the lane whose Princess Tower is already down (it opens the pocket and removes one defence). If both are up, push the lane with fewer defenders.
10. **Pocket placement.** Once a Princess Tower is down, place units inside the pocket, not behind it, so they reach the tower first.
11. **Tank plus support.** A tank (Giant, Golem, P.E.K.K.A) pushes first, support (Musketeer, Wizard, Baby Dragon) follows 2 tiles behind.
12. **Overtime and tiebreaker awareness.** In overtime, keep one tower healthy and avoid taking damage on the other, because a lower-HP tower loses the tiebreak. Look for any crown.
13. **Reaction time.** A human reacts to a threat in roughly 0.3 to 1.0 s. A bot should wait a random delay in that range before responding, otherwise it is unrealistically sharp.

### 6.2 Tunable parameters for a configurable bot

Mapping to our existing `DIFF` table in `js/ai.js` is in the last column. "Range" is a sensible span for each difficulty tier.

| Parameter | Meaning | Sensible range | Our current (easy / normal / hard) |
|---|---|---|---|
| `reactMin`, `reactMax` | Seconds before responding to a threat | 0.2 to 2.0 | react `[1.2, 2.0]` / `[0.6, 1.1]` / `[0.25, 0.5]` |
| `gapMin`, `gapMax` | Seconds between plays | 0.7 to 3.0 | gap `[1.8, 2.6]` / `[1.1, 1.6]` / `[0.7, 1.0]` |
| `thinkInterval` | Seconds between decisions | 0.1 to 0.5 | `THINK` 0.25 |
| `aggression` | Probability of starting a push when elixir allows | 0.0 to 1.0 | not present; implied by `pushAt` |
| `pushAt` | Elixir at which the bot starts a push | 5 to 10 | 9 / 8 / 8 |
| `elixirLeakMax` | Elixir above which the bot plays a card to avoid leaking | 9 to 10 | 9.5 |
| `leakChance` | Chance to skip the leak fix | 0 to 0.5 | `leak` 0.5 / 0 / 0 |
| `errChance` | Chance to pick the second-best option | 0 to 0.3 | 0.3 / 0.05 / 0 |
| `costBias` | Penalty per elixir spent when scoring a counter | 0 to 0.3 | 0.04 / 0.1 / 0.1 |
| `spellBias` | Multiplier on a spell's cost before it is worth casting | 1.0 to 2.0 | 1.5 / 1.15 / 1.0 |
| `spellValueMin` | Absolute value threshold for a spell | 2 to 6 | implied by `spellBias` |
| `cycleSpeed` | Target number of cards per 10 s | 3 to 6 | not present |
| `laneBias` | Preference for the lane with a downed Princess (0 to 1) | 0 to 1 | not present; `pickLane` is random plus score |
| `placementJitter` | Random offset in tiles added to every drop | 0 to 1.5 | `jitter` 1.0 / 0.4 / 0.15 |
| `placementBackOffset` | Distance behind the Princess Tower for ranged defenders | 2 to 5 | `BACK_FY` 4.5 |
| `placementFrontOffset` | Distance in front of the Princess Tower for melee defenders | 7 to 10 | `FRONT_FY` 9.5 |
| `pushDuration` | Seconds a push may run before it is abandoned | 20 to 60 | 45 |
| `counterPush` | Whether the bot counter-pushes on a cleared threat | bool | `false` / `false` / `true` |
| `baitChance` | Chance to play a cheap bait card before a push | 0 to 0.5 | not present |
| `tankFirst` | Whether a tank must be on the field before support is played | bool | implied by `isHeavy` check |
| `overtimeCaution` | Extra elixir kept in overtime for defence | 0 to 2 | not present |

Suggested tiers: easy uses wide reaction and gap ranges, high leak and error chance, no counter-push, and low spell bias. Hard uses tight ranges, no error, counter-push on, and spell bias at 1.0 or below.

### 6.3 Gaps between our bot and these rules

- **Bait** is not implemented.
- **Cycle speed** is not explicit; the bot plays whenever `opt` is non-null, which can cause it to over-spend early or hold too long.
- **Overtime caution** is not implemented.
- **Lane choice** is random plus a princess-HP score; it does not prefer the open pocket strongly.
- **Counter-push** is limited to hard difficulty and a timer window.
- **Spell valuation** uses a value per unit based on HP and cost, which is a reasonable start but ignores tower damage from the spell.

---

## 7. Items to verify before the next development round

These are the blocked or uncertain items. Each needs a source that the fetch tool can read, or an in-game test.

1. Tower HP and damage at tournament standard (section 1.1).
2. Musketeer current stats (Nov 2025 rework; ours matches the summary, but the snapshot does not).
3. Arena dimensions, river depth, bridge width, and pocket depth.
4. Melee range frame (centre or edge) and the real melee values.
5. Inferno Tower ramp stages and timings.
6. Arrows arrow count per cast and per-arrow damage.
7. Tombstone and Goblin Hut spawn timing and counts.
8. Golem death damage at level 11.
9. Overtime tie result (draw or otherwise).
10. Stun, slow, and freeze durations.
11. Stats for cards not in the snapshot: Bandit, Sparky, Lumberjack, Magic Archer, Elite Barbarians, X-Bow, Executioner, Furnace, Firecracker.
