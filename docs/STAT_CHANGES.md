# Stat changes

Source: RoyaleAPI cr-api-data, `docs/json/cards_stats_*.json` on master, fetched 2026-10-11.

Level basis: the data stores per-level arrays per rarity. Index 0 is the first level for that rarity:
Common L1, Rare L3, Epic L6, Legendary L9. Level 11 is therefore index 10 (Common), 8 (Rare), 5 (Epic), 2 (Legendary). Every array ends at level 19, which confirms the offset.

Rule: a value changes only when it differs from the level 11 value by more than 5 percent.

| Card | Field | Old | New | Source |
| --- | --- | --- | --- | --- |
| Knight | range | 0.8 | 1.2 | characters `range` 1200 |
| Giant | range | 0.8 | 1.2 | characters `range` 1200 |
| Mini P.E.K.K.A | loadTime | 0.5 | 1.1 | `load_time` 1100 |
| Goblin | loadTime | 0.4 | 0.7 | `load_time` 700 |
| Spear Goblin | loadTime | 0.5 | 1.2 | `load_time` 1200 |
| Spear Goblin | range | 5 | 5.5 | `range` 5500 |
| Spear Goblin | mass | 2 | 1 | `mass` 1 |
| Baby Dragon | loadTime | 0.5 | 1.2 | `load_time` 1200 |
| Hog Rider | loadTime | 0.6 | 1.0 | `load_time` 1000 |
| Hog Rider | mass | 8 | 4 | `mass` 4 |
| Valkyrie | loadTime | 0.6 | 1.4 | `load_time` 1400 |
| Valkyrie | range | 0.8 | 1.2 | `range` 1200 |
| Valkyrie | mass | 8 | 5 | `mass` 5 |
| Wizard | loadTime | 0.6 | 1.0 | `load_time` 1000 |
| Minion | damage | 107 | 117 | projectile MinionSpit, Common L11 |
| Prince | mass | 15 | 6 | `mass` 6 |
| Prince | charge dist | 2.5 | 3.0 | `charge_range` 300 (see note 2) |
| Balloon | loadTime | 1.0 | 1.8 | `load_time` 1800 |
| Balloon | mass | 9 | 6 | `mass` 6 |
| Bomber | hp | 304 | 332 | Common L11 |
| Bomber | loadTime | 0.6 | 1.6 | `load_time` 1600 |
| Bomber | mass | 3 | 4 | `mass` 4 |
| P.E.K.K.A | loadTime | 0.7 | 1.3 | `load_time` 1300 |
| P.E.K.K.A | range | 0.8 | 1.2 | `range` 1200 |
| Witch | loadTime | 0.5 | 0.4 | `load_time` 400 |
| Witch | mass | 5 | 8 | `mass` 8 |
| Golem | loadTime | 1.0 | 1.5 | `load_time` 1500 |
| Golem | range | 0.8 | 0.75 | `range` 750 |
| Golem | deployTime | 1.0 | 3.0 | `deploy_time` 3000 |
| Golemite | damage | 63 | 49 | Epic L11 |
| Golemite | loadTime | 1.0 | 1.5 | `load_time` 1500 |
| Golemite | range | 0.8 | 0.25 | `range` 250 |
| Barbarian | hitSpeed | 1.4 | 1.3 | `hit_speed` 1300 |
| Barbarian | loadTime | 0.6 | 0.9 | `load_time` 900 |
| Barbarian | range | 0.8 | 0.7 | `range` 700 |
| Barbarian | mass | 5 | 4 | `mass` 4 |
| Bat | loadTime | 0.4 | 0.7 | `load_time` 700 |
| Goblin Hut | hp | 1100 | 848 | Rare L11 (rarity Rare, index 8) |
| Inferno Tower | damage and ramp stage 0 | 35 | 42 | Rare L11 `damage_per_level` |
| Arrows | towerDamage | 93 | 110 | 30 percent of 366 (`crown_tower_damage_percent` -70) |
| Rocket | towerDamage | 445 | 371 | 25 percent of 1484 (`crown_tower_damage_percent` -75) |
| The Log | length | 11.1 | 10.1 | `projectile_range` 10100 |
| Poison | dps | 91 | 57 | buff `damage_per_second` 57 (see note 4) |
| Poison | towerDps | 27 | 17 | 30 percent of 57 (buff `crown_tower_damage_percent` -70) |
| All units | deployTime | (implicit 1.0) | explicit 1.0, Golem 3.0 | `deploy_time` |

Verified unchanged at level 11: Knight HP and damage, Giant, Archer, Musketeer (kept per instruction), Prince HP and damage, Golem HP and damage, Fireball 689 and 207, Zap 192 and 58, Freeze 115, Log damage 290 and 58, Electro Wizard zap 192 (new card).

## Not changed, and why

1. **Crown towers** (Princess 3052 HP, King 4824 HP, 109 damage). The building data at the level 11 offset gives 3584, 6144 and 128 (PrincessTower and KingTower, Common, index 10). That disagrees with us, but our current 3052, 4824 and 109 do not appear anywhere on the same curve either, so the data does not settle which tower level is standard. Kept per instruction. Needs an in-game check or a decision.
2. **Prince charge distance.** The raw field is 300. Read as 1/1000 tiles that is 0.3 tiles, which cannot be a charge distance. Read as 1/100 tiles it is 3.0, matching the research doc. Applied as 3.0 on that assumption. Dark Prince's `charge_range` 350 would follow the same scale (3.5), though the research doc gives it as 0.35.
3. **Prince charge multiplier.** The raw `damage_special` is 490, which is 1.25 times the level 11 damage of 392, not 2 times. Kept at 2 (784 per charge hit, test 12a). Needs verification.
4. **Poison dps.** `damage_per_second` 57 is in the buff data and has no per-level array, so no level offset was applied. Taken as-is. Unverified.
5. **Collision radius (`r`).** The raw `collision_radius` is 500 for most units, which looks like a default rather than per-unit data. Not changed.
6. **Musketeer.** Kept, per instruction. Raw load time is 200 ms (ours 0.5). Raw damage at L11 is 218 (ours 217, within 1 percent).
7. **Within 5 percent:** Wizard HP (755 vs 720, 4.9 percent), Royal Giant HP (3164 vs 3072, 3 percent), Valkyrie HP.

## Ranges

Ranged units match the raw `range` field exactly (Archer 5, Musketeer 6, Wizard 5.5, Spear Goblin now 5.5). The raw field is therefore in the same frame as ours, so melee values were taken from it directly.
