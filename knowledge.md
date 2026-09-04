# Project knowledge

## What this project is

A **Nigeria Health + Project Management Dashboard** (spec v1.1) — a multi-file static dashboard (HTML5 + CSS3 + vanilla JS, no build tools) hosted on GitHub Pages for internal team use on phone and desktop. **Live at https://batestguy.github.io/HealthMgtDashboard/ — Projects and Health tabs are built; Quiz, Ask, and Export remain.**

- **Source of truth for WHAT:** `dashboard-spec.md` (decisions, per-tab requirements, acceptance criteria). `healtguide.txt` is the superseded v1.0 spec.
- **Source of truth for HOW:** `WORKFLOW.md` (change loop, data regeneration, release, sign-off).
- **Feature set (5 tabs, fixed bottom tab bar):**
  1. 📋 **Projects** – Excel upload (multi-sheet via SheetJS), project/task KPIs, task tracker, bar chart, risk summary.
  2. 🏥 **Health** – GRID3 facility map (~51k facilities, Leaflet + marker clusters), HDX indicator trends (1h cache), facility-type doughnut, refresh button.
  3. 🧠 **Quiz** – 10–12 questions per session (5 static Nigeria trivia + 5–7 dynamic from uploaded Excel), instant feedback, score tracker.
  4. 💬 **Ask (NLQ)** – simulated keyword-matching queries ("show", "top", state names, "budget", "tasks") that filter data/navigate tabs.
  5. 📤 **Export** – PNG via html2canvas, PDF via jsPDF, share link.

## Key locations

- `dashboard-spec.md` – the spec (decisions, data architecture, theming, deployment, acceptance criteria, §12 already-done log).
- `WORKFLOW.md` – the process: spec-first change loop, workbook regeneration, release to Pages, v1 sign-off runbook.
- `assets/sample-data.xlsx` – seeded demo workbook (generated, never hand-edited).
- `tools/generate-sample-xlsx.js` – dev-only generator for the workbook.
- `.agents/types/` – internal Codebuff agent tooling; **not part of the project**, ignore for feature work.
- Shipped app files (spec §3.1): `index.html` (5-tab shell), `css/styles.css`, `js/app.js` (tabs + Projects tab), `js/data.js` (Excel parse/validate), `js/charts.js` (bar/doughnut/line), `js/health-data.js` (GRID3 + HDX + seeds), `js/map.js` (Leaflet), `js/health.js` (Health tab). `js/quiz.js`, `js/nlq.js`, `js/export.js` are pending.
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