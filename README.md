# ClashAI

A single-player Clash Royale style battler that runs as an iPhone home-screen web app.
Plain JavaScript and canvas, no dependencies.

## Play on iPhone

1. Open the GitHub Pages URL in Safari.
2. Share, then Add to Home Screen.
3. Launch it from the home screen icon. It runs full screen and works offline after the first load.

## Develop

```bash
node tools/serve.js 8080
```

Tests:

```bash
node tools/simtest.js
node tools/mechtest.js
node tools/aitest.js
```

## Layout

- `js/cards.js`: card, unit, tower and match data
- `js/engine.js`: deterministic battle simulation (`CR.Game`)
- `js/ai.js`: opponent bot (`CR.AI`)
- `js/render.js`: canvas renderer (`CR.Renderer`)
- `js/ui.js`, `js/main.js`, `js/audio.js`: menus, game loop, input, sound
- `SPEC.md`: the contract between modules and the mechanics list
