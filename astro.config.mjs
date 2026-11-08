import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import { readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { basename, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { remarkSite } from "./src/plugins/remark.ts";

// Astro writes every imported image's original next to its optimized copies, and the pages only use
// the copies. After the build, drop the images that no built file refers to.
const pruneImages = {
  name: "prune-unused-images",
  hooks: {
    "astro:build:done": ({ dir, logger }) => {
      const files = [];
      const walk = (folder) => readdirSync(folder, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(join(folder, e.name)) : files.push(join(folder, e.name))));
      walk(fileURLToPath(dir));
      const text = files.filter((f) => /\.(html|css|m?js|json|xml|webmanifest|txt|svg)$/.test(f)).map((f) => readFileSync(f, "utf8")).join("\n");
      let count = 0, bytes = 0;
      for (const file of files.filter((f) => f.includes(`${sep}_astro${sep}`) && /\.(jpe?g|png|webp|avif|gif)$/i.test(f))) {
        if (text.includes(basename(file))) continue;
        bytes += statSync(file).size;
        rmSync(file);
        count++;
      }
      logger.info(`removed ${count} unreferenced images (${Math.round(bytes / 1024)}KB)`);
    },
  },
};

export default defineConfig({
  output: "static",
  site: "https://rohanth.com",
  integrations: [mdx(), pruneImages],
  // Keep the built-in WebP output. Per-image quality still takes precedence.
  image: {
    service: {
      entrypoint: "astro/assets/services/sharp",
      config: { webp: { quality: 80, effort: 5 }, jpeg: { quality: 82, mozjpeg: true } },
    },
  },
  devToolbar: { enabled: false },
  // Prefetch internal links on hover/focus: instant navigations, no upfront cost.
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
  // Old pages folded away in redesigns; keep their links working. Inspiration and sidequests now live
  // in the notebook, which opens from the home page's hash.
  redirects: { "/thoughts": "/writing", "/inspiration": "/#inspiration", "/sidequests": "/#sidequests" },
  markdown: {
    remarkPlugins: [remarkSite],
    shikiConfig: { themes: { light: "github-light", dark: "github-dark" }, defaultColor: false },
  },
  // Inline small styles; keep shared CSS cacheable across hover-prefetched pages.
  build: { inlineStylesheets: "auto" },
});
