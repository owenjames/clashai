# Art manifest

`assets/manifest.json` maps game ids to art for the Pixi renderer (`?r=pixi`). The file is optional. Any
id without an entry, or whose file fails to load, uses a procedural placeholder (team ring, card emoji token,
stone tower, glow effects). The manifest is read once at startup; reload the page to pick up edits.

## Sections

| Section | Key | Used for |
| --- | --- | --- |
| `units` | unit id (`knight`, `skeleton`, ...) | troops |
| `buildings` | unit id (`cannon`, `tesla`, ...) | buildings (checked first) |
| `towers` | `princess` or `king` | towers, per team (see below) |
| `projectiles` | kind (`arrow`, `bullet`, `cannonball`, `fire`, `goo`, `spear`, `bomb`, `magic`, `ice`) | in-flight shots |
| `effects` | effect type (`splash`, `zap`, `lightning`, `towerDown`, ...) | one-shot visuals, replaces the procedural drawing of that type |
| `ui` | `crown`, `drop` | HUD icons; omitted means the built-in drawing |

## Entry formats

Every entry is one of three shapes. The first two take `anchor`, `scale`, `flipDefault`, `tintable`.

1. Single image

```json
"knight": { "src": "assets/units/knight.png", "anchor": [0.5, 0.9], "scale": 1.4, "flipDefault": false, "tintable": true }
```

2. Spritesheet grid

```json
"archer": {
  "sheet": {
    "src": "assets/units/archer.png",
    "frameW": 128, "frameH": 128,
    "rows": {
      "idle":   [0, 4],
      "walk":   [1, 6],
      "attack": [2, 4],
      "death":  [3, 5, 0]
    },
    "fps": 10
  },
  "anchor": [0.5, 0.85], "scale": 1.4, "flipDefault": false, "tintable": true
}
```

`rows[state] = [row, count, startCol?]`. Rows and columns are zero-based. Missing states reuse `idle`.
Top-level `fps` is used if the sheet has none.

3. Frame list (one file per frame)

```json
"giant": { "frames": { "idle": ["assets/units/giant_0.png"], "walk": ["assets/units/giant_1.png", "assets/units/giant_2.png"] }, "fps": 8, "anchor": [0.5, 0.9], "scale": 2.0 }
```

## Fields

- `anchor`: `[x, y]` as fractions of the frame. `[0.5, 0.9]` puts the feet 90 percent down the image.
  Feet sit on the tile point, so y-sorting uses this point.
- `scale`: height in tiles. Units: for a unit with collision radius 0.5, and scaled by `r / 0.5` for others.
  Towers: height of a size-3 tower, scaled by `size / 3`. Projectiles: length in tiles.
  Effects: multiplier on the effect's diameter (`2 * radius`).
- `flipDefault`: true when the art faces left. The renderer mirrors it to face the direction of travel.
- `tintable`: true to tint the art with the team colour (multiply). Team rings are drawn either way.
- `fps`: frame rate for `frames` and `sheet` states that loop (`walk`, `idle`, `attack` loop; `death` plays once).

## Towers

`towers[type]` takes either one shared entry or per-team entries:

```json
"princess": { "team0": { "src": "assets/towers/princess_blue.png", "anchor": [0.5, 1], "scale": 3.6 },
              "team1": { "src": "assets/towers/princess_red.png",  "anchor": [0.5, 1], "scale": 3.6 } },
"king":     { "src": "assets/towers/king.png", "anchor": [0.5, 1], "scale": 4.8, "tintable": true }
```

Team 0 is the blue (bottom) side. Team 1 is the red (top) side.

## Effects

`effects[type]` replaces the procedural drawing of that type. Each effect is one layer or a list of layers
drawn together:

```json
"towerDown": [
  { "frames": { "idle": ["assets/vfx/smoke/explosion/explosion00.png", "..."] }, "fps": 14, "scale": 1.2 },
  { "frames": { "idle": ["assets/vfx/smoke/black_smoke/blackSmoke00.png", "..."] }, "fps": 10, "scale": 1.6, "alpha": 0.8 }
],
"zap": [ { "frames": { "idle": ["assets/vfx/particles/light_01.png"] }, "fps": 20, "scale": 0.8, "blend": "add", "tint": "#7fdcff" } ]
```

- Each layer is centred on the effect point. Diameter is `2 * radius * scale`, with radius from the engine (default 0.6).
- `frames` (the `idle` list) plays over the effect lifetime at `fps`, and holds the last frame.
- `tint`: "#rrggbb" multiplies the art. `blend`: "add" for glows. `alpha`: opacity (default 1). Layers fade out over the last 30 percent.
- `spin`: degrees per second (Tornado twirl). Use with a `frames` list or a single `src`.
- Effect types not listed keep the procedural drawing. Types drawn above the units (sparks, arcs, lightning, death, spawn, elixir, deploy, tower down) are set in `TOP_FX` in `js/render-pixi.js`.

The VFX in `assets/vfx` are CC0 (Kenney). See `assets/CREDITS.md`.

## Troops

Troop art is baked by `CR.TroopArt.bake(unitId, team, { height })` (`js/troopart.js`) when it is loaded. It returns
`{ frames: { idle, walk, attack, death: [canvas...] }, fps }` with feet at the bottom centre. The renderer uses
it in place of the token placeholder, and the manifest `units` entries are used when troop art is not loaded.
Walk plays while the unit moves. Attack starts early so its strike frame (about 40 percent through) lands on `lastAttackT`.
Death plays once on removal.

## Rules

- All paths are relative to the page and start with `assets/`.
- Images should be power-of-two sized or at most 2048 px. Keep atlases small; iOS kills pages with big texture sets.
- The manifest is optional. An invalid JSON file falls back to all placeholders.
