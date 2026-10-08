import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { projectSchema, thoughtSchema, writingSchema } from "./content.schemas";

const projects = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./content/projects" }),
  // Astro resolves `image` to an optimizable asset; the shared schema keeps it a path string.
  schema: ({ image }) => projectSchema.extend({ image: image().optional() }),
});

const writings = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./content/writings" }),
  schema: writingSchema,
});

// Plain markdown only: rough notes shouldn't have to survive MDX's JSX parsing.
const thoughts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/thoughts" }),
  schema: thoughtSchema,
});

export const collections = { projects, writings, thoughts };
