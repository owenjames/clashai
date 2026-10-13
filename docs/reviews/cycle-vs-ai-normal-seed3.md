# Review: BOT (cycle) vs AI (normal), seed 3

Generated 2026-10-13 05:05 UTC. Match length 03:42.5. Game seed 3, bot seed from config. Snapshot b6be1285b0 (engine, cards, AI, bot).

## Result

AI wins by crowns (crowns 0-1).

| Side | Crowns | Tower dmg dealt | Leak s (at 10) | Cards | Elixir spent | Distinct cards |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| BOT | 0 | 0 | 0 | 70 | 121 | 7 |
| AI | 1 | 3159 | 0 | 32 | 115 | 6 |

Bot decisions: cycle 2, lead 1, defend 57, defend spell zap 8, tank 1, support 1.

Bot counters: defenses 65, kites 0, pushes 2, spells 8 (value hit 46.6 of 37.0 estimated), forced plays 0, idle cycle plays 2, baits 0, supports 1.

## Findings

### Elixir

None.

### Pushes and defence

- [01:37.0] BOT left princess tower took 107 damage with no defender within 6 tiles (one hit). AI attackers in range: Archers. BOT had 1.7 elixir and played 2 card(s) in the 8 s before.
- [02:02.8] BOT right princess tower took 434 damage with no defender within 6 tiles (until 02:03.8). AI attackers in range: Musketeer. BOT had 0.9 elixir and played 2 card(s) in the 8 s before.
- [03:36.3] BOT right princess tower took 508 damage with no defender within 6 tiles (until 03:37.8). AI attackers in range: Giant, Musketeer. BOT had 0.6 elixir and played 4 card(s) in the 8 s before.
- BOT lost 39 troop(s) in the enemy half without reaching a tower (Skeletons x14, Goblins x9, Hog Rider x1, Bats x14, Knight x1).
- AI lost 9 troop(s) in the enemy half without reaching a tower (Mini P.E.K.K.A x3, Knight x2, Giant x2, Archers x2).

### Spells

- BOT spells: 8 hit, 0 missed (checked at impact, logs and barrels not counted).
- AI spells: 3 hit, 0 missed (checked at impact, logs and barrels not counted).

### Units and tactics

- BOT sent 2 troop(s) into an enemy tower with no friendly troop within 3 tiles. Examples: Goblins at 01:22.7 into left princess tower; Hog Rider at 01:29.7 into right princess tower.
- AI sent 7 troop(s) into an enemy tower with no friendly troop within 3 tiles. Examples: Giant at 00:26.0 into right princess tower; Giant at 01:14.1 into left princess tower; Archers at 01:35.4 into left princess tower; Musketeer at 02:01.0 into right princess tower.
- BOT 2 troop(s) had a target out of range and did not move (under 0.25 tiles/s). Examples: Knight at 02:11.8 (4.5, 20.6); Goblins at 03:02.1 (13.9, 19.4).
- Match went to overtime (started 03:00.0, ended 03:42.5, reason crowns).

### Cards

- BOT never played: Fireball (of its 8-card deck; played 7 distinct cards, 70 plays).
- AI never played: Electro Wizard, Fireball (of its 8-card deck; played 6 distinct cards, 32 plays).

### Engine

None.

## Gameplay log

Game clock, one state line every 5 s, then plays and key events. "AI" is the computer opponent, "OPP" a bot opponent.

```
[00:00.0] match start: BOT is team 0, AI is team 1. Opponent ai:normal, bot bot:cycle.
[00:00.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 4.0, AI 5.0 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 3/0
[00:00.0] BOT plays Skeletons at (3.6, 22.3) for 1 (cycle)
[00:03.0] BOT plays Goblins at (14.1, 22.6) for 2 (cycle)
[00:05.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 3.8, AI 6.8 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 6/0
[00:07.3] AI plays Archers at (14.7, 4.2) for 3
[00:08.5] BOT plays Ice Spirit at (14.9, 18.7) for 1 (lead lane 1)
[00:08.5] AI plays Giant at (15.4, 12.2) for 5
[00:09.5] BOT plays Hog Rider at (14.8, 22.7) for 4 (defend lane 1)
[00:10.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 0.6, AI 0.6 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 4/3
[00:14.0] BOT plays Bats at (14.8, 22.4) for 2 (defend lane 1)
[00:15.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 0.4, AI 2.4 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 6/3
[00:17.0] BOT plays Skeletons at (14.9, 22.2) for 1 (defend lane 1)
[00:18.0] AI plays Zap at (14.7, 17.1) for 2
[00:20.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.1, AI 2.1 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 3/3
[00:22.5] BOT plays Goblins at (14.5, 22.1) for 2 (defend lane 1)
[00:25.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 0.9, AI 3.9 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 5/3
[00:25.3] BOT plays Ice Spirit at (14.8, 27.7) for 1 (defend lane 1)
[00:30.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.7, AI 5.7 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 1/2
[00:33.3] BOT plays Zap at (14.5, 16.7) for 2 (defend spell zap)
[00:35.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.5, AI 7.5 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 0/0
[00:36.5] AI plays Mini P.E.K.K.A at (13.9, 12.9) for 4
[00:37.8] BOT plays Bats at (14.7, 22.4) for 2 (defend lane 1)
[00:39.3] BOT plays Skeletons at (14.4, 22.3) for 1 (defend lane 1)
[00:40.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 0.3, AI 5.3 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 8/1
[00:45.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 2.1, AI 7.1 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 7/0
[00:47.8] AI plays Musketeer at (13.7, 13.6) for 4
[00:48.8] BOT plays Goblins at (14.4, 22.3) for 2 (defend lane 1)
[00:49.8] BOT plays Ice Spirit at (14.8, 27.6) for 1 (defend lane 1)
[00:50.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 0.9, AI 4.9 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 4/1
[00:55.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 2.7, AI 6.7 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 1/1
[00:56.0] BOT plays Knight at (14.2, 22.6) for 3 (defend lane 1)
[01:00.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.4, AI 8.4 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 1/1
[01:00.3] AI plays Knight at (13.7, 9.8) for 3
[01:01.5] AI plays Giant at (3.0, 13.5) for 5
[01:01.8] BOT plays Bats at (14.5, 22.6) for 2 (defend lane 1)
[01:04.5] BOT plays Skeletons at (3.8, 22.6) for 1 (defend lane 0)
[01:05.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 0.2, AI 2.2 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 9/2
[01:10.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 0.0, AI 4.0 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 8/2
[01:10.0] BOT plays Goblins at (3.3, 22.6) for 2 (defend lane 0)
[01:15.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.8, AI 5.8 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 8/1
[01:18.0] AI plays Archers at (3.1, 4.9) for 3
[01:20.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 3.6, AI 4.6 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 4/2
[01:24.0] BOT plays Hog Rider at (14.1, 18.8) for 4 (tank lane 1)
[01:25.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.4, AI 6.4 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 1/2
[01:25.5] AI plays Mini P.E.K.K.A at (15.3, 10.2) for 4
[01:27.0] BOT plays Ice Spirit at (14.6, 21.4) for 1 (support lane 1)
[01:29.8] BOT plays Bats at (14.7, 22.5) for 2 (defend lane 1)
[01:30.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 0.2, AI 4.2 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 7/3
[01:32.5] BOT plays Skeletons at (14.6, 22.9) for 1 (defend lane 1)
[01:35.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 0.9, AI 5.9 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 7/2
[01:36.3] AI plays Zap at (14.6, 17.4) for 2
[01:38.0] BOT plays Zap at (14.5, 19.9) for 2 (defend spell zap)
[01:40.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 0.7, AI 5.7 | towers BOT [L 2945, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 0/0
[01:45.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 2.5, AI 7.5 | towers BOT [L 2945, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 0/0
[01:46.5] AI plays Musketeer at (14.7, 13.5) for 4
[01:47.5] BOT plays Goblins at (14.3, 22.8) for 2 (defend lane 1)
[01:48.5] BOT plays Ice Spirit at (14.6, 27.7) for 1 (defend lane 1)
[01:50.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.3, AI 5.3 | towers BOT [L 2945, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 3/1
[01:52.0] BOT plays Bats at (14.6, 22.3) for 2 (defend lane 1)
[01:55.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 0.1, AI 2.1 | towers BOT [L 2945, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 5/2
[01:55.0] BOT plays Skeletons at (14.4, 22.2) for 1 (defend lane 1)
[01:55.0] AI plays Giant at (4.3, 12.3) for 5
[02:00.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 1.9, AI 3.9 | towers BOT [L 2945, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 0/2
[02:01.8] BOT plays Knight at (3.8, 22.7) for 3 (defend lane 0)
[02:03.0] AI plays Archers at (3.3, 10.1) for 3
[02:04.5] BOT plays Goblins at (3.3, 22.5) for 2 (defend lane 0)
[02:05.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 0.5, AI 4.5 | towers BOT [L 2945, R 2618, K 4824] AI [L 3052, R 3052, K 4824] | units 4/3
[02:06.0] BOT plays Ice Spirit at (3.6, 27.3) for 1 (defend lane 0)
[02:10.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 3.0, AI 4.0 | towers BOT [L 2945, R 2618, K 4824] AI [L 3052, R 3052, K 4824] | units 4/4
[02:10.0] AI plays Mini P.E.K.K.A at (3.4, 13.6) for 4
[02:11.0] BOT plays Zap at (3.4, 21.8) for 2 (defend spell zap)
[02:12.0] BOT plays Skeletons at (3.4, 22.5) for 1 (defend lane 0)
[02:13.0] BOT plays Bats at (3.7, 22.5) for 2 (defend lane 0)
[02:14.0] AI plays Knight at (3.2, 9.5) for 3
[02:15.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 1.6, AI 4.6 | towers BOT [L 2945, R 2618, K 4824] AI [L 3052, R 3052, K 4824] | units 11/3
[02:17.5] BOT plays Goblins at (3.4, 22.6) for 2 (defend lane 0)
[02:19.8] BOT plays Ice Spirit at (3.4, 27.6) for 1 (defend lane 0)
[02:20.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 2.2, AI 8.2 | towers BOT [L 2945, R 2618, K 4824] AI [L 3052, R 3052, K 4824] | units 11/1
[02:21.5] AI plays Zap at (3.4, 15.9) for 2
[02:22.5] BOT plays Knight at (3.5, 22.8) for 3 (defend lane 0)
[02:22.8] AI plays Giant at (14.5, 12.5) for 5
[02:23.8] BOT plays Skeletons at (14.6, 22.5) for 1 (defend lane 1)
[02:25.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 1.7, AI 4.7 | towers BOT [L 2945, R 2618, K 4824] AI [L 3052, R 3052, K 4824] | units 5/2
[02:25.5] BOT plays Bats at (14.6, 22.6) for 2 (defend lane 1)
[02:27.3] AI plays Archers at (3.0, 4.8) for 3
[02:28.3] BOT plays Goblins at (14.8, 22.3) for 2 (defend lane 1)
[02:29.8] AI plays Musketeer at (14.1, 4.8) for 4
[02:30.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 1.3, AI 1.3 | towers BOT [L 2945, R 2618, K 4824] AI [L 3052, R 3052, K 4824] | units 12/5
[02:32.5] AI plays Knight at (15.0, 9.7) for 3
[02:35.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 4.9, AI 1.9 | towers BOT [L 2945, R 2618, K 4824] AI [L 3052, R 3052, K 4824] | units 12/4
[02:36.0] BOT plays Ice Spirit at (14.7, 27.7) for 1 (defend lane 1)
[02:37.0] BOT plays Knight at (14.6, 22.8) for 3 (defend lane 1)
[02:39.3] BOT plays Skeletons at (3.1, 22.4) for 1 (defend lane 0)
[02:40.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 3.5, AI 5.5 | towers BOT [L 2945, R 2618, K 4824] AI [L 3052, R 3052, K 4824] | units 8/4
[02:40.3] BOT plays Bats at (3.3, 22.4) for 2 (defend lane 0)
[02:41.0] BOT plays Goblins at (3.3, 22.6) for 2 (defend lane 0)
[02:44.3] AI plays Mini P.E.K.K.A at (13.6, 13.1) for 4
[02:44.8] BOT plays Zap at (14.1, 14.0) for 2 (defend spell zap)
[02:45.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 1.0, AI 5.0 | towers BOT [L 2945, R 2618, K 4824] AI [L 3052, R 3052, K 4824] | units 7/4
[02:45.5] BOT plays Ice Spirit at (14.3, 27.1) for 1 (defend lane 1)
[02:46.5] BOT plays Skeletons at (14.9, 22.5) for 1 (defend lane 1)
[02:49.0] AI plays Giant at (13.7, 13.5) for 5
[02:49.3] BOT plays Bats at (14.5, 22.6) for 2 (defend lane 1)
[02:50.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 0.6, AI 3.6 | towers BOT [L 2945, R 2618, K 4824] AI [L 3052, R 3052, K 4824] | units 9/5
[02:52.0] BOT plays Goblins at (14.2, 22.2) for 2 (defend lane 1)
[02:53.5] AI plays Archers at (14.8, 11.0) for 3
[02:55.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 2.2, AI 4.2 | towers BOT [L 2945, R 2618, K 4824] AI [L 3052, R 3052, K 4824] | units 6/4
[02:56.3] BOT plays Knight at (14.4, 22.6) for 3 (defend lane 1)
[02:57.8] BOT plays Ice Spirit at (14.5, 27.2) for 1 (defend lane 1)
[02:59.0] BOT plays Skeletons at (14.5, 22.4) for 1 (defend lane 1)
[03:00.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 0.7, AI 7.7 | towers BOT [L 2945, R 2618, K 4824] AI [L 3052, R 3052, K 4824] | units 7/4
[03:00.0] overtime starts (sudden death)
[03:00.5] AI plays Musketeer at (14.8, 13.7) for 4
[03:02.0] BOT plays Zap at (14.5, 14.3) for 2 (defend spell zap)
[03:04.8] BOT plays Goblins at (14.8, 22.3) for 2 (defend lane 1)
[03:05.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 0.3, AI 7.3 | towers BOT [L 2945, R 2618, K 4824] AI [L 3052, R 3052, K 4824] | units 5/4
[03:06.8] AI plays Knight at (15.2, 13.3) for 3
[03:07.5] BOT plays Bats at (14.1, 22.2) for 2 (defend lane 1)
[03:09.0] BOT plays Ice Spirit at (14.8, 27.2) for 1 (defend lane 1)
[03:10.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 0.9, AI 7.9 | towers BOT [L 2945, R 2618, K 4824] AI [L 3052, R 3052, K 4824] | units 6/5
[03:10.3] BOT plays Skeletons at (14.8, 22.3) for 1 (defend lane 1)
[03:11.3] AI plays Mini P.E.K.K.A at (14.5, 12.1) for 4
[03:13.0] BOT plays Zap at (14.4, 15.1) for 2 (defend spell zap)
[03:15.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 1.5, AI 7.5 | towers BOT [L 2945, R 2618, K 4824] AI [L 3052, R 3052, K 4824] | units 0/4
[03:16.0] BOT plays Goblins at (14.5, 22.9) for 2 (defend lane 1)
[03:17.0] AI plays Giant at (14.3, 13.4) for 5
[03:18.8] BOT plays Bats at (14.4, 22.7) for 2 (defend lane 1)
[03:20.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 0.0, AI 3.0 | towers BOT [L 2945, R 2618, K 4824] AI [L 3052, R 3052, K 4824] | units 5/7
[03:20.0] BOT plays Ice Spirit at (14.1, 27.5) for 1 (defend lane 1)
[03:20.0] AI plays Archers at (14.7, 10.3) for 3
[03:21.5] BOT plays Skeletons at (14.3, 22.8) for 1 (defend lane 1)
[03:24.3] BOT plays Zap at (14.1, 15.4) for 2 (defend spell zap)
[03:25.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 0.6, AI 6.6 | towers BOT [L 2945, R 2618, K 4824] AI [L 3052, R 3052, K 4824] | units 2/6
[03:27.0] BOT plays Goblins at (14.9, 22.4) for 2 (defend lane 1)
[03:27.0] AI plays Musketeer at (14.5, 12.7) for 4
[03:30.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 0.2, AI 6.2 | towers BOT [L 2945, R 2618, K 4824] AI [L 3052, R 3052, K 4824] | units 5/6
[03:30.0] BOT plays Bats at (14.8, 22.6) for 2 (defend lane 1)
[03:31.3] BOT plays Ice Spirit at (14.5, 27.2) for 1 (defend lane 1)
[03:32.8] BOT plays Skeletons at (14.4, 22.3) for 1 (defend lane 1)
[03:32.8] AI plays Knight at (14.5, 12.4) for 3
[03:35.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 1.7, AI 6.7 | towers BOT [L 2945, R 2110, K 4824] AI [L 3052, R 3052, K 4824] | units 1/7
[03:35.5] BOT plays Zap at (14.5, 16.6) for 2 (defend spell zap)
[03:37.0] AI plays Mini P.E.K.K.A at (14.9, 12.2) for 4
[03:38.3] BOT plays Goblins at (14.3, 22.5) for 2 (defend lane 1)
[03:40.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 1.3, AI 6.3 | towers BOT [L 2945, R 914, K 4824] AI [L 3052, R 3052, K 4824] | units 3/4
[03:41.0] BOT plays Bats at (14.9, 22.7) for 2 (defend lane 1)
[03:42.5] BOT plays Ice Spirit at (14.2, 27.8) for 1 (defend lane 1)
[03:42.5] AI plays Zap at (14.5, 25.5) for 2
[03:42.5] BOT right princess tower destroyed
[03:42.5] BOT king tower activated
[03:42.5] game over: AI wins (0-1, crowns)
```
