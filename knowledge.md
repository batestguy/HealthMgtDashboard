# Project knowledge

## What this project is

A **Nigeria Health + Project Management Dashboard** (spec v1.1) — a multi-file static dashboard (HTML5 + CSS3 + vanilla JS, no build tools) hosted on GitHub Pages. **Live at https://batestguy.github.io/HealthMgtDashboard/ — Projects, Health, 🚀 showcase, and Ask are built; Export remains.**

- **Source of truth for WHAT:** `dashboard-spec.md` (decisions, per-tab requirements, acceptance criteria). `healtguide.txt` is the superseded v1.0 spec.
- **Source of truth for HOW:** `WORKFLOW.md` (change loop, data regeneration, release, sign-off).
- **Feature set (5 tabs, fixed bottom tab bar):**
  1. 📋 **Projects** – Excel upload (multi-sheet via SheetJS), project/task KPIs, task tracker, bar chart, risk summary.
  2. 🏥 **Health** – GRID3 facility map (~51k facilities, Leaflet + marker clusters), HDX indicator trends (1h cache), facility-type doughnut, refresh button.
  3. 🚀 **This Project** – recruiter-facing showcase (showcase-spec.md): hero + evidence-based radar, feature→skill cards with Try-it deep links, toolchain chips, copy-email + GitHub CTAs. Default landing tab. (Replaced the retired Quiz.)
  4. 💬 **Ask (NLQ)** – simulated fuzzy multi-intent engine ("show top 3 tasks in lagos"): typo-tolerant keyword matching over Excel data + health feed; answers with real numbers, filters Projects, opens tabs. 17-check parse harness green.
  5. 📤 **Export** – PNG via html2canvas, PDF via jsPDF, share link.

## Key locations

- `dashboard-spec.md` – the spec (decisions, data architecture, theming, deployment, acceptance criteria, §12 already-done log).
- `WORKFLOW.md` – the process: spec-first change loop, workbook regeneration, release to Pages, v1 sign-off runbook.
- `assets/sample-data.xlsx` – seeded demo workbook (generated, never hand-edited).
- `tools/generate-sample-xlsx.js` – dev-only generator for the workbook.
- `.agents/types/` – internal Codebuff agent tooling; **not part of the project**, ignore for feature work.
- Shipped app files (spec §3.1): `index.html` (5-tab shell), `css/styles.css`, `js/app.js` (tabs + Projects tab), `js/data.js` (Excel parse/validate), `js/charts.js` (bar/doughnut/line + radar), `js/health-data.js` (GRID3 + HDX + seeds + per-state counts), `js/map.js` (Leaflet, Nigeria-framed), `js/health.js` (Health tab), `js/showcase.js` (showcase tab), `js/nlq.js` (Ask NLQ engine). `js/export.js` is pending. Local assets are cache-busted with `?v=` in `index.html` — bump on every app change (GitHub Pages caches ~10 min).
- Tabs are deep-linkable: `#projects`, `#health`, …

## Commands

- **No build step for the app.** The runtime is static files served as-is; all libraries come from **CDNs** (never npm): Chart.js v4, Leaflet.js + Leaflet.markercluster + OpenStreetMap tiles, SheetJS (XLSX), html2canvas, jsPDF.
- Preview: `python -m http.server 8000` (or `npx serve .`).
- Regenerate the sample workbook (dev-only tooling): `cd tools && npm install && npm run generate:sample`.
- Git: work on `main`; push = Pages deploy to https://batestguy.github.io/HealthMgtDashboard/.

## Conventions & gotchas

- **Mobile-first:** single column, max-width 480px, centred; must be fully usable at 375×812; minimum 44px touch targets.
- **Theme:** primary `#008751` (Nigerian green), secondary `#f5b041` (gold), bg `#f0f4f8`, text `#1a202c`, white cards with 16px radius, gradient header, system font stack.
- **Data:** synthetic but realistic Excel data (5 sheets: Projects, Tasks, Resources, Finances, Locations — projects keyed by `ProjectID`). Health APIs need **fallback sample data** so the demo never breaks.
- **NLQ is simulated**, not a real LLM — keyword → action mapping only.
- **No external icon library** – use emoji/Unicode.
- Acceptance criteria (section 13 of spec) are the definition of done; verify charts render without console errors and export works.