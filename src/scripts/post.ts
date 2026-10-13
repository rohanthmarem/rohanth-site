import "./dither";
const post = document.querySelector<HTMLElement>(".post");

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
  updateProgress();

  const tocLinks = [...document.querySelectorAll<HTMLAnchorElement>(".post-sidebar .toc-list a[data-heading]")];
  const sections = tocLinks.map((link) => document.getElementById(link.dataset.heading ?? "")).filter((heading): heading is HTMLElement => Boolean(heading));
  if (sections.length && "IntersectionObserver" in window) {
    const activate = (id: string) => {
      for (const link of tocLinks) {
        const active = link.dataset.heading === id;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      }
    };
    activate(sections[0].id);
    updateToc = () => {
      const threshold = window.innerHeight * .35;
      const current = [...sections].reverse().find((heading) => heading.getBoundingClientRect().top <= threshold) ?? sections[0];
      activate(current.id);
    };
    const observer = new IntersectionObserver(updateToc, { rootMargin: "-15% 0px -65% 0px" });
    sections.forEach((heading) => observer.observe(heading));
    updateToc();
  }

  for (const heading of post.querySelectorAll<HTMLElement>(".prose h2[id], .prose h3[id]")) {
    const anchor = document.createElement("a");
    anchor.className = "heading-anchor";
    anchor.href = `#${heading.id}`;
    anchor.setAttribute("aria-label", `Copy link to ${heading.textContent?.trim() || "section"}`);
    anchor.innerHTML = '#<span class="toast" aria-hidden="true">link copied</span>';
    heading.append(anchor);
    let toastTimer = 0;
    anchor.addEventListener("click", async (event) => {
      event.preventDefault();
      const url = new URL(anchor.href);
      history.replaceState(null, "", url);
      const toast = anchor.querySelector<HTMLElement>(".toast");
      try {
        await navigator.clipboard.writeText(url.href);
        if (toast) toast.textContent = "link copied";
      } catch {
        if (toast) toast.textContent = "link ready";
      }
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
