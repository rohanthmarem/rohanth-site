import { z } from "astro/zod";

// Shared by the Astro content collections and the site MCP server, so agents
// get the same frontmatter validation the build does before they push.

export const projectSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  description: z.string(),
  tags: z.array(z.string()).optional(),
  image: z.string().optional(),
  imagePosition: z.string().optional(),
  link: z.string().optional(),
});

export const writingSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  description: z.string(),
  tags: z.array(z.string()).optional(),
});

// Thoughts are stored as UTC timestamps but dated and displayed in Rohanth's local time.
export const THOUGHTS_TIME_ZONE = "America/Toronto";

export const thoughtSchema = z.object({
  date: z.coerce.date(),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const contentSchemas = {
  "content/projects/": projectSchema,
  "content/writings/": writingSchema,
  "content/thoughts/": thoughtSchema,
} as const;
