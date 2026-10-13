// Dithered post figures, after matthewtrent.me's blog images.
// At rest a coarse 1-bit Bayer dither of the photo sits on top. On hover (tap on touch) the
// photo dissolves through cell by cell in order of brightness — darkest areas first, highlights
// last — and on leave it re-inks in reverse. The animation is interruptible: it always runs
// from wherever the sweep currently is. Colours come from the theme tokens.

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
const root = document.documentElement;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const IN_MS = 520;
const OUT_MS = 320;

type Rgb = [number, number, number];
function rgb(name: string, fallback: string): Rgb {
  const v = getComputedStyle(root).getPropertyValue(name).trim() || fallback;
  const h = v.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

class Figure {
  img: HTMLImageElement;
  frame: HTMLElement;
  canvas = document.createElement("canvas");
  ctx = this.canvas.getContext("2d")!;
  lum = new Float32Array(0);
  ink = new Uint8Array(0);
  lo = 0;
  hi = 1;
  out: ImageData | null = null;
  t = 0; // 0 = fully dithered, 1 = fully photo
  target = 0;
  raf = 0;
  last = 0;
  w = 0;

  constructor(img: HTMLImageElement) {
    this.img = img;
    this.frame = document.createElement("span");
    this.frame.className = "dith-frame";
    this.canvas.className = "dith";
    this.canvas.setAttribute("aria-hidden", "true");
    img.replaceWith(this.frame);
    this.frame.append(img, this.canvas);

    if (reduce) { this.frame.addEventListener("click", () => this.jump(this.t ? 0 : 1)); }
    else if (fine) {
      this.frame.addEventListener("pointerenter", () => this.go(1));
      this.frame.addEventListener("pointerleave", () => this.go(0));
    } else this.frame.addEventListener("click", () => this.go(this.target ? 0 : 1));

    if (img.complete && img.naturalWidth) this.build();
    else img.addEventListener("load", () => this.build(), { once: true });
  }

  // Sample the photo at one value per cell. Cells are coarse on purpose (~150 across).
  build() {
    const w = Math.round(this.img.clientWidth);
    const h = Math.round(this.img.clientHeight);
    if (!w || !h || !this.img.naturalWidth) return;
    this.w = w;
    const cell = Math.max(3, Math.min(7, Math.round(w / 150)));
    const tw = Math.ceil(w / cell);
    const th = Math.ceil(h / cell);
    this.canvas.width = tw;
    this.canvas.height = th;
    const probe = document.createElement("canvas");
    probe.width = tw;
    probe.height = th;
    const pctx = probe.getContext("2d", { willReadFrequently: true })!;
    pctx.drawImage(this.img, 0, 0, tw, th);
    const px = pctx.getImageData(0, 0, tw, th).data;
    this.lum = new Float32Array(tw * th);
    this.ink = new Uint8Array(tw * th);
    let lo = 1, hi = 0;
    for (let y = 0; y < th; y++)
      for (let x = 0; x < tw; x++) {
        const i = y * tw + x;
        const l = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
        this.lum[i] = l;
        this.ink[i] = l < BAYER[(y % 4) * 4 + (x % 4)] ? 1 : 0;
        if (l < lo) lo = l;
        if (l > hi) hi = l;
      }
    this.lo = lo;
    this.hi = hi + 1e-3;
    this.out = this.ctx.createImageData(tw, th);
    this.draw();
  }

  // Cells darker than the sweep threshold are cleared to show the photo underneath.
  draw() {
    const out = this.out;
    if (!out) return;
    const ink = rgb("--ink", "#191919");
    const paper = rgb("--paper", "#f7f6f5");
    const cut = this.t <= 0 ? -1 : this.t >= 1 ? 2 : this.lo + this.t * (this.hi - this.lo);
    const d = out.data;
    for (let i = 0; i < this.lum.length; i++) {
      const o = i * 4;
      if (this.lum[i] < cut) { d[o + 3] = 0; continue; }
      const c = this.ink[i] ? ink : paper;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    this.ctx.putImageData(out, 0, 0);
  }

  jump(t: number) {
    this.t = this.target = t;
    this.draw();
  }

  go(target: number) {
    this.target = target;
    if (this.raf) return;
    this.last = performance.now();
    const step = (now: number) => {
      const dt = now - this.last;
      this.last = now;
      const dur = this.target > this.t ? IN_MS : OUT_MS;
      const dir = Math.sign(this.target - this.t);
      this.t = Math.min(1, Math.max(0, this.t + (dir * dt) / dur));
      if ((dir > 0 && this.t >= this.target) || (dir < 0 && this.t <= this.target)) this.t = this.target;
      this.draw();
      this.raf = this.t === this.target ? 0 : requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
}

const figures = [...document.querySelectorAll<HTMLImageElement>("figure.fig img[data-dither]")].map((img) => new Figure(img));

if (figures.length) {
  let raf = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => figures.forEach((f) => { if (Math.round(f.img.clientWidth) !== f.w) f.build(); }));
  }).observe(document.body);
  document.addEventListener("theme-change", () => figures.forEach((f) => f.draw()));
}

export {};
