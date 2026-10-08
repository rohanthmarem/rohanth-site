// Minimal GitHub REST client for the site MCP server. Everything goes through
// the API (no local clone), so the same code runs in stdio and on Vercel.

export interface RepoConfig {
  /** Omit when apiUrl points at a proxy that injects credentials (exe.dev's GitHub integration). */
  token?: string;
  apiUrl: string;
  owner: string;
  repo: string;
  branch: string;
}

export interface FileChange {
  path: string;
  content: string;
  encoding?: "utf-8" | "base64";
}

export interface CommitResult {
  sha: string;
  url: string;
}

export class GitHubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function createGitHub(config: RepoConfig) {
  const base = `${config.apiUrl}/repos/${config.owner}/${config.repo}`;

  async function gh<T>(path: string, init: RequestInit = {}): Promise<T> {
    // GitHub returns absolute api.github.com URLs in some payloads; keep them on our API host.
    const url = path.startsWith("https://") ? path.replace("https://api.github.com", config.apiUrl) : `${base}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "rohanth-site-mcp",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      let detail = body;
      try {
        detail = JSON.parse(body).message ?? body;
      } catch {}
      throw new GitHubError(res.status, `GitHub ${init.method ?? "GET"} ${path} failed (${res.status}): ${detail}`);
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

  async function headSha(): Promise<string> {
    const ref = await gh<{ object: { sha: string } }>(`/git/ref/heads/${config.branch}`);
    return ref.object.sha;
  }

  return {
    config,

    headSha,

    /** Reads at `ref` (default: the branch head) so callers can pin a commit for later conflict checks. */
    async readFile(path: string, ref = config.branch): Promise<{ content: string; sha: string; size: number; binary: boolean } | null> {
      try {
        const file = await gh<{ type: string; content?: string; sha: string; size: number; encoding?: string } | unknown[]>(
          `/contents/${encodePath(path)}?ref=${ref}`,
        );
        if (Array.isArray(file) || file.type !== "file") {
          throw new GitHubError(400, `${path} is a directory, not a file. Use list_files instead.`);
        }
        // Files over 1 MB come back without inline content; fetch the raw blob.
        let base64 = file.content ?? "";
        if (!base64 && file.size > 0) {
          const blob = await gh<{ content: string }>(`/git/blobs/${file.sha}`);
          base64 = blob.content;
        }
        const bytes = Buffer.from(base64, "base64");
        const binary = bytes.includes(0);
        return {
          content: binary ? bytes.toString("base64") : bytes.toString("utf-8"),
          sha: file.sha,
          size: file.size,
          binary,
        };
      } catch (err) {
        if (err instanceof GitHubError && err.status === 404) return null;
        throw err;
      }
    },

    async listFiles(prefix = ""): Promise<{ path: string; size: number }[]> {
      const tree = await gh<{ tree: { path: string; type: string; size?: number }[]; truncated: boolean }>(
        `/git/trees/${config.branch}?recursive=1`,
      );
      const normalized = prefix.replace(/^\/+|\/+$/g, "");
      return tree.tree
        .filter((entry) => entry.type === "blob")
        .filter((entry) => !normalized || entry.path === normalized || entry.path.startsWith(`${normalized}/`))
        .map((entry) => ({ path: entry.path, size: entry.size ?? 0 }));
    },

    /**
     * Writes and deletes files in a single commit on the branch. If the branch
     * has moved since `base` (the commit the caller read from) or moves while we
     * commit, we only build on the new head when none of our paths changed.
     */
    async commit(message: string, files: FileChange[], deletions: string[] = [], base?: string): Promise<CommitResult> {
      const blobs = await Promise.all(
        files.map(async (file) => {
          const blob = await gh<{ sha: string }>(`/git/blobs`, {
            method: "POST",
            body: JSON.stringify({ content: file.content, encoding: file.encoding ?? "utf-8" }),
          });
          return { path: file.path, sha: blob.sha };
        }),
      );

      const touched = new Set([...files.map((f) => f.path), ...deletions]);
      let previousParent: string | null = base ?? null;
      for (let attempt = 0; ; attempt++) {
        const parent = await headSha();
        if (previousParent && previousParent !== parent) {
          const diff = await gh<{ files?: { filename: string }[] }>(`/compare/${previousParent}...${parent}`);
          const clash = (diff.files ?? []).map((f) => f.filename).filter((name) => touched.has(name));
          if (clash.length) {
            throw new GitHubError(409, `Someone else just changed ${clash.join(", ")}. Re-read and retry.`);
          }
        }
        previousParent = parent;
        const parentCommit = await gh<{ tree: { sha: string } }>(`/git/commits/${parent}`);
        const tree = await gh<{ sha: string }>(`/git/trees`, {
          method: "POST",
          body: JSON.stringify({
            base_tree: parentCommit.tree.sha,
            tree: [
              ...blobs.map((blob) => ({ path: blob.path, mode: "100644", type: "blob", sha: blob.sha })),
              ...deletions.map((path) => ({ path, mode: "100644", type: "blob", sha: null })),
            ],
          }),
        });
        // No author is set on purpose: GitHub attributes the commit to the token's
        // owner, which is what Vercel needs to allow the deployment.
        const commit = await gh<{ sha: string; html_url: string }>(`/git/commits`, {
          method: "POST",
          body: JSON.stringify({ message, tree: tree.sha, parents: [parent] }),
        });
        try {
          await gh(`/git/refs/heads/${config.branch}`, {
            method: "PATCH",
            body: JSON.stringify({ sha: commit.sha, force: false }),
          });
          return { sha: commit.sha, url: commit.html_url };
        } catch (err) {
          if (err instanceof GitHubError && err.status === 422 && attempt < 3) continue;
          throw err;
        }
      }
    },

    async recentCommits(limit: number) {
      const commits = await gh<
        { sha: string; html_url: string; commit: { message: string; author: { name: string; date: string } } }[]
      >(`/commits?sha=${config.branch}&per_page=${limit}`);
      return commits.map((c) => ({
        sha: c.sha,
        url: c.html_url,
        message: c.commit.message.split("\n")[0],
        author: c.commit.author.name,
        date: c.commit.author.date,
      }));
    },

    async deployStatus(ref: string) {
      const status = await gh<{
        sha: string;
        state: string;
        statuses: { context: string; state: string; description: string | null; target_url: string | null }[];
      }>(`/commits/${encodeURIComponent(ref)}/status`);
      // exe.dev's GitHub App can't read deployments; the Vercel statuses above still say whether it shipped.
      const deployments = await gh<{ id: number; environment: string; statuses_url: string }[]>(
        `/deployments?sha=${status.sha}&per_page=10`,
      ).catch((err) => {
        if (err instanceof GitHubError && err.status === 403) return [];
        throw err;
      });
      const deploymentUrls = await Promise.all(
        deployments.map(async (d) => {
          const statuses = await gh<{ state: string; environment_url?: string }[]>(d.statuses_url);
          return { environment: d.environment, state: statuses[0]?.state ?? "pending", url: statuses[0]?.environment_url };
        }),
      );
      return {
        sha: status.sha,
        checks: status.statuses
          .filter((s) => s.context.toLowerCase().includes("vercel"))
          .map((s) => ({ context: s.context, state: s.state, description: s.description, logs: s.target_url })),
        deployments: deploymentUrls,
      };
    },
  };
}

export type GitHub = ReturnType<typeof createGitHub>;
