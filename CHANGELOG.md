# Changelog

## Round 2 improvements — 2026-10-12

Four agents (Opus) in parallel worktrees, merged and re-verified: a full regression sweep (18 pages ×
5 widths × 2 themes, production build) found no issues beyond the known TensorForest images, and
Lighthouse stayed level (desktop 100 everywhere; mobile 94–99, sidequests desktop page weight
529 → 403 KB).

### Sharing & caching
- Every page has its own share image (1200×630): project photos for project pages, the editorial
  cover for writing posts, the card fan for inspiration, photo rows for projects and sidequests, its
  own card for 404 — on the site's paper with column lines, pixel title and mono label. Regenerate with
  `node scripts/og.mjs` after adding a project or post.
- The homepage shares just your photo, at full quality (the 460px source of the favicon).
- New crisp favicons from that photo (ico 16/32/48, apple-touch, 192/512, manifest).
- Fonts have content-hashed names and are cached for a year (`node scripts/hash-fonts.mjs` after
  changing a font).
- Viewport allows safe-area insets on notched phones.

### Writing & posts
- Writing list: the cursor preview sits above (or below) the hovered row and never covers its title;
  thumbnails download at the right size for phones and desktop.
- Tall portrait photos in posts fit on screen (~82% of the window height), dither still aligned.
- Margin notes line up with the paragraph they belong to (markdown sidenotes, MDX `<Sidenote>`, and the
  tweet card); consecutive notes stack; inline under their paragraph below 1024px.
- Writing post headings: section heading > sub-heading > body, consistently.

### Inspiration
- Phone reading sheet fits the screen at 360–390px: prev/next pinned to the bottom (home-bar aware),
  long text scrolls inside with a fade, close always reachable.
- The card drawing always keeps ≥ 24px clear of the "person"/kind label, on cards and in the sheet.
- Calmer fan at tablet widths (768–1100): smaller cards and tilt, more of each card visible.
- Phones: nothing flashes behind a card while it opens or closes.

### Sidequests & sidebar
- Phone photo strips are sharp on 3× screens; desktop strip downloads are smaller.
- Photo strips are keyboard-scrollable (Tab to focus, arrow keys) with a focus ring.
- Sidebar: no overlap with full-width sections even on extremely fast scrolls — 90 wheel-scroll runs
  (6 pages × 3 viewports × 5 speeds up to 480px/frame, down and up): zero overlap, never hidden while
  there's room.

### Still open
- TensorForest images need the originals (left as is, by choice).
- Keyboard scrolling of the sidequests strips verified in Chromium; worth a quick check in Safari/Firefox.
- At 768 the 9-card fan is still dense by nature; fully readable titles there would need a different
  layout (e.g. the phone stack).

## QA, polish & performance pass — 2026-10-12

A full pass over the redesigned site by four agents working in parallel (each in its own
worktree, owning separate files), followed by an integration pass on the merged result:

- **shell + homepage** (Fable): sidebar, footer, global styles, homepage, 404
- **inspiration + sidequests** (Opus)
- **writing + projects + posts** (Opus)
- **performance + images** (GPT‑6 Astra via Codex)
- **integration** (Opus): cross-file fixes, real-scroll sidebar tests, full regression sweep

Every page was tested at 1440, 1280, 1024, 768, 430, 390 and 360px, in light and dark, with
mouse, keyboard and touch. The final sweep covered 18 pages × 5 widths × 2 themes on both the dev
server and the production build: no horizontal overflow, no layout breakage, and no console errors
other than the TensorForest images noted below.

### Performance (Lighthouse, production build, before → after)

| page | mobile score | mobile LCP | page weight | desktop score | desktop LCP |
|---|---|---|---|---|---|
| home | 92 → 95 | 3.31s → 2.86s | 434 → 333 KB | 100 → 100 | 0.65s → 0.52s |
| projects | 91 → 95 | 3.38s → 2.93s | 459 → 355 KB | 100 → 100 | 0.73s → 0.67s |
| writing | 94 → 97 | 2.93s → 2.41s | 349 → 237 KB | 100 → 100 | 0.59s → 0.49s |
| inspiration | 96 → 99 | 2.56s → 1.96s | 274 → 184 KB | 100 → 100 | 0.53s → 0.45s |
| sidequests | **77 → 95** | **6.08s → 2.93s** | **1201 → 570 KB** | 100 → 100 | 0.73s → 0.49s |
| formula null | 90 → 97 | 3.31s → 2.48s | 463 → 276 KB | 100 → 100 | 0.69s → 0.57s |
| vibecoding sucks | 96 → 99 | 2.55s → 1.95s | 268 → 177 KB | 100 → 100 | 0.53s → 0.45s |

Zero layout shift and zero blocking time on every page, before and after.

- Source images: 8.4 MB → 4.3 MB (unused images deleted; oversized photos resized and re-encoded).
- Fonts: 240 KB → 152 KB (tighter subsets, same glyphs and metrics).
- Images now download at the size they're actually shown (sidequests, post figures, writing covers);
  the first image on each page is fetched first; no extra full-size fallback copies.
- Vercel Analytics only loads on Vercel builds (no 404s in local previews).
- Favicon caching headers; repeatable image and font audit scripts in `scripts/`.

### Sidebar & site shell
- The menu parks above full-width sections without blinking, glides back after fast scrolls instead
  of jumping, and re-checks its spot when images or fonts finish loading. Verified with 54 real
  wheel-scroll runs (6 pages × 3 viewports × 3 speeds, up and down): never overlaps, never hides
  while there's room.
- Mobile menu opens above the page (it was hidden underneath), animates in, closes on Esc / tap
  outside / widening the window, and its links are 40px tall.
- Theme follows the system light/dark setting by default (live); a small half-circle icon in the
  footer overrides it, and choosing the system's own theme goes back to following it. Browser
  chrome colour matches the theme with no flash on load.
- Removed: the accent-colour shuffle (✦) and the footer copyright line.
- Dark-mode grey text (dates, labels, footer) now meets WCAG AA contrast.
- Footer links are reachable by keyboard while they wait to scramble in; footer toggles are 40px
  hit areas; on phones the three link columns sit in one row.
- A very subtle film-grain texture over the page (drawn from inline SVG, no image request).
- Homepage project scroller: prev/next step by whole cards, focus moves to the other button when
  one disables, state re-syncs on resize; first image loads with high priority.
- 404 is noindex; pages carry og:site_name; highlighted text no longer adds stray spacing.

### Inspiration
- Opening a card now looks like one card the whole way: it grows into the left half of the sheet
  while the reading side slides in, and closing runs the same path back. Prev/next inside the sheet
  crossfades.
- The card that opens is always the lifted one; a lone filtered card is centred; filters re-deal
  cleanly; first load deals in from a hidden pile.
- Background no longer scrolls behind the open sheet; resizing while open refits it; mouse opens
  don't show a focus ring, keyboard opens do; focus returns to the card on close.
- Phones: quick flicks change card, the stack resists over-dragging, and dragging can no longer
  zoom the page out; the full-screen sheet no longer crops the illustration.
- Clippings: quotes are plain text sections; screenplay credits no longer overflow at 1024–1279px.
- Card colours cycle blue → orange → charcoal → cream → mint.

### Sidequests
- Phone photo strips run edge to edge, snap to the text column, and don't trigger back-swipe.

### Writing, projects & posts
- Dithered post photos: correct (not inverted) in dark mode; crisp square dots at every width, zoom
  and pixel density; redrawn when a different-size photo loads; no full-colour flash before the
  dither; tap toggles on touch/pen, hover on mouse; broken photos hide their whole figure.
- Post contents: the active marker slides between sections, the last section activates at the
  bottom, clicks scroll smoothly; the progress bar stays correct as late images/fonts load; the
  "link copied" toast is announced to screen readers.
- Markdown: an image followed by an italic line becomes a captioned figure.
- Writing: back/forward switches grid ⇄ list; no blank gap when switching back to grid; whole list
  rows are tappable (incl. thumbnail and date); the cursor preview follows while scrolling.
- Projects: number plates sit on a chip so they read on dark photos; long titles wrap cleanly.

### Known issues / not done
- **TensorForest write-up images are gone at the source** (the image host no longer resolves and one
  local file is missing). The page now collapses them cleanly; the original images need to be added
  to `content/projects/images/` to restore them.
- Fonts can't get long-lived immutable caching until their filenames are content-hashed.

### Documented improvements (not implemented)
- Light-mode meta grey is 3.4:1 (AA for large text only); going higher flattens the grey hierarchy.
- No default Open Graph image for pages without one.
- Writing list: the hover preview can cover part of the hovered title; could sit above/below.
- Posts: portrait figures can be taller than the window; a max height would keep them on screen.
- Sidenotes float beside the paragraph after their source (inherent to floats).
- Inspiration: at 360×740 the sheet's prev/next row needs a scroll; at 768 the 9-card fan is crowded.
- Sidequests: desktop strip image sizes could be tightened further; phone strips could request
  slightly larger files for 3× screens; strips aren't keyboard-focusable in Safari/Firefox.
- Sidebar: with extremely fast wheel input (240px per frame) the menu can overlap a section for a few
  frames while it glides back (designed overshoot absorption).
- A CSS-only version of the sidebar parking (its own grid row ending where a span begins) would
  remove the JS but needs each page's DOM split around full-width sections.
