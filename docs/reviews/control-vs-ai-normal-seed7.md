# Review: BOT (control) vs AI (normal), seed 7

Generated 2026-10-13 05:05 UTC. Match length 05:00.0. Game seed 7, bot seed from config. Snapshot b6be1285b0 (engine, cards, AI, bot).

## Result

AI wins by tiebreak (crowns 0-0).

| Side | Crowns | Tower dmg dealt | Leak s (at 10) | Cards | Elixir spent | Distinct cards |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| BOT | 0 | 281 | 0 | 63 | 193 | 8 |
| AI | 0 | 651 | 1.47 | 51 | 190 | 8 |

Bot decisions: defend 34, lead 2, tank 7, support 7, defend spell zap 5, filler 4, leak fix 3, defend spell freeze 1.

Bot counters: defenses 40, kites 0, pushes 9, spells 6 (value hit 20.1 of 22.2 estimated), forced plays 3, idle cycle plays 0, baits 0, supports 7.

## Findings

### Elixir

- AI sat at 10 elixir for 1.5 s over 2 stretch(es). Longest 1.4 s from 04:49.9.

### Pushes and defence

- BOT lost 26 troop(s) in the enemy half without reaching a tower (Wizard x1, P.E.K.K.A x6, Archers x1, Ice Spirit x3, Skeletons x15).
- AI lost 11 troop(s) in the enemy half without reaching a tower (Mini P.E.K.K.A x2, Giant x5, Knight x3, Archers x1).

### Spells

- BOT spells: 6 hit, 0 missed (checked at impact, logs and barrels not counted).
- AI spells: 7 hit, 0 missed (checked at impact, logs and barrels not counted).

### Units and tactics

- BOT sent 4 troop(s) into an enemy tower with no friendly troop within 3 tiles. Examples: Archers at 01:17.2 into right princess tower; Musketeer at 03:17.2 into right princess tower; Musketeer at 03:56.5 into left princess tower; Archers at 04:27.8 into left princess tower.
- AI sent 2 troop(s) into an enemy tower with no friendly troop within 3 tiles. Examples: Musketeer at 00:33.4 into right princess tower; Giant at 04:01.4 into right princess tower.
- Match went to overtime (started 03:00.0, ended 05:00.0, reason tiebreak).

### Cards

None.

### Engine

None.

## Gameplay log

Game clock, one state line every 5 s, then plays and key events. "AI" is the computer opponent, "OPP" a bot opponent.

```
[00:00.0] match start: BOT is team 0, AI is team 1. Opponent ai:normal, bot bot:control.
[00:00.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 5.0, AI 5.0 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 0/0
[00:05.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 6.8, AI 6.8 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 0/0
[00:08.5] AI plays Mini P.E.K.K.A at (3.6, 13.9) for 4
[00:09.5] BOT plays Skeletons at (3.2, 22.3) for 1 (defend lane 0)
[00:10.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 7.6, AI 4.6 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 3/1
[00:10.8] BOT plays Archers at (3.7, 27.3) for 3 (defend lane 0)
[00:11.8] BOT plays Ice Spirit at (3.4, 27.3) for 1 (defend lane 0)
[00:15.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 5.4, AI 6.4 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 4/1
[00:20.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 7.1, AI 8.1 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 2/0
[00:21.0] AI plays Archers at (2.7, 4.9) for 3
[00:24.8] BOT plays Musketeer at (3.7, 23.9) for 4 (lead lane 0)
[00:25.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 4.9, AI 6.9 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 3/2
[00:28.0] AI plays Musketeer at (14.1, 12.8) for 4
[00:29.0] BOT plays Wizard at (14.4, 27.4) for 5 (defend lane 1)
[00:30.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.7, AI 4.7 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 4/3
[00:30.5] AI plays Fireball at (3.5, 17.3) for 4
[00:35.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 3.5, AI 2.5 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 2/1
[00:40.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 5.3, AI 4.3 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 3052, K 4824] | units 1/0
[00:41.0] AI plays Electro Wizard at (14.5, 4.5) for 4
[00:45.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 7.1, AI 2.1 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 3052, K 4824] | units 1/1
[00:48.8] BOT plays P.E.K.K.A at (14.5, 23.2) for 7 (tank lane 1)
[00:50.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.9, AI 3.9 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 1/1
[00:54.8] AI plays Knight at (14.6, 10.6) for 3
[00:55.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 3.7, AI 2.7 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 1/2
[00:56.3] AI plays Archers at (14.9, 3.6) for 3
[01:00.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 5.4, AI 1.4 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 1/4
[01:01.8] BOT plays Archers at (16.3, 25.5) for 3 (support lane 1)
[01:05.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 4.2, AI 3.2 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 3/3
[01:07.5] AI plays Musketeer at (14.3, 3.6) for 4
[01:10.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 6.0, AI 1.0 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 3/3
[01:15.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 7.8, AI 2.8 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 2/1
[01:17.8] BOT plays Ice Spirit at (3.2, 23.4) for 1 (lead lane 0)
[01:20.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 8.6, AI 4.6 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 1/1
[01:21.5] BOT plays Skeletons at (14.7, 21.8) for 1 (defend lane 1)
[01:22.5] BOT plays Musketeer at (14.2, 27.9) for 4 (defend lane 1)
[01:25.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 5.4, AI 6.4 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 3/1
[01:29.8] AI plays Giant at (14.0, 12.6) for 5
[01:30.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 7.2, AI 3.2 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 1/2
[01:30.8] BOT plays Zap at (14.5, 16.8) for 2 (defend spell zap)
[01:31.8] BOT plays Wizard at (14.5, 27.9) for 5 (defend lane 1)
[01:35.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.9, AI 4.9 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 2/1
[01:40.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 3.7, AI 6.7 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 2/1
[01:41.0] AI plays Electro Wizard at (14.2, 10.4) for 4
[01:45.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 5.5, AI 4.5 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 2/1
[01:47.5] AI plays Fireball at (13.7, 19.9) for 4
[01:50.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 7.3, AI 2.3 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 1/0
[01:52.0] BOT plays P.E.K.K.A at (14.9, 23.8) for 7 (tank lane 1)
[01:55.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 2.1, AI 4.1 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 1/0
[01:58.5] AI plays Mini P.E.K.K.A at (14.3, 10.3) for 4
[02:00.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 3.9, AI 1.9 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 1/1
[02:00.3] BOT plays Ice Spirit at (16.3, 25.7) for 1 (support lane 1)
[02:01.8] AI plays Knight at (14.5, 9.8) for 3
[02:02.5] BOT plays Skeletons at (14.6, 21.9) for 1 (defend lane 1)
[02:05.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 2.5, AI 2.5 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 7/2
[02:05.0] BOT plays Archers at (14.3, 27.7) for 3 (defend lane 1)
[02:06.0] AI plays Archers at (14.2, 4.4) for 3
[02:10.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 6.0, AI 3.0 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 6/3
[02:13.0] BOT plays Musketeer at (14.7, 23.4) for 4 (filler lane 1)
[02:13.0] AI plays Giant at (14.3, 13.3) for 5
[02:15.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 5.6, AI 1.6 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 5/3
[02:20.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 9.2, AI 5.2 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 3/3
[02:20.5] BOT plays Wizard at (3.2, 27.4) for 5 (leak fix)
[02:23.5] AI plays Fireball at (14.5, 19.4) for 4
[02:24.8] AI plays Electro Wizard at (14.5, 3.9) for 4
[02:25.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 7.7, AI 0.7 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 3/1
[02:26.0] BOT plays P.E.K.K.A at (14.2, 23.9) for 7 (tank lane 1)
[02:29.8] BOT plays Ice Spirit at (15.1, 23.8) for 1 (support lane 1)
[02:30.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 3.3, AI 4.3 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 3/1
[02:30.5] AI plays Knight at (3.3, 9.8) for 3
[02:32.5] AI plays Archers at (13.3, 4.8) for 3
[02:35.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 6.9, AI 1.9 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 3/4
[02:36.8] BOT plays Skeletons at (14.5, 22.3) for 1 (defend lane 1)
[02:37.8] BOT plays Archers at (14.4, 27.5) for 3 (defend lane 1)
[02:38.0] AI plays Musketeer at (3.4, 4.6) for 4
[02:40.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 6.5, AI 1.5 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 7/5
[02:42.3] BOT plays Zap at (3.5, 16.2) for 2 (defend spell zap)
[02:45.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 8.0, AI 5.0 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 6/3
[02:47.3] BOT plays Musketeer at (14.4, 27.3) for 4 (leak fix)
[02:48.3] BOT plays Ice Spirit at (3.3, 27.4) for 1 (defend lane 0)
[02:48.3] AI plays Mini P.E.K.K.A at (14.3, 10.7) for 4
[02:49.3] BOT plays Skeletons at (3.5, 22.4) for 1 (defend lane 0)
[02:50.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 5.6, AI 4.6 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 8/2
[02:50.5] BOT plays Archers at (3.3, 27.1) for 3 (defend lane 0)
[02:50.8] AI plays Giant at (14.1, 13.1) for 5
[02:55.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 4.2, AI 3.2 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 5/2
[02:55.0] BOT plays Zap at (14.6, 15.5) for 2 (defend spell zap)
[02:55.8] AI plays Knight at (14.9, 10.3) for 3
[02:59.0] BOT plays P.E.K.K.A at (3.6, 23.7) for 7 (tank lane 0)
[03:00.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 0.7, AI 3.7 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 5/2
[03:00.0] overtime starts (sudden death)
[03:03.3] AI plays Archers at (15.2, 3.9) for 3
[03:04.8] BOT plays Ice Spirit at (5.2, 25.3) for 1 (support lane 0)
[03:05.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 3.3, AI 4.3 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 5/3
[03:05.3] AI plays Musketeer at (4.0, 4.9) for 4
[03:10.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 6.9, AI 3.9 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 3/3
[03:10.3] AI plays Mini P.E.K.K.A at (3.3, 10.9) for 4
[03:12.5] BOT plays Skeletons at (3.2, 22.1) for 1 (defend lane 0)
[03:14.0] BOT plays Archers at (14.5, 27.9) for 3 (defend lane 1)
[03:15.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 6.5, AI 3.5 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 7/3
[03:17.3] BOT plays Musketeer at (5.3, 23.1) for 4 (filler lane 0)
[03:17.8] AI plays Giant at (13.7, 12.2) for 5
[03:18.8] BOT plays Wizard at (14.8, 27.3) for 5 (defend lane 1)
[03:20.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 1.0, AI 2.0 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 6/2
[03:24.0] BOT plays Ice Spirit at (3.6, 27.9) for 1 (defend lane 0)
[03:25.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 3.6, AI 5.6 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 5/2
[03:27.0] AI plays Electro Wizard at (14.6, 10.9) for 4
[03:30.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 0.2, AI 5.2 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 5/2
[03:30.0] BOT plays P.E.K.K.A at (3.3, 23.6) for 7 (tank lane 0)
[03:33.0] AI plays Knight at (13.7, 10.1) for 3
[03:35.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 3.7, AI 5.7 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 4/2
[03:35.8] AI plays Zap at (14.8, 20.5) for 2
[03:37.0] AI plays Mini P.E.K.K.A at (2.6, 9.5) for 4
[03:38.3] BOT plays Archers at (5.3, 25.2) for 3 (support lane 0)
[03:39.8] AI plays Archers at (4.3, 11.1) for 3
[03:40.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 4.3, AI 0.3 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 4/4
[03:40.5] BOT plays Skeletons at (3.6, 21.8) for 1 (defend lane 0)
[03:41.5] BOT plays Musketeer at (3.7, 27.6) for 4 (defend lane 0)
[03:45.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 2.9, AI 3.9 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 8/2
[03:47.0] AI plays Giant at (13.7, 12.8) for 5
[03:48.0] BOT plays Ice Spirit at (14.4, 27.6) for 1 (defend lane 1)
[03:49.5] BOT plays Wizard at (14.8, 27.1) for 5 (defend lane 1)
[03:50.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 0.5, AI 2.5 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 6/2
[03:52.5] AI plays Fireball at (14.8, 17.7) for 4
[03:55.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 4.0, AI 2.0 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 2/1
[03:56.5] AI plays Knight at (4.4, 10.1) for 3
[03:59.3] BOT plays Archers at (3.4, 27.9) for 3 (defend lane 0)
[04:00.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 4.6, AI 2.6 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 4/2
[04:02.5] BOT plays P.E.K.K.A at (14.6, 23.4) for 7 (tank lane 1)
[04:05.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 3.0, AI 8.0 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 4/1
[04:06.0] AI plays Electro Wizard at (14.3, 4.9) for 4
[04:07.3] AI plays Mini P.E.K.K.A at (14.2, 10.0) for 4
[04:08.8] AI plays Archers at (13.8, 3.9) for 3
[04:09.0] BOT plays Musketeer at (14.2, 23.9) for 4 (support lane 1)
[04:10.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 4.3, AI 2.3 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 5/4
[04:11.8] AI plays Musketeer at (13.5, 4.8) for 4
[04:13.5] BOT plays Ice Spirit at (14.7, 23.8) for 1 (filler lane 1)
[04:14.5] BOT plays Wizard at (14.6, 23.7) for 5 (filler lane 1)
[04:14.5] AI plays Knight at (2.7, 9.6) for 3
[04:15.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 3.7, AI 0.7 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 6/5
[04:17.8] BOT plays Skeletons at (3.9, 21.9) for 1 (defend lane 0)
[04:20.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 8.0, AI 2.0 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 9/5
[04:20.0] AI plays Fireball at (14.3, 15.8) for 4
[04:21.3] AI plays Zap at (14.2, 15.1) for 2
[04:21.5] BOT plays Archers at (3.5, 27.4) for 3 (leak fix)
[04:23.0] AI plays Archers at (3.5, 4.8) for 3
[04:23.3] BOT plays Musketeer at (14.3, 27.5) for 4 (defend lane 1)
[04:25.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 4.4, AI 2.4 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 5/5
[04:25.0] BOT plays Zap at (3.4, 15.0) for 2 (defend spell zap)
[04:26.0] BOT plays Ice Spirit at (14.5, 27.9) for 1 (defend lane 1)
[04:27.0] BOT plays Skeletons at (14.4, 22.3) for 1 (defend lane 1)
[04:28.0] BOT plays Archers at (14.3, 27.6) for 3 (defend lane 1)
[04:28.0] AI plays Giant at (14.4, 12.3) for 5
[04:29.5] BOT plays Freeze at (14.4, 15.1) for 4 (defend spell freeze)
[04:30.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 0.7, AI 2.7 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 6/5
[04:31.3] BOT plays Zap at (14.4, 14.5) for 2 (defend spell zap)
[04:32.5] BOT plays Ice Spirit at (14.8, 27.4) for 1 (defend lane 1)
[04:33.5] BOT plays Skeletons at (3.6, 21.8) for 1 (defend lane 0)
[04:34.0] AI plays Musketeer at (15.0, 10.1) for 4
[04:35.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 2.1, AI 4.1 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 9/3
[04:37.0] BOT plays Musketeer at (14.9, 27.4) for 4 (defend lane 1)
[04:39.0] AI plays Knight at (14.3, 10.0) for 3
[04:40.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 3.4, AI 6.4 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 5/3
[04:41.5] AI plays Mini P.E.K.K.A at (15.3, 13.6) for 4
[04:41.8] BOT plays Wizard at (14.1, 27.4) for 5 (defend lane 1)
[04:44.5] BOT plays Archers at (14.6, 27.5) for 3 (defend lane 1)
[04:45.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 0.8, AI 7.8 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 6/3
[04:46.0] AI plays Archers at (14.2, 13.4) for 3
[04:50.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 6.1, AI 10.0 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 4/4
[04:51.3] AI plays Giant at (15.1, 12.7) for 5
[04:52.3] BOT plays Ice Spirit at (14.5, 27.3) for 1 (defend lane 1)
[04:53.3] BOT plays P.E.K.K.A at (14.2, 23.9) for 7 (tank lane 1)
[04:53.3] AI plays Musketeer at (14.5, 11.1) for 4
[04:55.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 3.5, AI 5.0 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 5/2
[04:58.5] BOT plays Musketeer at (16.1, 25.6) for 4 (support lane 1)
[04:59.8] AI plays Electro Wizard at (15.3, 4.7) for 4
[05:00.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 4.8, AI 6.2 | towers BOT [L 3052, R 2401, K 4824] AI [L 3052, R 2771, K 4824] | units 4/3
[05:00.0] game over: AI wins (0-0, tiebreak)
```
