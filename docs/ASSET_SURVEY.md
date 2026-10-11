# Asset Survey: Clash Royale style art kit

Research only. Nothing was downloaded. Pages were read on 2026-10-11.

Fit scores (1 to 5) are based on page descriptions, tags, and preview text. Most image sets were not viewed directly, so treat the scores as a first pass and confirm visually before committing.

## Recommendation

There is no single license-clean pack that covers the full list in one matching style. Two options follow. Owen picks the license tradeoff.

### Option A: Strict CC0 build (ship-safe)

Cohesive enough to ship, with procedural canvas drawing for the troop roster and effects that no pack covers.

| Role | Asset | License | Size | URL |
|---|---|---|---|---|
| Ground, roads, towers, enemies, particle effects | Kenney Tower Defense (Top-Down) | CC0 1.0 | 3.3 MB zip, 300 PNG | https://kenney.nl/assets/tower-defense-top-down |
| Buildings, tiles, units | Kenney Medieval RTS (120+) | CC0 1.0 | 1.8 MB zip, 127 PNG | https://kenney.nl/assets/medieval-rts |
| Wooden bridge | Wood Bridge by Xavier4321 | CC0 | 552 KB PNG (plus 3.1 MB SVG) | https://opengameart.org/content/wood-bridge |
| Card frames, panels | Kenney Fantasy UI Borders | CC0 1.0 | 130+ PNG | https://kenney-assets.itch.io/fantasy-ui-borders |
| Buttons, sliders, panels | Kenney UI Pack | CC0 1.0 | 430 files | https://kenney.nl/assets/ui-pack |
| Effects (smoke, sparks, fire) | Kenney Particle Pack | CC0 1.0 | 80 files | https://kenney.nl/assets/particle-pack |
| Humanoid troops (partial) | Kenney Tiny Dungeon | CC0 1.0 | 130 files, 16x16 | https://kenney.nl/assets/tiny-dungeon |
| Heading and UI font | Lilita One (or Titan One) | SIL OFL 1.1 | web font | https://fonts.google.com/specimen/Lilita+One |
| Elixir drop, crown icons | game-icons.net | CC BY 3.0 (credit required) | per icon | https://game-icons.net |

Known download size for the core: about 5.7 MB (Tower Defense, Medieval RTS, Wood Bridge). The other Kenney packs do not show sizes on their pages. Expect a few MB each; confirm on download.

Attribution line needed for game-icons.net: "Icons made by {author}. Available on https://game-icons.net". Kenney packs need no credit (credit to Kenney.nl is optional).

Downloads from kenney.nl go through a "Continue without donating" link. It is a donation prompt, not a paywall.

### Option B: Tiny Swords (best look, license blocker)

Tiny Swords by Pixel Frog is the closest visual match to Clash Royale: chunky 2D top-down pixel art on a 64 px grid, blue and red faction variants out of the box, towers and castles, grass, water edges, animated water, and UI banners and buttons.

Its license is not CC0. The page says:

- "Feel free to use this asset pack in both personal and commercial projects, modifying the assets as needed."
- "You may not redistribute, resell, or repackage the assets, even if the files are modified."

A browser game serves these PNGs to every visitor. That is arguably redistribution. Two ways forward:

1. Email Pixel Frog for written permission to ship the assets in a web game.
2. Check the "TS_old version_CC0 Licensed" download (2.6 MB) listed on the same page. It is labeled CC0, but its license file and contents were not reviewed. If it holds up, it becomes the primary art.

Tiny Swords has no bridges. Use the Wood Bridge tiles from Option A either way.

Pricing: Free Pack 3.3 MB, name-your-price. Enemy Pack 2.6 MB, $15 or more, adds Warrior, Lancer, Archer, Monk, and 22 enemies.

## Gap coverage and suggestions

| List item | Best source | Gap and suggestion |
|---|---|---|
| Grass arena | Kenney Tower Defense tiles; Tiny Swords grass if cleared | None |
| River | None confirmed CC0 | Draw procedurally: water fill, animated wave lines, shoreline tint. The Summer Engine water sheet is AI-generated; skip it. |
| Wooden bridges | Xavier4321 Wood Bridge (CC0) | None |
| Stone towers (princess, king) | Kenney Medieval RTS, Kenney Tower Defense; Tiny Swords defense towers and castles | Recolor for blue and red procedurally (hue shift or tinted overlay). Kenney packs are single-color. |
| Troops (about 30) | Kenney Tiny Dungeon (humanoids, partial); Kenney Medieval RTS units (partial) | No CC0 pack covers the roster. Draw procedurally on canvas: team-colored body, outline, simple face, idle bob. Use Tiny Swords units if Option B clears. Giant, golem, royal giant, balloon, baby dragon, bats, ice spirit, and similar need procedural shapes. |
| Cannon, inferno tower, tombstone, goblin hut | Kenney Medieval RTS and Tower Defense (partial) | Procedural for the rest. |
| Arrow, cannonball, fireball, rocket, spear | Kenney Tower Defense may include projectiles (not confirmed) | Procedural: 2 to 4 line or circle sprites. |
| Explosions, smoke, fire | Kenney Particle Pack; Tiny Swords dust, fire, explosion, splash | None |
| Lightning, ice, poison cloud, log | None | Procedural: radial gradients and additive blending on canvas. |
| Card frames | Kenney Fantasy UI Borders (9-slice) | None |
| Buttons, panels, bars | Kenney UI Pack | Generic look. Restyle with the chunky font and borders if needed. |
| Elixir drop, crowns | game-icons.net (CC BY 3.0) | Monochrome; recolor. Credit line required. Procedural alternative for a more Clash-like gold crown. |
| Display font | Lilita One, Titan One (OFL per third-party aggregator; confirm on Google Fonts) | Luckiest Guy is a close match in weight, but its license is unverified (believed OFL; confirm on fonts.google.com). |

## Full candidate table

Style column notes the view and pixel grid where the page gave it. "Not stated" means the page did not say.

| # | Name | URL | License and attribution | Size | Style | Covers | Fit | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | Tiny Swords (Free Pack) | https://pixelfrog-assets.itch.io/tiny-swords | Custom. Personal and commercial use allowed. Credit optional. No redistribution, resale, or repackaging. Not CC0. | 3.3 MB | Pixel art, 64 px grid, 2D top-down cartoon, PNG plus Aseprite source | Human units in 5 faction colors (blue and red used here), 8 buildings including houses, barracks, defense towers, castles; grass, water edges, animated water, bushes, rocks, clouds; banners, wood tables, buttons, cursors, icons; dust, fire, explosion, water splash | 5 | Best look. Blocked for web shipping until license is cleared. No bridges. |
| 2 | Tiny Swords (Enemy Pack) | same page | Same custom license | 2.6 MB | Same | Warrior, Lancer, Archer, Monk, 22 enemies (8 more planned) | 5 | Paid, $15 or more. Same license blocker. |
| 3 | Tiny Swords "TS_old version_CC0 Licensed" | same page, download list | Labeled CC0 on the page. License file not reviewed. | 2.6 MB | Presumed same style | Not listed | 4 (pending) | Verify license file and contents before use. |
| 4 | Kenney Tower Defense (Top-Down) | https://kenney.nl/assets/tower-defense-top-down (zip: https://kenney.nl/media/pages/assets/tower-defense-top-down/729844df28-1677693738/kenney_tower-defense-top-down.zip) | CC0 1.0. Credit optional. | 3.3 MB | 2D top-down, 300 PNG plus tilesheets and vector | Ground tiles and objects, roads, towers, particle effects, enemies, HUD numbers | 3 | Strong CC0 core. Enemy and tower look not visually verified. |
| 5 | Kenney Medieval RTS (120+) | https://kenney.nl/assets/medieval-rts (OpenGameArt: https://opengameart.org/content/medieval-rts-120; zip: https://kenney.nl/media/pages/assets/medieval-rts/0863f2c62a-1677693589/kenney_medieval-rts.zip) | CC0 1.0. Credit optional. | 1.8 MB | RTS style, 127 PNG, spritesheets, tilesheets, vector, retina sizes; view angle not stated on page | Structures, environment objects, units, tiles | 3 | Units and buildings confirm the most matches for towers and huts. Verify view angle. |
| 6 | Kenney Tiny Dungeon | https://kenney.nl/assets/tiny-dungeon (zip: https://kenney.nl/media/pages/assets/tiny-dungeon/f8422efb44-1674742415/kenney_tiny-dungeon.zip) | CC0 1.0 | Not shown; 130 files | 16x16 pixel, roguelike; view not stated | Dungeon tiles; character list not shown on page | 2 | Too small and flat for a chunky look unless scaled 3x with nearest-neighbor. |
| 7 | Kenney Roguelike/RPG pack (1,700+ tiles) | https://opengameart.org/content/roguelikerpg-pack-1700-tiles | CC0 | Not checked | 16x16 pixel, top-down | Floors, walls, flora, furniture, banners; no characters | 1 | Environment decor only. |
| 8 | Kenney Particle Pack | https://kenney.nl/assets/particle-pack (zip: https://kenney.nl/media/pages/assets/particle-pack/f8fe0f8cb8-1677578741/kenney_particle-pack.zip) | CC0 1.0 | Not shown; 80 files | Particle PNG, vfx | Effects contents not listed on page | 3 | Use for explosions, smoke, sparks after a visual check. |
| 9 | Kenney UI Pack | https://kenney.nl/assets/ui-pack (zip: https://kenney.nl/media/pages/assets/ui-pack/f651646eab-1718203990/kenney_ui-pack.zip) | CC0 1.0 | Not shown; 430 files | Flat UI, buttons, panels, sliders | Buttons, panels, sliders | 3 | Generic look. |
| 10 | Kenney Fantasy UI Borders | https://kenney-assets.itch.io/fantasy-ui-borders (OpenGameArt: https://opengameart.org/content/fantasy-ui-borders) | CC0 1.0. Credit optional. | Not shown; 130+ PNG | 9-slice fantasy frames, tilesheet, vector | Card frames, dialog panels | 4 | Best CC0 match for card frames. |
| 11 | Wood Bridge (Xavier4321) | https://opengameart.org/content/wood-bridge | CC0. Author asks to be notified of additions. | BridgeTiles.png 552 KB; Bridge.svg 3.1 MB | 2D top-down bridge tiles, Inkscape source | Wooden bridges | 3 | Only CC0 wooden bridge tileset found that fits. |
| 12 | Kenney Top-down Tanks Redux | https://kenney-assets.itch.io/top-down-tanks-redux | CC0 | Not shown | Top-down, military | Explosions, barrels, crates, roads | 2 | Theme mismatch. Possible explosion and prop source. |
| 13 | game-icons.net | https://game-icons.net | CC BY 3.0. Credit required: "Icons made by {author}. Available on https://game-icons.net" | Per icon SVG | Monochrome 512 px vector icons | Crown, droplet, card and ability icons | 2 | Needs recolor. Attribution required. |
| 14 | Mini Fantasy Sprites (GrafxKid) | https://opengameart.org/content/mini-fantasy-sprites | Listed CC0; page asks for credit to GrafxKid | Small | Small fantasy sprites | Wizard, spear orc, fire | 2 | Too few units for the roster. |
| 15 | Top Down Adventure Assets (ansimuz) | URL not retrieved; find via OpenGameArt search | CC0 (per listing). Credit not required, appreciated. | Not shown | 16x16 top-down fantasy | Player (4 directions), 10 NPCs, 2 tilesets | 2 | Characters rather than troops. Possible humanoid source. |
| 16 | Monsters Creatures Fantasy (luizmelo) | https://luizmelo.itch.io/monsters-creatures-fantasy | CC0 | Not shown | Platformer side view | Skeleton, goblin, 4 creatures | 2 | Side view; does not match top-down. |
| 17 | Freeciv unit set (YD) | https://opengameart.org/content/a-set-of-units-for-freeciv | CC0 | Not shown | 32x32 isometric | Strategy-era units | 1 | Not fantasy. |
| 18 | Free Top-Down Knight and Skeleton (nykk3) | https://nykk3.itch.io/free-top-down-knight-and-skeleton | License not stated | Small | Pixel top-down | Knight, skeleton (2 sprites) | 2 | Excluded until license is stated. |
| 19 | Anokolisa Scarlet Monastery fantasy pack | https://anokolisa.itch.io/fantasy-pack-vliii-scarlet-monastery | "Free for commercial use, study, and editing. Credits optional." No named license. $2.50 minimum. | Not shown | Pixel fantasy | Monastery and fantasy assets | 3 | License not CC0 or named. Ask the artist before use. |
| 20 | Fantasy Skeleton Army (blpixelartist) | https://blpixelartist.itch.io/fantasyskeletonarmy | No license stated; name-your-price | Not shown | Top-down skeletons | Skeleton king, swordsmen, spearmen, archers, crossbowmen | 3 | Excluded until license is stated. Skeleton source only. |
| 21 | EPIC TINY ARMYS | https://thescrawlhive.itch.io/epic-tiny-armys | No license stated; pay what you want | Small | Small sprite sheet | Goblins, knights, skulls | 2 | Excluded until license is stated. |
| 22 | Elegant Goblins (DevGamePiccolo) | Found via itch.io search; URL not retrieved | Paid, $13; no redistribution | Not shown | Top-down | Goblin warriors, shamans, archers | 3 | Excluded: paid and no redistribution. |
| 23 | Stone bridge tiles (Reemax) | https://opengameart.org/content/stone-bridge-tiles-32x32 | CC BY 3.0. Attribution required. | 32x32 | Top-down stone bridge | Stone bridge | 2 | Stone, not wood. Only if a stone bridge is wanted. |
| 24 | LPC Wooden Bridge Rework (AntumDeluge) | https://opengameart.org/content/wooden-bridge | CC BY-SA 3.0+ and GPL. Share-alike applies. | Not checked | Wooden bridge | Wooden bridge | 2 | Share-alike conflicts with a closed asset set. |
| 25 | Liberated Pixel Cup (LPC) characters | Search OpenGameArt for "Liberated Pixel Cup"; not fetched | CC BY-SA 3.0 and GPL. Credit list and share-alike required. | Large | Pixel, side and 4-direction, 32x32 to 64x64 | Many humanoid classes (knights, archers, skeletons, goblins possible) | 2 | Not used due to share-alike and attribution load. Only if share-alike is acceptable. |
| 26 | Summer Engine water and bridge sheet | https://www.summerengine.com/asset-store/water-and-bridge-tile-sheet-b3fb6979 | Marked CC0 by reseller; made with an AI tool | Not shown | Water, shore, stone bridge | Water, bridge | 1 | Excluded: AI-generated output with unclear rights. |
| 27 | Google Fonts: Lilita One | https://fonts.google.com/specimen/Lilita+One | SIL OFL 1.1 per third-party aggregator; Google page did not show license in this check | Web font | Heavy rounded display | UI titles and labels | 4 | Good Clash-like chunky look. |
| 28 | Google Fonts: Titan One | https://fonts.google.com/specimen/Titan+One | SIL OFL 1.1 per third-party aggregator | Web font | Heavy display | UI titles | 4 | Alternative to Lilita One. |
| 29 | Google Fonts: Luckiest Guy | https://fonts.google.com/specimen/Luckiest+Guy | Unverified. Believed OFL; confirm on the specimen page | Web font | Comic display | Titles, card names | 4 | Closest weight to a Clash logo look, pending license check. |

## Notes for next steps

- Confirm the Tiny Swords license question with Pixel Frog before choosing Option B. Option A works without that answer.
- Download and open the Kenney zips to check file lists, sizes, and view angle. Those details are missing from the pages.
- Run a visual check of Kenney Tower Defense and Medieval RTS against the Clash target look before committing to them.
- Plan the troop roster as procedural canvas drawing from the start. No CC0 source covers it.
