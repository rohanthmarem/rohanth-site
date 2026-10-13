// The inspiration hand: a fan of cards on wide screens, a swipeable stack on phones, and a
// reading sheet the picked card flies up into. Everything that moves is transform/opacity on
// CSS transitions (interruptible); geometry is measured once per resize, never mid-frame.

const el = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
const hand = el<HTMLElement>("#hand");
const cards = [...hand.querySelectorAll<HTMLButtonElement>(".card")];
const tabs = [...document.querySelectorAll<HTMLButtonElement>(".filter")];
const prev = el<HTMLButtonElement>("#prev");
const next = el<HTMLButtonElement>("#next");
const sheet = el<HTMLDialogElement>("#sheet");
const flyer = el<HTMLElement>("#flyer");
const face = el<HTMLElement>("#face");
const read = el<HTMLElement>("#sheet-read");
const sheetNum = el<HTMLElement>("#sheet-num");
const sheetKind = el<HTMLElement>("#sheet-kind");
const sheetTitle = el<HTMLElement>("#sheet-title");
const sheetBy = el<HTMLElement>("#sheet-by");
const sheetWhy = el<HTMLElement>("#sheet-why");
const sheetPos = el<HTMLElement>("#sheet-pos");
const sheetPrev = el<HTMLButtonElement>("#sheet-prev");
const sheetNext = el<HTMLButtonElement>("#sheet-next");
const closeButton = el<HTMLButtonElement>("#close");
const mobile = matchMedia("(max-width: 720px)");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

type Pose = { tx: number; ty: number; rot: number; sc: number };

let visible = cards.map((_, index) => index);
let current = 0; // front card of the phone stack
let hovered = -1; // lifted card (index into `visible`) in the fan
let pointerInHand = false;
let poses: Pose[] = cards.map(() => ({ tx: 0, ty: 0, rot: 0, sc: 1 }));
let geo = { width: 0, cardW: 0, cardH: 0, left: 0 };
let slots: number[] = []; // resting card centres (x, within the hand), for hover hit-testing
let frame = 0;
let staggerNext = false;
let drag: { x: number; dx: number; pointer: number; samples: [number, number][]; card: HTMLElement } | null = null; // phone swipe
let suppressClickUntil = 0;

// ── layout ──────────────────────────────────────────────────

function measure() {
  geo = { width: hand.clientWidth, cardW: cards[0].offsetWidth, cardH: cards[0].offsetHeight, left: hand.getBoundingClientRect().left };
}

function place(card: HTMLElement, pose: Pose, opacity: number, z: number, delay: number) {
  card.style.transform = `translate3d(${pose.tx.toFixed(2)}px, ${pose.ty.toFixed(2)}px, 0) rotate(${pose.rot.toFixed(2)}deg) scale(${pose.sc})`;
  card.style.opacity = String(opacity);
  card.style.zIndex = String(z);
  card.style.transitionDelay = delay ? `${delay}ms` : "";
}

// where cards wait when they're not dealt: below the fan, or tucked behind the front card on phones
const pile = (): Pose => ({ tx: (geo.width - geo.cardW) / 2, ty: mobile.matches ? 20 : 90, rot: 0, sc: 0.92 });

function layout(stagger = false) {
  const { width, cardW, cardH } = geo;
  const n = visible.length;
  const mid = (n - 1) / 2;
  const spread = Math.min(4, 32 / Math.max(1, n));
  // keep the outer cards' rotated corners (plus the hover nudge) inside the hand
  const edge = (spread * mid * Math.PI) / 180;
  const margin = cardH * Math.sin(edge) - (cardW / 2) * (1 - Math.cos(edge)) + (n > 1 ? 14 : 0);
  const span = n > 1 ? Math.max(0, Math.min(width - cardW - 2 * margin, n * cardW * 0.56)) : 0;
  const step = n > 1 ? span / (n - 1) : 0;
  const x0 = (width - cardW - span) / 2;
  const phone = mobile.matches;

  current = Math.max(0, Math.min(n - 1, current));
  slots = visible.map((_, index) => x0 + index * step + cardW / 2);
  // the soft shadow pool under the hand follows the width of the fan
  hand.style.setProperty("--pool", phone ? "0.8" : Math.min(1, (span + cardW * 1.2) / (width * 0.8)).toFixed(3));

  visible.forEach((id, index) => {
    const card = cards[id];
    const distance = index - mid;
    const pose: Pose = { tx: x0 + index * step, ty: Math.pow(Math.abs(distance), 1.7) * 7 + 30, rot: distance * spread, sc: 1 };
    let z = index + 1;
    let opacity = 1;

    if (phone) {
      const off = index - current;
      const peek = Math.min(16, (width - cardW) / 7.2);
      const depth = Math.min(Math.abs(off), 3);
      pose.tx = (width - cardW) / 2;
      pose.ty = 20;
      pose.rot = 0;
      z = n - Math.abs(off);
      if (off > 0) {
        pose.tx += depth * peek;
        pose.ty -= depth * 6;
        pose.rot = depth * 1.8;
        pose.sc = 1 - depth * 0.05;
        opacity = off > 3 ? 0 : 1;
      } else if (off < 0) {
        pose.tx -= cardW * 1.3;
        pose.rot = -14;
        pose.sc = 0.96;
        opacity = 0;
      } else if (drag) {
        pose.tx += drag.dx;
        pose.rot = drag.dx * 0.05;
      }
      card.tabIndex = off === 0 ? 0 : -1;
      card.classList.toggle("is-back", off !== 0);
    } else {
      card.tabIndex = 0;
      card.classList.remove("is-back");
      if (hovered >= 0) {
        if (index === hovered) { pose.rot = 0; pose.ty -= 34; pose.sc = 1.04; z = n + 5; }
        else {
          const direction = index < hovered ? -1 : 1;
          pose.tx += direction * Math.max(0, 34 - (Math.abs(index - hovered) - 1) * 12);
          pose.rot += direction * 0.6;
        }
      }
    }
    card.classList.remove("is-hidden");
    card.removeAttribute("aria-hidden");
    poses[id] = pose;
    // phones: the front card lands first and the rest slide out from behind it (no see-through)
    const delay = !stagger ? 0 : phone ? (index === current ? 0 : 260 + Math.abs(index - current) * 50) : index * 45;
    place(card, pose, opacity, z, delay);
  });

  cards.forEach((card, id) => {
    if (visible.includes(id)) return;
    card.classList.add("is-hidden");
    card.setAttribute("aria-hidden", "true");
    card.tabIndex = -1;
    poses[id] = pile();
    place(card, poses[id], 0, 0, 0);
  });
  prev.disabled = current === 0;
  next.disabled = current >= n - 1;
}

// batch everything that wants a re-layout into the next frame
function queueLayout(stagger = false) {
  staggerNext ||= stagger;
  if (!frame) frame = requestAnimationFrame(() => { frame = 0; const s = staggerNext; staggerNext = false; layout(s); });
}

function filterTo(filter: string) {
  tabs.forEach((tab) => tab.setAttribute("aria-pressed", String(tab.dataset.filter === filter)));
  visible = cards.flatMap((card, index) => (filter === "all" || card.dataset.category === filter ? [index] : []));
  current = 0;
  hovered = -1;
  queueLayout(true);
}

// first deal: every card starts face-down in a pile, then fans out
function deal() {
  measure();
  hand.classList.add("no-anim");
  cards.forEach((card, id) => {
    poses[id] = { tx: (geo.width - geo.cardW) / 2, ty: mobile.matches && id !== visible[current] ? 20 : 120, rot: 0, sc: 0.9 };
    place(card, poses[id], 0, 1, 0);
  });
  void hand.offsetWidth;
  hand.classList.remove("no-anim");
  hand.classList.add("is-ready");
  layout(!reduceMotion.matches);
}

// ── fan: hover, focus, keyboard ─────────────────────────────

// Hover is decided by where the pointer is over the hand's resting slots, not by which
// (moving, rotating) card is under it — otherwise a lifting card slides out from under the
// cursor and the hand flickers. A little hysteresis keeps it from chattering between neighbours.
hand.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch" || mobile.matches || sheet.open || !slots.length) return;
  pointerInHand = true;
  const x = event.clientX - geo.left;
  let best = 0;
  for (let i = 1; i < slots.length; i++) if (Math.abs(slots[i] - x) < Math.abs(slots[best] - x)) best = i;
  if (best !== hovered && hovered >= 0 && hovered < slots.length && Math.abs(x - (slots[hovered] + slots[best]) / 2) < 8) return;
  if (best !== hovered) { hovered = best; queueLayout(); }
}, { passive: true });
hand.addEventListener("pointerleave", () => {
  pointerInHand = false;
  if (mobile.matches || sheet.open || hovered < 0) return;
  const focused = cards.indexOf(document.activeElement as HTMLButtonElement);
  hovered = focused >= 0 && cards[focused].matches(":focus-visible") ? visible.indexOf(focused) : -1;
  queueLayout();
}, { passive: true });

cards.forEach((card, id) => {
  // keyboard focus lifts the card like hover; a mouse press must not re-target the lift
  card.addEventListener("focus", () => {
    if (mobile.matches || sheet.open || !card.matches(":focus-visible")) return;
    hovered = visible.indexOf(id);
    queueLayout();
  });
  card.addEventListener("blur", () => {
    if (mobile.matches || sheet.open || pointerInHand || hovered !== visible.indexOf(id)) return;
    hovered = -1;
    queueLayout();
  });
  card.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const index = Math.max(0, Math.min(visible.length - 1, visible.indexOf(id) + (event.key === "ArrowRight" ? 1 : -1)));
    if (mobile.matches) { current = index; queueLayout(); }
    cards[visible[index]].focus();
  });
});

// whatever is lifted is what opens, even if the press lands on a neighbour's overlapping edge
hand.addEventListener("click", (event) => {
  const card = (event.target as Element).closest<HTMLButtonElement>(".card");
  if (!card || card.classList.contains("is-hidden") || performance.now() < suppressClickUntil) return;
  const keyboard = event.detail === 0;
  if (!mobile.matches && !keyboard && hovered >= 0 && hovered < visible.length) openSheet(visible[hovered], false);
  else openSheet(cards.indexOf(card), keyboard);
});

tabs.forEach((tab) => tab.addEventListener("click", () => filterTo(tab.dataset.filter!)));
prev.addEventListener("click", () => { current--; queueLayout(); });
next.addEventListener("click", () => { current++; queueLayout(); });

// ── phone stack: swipe ──────────────────────────────────────


hand.addEventListener("pointerdown", (event) => {
  const card = (event.target as Element).closest<HTMLButtonElement>(".card");
  if (!mobile.matches || !card || cards.indexOf(card) !== visible[current] || (event.pointerType === "mouse" && event.button !== 0)) return;
  drag = { x: event.clientX, dx: 0, pointer: event.pointerId, samples: [[event.timeStamp, event.clientX]], card };
  card.classList.add("is-dragging");
  card.setPointerCapture(event.pointerId);
});
hand.addEventListener("pointermove", (event) => {
  if (!drag || drag.pointer !== event.pointerId) return;
  let dx = event.clientX - drag.x;
  // resist past the ends of the stack
  if ((dx > 0 && current === 0) || (dx < 0 && current === visible.length - 1)) dx = Math.sign(dx) * Math.pow(Math.abs(dx), 0.8) * 0.45;
  drag.dx = dx;
  drag.samples.push([event.timeStamp, event.clientX]);
  if (drag.samples.length > 6) drag.samples.shift();
  queueLayout();
}, { passive: true });
function endDrag(event: PointerEvent) {
  if (!drag || drag.pointer !== event.pointerId) return;
  const { dx, samples, card } = drag;
  const [t0, x0] = samples[0];
  const velocity = event.timeStamp > t0 ? (event.clientX - x0) / (event.timeStamp - t0) : 0; // px/ms
  const flick = Math.abs(velocity) > 0.3 && Math.abs(dx) > 12 && Math.sign(velocity) === Math.sign(dx);
  if (event.type === "pointerup" && (Math.abs(dx) > geo.cardW * 0.28 || flick)) {
    if (dx < 0 && current < visible.length - 1) current++;
    if (dx > 0 && current > 0) current--;
  }
  if (Math.abs(dx) > 6) suppressClickUntil = performance.now() + 400;
  card.classList.remove("is-dragging");
  drag = null;
  queueLayout();
}
hand.addEventListener("pointerup", endDrag);
hand.addEventListener("pointercancel", endDrag);

// ── reading sheet ───────────────────────────────────────────
// The card face itself flies: it is scaled uniformly from the card's size up to the sheet's
// panel (the panel keeps the card's proportions), so at every frame it is one card. The reading
// side slides in beside it (below it on phones) and the card's own text hands over to the
// sheet's larger type with a short fade, never overlapping.

let openId = -1;
let state: "closed" | "open" | "closing" = "closed";
let generation = 0;
let swapTimer = 0;

function fillFace(id: number) {
  const card = cards[id];
  flyer.dataset.palette = card.dataset.palette;
  face.replaceChildren(...[...card.children].map((child) => {
    const copy = child.cloneNode(true) as HTMLElement;
    if (!copy.classList.contains("art")) copy.classList.add("fx");
    return copy;
  }));
}

function fillText(id: number) {
  const card = cards[id];
  const index = visible.indexOf(id);
  sheet.dataset.palette = card.dataset.palette;
  sheetNum.textContent = card.querySelector(".number")!.textContent;
  sheetKind.textContent = card.querySelector(".kind")!.textContent;
  sheetTitle.textContent = card.querySelector(".title")!.textContent;
  sheetBy.textContent = card.querySelector(".by")?.textContent || "";
  sheetWhy.textContent = card.dataset.why || "";
  sheetPos.textContent = `${index + 1} / ${visible.length}`;
  sheetPrev.disabled = index === 0;
  sheetNext.disabled = index === visible.length - 1;
}

// size the panel to the card's proportions and remember the scale that fills it
function fitSheet() {
  sheet.style.height = "";
  const w = sheet.clientWidth;
  let h = sheet.clientHeight;
  const { cardW, cardH } = geo;
  let k: number, panelW: number, panelH: number;
  if (mobile.matches) {
    k = w / cardW;
    panelW = w;
    panelH = Math.round(Math.min(h * 0.5, Math.max(h * 0.44, cardH * k * 0.6)));
  } else {
    // the panel is the card at full sheet height, unless that would crowd the reading side;
    // then the card is narrower and the sheet gets shorter to match it
    k = Math.min(h / cardH, (w * 0.45) / cardW);
    panelW = Math.round(cardW * k);
    if (cardH * k < h - 1) { h = Math.round(cardH * k); sheet.style.height = `${h}px`; }
    k = h / cardH;
    panelH = h;
  }
  sheet.style.setProperty("--k", String(k));
  sheet.style.setProperty("--panel-w", `${panelW}px`);
  sheet.style.setProperty("--panel-h", `${panelH}px`);
  flyer.style.width = `${cardW}px`;
  flyer.style.height = `${cardH}px`;
  return k;
}

// A transform that puts the (unscaled) flyer exactly over the card: where it is right now
// (`live`, its computed transform, for take-off) or where it's headed in the hand (for landing).
function onCard(id: number, live?: DOMMatrixReadOnly) {
  let m: { a: number; b: number; c: number; d: number; e: number; f: number };
  if (live) m = live;
  else {
    const { tx, ty, rot, sc } = poses[id];
    const r = (rot * Math.PI) / 180;
    m = { a: Math.cos(r) * sc, b: Math.sin(r) * sc, c: -Math.sin(r) * sc, d: Math.cos(r) * sc, e: tx, f: ty };
  }
  const handRect = hand.getBoundingClientRect();
  const sheetRect = sheet.getBoundingClientRect();
  const { cardW: w, cardH: h } = geo;
  // the card turns about its bottom centre (its centre on phones); the flyer about its top left
  const pivot = mobile.matches ? h / 2 : h;
  const ox = handRect.left + w / 2 + m.e - sheetRect.left;
  const oy = handRect.top + pivot + m.f - sheetRect.top;
  const x = ox + m.a * (-w / 2) + m.c * -pivot;
  const y = oy + m.b * (-w / 2) + m.d * -pivot;
  return `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, ${x}, ${y})`;
}

const atRest = (k: number) => `matrix(${k}, 0, 0, ${k}, 0, 0)`;

function settle(then: () => void) {
  const mine = ++generation;
  const running = flyer.getAnimations();
  if (!running.length || reduceMotion.matches) { then(); return; }
  // a cancelled transition (e.g. the dialog was closed under it) counts as finished too
  Promise.allSettled(running.map((animation) => animation.finished)).then(() => { if (mine === generation) then(); });
}

function liftInHand(id: number) {
  // keep the open card lifted in the fan (or in front on phones) so closing lands on it
  if (mobile.matches) current = visible.indexOf(id);
  else hovered = visible.indexOf(id);
  layout();
}

function openSheet(id: number, keyboard: boolean) {
  if (state === "open") return;
  if (state === "closing") {
    if (id === openId && sheet.open) { // changed your mind mid-close: fly back up from wherever it is
      state = "open";
      generation++;
      sheet.classList.add("is-open");
      flyer.style.transform = atRest(fitSheet());
      return;
    }
    finishClose();
  }
  // where the card is right now, before anything moves it
  const live = new DOMMatrixReadOnly(getComputedStyle(cards[id]).transform);
  openId = id;
  state = "open";
  generation++;
  pointerInHand = false;
  lastViewport = `${innerWidth}x${innerHeight}`;
  endStep();
  liftInHand(id);
  cards[id].classList.add("is-source");
  fillFace(id);
  fillText(id);
  sheet.showModal();
  const k = fitSheet();
  flyer.style.transition = "none";
  flyer.style.transform = reduceMotion.matches ? atRest(k) : onCard(id, live);
  void flyer.offsetWidth;
  flyer.style.transition = "";
  sheet.classList.add("is-open");
  flyer.style.transform = atRest(k);
  (keyboard ? closeButton : read).focus({ preventScroll: true });
}

function finishClose() {
  generation++;
  state = "closed";
  sheet.close();
  sheet.classList.remove("is-open");
  flyer.style.transform = "";
  if (openId < 0) return;
  const card = cards[openId];
  card.classList.remove("is-source");
  card.focus({ preventScroll: true });
  // landed on the lifted card; unless it's keyboard-focused, let it settle back into the fan
  // (if the pointer is still over the hand, the next move lifts the right slot again)
  if (!mobile.matches && !card.matches(":focus-visible")) { hovered = -1; queueLayout(); }
  openId = -1;
}

function closeSheet() {
  if (state !== "open") return;
  state = "closing";
  endStep();
  sheet.classList.remove("is-open");
  if (reduceMotion.matches) { finishClose(); return; }
  flyer.style.transform = onCard(openId);
  settle(finishClose);
}

function endStep() {
  clearTimeout(swapTimer);
  clearTimeout(stepTimer);
  sheet.classList.remove("is-swapping", "is-stepping");
  flyer.querySelectorAll(".ghost").forEach((ghost) => ghost.remove());
}

let stepTimer = 0;
function stepSheet(direction: number) {
  if (state !== "open") return;
  const index = visible.indexOf(openId) + direction;
  if (index < 0 || index >= visible.length) return;
  cards[openId].classList.remove("is-source");
  openId = visible[index];
  cards[openId].classList.add("is-source");
  liftInHand(openId);
  // the old face dissolves off the new one...
  const ghost = face.cloneNode(true) as HTMLElement;
  ghost.removeAttribute("id");
  ghost.classList.add("ghost");
  ghost.dataset.palette = flyer.dataset.palette;
  flyer.append(ghost);
  fillFace(openId);
  void ghost.offsetWidth;
  ghost.classList.add("is-gone");
  setTimeout(() => ghost.remove(), 400);
  // ...while the words dip out, change, and come back
  const target = openId;
  sheet.classList.add("is-stepping", "is-swapping");
  clearTimeout(swapTimer);
  clearTimeout(stepTimer);
  swapTimer = window.setTimeout(() => {
    fillText(target);
    sheet.classList.remove("is-swapping");
    stepTimer = window.setTimeout(() => sheet.classList.remove("is-stepping"), 300);
  }, 130);
}

closeButton.addEventListener("click", closeSheet);
sheetPrev.addEventListener("click", () => stepSheet(-1));
sheetNext.addEventListener("click", () => stepSheet(1));
sheet.addEventListener("click", (event) => {
  if (event.target !== sheet) return;
  const rect = sheet.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeSheet();
});
sheet.addEventListener("cancel", (event) => { event.preventDefault(); closeSheet(); });
// the browser can close the dialog itself (e.g. a second Escape / back gesture that isn't cancelable)
sheet.addEventListener("close", () => { if (state !== "closed") finishClose(); });
sheet.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  stepSheet(event.key === "ArrowRight" ? 1 : -1);
});

// ── resize ──────────────────────────────────────────────────

let resizeFrame = 0;
let lastViewport = "";
function onResize() {
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    if (!hand.classList.contains("is-ready")) return;
    const before = geo.width;
    measure();
    // ignore notifications that change nothing while the sheet is up (they'd cancel its flight)
    const viewport = `${innerWidth}x${innerHeight}`;
    if (state !== "closed" && geo.width === before && viewport === lastViewport) return;
    lastViewport = viewport;
    if (state === "closing") finishClose();
    if (state === "closed") { if (geo.width !== before) hovered = -1; layout(); return; }
    // keep the open card's slot lifted and refit the sheet without animating the change
    liftInHand(openId);
    sheet.classList.add("is-instant");
    flyer.style.transform = atRest(fitSheet());
    void flyer.offsetWidth;
    sheet.classList.remove("is-instant");
  });
}
new ResizeObserver(onResize).observe(hand);
addEventListener("resize", onResize, { passive: true });
mobile.addEventListener("change", () => { hovered = -1; drag?.card.classList.remove("is-dragging"); drag = null; });

// deal once the type has settled, just after the title and filters have come in
document.fonts.ready.then(() => setTimeout(deal, reduceMotion.matches ? 0 : Math.max(0, 450 - performance.now())));
