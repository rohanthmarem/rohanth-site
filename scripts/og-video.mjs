// The home page's share video: the horizon with its sparks drifting off the band, the name and
// tagline in the corner, as a seamless 6s loop at 1200x630. One per mode, in public/og/home-<mode>.mp4, with a
// still (home-<mode>.jpg) for the poster. Base.astro links the dark pair from the home page.
//
//   node scripts/og-video.mjs [--only dark|light] [--cover tilt|full|peek|none] [--still] [--out dir]
//
// --cover puts the notebook's front cover on the right: whole (full), half off the edge (peek), or
// tilted and running off the bottom (tilt). --still writes just the poster frame, for trying layouts.
// The scene runs the site's own src/scripts/horizon.js on a virtual clock, one frame at a time, so the
// motion is the same as on the page and every frame is captured. Needs ffmpeg on the PATH.
// Env: CHROMIUM_PATH (browser binary), PLAYWRIGHT_CORE (path to playwright-core).
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = new URL("..", import.meta.url).pathname;
const at = (...parts) => join(root, ...parts);
const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const only = flag("--only");
// the share video's layout is tilt; --cover none leaves the notebook out
const cover = flag("--cover") === "none" ? undefined : flag("--cover") || "tilt";
const stillOnly = args.includes("--still");
const outDir = flag("--out") || at("public/og");
const suffix = cover && flag("--out") ? `-${cover}` : "";

// the page is drawn in a 1440x900 window, as the home page is on a laptop, and its top 1440x756 is
// captured at 1200x630 (a device scale of 5/6), so the band and grain look as they do on the site
const W = 1440;
const H = 900;
const SCALE = 1200 / 1440;
const CROP = 630 / SCALE;
const FPS = 30;
const LOOP = 6; // seconds
const BLEND = 1; // seconds of the loop's end that fade into its start

const font = (prefix) => {
  const file = readdirSync(at("public/fonts")).find((name) => name.startsWith(`${prefix}.`));
  if (!file) throw new Error(`no font ${prefix} in public/fonts`);
  return pathToFileURL(at("public/fonts", file)).href;
};
const horizon = readFileSync(at("src/scripts/horizon.js"), "utf8");
// the cover's outline, traced in data/notebook.ts, so it sits on the page without its photo background
const coverClip = readFileSync(at("src/data/notebook.ts"), "utf8").match(/front:[\s\S]*?book: "([^"]+)"/)[1];
// placements in the 1440x756 frame
const placements = {
  full: "height: 640px; right: 84px; top: 58px;",
  peek: "height: 820px; left: 1110px; top: 24px;",
  tilt: "height: 860px; left: 790px; top: 70px; rotate: 9deg;",
};

const page = (mode) => {
  const dark = mode === "dark";
  return `<!doctype html><html data-mode="${mode}"><head><meta charset="utf-8"><style>
  @font-face { font-family: "Geist Pixel"; src: url("${font("geist-pixel-square")}"); }
  @font-face { font-family: "Merriweather"; src: url("${font("merriweather-latin")}"); font-weight: 300 600; }
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: ${dark ? "#0c0c0e" : "#fff"}; -webkit-font-smoothing: antialiased; }
  .field { position: absolute; inset: 0; }
  canvas { position: absolute; width: 100%; height: 100%; image-rendering: pixelated; }
  .copy { position: absolute; left: 96px; top: ${Math.round(CROP) - (cover ? 330 : 250)}px; color: ${dark ? "#ecebe6" : "#11141c"}; }
  h1 { margin: 0; font: 400 ${cover ? 66 : 48}px/1 "Geist Pixel", monospace; }
  p { margin: ${cover ? 32 : 26}px 0 0; font: 400 ${cover ? 46 : 35}px/1.45 Merriweather, Georgia, serif; }
  .cover { position: absolute; aspect-ratio: 1268 / 1834; ${placements[cover] || "display: none;"}
    filter: drop-shadow(0 2px 3px rgb(30 25 25 / 0.3)) drop-shadow(0 22px 34px rgb(30 25 25 / 0.26)); }
  .cover img { width: 100%; height: 100%; clip-path: ${coverClip}; }
</style></head><body>
  <div class="field"><canvas data-horizon=""></canvas></div>
  <div class="copy"><h1>rohanth marem</h1><p>cs @ waterloo<br>i like to sidequest.</p></div>
  ${cover ? `<div class="cover"><img src="${pathToFileURL(at("src/assets/notebook/front.jpg")).href}"></div>` : ""}
  <script>${horizon}</script>
</body></html>`;
};

// a clock that only moves when told to: performance.now and requestAnimationFrame both follow it
const clock = `(() => {
  let now = 0, queue = [];
  performance.now = () => now;
  window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
  window.__advance = (ms) => { now += ms; const run = queue; queue = []; run.forEach((cb) => cb(now)); };
  // no load-in sweep: the band is already where it rests
  sessionStorage.setItem("horizon-in", "1");
})();`;

const require = createRequire(import.meta.url);
function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_CORE, "playwright-core", "playwright"].filter(Boolean);
  const npx = join(homedir(), ".npm/_npx");
  if (existsSync(npx)) for (const dir of readdirSync(npx)) candidates.push(join(npx, dir, "node_modules/playwright-core"));
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {}
  }
  throw new Error("playwright-core not found; set PLAYWRIGHT_CORE=/path/to/playwright-core");
}
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });

for (const mode of ["dark", "light"].filter((m) => !only || m === only)) {
  const frames = mkdtempSync(join(tmpdir(), `og-video-${mode}-`));
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
  await context.addInitScript(clock);
  const tab = await context.newPage();
  // a file, not setContent, so the page may load the font files next to it
  const html = join(frames, "scene.html");
  writeFileSync(html, page(mode));
  await tab.goto(pathToFileURL(html).href, { waitUntil: "load" });
  await tab.evaluate(() => document.fonts.ready);
  // let the sparks run a while first, so the loop starts mid-flow
  for (let i = 0; i < 4 * FPS; i++) await tab.evaluate((ms) => window.__advance(ms), 1000 / FPS);
  const total = stillOnly ? BLEND * FPS + 1 : (LOOP + BLEND) * FPS;
  for (let i = 0; i < total; i++) {
    await tab.evaluate((ms) => window.__advance(ms), 1000 / FPS);
    await tab.screenshot({ path: join(frames, `${String(i).padStart(4, "0")}.png`), clip: { x: 0, y: 0, width: W, height: CROP } });
  }
  await context.close();

  // The loop is frames BLEND..end, with its last BLEND seconds crossfading into frames 0..BLEND, so
  // its last frame runs straight on into its first.
  const out = join(outDir, `home-${mode}${suffix}.mp4`);
  const b = BLEND * FPS;
  if (!stillOnly) execFileSync("ffmpeg", [
    "-loglevel", "error", "-y",
    "-framerate", String(FPS), "-i", join(frames, "%04d.png"),
    "-filter_complex",
    `[0]split=3[a][b][c];` +
      `[a]trim=start_frame=${b}:end_frame=${total - b},setpts=PTS-STARTPTS[body];` +
      `[b]trim=start_frame=${total - b},setpts=PTS-STARTPTS[end];` +
      `[c]trim=end_frame=${b},setpts=PTS-STARTPTS[start];` +
      // fully faded in by the last frame, which is then the one just before the loop's first
      `[start]format=rgba,fade=t=in:st=0:d=${(b - 1) / FPS}:alpha=1[over];[end]format=rgba[under];[under][over]overlay=shortest=1:format=rgb[seam];` +
      `[body]format=rgba[main];[main][seam]concat=n=2:v=1,format=yuv420p[v]`,
    "-map", "[v]", "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "24",
    "-movflags", "+faststart", "-an", out,
  ]);
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", join(frames, `${String(b).padStart(4, "0")}.png`), "-q:v", "3", join(outDir, `home-${mode}${suffix}.jpg`)]);
  if (process.env.KEEP_FRAMES) console.log(frames); else rmSync(frames, { recursive: true });
  console.log(stillOnly ? join(outDir, `home-${mode}${suffix}.jpg`) : out);
}
await browser.close();
