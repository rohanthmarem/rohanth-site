import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import { remarkSite } from "./src/plugins/remark.ts";

export default defineConfig({
  output: "static",
  site: "https://rohanth.com",
  integrations: [mdx()],
  devToolbar: { enabled: false },
  // Prefetch internal links on hover/focus: instant navigations, no upfront cost.
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
  // Thoughts were folded away in the redesign; keep old links working.
  redirects: { "/thoughts": "/writing" },
  markdown: {
    remarkPlugins: [remarkSite],
    shikiConfig: { themes: { light: "github-light", dark: "github-dark" }, defaultColor: false },
  },
  build: { inlineStylesheets: "auto" },
});
