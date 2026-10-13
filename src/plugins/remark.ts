// Markdown authoring helpers, shared by .md and .mdx (MDX extends the markdown config).
//
//   ==text==                         → <mark class="hl">text</mark>  (animates in when scrolled to)
//   ==text=={dir=rtl color=accent}   → same, with options (plain .md only: MDX reads `{…}` as code;
//                                       use <Highlight dir="rtl" color="accent"> there)
//   > **sidenote:** text             → <aside class="sidenote">text</aside> (sits in the right margin)
//   a paragraph holding only an image → the image alone, so it can render as a <figure>
//   ![alt](src)⏎_caption_            → the same, with the italic line as the figure's caption

type Node = { type: string; value?: string; children?: Node[]; data?: Record<string, unknown>; [k: string]: unknown };

const HL = /==(?=\S)([^=\n]+?)==(?:\{([^}\n]*)\})?/g;
const HL_KEYS = new Set(["dir", "color", "style", "trigger", "delay"]);

function highlightProps(attrs: string | undefined) {
  const props: Record<string, string | string[]> = { className: ["hl"] };
  for (const pair of (attrs ?? "").trim().split(/\s+/).filter(Boolean)) {
    const [k, v] = pair.split("=");
    if (!HL_KEYS.has(k) || !v) continue;
    if (k === "delay") props.style = `--hl-delay:${Number.parseInt(v, 10) || 0}ms`;
    else props[`data-${k}`] = v;
  }
  return props;
}

function splitHighlights(node: Node): Node[] | null {
  const value = node.value ?? "";
  if (!value.includes("==")) return null;
  const out: Node[] = [];
  let last = 0;
  for (const m of value.matchAll(HL)) {
    if (m.index! > last) out.push({ type: "text", value: value.slice(last, m.index) });
    out.push({
      type: "highlight",
      data: { hName: "mark", hProperties: highlightProps(m[2]) },
      children: [{ type: "text", value: m[1] }],
    });
    last = m.index! + m[0].length;
  }
  if (!out.length) return null;
  if (last < value.length) out.push({ type: "text", value: value.slice(last) });
  return out;
}

function isSidenote(node: Node) {
  if (node.type !== "blockquote") return false;
  const first = node.children?.[0];
  const lead = first?.type === "paragraph" ? first.children?.[0] : undefined;
  const label = lead?.type === "strong" ? lead.children?.[0]?.value : undefined;
  return typeof label === "string" && /^sidenote:?$/i.test(label.trim());
}

function toSidenote(node: Node) {
  const para = node.children![0];
  para.children = para.children!.slice(1);
  const head = para.children[0];
  if (head?.type === "text") head.value = head.value!.replace(/^[:\s]+/, "");
  node.data = { hName: "aside", hProperties: { className: ["sidenote"] } };
}

const textOf = (node: Node): string => node.value ?? (node.children ?? []).map(textOf).join("");

// An image on its own, or an image + line break + an italic caption line (the common
// "![alt](src)  \n_caption_" pattern): returns the image, captioned, so it renders as a <figure>.
function figureImage(para: Node): Node | null {
  if (para.type !== "paragraph") return null;
  const kids = (para.children ?? []).filter((kid) => !(kid.type === "text" && !kid.value?.trim()));
  if (kids.length === 1 && kids[0].type === "image") return kids[0];
  if (kids.length === 3 && kids[0].type === "image" && kids[1].type === "break" && kids[2].type === "emphasis") {
    const caption = textOf(kids[2]).trim();
    if (caption && !kids[0].title) kids[0].title = caption;
    return kids[0];
  }
  return null;
}

function walk(node: Node, parent?: Node) {
  const kids = node.children;
  if (!kids) return;
  for (let i = 0; i < kids.length; i++) {
    const child = kids[i];
    if (child.type === "text" && node.type !== "inlineCode") {
      const parts = splitHighlights(child);
      if (parts) { kids.splice(i, 1, ...parts); i += parts.length - 1; continue; }
    }
    if (isSidenote(child)) toSidenote(child);
    // unwrap image-only (and image + caption) paragraphs
    const image = figureImage(child);
    if (image) kids[i] = image;
    walk(kids[i], node);
  }
  void parent;
}

export function remarkSite() {
  return (tree: Node) => walk(tree);
}
