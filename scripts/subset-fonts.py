#!/usr/bin/env python3
"""Subset the self-hosted fonts and rewrite the @font-face / preload / OG rules.

Run by hand, from the repo root:

    pip install fonttools brotli
    python3 scripts/subset-fonts.py

Do not wire this into `npm run build`. Commit the files it writes:
`public/fonts/*.woff2`, the `@font-face` block in `src/styles/global.css`,
the preloads in `src/layouts/Base.astro`, and the OG `@font-face` block in
`scripts/og.mjs`.

Rerun when any of these change:
  - visible copy (pages, content, components, CSS `content`, scramble alphabets)
  - a master in `fonts/source/` (drop the new woff2 in under the same filename)
  - which family, weight, style, or OpenType feature the CSS applies

Masters live in `fonts/source/`. The script never reads `public/fonts/` back
in, so a second run subsets the originals again instead of the previous output.

What it keeps
  - Every codepoint in the master that is ASCII, Latin-1, or Latin Extended-A.
    These masters were already cut harder than that: they have no Latin
    Extended-A and only a few Latin-1 glyphs (nbsp, copyright, middle dot).
    Glyphs that are not in the master cannot be added here.
  - Every other codepoint in the master that occurs in the site source
    (pages, content, styles, scripts). CJK and emoji are not in the masters;
    they keep falling through to the system fonts.
  - OpenType features that actually shape the site: kern and liga (and ccmp)
    for Geist Pixel and Merriweather, calt for Ioskeley Mono. frac / dnom /
    numr / locl are not enabled by the CSS and are dropped.
  - Merriweather roman stays variable on wght 300–600. The pages only compute
    300 and 400, but instantiating 400 (or clipping the axis to 300–400) is not
    pixel-identical to the browser's variable rendering at 400, so the axis is
    left alone. The italic master is pinned to wght 300, the only italic weight
    that renders, which does match. Its CSS `font-weight` stays `300 600` so the
    same elements still match the face, including the empty `<i>` rules.
  - Hinting is dropped. For these five files it was pixel-identical at 1x and
    2x, in light and dark, at the sizes the site uses. If you replace a master
    with a hinted font where that is no longer true, set DROP_HINTING = False
    and recheck before shipping.

What it splits
  Each family becomes a preloaded core file and an extended file behind
  `unicode-range`. Core is ASCII plus the punctuation the pages share
  (curly quotes, dashes, ellipsis, nbsp, middle dot). Extended is everything
  else that was kept. The middle dot stays in the core because a separate
  file changed its edge pixels. Each `unicode-range` lists only codepoints that file's cmap
  actually contains, so a character in neither file still falls through to
  Georgia / the monospace stack instead of drawing .notdef. There is no
  third @font-face between them.

  `font-display: swap` and the fallback stacks are left alone. Only the
  cores of the three families that were already preloaded are preloaded.

Merriweather's OFL reserves the name "Merriweather". Subset files are renamed
internally to "Rohanth Text". The CSS family stays "Merriweather", which is
not the name table.
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.subset import Options, Subsetter
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "fonts" / "source"
OUT_DIR = ROOT / "public" / "fonts"
DROP_HINTING = True  # these masters: removed instructions did not change pixels

# Core is the preloaded slice: ASCII, plus the punctuation most pages share.
# U+00B7 sits in running text (bylines, the "· · ·" rule). The extended file
# drew its edge pixels differently, so the middle dot stays in the core.
CORE_EXTRA = set(range(0x2018, 0x2020)) | set(range(0x2010, 0x2016)) | {0x2026, 0x00A0, 0x00B7}
LATIN = set(range(0x0000, 0x0180))  # ASCII + Latin-1 + Latin Extended-A

SCAN_EXT = {".astro", ".css", ".md", ".mdx", ".ts", ".js", ".mjs", ".html"}
SKIP_DIRS = {"node_modules", "dist", ".git", ".astro", "fonts"}

# name IDs we rewrite on an OFL rename. Higher IDs belong to fvar/STAT.
RENAME_IDS = (1, 2, 3, 4, 6, 16, 17)


def scan_codepoints() -> set[int]:
    found: set[int] = set()
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix not in SCAN_EXT:
            continue
        if any(part in SKIP_DIRS for part in path.relative_to(ROOT).parts):
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        found.update(ord(ch) for ch in text)
    return found


def unicode_range(codepoints: list[int]) -> str:
    cps = sorted(set(codepoints))
    if not cps:
        raise SystemExit("unicode-range requested for an empty cmap")
    parts: list[str] = []
    start = prev = cps[0]
    for cp in cps[1:]:
        if cp == prev + 1:
            prev = cp
            continue
        parts.append(f"U+{start:04X}" if start == prev else f"U+{start:04X}-{prev:04X}")
        start = prev = cp
    parts.append(f"U+{start:04X}" if start == prev else f"U+{start:04X}-{prev:04X}")
    return ", ".join(parts)


def subset_font(source: Path, unicodes: set[int], features: list[str]) -> TTFont:
    font = TTFont(source)
    options = Options()
    options.layout_features = features
    options.hinting = not DROP_HINTING
    options.desubroutinize = True
    options.notdef_outline = True
    options.recommended_glyphs = True
    options.glyph_names = True
    options.legacy_cmap = False
    options.symbol_cmap = False
    options.ignore_missing_unicodes = True
    options.prune_unicode_ranges = True
    options.layout_closure = True
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.name_languages = ["*"]
    tool = Subsetter(options=options)
    tool.populate(unicodes=sorted(unicodes))
    tool.subset(font)
    return font


def apply_axis(font: TTFont, axis) -> None:
    if axis is None or "fvar" not in font:
        return
    tag, value = axis
    instantiateVariableFont(font, {tag: value}, inplace=True, optimize=True)


def set_name(font: TTFont, name_id: int, string: str) -> None:
    table = font["name"]
    table.names = [rec for rec in table.names if rec.nameID != name_id]
    table.setName(string, name_id, 3, 1, 0x409)


def rename_ofl(font: TTFont, family: str, subfamily: str, ps_name: str, unique: str) -> None:
    """Drop a Reserved Font Name from the name table. Copyright (ID 0) stays."""
    full = family if subfamily == "Regular" else f"{family} {subfamily}"
    set_name(font, 1, family)
    set_name(font, 2, subfamily)
    set_name(font, 3, unique)
    set_name(font, 4, full)
    set_name(font, 6, ps_name)
    set_name(font, 16, family)
    set_name(font, 17, subfamily)
    for rec in font["name"].names:
        if rec.nameID in RENAME_IDS:
            try:
                text = rec.toUnicode()
            except Exception:
                continue
            if "Merriweather" in text:
                raise SystemExit(f"reserved name still in name ID {rec.nameID}: {text}")


def cmap_codepoints(font: TTFont) -> list[int]:
    cmap = font.getBestCmap() or {}
    return sorted(cmap)


def write_woff2(font: TTFont, base: str, modified: int) -> tuple[str, int, list[int]]:
    # Pin head.modified so a rerun hashes to the same filename.
    font.recalcTimestamp = False
    if "head" in font:
        font["head"].modified = modified
        font["head"].created = modified
    font.flavor = "woff2"
    raw_path = OUT_DIR / f"{base}.woff2"
    font.save(raw_path)
    data = raw_path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()[:8]
    hashed = f"{base}.{digest}.woff2"
    target = OUT_DIR / hashed
    raw_path.rename(target)
    # reload so the reported cmap is what the file actually ships
    shipped = TTFont(target)
    return hashed, len(data), cmap_codepoints(shipped)


def face_css(family: str, url: str, unicode: str, weight: str | None, style: str | None, display: bool) -> str:
    bits = [f'font-family: "{family}"', f'src: url("{url}") format("woff2")', f"unicode-range: {unicode}"]
    if weight:
        bits.append(f"font-weight: {weight}")
    if style:
        bits.append(f"font-style: {style}")
    if display:
        bits.append("font-display: swap")
    return "@font-face { " + "; ".join(bits) + "; }"


def replace_block(text: str, start: str, end: str, body: str, fallback: str | None = None) -> str:
    block = f"{start}\n{body}\n{end}"
    if start in text and end in text:
        pre, rest = text.split(start, 1)
        _, post = rest.split(end, 1)
        return pre + block + post
    if fallback and fallback in text:
        return text.replace(fallback, block, 1)
    raise SystemExit(f"could not find a place to write {start}")


# One record per master. `axis` is ("wght", (min, max)) to keep a variable
# range, ("wght", value) to pin it, or None for a static font.
MASTERS = [
    {
        "source": "geist-pixel-square.woff2",
        "base": "geist-pixel-square",
        "family": "Geist Pixel",
        "weight": None,
        "style": None,
        "features": ["kern", "liga", "ccmp"],
        "axis": None,
        "preload": True,
        "rename": None,
    },
    {
        "source": "merriweather-latin.woff2",
        "base": "merriweather-latin",
        "family": "Merriweather",
        "weight": "300 600",
        "style": "normal",
        "features": ["liga", "kern"],
        "axis": None,
        "preload": True,
        "rename": ("Rohanth Text", "Regular", "RohanthText"),
    },
    {
        "source": "merriweather-italic-latin.woff2",
        "base": "merriweather-italic-latin",
        "family": "Merriweather",
        "weight": "300 600",
        "style": "italic",
        "features": ["liga", "kern"],
        "axis": ("wght", 300),
        "preload": False,
        "rename": ("Rohanth Text", "Italic", "RohanthText-Italic"),
    },
    {
        "source": "ioskeley-mono-regular.woff2",
        "base": "ioskeley-mono-regular",
        "family": "Ioskeley Mono",
        "weight": "400",
        "style": None,
        "features": ["calt"],
        "axis": None,
        "preload": True,
        "rename": None,
    },
    {
        "source": "ioskeley-mono-medium.woff2",
        "base": "ioskeley-mono-medium",
        "family": "Ioskeley Mono",
        "weight": "500",
        "style": None,
        "features": ["calt"],
        "axis": None,
        "preload": False,
        "rename": None,
    },
]


def build_face(master: dict, part: str, unicodes: set[int], modified: int) -> dict:
    source = SOURCE / master["source"]
    font = subset_font(source, unicodes, master["features"])
    apply_axis(font, master["axis"])
    if master["rename"]:
        family, subfamily, ps_root = master["rename"]
        rename_ofl(font, family, subfamily, f"{ps_root}-{part.title()}", f"{ps_root}-{part}; subset")
    filename, size, cmap = write_woff2(font, f"{master['base']}-{part}", modified)
    # Range is the codepoints we asked for that survived, so a recommended
    # glyph the other file also has (space) cannot pull this file down.
    ranged = [cp for cp in cmap if cp in unicodes]
    missing = sorted(unicodes - set(cmap))
    if missing:
        raise SystemExit(f"{filename} dropped requested codepoints: {missing[:12]}")
    return {
        "file": filename,
        "size": size,
        "cmap": cmap,
        "range": unicode_range(ranged),
        "range_cps": ranged,
        "part": part,
        "master": master,
    }


def main() -> None:
    if not SOURCE.is_dir():
        raise SystemExit(f"missing {SOURCE}. Put the woff2 masters there first.")
    used = scan_codepoints()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # Drop previous outputs so a stale ext file cannot keep being served.
    for old in OUT_DIR.glob("*.woff2"):
        old.unlink()

    site_faces: list[str] = []
    og_faces: list[str] = []
    preloads: list[str] = []
    report: list[str] = []

    for master in MASTERS:
        source = SOURCE / master["source"]
        original = TTFont(source)
        present = set(original.getBestCmap() or {})
        modified = int(original["head"].modified)
        kept = (present & LATIN) | (present & used)
        core = {cp for cp in kept if cp <= 0x7F or cp in CORE_EXTRA}
        ext = kept - core
        if not core:
            raise SystemExit(f"{master['base']} has an empty core")
        faces = [build_face(master, "core", core, modified)]
        if ext:
            faces.append(build_face(master, "ext", ext, modified))
        overlap = set(faces[0]["range_cps"]) & (set(faces[1]["range_cps"]) if len(faces) > 1 else set())
        if overlap:
            raise SystemExit(f"{master['base']} unicode-range overlap: {sorted(overlap)[:8]}")
        for face in faces:
            url = f"/fonts/{face['file']}"
            site_faces.append(face_css(master["family"], url, face["range"], master["weight"], master["style"], True))
        if master["preload"]:
            core_file = next(face["file"] for face in faces if face["part"] == "core")
            preloads.append(
                f'<link rel="preload" href="/fonts/{core_file}" as="font" type="font/woff2" crossorigin />'
            )
        before = source.stat().st_size
        after = sum(face["size"] for face in faces)
        def brief(face: dict) -> str:
            return f"{face['part']} {face['size']}B {len(face['cmap'])} glyphs [{face['range']}]"
        report.append(
            f"{master['base']}: {before}B -> {after}B ({', '.join(brief(f) for f in faces)})"
        )
        # features / axes / hint tables of the core, for the log
        check = TTFont(OUT_DIR / faces[0]["file"])
        gsub = []
        if "GSUB" in check and check["GSUB"].table.FeatureList:
            gsub = sorted({rec.FeatureTag for rec in check["GSUB"].table.FeatureList.FeatureRecord})
        axes = []
        if "fvar" in check:
            axes = [f"{a.axisTag} {a.minValue:g}–{a.maxValue:g}" for a in check["fvar"].axes]
        hints = [tag for tag in ("fpgm", "prep", "cvt ", "gasp") if tag in check]
        report.append(f"    core GSUB={gsub or '-'} axes={axes or '-'} hint-tables={hints or '-'}")

    og_faces = []
    for line in site_faces:
        match = re.search(r'url\("(/fonts/([^"]+))"\)', line)
        if not match:
            raise SystemExit(f"could not parse {line}")
        filename = match.group(2)
        base = filename.rsplit(".", 2)[0]  # name.HASH.woff2 -> name, but HASH is 8 hex before woff2
        # filename is base.HASH.woff2 and base itself has no extra dot
        stem = filename[: -(len(".woff2"))]
        base = stem.rsplit(".", 1)[0]
        og_line = line.replace(f'url("/fonts/{filename}")', 'url("${font("' + base + '")}")')
        og_line = og_line.replace(" font-display: swap;", "")
        og_faces.append(og_line)

    css_path = ROOT / "src" / "styles" / "global.css"
    css = css_path.read_text()
    original_faces = "\n".join(
        [
            '@font-face { font-family: "Geist Pixel"; src: url("/fonts/geist-pixel-square.77844bda.woff2") format("woff2"); font-display: swap; }',
            '@font-face { font-family: "Merriweather"; src: url("/fonts/merriweather-latin.6b615f68.woff2") format("woff2"); font-weight: 300 600; font-style: normal; font-display: swap; }',
            '@font-face { font-family: "Merriweather"; src: url("/fonts/merriweather-italic-latin.c7f43a37.woff2") format("woff2"); font-weight: 300 600; font-style: italic; font-display: swap; }',
            '@font-face { font-family: "Ioskeley Mono"; src: url("/fonts/ioskeley-mono-regular.d2433ea3.woff2") format("woff2"); font-weight: 400; font-display: swap; }',
            '@font-face { font-family: "Ioskeley Mono"; src: url("/fonts/ioskeley-mono-medium.f2ebc565.woff2") format("woff2"); font-weight: 500; font-display: swap; }',
        ]
    )
    css_path.write_text(
        replace_block(css, "/* subset-fonts: start */", "/* subset-fonts: end */", "\n".join(site_faces), original_faces)
    )

    base_path = ROOT / "src" / "layouts" / "Base.astro"
    base = base_path.read_text()
    original_preloads = "\n".join(
        [
            '    <link rel="preload" href="/fonts/geist-pixel-square.77844bda.woff2" as="font" type="font/woff2" crossorigin />',
            '    <link rel="preload" href="/fonts/merriweather-latin.6b615f68.woff2" as="font" type="font/woff2" crossorigin />',
            '    <link rel="preload" href="/fonts/ioskeley-mono-regular.d2433ea3.woff2" as="font" type="font/woff2" crossorigin />',
        ]
    )
    indented = "\n".join("    " + line for line in preloads)
    base_path.write_text(
        replace_block(base, "    <!-- subset-fonts: start -->", "    <!-- subset-fonts: end -->", indented, original_preloads)
    )

    og_path = ROOT / "scripts" / "og.mjs"
    og = og_path.read_text()
    original_og = "\n".join(
        [
            '@font-face { font-family: "Geist Pixel"; src: url("${font("geist-pixel-square")}"); }',
            '@font-face { font-family: "Ioskeley Mono"; src: url("${font("ioskeley-mono-regular")}"); font-weight: 400; }',
            '@font-face { font-family: "Ioskeley Mono"; src: url("${font("ioskeley-mono-medium")}"); font-weight: 500; }',
            '@font-face { font-family: "Merriweather"; src: url("${font("merriweather-latin")}"); font-weight: 300 600; }',
        ]
    )
    og_path.write_text(
        replace_block(og, "/* subset-fonts: start */", "/* subset-fonts: end */", "\n".join(og_faces), original_og)
    )

    print("\n".join(report))
    print(f"preloads: {len(preloads)} core files")


if __name__ == "__main__":
    main()
