import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { contentSchemas, THOUGHTS_TIME_ZONE } from "../src/content.schemas.ts";
import { createGitHub, type FileChange, type GitHub, type RepoConfig } from "./github.ts";

export interface SiteConfig extends RepoConfig {
  siteUrl: string;
}

export function configFromEnv(env: Record<string, string | undefined>, fallbackToken?: string): SiteConfig | null {
  const token = env.GITHUB_TOKEN || env.GH_TOKEN || fallbackToken;
  const apiUrl = (env.GITHUB_API_URL || "https://api.github.com").replace(/\/+$/, "");
  // Without a token we can only work through a credential-injecting proxy.
  if (!token && !env.GITHUB_API_URL) return null;
  const [owner, repo] = (env.SITE_REPO || "rohanthmarem/rohanth-site").split("/");
  return {
    token,
    apiUrl,
    owner,
    repo,
    branch: env.SITE_BRANCH || "master",
    siteUrl: (env.SITE_URL || "https://rohanth.com").replace(/\/+$/, ""),
  };
}

const THOUGHTS_DIR = "content/thoughts";

const SITE_GUIDE = `# rohanth.com: how to make changes

Astro 6 static site. Every commit this server makes lands directly on the production branch,
and Vercel deploys it to rohanth.com in about a minute. If a build fails, Vercel keeps the
previous version live, so a broken commit means "your change didn't ship", not "the site is down".
After committing, call deploy_status with the commit sha to confirm it went live.

## Voice
Rohanth writes in lowercase, casually and concisely. Match the surrounding copy.

## Where things live
- src/source/index.html: homepage. Hero intro, the "previously i've done" bullet list, and the
  Experiences rows are plain HTML here. Inline link pills use
  <a class="tbc-about-tag tbc-tag-X" ...> where X is a letter a-h (each letter is a color).
- src/source/inspiration.html: inspiration page (people, reading, media).
- src/pages/sidequests.astro: sidequests list.
- content/projects/*.mdx: one file per project; the /projects page lists them by date.
  Frontmatter: title, date (YYYY-MM-DD), description, tags? (first tag shows as a pill),
  image? ("./images/<file>"), imagePosition? (CSS object-position), link? (external link
  instead of a detail page).
- content/projects/images/: every image used by projects AND by src/source/*.html. Project
  MDX references them as ./images/<file>; source HTML references them as /projects/<file>
  and the build swaps in an optimized version (the build fails if that file is missing).
  Upload images with encoding "base64".
- content/writings/*.mdx: long-form posts (title, date, description, tags?). Note: the
  nav's "Writing" link (and /writing) goes to rohanth.substack.com.
- content/thoughts/*.md: "chain of thought", short rough notes. Use the *_thought tools
  rather than writing these by hand.
- src/source/styles.css: all styles (fonts: Sentient serif for text, IBM Plex Mono for labels).
- src/layouts/ContentLayout.astro and every src/source/*.html each contain their own copy of
  the nav; change all of them when changing the nav.
- public/: static files served as-is.

## Rules
- Read a file before changing it, then change only what was asked. Keep existing classes
  and markup patterns.
- One logical change per commit, with a short message that says what changed.
- Don't touch package.json, astro.config.mjs or mcp/ (this server) unless explicitly asked.
`;

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function text(value: string) {
  return { content: [{ type: "text" as const, text: value }] };
}

function fail(err: unknown) {
  return { isError: true, content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }] };
}

function normalizePath(raw: string): string {
  const path = raw.trim().replace(/^\.?\/+/, "");
  const segments = path.split("/");
  if (!path || segments.some((s) => s === "" || s === "." || s === "..")) {
    throw new Error(`Invalid path "${raw}". Use a repo-relative path like "src/source/index.html".`);
  }
  if (/^(\.git|node_modules|dist|\.astro|\.vercel)(\/|$)/.test(path) || /(^|\/)\.env(\.|$)/.test(path)) {
    throw new Error(`Refusing to write "${path}": that path is off-limits.`);
  }
  return path;
}

function splitFrontmatter(source: string): { data: Record<string, unknown>; body: string } | null {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) return null;
  const data = parseYaml(match[1]);
  return { data: data && typeof data === "object" ? (data as Record<string, unknown>) : {}, body: match[2] };
}

function thoughtFile(data: { date: string; title?: string; tags?: string[] }, body: string): string {
  // JSON strings are valid YAML double-quoted scalars, so this escapes anything a note contains.
  const lines = [`date: ${JSON.stringify(data.date)}`];
  if (data.title) lines.push(`title: ${JSON.stringify(data.title)}`);
  if (data.tags?.length) lines.push(`tags: ${JSON.stringify(data.tags)}`);
  return `---\n${lines.join("\n")}\n---\n\n${body.trim()}\n`;
}

function slugify(input: string, maxWords = 6): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join("-")
    .slice(0, 60)
    .replace(/-+$/, "");
}

function localDate(date: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return date.toLocaleDateString("en-CA", { timeZone: THOUGHTS_TIME_ZONE });
}

/** Catches the mistakes that would fail the Vercel build, before they get pushed. */
async function validateChanges(github: GitHub, files: FileChange[], deletions: string[]) {
  const problems: string[] = [];
  let repoPaths: Set<string> | null = null;
  const exists = async (path: string) => {
    if (files.some((f) => f.path === path)) return true;
    if (deletions.includes(path)) return false;
    repoPaths ??= new Set((await github.listFiles()).map((f) => f.path));
    return repoPaths.has(path);
  };

  for (const file of files) {
    const prefix = Object.keys(contentSchemas).find((p) => file.path.startsWith(p)) as keyof typeof contentSchemas | undefined;
    if (prefix && /\.mdx?$/.test(file.path)) {
      if (prefix === "content/thoughts/" && !file.path.endsWith(".md")) {
        problems.push(`${file.path}: thoughts must be .md files, not .mdx.`);
        continue;
      }
      let parsed;
      try {
        parsed = splitFrontmatter(file.content);
      } catch (err) {
        problems.push(`${file.path}: frontmatter is not valid YAML (${(err as Error).message}).`);
        continue;
      }
      if (!parsed) {
        problems.push(`${file.path}: missing the --- frontmatter --- block.`);
        continue;
      }
      const result = contentSchemas[prefix].safeParse(parsed.data);
      if (!result.success) {
        const issues = result.error.issues
          .map((i) => {
            const field = i.path.join(".") || "(root)";
            return `${field}: ${i.path.length === 1 && parsed.data[field] === undefined ? "required" : i.message}`;
          })
          .join("; ");
        problems.push(`${file.path}: invalid frontmatter (${issues}).`);
      }
      const image = parsed.data.image;
      if (prefix === "content/projects/" && typeof image === "string" && image.startsWith("./")) {
        const dir = file.path.slice(0, file.path.lastIndexOf("/"));
        const target = `${dir}/${image.slice(2)}`;
        if (!(await exists(target))) problems.push(`${file.path}: image ${image} does not exist (expected ${target}).`);
      }
    }

    if (/^src\/source\/[^/]+\.html$/.test(file.path)) {
      for (const [, name] of file.content.matchAll(/<img src="\/projects\/([^"]+)"/g)) {
        if (!(await exists(`content/projects/images/${name}`))) {
          problems.push(`${file.path}: <img src="/projects/${name}"> needs content/projects/images/${name} to exist.`);
        }
      }
    }
  }

  if (problems.length) {
    throw new Error(`Nothing was committed. Fix these first:\n- ${problems.join("\n- ")}`);
  }
}

export function createSiteServer(config: SiteConfig): McpServer {
  const github = createGitHub(config);
  const server = new McpServer(
    { name: "rohanth-site", version: "1.0.0" },
    {
      instructions:
        "Edits and publishes Rohanth's personal site (rohanth.com). Every write is a commit to the production branch that Vercel deploys automatically. Call site_overview before making site changes. To publish a rough note to the 'chain of thought' section, use post_thought.",
    },
  );

  const thoughtUrl = (slug: string) => `${config.siteUrl}/thoughts/${slug}`;
  const thoughtPath = (slug: string) => {
    const clean = slug.trim().replace(/\.md$/, "");
    if (!/^[a-z0-9][a-z0-9-]*$/.test(clean)) throw new Error(`"${slug}" is not a thought slug. Use list_thoughts to find it.`);
    return `${THOUGHTS_DIR}/${clean}.md`;
  };

  server.registerTool(
    "site_overview",
    {
      title: "Site overview",
      description: "How the site is organized, where each kind of content lives, and the rules for editing it. Read this before changing the site.",
      annotations: { readOnlyHint: true },
    },
    async () => text(SITE_GUIDE),
  );

  server.registerTool(
    "list_files",
    {
      title: "List files",
      description: "List files in the site repo, optionally under a directory (e.g. \"content/projects\").",
      inputSchema: { path: z.string().optional().describe("Directory to list. Omit for the whole repo.") },
      annotations: { readOnlyHint: true },
    },
    async ({ path }) => {
      try {
        const files = await github.listFiles(path ?? "");
        return text(files.length ? files.map((f) => f.path).join("\n") : `No files under "${path}".`);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "read_file",
    {
      title: "Read file",
      description: "Read a file from the live site repo. Binary files come back base64-encoded.",
      inputSchema: { path: z.string().describe("Repo-relative path, e.g. \"src/source/index.html\".") },
      annotations: { readOnlyHint: true },
    },
    async ({ path }) => {
      try {
        const head = await github.headSha();
        const file = await github.readFile(normalizePath(path), head);
        if (!file) return fail(new Error(`${path} does not exist. Use list_files to find the right path.`));
        const body = file.binary ? `(binary file, ${file.size} bytes, base64)\n${file.content}` : file.content;
        return {
          content: [
            { type: "text" as const, text: body },
            { type: "text" as const, text: `(read at commit ${head}; pass it as \`base\` to commit_changes so a concurrent edit isn't overwritten)` },
          ],
        };
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "commit_changes",
    {
      title: "Commit changes",
      description:
        "Write and/or delete files in one commit, pushed straight to production (Vercel deploys it). Each file is replaced with the full content you give, so read it first and send the complete new version. Content frontmatter and image references are checked before anything is pushed.",
      inputSchema: {
        message: z.string().min(1).describe("Commit message: a short sentence saying what changed."),
        files: z
          .array(
            z.object({
              path: z.string(),
              content: z.string().describe("Full new file contents."),
              encoding: z.enum(["utf-8", "base64"]).optional().describe("Use base64 for images and other binary files."),
            }),
          )
          .default([]),
        delete: z.array(z.string()).optional().describe("Paths to delete in the same commit."),
        base: z
          .string()
          .optional()
          .describe("Commit sha that read_file reported. If any of these files changed since then, the commit is refused instead of overwriting."),
      },
      annotations: { destructiveHint: true },
    },
    async ({ message, files, delete: deletePaths, base }) => {
      try {
        const changes = files.map((f) => ({ ...f, path: normalizePath(f.path) }));
        const deletions = (deletePaths ?? []).map(normalizePath);
        if (!changes.length && !deletions.length) return fail(new Error("Nothing to commit."));
        await validateChanges(github, changes, deletions);
        const commit = await github.commit(message, changes, deletions, base);
        return json({
          committed: commit.sha,
          commit_url: commit.url,
          next: "Vercel is deploying this now. Call deploy_status with this sha in ~60s to confirm it's live.",
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "post_thought",
    {
      title: "Post a thought",
      description:
        "Publish a note to the 'chain of thought' section (rohanth.com/thoughts), like a Substack note. Post the note as Rohanth wrote it: keep their wording, lowercase style and rough edges. Only fix typos or restructure if they asked. Markdown is supported.",
      inputSchema: {
        body: z.string().min(1).describe("The note itself, in markdown."),
        title: z.string().optional().describe("Optional headline. Most notes don't have one."),
        tags: z.array(z.string()).optional().describe("Optional short lowercase tags, e.g. [\"ai\", \"running\"]."),
        date: z.string().optional().describe("ISO timestamp or YYYY-MM-DD to backdate the note. Defaults to now."),
      },
      annotations: { destructiveHint: false },
    },
    async ({ body, title, tags, date }) => {
      try {
        // A bare date means that day in Rohanth's time zone, not UTC midnight (the previous evening there).
        const when = !date ? new Date() : /^\d{4}-\d{2}-\d{2}$/.test(date.trim()) ? new Date(`${date.trim()}T16:00:00Z`) : new Date(date);
        if (Number.isNaN(when.valueOf())) return fail(new Error(`"${date}" is not a valid date.`));
        const base = `${localDate(when)}-${slugify(title || body) || "note"}`;
        const existing = new Set((await github.listFiles(THOUGHTS_DIR)).map((f) => f.path));
        let slug = base;
        for (let n = 2; existing.has(thoughtPath(slug)); n++) slug = `${base}-${n}`;

        const content = thoughtFile({ date: when.toISOString(), title, tags }, body);
        const commit = await github.commit(`Post thought: ${title || slugify(body, 8).replaceAll("-", " ")}`, [
          { path: thoughtPath(slug), content },
        ]);
        return json({
          slug,
          url: thoughtUrl(slug),
          commit: commit.sha,
          next: "Live in about a minute once Vercel finishes deploying (check with deploy_status).",
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "list_thoughts",
    {
      title: "List thoughts",
      description: "List the most recent chain-of-thought notes with their slugs, newest first.",
      inputSchema: { limit: z.number().int().min(1).max(100).default(20) },
      annotations: { readOnlyHint: true },
    },
    async ({ limit }) => {
      try {
        const files = (await github.listFiles(THOUGHTS_DIR)).filter((f) => f.path.endsWith(".md"));
        const notes = await Promise.all(
          files.map(async (f) => {
            const file = await github.readFile(f.path);
            let parsed: ReturnType<typeof splitFrontmatter> = null;
            try {
              parsed = file ? splitFrontmatter(file.content) : null;
            } catch {} // one hand-edited note with broken YAML shouldn't hide the rest
            const slug = f.path.slice(THOUGHTS_DIR.length + 1, -3);
            const date = new Date(String(parsed?.data.date));
            return {
              slug,
              date: Number.isNaN(date.valueOf()) ? null : date.toISOString(),
              title: parsed?.data.title ?? null,
              tags: parsed?.data.tags ?? [],
              preview: (parsed?.body ?? "").trim().slice(0, 160),
              url: thoughtUrl(slug),
            };
          }),
        );
        notes.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
        return json(notes.slice(0, limit));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "update_thought",
    {
      title: "Update a thought",
      description: "Edit an existing note. Only the fields you pass change; the original date and URL stay the same.",
      inputSchema: {
        slug: z.string().describe("Slug from list_thoughts."),
        body: z.string().min(1).optional(),
        title: z.string().optional().describe("Pass an empty string to remove the title."),
        tags: z.array(z.string()).optional(),
      },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ slug, body, title, tags }) => {
      try {
        const path = thoughtPath(slug);
        const file = await github.readFile(path);
        const parsed = file ? splitFrontmatter(file.content) : null;
        if (!parsed) return fail(new Error(`No thought with slug "${slug}". Use list_thoughts to find it.`));
        const current = parsed.data as { date: string | Date; title?: string; tags?: string[] };
        const content = thoughtFile(
          {
            date: new Date(current.date).toISOString(),
            title: title === undefined ? current.title : title || undefined,
            tags: tags ?? current.tags,
          },
          body ?? parsed.body,
        );
        const commit = await github.commit(`Update thought: ${slug}`, [{ path, content }]);
        return json({ slug, url: thoughtUrl(slug), commit: commit.sha });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "delete_thought",
    {
      title: "Delete a thought",
      description: "Remove a note from the site. It stays recoverable in git history.",
      inputSchema: { slug: z.string().describe("Slug from list_thoughts.") },
      annotations: { destructiveHint: true },
    },
    async ({ slug }) => {
      try {
        const path = thoughtPath(slug);
        if (!(await github.readFile(path))) return fail(new Error(`No thought with slug "${slug}".`));
        const commit = await github.commit(`Delete thought: ${slug}`, [], [path]);
        return json({ deleted: slug, commit: commit.sha });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "recent_changes",
    {
      title: "Recent changes",
      description: "Recent commits on the production branch, newest first.",
      inputSchema: { limit: z.number().int().min(1).max(50).default(10) },
      annotations: { readOnlyHint: true },
    },
    async ({ limit }) => {
      try {
        return json(await github.recentCommits(limit));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "deploy_status",
    {
      title: "Deploy status",
      description:
        "Vercel deployment status for a commit (defaults to the latest one). 'pending' means still building; 'failure' includes the reason and a link to the build logs.",
      inputSchema: { sha: z.string().optional().describe("Commit sha. Defaults to the branch head.") },
      annotations: { readOnlyHint: true },
    },
    async ({ sha }) => {
      try {
        const status = await github.deployStatus(sha ?? config.branch);
        if (!status.checks.length && !status.deployments.length) {
          return json({ ...status, note: "Vercel hasn't reported on this commit yet. Try again in a few seconds." });
        }
        if (status.checks.some((c) => /blocked|author|github account/i.test(c.description ?? ""))) {
          return json({
            ...status,
            note: "Vercel blocked this deploy because the commit author isn't linked to Rohanth's Vercel/GitHub account. Commits made through this server don't have that problem, and the next one will deploy everything up to it.",
          });
        }
        return json(status);
      } catch (err) {
        return fail(err);
      }
    },
  );

  return server;
}
