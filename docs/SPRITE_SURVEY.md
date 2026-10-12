# ClashAI sprite survey

Research date: 2026-10-11. Prices and terms come from store pages and search snippets at that date. Re-check the store page before buying or shipping. This is not legal advice.

Target look: chunky, saturated cartoon units with thick outlines, a 3/4 top-down angle, stone towers, a green arena with river and wooden bridges, juicy spell and hit effects, and Clash-style UI (card frames, elixir drop, crowns, chunky buttons).

## Bottom line

- No single pack matches the target look. Every candidate is missing at least one of: a true 3/4 view, multi-direction animation, a giant, bridges, elixir or crown icons.
- The closest mood match is Pixel Frog's Tiny Swords. It has team-colored units with outlines, 64px grass and water terrain, buildings, effects, and UI. Its free pack is the cheapest way to start.
- Two packs found on itch.io are named "Clash Royale Pixel characters." They depict Supercell's characters. Do not use them. See the excluded list.
- Public repo: Tiny Swords and CraftPix both prohibit redistributing raw source files. Committing the raw PNGs to a public repo is the risky case. See the license section.

## Recommended combination (Combo A): Tiny Swords core, mostly free

| Role | Pack | Price | License summary |
|---|---|---|---|
| Units, enemies, terrain, buildings, effects, UI | Tiny Swords Free Pack + Enemy Pack (Pixel Frog) | Free, plus $15+ for Enemy Pack | Commercial use and modification OK. No redistribution or repackaging. Credit not required. |
| Towers, extra ground and roads | Tower Defense (Top-Down), Kenney | Free | CC0. No attribution required. |
| Card frames and buttons | Card game GUI (creavibe) | $4.99+ | Check listing (not verified). |
| Optional extra units (goblins, bats) | Tiny Kingdom Armies (two-faces-studio) | $3.99+ (demo free) | Commercial use listed as allowed. Redistribution and credit not stated. |

Estimated total: about $20 (about $24 with Tiny Kingdom Armies).

Why it is closest: Tiny Swords puts five faction colors on every unit, pawn, and building, so blue vs red maps directly onto Clash team colors. Its enemy pack already has roles that map to Clash units:

| Clash role | Tiny Swords Enemy Pack unit |
|---|---|
| Knight, Barbarian | Warrior |
| Archer | Archer |
| Goblin, Spear Goblin | Torch Goblin, Slingshot Gnome |
| Bats, Minion | Giant Bat, Bumblebee |
| Monk (support) | Monk |
| Giant, Balloon, PEKKA, Prince, Witch, Golem | Gap (see below) |

Tiny Swords details (from the store page, as fetched):
- Grid 64x64. Sprite sizes per unit not stated.
- Animation speed 10 fps. Directions not stated (units look like side-facing with flip, to verify).
- All PNG, Aseprite sources included. A Unity version exists.
- Terrain: water-edge tiles, elevations, stairs, shadows, 5 grass colors, clouds, animated water, bushes, rocks.
- Effects: 2 dust, 3 looped fire, 2 explosions, water splash.
- UI: paper banner, wood table, swords, ribbons, round and square buttons, cursors, 12 icons, mostly stretchable.
- Free pack includes all human units. Enemy pack: 22 enemies claimed (8 more coming), named in devlog: Imp, Bumblebee, Giant Bat, Slingshot Gnome, Torch Goblin, Boompuff, plus Warrior, Lancer, Archer, Monk.
- Note: the store page lists a "TS_old version_CC0 Licensed" download (2.6 MB). If that older build is truly CC0, it is the safest copy for a public repo. Verify the license file inside the download before relying on it.

Gaps for Combo A:
- Giant, Balloon, PEKKA, Golem, Witch: no direct match. Fill with recolored or re-proportioned units, or commission.
- Bridges: not confirmed in Tiny Swords. Kenney commenters also asked for bridges and water tiles; the author did not add them. Plan to draw wooden bridges or use a tile-stamp approach.
- Elixir and crown icons: none found. Draw them, or generate with an image model and clean up.
- Card frames: creavibe pack is generic. A custom frame in the same outline weight is likely needed.
- Effects: Tiny Swords effects are generic (dust, fire, explosion, splash). Spell VFX (zap, freeze, rage, arrows) need another source or procedural effects.

## Combination B: CraftPix-led (towers and monsters)

| Role | Pack | Price | Notes |
|---|---|---|---|
| Monsters, towers, magic FX, tiles, UI | Fantasy Tower Defense Game Kit (CraftPix, free-game-assets mirror on itch) | $1.60+ pay-what-you-want (list $16). CraftPix bundle listed at $49 for this plus 774 others. | Archive 816 MB. 40 monsters claimed, but a buyer reports 10 in the download. Towers: 4 upgradable types. Magic: 8 effects (fire, acid rain, slow, freeze, damage boost, armor reduction, rockfall, lightning). Formats: AI, EPS, PNG, SCML. Enemies appear to be single-direction (unconfirmed). License not stated on page; check CraftPix license. |
| More towers and enemies | Tower Defense (Pixelated Studioz) | $2+ | Claims 70 towers (another listing says 68), 39 enemies. Style not described. License: commercial use OK, no resale, credit required. |
| Card kit | Card Game GUI, Cards Design 2D Kitbash (KatGrabowska) | $7+ | Fantasy hand-painted frames and icons (cauldron, ring, coin pouch). No elixir or crown. Credit not required. |

Estimated total: about $11 to $26.

Fit: the CraftPix kit covers the tower-defense side (towers, magic, tiles) well and comes from one vendor, which helps consistency. Weak points: single-direction monsters (no walking in 4 or 8 directions), uncertain perspective, and a CraftPix license that forbids distributing source files. Pixelated Studioz pack has no style description, so pull its preview before buying.

## Combination C: Pixel-art premium mix

| Role | Pack | Price | Notes |
|---|---|---|---|
| Towers, guns, monsters | Pixel Art Tower Defence Pack (AFGameAssets) | 16.99 EUR+ | 588 hand-drawn sprites. Characters with 5 states: Idle, Run, Attack, Hit, Death. Rock and wood towers. Guns with 8 directions. Unity package. Top-down, not clearly 3/4. |
| Knights and archers | Castle Siege Pack (SpikerMan) | $1.99+ | Red and blue knights and archers, battering ram, catapult, detailed frame counts. PNG. Personal and commercial use, no credit required. No goblins or giants. |
| Extra units | Tiny Kingdom Armies | $3.99+ | See Combo A. |
| Spell VFX | 2D Pixel Art Spell Effects Bundle (Elthen) | $15+ | 20 effects: small 32x32 elemental and arcane, medium 96x128 elemental, arcane floor, shower, swirl, teleport. PNG sheets with JSON. License on Patreon post (not checked). |
| Card UI | Card game GUI (creavibe) | $4.99+ | See Combo A. |

Estimated total: about $27 plus EUR 17 (about $45 USD). Risk: mixing 32px pixel effects with 16 to 64px units and an unknown outline weight across packs. Expect to scale or re-outline VFX.

Fit: most animation states of any option (AFGameAssets). Good for a sprite-animation engine, but the look is more "pixel tower defense" than Clash.

## Ranking against the Clash target

1. Combo A. Closest in mood (faction colors, outlines, grass and water tiles). Cheapest. Biggest gaps are giant, bridges, icons.
2. Combo B. Better monsters and magic FX coverage, but single-direction enemies and license limits on source files.
3. Combo C. Most animation states, but mixed pixel scales.

## Full candidate list

Format per entry: name, URL, author, price, license, perspective, size, animation, format, coverage, preview.

### Free

1. Tiny Swords (Free Pack, Pixel Frog). https://pixelfrog-assets.itch.io/tiny-swords
   - Author: Pixel Frog. Price: name your own price (free tier). Enemy pack $15+.
   - License: commercial and modification allowed. Redistribution, resale, and repackaging prohibited, even modified. Credit not required, welcome.
   - Perspective: 3/4 style per preview (to verify). Grid 64x64.
   - Animation: idle, attack, death style per enemy (verify). 10 fps.
   - Formats: PNG, Aseprite source.
   - Coverage: human units (free), enemies (paid), terrain, buildings, effects, UI.

2. Tower Defense (Top-Down), Kenney. https://opengameart.org/content/tower-defense-top-down
   - Author: Kenney. Free. Preview: https://opengameart.org/sites/default/files/Preview_124.png and Sample_32.png
   - License: CC0. Credit optional.
   - Perspective: top-down. Size: separate PNG 300x (per listing), tilesheets, vector, retina sizes.
   - Coverage: ground tiles, roads, towers, particle effects, enemies, HUD numbers. No bridges or water (requested in comments).
   - Also: Kenney's own site (kenney.nl) for the current version. Kenney's support page confirms CC0 and that the logo is reserved.

3. Tower Defense Assets (Kenney, isometric). OpenGameArt. CC0. Isometric, so not a fit for 3/4 top-down. Listed for completeness.

4. Stone Tower Defense Game Art (CraftPix, free). OpenGameArt. OGA-BY 3.0 (attribution). 12 stone tower designs. Good for the stone tower look.

5. Monster 2D Sprites Game (CraftPix, free). OpenGameArt. OGA-BY 3.0 (attribution). Free monsters, not checked for directions.

6. Top-Down RPG Character Sprites Pack (GameArt2D). https://gameart2d.com/game-sprites-1.html
   - Author: GameArt2D. Price: not listed (buy via Sellfy, bundle option).
   - Contents: knight and archer heroes, pink and green slime, orange and green mushroom. Top-down. Vector sources (CorelDraw, AI, EPS) plus PNG animation sequences.
   - Directions: not stated (alt text suggests 4-directional). Size: not stated.
   - License: not on page. Check the linked license page.
   - Preview: https://www.gameart2d.com/uploads/3/0/9/1/30917885/1402626568.jpg
   - Note: this is GameArt2D's product page, found via search. Their broader catalog was not reviewed.

7. Medieval Services Vol.1 (free sample). CC0 per tags, but free sample has one NPC facing down only. Full pack on itch.io.

8. Hand-Drawn Square Characters Animated 8 Directions (RGS_Dev). https://rgsdev.itch.io/hand-drawn-square-characters-animated-8-directions-top-down-free-cc0
   - CC0, 8 directions, 128x128. Four characters (hero, skeleton, monster). Small set, but 8-direction walk is useful for prototyping.

9. Pixel Quest Vol 2: The Necromancer's Order (barely-games). https://barely-games.itch.io/pixel-quest-vol2-the-necromancers-order
   - Necromancer, skeleton knight, captain, archer, armored, common. 8-direction animations. PNG frames. 16x16 grid. Pixel-art, not outlined cartoon. Price not seen.

10. Elemental Spell VFX Vol 1 (Fab). https://www.fab.com/listings/4ab305c2-a890-45c2-9b4b-f1a72552de3c
    - Search snippet only: 32 spell impacts, 8 schools (fire, ice, lightning, poison), 4 variations each, flipbook frames. Title match not confirmed on the page. Price and license not checked.

11. 8 directional sprite sets (Technopeasant). OpenGameArt. CC0, enemy sprites with 8 directions. Fantasy content unknown.

12. 8d run/walk and idle sheet (adhochero). OpenGameArt. CC0. 8x8 frames, too small for a detailed unit.

### Paid (under about $25)

13. Tiny Kingdom Armies (Two Faces Studio). https://two-faces-studio.itch.io/tiny-kingdom-armies
    - $3.99+ (free demo, 2 units). Units: Archer, Lancer, Knight, Mounted Soldier, Rogue Goblin, Witch Goblin, Chained Goblin, Tinkerer Goblin, Battle Soul. No giant.
    - Animations: idle, basic attack, special attack, death. Blue and red outline variants.
    - Size and directions not stated. Formats: individual sprites and spritesheets (types not named). Download 317 kB.
    - License: commercial allowed (listed). Redistribution and credit not stated. No generative AI.

14. Castle Siege Pack (SpikerMan). https://spikerman.itch.io/castle-siege-pack
    - $1.99+. Knights and archers in red and blue, battering ram, catapult. PNG.
    - Commercial and personal use, no credit. No goblins or giants.

15. Pixelated Studioz "Tower Defense". https://pixelated-studioz.itch.io/tower-defense
    - $2+. 70 towers (another listing says 68), 3 worlds, 39 enemies (knights, cavalry, militia, soldiers). 2 walls.
    - License: commercial OK, editing OK, no resale or distribution of asset, credit required.
    - Style not described. Check preview.

16. Fantasy Tower Defense Starter Pack (certainity). https://certainity.itch.io/fantasy-tower-defense-starter-pack
    - Pay-what-you-want. Hero, enemies, towers, UI. Cartoon fantasy, readable shapes. AI-assisted artwork (per listing). License not checked.

17. Card game GUI (creavibe). https://creavibe.itch.io/card-game-gui
    - $4.99+. 31 items: cards, buttons, chips. PNG and PSD. Cartoon vs not stated.

18. Card Game GUI, Cards Design 2D Kitbash (KatGrabowska). https://katgrabowska.itch.io/card-game-gui-cards-design
    - $7+. 5 card fronts, 3 oval frames or buttons, 4 hand-painted icons (cauldron, ring, coin pouch, coin). Credit not required.

19. Cartoon Game UI Assets (nesoqq). https://nesoqq.itch.io/generic-cartoon-ui-kit-v1/purchase
    - Pay-what-you-want. Cartoon icons and buttons. 17 MB zip. Not card-specific.

20. Card Creator Toolkit (Penzilla). https://penzilla.itch.io/card-creator-toolkit
    - Card frames in 13 colors (silver, gold, epic), 50 icons. Retro or tabletop look. Price not seen.

21. Fantasy Card Assets (derrick008). https://derrick008.itch.io/fantasy-card-assets
    - $6.99+. Frames: gold, iron, crystal, wood, stone, dragon. Themes: fire, ice, nature. Listing discloses AI-assisted graphics.

22. 2D Pixel Art Spell Effects Bundle (Elthen). https://elthen.itch.io/2d-pixel-art-spell-effects-bundle
    - $15+. 20 effects (see Combo C). PNG sheets with JSON. License on Patreon post, not checked.

23. Pixel Art Tower Defence Pack (AFGameAssets). https://afgameassets.itch.io/pixel-art-tower-defence-pack
    - 16.99 EUR+. 588 sprites. Characters: Idle, Run, Attack, Hit, Death. Guns with 8 directions. Monsters and projectiles. Rock and wood towers. Unity package.

24. Fantasy Tower Defense Game Kit (CraftPix, via free-game-assets). https://free-game-assets.itch.io/fantasy-tower-defense-game-kit
    - $1.60+ pay-what-you-want (list $16). Preview: https://img.itch.zone/aW1hZ2UvMjUxMzYzLzEyMDIwMDYuanBn/347x500/qiJIWi.jpg
    - See Combo B. License on CraftPix store (not checked).

25. Tiny Swords Enemy Pack (Pixel Frog). Same page as #1. $15+. See Combo A.

### Other CraftPix items (found in search, not fully checked)

- Boss Monster 2D Sprites (free-game-assets.itch.io/boss-monster-2d-sprites): attack, death, hurt, idle, run, walk animations. AI, EPS, PNG, SCML.
- Tower Defense Tileset (free-game-assets.itch.io/tower-defense-tileset): 100% vector. For building levels.
- Free Stone Tower Defense Game Art (free-game-assets.itch.io/free-stone-tower-defense-game-art): stone towers, related to #4.
- Monster 2D Sprites (OpenGameArt): OGA-BY 3.0.

CraftPix general license (craftpix.net/file-licenses/):
- Commercial: allowed. Games can be sold with assets (1.1.4). Freebies also allowed for commercial projects (2.1.1).
- Redistribution: "Distribution of source files is NOT permitted" (1.1.3). Source files (PNG, JPG, EPS, AI) cannot be resold or shared so others can use them.
- Attribution: not required for freebies. Premium terms do not mention it.
- AI: assets may not be used to train or fine-tune AI or ML systems (3.1.1).
- Enterprise tier: graphics cannot be distributed outside courses or templates (1.3.2.4).

## Excluded: Supercell characters

- Clash Royale Pixel characters asset (Pixel_Fries): https://pixel-fries.itch.io/clash-royale-pixel-characters-asset
  - 10 characters: Mini PEKKA, Valkyrie, Skeleton, Barbarian, Knight, Goblin, Minion, Hog Rider, Giant, Tesla. Unity package. Listed as "a little asset of animated characters from clash royale." Price name-your-own. No license stated. No trademark disclaimer.
- Clash Royale Pixel characters asset 2 (Pixel_Fries): https://pixel-fries.itch.io/clash-royale-pixel-characters-asset2
  - Archer, Battle Ram, Bomber, Giant Skeleton, PEKKA, Prince, Spear Goblin, Witch, 2 towers.

These depict Supercell's characters. They are not licensed for reuse in a public game. Do not use them, and do not use them as reference to copy designs closely.

## License and public-repo question

Owen's ClashAI repo is public and deployed to GitHub Pages. Relevant clauses:

| Pack | Redistribute raw files? | Public repo? | Credit |
|---|---|---|---|
| Tiny Swords | No. "You may not redistribute, resell, or repackage the assets, even if the files are modified." | Committing raw PNGs to a public repo is redistribution. Risky. | Not required |
| CraftPix (all) | No. "Distribution of source files is NOT permitted." | Risky. | Free packs: not required. |
| Kenney (CC0) | Yes | Fine | Optional |
| Tiny Kingdom Armies | Not stated | Ask or assume risky until clarified | Not stated |
| Castle Siege | Not stated | Check | Not required |
| Pixelated Studioz | No resale or distribution of asset | Risky | Required |
| Elthen spell bundle | Check Patreon post | Check | Check |

What solves it:
- Keep raw vendor packs out of the public repo. Options: (a) a private repo for the art, (b) a gitignored folder (for example assets/raw/) that a setup script fills from local copies, or (c) store only the Kenney CC0 files and any art you draw or generate yourself in the public repo.
- Serving assets in a deployed game is different from redistributing source files. CraftPix says using assets as part of play "appears to be permitted," and Tiny Swords allows commercial use in a shipped project. Serving the spritesheets a game needs still publishes the PNGs, though. For Tiny Swords and CraftPix, check with the vendor or pick Kenney CC0 for anything that ends up in the public Pages build.
- A reasonable compromise: publish only packed atlases (combined spritesheets) with CC0 or your own art in the public build, and keep the vendor source sheets private.
- This is a reading of the license text, not legal advice.

## Gaps and how to fill them

| Gap | Fill |
|---|---|
| Team colors | Recolor by palette swap (Tiny Swords already ships blue and red). |
| Giant, Golem, Balloon, PEKKA, Witch | Commission one or two units in the same outline style. Or generate a base with an image model, then hand-clean the outline. |
| Wooden bridges and river | Draw a tile set in the Tiny Swords 64px grid. |
| Elixir drop and crown icons | Draw with a vector tool, or generate and clean. |
| Chunky buttons, card frames | creavibe or KatGrabowska kit, then recolor. |
| Spell VFX (zap, freeze, rage, arrows) | Elthen bundle (scale 32px up with nearest-neighbor), or procedural: tweened sprites, particle bursts, screen shake. |
| Hit flash and death juice | Procedural: white flash shader, squash-and-stretch tweens. |
| Multi-direction walking | Use 2-direction flip (Tiny Swords), or fill with 4-direction packs. |

## Items not verified

- Tiny Swords sprite sizes and directions for individual units.
- Tiny Kingdom Armies and Castle Siege perspective and outline weight (from previews only).
- Elthen and CraftPix license terms (on linked pages, not fetched).
- CreativeKind "Mega Pack Elemental Spell Effects" ($13.05) and "Mega Pack Spell Effects 02" ($20.88): search snippets only, no URL retrieved, poison coverage not confirmed.
- GameArt2D catalog beyond the top-down RPG pack.
- Unity Asset Store and GameDev Market, Envato Elements, Humble Bundle: not searched in this pass.
- Existing docs/ASSET_SURVEY.md was not cross-checked against this survey.
