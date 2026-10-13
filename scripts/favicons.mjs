// Favicons from the square avatar: favicon.ico (16/32/48), apple-touch-icon (180), and
// 192/512 PNGs for the web manifest. The home page's share image (public/og/home.jpg) is the
// same photo, copied byte-for-byte.
// usage: node scripts/favicons.mjs <square-source.jpg>
import { copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const source = process.argv[2];
if (!source) throw new Error("usage: node scripts/favicons.mjs <square-source.jpg>");
const root = new URL("..", import.meta.url).pathname;
const pub = (file) => join(root, "public", file);

const { width, height } = await sharp(source).metadata();
if (width !== height) throw new Error(`source must be square, got ${width}x${height}`);

const png = (size) =>
  sharp(source)
    .resize(size, size, { kernel: "lanczos3" })
    // tiny sizes lose detail when downscaled ~10-30x; a light unsharp brings the face back
    .sharpen(size <= 48 ? { sigma: 0.5 } : undefined)
    .png(size > 48 ? { palette: true, quality: 100, colours: 256, effort: 10, dither: 0.6 } : { compressionLevel: 9 })
    .toBuffer();

// ICO with PNG payloads (supported by every current browser).
const icoSizes = [16, 32, 48];
const images = await Promise.all(icoSizes.map(png));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = 6 + 16 * images.length;
const entries = images.map((image, index) => {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(icoSizes[index], 0);
  entry.writeUInt8(icoSizes[index], 1);
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(image.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += image.length;
  return entry;
});
writeFileSync(pub("favicon.ico"), Buffer.concat([header, ...entries, ...images]));

writeFileSync(pub("apple-touch-icon.png"), await png(180));
writeFileSync(pub("icon-192.png"), await png(192));
writeFileSync(pub("icon-512.png"), await png(512));
copyFileSync(source, pub("og/home.jpg"));

console.log("wrote favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png, og/home.jpg");
