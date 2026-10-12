# ClashAI renderer survey

Goal: swap the 2,300-line Canvas 2D renderer (`js/render.js`, `CR.Renderer`) for something that looks and feels closer to Clash Royale, while keeping `js/engine.js` (`CR.Game`) and `js/ai.js` (`CR.AI`) unchanged. Target: 60 fps on iPhone Safari and WKWebView with 40+ animated units and several hundred particles, no build step.

Status of facts below: versions and dates come from web search results dated up to October 2026. Where sources conflicted or were missing, the entry says so. Bundle sizes are registry estimates, not measurements of our app. Measure before committing.

## 1. What the renderer contract needs

From `SPEC.md` and the top of `render.js`:

- The engine ticks at a fixed `dt = 1/30`. Rendering runs at display rate, so the renderer must interpolate between engine snapshots for 60 fps motion. This matters for any engine choice.
- The engine exposes `game.entities`, `game.projectiles`, `game.spells`, `game.effects` (visual-only, engine pushes and ages them), and `game.events` (valid for the last `update()` only). Renderer state (hit flashes, fall-in, crown pops, particles) is keyed off these.
- Arena is 18 by 32 tiles, y grows downward, river at y 15 to 17, two bridges. Layout and hit testing live in CSS px; the arena is drawn through a tile-unit transform.
- Entities carry `x, y, r, air, hp, maxHp, deployT, active, facing, lastAttackT, stunT, freezeT, slowT`, and so on. Enough to drive sprite state (idle, walk, attack, dead) without touching the engine.

So the swap is cleanly a "read state, draw" layer. Any engine that owns its own update loop must be driven by us, not the reverse.

## 2. Engine comparison

Version and date notes: "latest found" means the newest version a search returned, not confirmed against the registry.

### PixiJS v8 (pixi.js)

- Version: 8.20.x latest found (8.20.0 is a feature release; 8.20.1 a patch). 8.19.0 was current in July 2026. Exact release dates not confirmed.
- License: MIT.
- Bundle: DepScope lists pixi.js 8.18.1 at about 858 KB minified, 244 KB gzipped, as a registry-level figure. Tree-shaking via ESM will be smaller; the UMD build will be the full library. Our total budget should be measured with a real hello-world build.
- Renderers: WebGL2 (default), WebGPU (opt-in). Canvas renderer removed in v8.
- Batching and atlases: strong. Sprites sharing a texture atlas batch into few draw calls. `Assets` loader, spritesheets, `ParticleContainer` for high-count sprites.
- Skeletal: `pixi-spine` (official spine-ts runtime, needs a Spine license to distribute). DragonBones has community runtimes. Spritesheet frame animation is built in (`AnimatedSprite`).
- Particles: `@pixi/particle-emitter` v6 targets v8 per its README mirror (note the package name still starts with `@pixi/`). A community fork `@spd789562/particle-emitter` targets pixi.js 8.5 and up, with small adoption. Writing our own pooled particle system on `ParticleContainer` is also reasonable.
- Filters: built-ins include Blur, ColorMatrix, Displacement, Noise, Alpha. Outline and drop-shadow style effects need custom GLSL filters (v8 uses `GlProgram`/`GpuProgram` with options-object constructors). `pixi-filters` (community) is a separate package; I could not confirm its v6 release notes or exact v8 compatibility. Check npm before relying on it.
- Tweening: none built in. Use GSAP (MIT, CDN) or a 30-line tween helper.
- Text: `BitmapText` for damage numbers (good), `Text` for HUD (canvas-backed, slower if it changes each frame).
- iOS notes: WebGL2 on Safari is fine on current iOS. Known historical problems: WebGL context loss after lock or background (handle `webglcontextlost`/`webglcontextrestored`), resizing on-screen WebGL canvases causing memory growth on older iOS 14 builds, and a 2025 WebGPU flicker report on iOS 26.0.1 (WebGPU only, not WebGL). Keep WebGL and do not enable WebGPU on iOS.
- Simulation driving: easy. Create display objects keyed by entity id, update their transforms each frame from interpolated engine state. Pixi does not own the loop unless we call `app.ticker`; we can set `autoStart: false` and call `app.renderer.render(stage)` from our own rAF.
- No-build fit: yes. The UMD build is published on npm and mirrored on jsDelivr and unpkg (`pixi.js/dist/pixi.min.js`, global `PIXI`). Pin an exact version, at least two weeks old, per our CDN rule. Verify the UMD path for 8.20.x before writing code.
- Community and docs: large, active, good v8 migration guide and guides for filters and components. Frequent minor releases mean occasional API churn.
- Mobile scaling: we handle letterboxing ourselves. `resolution` set to `min(devicePixelRatio, 2)` keeps fill cost sane on iPhone.

### Phaser 4 (and Phaser 3 status)

- Version: Phaser 4 launched April 2026 (GameFromScratch dates the release to April 14, 2026). Official docs reference 4.2.0. npm listings seen in search showed 4.0.0-rc.5 alongside 3.90.0, which conflicts with the 4.x docs. Check npm for the current 4.x tag.
- License: MIT.
- Bundle: no verified Phaser 4 minified or gzipped figure found. Phaser 3 was about 880 KB minified (2019 figure, not gzip). Assume Phaser 4 is in the same ballpark; measure.
- Renderer: Phaser 4 rewrote WebGL around RenderNodes. Official claims include automatic context-loss recovery and a Sprite GPU Layer (claimed up to 100x faster for very large sprite counts). These are vendor claims.
- Batching and atlases: strong, built into the renderer.
- Skeletal: Spine plugin (licensed, same Spine runtime rules), DragonBones community plugins. Spritesheet animations built in.
- Particles: built-in particle emitter (Phaser 4 reworked it; check API for 4.x).
- Filters: Phaser 4 has a shader and filter system. Verify the 4.x API for custom post effects.
- Tweening: built in, good.
- Text: built-in bitmap text.
- iOS: no verified iOS-specific notes for Phaser 4. Phaser 3 was widely used on iOS web games, which is evidence it works.
- Simulation driving: harder. Phaser owns the scene update loop and calls `update(time, delta)`. We can disable the main loop and step our own, but the scene and game-object model pushes us toward putting game logic in Phaser scenes. Our fixed-timestep engine would live in a Phaser scene's update, which is workable but fights the grain.
- No-build fit: yes. A UMD build is published (`phaser.min.js` on jsDelivr/unpkg). Pin the version.
- Community and docs: very large, mature docs, many examples. Phaser 4 migration docs exist; some Phaser 3 plugins will not work.
- Mobile scaling: built-in Scale Manager (FIT, ENVELOPE). Good, but portrait safe-area handling is ours to add via CSS `env(safe-area-inset-*)`.

### Kaplay (Kaboom successor)

- Version: 3001.0.16 per the npm page (search results disagreed; an index showed 3001.0.6). The project's own docs still show CDN examples pinned to 3000.1.17, so examples online are often one major behind.
- License: MIT (from memory, not verified in search).
- Bundle: not verified. Memory suggests several hundred KB minified. Measure.
- Renderer: WebGL. Batching is decent, not documented as a high-count sprite engine.
- Skeletal: no first-class Spine. Spritesheet animation yes.
- Particles: basic, built-in.
- Filters/shaders: custom shaders supported via its shader API; less mature than Pixi.
- Tweening: built in.
- Text: built in.
- iOS notes: none found.
- Simulation driving: Kaplay owns its loop and component/object model (ECS-like `add([...])`). Feeding it external state each frame means creating and destroying game objects, which is more overhead than Pixi's direct display tree. It is a game framework, not a renderer.
- No-build fit: UMD/CDN build exists (`kaplay` on npm, docs show a CDN script tag). Pin a version.
- Community and docs: decent; smaller than Phaser and Pixi.

### Excalibur.js

- Version: uncertain. NuGet mirror listings showed 0.30.3 as newest but with "3 months ago" timestamps; 0.28.x releases were also indexed. Check npm `excalibur` for the current tag.
- License: BSD-2-Clause (from memory).
- Bundle: not verified.
- Renderer: WebGL with Canvas 2D fallback (from memory).
- Skeletal: no first-class Spine. Sprite sheets, animations, yes.
- Particles: built in, emitter-based.
- Filters: some material/shader support in recent versions.
- Text: built in.
- iOS notes: none found.
- Simulation driving: owns scene loop and actor/entity model, like Phaser. Driving from external state is possible but goes through their actors and scene.
- No-build fit: CDN build exists (jsDelivr/cdnjs historically had UMD bundles). Verify current path.
- Community and docs: good docs, smaller community.

### LittleJS

- Version: 1.18.21 latest found (README mirror; no release page confirmed). The 1.18.21 README refers to the Third Annual LittleJS Game Jam (Oct 2 to Nov 2), so the snapshot looks recent.
- License: MIT (from memory).
- Bundle: tiny, tens of KB minified (from memory, not verified).
- Renderer: WebGL with 2D batching, built for small, fast games. Designed for Js13k-style sizes.
- Skeletal: none. Spritesheet and tile support, particles built in (emitters), with a particle system aimed at lots of particles.
- Filters: custom WebGL shader hooks possible.
- Text: simple built-in font rendering.
- iOS notes: none found.
- Simulation driving: its `engineInit(gameInit, gameUpdate, gameUpdatePost, gameRender, gameRenderPost)` callbacks let us own game state and step it ourselves. Good fit for an external fixed-timestep sim.
- No-build fit: yes. It is a single file meant to be loaded by script tag, and it is on npm and jsDelivr.
- Community and docs: smaller, but the author's docs and examples are clear. Fewer off-the-shelf art pipeline tools (no Spine).
- Verdict: very clean fit for the engine-driving part, weak on art tooling (no Spine, no atlas tooling beyond basics). A strong candidate if we want a tiny dependency with a loop we control.

### Cocos Creator (web build)

- Version: 3.8.x line, 3.8.8 listed as newest on a release tracker (no date confirmed). The most recent dated official post found was 3.8.6 (April 2, 2025). 3.8 was marked LTS.
- License: engine MIT (from memory); editor is a free download. Check current terms for commercial use.
- Bundle: third-party guides say web builds start around 2 to 4 MB; treat as estimate.
- Renderer: WebGL, WebGPU, and Wasm in 3.8.
- Skeletal: Spine built in (3.8.6 added Spine 4.2 support); DragonBones supported.
- Particles: built in, with a particle system and a visual editor.
- Filters/shaders: custom effects via its effects system (Effect asset). Strong.
- Text: built in, bitmap font support.
- iOS notes: Cocos has a large mobile user base, but no iOS Safari specifics found.
- Simulation driving: scene graph and component model, same issue as Phaser: game state lives in components. External sim is driveable but the engine expects its own tick.
- No-build fit: poor. Its workflow is editor-first (`.scene` and `.prefab` files, project build). Using it means abandoning our plain-script layout.
- Community and docs: large Chinese and global community; English docs are good but editor-centric.

### Defold (HTML5)

- Version: 1.13.1, published August 17, 2026 (per Defold blog). Newer patches possible. 1.13.0 landed June 22, 2026.
- License: Defold License (free; engine source available; check terms).
- Bundle: third-party guide puts the empty web build around 1.06 MB; secondary source.
- Renderer: OpenGL/Vulkan on native; web via WASM (`wasm-web`). 1.13.0 removed the `js-web` target, so build scripts must use `wasm-web`.
- Skeletal: Spine supported via its Spine plugin. Sprite and tile animation built in.
- Particles: built in (particlefx).
- Filters/shaders: custom materials and shaders in Lua-driven pipeline.
- Text: built-in font system.
- iOS notes: none found for Safari specifically.
- Simulation driving: Lua/Lua-like scripts own the loop. Driving from our JS sim means a JS-to-Lua bridge, which is awkward. Not a good fit.
- No-build fit: poor. Editor and build pipeline, output is a bundled web app.

### Godot 4 web export

- Version: Godot 4.6 is the latest stable found, released early 2026 (one source says January 27, another February 27; sources conflict). Official release notes not confirmed by search.
- License: MIT.
- Bundle: web export is several MB of WASM plus assets. Not measured.
- Renderer: web export uses the Compatibility (WebGL 2) renderer only; Forward+ and Mobile are not available on web.
- Skeletal: Spine runtime available, 2D skeletal animation built in (AnimationPlayer, Skeleton2D); DragonBones community.
- Particles: GPU and CPU particles, good.
- Shaders: strong, in Godot's shader language.
- Threads and iOS: single-threaded export is the default since 4.3 and avoids SharedArrayBuffer and cross-origin isolation headaches. Official docs say the single-threaded export works well on macOS and iOS and that threaded exports had long-standing iOS issues. Some 2026 third-party articles claim threads now work; I could not confirm that from official sources, so do not rely on threaded builds on iOS. Safari has WebGL 2 quirks that the docs warn about.
- Simulation driving: Godot owns the loop. Feeding it external JS state means a JS bridge (`JavaScriptBridge`), which is awkward and adds latency per frame.
- No-build fit: no. Output is a Godot export, not a script you hand-write. Our code would become GDScript or a bridged JS app.
- Community and docs: very large, excellent docs.

### Plain Canvas 2D with our own helpers

- Version: n/a (browser API). iOS Safari supports `OffscreenCanvas` on current iOS.
- License: n/a.
- Bundle: zero. The helpers would be ours.
- Renderer: Canvas 2D, GPU-accelerated on iOS for `drawImage`.
- Batching: none. Each `drawImage` is a call. Practical budget on iPhone is several thousand small draws per frame, but `shadowBlur`, `filter`, and per-frame gradients are expensive. `ctx.filter` has historically been unsupported or unreliable on iOS Safari; check before using.
- Skeletal: none. Sprite sheets only.
- Particles: our own pooled system, straightforward.
- Filters: none. Outlines and shadows must be pre-baked into sprites.
- Text: fillText, or pre-rendered glyph atlas (we already do glyph caching in `render.js`).
- Simulation driving: perfect, because we own everything.
- No-build fit: perfect.
- Limitations: we write and maintain everything (camera, pooling, sorting, batching). The current renderer already shows the cost: 2,300 lines, emoji on discs. Canvas 2D can reach the look (pre-baked sprites, flat shading, outlines baked into PNGs) but the juicy effects (glow, bloom, outline shader, color grading) are the hard part.

## 3. Comparison table

| Engine | Version (latest found) | License | Renderer | Atlas and batching | Spine | Particles | Filters/shaders | Owns loop | No-build CDN | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PixiJS v8 | 8.20.x | MIT | WebGL2, WebGPU opt-in | Excellent | pixi-spine (licensed runtime) | Plugin or own | Good, custom GLSL | No (we drive) | Yes (UMD) | Best fit |
| Phaser 4 | 4.2.0 docs, April 2026 launch | MIT | WebGL (rewritten) | Excellent | Plugin (licensed) | Built in | Good | Yes (scenes) | Yes (UMD) | Runner-up |
| Kaplay | 3001.0.16 | MIT (memory) | WebGL | Decent | No | Basic | Moderate | Yes | Yes | Skip |
| Excalibur | 0.30.x? unconfirmed | BSD-2 (memory) | WebGL/Canvas | Good | No | Built in | Moderate | Yes | Likely | Skip |
| LittleJS | 1.18.21 | MIT (memory) | WebGL | Good, basic | No | Built in | Custom | No (callbacks) | Yes | Strong tiny option |
| Cocos Creator | 3.8.8 | MIT engine | WebGL/WebGPU/Wasm | Excellent | Built in | Built in | Strong | Yes | No | Wrong workflow |
| Defold | 1.13.1 (Aug 2026) | Defold License | WASM | Good | Plugin | Built in | Custom | Yes (Lua) | No | Wrong language |
| Godot 4.6 | 4.6 (early 2026) | MIT | WebGL2 (Compat) | Good | Runtime | Strong | Strong | Yes | No | Wrong workflow |
| Canvas 2D (own) | n/a | n/a | Canvas 2D | Manual | Manual | Manual | Manual | No | Yes | Fallback |

## 4. Spine, DragonBones, Spriter

- Spine: proprietary editor, runtimes are permissive, but distributing a game that plays Spine animations via a runtime requires a Spine license per the runtime license. Exporting to spritesheets, video, or GIF does not need the runtime license. Pricing from forum posts (unverified, may be outdated): Essential at $69 for small developers under $500k revenue; Enterprise $2,299 base plus $299 per seat. Check the current terms before choosing this path.
- DragonBones: open source (MIT), editor and runtimes free. Pixi and Phaser have community runtimes; quality varies.
- Spriter: commercial editor, runtimes exist but are niche.
- For 3/4 view with 8 directions, pre-rendered spritesheets from a 3D tool (see section 6) are a stronger first step than skeletal rigs. Skeletal is a second step for hero units only.

## 5. How Clash Royale renders (what is known and what is not)

What the sources found support:

- Supercell's Helsinki team works in Maya with Arnold, Substance Painter for textures, and ZBrush for detail sculpt, then bakes to game-ready meshes. Their PBR workflow is deliberately bent: near-flat base colors with a few variations, rough materials even for metal, to keep smooth color gradients. The Clash look comes mainly from modeling and texturing. (Adobe Substance 3D article on Supercell Helsinki; no GDC talk found.)
- Generic cel shading: flat shading with few tones, plus silhouette outlines from edge detection or an inverted-hull pass.

What the sources did not confirm, and what I believe from general knowledge (treat as unverified):

- Clash Royale uses 3D models rendered in real time with a fixed, angled camera (near-isometric, perspective). Pre-rendered 2D is not the case.
- Thick outlines and rim light are typical of its toon-style shader. Whether the outlines are inverted hull or post-process is not confirmed.
- Soft contact shadows under units and towers are present; they are cheap blobs or projected shadows.
- Saturated, high-contrast palette; strong key light from above, rim light for silhouette separation.

For a GDC-quality answer, search gdcvault.com for Supercell talks. None was found in this pass.

## 6. Practical 2D techniques to fake the look

1. Pre-rendered sprites from 3D. Model units in a 3D tool (Blender is free), render 8 directions per animation state at a fixed camera matching our projection, bake the cel look (toon ramp, outline via inverted hull or Freestyle line render). Output sprite sheets at 2x to 3x device resolution, trimmed, packed into atlases. This is the single biggest visual win.
2. Outline. Options, cheapest first: (a) bake outlines into the sprite PNG; (b) a one-pass GLSL outline shader sampling 4 or 8 neighbors of the alpha channel; (c) Pixi filter with 2-pixel dilation of alpha in a stroke color. Use (a) for units, (b) only for hero units.
3. Drop shadow. Pre-baked blurred ellipse texture, scaled by entity radius and flattened, drawn under each unit. Cheap. Use a single shared texture and a tinted sprite. Avoid per-frame `shadowBlur`.
4. Normal-mapped sprites. Useful for lighting response (rim light, directional highlight). Costs an extra texture and shader; limit to hero units. Defer until base look is working.
5. Projection math. Arena units are tiles (x 0 to 18, y 0 to 32). Pick a tilt angle t (about 55 to 65 degrees from the horizon for a Clash-like view). Screen position:
   - sx = (x - 9) * TILE_W + originX
   - sy = y * TILE_H * sin(t) - z * cos(t) + originY, with z the height above ground (0 for ground units, flying units get z > 0, tower height gets its own z).
   - Pick TILE_H from the tilt, for example TILE_H = TILE_W * 0.6 for a 3/4 view. Tune by eye.
   - Keep the engine's coordinates as the ground truth. Only the renderer converts.
6. Layering and y-sorting. Sort by sy (feet position), not by entity list order. Flying units render above ground units at the same sy by adding a layer offset. Towers sort by their base sy and draw their top on a separate pass if we want them to overlap units behind them. Use Pixi `sortableChildren` with `zIndex = sy` or a manual sort into a fixed number of layers, per frame.
7. Tower height. Towers are tall: draw the base at sy and the top offset upward by a fixed pixel height, and put the top in the higher layer so units walk behind it when north of it.
8. Hit flash. Tint to white for 80 ms (we already use FLASH_MS). In Pixi, `tint` plus a brief `filters` swap is cheap; avoid filters for hit flash, use a shared tint.
9. Squash and stretch. Scale transforms on spawn, attack, and landing (we have FALL_T and FALL_H for drops).
10. Screen shake. Offset the stage container by a decaying random vector.
11. Damage numbers. `BitmapText` pool, float up and fade, one per hit, capped at about 40 live.
12. Glows and trails. Additive blend sprites (`blendMode: 'add'`), pooled, sized by energy. Trails: ring buffer of last 6 positions per projectile.
13. Particles. Pooled sprites with a fixed cap (we have MAX_PARTS = 260), emitted from engine events, aged by our own dt.

## 7. Recommendation

Best engine: PixiJS v8 as a renderer, driven by our own fixed-timestep loop, with our existing engine and AI untouched.

Why:
- Fastest batching and the best sprite-count performance of the options that fit a no-build, plain-script project.
- Its UMD build loads from a CDN, so the project stays dependency-light and build-free.
- It does not own the game loop. We call `renderer.render()` after interpolating engine state, which matches the fixed-step engine exactly.
- Atlas, spritesheet, `ParticleContainer`, `BitmapText`, and custom GLSL filters cover every item in our effects list.
- Active development (8.19 to 8.20 during 2026) and a v8 migration guide.

Runner-up: Phaser 4. It is more complete (tweens, particles, Spine plugin, scale manager) and the rewritten WebGL renderer is promising. Two strikes: it wants to own the loop and scene model, which fights our engine, and its bundle is heavier for what we need. Pick it only if we later want built-in tweens and UI widgets badly enough to accept the cost.

Honorable mention: LittleJS. If we want the smallest possible dependency and total control of the loop, it is a near-perfect fit for the sim, but its asset and effects tooling is thin. Good for a prototype comparison, not for the look target.

Not recommended: Cocos Creator, Defold, Godot (editor-first, not plain script), Kaplay and Excalibur (own their loop and object model, no advantage over Pixi), plain Canvas 2D (fine as fallback, too much to rebuild for the look target).

### Renderer swap sketch

Module layout (all plain script, `var CR = (globalThis.CR = globalThis.CR || {});` pattern):

- `js/render/index.js`: `CR.Renderer` public API, same surface as today (`draw(game, t)`, layout, hit testing). Owns the Pixi `Application` and the rAF loop.
- `js/render/camera.js`: tile to screen projection, letterboxing, safe-area insets, resize.
- `js/render/atlas.js`: loads atlas JSON and PNG via `PIXI.Assets`, maps unit ids and animation states to frames.
- `js/render/units.js`: entity to sprite mapping. Pool of `AnimatedSprite`s keyed by entity id, reused across frames.
- `js/render/towers.js`, `js/render/terrain.js`: static layers, rendered once to a `RenderTexture` for the arena background and river.
- `js/render/effects.js`: consumes `game.effects` and `game.events`, owns particle pools, shake, damage numbers, flashes.
- `js/render/hud.js`: cards, elixir bar, timer, crowns. Keeps DOM or Pixi text, one choice.
- `js/render/interp.js`: stores previous and current snapshot of positions per entity, returns `lerp(prev, curr, alpha)` where alpha = accumulator / (1/30).

Per-frame flow:

1. rAF fires. Accumulate real dt. Call `game.update(1/30)` in fixed steps if we own the sim tick (or the main loop already does; keep existing behavior).
2. Snapshot positions into `interp` when a sim tick happens.
3. For each live entity: find or create a view from the pool, set interpolated position, facing, state (idle, move, attack, dead), flash, scale. Mark it seen.
4. Release views not seen this frame back to the pool (hide, do not destroy).
5. Set `zIndex` from sy, let Pixi sort (`sortableChildren = true`), or sort a plain array into layers.
6. Feed `game.events` into the effects module. It spawns from its pools and ages with real dt.
7. Apply camera shake to the world container.
8. `app.renderer.render(stage)`.

Pooling rules: never create or destroy display objects in the render path; use pools with caps; `BitmapText` pool for damage numbers; particle pool capped at 260 (existing constant).

Art pipeline dependency: the `assets3d` agent's output (8-direction sprite sheets, atlas JSON) is a hard prerequisite for the look target. Coordinate atlas naming with it first.

### Migration effort estimate

Assumes one developer who knows Pixi, working in this repo:

- Spike (1 to 2 days): Pixi UMD loads on iPhone in the PWA, one unit with an animated sprite, 60 fps on device with 40 units and 200 particles. Go or no-go gate.
- Renderer parity (5 to 8 days): arena, river, bridges, towers, units, projectiles, spells, HUD, input and hit testing via existing layout code.
- Effects and juice (4 to 6 days): flashes, shake, particles, damage numbers, trails, glows.
- Art integration (depends on assets3d, 3 to 10 days): atlas loading, 8-direction state mapping, outline and shadow baking.
- Polish and device QA (3 to 5 days): safe areas, resize, context loss, memory on older iPhones.

Total: about 3 to 5 weeks of focused work, with art pipeline timing as the largest variable. The existing renderer's layout and hit testing can be kept, which cuts parity work.

## 8. Risks

- iOS memory and context loss. Large atlases and many textures can trigger WebKit memory kills. Keep atlases at or under 2048 px, limit texture count, and handle `webglcontextlost` by rebuilding textures.
- Device pixel ratio cost. Cap `resolution` at 2 on iPhone to keep fill rate down. Verify on an older iPhone, not just the simulator (we skip the simulator per project workflow).
- Pixi v8 API churn. Pin exact versions. Read the migration guide before every minor upgrade.
- Third-party packages lag. `pixi-filters` and `@pixi/particle-emitter` v6 compatibility with the exact Pixi version must be checked on npm. Our own particle pool may be simpler than depending on either.
- Spine licensing if we adopt skeletal units. Stay with spritesheets for the first pass.
- Look target uncertainty. We do not have a verified breakdown of Clash Royale's shader. Build one reference unit before committing the whole pipeline.
- Engine version drift. CDN URLs and UMD paths change between majors; verify the path for the pinned version and keep a local fallback copy in `vendor/` if we want offline PWA behavior (service worker cache).
- Test coverage. Renderer is not covered by the Node tests. Keep `CR.Game` and `CR.AI` tests as they are, and add a headless smoke test that constructs the renderer state without a canvas.
- Unverified numbers. Bundle sizes, Kaplay/Excalibur versions, pixi-filters compatibility, and Godot release dates all conflict or lack sources. Re-check before any decision that depends on them.
