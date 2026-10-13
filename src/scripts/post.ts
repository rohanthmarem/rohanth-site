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
