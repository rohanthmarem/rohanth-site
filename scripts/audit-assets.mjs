// Run from the repository root: node scripts/audit-assets.mjs [output.json]
import { readdir, stat, writeFile, readFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import sharp from 'sharp';

async function files(root) {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(join(root, e.name)) : [join(root, e.name)]))).flat();
}
const sourceFiles = (await Promise.all(['src', 'content', 'public'].map(files))).flat();
const texts = await Promise.all(sourceFiles.filter(f => /\.(astro|mdx?|ts|js|css|html|json)$/.test(f)).map(async path => ({ path, text: await readFile(path, 'utf8') })));
const images = [];
for (const path of sourceFiles.filter(f => /\.(webp|png|jpe?g|avif|gif|svg|ico)$/i.test(f)).sort()) {
  let meta;
  let iconSizes;
  if (extname(path).toLowerCase() === '.ico') {
    const data = await readFile(path);
    iconSizes = Array.from({ length: data.readUInt16LE(4) }, (_, i) => ({
      width: data[6 + i * 16] || 256, height: data[7 + i * 16] || 256,
    }));
    meta = { width: Math.max(...iconSizes.map(s => s.width)), height: Math.max(...iconSizes.map(s => s.height)) };
  } else {
    meta = await sharp(path).metadata();
  }
  const references = texts.filter(f => f.text.includes(basename(path))).map(f => f.path);
  // Writing covers are resolved by post ID through import.meta.glob, not a literal filename.
  if (path.startsWith('src/assets/writing/') && sourceFiles.includes(`content/writings/${basename(path, extname(path))}.mdx`)) {
    references.push('src/pages/writing/index.astro (coverFor/post ID)');
  }
  images.push({ path, bytes: (await stat(path)).size, width: meta.width, height: meta.height,
    ...(iconSizes ? { sizes: iconSizes } : {}), references });
}
const totals = {};
for (const path of await files('dist')) {
  const extension = extname(path).slice(1) || 'other';
  totals[extension] = (totals[extension] ?? 0) + (await stat(path)).size;
}
const fonts = await Promise.all((await files('public/fonts')).map(async path => ({ path, bytes: (await stat(path)).size })));
const report = { images, fonts, distBytes: Object.values(totals).reduce((a, b) => a + b, 0), distBytesByType: totals };
const json = JSON.stringify(report, null, 2) + '\n';
if (process.argv[2]) await writeFile(process.argv[2], json);
else console.log(json);
