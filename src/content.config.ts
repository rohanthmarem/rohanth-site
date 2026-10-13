import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { projectSchema, writingSchema } from "./content.schemas";

const projects = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./content/projects" }),
  // Astro resolves `image` to an optimizable asset; the shared schema keeps it a path string.
  schema: ({ image }) => projectSchema.extend({ image: image().optional() }),
});

const writings = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./content/writings" }),
  schema: writingSchema,
});

// Thoughts (content/thoughts) are no longer rendered; the schema stays in content.schemas.ts
// because the MCP server still validates against it.

export const collections = { projects, writings };
