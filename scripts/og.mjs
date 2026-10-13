// Social-share images: one 1200x630 JPEG per page in public/og/<slug>.jpg, rendered from an
// HTML template in headless Chromium. Base.astro picks the file from the page's path
// ("/" -> home, "/projects/x" -> projects-x, "/writing" -> writing, ...).
//
//   node scripts/og.mjs [--site http://127.0.0.1:4321 | --port 4498] [--only slug,slug]
//
// The inspiration card fan is captured from the live page, so it needs a running site:
// pass --site, or the script starts `astro dev` on a spare port and stops it afterwards.
// Home's image is the avatar itself (scripts/favicons.mjs), not rendered here.
// Env: CHROMIUM_PATH (browser binary), PLAYWRIGHT_CORE (path to playwright-core).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { parse as parseYaml } from "yaml";

const root = new URL("..", import.meta.url).pathname;
const at = (...parts) => join(root, ...parts);
const fileUrl = (path) => pathToFileURL(path).href;
const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const only = flag("--only")?.split(",");

const W = 1200;
const H = 630;

// ---------- content ----------
const frontmatter = (file) => parseYaml(readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/)[1]);
const entries = (dir) =>
  readdirSync(at(dir))
    .filter((file) => /\.mdx?$/.test(file))
    .map((file) => ({ id: file.replace(/\.mdx?$/, ""), ...frontmatter(at(dir, file)) }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
const fmtDot = (value) => {
  const d = new Date(value);
  return [d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCFullYear() % 100].map((n) => String(n).padStart(2, "0")).join(".");
};
const font = (prefix) => {
  const file = readdirSync(at("public/fonts")).find((name) => name.startsWith(`${prefix}.`));
  if (!file) throw new Error(`no font ${prefix} in public/fonts`);
  return fileUrl(at("public/fonts", file));
};

const projects = entries("content/projects");
const writings = entries("content/writings");
const cover = (id) => (existsSync(at("src/assets/writing", `${id}.webp`)) ? at("src/assets/writing", `${id}.webp`) : undefined);
const sq = (name) => at("src/assets/sidequests", `${name}.webp`);
const projectImage = (project) => (project.image ? at("content/projects", project.image) : undefined);

// ---------- cards ----------
// layouts: "split" (text left, one image right), "strip" (text top, a row of images bleeding
// off the bottom-right), "fan" (text top, the inspiration card fan along the bottom), "plain".
const cards = [
  {
    slug: "projects",
    layout: "strip",
    label: "projects",
    title: "projects",
    text: "things i've built, crashed, raced and occasionally won with.",
    images: projects.filter((p) => p.image).slice(0, 5).map((p) => ({ src: projectImage(p), position: p.imagePosition })),
  },
  {
    slug: "writing",
    layout: "strip",
    label: "writing",
    title: "writing",
    text: "essays, lists and the occasional rant.",
    images: writings.map((w) => cover(w.id)).filter(Boolean).map((src) => ({ src, ratio: 16 / 9 })),
  },
  {
    slug: "inspiration",
    layout: "fan",
    label: "inspiration",
    title: "inspirations",
    text: "people, readings and youtube rabbit-holes that rewired how i think.",
  },
  {
    slug: "sidequests",
    layout: "strip",
    label: "sidequests",
    title: "sidequests",
    text: "running, food, photos, airport wings and karate.",
    images: [
      { src: sq("run-start") },
      { src: sq("food-katsu") },
      { src: sq("photo-dumbo") },
      { src: sq("wings-film") },
      { src: sq("karate-jump") },
    ],
  },
  { slug: "404", layout: "plain", label: "404", title: "404", text: "looks like this page wandered off." },
  { slug: "default", layout: "plain", label: "rohanth.com", title: "rohanth marem", text: "cs @ uwaterloo — i like to sidequest." },
  ...projects.map((p) => ({
    slug: `projects-${p.id}`,
    layout: projectImage(p) ? "split" : "plain",
    label: "projects",
    meta: fmtDot(p.date),
    title: p.title,
    text: p.description,
    images: projectImage(p) ? [{ src: projectImage(p), position: p.imagePosition }] : [],
  })),
  ...writings.map((w) => ({
    slug: `writing-${w.id}`,
    layout: cover(w.id) ? "split" : "plain",
    label: "writing",
    meta: [fmtDot(w.date), ...(w.tags ?? [])].join(" · "),
    title: w.title,
    text: w.description,
    images: cover(w.id) ? [{ src: cover(w.id), ratio: 16 / 9 }] : [],
  })),
].filter((card) => !only || only.includes(card.slug));

// ---------- template ----------
const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const css = `
@font-face { font-family: "Geist Pixel"; src: url("${font("geist-pixel-square")}"); }
@font-face { font-family: "Ioskeley Mono"; src: url("${font("ioskeley-mono-regular")}"); font-weight: 400; }
@font-face { font-family: "Ioskeley Mono"; src: url("${font("ioskeley-mono-medium")}"); font-weight: 500; }
@font-face { font-family: "Merriweather"; src: url("${font("merriweather-latin")}"); font-weight: 300 600; }
* { box-sizing: border-box; margin: 0; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
body { position: relative; background: #f6f7f9; color: #11141c; -webkit-font-smoothing: antialiased; }
/* column hairlines + the little tick at the top of each, like the site frame */
.line { position: absolute; top: 0; bottom: 0; width: 1px; background: rgb(17 24 48 / 0.075); z-index: 3; }
.line::before, .line::after { content: ""; position: absolute; left: 0; width: 1px; height: 10px; background: rgb(17 24 48 / 0.18); }
.line::before { top: 12px; }
.line::after { bottom: 12px; }
.label { position: absolute; left: 120px; top: 64px; font: 400 17px/1 "Ioskeley Mono", monospace; color: rgb(17 20 28 / 0.64); display: flex; gap: 14px; }
.label b { font-weight: 400; color: #2200ff; }
.label i { font-style: normal; color: rgb(17 20 28 / 0.32); }
h1 { font: 400 var(--size, 64px)/1.06 "Geist Pixel", monospace; letter-spacing: -0.01em; }
p { margin-top: 22px; font: 300 25px/1.45 "Merriweather", serif; color: rgb(17 20 28 / 0.64); }
.meta { position: absolute; left: 120px; bottom: 60px; font: 400 16px/1 "Ioskeley Mono", monospace; color: rgb(17 20 28 / 0.5); }
.img { position: absolute; z-index: 4; overflow: hidden; background: #eceef3; box-shadow: 0 0 0 1px rgb(17 24 48 / 0.1); }
.img img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* accent crop marks on the lead image */
.cm { position: absolute; width: 12px; height: 12px; border: 0 solid #2200ff; z-index: 5; }
.cm.tl { border-width: 1.5px 0 0 1.5px; } .cm.tr { border-width: 1.5px 1.5px 0 0; }
.cm.bl { border-width: 0 0 1.5px 1.5px; } .cm.br { border-width: 0 1.5px 1.5px 0; }
`;

const lines = (xs) => xs.map((x) => `<i class="line" style="left:${x}px"></i>`).join("");
const cropMarks = (x, y, w, h, gap = 10) => `
  <i class="cm tl" style="left:${x - gap - 12}px;top:${y - gap - 12}px"></i>
  <i class="cm tr" style="left:${x + w + gap}px;top:${y - gap - 12}px"></i>
  <i class="cm bl" style="left:${x - gap - 12}px;top:${y + h + gap}px"></i>
  <i class="cm br" style="left:${x + w + gap}px;top:${y + h + gap}px"></i>`;
const label = (card) => `<div class="label"><span>rohanth marem</span><i>/</i><b>${esc(card.label)}</b></div>`;
const titleSize = (title) => (title.length <= 14 ? 64 : title.length <= 22 ? 56 : 50);
const img = (image, style) =>
  `<div class="img" style="${style}"><img src="${fileUrl(image.src)}" style="object-position:${image.position === "top" ? "50% 0%" : image.position ?? "50% 50%"}"></div>`;

function render(card) {
  let body = "";
  if (card.layout === "split") {
    // photos: text 120..560 | image 616..1120 (near-square). 16:9 covers: text 120..520 | image 560..1120.
    const image = card.images[0];
    const wide = Boolean(image.ratio && image.ratio > 1.4);
    const textW = wide ? 400 : 440;
    const x = wide ? 560 : 616, w = 1120 - x;
    const h = image.ratio ? Math.round(w / image.ratio) : 446;
    const y = Math.round((H - h) / 2);
    body = `${lines([64, 120, x - 16, 1136])}
      ${label(card)}
      <div style="position:absolute;left:120px;top:0;bottom:0;width:${textW}px;display:flex;flex-direction:column;justify-content:center;padding-bottom:8px">
        <h1 style="--size:${titleSize(card.title)}px">${esc(card.title)}</h1>
        ${card.text ? `<p>${esc(card.text)}</p>` : ""}
      </div>
      ${card.meta ? `<div class="meta">${esc(card.meta)}</div>` : ""}
      ${img(image, `left:${x}px;top:${y}px;width:${w}px;height:${h}px`)}
      ${cropMarks(x, y, w, h)}`;
  } else if (card.layout === "strip") {
    const top = 318, h = 360, gap = 14;
    let x = 120;
    const tiles = card.images.map((image) => {
      const w = Math.round(h * (image.ratio ?? 0.82));
      const html = img(image, `left:${x}px;top:${top}px;width:${w}px;height:${h}px`);
      x += w + gap;
      return html;
    });
    body = `${lines([64, 120, 1136])}
      ${label(card)}
      <div style="position:absolute;left:120px;top:126px;width:900px">
        <h1>${esc(card.title)}</h1>
        <p>${esc(card.text)}</p>
      </div>
      ${tiles.join("")}`;
  } else if (card.layout === "fan") {
    body = `${lines([64, 120, 1136])}
      ${label(card)}
      <div style="position:absolute;left:120px;top:126px;width:900px">
        <h1>${esc(card.title)}</h1>
        <p>${esc(card.text)}</p>
      </div>
      <img src="${fileUrl(card.fan)}" style="position:absolute;left:50%;transform:translateX(-50%);top:290px;width:1040px;z-index:4">`;
  } else {
    body = `${lines([64, 120, 1136])}
      ${label(card)}
      <div style="position:absolute;left:120px;top:0;bottom:0;width:900px;display:flex;flex-direction:column;justify-content:center">
        <h1 style="--size:${card.title.length <= 4 ? 132 : 84}px">${esc(card.title)}</h1>
        <p style="font-size:30px">${esc(card.text)}</p>
      </div>
      ${card.meta ? `<div class="meta">${esc(card.meta)}</div>` : ""}`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`;
}

// ---------- browser ----------
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
const executablePath = [process.env.CHROMIUM_PATH, "/tmp/shots/chromium/chrome-mac/Chromium.app/Contents/MacOS/Chromium"].find(
  (path) => path && existsSync(path),
);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, executablePath });

// The inspiration fan, captured from the real page (light theme, no frame, no grain).
async function captureFan(dest) {
  let site = flag("--site");
  let server;
  if (!site) {
    const port = Number(flag("--port") ?? 4498);
    site = `http://127.0.0.1:${port}`;
    server = spawn("npx", ["astro", "dev", "--port", String(port), "--host", "127.0.0.1"], { cwd: root, stdio: "ignore", detached: true });
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(site)).ok) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 2 });
    await page.addInitScript(() => localStorage.setItem("theme", "light"));
    await page.goto(`${site}/inspiration`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: ".lines, .side { visibility: hidden !important; } body::after { content: none !important; } html, body, .frame, main, .table { background: transparent !important; }" });
    await page.waitForTimeout(2500); // let the deal-in animation settle
    // the cards overhang #hand; clip to the union of the cards themselves (+ room for the shadow)
    const box = await page.evaluate(() => {
      const rects = [...document.querySelectorAll("#hand .card")].map((card) => card.getBoundingClientRect());
      const x = Math.min(...rects.map((r) => r.left)), y = Math.min(...rects.map((r) => r.top));
      return { x, y, right: Math.max(...rects.map((r) => r.right)), bottom: Math.max(...rects.map((r) => r.bottom)) };
    });
    const pad = 24;
    await page.screenshot({
      path: dest,
      omitBackground: true,
      clip: { x: Math.max(0, box.x - pad), y: box.y - pad, width: Math.min(1280, box.right + pad) - Math.max(0, box.x - pad), height: box.bottom - box.y + pad * 2 },
    });
    await page.close();
  } finally {
    if (server) process.kill(-server.pid); // the whole group: npx and the astro process under it
  }
}

const work = mkdtempSync(join(tmpdir(), "og-"));
mkdirSync(at("public/og"), { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  for (const card of cards) {
    if (card.layout === "fan") {
      card.fan = join(work, "fan.png");
      await captureFan(card.fan);
    }
    const html = join(work, `${card.slug}.html`);
    writeFileSync(html, render(card));
    await page.goto(fileUrl(html), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const png = await page.screenshot({ type: "png" });
    const out = at("public/og", `${card.slug}.jpg`);
    await sharp(png).jpeg({ quality: 84, mozjpeg: true, chromaSubsampling: "4:4:4" }).toFile(out);
    console.log(`og/${card.slug}.jpg  ${Math.round(statSync(out).size / 1024)}KB`);
  }
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
