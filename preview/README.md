# Arena asset preview

A standalone three.js page that shows free CC0 models arranged like a Clash Royale arena. Use it to judge whether the look is close enough to the target style: chunky low-poly cartoon, 3/4 top-down camera, blue vs red teams.

## What is shown

- An 18 x 32 tile arena with a checkered grass field and a river across the middle.
- Two plank bridges (one per lane), blue towers at the bottom (two princess towers and a king), red towers at the top. Towers, bridges and the dirt border are procedural (three.js boxes), not downloaded models.
- A demo battle loop: troops from each team walk across the bridges, switch to Attack when in range, play Death, and respawn after a few seconds. One blue baby dragon flies.
- Two rotating cannons, trees at the arena edges and rocks on the riverbanks.
- Team colour is applied as a tint on a cloned material. Units have a coloured ring underfoot and a health bar.
- A Sprites button switches troops to pre-rendered billboard sprites. Each troop is rendered once to a 128 x 128 offscreen target from the same camera pitch (52 degrees), so you can compare live 3D with the sprite look. Towers and cannons stay 3D.

## How to run

From the project root:

```
node tools/serve.js 8090
```

Then open http://localhost:8090/preview/index.html. On an iPhone, use the Mac's LAN address in place of localhost while the server runs. The page needs internet access for three.js (loaded from cdn.jsdelivr.net, version 0.160.0).

## Files

- `index.html`: the whole page (scene, battle loop, sprite baking).
- `assets/polypizza/*.glb`: 16 CC0 models from Poly Pizza, all by Quaternius. See `CREDITS.md`.
- `CREDITS.md`: source, author and licence for every file.

## Models and animations

| Troop | Model | Animations used |
|---|---|---|
| Knight | Character Animated | Idle, Walk, Dagger_Attack, Death |
| Archer | Characters Matt (gun pose) | Idle, Walk_Gun, Idle_Gun (attack pose), Death |
| Giant | Giant | Idle, Walk, Attack, Death |
| Goblin | Goblin | Idle, Walk, Attack, Death |
| Skeleton | Skeleton | Skeleton_Idle, Skeleton_Running, Skeleton_Attack, Skeleton_Death |
| Wizard | Wizard | Idle, Walk, Bite_Front (attack), Death |
| Mini P.E.K.K.A (stand-in) | Robot Enemy | Idle, Walk, Attack, Death |
| Hog rider (stand-in) | Pig with knight on top | Pig: Run, Walk, Headbutt, Death; rider: knight clips |
| Baby dragon | Dragon | Dragon_Flying, Dragon_Attack, Dragon_Death |

Troops with animations: all nine above. Static models: cannon, trees, pines, rock. Towers and bridges are procedural.

## Tuning

Constants at the top of the script control troop heights, hit points, speed, range, sight, lane x positions and the camera pitch (`PITCH`). The loop is a simple state machine, not a real game: units do not block each other, and towers do not fire.

## Frame rate

The loop runs on `requestAnimationFrame` with a delta-time cap of 50 ms. The title shows the measured frames per second. Mixers are updated per unit and shadows use one 2048 px directional light. Pixel ratio is capped at 2 for iPhone.

## Known gaps

- The Mini P.E.K.K.A and Hog Rider are stand-ins, not the real Clash Royale characters.
- The archer is a gunner pose and the knight on the king tower is gold-tinted for a crown look. Judge the style, not the exact shapes.
- The sprite mode uses a single idle frame per troop, not a set of animation frames.
- Only the Quaternius models were used. No Kenney kit was downloaded.
