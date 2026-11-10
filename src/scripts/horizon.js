// The atmospheric horizon behind the pages. Plain JS, inlined right after its canvas (WaveBackground),
// so it runs before the page first paints: arriving from another page, the band has to be on screen
// where that page left it from the very first frame, or the page transition would flash.
//
// One static draw on a device-aligned pixel grid: the grain is part of the colour field, not a
// repeating noise overlay, and a fixed seed prevents resize flicker. On top of it, a shader draws the
// same field while the band moves: sweeping in on the first page of a visit, and gliding between its
// spot on the home page and the top-right corner of the inner pages as you go from one to the other.
(() => {
  const canvas = document.querySelector("[data-horizon]");
  const context = canvas && canvas.getContext("2d", { alpha: false });
  if (!canvas || !context) return;
  // Two palettes: the white field by day, and at night a near-black one (the --paper of dark mode), the sky
  // above the band deepening to navy and the burn kept. `field` is the colour everything fades into; in
  // the dark the dither's lowest level is the field itself, so the empty page stays one flat colour.
  const palettes = {
    light: { field: [255, 255, 255], floor: [0, 0, 0], stops: [
      [-0.45, 255, 255, 255], [-0.25, 248, 251, 253], [-0.15, 205, 228, 242],
      [-0.075, 120, 180, 220], [-0.025, 96, 150, 185],
      [0, 214, 196, 150], [0.018, 240, 128, 44], [0.032, 244, 58, 18],
      [0.038, 250, 176, 140], [0.068, 255, 255, 255], [0.6, 255, 255, 255],
    ] },
    dark: { field: [12, 12, 14], floor: [12, 12, 14], stops: [
      [-0.45, 12, 12, 14], [-0.25, 14, 18, 30], [-0.15, 22, 42, 76],
      [-0.075, 46, 90, 150], [-0.025, 70, 118, 172],
      [0, 214, 172, 120], [0.018, 240, 118, 40], [0.032, 236, 58, 18],
      [0.038, 120, 42, 28], [0.068, 12, 12, 14], [0.6, 12, 12, 14],
    ] },
  };
  const palette = () => palettes[document.documentElement.dataset.mode === "dark" ? "dark" : "light"];
  const bayer = [0,48,12,60,3,51,15,63,32,16,44,28,35,19,47,31,8,56,4,52,11,59,7,55,40,24,36,20,43,27,39,23,2,50,14,62,1,49,13,61,34,18,46,30,33,17,45,29,10,58,6,54,9,57,5,53,42,26,38,22,41,25,37,21];
  const quietField = document.body.classList.contains("layout-lab");
  const corner = canvas.dataset.horizon === "corner";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // the loose grains drift out from the red streak (see emit); with reduced motion they stay put in the field
  const embers = !reduce && !quietField;

  // The band is the line ny = at + slope * nx. The home page runs it from the top down behind the
  // notebook; inner pages (corner) slide it up into the top-right corner, clear of the page head.
  // On a phone the home page is stacked and the field is as tall as the page, so the band is placed in
  // window heights (k) and drawn at the same width it has on a window-sized field: across the top, into
  // the top-right corner, above the text.
  function geometry() {
    if (corner) return innerWidth < 900 ? { at: -0.36, slope: 0.46, scale: 1 } : { at: -0.62, slope: 0.8, scale: 1 };
    if (innerWidth >= 900) return { at: -0.2, slope: 0.8, scale: 1 };
    const k = innerHeight / (canvas.getBoundingClientRect().height || innerHeight);
    return { at: -0.25 * k, slope: 0.5 * k, scale: 1 / k };
  }
  let line = geometry();
  const cells = () => {
    const cell = Math.max(1, Math.round(2 * devicePixelRatio)) / devicePixelRatio;
    return [Math.ceil(innerWidth / cell), Math.ceil(canvas.getBoundingClientRect().height / cell)];
  };

  let drawn = 0; // the canvas's height in CSS px when last drawn
  function draw() {
    line = geometry();
    const [width, height] = cells();
    // phones: the field is as tall as the page, which is still empty when this first runs (see below)
    if (!width || !height) return;
    drawn = canvas.getBoundingClientRect().height;
    canvas.width = width;
    canvas.height = height;
    const { field, floor, stops } = palette();
    const frame = context.createImageData(width, height);
    let expected = 0;
    let seed = 4275;
    const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
    const near = (quietField ? 0.09 : 0.16) ** 2;
    const [first, last] = [stops[0][0], stops[stops.length - 3][0]];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const nx = x / width;
        const ny = y / height;
        const distance = (ny - (line.at + nx * line.slope)) * line.scale;
        // most of the window is plain field, past either end of the band: no need to work it out
        if (embers && (distance < first || distance > last)) {
          if (distance < 0.6) expected += 0.15 * Math.exp(-distance * distance / near);
          const i = (y * width + x) * 4;
          frame.data[i] = field[0]; frame.data[i + 1] = field[1]; frame.data[i + 2] = field[2]; frame.data[i + 3] = 255;
          continue;
        }
        let stop = 0;
        while (stop < stops.length - 2 && distance > stops[stop + 1][0]) stop++;
        const a = stops[stop], b = stops[stop + 1];
        const t = Math.max(0, Math.min(1, (distance - a[0]) / (b[0] - a[0])));
        const fade = 0.72 + 0.28 * Math.sin(nx * Math.PI);
        const threshold = (bayer[(y & 7) * 8 + (x & 7)] + 0.5) / 64;
        // grain gathers around the band and leaves the white field (and the text on it) clean
        const envelope = Math.exp(-distance * distance / near);
        if (embers) expected += 0.15 * envelope;
        const tint = !embers && random() < 0.15 * envelope;
        const channel = tint && (random() < 0.6 ? 0 : random() < 0.625 ? 2 : 1);
        const i = (y * width + x) * 4;
        const streak = 1 + 0.06 * Math.sin(distance * 460 + nx * 4);
        for (let c = 0; c < 3; c++) {
          // fade and streak thin the colour out toward white, so the white field stays white
          const base = field[c] + (a[c + 1] + (b[c + 1] - a[c + 1]) * t - field[c]) * fade * streak * (quietField ? 0.02 + 0.98 * envelope : 1);
          const bias = tint ? (c === channel ? 0.3 : -0.15) : 0;
          const level = Math.max(0, Math.min(4, Math.floor((base - floor[c]) / (255 - floor[c]) * 4 + threshold + bias)));
          frame.data[i + c] = floor[c] + level * (255 - floor[c]) / 4;
        }
        frame.data[i + 3] = 255;
      }
    }
    context.putImageData(frame, 0, 0);
    if (embers) emit(expected, width, height);
  }

  // The grain as particles: each one leaves the red streak, floats out across the field on one side or
  // the other, and is emitted again when it gets as far as it goes. How far is drawn so that, at any
  // moment, they're spread like the still grain was (the envelope above), and each takes its
  // colour from the field where it is, so near the band it's a darker fleck and out on the page a pale one.
  const EMIT = 0.03, SPREAD = 0.16;
  const rgb = [0, 0, 0];
  let sparks = null;
  function emit(count, width, height) {
    const layer = sparks?.layer || document.createElement("canvas");
    if (!sparks) {
      layer.setAttribute("aria-hidden", "true");
      Object.assign(layer.style, { position: "absolute", inset: "0", width: "100%", height: "100%", imageRendering: "pixelated" });
      canvas.after(layer);
    }
    layer.width = width;
    layer.height = height;
    const n = Math.round(count);
    const ink = layer.getContext("2d");
    sparks = { layer, ink, image: ink.createImageData(width, height), width, height, n,
      nx: new Float32Array(n), out: new Float32Array(n), reach: new Float32Array(n), speed: new Float32Array(n),
      drift: new Float32Array(n), side: new Int8Array(n), threshold: new Float32Array(n), channel: new Uint8Array(n) };
    for (let k = 0; k < n; k++) spawn(k, true);
    step(0);
    // drawn in place now, so they're there as the page arrives; set moving once any page transition is over
    (window.__settled || Promise.resolve()).then(start);
  }
  function spawn(k, anywhere) {
    const s = sparks;
    s.reach[k] = SPREAD * Math.sqrt(-Math.log(1 - Math.random()));
    s.out[k] = anywhere ? Math.random() * s.reach[k] : 0;
    s.side[k] = Math.random() < 0.5 ? -1 : 1;
    s.nx[k] = Math.random();
    s.speed[k] = 0.008 + Math.random() * 0.022;
    // a little fan either side of straight out
    s.drift[k] = (Math.random() - 0.5) * 0.5;
    s.threshold[k] = Math.random();
    s.channel[k] = Math.random() < 0.6 ? 0 : Math.random() < 0.625 ? 2 : 1;
  }
  function step(dt) {
    const s = sparks;
    const { field, floor, stops } = palette();
    const data = s.image.data;
    data.fill(0);
    // how far across the window a step of the band's distance moves, when the step is square to the band
    const W = s.width, H = s.height;
    const normal = -line.slope * H * H / (W * W + line.slope * line.slope * H * H);
    for (let k = 0; k < s.n; k++) {
      s.out[k] += s.speed[k] * dt;
      if (s.out[k] > s.reach[k]) spawn(k, false);
      // out along the band's normal on screen (diagonal, since the band is), not straight down the page
      const travel = s.side[k] * s.out[k] / line.scale;
      const nx = (((s.nx[k] + (normal + s.drift[k] * normal) * travel) % 1) + 1) % 1;
      const distance = EMIT + s.side[k] * s.out[k];
      const y = Math.floor((line.at + nx * line.slope + distance / line.scale) * s.height);
      if (y < 0 || y >= s.height) continue;
      const i = (y * s.width + Math.floor(nx * s.width)) * 4;
      let stop = 0;
      while (stop < stops.length - 2 && distance > stops[stop + 1][0]) stop++;
      const a = stops[stop], b = stops[stop + 1];
      const t = Math.max(0, Math.min(1, (distance - a[0]) / (b[0] - a[0])));
      const fade = 0.72 + 0.28 * Math.sin(nx * Math.PI);
      const streak = 1 + 0.06 * Math.sin(distance * 460 + nx * 4);
      let shows = false;
      for (let c = 0; c < 3; c++) {
        const base = field[c] + (a[c + 1] + (b[c + 1] - a[c + 1]) * t - field[c]) * fade * streak;
        const v = (base - floor[c]) / (255 - floor[c]) * 4 + s.threshold[k];
        const level = Math.max(0, Math.min(4, Math.floor(v + (c === s.channel[k] ? 0.3 : -0.15))));
        // a grain only shows where its tint tips the dither to another level
        if (level !== Math.max(0, Math.min(4, Math.floor(v)))) shows = true;
        rgb[c] = floor[c] + level * (255 - floor[c]) / 4;
      }
      if (!shows) continue;
      data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
    }
    s.ink.putImageData(s.image, 0, 0);
  }
  // about 30 frames a second, and only while the field is on screen
  let running = false, onScreen = true, last = 0;
  const loop = (now) => {
    if (!onScreen) { running = false; return; }
    requestAnimationFrame(loop);
    if (now - last < 32) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    step(dt);
  };
  function start() {
    if (running || !onScreen) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }
  if (embers) new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; if (sparks) start(); }).observe(canvas);

  // Where the band was on the page we came from: written as any page is left, read as the next one starts.
  const KEY = "horizon-from";
  let from = null;
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || "null");
    sessionStorage.removeItem(KEY);
    if (saved && Date.now() - saved.t < 4000 && saved.w === innerWidth) from = saved;
  } catch {}
  addEventListener("pagehide", () => {
    try { sessionStorage.setItem(KEY, JSON.stringify({ ...line, w: innerWidth, t: Date.now() })); } catch {}
  });
  let firstVisit = false;
  try { firstVisit = !sessionStorage.getItem("horizon-in"); sessionStorage.setItem("horizon-in", "1"); } catch {}

  const same = (a, b) => Math.abs(a.at - b.at) < 1e-3 && Math.abs(a.slope - b.slope) < 1e-3 && a.scale === b.scale;
  // page to page: lift the band off where it was and glide it over to here
  const glide = (from) => ({ from, duration: 1150, ease: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2), glow: 0.55 });
  let motion = null;
  if (!reduce && !quietField && line.scale === 1) {
    if (from && from.scale === 1 && !same(from, line)) {
      motion = glide(from);
    } else if (!from && firstVisit) {
      // the load-in: up across the window from below, sky first, then the burn, then clean white behind it
      motion = { from: { ...line, at: line.at + 1 + 0.5 / line.scale }, duration: 1700, ease: (x) => 1 - Math.pow(1 - x, 4), spreadFrom: 1.9, wave: 0.03 };
    }
  }
  const animating = motion && play(motion);
  // the shader covers the static field while it plays, so the slow pixel loop waits until the band has
  // landed (play() calls it), instead of stalling the page transition partway through
  if (!animating) draw();

  // Back (or forward) to a page kept in the browser's back/forward cache: this script doesn't run again,
  // so nothing read the band's spot that the page we just left saved on its way out. Left there, it went
  // stale and the next page loaded within a few seconds glided from the wrong place, or not at all (say
  // home -> writing -> back -> writing again: no glide). Read it here instead, and glide from it.
  addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    let back = null;
    try {
      back = JSON.parse(sessionStorage.getItem(KEY) || "null");
      sessionStorage.removeItem(KEY);
    } catch {}
    line = geometry();
    if (reduce || quietField || line.scale !== 1 || !back || Date.now() - back.t > 4000 || back.w !== innerWidth || back.scale !== 1 || same(back, line)) return;
    play(glide(back));
  });

  let resize;
  const redraw = () => { clearTimeout(resize); resize = setTimeout(draw, 150); };
  addEventListener("resize", redraw, { passive: true });
  // On phones the field scrolls with the page and is as tall as it: drawn once the page below has laid
  // out, and again if its height changes (fonts, images), so the band stays where it belongs.
  new ResizeObserver(() => {
    const height = canvas.getBoundingClientRect().height;
    if (Math.abs(height - drawn) < 1) return;
    if (!drawn) draw();
    else redraw();
  }).observe(canvas);
  // light/dark switched (the toggle, or the system's setting): redrawn at once, inside the page's crossfade
  document.addEventListener("modechange", draw);

  // The same field as draw(), as a WebGL2 shader, for while the band moves. After glimm.dev's band
  // transitions, done in the site's own palette and dither. Returns false if it can't run.
  function play({ from, duration, ease, spreadFrom = 1, glow = 0, wave = 0 }) {
    const sweep = document.createElement("canvas");
    const gl = sweep.getContext("webgl2", { alpha: false, antialias: false, depth: false });
    if (!gl) return false;
    sweep.setAttribute("aria-hidden", "true");
    Object.assign(sweep.style, { position: "absolute", inset: "0", width: "100%", height: "100%", imageRendering: "pixelated" });
    [sweep.width, sweep.height] = cells();
    const { field, floor, stops } = palette();
    const vec = (c) => `vec3(${c.map((v) => (v / 255).toFixed(4)).join(",")})`;
    const fragment = `#version 300 es
precision highp float;
out vec4 colour;
uniform vec2 size;
uniform float at, slope, scale, spread, wave, time;
const float POS[${stops.length}] = float[](${stops.map((s) => s[0].toFixed(4)).join(",")});
const vec3 COL[${stops.length}] = vec3[](${stops.map((s) => vec(s.slice(1))).join(",")});
const vec3 FIELD = ${vec(field)}, FLOOR = ${vec(floor)};
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer8(vec2 a) { return bayer2(0.25 * a) * 0.0625 + bayer2(0.5 * a) * 0.25 + bayer2(a); }
void main() {
  vec2 cell = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y);
  float nx = cell.x / size.x, ny = cell.y / size.y;
  float d = (ny - (at + nx * slope + wave * sin(nx * 7.0 + time * 2.6))) * scale / spread;
  int i = 0;
  for (int k = 0; k < ${stops.length - 2}; k++) if (d > POS[k + 1]) i = k + 1;
  float t = clamp((d - POS[i]) / (POS[i + 1] - POS[i]), 0.0, 1.0);
  vec3 c = mix(COL[i], COL[i + 1], t);
  float fade = 0.72 + 0.28 * sin(nx * 3.14159265);
  float streak = 1.0 + 0.06 * sin(d * 460.0 + nx * 4.0);
  vec3 tone = FIELD + (c - FIELD) * fade * streak;
  float envelope = exp(-pow(d / 0.16, 2.0));
  float r = hash(cell), pick = hash(cell + 17.0);
  vec3 bias = r < 0.15 * envelope ? (pick < 0.6 ? vec3(0.3, -0.15, -0.15) : pick < 0.85 ? vec3(-0.15, -0.15, 0.3) : vec3(-0.15, 0.3, -0.15)) : vec3(0.0);
  vec3 level = clamp(floor((tone - FLOOR) / (1.0 - FLOOR) * 4.0 + bayer8(cell) + bias), 0.0, 4.0);
  colour = vec4(FLOOR + level / 4.0 * (1.0 - FLOOR), 1.0);
}`;
    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, "#version 300 es\nin vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }"));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const p = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(p);
    gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
    const u = (name) => gl.getUniformLocation(program, name);
    gl.viewport(0, 0, sweep.width, sweep.height);
    gl.uniform2f(u("size"), sweep.width, sweep.height);
    gl.uniform1f(u("scale"), line.scale);
    canvas.after(sweep);

    let start = 0;
    const frame = (now) => {
      if (!start) start = now;
      const x = Math.min(1, (now - start) / duration);
      const k = ease(x);
      gl.uniform1f(u("at"), from.at + (line.at - from.at) * k);
      gl.uniform1f(u("slope"), from.slope + (line.slope - from.slope) * k);
      // the band widens and glows as it travels, and tightens as it lands
      gl.uniform1f(u("spread"), 1 + (spreadFrom - 1) * (1 - k) + glow * Math.sin(Math.PI * x));
      gl.uniform1f(u("wave"), wave * (1 - k));
      gl.uniform1f(u("time"), now / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (x < 1) return requestAnimationFrame(frame);
      draw();
      sweep.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: "ease-out" }).finished.then(() => sweep.remove());
    };
    // the first frame now, not on the next tick, so the page never paints without it
    frame(performance.now());
    return true;
  }
})();
