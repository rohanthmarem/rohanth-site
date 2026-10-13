// Dithered post figures, after matthewtrent.me's blog images.
// At rest a coarse 1-bit Bayer dither of the photo sits on top. On hover (tap on touch) the
// photo dissolves through cell by cell in order of brightness — darkest areas first, highlights
// last — and on leave it re-inks in reverse. The sweep runs over the cells' brightness rank, so it
// moves at an even pace whatever the photo's histogram, and it is interruptible: it always runs
// from wherever it currently is. Colours come from the theme tokens (dark dots always use the
// darker token, so the dither reads the same way round in light and dark mode).
//
// Cells are a whole number of device pixels and the canvas is sized to the exact cell grid (the
// frame clips the overhang), so the dots stay crisp and square at any width, zoom level or DPR.

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.documentElement;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const IN_MS = 560;
const OUT_MS = 360;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

type Rgb = [number, number, number];
function rgb(name: string, fallback: string): Rgb {
  const v = getComputedStyle(root).getPropertyValue(name).trim() || fallback;
  const m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  const h = m ? m[1] : fallback.slice(1);
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const luma = (c: Rgb) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
function palette(): [Rgb, Rgb] {
  const ink = rgb("--ink", "#11141c");
  const paper = rgb("--paper", "#f6f7f9");
  return luma(ink) < luma(paper) ? [ink, paper] : [paper, ink];
}

class Figure {
  img: HTMLImageElement;
  frame: HTMLElement;
  canvas: HTMLCanvasElement | null = document.createElement("canvas");
  ctx = this.canvas!.getContext("2d")!;
  dark = new Uint8Array(0); // 1 = dark dot at rest
  order = new Uint32Array(0); // cell indices, darkest first
  out: ImageData | null = null;
  shown = 0; // cells currently cleared (photo showing), = order[0..shown)
  t = 0; // linear sweep state: 0 = fully dithered, 1 = fully photo
  target = 0;
  raf = 0;
  last = 0;
  key = "";
  pointer = "mouse";

  constructor(img: HTMLImageElement) {
    this.img = img;
    this.frame = document.createElement("span");
    this.frame.className = "dith-frame";
    this.canvas!.className = "dith";
    this.canvas!.setAttribute("aria-hidden", "true");
    img.replaceWith(this.frame);
    this.frame.append(img, this.canvas!);

    this.frame.addEventListener("pointerdown", (e) => { this.pointer = e.pointerType; });
    this.frame.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") this.go(1); });
    this.frame.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") this.go(0); });
    this.frame.addEventListener("click", () => { if (this.pointer !== "mouse") this.go(this.target ? 0 : 1); });

    img.addEventListener("error", () => this.fail(), { once: true });
    // also fires again when a resize/zoom makes the browser swap in another srcset candidate
    img.addEventListener("load", () => { this.key = ""; this.build(); });
    if (img.complete && img.naturalWidth) this.build();
    else if (img.complete && img.currentSrc) this.fail();
  }

  // the photo could not be loaded: drop the whole figure rather than show a broken image
  fail() {
    this.frame.closest("figure")?.setAttribute("hidden", "");
  }

  // no dither possible (e.g. a cross-origin photo taints the canvas): show the plain photo
  plain() {
    this.canvas?.remove();
    this.canvas = null;
    this.frame.classList.add("is-ready", "is-plain");
  }

  // Sample the photo at one value per cell. Cells are coarse on purpose (~150 across).
  build() {
    if (!this.canvas) return;
    const w = this.img.clientWidth;
    const h = this.img.clientHeight;
    if (!w || !h || !this.img.naturalWidth) return;
    const dpr = window.devicePixelRatio || 1;
    const devCell = Math.max(2, Math.round(Math.max(3, Math.min(7, Math.round(w / 150))) * dpr));
    const cell = devCell / dpr;
    const key = `${Math.round(w)}x${Math.round(h)}@${dpr}`;
    if (key === this.key) return;
    this.key = key;
    const tw = Math.ceil(w / cell - 1e-3);
    const th = Math.ceil(h / cell - 1e-3);

    const probe = document.createElement("canvas");
    probe.width = tw;
    probe.height = th;
    const pctx = probe.getContext("2d", { willReadFrequently: true })!;
    pctx.imageSmoothingQuality = "high";
    pctx.drawImage(this.img, 0, 0, w / cell, h / cell);
    let px: Uint8ClampedArray;
    try { px = pctx.getImageData(0, 0, tw, th).data; } catch { this.plain(); return; }

    const n = tw * th;
    const lum = new Float32Array(n);
    const rank = new Float32Array(n);
    this.dark = new Uint8Array(n);
    for (let y = 0; y < th; y++)
      for (let x = 0; x < tw; x++) {
        const i = y * tw + x;
        // edge cells past the photo (transparent in the probe) read as paper
        const a = px[i * 4 + 3] / 255;
        const l = a ? (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255 : 1;
        const b = BAYER[(y % 4) * 4 + (x % 4)];
        lum[i] = l;
        this.dark[i] = l < b ? 1 : 0;
        // ties in flat areas break in the Bayer pattern, so they dissolve as a texture, not a block
        rank[i] = l + (b - 0.5) * 0.035;
      }
    this.order = Uint32Array.from({ length: n }, (_, i) => i).sort((a, b) => rank[a] - rank[b]);

    this.canvas.width = tw;
    this.canvas.height = th;
    this.canvas.style.width = `${tw * cell}px`;
    this.canvas.style.height = `${th * cell}px`;
    this.out = this.ctx.createImageData(tw, th);
    this.shown = 0;
    this.paint();
    this.frame.classList.add("is-ready");
  }

  // full repaint (after a build or a theme change)
  paint() {
    const out = this.out;
    if (!out || !this.canvas) return;
    const [darkC, lightC] = palette();
    const d = out.data;
    for (let i = 0; i < this.dark.length; i++) {
      const c = this.dark[i] ? darkC : lightC;
      const o = i * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    const count = this.count();
    for (let k = 0; k < count; k++) d[this.order[k] * 4 + 3] = 0;
    this.shown = count;
    this.ctx.putImageData(out, 0, 0);
  }

  count() {
    return Math.round(ease(this.t) * this.order.length);
  }

  // incremental repaint: only the cells the sweep crossed since the last frame change
  draw() {
    const out = this.out;
    if (!out || !this.canvas) return;
    const next = this.count();
    if (next === this.shown) return;
    const d = out.data;
    if (next > this.shown) for (let k = this.shown; k < next; k++) d[this.order[k] * 4 + 3] = 0;
    else for (let k = next; k < this.shown; k++) d[this.order[k] * 4 + 3] = 255;
    this.shown = next;
    this.ctx.putImageData(out, 0, 0);
  }

  go(target: number) {
    this.target = target;
    if (reduce) {
      this.t = target;
      this.draw();
      return;
    }
    if (this.raf) return;
    this.last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(64, now - this.last);
      this.last = now;
      const dir = Math.sign(this.target - this.t);
      const dur = dir > 0 ? IN_MS : OUT_MS;
      this.t = Math.min(1, Math.max(0, this.t + (dir * dt) / dur));
      if ((dir > 0 && this.t >= this.target) || (dir < 0 && this.t <= this.target) || !dir) this.t = this.target;
      this.draw();
      this.raf = this.t === this.target ? 0 : requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
}

const figures = [...document.querySelectorAll<HTMLImageElement>("figure.fig img[data-dither]")].map((img) => new Figure(img));

if (figures.length) {
  let raf = 0;
  const rebuild = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => figures.forEach((f) => f.build()));
  };
  const observer = new ResizeObserver(rebuild);
  figures.forEach((f) => observer.observe(f.frame));
  // zooming changes the device-pixel ratio without always resizing the frame in CSS pixels
  const watchDpr = () => {
    matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener("change", () => { rebuild(); watchDpr(); }, { once: true });
  };
  watchDpr();
  document.addEventListener("theme-change", () => figures.forEach((f) => f.paint()));
}

// plain (non-dithered) post images that fail to load are dropped too
for (const img of document.querySelectorAll<HTMLImageElement>(".post figure.fig img:not([data-dither])")) {
  const drop = () => img.closest("figure")?.setAttribute("hidden", "");
  if (img.complete && !img.naturalWidth && img.currentSrc) drop();
  else img.addEventListener("error", drop, { once: true });
}

export {};
