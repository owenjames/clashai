# Review: BOT (control) vs AI (normal), seed 7

Generated 2026-10-11 23:03 UTC. Match length 05:00.0. Game seed 7, bot seed from config. Snapshot 2a7f3da9b6 (engine, cards, AI, bot).

## Result

BOT wins by tiebreak (crowns 0-0).

| Side | Crowns | Tower dmg dealt | Leak s (at 10) | Cards | Elixir spent | Distinct cards |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| BOT | 0 | 541 | 0.2 | 64 | 192 | 8 |
| AI | 0 | 214 | 0 | 56 | 196 | 8 |

Bot decisions: lead 3, defend 26, tank 8, support 7, leak fix 11, defend spell zap 5, filler 3, defend spell freeze 1.

Bot counters: defenses 32, kites 0, pushes 11, spells 6 (value hit 31.4 of 23.9 estimated), forced plays 11, idle cycle plays 0, baits 0, supports 7.

## Findings

### Elixir

None.

### Pushes and defence

- [00:46.5] AI right princess tower took 107 damage with no defender within 6 tiles (one hit). BOT attackers in range: none in view (projectile or spell in flight). AI had 3.6 elixir and played 0 card(s) in the 8 s before.
- BOT lost 20 troop(s) in the enemy half without reaching a tower (Skeletons x9, Ice Spirit x4, P.E.K.K.A x7).
- AI lost 11 troop(s) in the enemy half without reaching a tower (Mini P.E.K.K.A x3, Knight x3, Giant x3, Archers x2).

### Spells

- BOT spells: 6 hit, 0 missed (checked at impact, logs and barrels not counted).
- AI spells: 9 hit, 0 missed (checked at impact, logs and barrels not counted).

### Units and tactics

- BOT sent 3 troop(s) into an enemy tower with no friendly troop within 3 tiles. Examples: Archers at 00:44.9 into right princess tower; Musketeer at 02:07.9 into left princess tower; Musketeer at 02:33.7 into left princess tower.
- AI sent 4 troop(s) into an enemy tower with no friendly troop within 3 tiles. Examples: Archers at 02:21.5 into left princess tower; Musketeer at 02:54.1 into left princess tower; Archers at 03:08.3 into right princess tower; Mini P.E.K.K.A at 04:47.8 into left princess tower.
- BOT 2 troop(s) packed against other units with no target (crowding). Examples: Archers at 03:24.9 (14.1, 17.0); Archers at 03:24.9 (14.9, 17.0).
- BOT 12 troop(s) crawled along a tower footprint with no target (blocked by a tower, under 0.25 tiles/s). Examples: Musketeer at 00:47.8 (4.2, 27.3); Wizard at 01:17.1 (2.7, 27.3); Archers at 02:11.6 (13.4, 27.1); Musketeer at 02:19.3 (4.4, 27.2).
- BOT 1 troop(s) had a target out of range and did not move (under 0.25 tiles/s). Examples: P.E.K.K.A at 03:54.2 (3.7, 16.6).
- AI 2 troop(s) packed against other units with no target (crowding). Examples: Archers at 01:24.4 (3.1, 14.9); Archers at 01:24.4 (3.9, 15.0).
- AI 7 troop(s) crawled along a tower footprint with no target (blocked by a tower, under 0.25 tiles/s). Examples: Musketeer at 01:35.6 (2.7, 4.7); Musketeer at 02:12.3 (13.4, 4.9); Musketeer at 02:37.6 (4.8, 5.1); Archers at 02:56.6 (14.0, 4.7).
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
[00:08.5] AI plays Mini P.E.K.K.A at (14.6, 8.1) for 4
[00:09.0] BOT plays Musketeer at (14.7, 23.6) for 4 (lead lane 1)
[00:10.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 4.6, AI 4.6 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 1/1
[00:12.0] BOT plays Skeletons at (14.9, 22.1) for 1 (defend lane 1)
[00:14.0] AI plays Archers at (14.3, 4.3) for 3
[00:15.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 5.4, AI 3.4 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 4/3
[00:15.5] AI plays Knight at (14.6, 9.8) for 3
[00:20.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 7.1, AI 2.1 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 2/3
[00:22.5] BOT plays Ice Spirit at (3.8, 23.7) for 1 (lead lane 0)
[00:25.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 7.9, AI 3.9 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 2/3
[00:25.8] AI plays Electro Wizard at (3.2, 4.9) for 4
[00:26.0] BOT plays Archers at (14.3, 27.8) for 3 (defend lane 1)
[00:30.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 6.7, AI 1.7 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 2/1
[00:31.0] BOT plays P.E.K.K.A at (3.4, 23.6) for 7 (tank lane 0)
[00:35.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.5, AI 3.5 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 3/1
[00:36.5] AI plays Musketeer at (3.8, 4.8) for 4
[00:40.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 3.3, AI 1.3 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 3/2
[00:42.8] BOT plays Musketeer at (3.7, 27.6) for 4 (defend lane 0)
[00:45.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.1, AI 3.1 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 3052, K 4824] | units 3/1
[00:47.8] AI plays Mini P.E.K.K.A at (3.5, 9.8) for 4
[00:50.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 2.9, AI 0.9 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 2/2
[00:50.5] BOT plays Skeletons at (3.2, 21.9) for 1 (defend lane 0)
[00:55.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 3.7, AI 2.7 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 4/2
[00:55.3] BOT plays Ice Spirit at (3.5, 27.2) for 1 (defend lane 0)
[00:56.3] BOT plays Archers at (3.8, 27.5) for 3 (defend lane 0)
[00:59.3] AI plays Archers at (3.7, 4.2) for 3
[01:00.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.4, AI 1.4 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 4/3
[01:05.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 3.2, AI 3.2 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 3/2
[01:07.5] AI plays Knight at (3.4, 9.6) for 3
[01:10.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 5.0, AI 2.0 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 2/3
[01:12.0] BOT plays Wizard at (3.4, 27.3) for 5 (defend lane 0)
[01:15.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.8, AI 3.8 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 1/3
[01:20.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 3.6, AI 5.6 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 1/3
[01:25.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 5.4, AI 7.4 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 1/2
[01:27.0] AI plays Giant at (3.6, 8.6) for 5
[01:30.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 7.2, AI 4.2 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 1/1
[01:30.5] AI plays Musketeer at (3.4, 4.7) for 4
[01:32.8] BOT plays P.E.K.K.A at (3.2, 23.4) for 7 (tank lane 0)
[01:35.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 1.9, AI 1.9 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 2/2
[01:40.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 3.7, AI 3.7 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 2/2
[01:41.0] AI plays Mini P.E.K.K.A at (3.1, 9.8) for 4
[01:45.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 5.5, AI 1.5 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 2/2
[01:46.8] AI plays Zap at (3.1, 17.4) for 2
[01:49.3] BOT plays Musketeer at (4.2, 24.0) for 4 (support lane 0)
[01:50.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 3.3, AI 1.3 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 2/1
[01:55.0] regulation x1 | crowns BOT 0 - 0 AI | elixir BOT 5.1, AI 0.1 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 2/2
[01:55.0] AI plays Knight at (3.8, 9.4) for 3
[02:00.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 6.9, AI 1.9 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 1/1
[02:01.8] AI plays Archers at (3.5, 4.6) for 3
[02:02.0] BOT plays Ice Spirit at (14.2, 23.3) for 1 (lead lane 1)
[02:05.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 9.5, AI 2.5 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 2/3
[02:05.3] BOT plays Skeletons at (3.1, 21.7) for 1 (leak fix)
[02:06.5] BOT plays Archers at (14.8, 27.6) for 3 (leak fix)
[02:07.3] AI plays Musketeer at (14.3, 4.8) for 4
[02:08.8] BOT plays P.E.K.K.A at (14.1, 23.3) for 7 (tank lane 1)
[02:10.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 2.0, AI 2.0 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 6/3
[02:14.3] BOT plays Musketeer at (3.7, 27.3) for 4 (defend lane 0)
[02:14.3] AI plays Mini P.E.K.K.A at (14.3, 9.8) for 4
[02:15.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 1.6, AI 1.6 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 4/4
[02:18.5] AI plays Electro Wizard at (14.8, 4.4) for 4
[02:19.0] BOT plays Ice Spirit at (14.6, 27.4) for 1 (defend lane 1)
[02:20.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 4.2, AI 1.2 | towers BOT [L 3052, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 5/5
[02:20.3] BOT plays Skeletons at (13.0, 24.9) for 1 (support lane 1)
[02:22.8] AI plays Knight at (14.8, 9.5) for 3
[02:25.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 6.7, AI 1.7 | towers BOT [L 2838, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 8/3
[02:26.3] BOT plays Archers at (14.8, 27.4) for 3 (defend lane 1)
[02:28.5] AI plays Archers at (3.4, 4.3) for 3
[02:30.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 7.3, AI 2.3 | towers BOT [L 2838, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 5/5
[02:30.8] BOT plays P.E.K.K.A at (14.6, 23.2) for 7 (tank lane 1)
[02:32.5] AI plays Musketeer at (3.8, 4.5) for 4
[02:35.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 3.9, AI 1.9 | towers BOT [L 2838, R 3052, K 4824] AI [L 3052, R 2945, K 4824] | units 4/6
[02:35.3] BOT plays Zap at (14.5, 15.5) for 2 (defend spell zap)
[02:36.5] AI plays Zap at (3.3, 14.3) for 2
[02:38.0] BOT plays Ice Spirit at (15.2, 23.8) for 1 (support lane 1)
[02:39.5] BOT plays Skeletons at (3.1, 22.1) for 1 (defend lane 0)
[02:40.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 3.5, AI 3.5 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 7/5
[02:40.8] BOT plays Archers at (3.9, 27.4) for 3 (defend lane 0)
[02:41.0] AI plays Mini P.E.K.K.A at (14.4, 9.6) for 4
[02:45.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 0.0, AI 0.0 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 5/5
[02:45.0] BOT plays Musketeer at (3.3, 27.6) for 4 (defend lane 0)
[02:45.0] AI plays Knight at (14.8, 9.7) for 3
[02:48.0] BOT plays Zap at (3.5, 16.3) for 2 (defend spell zap)
[02:49.3] BOT plays Ice Spirit at (14.2, 27.5) for 1 (defend lane 1)
[02:50.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 0.6, AI 3.6 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 5/2
[02:50.8] BOT plays Skeletons at (14.7, 22.3) for 1 (defend lane 1)
[02:51.5] AI plays Archers at (14.9, 4.2) for 3
[02:55.0] regulation x2 | crowns BOT 0 - 0 AI | elixir BOT 3.2, AI 4.2 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 5/3
[02:57.8] AI plays Giant at (3.7, 8.8) for 5
[03:00.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 6.7, AI 2.7 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 1/3
[03:00.0] overtime starts (sudden death)
[03:00.5] BOT plays P.E.K.K.A at (3.1, 23.1) for 7 (tank lane 0)
[03:04.8] BOT plays Archers at (14.5, 27.1) for 3 (defend lane 1)
[03:05.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 0.3, AI 6.3 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 4/3
[03:05.5] AI plays Musketeer at (3.8, 4.7) for 4
[03:07.5] AI plays Mini P.E.K.K.A at (3.9, 9.6) for 4
[03:10.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 3.9, AI 1.9 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 4/4
[03:11.8] AI plays Knight at (3.9, 9.2) for 3
[03:14.5] BOT plays Musketeer at (5.1, 25.6) for 4 (support lane 0)
[03:15.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 3.5, AI 2.5 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 5/2
[03:16.0] AI plays Archers at (3.5, 4.5) for 3
[03:20.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 7.0, AI 3.0 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 5/4
[03:21.5] BOT plays Ice Spirit at (3.2, 23.4) for 1 (filler lane 0)
[03:21.5] AI plays Fireball at (3.7, 17.3) for 4
[03:23.0] BOT plays Wizard at (3.8, 23.4) for 5 (filler lane 0)
[03:24.3] AI plays Zap at (3.5, 18.6) for 2
[03:25.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 4.6, AI 0.6 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 5/3
[03:28.8] BOT plays Skeletons at (3.8, 22.2) for 1 (defend lane 0)
[03:29.8] BOT plays Archers at (3.4, 27.5) for 3 (defend lane 0)
[03:30.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 4.2, AI 0.2 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 8/4
[03:30.0] AI plays Electro Wizard at (14.9, 4.1) for 4
[03:34.0] BOT plays P.E.K.K.A at (3.7, 23.1) for 7 (tank lane 0)
[03:35.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 0.7, AI 3.7 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 5/2
[03:37.0] AI plays Giant at (3.2, 8.3) for 5
[03:39.0] BOT plays Zap at (3.6, 15.7) for 2 (defend spell zap)
[03:40.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 2.3, AI 2.3 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 5/2
[03:40.3] BOT plays Ice Spirit at (14.7, 27.7) for 1 (defend lane 1)
[03:41.0] AI plays Knight at (3.3, 9.4) for 3
[03:41.3] BOT plays Skeletons at (14.6, 22.4) for 1 (defend lane 1)
[03:44.0] BOT plays Archers at (3.4, 27.9) for 3 (defend lane 0)
[03:45.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 0.9, AI 2.9 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 9/3
[03:45.3] AI plays Archers at (3.7, 4.9) for 3
[03:50.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 4.5, AI 3.5 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 5/4
[03:51.0] AI plays Musketeer at (3.4, 4.2) for 4
[03:53.8] BOT plays Musketeer at (5.2, 25.2) for 4 (support lane 0)
[03:55.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 4.0, AI 3.0 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 6/3
[03:56.5] AI plays Fireball at (3.6, 17.4) for 4
[04:00.0] overtime x2 | crowns BOT 0 - 0 AI | elixir BOT 7.6, AI 2.6 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 2/3
[04:00.8] AI plays Zap at (3.9, 12.5) for 2
[04:02.0] BOT plays Wizard at (3.7, 27.8) for 5 (leak fix)
[04:04.3] AI plays Giant at (3.3, 8.4) for 5
[04:05.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 8.0, AI 1.0 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 2/2
[04:06.5] BOT plays Ice Spirit at (14.2, 27.2) for 1 (leak fix)
[04:07.8] BOT plays Skeletons at (3.6, 21.8) for 1 (leak fix)
[04:09.0] BOT plays Archers at (14.5, 27.6) for 3 (leak fix)
[04:10.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 6.1, AI 6.3 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 7/1
[04:10.0] BOT plays Zap at (3.0, 12.3) for 2 (defend spell zap)
[04:13.0] AI plays Archers at (3.3, 4.5) for 3
[04:13.3] BOT plays Musketeer at (3.1, 27.4) for 4 (leak fix)
[04:14.8] AI plays Knight at (14.9, 9.3) for 3
[04:15.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 0.4, AI 5.7 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 7/4
[04:15.0] BOT plays P.E.K.K.A at (3.6, 23.7) for 7 (tank lane 0)
[04:16.0] AI plays Musketeer at (3.6, 14.4) for 4
[04:17.3] AI plays Electro Wizard at (2.8, 14.7) for 4
[04:18.5] BOT plays Ice Spirit at (5.1, 25.1) for 1 (support lane 0)
[04:19.8] BOT plays Skeletons at (14.5, 21.9) for 1 (defend lane 1)
[04:20.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 3.8, AI 3.0 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 9/6
[04:21.0] AI plays Mini P.E.K.K.A at (14.6, 9.4) for 4
[04:23.8] AI plays Archers at (14.5, 4.8) for 3
[04:24.0] BOT plays Zap at (3.4, 14.1) for 2 (defend spell zap)
[04:25.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 3.1, AI 1.4 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 7/7
[04:25.0] BOT plays Freeze at (3.6, 13.6) for 4 (defend spell freeze)
[04:26.3] BOT plays Archers at (14.2, 27.6) for 3 (defend lane 1)
[04:26.8] AI plays Knight at (3.8, 9.3) for 3
[04:30.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 5.5, AI 3.7 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 6/5
[04:30.5] AI plays Fireball at (3.6, 16.7) for 4
[04:32.3] AI plays Zap at (3.7, 18.9) for 2
[04:34.0] BOT plays Ice Spirit at (14.1, 27.7) for 1 (leak fix)
[04:35.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 9.8, AI 3.1 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 4/2
[04:35.0] BOT plays Skeletons at (3.2, 22.4) for 1 (leak fix)
[04:36.0] BOT plays Musketeer at (14.4, 27.6) for 4 (leak fix)
[04:36.0] AI plays Mini P.E.K.K.A at (3.7, 9.5) for 4
[04:38.8] BOT plays Wizard at (3.8, 27.4) for 5 (defend lane 0)
[04:40.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 5.2, AI 4.4 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 7/3
[04:40.5] AI plays Archers at (14.5, 4.4) for 3
[04:41.8] BOT plays P.E.K.K.A at (14.8, 23.2) for 7 (tank lane 1)
[04:43.5] AI plays Giant at (3.9, 8.9) for 5
[04:45.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 3.5, AI 1.8 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 3/4
[04:45.5] BOT plays Ice Spirit at (16.2, 25.6) for 1 (support lane 1)
[04:47.0] AI plays Knight at (14.9, 9.9) for 3
[04:48.0] BOT plays Skeletons at (3.6, 21.6) for 1 (defend lane 0)
[04:50.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 6.9, AI 4.1 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 7/4
[04:50.0] AI plays Musketeer at (14.5, 4.6) for 4
[04:51.8] BOT plays Archers at (14.2, 27.5) for 3 (defend lane 1)
[04:53.8] AI plays Mini P.E.K.K.A at (14.4, 9.7) for 4
[04:54.0] BOT plays Musketeer at (14.7, 23.7) for 4 (filler lane 1)
[04:55.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 5.3, AI 1.5 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 9/6
[04:56.5] AI plays Archers at (3.5, 4.9) for 3
[04:58.5] AI plays Zap at (14.3, 14.8) for 2
[04:59.0] BOT plays Wizard at (3.3, 27.5) for 5 (leak fix)
[05:00.0] overtime x3 | crowns BOT 0 - 0 AI | elixir BOT 5.6, AI 1.8 | towers BOT [L 2838, R 3052, K 4824] AI [L 2618, R 2945, K 4824] | units 9/6
[05:00.0] game over: BOT wins (0-0, tiebreak)
```
