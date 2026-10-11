# Review: BOT (cycle) vs AI (normal), seed 3

Generated 2026-10-11 23:03 UTC. Match length 03:34.6. Game seed 3, bot seed from config. Snapshot 2a7f3da9b6 (engine, cards, AI, bot).

## Result

AI wins by crowns (crowns 0-1).

| Side | Crowns | Tower dmg dealt | Leak s (at 10) | Cards | Elixir spent | Distinct cards |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| BOT | 0 | 1272 | 0 | 67 | 115 | 7 |
| AI | 1 | 3162 | 0 | 31 | 114 | 8 |

Bot decisions: cycle 2, defend 56, defend spell zap 7, tank 1, support 1.

Bot counters: defenses 63, kites 0, pushes 1, spells 7 (value hit 34.0 of 27.0 estimated), forced plays 0, idle cycle plays 2, baits 0, supports 1.

## Findings

### Elixir

None.

### Pushes and defence

- [00:35.3] BOT left princess tower took 110 damage with no defender within 6 tiles (one hit). AI attackers in range: Electro Wizard. BOT had 2.6 elixir and played 1 card(s) in the 8 s before.
- [00:59.0] AI left princess tower took 954 damage with no defender within 6 tiles (until 01:02.2). BOT attackers in range: Hog Rider, Goblins. AI had 3.1 elixir and played 1 card(s) in the 8 s before.
- [01:02.3] BOT right princess tower took 868 damage with no defender within 6 tiles (until 01:05.3). AI attackers in range: Musketeer. BOT had 0.2 elixir and played 2 card(s) in the 8 s before.
- BOT lost 26 troop(s) in the enemy half without reaching a tower (Skeletons x7, Goblins x12, Bats x4, Knight x3).
- AI lost 11 troop(s) in the enemy half without reaching a tower (Knight x4, Mini P.E.K.K.A x3, Giant x3, Archers x1).

### Spells

- BOT spells: 7 hit, 0 missed (checked at impact, logs and barrels not counted).
- AI spells: 4 hit, 0 missed (checked at impact, logs and barrels not counted).

### Units and tactics

- BOT sent 2 troop(s) into an enemy tower with no friendly troop within 3 tiles. Examples: Bats at 00:18.5 into left princess tower; Hog Rider at 00:57.7 into left princess tower.
- AI sent 6 troop(s) into an enemy tower with no friendly troop within 3 tiles. Examples: Electro Wizard at 00:33.8 into left princess tower; Musketeer at 01:00.5 into right princess tower; Giant at 01:57.1 into right princess tower; Archers at 02:25.3 into left princess tower.
- BOT 1 troop(s) crawled along a tower footprint with no target (blocked by a tower, under 0.25 tiles/s). Examples: Ice Spirit at 02:29.1 (15.1, 27.3).
- AI 2 troop(s) crawled along a tower footprint with no target (blocked by a tower, under 0.25 tiles/s). Examples: Musketeer at 00:45.1 (14.0, 4.6); Archers at 02:13.6 (4.2, 4.8).
- Match went to overtime (started 03:00.0, ended 03:34.6, reason crowns).

### Cards

- BOT never played: Fireball (of its 8-card deck; played 7 distinct cards, 67 plays).

### Engine

None.

## Gameplay log

Game clock, one state line every 5 s, then plays and key events. "AI" is the computer opponent, "OPP" a bot opponent.

```
[00:00.0] match start: BOT is team 0, AI is team 1. Opponent ai:normal, bot bot:cycle.
[00:00.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 4.0, AI 5.0 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 3/0
[00:00.0] BOT plays Skeletons at (3.6, 22.3) for 1 (cycle)
[00:02.8] AI plays Knight at (3.3, 9.3) for 3
[00:03.0] BOT plays Goblins at (14.1, 22.6) for 2 (cycle)
[00:05.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 3.8, AI 3.8 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 6/1
[00:05.8] AI plays Archers at (14.4, 4.4) for 3
[00:06.3] BOT plays Ice Spirit at (3.6, 27.2) for 1 (defend lane 0)
[00:07.0] BOT plays Bats at (3.9, 22.2) for 2 (defend lane 0)
[00:10.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 2.6, AI 2.6 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 7/3
[00:14.0] AI plays Electro Wizard at (3.5, 4.8) for 4
[00:15.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 4.4, AI 0.4 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 5/3
[00:17.3] BOT plays Knight at (14.8, 22.7) for 3 (defend lane 1)
[00:18.0] BOT plays Skeletons at (14.8, 22.4) for 1 (defend lane 1)
[00:20.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 2.1, AI 2.1 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 4/3
[00:23.8] BOT plays Goblins at (14.8, 22.6) for 2 (defend lane 1)
[00:25.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.9, AI 3.9 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 5/3
[00:25.3] BOT plays Ice Spirit at (14.6, 27.2) for 1 (defend lane 1)
[00:25.5] AI plays Mini P.E.K.K.A at (14.6, 9.8) for 4
[00:28.0] BOT plays Bats at (3.9, 22.3) for 2 (defend lane 0)
[00:30.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 0.7, AI 1.7 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 7/2
[00:35.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 2.5, AI 3.5 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 0/2
[00:36.3] BOT plays Zap at (3.5, 18.5) for 2 (defend spell zap)
[00:37.3] BOT plays Skeletons at (14.7, 22.5) for 1 (defend lane 1)
[00:40.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.3, AI 5.3 | towers BOT [L 2942, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 3/0
[00:40.0] AI plays Musketeer at (14.4, 4.3) for 4
[00:45.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 3.1, AI 3.1 | towers BOT [L 2942, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 0/1
[00:50.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 4.9, AI 4.9 | towers BOT [L 2942, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 0/1
[00:50.5] BOT plays Hog Rider at (3.4, 18.9) for 4 (tank lane 0)
[00:51.3] AI plays Giant at (3.3, 9.5) for 5
[00:53.3] BOT plays Ice Spirit at (3.1, 21.1) for 1 (support lane 0)
[00:55.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.7, AI 1.7 | towers BOT [L 2942, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 2/2
[00:56.0] BOT plays Goblins at (3.5, 22.6) for 2 (defend lane 0)
[01:00.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.4, AI 3.4 | towers BOT [L 2942, R 3052, K 4824] AI [L 2734, R 3052, K 4824] | units 4/2
[01:01.8] BOT plays Bats at (3.5, 22.2) for 2 (defend lane 0)
[01:02.3] AI plays Knight at (3.3, 9.8) for 3
[01:04.5] BOT plays Skeletons at (3.5, 22.7) for 1 (defend lane 0)
[01:04.5] AI plays Zap at (3.5, 18.2) for 2
[01:05.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 0.2, AI 0.2 | towers BOT [L 2942, R 2401, K 4824] AI [L 1780, R 3052, K 4824] | units 6/2
[01:10.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 0.0, AI 2.0 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 6/1
[01:10.0] BOT plays Zap at (3.4, 20.4) for 2 (defend spell zap)
[01:13.0] BOT plays Ice Spirit at (3.4, 27.3) for 1 (defend lane 0)
[01:13.0] AI plays Archers at (3.7, 4.7) for 3
[01:15.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 0.8, AI 0.8 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 1/3
[01:20.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 2.6, AI 2.6 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 0/2
[01:23.3] BOT plays Goblins at (3.1, 22.3) for 2 (defend lane 0)
[01:25.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 2.4, AI 4.4 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 3/2
[01:25.5] BOT plays Bats at (3.1, 22.4) for 2 (defend lane 0)
[01:28.0] BOT plays Skeletons at (3.7, 22.5) for 1 (defend lane 0)
[01:30.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.2, AI 6.2 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 5/2
[01:35.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 2.9, AI 7.9 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 0/2
[01:35.3] BOT plays Knight at (3.6, 22.9) for 3 (defend lane 0)
[01:35.3] AI plays Mini P.E.K.K.A at (14.2, 8.5) for 4
[01:38.0] AI plays Giant at (14.4, 8.7) for 5
[01:38.8] BOT plays Ice Spirit at (14.6, 27.7) for 1 (defend lane 1)
[01:40.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 0.7, AI 0.7 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 2/2
[01:43.8] BOT plays Goblins at (14.6, 22.4) for 2 (defend lane 1)
[01:45.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 0.5, AI 2.5 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 5/2
[01:46.5] AI plays Knight at (3.3, 9.2) for 3
[01:49.3] BOT plays Bats at (14.2, 22.4) for 2 (defend lane 1)
[01:50.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 0.3, AI 1.3 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 8/2
[01:52.0] BOT plays Skeletons at (3.4, 22.2) for 1 (defend lane 0)
[01:52.0] AI plays Zap at (14.3, 19.4) for 2
[01:55.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.1, AI 1.1 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 6/2
[01:58.5] BOT plays Zap at (14.4, 22.1) for 2 (defend spell zap)
[02:00.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 0.9, AI 2.9 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 3/1
[02:00.3] BOT plays Ice Spirit at (3.3, 27.5) for 1 (defend lane 0)
[02:03.0] BOT plays Goblins at (3.5, 22.8) for 2 (defend lane 0)
[02:04.5] AI plays Musketeer at (14.7, 8.4) for 4
[02:05.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 1.5, AI 2.5 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 2/2
[02:08.5] AI plays Archers at (3.2, 4.2) for 3
[02:09.0] BOT plays Bats at (14.7, 22.3) for 2 (defend lane 1)
[02:10.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 2.0, AI 3.0 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 9/3
[02:10.0] BOT plays Skeletons at (14.6, 22.6) for 1 (defend lane 1)
[02:11.5] BOT plays Knight at (14.6, 22.3) for 3 (defend lane 1)
[02:13.0] AI plays Giant at (14.4, 8.1) for 5
[02:14.0] BOT plays Ice Spirit at (14.1, 27.5) for 1 (defend lane 1)
[02:15.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 1.6, AI 1.6 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 5/4
[02:15.8] BOT plays Goblins at (14.2, 22.4) for 2 (defend lane 1)
[02:18.5] BOT plays Bats at (14.7, 22.4) for 2 (defend lane 1)
[02:20.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 0.2, AI 5.2 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 13/4
[02:20.0] BOT plays Skeletons at (14.2, 22.3) for 1 (defend lane 1)
[02:21.0] AI plays Fireball at (14.4, 15.7) for 4
[02:22.8] BOT plays Zap at (15.0, 14.0) for 2 (defend spell zap)
[02:24.0] BOT plays Ice Spirit at (14.5, 27.3) for 1 (defend lane 1)
[02:25.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 0.7, AI 1.7 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 4/4
[02:25.0] AI plays Knight at (14.3, 9.4) for 3
[02:27.0] BOT plays Goblins at (14.4, 22.5) for 2 (defend lane 1)
[02:29.8] BOT plays Bats at (14.7, 22.7) for 2 (defend lane 1)
[02:30.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 0.3, AI 5.3 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 12/2
[02:31.0] AI plays Musketeer at (14.9, 14.7) for 4
[02:32.0] BOT plays Skeletons at (14.3, 22.1) for 1 (defend lane 1)
[02:32.8] AI plays Zap at (14.4, 19.6) for 2
[02:35.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 2.9, AI 2.9 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 3/2
[02:35.3] BOT plays Knight at (14.2, 22.2) for 3 (defend lane 1)
[02:36.8] BOT plays Ice Spirit at (14.1, 27.4) for 1 (defend lane 1)
[02:38.0] AI plays Giant at (14.6, 8.3) for 5
[02:39.5] BOT plays Goblins at (14.3, 22.4) for 2 (defend lane 1)
[02:40.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 0.5, AI 1.5 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 5/3
[02:42.3] BOT plays Bats at (14.3, 22.6) for 2 (defend lane 1)
[02:43.8] BOT plays Skeletons at (14.3, 22.4) for 1 (defend lane 1)
[02:45.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 1.0, AI 5.0 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 9/2
[02:47.5] BOT plays Zap at (14.8, 14.6) for 2 (defend spell zap)
[02:48.5] BOT plays Ice Spirit at (14.9, 27.2) for 1 (defend lane 1)
[02:49.3] AI plays Archers at (14.4, 4.6) for 3
[02:50.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 1.6, AI 5.6 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 6/3
[02:50.5] AI plays Electro Wizard at (14.8, 13.7) for 4
[02:50.8] BOT plays Goblins at (14.5, 22.6) for 2 (defend lane 1)
[02:53.5] BOT plays Bats at (14.4, 22.1) for 2 (defend lane 1)
[02:53.5] AI plays Musketeer at (14.4, 14.8) for 4
[02:55.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 0.2, AI 1.2 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 11/5
[02:55.0] BOT plays Skeletons at (14.8, 22.1) for 1 (defend lane 1)
[02:59.0] BOT plays Knight at (14.4, 22.2) for 3 (defend lane 1)
[03:00.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 0.7, AI 4.7 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 4/4
[03:00.0] overtime starts (sudden death)
[03:00.5] BOT plays Ice Spirit at (14.8, 27.6) for 1 (defend lane 1)
[03:02.0] AI plays Mini P.E.K.K.A at (14.7, 8.6) for 4
[03:03.3] BOT plays Zap at (14.5, 14.1) for 2 (defend spell zap)
[03:05.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 1.3, AI 4.3 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 2/5
[03:06.0] BOT plays Goblins at (14.7, 22.5) for 2 (defend lane 1)
[03:06.0] AI plays Giant at (14.9, 8.7) for 5
[03:07.5] BOT plays Skeletons at (14.7, 22.5) for 1 (defend lane 1)
[03:10.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 1.9, AI 2.9 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 5/6
[03:10.3] BOT plays Bats at (14.8, 22.9) for 2 (defend lane 1)
[03:11.8] BOT plays Ice Spirit at (14.8, 27.6) for 1 (defend lane 1)
[03:14.5] BOT plays Zap at (14.5, 15.1) for 2 (defend spell zap)
[03:15.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 0.5, AI 6.5 | towers BOT [L 2942, R 2184, K 4824] AI [L 1780, R 3052, K 4824] | units 1/4
[03:16.0] AI plays Archers at (14.7, 13.3) for 3
[03:17.3] BOT plays Goblins at (14.6, 22.5) for 2 (defend lane 1)
[03:18.8] BOT plays Skeletons at (14.1, 22.6) for 1 (defend lane 1)
[03:20.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 1.0, AI 4.0 | towers BOT [L 2942, R 1423, K 4824] AI [L 1780, R 3052, K 4824] | units 6/6
[03:20.0] AI plays Knight at (14.1, 9.5) for 3
[03:21.5] BOT plays Bats at (14.3, 22.2) for 2 (defend lane 1)
[03:23.0] BOT plays Ice Spirit at (14.5, 27.9) for 1 (defend lane 1)
[03:23.0] AI plays Musketeer at (13.3, 14.9) for 4
[03:25.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 1.6, AI 3.6 | towers BOT [L 2942, R 879, K 4824] AI [L 1780, R 3052, K 4824] | units 5/5
[03:27.0] BOT plays Knight at (14.2, 22.8) for 3 (defend lane 1)
[03:30.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 0.2, AI 7.2 | towers BOT [L 2942, R 371, K 4824] AI [L 1780, R 3052, K 4824] | units 4/5
[03:30.0] BOT plays Goblins at (14.9, 22.4) for 2 (defend lane 1)
[03:31.3] BOT plays Skeletons at (14.8, 22.6) for 1 (defend lane 1)
[03:32.3] AI plays Fireball at (14.3, 25.4) for 4
[03:33.8] AI plays Giant at (14.8, 8.3) for 5
[03:34.0] BOT plays Bats at (14.5, 22.2) for 2 (defend lane 1)
[03:34.6] BOT right princess tower destroyed
[03:34.6] BOT king tower activated
[03:34.6] game over: AI wins (0-1, crowns)
```
