import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import { remarkSite } from "./src/plugins/remark.ts";

export default defineConfig({
  output: "static",
  site: "https://rohanth.com",
  integrations: [mdx()],
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
  // Thoughts were folded away in the redesign; keep old links working.
  redirects: { "/thoughts": "/writing" },
  markdown: {
    remarkPlugins: [remarkSite],
    shikiConfig: { themes: { light: "github-light", dark: "github-dark" }, defaultColor: false },
  },
  // Inline small styles; keep shared CSS cacheable across hover-prefetched pages.
  build: { inlineStylesheets: "auto" },
});
