// Give every font in public/fonts a content-hashed name (name.<hash8>.woff2) and rewrite the
// references in global.css (@font-face) and Base.astro (preloads) to match, so /fonts/* can be
// served with `Cache-Control: immutable` (see vercel.json).
// Re-run after replacing or re-subsetting a font: `node scripts/hash-fonts.mjs`.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const fontsDir = join(root, "public/fonts");
const referrers = ["src/styles/global.css", "src/layouts/Base.astro"].map((file) => join(root, file));

const renames = new Map(); // base name (no hash) -> hashed file name
for (const file of readdirSync(fontsDir)) {
  const match = file.match(/^(.+?)(?:\.[0-9a-f]{8})?\.(woff2?|ttf|otf)$/);
  if (!match) continue;
  const [, base, ext] = match;
  const hash = createHash("sha256").update(readFileSync(join(fontsDir, file))).digest("hex").slice(0, 8);
  const hashed = `${base}.${hash}.${ext}`;
  if (hashed !== file) renameSync(join(fontsDir, file), join(fontsDir, hashed));
  renames.set(`${base}.${ext}`, hashed);
}

for (const path of referrers) {
  const before = readFileSync(path, "utf8");
  const after = before.replace(/\/fonts\/([a-z0-9-]+)(?:\.[0-9a-f]{8})?\.(woff2?|ttf|otf)/g, (whole, base, ext) => {
    const hashed = renames.get(`${base}.${ext}`);
    if (!hashed) throw new Error(`${path} references /fonts/${base}.${ext}, which is not in public/fonts`);
    return `/fonts/${hashed}`;
  });
  if (after !== before) writeFileSync(path, after);
}

for (const [base, hashed] of renames) console.log(`${base} -> ${hashed}`);
