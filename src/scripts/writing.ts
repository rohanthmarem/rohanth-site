// Grid ⇄ list toggle. On fine pointers, hovering a list row shows its cover beside the cursor.
const viewSwitch = document.querySelector<HTMLElement>("[data-view-switch]");
const gridView = document.getElementById("writing-grid");
const listView = document.getElementById("writing-list");
const peek = document.querySelector<HTMLElement>("[data-archive-peek]");

if (viewSwitch && gridView && listView && peek) {
  function showView(view: "grid" | "list") {
    viewSwitch!.querySelectorAll<HTMLButtonElement>("button[data-view]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.view === view));
    });
    gridView!.hidden = view !== "grid";
    listView!.hidden = view !== "list";
    peek!.classList.remove("is-on");
    if (location.hash !== `#${view}`) history.replaceState(null, "", `${location.pathname}${location.search}#${view}`);
  }

  viewSwitch.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-view]");
    if (button) showView(button.dataset.view as "grid" | "list");
  });
  if (location.hash === "#list" || location.hash === "#archive") showView("list");

  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    let activeRow: HTMLElement | null = null;
    listView.addEventListener("pointermove", (event) => {
      const row = (event.target as Element).closest<HTMLElement>(".archive-row");
      if (!row) { peek!.classList.remove("is-on"); activeRow = null; return; }
      if (row !== activeRow) {
        const cover = row.querySelector<HTMLElement>(".archive-thumb");
        if (cover) peek!.replaceChildren(cover.cloneNode(true));
        activeRow = row;
      }
      const halfWidth = 150;
      let x = event.clientX + 36 + halfWidth;
      if (x + halfWidth > innerWidth - 16) x = event.clientX - 36 - halfWidth;
      peek!.style.left = `${x}px`;
      peek!.style.top = `${Math.max(110, Math.min(innerHeight - 110, event.clientY))}px`;
      peek!.classList.add("is-on");
    });
    listView.addEventListener("pointerleave", () => { peek!.classList.remove("is-on"); activeRow = null; });
  }
}
