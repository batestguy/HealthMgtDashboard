# Project knowledge

## What this project is

A **Nigeria Health + Project Management Dashboard** — a multi-file static dashboard (HTML5 + CSS3 + vanilla JS, no build tools) hosted on GitHub Pages. The app is built; the visual redesign ("Editorial National Atlas", branded **Dandali**) is fully shipped across all five tabs.

**Live at https://batestguy.github.io/HealthMgtDashboard/ — all five tabs built:** Projects, Health, 🚀 This Project (showcase, default landing), 💬 Ask (NLQ), and 📤 Export (PNG + share link + multi-section PDF report, all live).

- **Source of truth for WHAT:** `dashboard-spec.md` (decisions, per-tab requirements, acceptance criteria). The visual redesign is specified in `redesign-spec.md` (design system + phase plan + lessons-learned); the recruiter-facing showcase is specified in `showcase-spec.md`. `healtguide.txt` is the superseded v1.0 spec and should not be read for current requirements.
- **Source of truth for HOW:** `WORKFLOW.md` (spec-first change loop, data regeneration, release to Pages, sign-off).
- **Identity:** "Editorial National Atlas" — warm paper + deep green ink + refined gold, Fraunces display + Space Grotesk body + IBM Plex Mono numerals, hand-drawn inline SVG icons (no emoji in chrome), Wawa Aba brand mark + woven pattern bands, light + dark themes with a persisted header toggle. Head wordmark: **Dandali**.
- **Feature set (5 tabs, fixed bottom tab bar):**
  1. 📋 **Projects** – Excel upload (multi-sheet via SheetJS), project/task KPIs, filters, project cards, six charts, task tracker. Atlas-styled in Phase 1.
  2. 🏥 **Health** – GRID3 facility map (~51k facilities, Leaflet + marker clusters, Nigeria-framed, zoom-8 detail, atlas-styled circles + controls + bespoke state tooltip), HDX indicator trends + facility-level doughnut + key indicators; KPIs with mono numerals + footer summary; atlas section rules. Restyled in Phase 2. Map trend legend is a bespoke HTML legend (green DPT3 dot + bright-gold Malaria dot with dark outline).
  3. 🚀 **This Project** – recruiter-facing showcase: hero art moment, evidence-based radar, feature→skill cards with Try-it deep links, toolchain chips, copy-email + GitHub CTAs. Default landing tab. Restyled in Phase 1.
  4. 💬 **Ask (NLQ)** – simulated fuzzy multi-intent engine ("show top 3 tasks in lagos"): typo-tolerant keyword matching over Excel data + health feed; answers with real numbers, filters Projects, opens tabs. 17-check parse harness green. Atlas shell restyle (input, answer panel, chips, desktop split) shipped in Phase 3; the engine itself is untouched.
  5. 📤 **Export** – **PNG snapshot** of the active tab (html2canvas, retina-scaled, themed to the active light/dark theme, `dashboard-YYYY-MM-DD.png`) **+ share link** (live Pages URL + active tab hash, clipboard API + `execCommand` fallback, toast) now live; **PDF now live** — multi-section report built with **jsPDF loaded from the CDN** (`jspdf@4.2.1` UMD build in `index.html` `<head>` library block), sections: title page → Projects KPIs + task summary + project-progress bar chart → Health KPIs + facilities-by-level doughnut + indicator-trends line chart → latest Ask answer; `js/pdf.js` renders its **own** `pdfcap-*` chart canvases into an offscreen forced-light stage (`#pdf-stage`) and embeds those as JPEGs — it never snapshots the live charts, so the report is genuinely always paper-themed and does not depend on which tab is open; filename `dashboard-report-YYYY-MM-DD.pdf`; "Download PDF report" flips the card to live and shows "Building PDF report…" → "PDF downloaded" (or "PDF library did not load from CDN" + graceful fallback if the CDN fails). Each capture logs `[pdf] capture <id>: <n> bytes` (or `null` / `skipped (no data)`) with `console.info`. Note: the PDF path only became reachable end-to-end with the 2026-09-07 UMD-global / `pdf.on` fixes, and the 2026-09-08 pass then fixed four defects only visible once a file was actually produced — footer overprint (now a reserved `FOOTER_H` band + `needSpace()`), `₦`/`Σ` printing as `¦`/`£` (jsPDF's built-in fonts are **WinAnsiEncoding**, so PDF-bound strings spell `NGN ` and write sums out in words while the on-screen formatters keep `₦`), right-margin overflow, and a hardcoded methodology-card height that cut through its own text (see `dashboard-spec.md` §12). Browser-verified: 4 pages, three charts embedded with cream corners, no glyph corruption, no footer collision. The PNG button was separately dead until the same pass — `js/export.js` called `html2canvas` but `index.html` never loaded it.

## Key locations

- `dashboard-spec.md` – the feature/architecture spec (decisions, data architecture, theming, deployment, acceptance criteria, §12 already-done log).
- `redesign-spec.md` – the visual redesign spec (design system tokens, type, icons, pattern, layout, chart theming, motion, phased plan, lessons-learned, §10 current-state status).
- `showcase-spec.md` – the recruiter-facing showcase spec (the 🚀 This Project tab).
- `WORKFLOW.md` – the process: spec-first change loop, workbook regeneration, release to Pages, sign-off.
- `assets/sample-data.xlsx` – seeded demo workbook (generated, never hand-edited).
- `tools/generate-sample-xlsx.js` – dev-only generator for the workbook.
- `.agents/types/` – internal Freebuff/Codebuff agent tooling; **not part of the project**, ignore for feature work.
- Shipped app files (spec §3.1): `index.html` (5-tab shell), `css/styles.css`, `js/app.js` (tabs + Projects tab + shared helpers + theme wiring), `js/data.js` (Excel parse/validate), `js/charts.js` (bar/doughnut/line/radar + bespoke Health trend legend helper + `get()` instance accessor and `withThemeScope()` for offscreen paper-themed capture), `js/health-data.js` (GRID3 + HDX + seeds + per-state counts), `js/map.js` (Leaflet, Nigeria-framed), `js/health.js` (Health tab), `js/showcase.js` (showcase tab), `js/nlq.js` (Ask NLQ engine), `js/export.js` (PNG + share link); `js/pdf.js` (PDF, wires jsPDF from CDN). Local assets are cache-busted with `?v=` in `index.html` — current build `?v=11`; bump on every app change (GitHub Pages caches ~10 min).
- Tabs are deep-linkable: `#projects`, `#health`, `#showcase`, `#ask`, `#export`.

## Commands

- **No build step for the app.** The runtime is static files served as-is; all libraries come from **CDNs** (never npm): Chart.js v4, SheetJS (XLSX), html2canvas, jsPDF (loaded from the CDN in `index.html` `<head>` library block: `jspdf@4.2.1` UMD build), Leaflet.js + Leaflet.markercluster + OpenStreetMap tiles.
- Preview: `python -m http.server 8000` (or `npx serve .`).
- Regenerate the sample workbook (dev-only tooling): `cd tools && npm install && npm run generate:sample`.
- Git: work on `main`; push = Pages deploy to https://batestguy.github.io/HealthMgtDashboard/.

## Conventions & gotchas

- **Mobile-first:** single column, max-width 480px, centred; fully usable at 375×812; minimum 44px touch targets.
- **Theme tokens (shipped):** paper atlas light (`--bg #f6f1e7`, `--ink #12352a`, `--green #0e6b4c`, `--gold #c99a2e`) and forest control room dark (`--bg #0e1a15`, `--ink #e9efe9`, `--green #2eae7d`, `--gold #e8b64c`); plus `--gold-bright` (#e9b94a light / #f3c45a dark) used for the Malaria trend series. See `redesign-spec.md §4.1`.
- **Icons:** hand-drawn inline SVG sprite (`pm-*`), `stroke="currentColor"`, replaces all emoji in the chrome. Emoji is **not** the icon system.
- **Data:** synthetic but realistic Excel data (5 sheets: Projects, Tasks, Resources, Finances, Locations — projects keyed by `ProjectID`). Health APIs need **fallback sample data** so the demo never breaks.
- **NLQ is simulated**, not a real LLM — keyword → action mapping only.
- **Zero build step** stays true: Google Fonts (non-blocking), inline SVG/CSS, CDN-only libraries. No bundler, no npm to the browser.
- **jsPDF is `window.jspdf.jsPDF`, not `jsPDF`.** The `jspdf@4.2.1` UMD bundle attaches a single `jspdf` namespace and nothing else; `js/pdf.js` resolves the constructor through `jsPDFCtor()` at click time (tolerating both shapes) rather than testing a bare global. Reaching for `jsPDF` directly makes the button report "PDF library did not load from CDN" while the library is sitting on the page. Same lesson generalises: grep the CDN bundle before calling a method — `pdf.on('pageAdded', …)` was invented, jsPDF's event API is `internal.events.subscribe`.
- Acceptance criteria are the definition of done; verify charts render without console errors and export works.