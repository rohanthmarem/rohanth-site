const el = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
const hand = el<HTMLElement>("#hand");
const cards = [...hand.querySelectorAll<HTMLButtonElement>(".card")];
const tabs = [...document.querySelectorAll<HTMLButtonElement>(".filter")];
const prev = el<HTMLButtonElement>("#prev");
const next = el<HTMLButtonElement>("#next");
const sheet = el<HTMLDialogElement>("#sheet");
const panel = el<HTMLElement>("#panel");
const sheetArt = el<HTMLElement>("#sheet-art");
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

let visible = cards.map((_, index) => index);
let current = 0;
let hovered = -1;
let slots: number[] = []; // resting card centres (x, within the hand), for hover hit-testing
let layoutQueued = 0;
const queueLayout = () => { if (!layoutQueued) layoutQueued = requestAnimationFrame(() => { layoutQueued = 0; layout(); }); };
let openId = -1;
let returningTo: HTMLButtonElement | null = null;
let dealt = false;
let dragStart: { x: number; pointer: number } | null = null;
let dragX = 0;
let suppressClick = false;

function vars(card: HTMLElement, values: Record<string, string | number>) {
  for (const [key, value] of Object.entries(values)) card.style.setProperty(`--${key}`, String(value));
}

function hideOthers(width: number, cardWidth: number) {
  cards.forEach((card, index) => {
    if (visible.includes(index)) return;
    card.classList.add("is-hidden");
    card.setAttribute("aria-hidden", "true");
    card.tabIndex = -1;
    vars(card, { tx: `${(width - cardWidth) / 2}px`, ty: "90px", rot: "0deg", sc: .92, z: 0, op: 0, delay: "0ms" });
  });
}

function layout() {
  const width = hand.clientWidth;
  const cardWidth = cards[0].offsetWidth;
  const n = visible.length;
  const mid = (n - 1) / 2;
  const spread = Math.min(4, 32 / Math.max(1, n));
  // Keep the outer cards' rotated corners (plus the hover nudge) inside the hand.
  const edge = spread * mid * Math.PI / 180;
  const margin = cards[0].offsetHeight * Math.sin(edge) - cardWidth / 2 * (1 - Math.cos(edge)) + (n > 1 ? 14 : 0);
  const span = Math.max(0, Math.min(width - cardWidth - 2 * margin, n * cardWidth * .56));
  const step = n > 1 ? span / (n - 1) : 0;
  const x0 = (width - cardWidth - span) / 2;

  current = Math.max(0, Math.min(n - 1, current));
  slots = visible.map((_, index) => x0 + index * step + cardWidth / 2);
  visible.forEach((id, index) => {
    const card = cards[id];
    card.classList.remove("is-hidden");
    card.removeAttribute("aria-hidden");
    const distance = index - mid;
    let tx = x0 + index * step;
    let ty = Math.pow(Math.abs(distance), 1.7) * 7 + 30;
    let rot = distance * spread;
    let sc = 1;
    let z = index + 1;
    let op = 1;

    if (mobile.matches) {
      const off = index - current;
      const peek = Math.min(16, (width - cardWidth) / 7.2);
      tx = (width - cardWidth) / 2;
      ty = 20;
      rot = 0;
      z = n - Math.abs(off);
      if (off > 0) {
        tx += Math.min(off, 3) * peek;
        ty -= Math.min(off, 3) * 6;
        rot = Math.min(off, 3) * 1.8;
        sc = 1 - Math.min(off, 3) * .05;
        op = off > 3 ? 0 : 1;
      } else if (off < 0) {
        tx -= cardWidth * 1.3;
        rot = -14;
        sc = .96;
        op = 0;
      }
      if (off === 0 && dragX) { tx += dragX; rot = dragX * .05; }
      card.tabIndex = off === 0 ? 0 : -1;
      card.style.pointerEvents = off === 0 ? "" : "none";
    } else {
      card.tabIndex = 0;
      card.style.pointerEvents = "";
      if (hovered >= 0) {
        if (index === hovered) { rot = 0; ty -= 34; sc = 1.04; z = n + 5; }
        else {
          const direction = index < hovered ? -1 : 1;
          tx += direction * Math.max(0, 34 - (Math.abs(index - hovered) - 1) * 12);
          rot += direction * 0.6;
        }
      }
    }
    vars(card, { tx: `${tx}px`, ty: `${ty}px`, rot: `${rot.toFixed(2)}deg`, sc, z, op, delay: dealt ? "0ms" : `${index * 60}ms` });
  });
  hideOthers(width, cardWidth);
  prev.disabled = current === 0;
  next.disabled = current === n - 1;
}

function deal() {
  dealt = false;
  const center = (hand.clientWidth - cards[0].offsetWidth) / 2;
  visible.forEach((id) => vars(cards[id], { tx: `${center}px`, ty: "120px", rot: "0deg", sc: .9, op: 0, delay: "0ms" }));
  requestAnimationFrame(() => requestAnimationFrame(() => { layout(); dealt = true; }));
}

function filterTo(filter: string) {
  tabs.forEach((tab) => tab.setAttribute("aria-pressed", String(tab.dataset.filter === filter)));
  visible = cards.flatMap((card, index) => filter === "all" || card.dataset.category === filter ? [index] : []);
  current = 0;
  hovered = -1;
  deal();
}

function fill(id: number) {
  const card = cards[id];
  const index = visible.indexOf(id);
  sheet.dataset.palette = card.dataset.palette;
  panel.dataset.palette = card.dataset.palette;
  sheetArt.replaceChildren(card.querySelector(".art")!.firstElementChild!.cloneNode(true));
  sheetNum.textContent = card.querySelector(".number")!.textContent;
  sheetKind.textContent = card.querySelector(".kind")!.textContent;
  sheetTitle.textContent = card.querySelector(".title")!.textContent;
  sheetBy.textContent = card.querySelector(".by")?.textContent || "";
  sheetWhy.textContent = card.dataset.why || "";
  sheetPos.textContent = `${index + 1} / ${visible.length}`;
  sheetPrev.disabled = index === 0;
  sheetNext.disabled = index === visible.length - 1;
}

function sourceTransform(id: number) {
  const source = cards[id].getBoundingClientRect();
  const target = sheet.getBoundingClientRect();
  return `translate(${source.left - target.left}px, ${source.top - target.top}px) scale(${source.width / target.width}, ${source.height / target.height})`;
}

function openSheet(id: number) {
  if (openId >= 0) return;
  openId = id;
  returningTo = cards[id];
  fill(id);
  sheet.classList.remove("is-closing");
  if (!sheet.open) sheet.showModal();
  if (!reduceMotion.matches) {
    sheet.style.transition = "none";
    sheet.style.transform = sourceTransform(id);
    sheet.getBoundingClientRect();
    sheet.style.transition = "";
  }
  cards[id].classList.add("is-source");
  requestAnimationFrame(() => {
    sheet.classList.add("is-open");
    sheet.style.transform = "";
  });
  closeButton.focus({ preventScroll: true });
}

function closeSheet() {
  if (openId < 0) return;
  const id = openId;
  openId = -1;
  sheet.classList.remove("is-open");
  sheet.classList.add("is-closing");
  // the real card is back in place underneath; the sheet lands on it and fades off
  cards[id].classList.remove("is-source");
  const finish = () => {
    sheet.close();
    sheet.style.transform = "";
    sheet.classList.remove("is-closing");
    returningTo?.focus({ preventScroll: true });
  };
  if (reduceMotion.matches) { finish(); return; }
  sheet.style.transform = sourceTransform(id);
  const onEnd = (event: TransitionEvent) => {
    if (event.target !== sheet || event.propertyName !== "transform") return;
    sheet.removeEventListener("transitionend", onEnd);
    clearTimeout(fallback);
    finish();
  };
  const fallback = setTimeout(() => {
    sheet.removeEventListener("transitionend", onEnd);
    finish();
  }, 520);
  sheet.addEventListener("transitionend", onEnd);
}

function stepSheet(direction: number) {
  const index = visible.indexOf(openId) + direction;
  if (index < 0 || index >= visible.length) return;
  cards[openId].classList.remove("is-source");
  openId = visible[index];
  returningTo = cards[openId];
  cards[openId].classList.add("is-source");
  if (mobile.matches) { current = index; layout(); }
  fill(openId);
}

cards.forEach((card, id) => {
  card.addEventListener("focus", () => { if (!mobile.matches) { hovered = visible.indexOf(id); layout(); } });
  card.addEventListener("blur", () => { if (!mobile.matches && hovered === visible.indexOf(id)) { hovered = -1; layout(); } });
  card.addEventListener("click", () => { if (!suppressClick) openSheet(id); });
  card.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const index = Math.max(0, Math.min(visible.length - 1, visible.indexOf(id) + (event.key === "ArrowRight" ? 1 : -1)));
    if (mobile.matches) { current = index; layout(); }
    cards[visible[index]].focus();
  });
});

tabs.forEach((tab) => tab.addEventListener("click", () => filterTo(tab.dataset.filter!)));
prev.addEventListener("click", () => { current--; layout(); });
next.addEventListener("click", () => { current++; layout(); });

hand.addEventListener("pointerdown", (event) => {
  const card = (event.target as Element).closest<HTMLButtonElement>(".card");
  if (!mobile.matches || !card || Number(card.dataset.index) !== visible[current]) return;
  dragStart = { x: event.clientX, pointer: event.pointerId };
  card.style.transitionDuration = "0ms";
  card.setPointerCapture(event.pointerId);
});
hand.addEventListener("pointermove", (event) => {
  if (!dragStart || dragStart.pointer !== event.pointerId) return;
  dragX = event.clientX - dragStart.x;
  if (Math.abs(dragX) > 6) suppressClick = true;
  layout();
});
function endDrag() {
  if (!dragStart) return;
  cards[visible[current]].style.transitionDuration = "";
  if (dragX < -60 && current < visible.length - 1) current++;
  if (dragX > 60 && current > 0) current--;
  dragX = 0;
  dragStart = null;
  layout();
  setTimeout(() => { suppressClick = false; }, 0);
}
hand.addEventListener("pointerup", endDrag);
hand.addEventListener("pointercancel", endDrag);

closeButton.addEventListener("click", closeSheet);
sheetPrev.addEventListener("click", () => stepSheet(-1));
sheetNext.addEventListener("click", () => stepSheet(1));
sheet.addEventListener("click", (event) => {
  if (event.target !== sheet) return;
  const rect = sheet.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeSheet();
});
sheet.addEventListener("cancel", (event) => { event.preventDefault(); closeSheet(); });
sheet.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    stepSheet(event.key === "ArrowRight" ? 1 : -1);
  }
});

addEventListener("resize", () => { hovered = -1; layout(); });

// Hover is decided by where the pointer is over the hand's resting slots, not by which
// (moving, rotating) card is under it — otherwise a lifting card slides out from under the
// cursor and the hand flickers. A little hysteresis keeps it from chattering between neighbours.
hand.addEventListener("pointermove", (event) => {
  if (mobile.matches || event.pointerType === "touch" || dragStart || !slots.length) return;
  const x = event.clientX - hand.getBoundingClientRect().left;
  let best = 0;
  for (let i = 1; i < slots.length; i++) if (Math.abs(slots[i] - x) < Math.abs(slots[best] - x)) best = i;
  if (best !== hovered && hovered >= 0 && hovered < slots.length) {
    const edge = (slots[hovered] + slots[best]) / 2;
    if (Math.abs(x - edge) < 8) return;
  }
  if (best !== hovered) { hovered = best; queueLayout(); }
});
hand.addEventListener("pointerleave", () => { if (!mobile.matches && hovered >= 0) { hovered = -1; queueLayout(); } });
document.fonts.ready.then(deal);
