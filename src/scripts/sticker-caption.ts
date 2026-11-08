// Fills a sticker caption: "name · link", then the note on its own line. Built from DOM nodes, never
// innerHTML. In the note, ~~text~~ is struck through and an email address becomes a mailto link.
const MARKUP = /~~(.+?)~~|([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;

function noteNodes(note: string): (Node | string)[] {
  const out: (Node | string)[] = [];
  let at = 0;
  for (const m of note.matchAll(MARKUP)) {
    out.push(note.slice(at, m.index));
    if (m[1] !== undefined) {
      const s = document.createElement("s");
      s.textContent = m[1];
      out.push(s);
    } else {
      const a = document.createElement("a");
      a.href = `mailto:${m[2]}`;
      a.textContent = m[2];
      out.push(a);
    }
    at = m.index! + m[0].length;
  }
  out.push(note.slice(at));
  return out;
}

export function fillCaption(caption: HTMLElement, { name = "", note, href }: DOMStringMap) {
  caption.replaceChildren(name);
  if (href) {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = href.startsWith("/") ? "read more" : new URL(href).hostname.replace(/^www\./, "");
    if (!href.startsWith("/")) { a.target = "_blank"; a.rel = "noopener"; }
    caption.append(" · ", a);
  }
  if (note) {
    const span = document.createElement("span");
    span.className = "note";
    span.append(...noteNodes(note));
    caption.append(span);
  }
}
