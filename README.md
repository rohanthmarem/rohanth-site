# rohanth-site

Fast personal site for Rohanth, built with Astro.

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

Astro outputs static files to `dist/`, so the site can deploy on any static host.
Vercel deploys every push to `master`.

## Structure

- `src/layouts/Base.astro` — head, fonts, theme (light/dark before paint), header, footer, analytics.
- `src/layouts/Post.astro` — long-form layout for writing and project write-ups: contents, prose, margin notes.
- `src/pages/` — `/`, `/projects`, `/projects/[slug]`, `/writing`, `/writing/[slug]`, `/inspiration`, `/sidequests`, `404`.
- `src/data/site.ts` — links, inspiration, and the sidequests quest log.
- `src/lib/covers.ts` — generative line-art covers, drawn as SVG at build time.
- `src/lib/terrain.ts` — luminance grids for the homepage project transition, computed at build time.
- `src/plugins/remark.ts` — markdown extras (below).
- `public/fonts/` — self-hosted, subset fonts: Geist Pixel, Merriweather, Ioskeley Mono.

## Writing in markdown

- `==text==` highlights text; it sweeps in when scrolled to. In `.md` files, options go in braces:
  `==text=={dir=rtl color=accent}` (`dir`: ltr, rtl, ttb, btt; `style=marker`; `trigger`: inView, hover, auto).
  In `.mdx`, braces are code, so use `<Highlight dir="rtl" color="accent">text</Highlight>` instead.
- `> **sidenote:** text` becomes a note in the right margin. In MDX, `<Sidenote>text</Sidenote>` also works.
- An image on its own line becomes a numbered figure; its alt text (or title) is the caption.

## Thoughts

The `/thoughts` feed was removed in the redesign; `/thoughts` redirects to `/writing`. The `thoughts`
schema stays in `src/content.schemas.ts` because the MCP server still validates against it, so
`post_thought` still commits files to `content/thoughts/`, but they are not shown on the site.

## Agent MCP server

`mcp/` is an MCP server that lets agents (Codex, Claude Code, Grok, ...) edit the site and
post thoughts. It works entirely through the GitHub API: every write is a commit on
`master`, and Vercel deploys it. Frontmatter and image references are validated before
anything is pushed, so a malformed edit is rejected instead of breaking the build.

Tools: `site_overview`, `list_files`, `read_file`, `commit_changes`, `post_thought`,
`list_thoughts`, `update_thought`, `delete_thought`, `recent_changes`, `deploy_status`.

### Remote (hosted agents)

Runs on the exe.dev VM `rohanth-mcp` (personal account, `ssh exe-personal`):

- Endpoint: `https://rohanth-mcp.exe.xyz/mcp` (Streamable HTTP, stateless)
- Auth: `Authorization: Bearer <token>`. Get the token with
  `ssh rohanth-mcp.exe.xyz sudo cat /etc/rohanth-site-mcp.env`
- GitHub access comes from exe.dev's GitHub integration, so no GitHub token lives on the VM.
  It must use `--act-as-user`: Vercel only deploys commits authored by you.

```bash
# Codex (~/.codex/config.toml)
[mcp_servers.rohanth-site]
url = "https://rohanth-mcp.exe.xyz/mcp"
bearer_token_env_var = "ROHANTH_SITE_MCP_TOKEN"

# Claude Code
claude mcp add --transport http rohanth-site https://rohanth-mcp.exe.xyz/mcp \
  --header "Authorization: Bearer $ROHANTH_SITE_MCP_TOKEN"
```

Any other client that supports remote MCP servers over HTTP with a bearer header (Grok
included) takes the same URL and header.

After changing anything in `mcp/`, redeploy with `npm run mcp:deploy`. The script also does
first-time setup on a fresh VM (Node, systemd service, token). It SSHes to
`rohanth-mcp.exe.xyz`, which `~/.ssh/config` maps to the personal exe.dev key.

### Local (stdio)

```bash
npm run mcp   # node mcp/stdio.ts; needs Node 22.18+
```

Uses `GITHUB_TOKEN` if set, otherwise your `gh` CLI login. For example, to register it with Codex:
`codex mcp add rohanth-site -- node /path/to/rohanth-site/mcp/stdio.ts`.

Optional env for both: `SITE_REPO` (default `rohanthmarem/rohanth-site`), `SITE_BRANCH`
(default `master`), `SITE_URL` (default `https://rohanth.com`), `GITHUB_API_URL`.
