#!/usr/bin/env python3
"""CraftPix art pipeline for ClashAI.

Turns the licensed packs in vendor-art/craftpix/png/ into game-ready sprite sheets under art/,
and updates assets/manifest.json for the Pixi renderer. Output is deterministic: re-running
produces the same bytes.

Licence: the CraftPix art may be used in the game but must never be committed to git. Sources
live in vendor-art/ and output in art/; both are gitignored. The game falls back to procedural
art when art/ is absent.

Subcommands:
  inventory   scan the packs; write vendor-art/INVENTORY.md and vendor-art/sheets/characters.png
  process     build art/ from tools/art-map.json (sheets, towers, effects)
  manifest    add or refresh the art/ entries in assets/manifest.json
  roster      render vendor-art/sheets/roster.png for review
  all         inventory, process, manifest, roster

Character ids are "<pack>/<key>". For chibi packs the key is the character folder. For the
flat 2D sets it is "<folder>::<name prefix>", for example
"2d-fantasy-knight-free-sprite-sheets/_PNG/1_KNIGHT::Knight_01".
Animation keys are lowercase, with spaces turned into underscores (chibi), or one of the
normalized flat keywords: idle, walk, run, attack, dying, hurt, jump, original, seq.
"""
import argparse
import json
import os
import re
import subprocess
import sys
from collections import OrderedDict

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "vendor-art", "craftpix", "png")
VENDOR = os.path.join(ROOT, "vendor-art")
SHEETS = os.path.join(VENDOR, "sheets")
ART = os.path.join(ROOT, "art")
MAP_PATH = os.path.join(HERE, "art-map.json")
MANIFEST_PATH = os.path.join(ROOT, "assets", "manifest.json")
INVENTORY_MD = os.path.join(VENDOR, "INVENTORY.md")

UNIT_FRAMES = 8          # frames kept per animation
UNIT_PX = 128            # character height in pixels
BUILDING_PX = 256        # building and tower height in pixels
VFX_PX = 192             # effect cell size in pixels
SKIP_DIRS = ("__MACOSX", "SCML", "health_bar", "Vector Parts", "Spine", "SPINE", "spine")

# Filename tokens that name an animation in the flat 2D sets.
FLAT_KEYWORDS = {
    "idle": "idle", "walk": "walk", "run": "run", "attack": "attack", "attak": "attack",
    "die": "dying", "death": "dying", "dying": "dying", "hurt": "hurt", "jump": "jump",
    "original": "original",
}


def natural_key(s):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


def discover():
    """Return OrderedDict id -> {id, pack, anims: {anim: [abs paths]}} for every source folder."""
    chars = OrderedDict()

    def add(cid, pack, anim, files):
        c = chars.setdefault(cid, {"id": cid, "pack": pack, "anims": {}})
        c["anims"].setdefault(anim, []).extend(files)

    for dp, dn, fn in os.walk(SRC):
        dn.sort()
        if any(s in dp for s in SKIP_DIRS):
            continue
        pngs = sorted((f for f in fn if f.lower().endswith(".png")), key=natural_key)
        if not pngs:
            continue
        rel = os.path.relpath(dp, SRC)
        parts = rel.split(os.sep)
        pack = parts[0]
        if "PNG Sequences" in parts:
            # Chibi layout: <Char>/PNG/PNG Sequences/<Anim>/frames
            i = parts.index("PNG Sequences")
            char = parts[i - 2] if parts[i - 1] == "PNG" else parts[i - 1]
            anim = parts[i + 1].lower().replace(" ", "_") if len(parts) > i + 1 else "seq"
            cid = pack + "/" + char
            add(cid, pack, anim, [os.path.join(dp, f) for f in pngs])
            continue
        # Flat folders: group by the animation token in each filename.
        for f in pngs:
            stem = os.path.splitext(f)[0]
            toks = [t for t in re.split(r"[_\- ]+", stem) if t != ""]
            anim = None
            prefix_toks = toks
            for k, t in enumerate(toks):
                if t.lower() in FLAT_KEYWORDS:
                    anim = FLAT_KEYWORDS[t.lower()]
                    prefix_toks = toks[:k]
                    break
            if anim is None:
                anim = "seq"
                prefix_toks = [t for t in toks if not t.isdigit()] or toks
                # frame numbers at the end of a sequence are not part of the name
                while prefix_toks and prefix_toks[-1].isdigit():
                    prefix_toks = prefix_toks[:-1]
            prefix = "_".join(prefix_toks)
            if not re.search(r"[A-Za-z]", prefix):
                prefix = "frames"  # purely numeric names: the folder is the sequence
            cid = rel + "::" + prefix  # rel already starts with the pack folder
            add(cid, pack, anim, [os.path.join(dp, f)])
    for c in chars.values():
        for a in c["anims"]:
            c["anims"][a].sort(key=lambda p: natural_key(os.path.basename(p)))
    return chars


def frame_size(path):
    with Image.open(path) as im:
        return im.size


def cmd_inventory(chars):
    os.makedirs(SHEETS, exist_ok=True)
    lines = [
        "# CraftPix inventory",
        "",
        "Generated by `tools/art-pipeline.py inventory`. Source: `vendor-art/craftpix/png/`.",
        "Frame size is the size of the first frame. Facing is set once a character is checked in the",
        "contact sheet (`sheets/characters.png`); most CraftPix art faces right.",
        "",
        "| Character id | Animations (frames) | Frame size |",
        "| --- | --- | --- |",
    ]
    idle_chars = []
    for cid, c in chars.items():
        anims = c["anims"]
        parts = ["%s (%d)" % (a, len(v)) for a, v in sorted(anims.items())]
        first = next(iter(anims.values()))[0]
        w, h = frame_size(first)
        lines.append("| `%s` | %s | %dx%d |" % (cid, ", ".join(parts), w, h))
        if "idle" in anims:
            idle_chars.append((short_label(cid), anims["idle"][0]))
    with open(INVENTORY_MD, "w") as fh:
        fh.write("\n".join(lines) + "\n")
    print("inventory: %d sources, %d with idle -> %s" % (len(chars), len(idle_chars), INVENTORY_MD))
    contact_sheet(idle_chars, os.path.join(SHEETS, "characters.png"), "Idle frame, first of each character")


def short_label(cid):
    """Readable label: the character key, with the pack name shortened to its last word or two."""
    pack, _, key = cid.partition("/")
    short = re.sub(r"^(free-|2d-fantasy-)", "", pack)
    return "%s | %s" % (short[:22], key.split("::")[-1][-22:])


def load_font(size):
    for path in ("/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/Supplemental/Arial.ttf"):
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                pass
    return ImageFont.load_default(size=size)


def contact_sheet(items, out, title, cell_h=150, cols=8):
    """items: list of (label, image path). Draws each image trimmed, on grass green, with its label."""
    font = load_font(11)
    cell_w = 170
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell_w, rows * (cell_h + 26) + 30), (92, 150, 70))
    d = ImageDraw.Draw(sheet)
    d.text((8, 8), title, fill=(255, 255, 255), font=load_font(14))
    for idx, (label, path) in enumerate(items):
        x = (idx % cols) * cell_w
        y = 30 + (idx // cols) * (cell_h + 26)
        try:
            im = Image.open(path).convert("RGBA")
            bb = im.getchannel("A").getbbox()
            if bb:
                im = im.crop(bb)
            s = min((cell_w - 12) / im.width, (cell_h - 6) / im.height)
            im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
            sheet.paste(im, (x + (cell_w - im.width) // 2, y + (cell_h - im.height) // 2), im)
        except Exception as e:  # keep the sheet readable even when one file is bad
            d.text((x + 4, y + 4), "error: %s" % e, fill=(255, 200, 200), font=font)
        text = label if len(label) < 30 else label[:28] + ".."
        d.text((x + 4, y + cell_h + 4), text, fill=(255, 255, 255), font=font)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sheet.save(out, optimize=True)
    print("wrote", out)


STATES = ["idle", "walk", "attack", "death"]  # same order the renderer reads (js/sprites.js)


def pick_even(files, n):
    """Up to n files spread evenly across the sequence, first and last included."""
    if len(files) <= n:
        return list(files)
    idx = sorted(set(round(i * (len(files) - 1) / (n - 1)) for i in range(n)))
    return [files[i] for i in idx]


def read_states(chars, source, anims, flip, n=UNIT_FRAMES):
    """state -> [RGBA frames]; missing animations are left out (the renderer reuses idle)."""
    if source.startswith("file:"):
        # One loose file (no animation): used for buildings picked from a pack folder.
        path = os.path.join(SRC, source[len("file:"):])
        im = Image.open(path).convert("RGBA")
        return OrderedDict([("idle", [ImageOps.mirror(im) if flip else im])])
    if source not in chars:
        raise SystemExit("unknown source %r; see vendor-art/INVENTORY.md" % source)
    anim_map = chars[source]["anims"]
    out = OrderedDict()
    for state in STATES:
        key = anims.get(state)
        if not key:
            continue
        files = anim_map.get(key)
        if not files:
            print("  warn: %s has no %r for %s" % (source, key, state))
            continue
        frames = []
        for path in pick_even(files, n):
            im = Image.open(path).convert("RGBA")
            frames.append(ImageOps.mirror(im) if flip else im)
        out[state] = frames
    if "idle" not in out and out:
        out["idle"] = next(iter(out.values()))  # no idle: the first state stands in
    return out


def union_box(states):
    x0 = y0 = 10 ** 9
    x1 = y1 = -1
    for frames in states.values():
        for im in frames:
            bb = im.getchannel("A").getbbox()
            if bb:
                x0, y0 = min(x0, bb[0]), min(y0, bb[1])
                x1, y1 = max(x1, bb[2]), max(y1, bb[3])
    if x1 < 0:
        raise SystemExit("empty art")
    pad = 2
    return (max(0, x0 - pad), max(0, y0 - pad), x1 + pad, y1 + pad)


def hue_shift(im, degrees):
    rgb = im.convert("RGB").convert("HSV")
    h, sat, val = rgb.split()
    h = h.point(lambda v: (v + int(round(degrees * 256 / 360.0))) % 256)
    out = Image.merge("HSV", (h, sat, val)).convert("RGBA")
    out.putalpha(im.getchannel("A"))
    return out


def recolor_top(im, hue, band=0.4, min_sat=0.12, mul=None):
    """Team identity for towers: set the hue of saturated pixels in the top band (roof, flag, banner).

    Stone and wood stay as they are. band is the fraction of the height counted as the top.
    """
    rgba = np.asarray(im.convert("RGBA")).astype(np.float32) / 255.0
    rgb = rgba[..., :3]
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    top = np.zeros(sat.shape, dtype=bool)
    top[: int(rgba.shape[0] * band), :] = True
    if mul:
        # Multiply the whole top band (grey roofs too): a colour wash rather than a hue change.
        m = np.array([int(mul[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32) / 255.0
        mask_m = top & (rgba[..., 3] > 0.5)
        out = rgb.copy()
        out[mask_m] = rgb[mask_m] * m
        rgba[..., :3] = out
        return Image.fromarray((np.clip(rgba, 0, 1) * 255).round().astype(np.uint8), "RGBA")
    mask = top & (sat > min_sat) & (rgba[..., 3] > 0.5)
    # Rebuild RGB at the target hue with the same saturation and value (HSV to RGB).
    t = (hue % 360) / 360.0
    v = mx
    def ch(n):
        k = (n + t * 6.0) % 6.0
        return v - v * sat * np.clip(np.minimum(k, 4.0 - k), 0.0, 1.0)
    new = np.stack([ch(5), ch(3), ch(1)], axis=2)
    out = rgb.copy()
    out[mask] = new[mask]
    rgba[..., :3] = out
    return Image.fromarray((np.clip(rgba, 0, 1) * 255).round().astype(np.uint8), "RGBA")


def tint_image(im, hex_color, hue=0):
    if hue:
        im = hue_shift(im, hue)
    if not hex_color:
        return im
    r, g, b = int(hex_color[1:3], 16), int(hex_color[3:5], 16), int(hex_color[5:7], 16)
    rgb = ImageChops.multiply(im.convert("RGB"), Image.new("RGB", im.size, (r, g, b)))
    out = rgb.convert("RGBA")
    out.putalpha(im.getchannel("A"))
    return out


def resize_keep_edges(im, size):
    """Resize with premultiplied alpha so transparent pixels do not bleed colour."""
    return im.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")


def normalize(states, target_px, mode, tint=None, hue=0, ref="union"):
    """Crop every frame to one shared box, scale to target_px, tint.

    mode "height": the reference height (ref) becomes target_px. ref "idle" uses the trimmed height of the
    idle body, so skeletons and giants are compared by what is visible, not by how much attack art
    pads the box. ref "union" uses the shared box (buildings, towers).
    mode "square": scale so the longest side is target_px, centred on a square (effects).
    Returns (cells, anchor_xy, cell_size, ratio) where ratio = box height / reference height, so the
    renderer's texture height is ratio times the visible body height.
    """
    box = union_box(states)
    bw, bh = box[2] - box[0], box[3] - box[1]
    ref_h = bh
    if mode == "height" and ref == "idle":
        heights = []
        for im in states["idle"]:
            cropped = im.crop(box)
            bb = cropped.getchannel("A").getbbox()
            if bb:
                heights.append(bb[3] - bb[1])
        ref_h = sorted(heights)[len(heights) // 2] if heights else bh
    if mode == "square":
        s = target_px / max(bw, bh)
    else:
        s = target_px / ref_h
    cw, ch = max(1, round(bw * s)), max(1, round(bh * s))
    # Anchor: horizontal centre of the first idle frame, at the feet (bottom of the box).
    idle0 = states["idle"][0]
    ibb = idle0.getchannel("A").getbbox() or box
    ax = ((ibb[0] + ibb[2]) / 2 - box[0]) / bw
    cells = OrderedDict()
    for state, frames in states.items():
        out = []
        for im in frames:
            crop = im.crop(box)
            scaled = tint_image(resize_keep_edges(crop, (cw, ch)), tint, hue)
            if mode == "square":
                canvas = Image.new("RGBA", (target_px, target_px), (0, 0, 0, 0))
                canvas.paste(scaled, ((target_px - cw) // 2, (target_px - ch) // 2), scaled)
                scaled = canvas
            out.append(scaled)
        cells[state] = out
    cell = (target_px, target_px) if mode == "square" else (cw, ch)
    return cells, (min(max(ax, 0.0), 1.0), 1.0), cell, bh / float(ref_h)


def write_sheet(cells, cell, path):
    cols = max(len(v) for v in cells.values())
    rows = OrderedDict()
    for r, state in enumerate(state for state in STATES if state in cells):
        rows[state] = r
    sheet = Image.new("RGBA", (cell[0] * cols, cell[1] * len(rows)), (0, 0, 0, 0))
    for state, r in rows.items():
        for c, im in enumerate(cells[state]):
            sheet.paste(im, (c * cell[0], r * cell[1]), im)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sheet.save(path, optimize=True)
    return {state: [rows[state], len(cells[state])] for state in rows}


def rel_art(path):
    return os.path.relpath(path, ROOT).replace(os.sep, "/")


def unit_radii():
    """Collision radius per unit from js/cards.js (CR.UNITS), read with node."""
    code = ("globalThis.CR = {}; require(%r); var o = {}; for (var k in CR.UNITS) o[k] = CR.UNITS[k].r;"
            " console.log(JSON.stringify(o));") % os.path.join(ROOT, "js", "cards.js")
    out = subprocess.run(["node", "-e", code], check=True, capture_output=True, text=True).stdout
    return json.loads(out)


def build_units(chars, amap):
    entries = {}
    radii = unit_radii()
    for uid, spec in amap.get("units", {}).items():
        states = read_states(chars, spec["source"], spec["anims"], spec.get("flip", False))
        cells, anchor, cell, ratio = normalize(states, UNIT_PX, "height", spec.get("tint"),
                                               spec.get("hue", 0), ref="idle")
        path = os.path.join(ART, "units", uid + ".png")
        rows = write_sheet(cells, cell, path)
        # The renderer draws texture height = vis.h * r / 0.5 tiles. Solve for the visible body height.
        tiles = spec["heightTiles"]
        vis_h = tiles * ratio * 0.5 / radii[uid]
        entries[uid] = {
            "sheet": {"src": rel_art(path), "frameW": cell[0], "frameH": cell[1], "rows": rows,
                      "fps": spec.get("fps", 10)},
            "anchor": [round(anchor[0], 3), anchor[1]],
            "scale": round(vis_h, 4),
            "flipDefault": False,
            "tintable": True,
        }
        print("  unit %-14s %s  body %.2f tiles  cell %dx%d  frames %s" % (
            uid, spec["source"], tiles, cell[0], cell[1], {k: v[1] for k, v in rows.items()}))
    return entries


def build_single(chars, source, anims, target_px, path, flip=False, tint=None, recolor=None):
    """One image: the idle frame of the source, for towers and buildings. Returns (anchor, cell, ratio)."""
    states = read_states(chars, source, anims, flip)
    cells, anchor, cell, ratio = normalize({"idle": states["idle"]}, target_px, "height", tint, ref="union")
    img = cells["idle"][0]
    if recolor:
        img = recolor_top(img, recolor.get("hue", 0), recolor.get("band", 0.4), recolor.get("minSat", 0.12),
                          recolor.get("mul"))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)
    return anchor, cell, ratio


def build_buildings(chars, amap):
    """Buildings: one image each, scaled so the body is heightTiles tall for a radius 0.5 unit.
    flag: true bakes a team banner into team0 and team1 variants, stored as {team0: entry, team1: entry}."""
    entries = {}
    radii = unit_radii()
    for bid, spec in amap.get("buildings", {}).items():
        anims = spec.get("anims", {"idle": "seq"})
        vis_h = spec["heightTiles"] * 0.5 / radii[bid]
        if spec.get("flag"):
            per_team = {}
            for team in (0, 1):
                path = os.path.join(ART, "buildings", "%s_team%d.png" % (bid, team))
                states = read_states(chars, spec["source"], anims, False)
                cells, anchor, cell, _ = normalize({"idle": states["idle"]}, BUILDING_PX, "height",
                                                   spec.get("tint"), 0, ref="union")
                img = add_team_flag(cells["idle"][0], team)
                os.makedirs(os.path.dirname(path), exist_ok=True)
                img.save(path, optimize=True)
                per_team["team%d" % team] = {"src": rel_art(path), "anchor": [round(anchor[0], 3), anchor[1]],
                                             "scale": round(vis_h, 4), "flipDefault": False, "tintable": False}
            entries[bid] = per_team
        else:
            path = os.path.join(ART, "buildings", bid + ".png")
            anchor, cell, _ = build_single(chars, spec["source"], anims, BUILDING_PX,
                                           path, False, spec.get("tint"), spec.get("recolor"))
            entries[bid] = {"src": rel_art(path), "anchor": [round(anchor[0], 3), anchor[1]],
                            "scale": round(vis_h, 4), "flipDefault": False, "tintable": False}
        print("  building %-12s body %.2f tiles%s" % (bid, spec["heightTiles"], " (team flags)" if spec.get("flag") else ""))
    return entries


PROJ_PX = 128        # projectile texture size (square; the renderer draws it at vis.h tiles)
TEAM_FLAG = {0: "free-simple-summer-top-down-vector-tileset/PNG/Top-Down Simple Summer_Prop - Blue Banner.png",
             1: "free-simple-summer-top-down-vector-tileset/PNG/Top-Down Simple Summer_Prop - Red Banner.png"}


def build_projectiles(chars, amap):
    """One square picture per projectile kind, pointing right. The renderer draws a single frame."""
    entries = {}
    for kind, spec in amap.get("projectiles", {}).items():
        states = read_states(chars, spec["source"], {"idle": "seq"}, False, n=8)
        frames = states["idle"]
        cells, _, cell, _ = normalize({"idle": [frames[len(frames) // 2]]}, PROJ_PX, "square",
                                      spec.get("tint"), spec.get("hue", 0))
        path = os.path.join(ART, "projectiles", kind + ".png")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        cells["idle"][0].save(path, optimize=True)
        entries[kind] = {"src": rel_art(path), "anchor": [0.5, 0.5], "scale": spec.get("scale", 0.6),
                         "tintable": False}
        print("  projectile %-10s scale %.2f tiles" % (kind, spec.get("scale", 0.6)))
    return entries


def add_team_flag(img, team):
    """Composite a small team banner on the top-right of a building picture (the banner is a prop)."""
    banner = Image.open(os.path.join(SRC, TEAM_FLAG[team])).convert("RGBA")
    k = img.height * 0.42 / float(banner.height)
    banner = banner.resize((max(1, round(banner.width * k)), max(1, round(banner.height * k))), Image.LANCZOS)
    out = img.copy()
    out.alpha_composite(banner, (img.width - banner.width - int(img.width * 0.02), int(img.height * 0.02)))
    return out


def build_effects(chars, amap):
    layers = OrderedDict()
    for etype, spec_list in amap.get("effects", {}).items():
        items = []
        for k, spec in enumerate(spec_list):
            states = read_states(chars, spec["source"], {"idle": "seq"}, False, n=spec.get("frames", 8))
            cells, _, cell, _ = normalize(states, VFX_PX, "square", spec.get("tint"), spec.get("hue", 0))
            name = etype if len(spec_list) == 1 else "%s_%d" % (etype, k)
            path = os.path.join(ART, "vfx", name + ".png")
            rows = write_sheet(cells, cell, path)
            layer = {"sheet": {"src": rel_art(path), "frameW": cell[0], "frameH": cell[1], "rows": rows,
                               "fps": spec.get("fps", 12)},
                     "scale": spec.get("scale", 1.0)}
            if spec.get("blend"):
                layer["blend"] = spec["blend"]
            if spec.get("alpha") is not None:
                layer["alpha"] = spec["alpha"]
            items.append(layer)
        layers[etype] = items
        print("  effect %-12s %d layer(s)" % (etype, len(items)))
    return layers


def build_towers(chars, amap):
    entries = {}
    for ttype, spec in amap.get("towers", {}).items():
        if "source" in spec:
            variants = {"": spec}
        else:
            variants = {"team0": spec["team0"], "team1": spec["team1"]}
        for team, v in variants.items():
            name = ttype + ("_" + team if team else "")
            path = os.path.join(ART, "towers", name + ".png")
            anchor, cell, _ = build_single(chars, v["source"], v["anims"], BUILDING_PX, path,
                                           v.get("flip", False), v.get("tint"), v.get("recolor"))
            entry = {"src": rel_art(path), "anchor": [anchor[0], anchor[1]], "scale": spec.get("scale", 3.6),
                     "tintable": spec.get("tintable", False)}
            if team:
                entries.setdefault(ttype, {})[team] = entry
            else:
                entries[ttype] = entry
        print("  tower %-10s %s" % (ttype, "team0/team1" if "" not in variants else spec["source"]))
    return entries


def cmd_process(chars):
    with open(MAP_PATH) as fh:
        amap = json.load(fh)
    print("units:")
    units = build_units(chars, amap)
    print("towers:")
    towers = build_towers(chars, amap)
    print("buildings:")
    buildings = build_buildings(chars, amap)
    print("projectiles:")
    projectiles = build_projectiles(chars, amap)
    print("effects:")
    effects = build_effects(chars, amap)
    arena = build_arena()
    result = {"units": units, "towers": towers, "buildings": buildings, "projectiles": projectiles,
              "effects": effects, "arena": arena}
    with open(os.path.join(ART, "built.json"), "w") as fh:
        json.dump(result, fh, indent=1, sort_keys=True)
    total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fn in os.walk(ART) for f in fn)
    print("art/ size: %.1f MB" % (total / 1048576.0))
    return result


def cmd_roster(chars):
    """Every unit at its in-game height: the visible idle body is scaled to heightTiles on a 1-tile grid."""
    with open(os.path.join(ART, "built.json")) as fh:
        built = json.load(fh)
    with open(MAP_PATH) as fh:
        amap = json.load(fh)
    tile = 56
    cell_w, cell_h, cols = int(tile * 3.4), int(tile * 3.6), 7
    items = []
    for uid, entry in built["units"].items():
        sh = entry["sheet"]
        sheet = Image.open(os.path.join(ROOT, sh["src"])).convert("RGBA")
        frame = sheet.crop((0, 0, sh["frameW"], sh["frameH"]))
        body = frame.crop(frame.getchannel("A").getbbox())
        tiles = amap["units"][uid]["heightTiles"]
        k = tiles * tile / body.height
        body = body.resize((max(1, round(body.width * k)), max(1, round(body.height * k))), Image.LANCZOS)
        items.append((uid, tiles, body))
    rows = (len(items) + cols - 1) // cols
    head = 30
    out = Image.new("RGB", (cols * cell_w, rows * cell_h + head), (92, 150, 70))
    d = ImageDraw.Draw(out)
    d.text((8, 8), "Roster at in-game size: each grid square is 1 tile (%d px), feet on the baseline" % tile,
           fill=(255, 255, 255), font=load_font(13))
    font = load_font(11)
    for i, (uid, tiles, body) in enumerate(items):
        x0 = (i % cols) * cell_w
        y0 = head + (i // cols) * cell_h
        base_y = y0 + cell_h - 20
        # one-tile grid: the unit's footprint, drawn behind the sprite
        gx = x0 + (cell_w - tile) // 2
        for gy in range(0, 4):
            d.rectangle([gx, base_y - (gy + 1) * tile, gx + tile, base_y - gy * tile], outline=(120, 175, 100))
        d.line([x0 + 4, base_y, x0 + cell_w - 4, base_y], fill=(230, 230, 200))
        out.paste(body, (x0 + (cell_w - body.width) // 2, base_y - body.height), body)
        d.text((x0 + 4, base_y + 3), "%s %.1f" % (uid, tiles), fill=(255, 255, 255), font=font)
    os.makedirs(SHEETS, exist_ok=True)
    out.save(os.path.join(SHEETS, "roster.png"), optimize=True)
    print("wrote", os.path.join(SHEETS, "roster.png"))


def cmd_manifest():
    """Write art/manifest.json (private, gitignored). assets/manifest.json stays the public base.

    js/sprites.js reads assets/manifest.json first, then merges art/manifest.json over it when present.
    """
    with open(os.path.join(ART, "built.json")) as fh:
        built = json.load(fh)
    manifest = OrderedDict()
    manifest["units"] = OrderedDict(built["units"])
    manifest["towers"] = OrderedDict(built["towers"])
    manifest["buildings"] = OrderedDict(built.get("buildings", {}))
    manifest["projectiles"] = OrderedDict(built.get("projectiles", {}))
    manifest["effects"] = OrderedDict(built["effects"])
    if built.get("arena"):
        manifest["arena"] = built["arena"]
    path = os.path.join(ART, "manifest.json")
    with open(path, "w") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("art manifest: %d units, %d towers, %d buildings, %d effects -> %s" % (
        len(built["units"]), len(built["towers"]), len(built.get("buildings", {})), len(built["effects"]), path))


ARENA_PX = 64        # arena pixels per tile
ARENA_PAD = 3        # tiles of margin around the 18x32 play area, filled with decoration
TILES_DIR = os.path.join(SRC, "free-simple-summer-top-down-vector-tileset")


def arena_config():
    """CR.ARENA from js/cards.js (W, H, RIVER_TOP, RIVER_BOTTOM, BRIDGES)."""
    code = ("globalThis.CR = {}; require(%r); console.log(JSON.stringify(CR.ARENA));"
            ) % os.path.join(ROOT, "js", "cards.js")
    return json.loads(subprocess.run(["node", "-e", code], check=True, capture_output=True, text=True).stdout)


def tileset(name):
    """Image from the Simple Summer tileset by file name (without .png); the folder has odd spacing."""
    import glob
    hits = [f for f in glob.glob(os.path.join(TILES_DIR, "**", "*.png"), recursive=True)
            if "__MACOSX" not in f and os.path.basename(f)[:-4].lower().replace("_", " ").endswith(name.lower())]
    if not hits:
        raise SystemExit("tileset piece not found: %s" % name)
    return Image.open(sorted(hits)[0]).convert("RGBA")


def build_arena():
    """art/arena.png: grass with variation, the river and bridges at the CR.ARENA tile positions, and
    decoration in a margin around the play area. The renderer draws it scaled to the arena rect."""
    cfg = arena_config()
    W, H = cfg["W"], cfg["H"]
    P, T = ARENA_PAD, ARENA_PX
    cw, ch = (W + 2 * P), (H + 2 * P)
    img = Image.new("RGBA", (cw * T, ch * T), (0, 0, 0, 255))

    def px(x):
        return int(round((x + P) * T))

    # Grass: two plain tiles, chosen by position so the variation is the same on every build.
    grass = [tileset("Ground 43").resize((T, T), Image.LANCZOS), tileset("Ground 52").resize((T, T), Image.LANCZOS)]
    for j in range(-P, H + P):
        for i in range(-P, W + P):
            h = (i * 73856093) ^ (j * 19349663)
            tile = grass[h & 1].rotate(90 * ((h >> 1) & 3))
            img.paste(tile, (px(i), px(j)))

    # River: the renderer's colours, full width including the margin.
    rt, rb = cfg["RIVER_TOP"], cfg["RIVER_BOTTOM"]
    draw = ImageDraw.Draw(img, "RGBA")
    draw.rectangle([px(-P), px(rt), px(W + P) - 1, px(rb) - 1], fill=(58, 155, 224, 255))
    mid = rt + (rb - rt) / 2.0
    draw.rectangle([px(-P), px(mid), px(W + P) - 1, px(rb) - 1], fill=(18, 80, 150, 72))
    bank = (42, 114, 174, 255)
    draw.rectangle([px(-P), px(rt) - 5, px(W + P) - 1, px(rt) - 1], fill=bank)
    draw.rectangle([px(-P), px(rb), px(W + P) - 1, px(rb) + 4], fill=bank)

    # Bridges: planks and rails in the renderer's wood colours. The tileset's arched prop reads as a
    # barrel when stretched to a 3-tile span, so the planks are drawn instead.
    wood, wood_dark, rail = (168, 115, 63, 255), (108, 68, 29, 255), (74, 43, 17, 255)
    for b in cfg["BRIDGES"]:
        x0 = b["x"] - b["halfWidth"]
        x1 = b["x"] + b["halfWidth"]
        y0 = rt - 0.25
        y1 = rb + 0.25
        d = ImageDraw.Draw(img, "RGBA")
        d.rectangle([px(x0) - 3, int(round((y0 + P) * T)), px(x1) + 2, int(round((y1 + P) * T))],
                    fill=wood_dark)
        d.rectangle([px(x0), int(round((y0 + P) * T)) + 4, px(x1) - 1, int(round((y1 + P) * T)) - 4], fill=wood)
        yy = y0 + 0.2
        while yy < y1 - 0.1:
            d.rectangle([px(x0), int(round((yy + P) * T)), px(x1) - 1, int(round((yy + 0.06 + P) * T))], fill=wood_dark)
            yy += 0.32
        for xr in (x0, x1 - 0.12):
            d.rectangle([px(xr), int(round((y0 + P) * T)) - 2, px(xr + 0.12), int(round((y1 + P) * T)) + 2], fill=rail)

    # Decoration in the margin only (never on the play area).
    deco = [
        ("Tree Large", -1.6, 2.0, 2.2), ("Tree Large", -1.6, 9.0, 2.2), ("Tree Medium", -1.4, 19.5, 1.8),
        ("Tree Large", -1.6, 27.0, 2.2), ("Tree Large", -1.6, 23.0, 2.2),
        ("Tree Large", W + 1.6, 4.5, 2.2), ("Tree Medium", W + 1.4, 12.0, 1.8), ("Tree Large", W + 1.6, 21.5, 2.2),
        ("Tree Large", W + 1.6, 29.0, 2.2),
        ("Bushes Large", -1.2, 14.0, 1.0), ("Bushes Medium", W + 1.2, 18.5, 0.9),
        ("Bushes Medium", 7.0, -1.1, 0.9), ("Bushes Large", 11.0, H + 1.1, 1.0),
        ("Rock 03", W + 1.0, 14.6, 0.8), ("Rock 01", -1.0, 17.8, 0.7),
        ("Tree Medium", 4.0, -1.8, 1.8), ("Tree Medium", 13.0, H + 1.8, 1.8),
    ]
    for name, x, y, tiles in deco:
        sp = tileset(name)
        k = tiles * T / float(sp.height)
        sp = sp.resize((max(1, round(sp.width * k)), max(1, round(sp.height * k))), Image.LANCZOS)
        img.alpha_composite(sp, (int(round((x + P) * T - sp.width / 2.0)), int(round((y + P) * T - sp.height))))

    os.makedirs(os.path.join(ART), exist_ok=True)
    path = os.path.join(ART, "arena.png")
    img.convert("RGB").save(path, optimize=True)
    print("arena: %dx%d px (%d tiles, %d px per tile, pad %d) -> %s" % (img.width, img.height, cw, T, P, path))
    return {"src": rel_art(path), "pad": P}


def cmd_vfx():
    """Contact sheet of the effects (one middle frame per layer) and the projectiles, labelled."""
    with open(os.path.join(ART, "manifest.json")) as fh:
        man = json.load(fh)
    tiles = []
    for etype, layers in man.get("effects", {}).items():
        for k, layer in enumerate(layers):
            sh = layer.get("sheet")
            if not sh:
                continue
            im = Image.open(os.path.join(ROOT, sh["src"])).convert("RGBA")
            n = max(c for _, c in sh["rows"].values())
            fw = sh["frameW"]
            mid = min(n - 1, n // 2)
            frame = im.crop((mid * fw, 0, mid * fw + fw, sh["frameH"]))
            tiles.append(("fx %s%s" % (etype, "" if len(layers) == 1 else "[%d]" % k), frame))
    for kind, entry in man.get("projectiles", {}).items():
        tiles.append(("proj %s" % kind, Image.open(os.path.join(ROOT, entry["src"])).convert("RGBA")))
    cell, cols = 150, 8
    rows = (len(tiles) + cols - 1) // cols
    out = Image.new("RGB", (cols * cell, rows * (cell + 22) + 28), (92, 150, 70))
    d = ImageDraw.Draw(out)
    d.text((8, 8), "VFX and projectiles (middle frame of each sequence, on grass)", fill=(255, 255, 255), font=load_font(13))
    font = load_font(11)
    for i, (label, im) in enumerate(tiles):
        x = (i % cols) * cell
        y = 28 + (i // cols) * (cell + 22)
        bb = im.getchannel("A").getbbox()
        if bb:
            im = im.crop(bb)
        k = min((cell - 12) / float(im.width), (cell - 12) / float(im.height))
        im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)
        out.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2), im)
        d.text((x + 4, y + cell + 2), label[:24], fill=(255, 255, 255), font=font)
    os.makedirs(SHEETS, exist_ok=True)
    out.save(os.path.join(SHEETS, "vfx.png"), optimize=True)
    print("wrote", os.path.join(SHEETS, "vfx.png"), "(%d items)" % len(tiles))


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["inventory", "process", "manifest", "roster", "vfx", "all"])
    args = ap.parse_args(argv)
    chars = discover()
    if args.command in ("inventory", "all"):
        cmd_inventory(chars)
    if args.command in ("process", "all"):
        cmd_process(chars)
    if args.command in ("manifest", "all"):
        cmd_manifest()
    if args.command in ("roster", "all"):
        cmd_roster(chars)
    if args.command in ("vfx", "all"):
        cmd_vfx()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
