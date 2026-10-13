// Grid ⇄ list toggle (kept in the URL hash). On fine pointers, hovering a list row shows its
// cover beside the cursor.
type View = "grid" | "list";
const viewSwitch = document.querySelector<HTMLElement>("[data-view-switch]");
const gridView = document.getElementById("writing-grid");
const listView = document.getElementById("writing-list");
const peek = document.querySelector<HTMLElement>("[data-archive-peek]");

if (viewSwitch && gridView && listView && peek) {
  const viewFromHash = (): View | null => (location.hash === "#list" || location.hash === "#archive" ? "list" : location.hash === "#grid" ? "grid" : null);
  let current: View = "grid";

  function showView(view: View, animate: boolean) {
    viewSwitch!.querySelectorAll<HTMLButtonElement>("button[data-view]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.view === view));
    });
    peek!.classList.remove("is-on");
    if (view === current) return;
    current = view;
    const shown = view === "grid" ? gridView! : listView!;
    // the page entrance (with its stagger delay) must not replay when a view is re-shown
    if (animate) {
      gridView!.removeAttribute("data-enter");
      listView!.removeAttribute("data-enter");
    } else if (view === "list") {
      // arriving on #list: the list takes the grid's place in the page entrance
      listView!.setAttribute("data-enter", "");
      listView!.style.setProperty("--stagger", "4");
    }
    gridView!.hidden = view !== "grid";
    listView!.hidden = view !== "list";
    shown.classList.remove("is-switching");
    if (animate) {
      void shown.offsetWidth;
      shown.classList.add("is-switching");
    }
  }

  viewSwitch.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-view]");
    if (!button) return;
    const view = button.dataset.view as View;
    showView(view, true);
    if (location.hash !== `#${view}`) history.replaceState(null, "", `${location.pathname}${location.search}#${view}`);
  });
  const initial = viewFromHash();
  if (initial) showView(initial, false);
  window.addEventListener("hashchange", () => {
    const view = viewFromHash();
    if (view) showView(view, true);
  });

  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    let activeRow: HTMLElement | null = null;
    let lastX = 0;
    let lastY = 0;
    const halfWidth = 150;
    const halfHeight = 94; // 300 × 16:10
    const place = (row: HTMLElement | null) => {
      if (!row) {
        peek!.classList.remove("is-on");
        activeRow = null;
        return;
      }
      if (row !== activeRow) {
        const cover = row.querySelector<HTMLElement>(".archive-thumb");
        if (cover) peek!.replaceChildren(cover.cloneNode(true));
        activeRow = row;
      }
      let x = lastX + 36 + halfWidth;
      if (x + halfWidth > innerWidth - 16) x = lastX - 36 - halfWidth;
      const y = Math.max(16 + halfHeight, Math.min(innerHeight - 16 - halfHeight, lastY));
      peek!.style.left = `${x}px`;
      peek!.style.top = `${y}px`;
      peek!.classList.add("is-on");
    };
    listView.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      lastX = event.clientX;
      lastY = event.clientY;
      place((event.target as Element).closest<HTMLElement>(".archive-row"));
    });
    listView.addEventListener("pointerleave", () => place(null));
    // the rows move under a still cursor while scrolling: re-pick the row from the cursor point
    let frame = 0;
    window.addEventListener("scroll", () => {
      if (!activeRow || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!activeRow) return;
        const hit = document.elementFromPoint(lastX, lastY);
        place(hit && listView.contains(hit) ? hit.closest<HTMLElement>(".archive-row") : null);
      });
    }, { passive: true });
  }
}
