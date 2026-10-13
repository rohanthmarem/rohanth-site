import "./dither";
const post = document.querySelector<HTMLElement>(".post");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

if (post) {
  const bar = post.querySelector<HTMLElement>(".progress i");
  const article = post.querySelector<HTMLElement>(".post-content");
  let frame = 0;
  let updateToc = () => {};
  const updateProgress = () => {
    frame = 0;
    if (!bar || !article) return;
    const end = article.getBoundingClientRect().bottom + window.scrollY;
    const distance = Math.max(1, end - window.innerHeight);
    bar.style.transform = `scaleX(${Math.min(1, Math.max(0, window.scrollY / distance))})`;
    updateToc();
  };
  const queueProgress = () => {
    if (!frame) frame = requestAnimationFrame(updateProgress);
  };
  window.addEventListener("scroll", queueProgress, { passive: true });
  window.addEventListener("resize", queueProgress, { passive: true });
  // late layout changes (lazy images, fonts) move the article's end without a scroll
  if (article && "ResizeObserver" in window) new ResizeObserver(queueProgress).observe(article);

  // Contents: the active section is the last heading above 35% of the viewport (the last one once
  // the page bottoms out). A single marker slides between entries instead of hopping.
  const tocList = document.querySelector<HTMLElement>(".post-sidebar .toc-list");
  const tocLinks = [...document.querySelectorAll<HTMLAnchorElement>(".post-sidebar .toc-list a[data-heading]")];
  const sections = tocLinks.map((link) => document.getElementById(link.dataset.heading ?? "")).filter((heading): heading is HTMLElement => Boolean(heading));
  if (tocList && sections.length) {
    const marker = document.createElement("i");
    marker.className = "toc-marker";
    marker.setAttribute("aria-hidden", "true");
    tocList.append(marker);
    let activeId = "";
    let lockUntil = 0;
    const placeMarker = () => {
      const link = tocLinks.find((l) => l.dataset.heading === activeId);
      if (!link) return;
      marker.style.transform = `translateY(${link.offsetTop}px)`;
      marker.style.height = `${link.offsetHeight}px`;
    };
    const activate = (id: string) => {
      if (id === activeId) return;
      activeId = id;
      for (const link of tocLinks) {
        const active = link.dataset.heading === id;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      }
      placeMarker();
    };
    updateToc = () => {
      if (performance.now() < lockUntil) return;
      const threshold = window.innerHeight * 0.35;
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      const current = atBottom
        ? sections[sections.length - 1]
        : [...sections].reverse().find((heading) => heading.getBoundingClientRect().top <= threshold) ?? sections[0];
      activate(current.id);
    };
    updateToc();
    placeMarker();
    // first placement without a slide; later moves animate
    requestAnimationFrame(() => tocList.classList.add("has-marker"));
    if ("ResizeObserver" in window) new ResizeObserver(placeMarker).observe(tocList);

    // Clicking an entry glides to the heading and holds the marker on it while the page moves.
    tocList.addEventListener("click", (event) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>("a[data-heading]");
      const heading = link && document.getElementById(link.dataset.heading ?? "");
      if (!link || !heading || event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      history.pushState(null, "", `#${heading.id}`);
      activate(heading.id);
      const smooth = !reduceMotion.matches;
      lockUntil = smooth ? performance.now() + 1200 : 0;
      heading.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      if (smooth) window.addEventListener("scrollend", () => { lockUntil = 0; queueProgress(); }, { once: true });
      // move focus to the section without a second jump, so Tab continues from there
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    });
  }

  for (const heading of post.querySelectorAll<HTMLElement>(".prose h2[id], .prose h3[id]")) {
    const anchor = document.createElement("a");
    anchor.className = "heading-anchor";
    anchor.href = `#${heading.id}`;
    anchor.setAttribute("aria-label", `Copy link to ${heading.textContent?.trim() || "section"}`);
    anchor.innerHTML = '<span aria-hidden="true">#</span><span class="toast" role="status"></span>';
    heading.append(anchor);
    let toastTimer = 0;
    anchor.addEventListener("click", async (event) => {
      event.preventDefault();
      const url = new URL(anchor.href);
      history.replaceState(null, "", url);
      const toast = anchor.querySelector<HTMLElement>(".toast");
      let text = "link copied";
      try {
        await navigator.clipboard.writeText(url.href);
      } catch {
        text = "link ready";
      }
      if (toast) toast.textContent = text;
      toast?.classList.add("is-on");
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toast?.classList.remove("is-on"), 1800);
    });
  }

  // remote photos have no known shape until they load; the CSS keeps tall ones within the window
  for (const img of post.querySelectorAll<HTMLImageElement>("figure.fig-pending img")) {
    const figure = img.closest<HTMLElement>("figure")!;
    const setRatio = () => {
      if (img.naturalWidth && img.naturalHeight) figure.style.setProperty("--ar", (img.naturalWidth / img.naturalHeight).toFixed(4));
    };
    if (img.complete) setRatio();
    else img.addEventListener("load", setRatio, { once: true });
  }

  // Margin notes start level with their paragraph and run on down the margin; if one would run
  // into the next, the later one moves down (wide screens only: below 1024px they sit inline).
  const slots = [...post.querySelectorAll<HTMLElement>(".prose .note-slot")];
  if (slots.length > 1 && "ResizeObserver" in window) {
    const wide = matchMedia("(min-width: 1024px)");
    let stackFrame = 0;
    const stack = () => {
      stackFrame = 0;
      let floor = -Infinity;
      for (const slot of slots) {
        slot.style.transform = "";
        if (!wide.matches) continue;
        const top = slot.getBoundingClientRect().top + window.scrollY;
        const shift = Math.max(0, floor + 24 - top);
        if (shift) slot.style.transform = `translateY(${shift}px)`;
        const last = slot.lastElementChild as HTMLElement | null;
        floor = top + shift + (last ? last.offsetTop + last.offsetHeight : 0);
      }
    };
    new ResizeObserver(() => { if (!stackFrame) stackFrame = requestAnimationFrame(stack); }).observe(post.querySelector(".prose")!);
  }

  const figures = [...post.querySelectorAll<HTMLElement>("figure.fig")];
  if (figures.length) {
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) entry.target.classList.toggle("is-in", entry.isIntersecting);
      }, { rootMargin: "0px 0px -45% 0px" });
      figures.forEach((figure) => observer.observe(figure));
    } else {
      figures.forEach((figure) => figure.classList.add("is-in"));
    }
  }
}
