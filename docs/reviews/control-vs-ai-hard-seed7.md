# Review: BOT (control) vs AI (hard), seed 7

Generated 2026-10-11 23:03 UTC. Match length 05:00.0. Game seed 7, bot seed from config. Snapshot 2a7f3da9b6 (engine, cards, AI, bot).

## Result

BOT wins by tiebreak (crowns 0-0).

| Side | Crowns | Tower dmg dealt | Leak s (at 10) | Cards | Elixir spent | Distinct cards |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| BOT | 0 | 2158 | 0.23 | 65 | 191 | 8 |
| AI | 0 | 651 | 0 | 56 | 197 | 8 |

Bot decisions: lead 4, defend 33, tank 7, support 5, defend spell zap 5, filler 3, leak fix 7, defend spell freeze 1.

Bot counters: defenses 39, kites 0, pushes 11, spells 6 (value hit 21.7 of 21.2 estimated), forced plays 7, idle cycle plays 0, baits 0, supports 5.

## Findings

### Elixir

None.

### Pushes and defence

- BOT lost 18 troop(s) in the enemy half without reaching a tower (Skeletons x8, Ice Spirit x2, Archers x3, P.E.K.K.A x4, Wizard x1).
- AI lost 10 troop(s) in the enemy half without reaching a tower (Mini P.E.K.K.A x2, Archers x2, Musketeer x1, Electro Wizard x1, Knight x2, Giant x2).

### Spells

- BOT spells: 6 hit, 0 missed (checked at impact, logs and barrels not counted).
- AI spells: 12 hit, 0 missed (checked at impact, logs and barrels not counted).

### Units and tactics

- BOT sent 3 troop(s) into an enemy tower with no friendly troop within 3 tiles. Examples: P.E.K.K.A at 00:52.3 into right princess tower; Archers at 01:28.2 into right princess tower; Musketeer at 03:44.9 into left princess tower.
- AI sent 6 troop(s) into an enemy tower with no friendly troop within 3 tiles. Examples: Knight at 01:24.5 into left princess tower; Giant at 01:36.7 into left princess tower; Giant at 02:27.7 into right princess tower; Musketeer at 03:47.2 into right princess tower.
- BOT 3 troop(s) packed against other units with no target (crowding). Examples: Archers at 03:34.8 (13.7, 27.2); Ice Spirit at 04:26.8 (15.2, 27.2); Musketeer at 04:57.3 (14.9, 27.4).
- BOT 10 troop(s) crawled along a tower footprint with no target (blocked by a tower, under 0.25 tiles/s). Examples: Archers at 00:30.3 (15.4, 27.2); Archers at 01:13.6 (13.5, 27.1); Wizard at 01:18.3 (4.6, 27.1); Archers at 02:06.1 (4.4, 27.2).
- BOT 1 troop(s) had a target out of range and did not move (under 0.25 tiles/s). Examples: P.E.K.K.A at 04:50.8 (14.5, 17.7).
- AI 1 troop(s) stood still with no target and no visible cause. Examples: Giant at 04:21.8 (14.5, 12.4).
- AI 2 troop(s) packed against other units with no target (crowding). Examples: Musketeer at 04:03.1 (13.6, 4.8); Musketeer at 04:57.8 (15.0, 4.6).
- AI 5 troop(s) crawled along a tower footprint with no target (blocked by a tower, under 0.25 tiles/s). Examples: Musketeer at 00:41.6 (15.2, 4.7); Electro Wizard at 02:58.6 (15.2, 4.6); Electro Wizard at 03:21.1 (13.4, 4.8); Electro Wizard at 03:47.6 (3.9, 4.5).
- Match went to overtime (started 03:00.0, ended 05:00.0, reason tiebreak).

### Cards

None.

### Engine

None.

## Gameplay log

Game clock, one state line every 5 s, then plays and key events. "AI" is the computer opponent, "OPP" a bot opponent.

```
[00:00.0] match start: BOT is team 0, AI is team 1. Opponent ai:hard, bot bot:control.
[00:00.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 5.0, AI 5.0 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 0/0
[00:05.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 6.8, AI 6.8 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 0/0
[00:08.5] AI plays Mini P.E.K.K.A at (14.5, 8.4) for 4
[00:09.0] BOT plays Musketeer at (14.7, 23.6) for 4 (lead lane 1)
[00:10.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 4.6, AI 4.6 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 1/1
[00:12.0] BOT plays Skeletons at (14.9, 22.1) for 1 (defend lane 1)
[00:13.3] AI plays Archers at (14.4, 4.4) for 3
[00:14.3] AI plays Knight at (14.5, 9.6) for 3
[00:15.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 5.4, AI 0.4 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 4/4
[00:20.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 7.1, AI 2.1 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 2/3
[00:22.5] BOT plays Ice Spirit at (3.3, 23.2) for 1 (lead lane 0)
[00:25.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 7.9, AI 3.9 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 2/2
[00:25.3] BOT plays Archers at (14.2, 27.2) for 3 (defend lane 1)
[00:25.3] AI plays Fireball at (14.5, 19.1) for 4
[00:30.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 6.7, AI 1.7 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 2/1
[00:31.0] BOT plays P.E.K.K.A at (14.4, 23.4) for 7 (tank lane 1)
[00:35.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.5, AI 3.5 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 3/0
[00:36.5] AI plays Musketeer at (14.6, 4.6) for 4
[00:40.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 3.3, AI 1.3 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 3/1
[00:45.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 5.1, AI 3.1 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 2/1
[00:47.8] AI plays Mini P.E.K.K.A at (14.6, 9.4) for 4
[00:50.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 6.9, AI 0.9 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2731, K 4824] | units 2/2
[00:50.5] BOT plays Musketeer at (16.2, 25.6) for 4 (support lane 1)
[00:55.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 4.7, AI 2.7 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 1/1
[00:57.0] AI plays Archers at (14.4, 4.4) for 3
[00:58.8] BOT plays Skeletons at (14.2, 21.9) for 1 (defend lane 1)
[01:00.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 5.4, AI 1.4 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 4/3
[01:05.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 7.2, AI 3.2 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 2/2
[01:07.3] BOT plays Ice Spirit at (3.2, 23.2) for 1 (lead lane 0)
[01:08.5] BOT plays Archers at (14.8, 27.6) for 3 (defend lane 1)
[01:10.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 5.0, AI 2.0 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 3/3
[01:10.0] AI plays Knight at (3.6, 9.6) for 3
[01:13.3] BOT plays Wizard at (3.7, 27.3) for 5 (defend lane 0)
[01:15.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.8, AI 3.8 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 3/2
[01:18.5] AI plays Giant at (3.6, 8.4) for 5
[01:20.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 3.6, AI 0.6 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 3/2
[01:23.5] BOT plays Musketeer at (3.2, 27.2) for 4 (defend lane 0)
[01:25.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.4, AI 2.4 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 4/2
[01:29.8] AI plays Musketeer at (3.6, 14.5) for 4
[01:30.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 3.2, AI 0.2 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 2/2
[01:30.8] BOT plays Skeletons at (3.2, 21.9) for 1 (defend lane 0)
[01:35.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 3.9, AI 1.9 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 2/2
[01:39.0] BOT plays Ice Spirit at (3.3, 27.7) for 1 (defend lane 0)
[01:40.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 4.7, AI 3.7 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 2/1
[01:44.3] AI plays Fireball at (3.1, 19.3) for 4
[01:45.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 6.5, AI 1.5 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 2/0
[01:46.5] BOT plays P.E.K.K.A at (3.2, 23.3) for 7 (tank lane 0)
[01:50.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.3, AI 3.3 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 1/0
[01:51.3] AI plays Archers at (3.5, 4.4) for 3
[01:55.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 3.1, AI 2.1 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 1/2
[01:57.8] AI plays Knight at (3.4, 9.5) for 3
[02:00.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 4.9, AI 0.9 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 1/3
[02:01.0] BOT plays Archers at (3.2, 27.9) for 3 (defend lane 0)
[02:05.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 5.5, AI 4.5 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 3/3
[02:08.0] AI plays Giant at (14.5, 8.6) for 5
[02:09.8] BOT plays Musketeer at (3.8, 23.6) for 4 (lead lane 0)
[02:10.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 5.0, AI 3.0 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 3/3
[02:12.8] BOT plays Skeletons at (14.8, 21.7) for 1 (defend lane 1)
[02:13.5] AI plays Zap at (3.2, 20.4) for 2
[02:13.8] BOT plays Ice Spirit at (14.1, 27.3) for 1 (defend lane 1)
[02:14.5] AI plays Fireball at (4.0, 20.5) for 4
[02:15.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 4.6, AI 0.6 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 6/1
[02:15.0] BOT plays Zap at (3.5, 15.0) for 2 (defend spell zap)
[02:16.3] BOT plays Wizard at (14.7, 27.3) for 5 (defend lane 1)
[02:18.5] AI plays Archers at (14.4, 4.5) for 3
[02:20.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 3.2, AI 1.2 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 4/3
[02:24.0] AI plays Musketeer at (14.6, 14.9) for 4
[02:25.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 3.7, AI 0.7 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 6/4
[02:25.0] BOT plays Archers at (14.3, 27.7) for 3 (defend lane 1)
[02:29.8] BOT plays P.E.K.K.A at (14.7, 23.2) for 7 (tank lane 1)
[02:30.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 0.3, AI 4.3 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 4/3
[02:31.0] AI plays Giant at (14.5, 8.5) for 5
[02:35.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 3.9, AI 2.9 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 4/3
[02:35.3] BOT plays Ice Spirit at (16.5, 25.7) for 1 (support lane 1)
[02:35.8] AI plays Knight at (14.6, 9.5) for 3
[02:39.3] AI plays Zap at (14.8, 19.4) for 2
[02:39.8] BOT plays Musketeer at (14.6, 27.2) for 4 (defend lane 1)
[02:40.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 2.5, AI 1.5 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 6/2
[02:42.3] AI plays Archers at (14.6, 4.6) for 3
[02:45.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 6.0, AI 2.0 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 5/3
[02:48.0] BOT plays Wizard at (14.9, 23.9) for 5 (filler lane 1)
[02:48.0] AI plays Fireball at (14.4, 16.1) for 4
[02:50.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 4.6, AI 1.6 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 3/2
[02:53.5] AI plays Electro Wizard at (14.6, 4.6) for 4
[02:55.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 8.2, AI 1.2 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 2/3
[02:57.0] BOT plays Skeletons at (3.4, 22.0) for 1 (leak fix)
[02:57.8] AI plays Knight at (14.6, 9.4) for 3
[02:58.5] BOT plays Archers at (14.5, 27.8) for 3 (leak fix)
[03:00.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 7.7, AI 1.7 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 7/2
[03:00.0] overtime starts (sudden death)
[03:00.5] BOT plays P.E.K.K.A at (3.2, 23.7) for 7 (tank lane 0)
[03:00.5] AI plays Zap at (14.5, 16.6) for 2
[03:04.8] BOT plays Ice Spirit at (1.7, 24.8) for 1 (support lane 0)
[03:05.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 3.3, AI 3.3 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 5/2
[03:05.3] AI plays Archers at (3.5, 4.6) for 3
[03:06.0] BOT plays Zap at (14.5, 14.9) for 2 (defend spell zap)
[03:07.0] BOT plays Skeletons at (14.9, 22.0) for 1 (defend lane 1)
[03:10.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 3.9, AI 3.9 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 7/3
[03:10.3] AI plays Mini P.E.K.K.A at (3.6, 9.4) for 4
[03:13.0] BOT plays Archers at (3.6, 27.4) for 3 (defend lane 0)
[03:15.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 4.5, AI 3.5 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 5/3
[03:16.0] AI plays Electro Wizard at (14.4, 4.4) for 4
[03:20.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 8.0, AI 3.0 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 3/3
[03:22.3] BOT plays Musketeer at (3.6, 27.3) for 4 (leak fix)
[03:23.8] AI plays Knight at (3.6, 9.4) for 3
[03:25.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 7.6, AI 3.6 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 3/4
[03:26.5] BOT plays Ice Spirit at (14.4, 27.5) for 1 (defend lane 1)
[03:27.5] BOT plays Zap at (3.5, 12.7) for 2 (defend spell zap)
[03:28.5] BOT plays Skeletons at (14.1, 22.3) for 1 (defend lane 1)
[03:28.5] AI plays Giant at (14.4, 8.6) for 5
[03:29.8] BOT plays Archers at (14.9, 27.5) for 3 (defend lane 1)
[03:30.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 4.2, AI 2.2 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 8/3
[03:33.3] BOT plays Musketeer at (14.6, 27.9) for 4 (defend lane 1)
[03:35.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 3.7, AI 5.7 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 4/2
[03:38.0] AI plays Musketeer at (14.6, 13.1) for 4
[03:39.0] BOT plays Ice Spirit at (14.4, 27.9) for 1 (defend lane 1)
[03:39.3] AI plays Archers at (3.5, 4.5) for 3
[03:40.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 1.3, AI 2.3 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 6/4
[03:40.0] BOT plays Wizard at (14.4, 27.5) for 5 (defend lane 1)
[03:42.5] AI plays Electro Wizard at (3.5, 4.5) for 4
[03:45.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 4.9, AI 1.9 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2196, K 4824] | units 4/5
[03:48.0] BOT plays P.E.K.K.A at (3.8, 23.4) for 7 (tank lane 0)
[03:50.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 1.5, AI 5.5 | towers BOT [L 3052, R 2835, K 4824] AI [L 2401, R 2196, K 4824] | units 3/4
[03:51.0] AI plays Mini P.E.K.K.A at (14.6, 8.5) for 4
[03:52.8] AI plays Knight at (3.5, 9.4) for 3
[03:55.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 4.0, AI 2.0 | towers BOT [L 3052, R 2401, K 4824] AI [L 2401, R 2196, K 4824] | units 6/5
[03:55.0] BOT plays Skeletons at (3.7, 22.3) for 1 (defend lane 0)
[03:56.3] BOT plays Archers at (3.4, 27.2) for 3 (defend lane 0)
[03:57.3] BOT plays Ice Spirit at (3.4, 27.6) for 1 (defend lane 0)
[03:58.0] AI plays Musketeer at (14.4, 4.6) for 4
[04:00.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 3.6, AI 1.6 | towers BOT [L 3052, R 2401, K 4824] AI [L 2401, R 2196, K 4824] | units 7/5
[04:00.5] BOT plays Musketeer at (3.8, 27.1) for 4 (defend lane 0)
[04:01.5] AI plays Archers at (14.6, 4.4) for 3
[04:03.8] BOT plays Zap at (3.7, 14.0) for 2 (defend spell zap)
[04:03.8] AI plays Zap at (3.6, 16.4) for 2
[04:05.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 3.0, AI 2.0 | towers BOT [L 3052, R 2401, K 4824] AI [L 2401, R 2196, K 4824] | units 6/6
[04:07.0] AI plays Fireball at (14.5, 14.0) for 4
[04:09.0] BOT plays P.E.K.K.A at (3.4, 23.9) for 7 (tank lane 0)
[04:10.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 1.3, AI 3.3 | towers BOT [L 3052, R 2401, K 4824] AI [L 2401, R 1545, K 4824] | units 3/4
[04:11.8] AI plays Giant at (14.4, 8.4) for 5
[04:12.3] BOT plays Skeletons at (14.6, 21.9) for 1 (defend lane 1)
[04:13.3] BOT plays Ice Spirit at (14.6, 27.2) for 1 (defend lane 1)
[04:14.5] BOT plays Archers at (14.2, 27.8) for 3 (defend lane 1)
[04:14.5] AI plays Knight at (3.4, 9.6) for 3
[04:15.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 1.7, AI 0.7 | towers BOT [L 3052, R 2401, K 4824] AI [L 2401, R 1545, K 4824] | units 9/5
[04:17.3] BOT plays Freeze at (14.3, 13.3) for 4 (defend spell freeze)
[04:17.3] AI plays Archers at (3.5, 4.5) for 3
[04:19.3] BOT plays Zap at (14.3, 13.3) for 2 (defend spell zap)
[04:19.3] AI plays Zap at (3.7, 16.3) for 2
[04:20.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 1.0, AI 1.0 | towers BOT [L 3052, R 2401, K 4824] AI [L 2401, R 1545, K 4824] | units 5/5
[04:20.5] BOT plays Skeletons at (14.9, 21.9) for 1 (defend lane 1)
[04:21.8] BOT plays Ice Spirit at (14.5, 27.4) for 1 (defend lane 1)
[04:23.0] AI plays Mini P.E.K.K.A at (3.6, 9.4) for 4
[04:23.8] BOT plays Archers at (14.7, 27.7) for 3 (defend lane 1)
[04:25.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 1.4, AI 2.4 | towers BOT [L 3052, R 2401, K 4824] AI [L 2401, R 1545, K 4824] | units 7/5
[04:26.8] AI plays Musketeer at (3.6, 4.5) for 4
[04:29.5] AI plays Knight at (14.6, 9.6) for 3
[04:30.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 6.7, AI 0.7 | towers BOT [L 3052, R 2401, K 4824] AI [L 2401, R 1545, K 4824] | units 6/5
[04:30.5] BOT plays Musketeer at (5.1, 25.6) for 4 (support lane 0)
[04:34.5] AI plays Giant at (14.5, 8.4) for 5
[04:35.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 8.1, AI 1.1 | towers BOT [L 3052, R 2401, K 4824] AI [L 2401, R 1545, K 4824] | units 5/4
[04:35.8] BOT plays P.E.K.K.A at (14.7, 23.2) for 7 (tank lane 1)
[04:37.8] BOT plays Skeletons at (16.5, 25.4) for 1 (support lane 1)
[04:39.8] AI plays Zap at (14.8, 20.1) for 2
[04:40.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 5.4, AI 4.4 | towers BOT [L 3052, R 2401, K 4824] AI [L 2401, R 1545, K 4824] | units 8/2
[04:40.8] AI plays Fireball at (14.6, 19.0) for 4
[04:42.5] AI plays Archers at (14.6, 4.6) for 3
[04:42.8] BOT plays Ice Spirit at (14.7, 23.6) for 1 (filler lane 1)
[04:44.0] BOT plays Wizard at (14.8, 23.1) for 5 (filler lane 1)
[04:45.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 4.8, AI 2.8 | towers BOT [L 3052, R 2401, K 4824] AI [L 2401, R 1545, K 4824] | units 4/4
[04:45.3] AI plays Knight at (14.5, 9.5) for 3
[04:48.3] BOT plays Archers at (3.2, 27.9) for 3 (defend lane 0)
[04:49.0] AI plays Mini P.E.K.K.A at (14.4, 9.5) for 4
[04:50.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 7.1, AI 1.1 | towers BOT [L 3052, R 2401, K 4824] AI [L 2401, R 1545, K 4824] | units 4/5
[04:52.3] BOT plays Musketeer at (14.6, 27.5) for 4 (leak fix)
[04:52.8] AI plays Musketeer at (14.5, 4.6) for 4
[04:55.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 8.5, AI 2.5 | towers BOT [L 3052, R 2401, K 4824] AI [L 2401, R 1545, K 4824] | units 5/4
[04:56.0] BOT plays Skeletons at (3.5, 22.0) for 1 (leak fix)
[04:56.5] AI plays Electro Wizard at (14.4, 4.4) for 4
[04:57.3] BOT plays Ice Spirit at (14.7, 27.7) for 1 (leak fix)
[04:58.5] BOT plays Wizard at (3.3, 27.5) for 5 (leak fix)
[04:59.3] AI plays Archers at (3.4, 4.4) for 3
[05:00.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 6.6, AI 0.8 | towers BOT [L 3052, R 2401, K 4824] AI [L 2401, R 1545, K 4824] | units 10/6
[05:00.0] game over: BOT wins (0-0, tiebreak)
```
