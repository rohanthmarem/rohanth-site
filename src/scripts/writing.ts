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
    const width = 300;
    const height = 188; // 300 × 16:10
    const gap = 12;
    const edge = 16;
    // The preview follows the cursor sideways but sits above the hovered row (below it when the
    // row is near the top of the window), so it never covers the title being pointed at.
    const place = (row: HTMLElement | null) => {
      if (!row) {
        peek!.classList.remove("is-on");
        activeRow = null;
        return;
      }
      const fresh = !peek!.classList.contains("is-on");
      if (row !== activeRow) {
        const cover = row.querySelector<HTMLElement>(".archive-thumb");
        if (cover) peek!.replaceChildren(cover.cloneNode(true));
        activeRow = row;
      }
      let left = lastX + 28;
      if (left + width > innerWidth - edge) left = lastX - 28 - width;
      left = Math.max(edge, left);
      const box = row.getBoundingClientRect();
      let top = box.top - gap - height;
      if (top < edge) top = Math.min(innerHeight - edge - height, box.bottom + gap);
      // appearing: jump straight to the spot (only later moves glide)
      peek!.classList.toggle("is-placing", fresh);
      peek!.style.left = `${left + width / 2}px`;
      peek!.style.top = `${top + height / 2}px`;
      if (fresh) void peek!.offsetWidth;
      peek!.classList.remove("is-placing");
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
