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

- `src/layouts/Base.astro` — head, fonts, sidebar + footer (or `bare` for the homepage), analytics.
- `src/layouts/Post.astro` — long-form layout for writing and project write-ups: contents, prose, margin notes.
- `src/pages/` — `/`, `/projects`, `/projects/[slug]`, `/writing`, `/writing/[slug]`, `404`. Inspiration and sidequests live in the notebook (`/#inspiration`, `/#sidequests`); their old URLs redirect there.
- `src/data/site.ts` — links, inspiration, and the sidequests quest log.
- `src/components/Notebook.astro` — the homepage cover, with every sticker selectable (traced in `src/data/notebook.ts`).
- `src/components/NotebookOpen.astro` — the notebook opened flat: projects, writing, inspiration and sidequests scrapbooked into pages that turn (`#projects` etc. opens it at a section). Pages are laid out in `cqw`, so they scale with the book.
- `src/lib/covers.ts` — generative line-art covers, drawn as SVG at build time.
- `src/lib/terrain.ts` — luminance grids for the homepage project transition, computed at build time.
- `src/plugins/remark.ts` — markdown extras (below).
- `public/fonts/` — self-hosted, subset fonts: Geist Pixel, Merriweather, Geist Mono (subset from the `geist` npm package), and Rohanth Hand, a font traced from my own handwriting, for the notebook.

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

## Material studies

`/iterations/` is an isolated gallery of 13 texture-led homepage explorations.
Open a study for its responsive layout, adjust the texture slider, and use the
stars to save a shortlist in this browser. Arrow keys browse open studies; Escape
returns to the gallery. Direct links use a hash, e.g. `/iterations/#engraved`.

The self-contained artifact is `public/iterations/index.html`. Regenerate it after
editing `scripts/build-texture-studies.mjs` or `src/experiments/texture-studies/`:

```bash
node scripts/build-texture-studies.mjs
```

The gallery embeds its fonts and portrait, works without a server, and links to the
existing live project and writing pages. It does not replace the homepage.

Iteration 13, **Dot by Dot**, follows the paper palette and three-ink stippled
lettering of [Trillium’s dotted-style branch](https://github.com/thetrilliumcompany/blog/tree/dotted-style)
(reference commit `fb4353e30c4bb2b0bc9fa2fa9b3e7b33ad2be483`).
Open `/iterations/dotted.html` directly, or `/iterations/#dotted`.
Its projects/writing/sidequests tabs support arrow keys, Home, and End.

`/iterations/left/` is the simplified top-left layout study. It renders the actual
homepage component, preserving its copy, project ordering, images, and background.
Its overrides are limited to `body#left-study`. To export it for inline review:

```bash
npm run build
node scripts/export-left-study.mjs
```

The export is `public/iterations/left.html`; it includes the existing fonts,
optimized project images, and bundled menu/carousel interactions.

### Fresh directions after feedback

`/iterations/reconsidered.html` is the latest three-direction exploration:
Paper, Cloth, and Ink. These redesign the presentation from scratch while keeping
the homepage bio verbatim and the nine original project photos in their order.
The choices change typography, texture, and photo arrangement; they do not reuse
the earlier wave background or decorative diagrams. Use `#paper`, `#cloth`, or
`#ink` for a direct selection.

Regenerate from the current built homepage with:

```bash
npm run build
node scripts/build-reconsidered-studies.mjs
```

The design brief and reference roles are in
`.context/refs/reconsidered-site/brief.txt`; implementation is in
`src/experiments/reconsidered/`.
