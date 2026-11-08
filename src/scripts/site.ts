// Site-wide behaviour, bundled once and shared by every page (~2KB).
//   mark.hl                 highlight sweeps in when scrolled into view
//   [data-scramble-in]      text resolves left→right behind a few scrambled glyphs, once, in view
//   [data-scramble-hover]   a scramble wave passes over the text on hover (from the old site)

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

function inView(els: Iterable<Element>, fn: (el: Element) => void, threshold = 0.6) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); }
    },
    { threshold },
  );
  for (const el of els) io.observe(el);
}

/* ── highlights ─────────────────────────────────────────────── */
const marks = document.querySelectorAll<HTMLElement>("mark.hl");
if (reduce) marks.forEach((m) => m.classList.add("is-on"));
else {
  marks.forEach((m) => {
    if (m.dataset.trigger === "hover") {
      m.addEventListener("pointerenter", () => m.classList.add("is-on"));
      m.addEventListener("pointerleave", () => m.classList.remove("is-on"));
    } else if (m.dataset.trigger === "auto") requestAnimationFrame(() => m.classList.add("is-on"));
  });
  inView([...marks].filter((m) => !m.dataset.trigger || m.dataset.trigger === "inView"), (m) => m.classList.add("is-on"), 0.9);
}

/* ── scramble in ────────────────────────────────────────────── */
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+";
function scrambleIn(el: HTMLElement, speed = 34, count = 6) {
  const text = el.dataset.text ?? (el.dataset.text = el.textContent ?? "");
  const done = document.createTextNode("");
  const pending = document.createElement("span");
  pending.className = "scr-pending";
  pending.setAttribute("aria-hidden", "true");
  el.replaceChildren(done, pending);
  let i = 0;
  const t = setInterval(() => {
    done.nodeValue = text.slice(0, i);
    let s = "";
    for (let k = 0; k < Math.min(count, text.length - i); k++) s += text[i + k] === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    pending.textContent = s;
    if (++i > text.length) { clearInterval(t); el.textContent = text; }
  }, speed);
}
const scrIn = document.querySelectorAll<HTMLElement>("[data-scramble-in]");
if (!reduce) {
  // hidden with opacity (not visibility) so links stay in the tab order; keyboard focus reveals
  // one straight away instead of waiting for the scroll-in
  const reveal = (h: HTMLElement) => {
    if (!h.style.opacity) return;
    h.style.opacity = "";
    scrambleIn(h);
  };
  scrIn.forEach((el) => {
    el.setAttribute("aria-label", el.textContent ?? "");
    el.style.minWidth = `${el.getBoundingClientRect().width}px`;
    el.style.opacity = "0";
    el.addEventListener("focus", () => reveal(el), { once: true });
  });
  inView(scrIn, (el) => {
    const h = el as HTMLElement;
    setTimeout(() => reveal(h), Number(h.dataset.scrambleDelay || 0));
  }, 0.4);
}

/* ── scramble wave on hover ─────────────────────────────────── */
const WAVE = "!#%&*+<=>?@[]^_|~\\/{}";
document.querySelectorAll<HTMLElement>("[data-scramble-hover]").forEach((el) => {
  const target = (el.querySelector(".u") as HTMLElement) || el;
  const orig = target.textContent ?? "";
  let timer = 0;
  const restore = () => { clearInterval(timer); target.textContent = orig; };
  el.addEventListener("pointerenter", () => {
    if (reduce) return;
    clearInterval(timer);
    let tick = 0;
    timer = window.setInterval(() => {
      const wave = tick++ * 1.1;
      if (wave > orig.length + 3) return restore();
      target.textContent = [...orig].map((ch, i) => (ch === " " || Math.abs(i - wave) >= 2.2 ? ch : WAVE[(Math.random() * WAVE.length) | 0])).join("");
    }, 40);
  });
  el.addEventListener("pointerleave", restore);
});
