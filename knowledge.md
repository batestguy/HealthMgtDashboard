# Project knowledge

## What this project is

A **Nigeria Health + Project Management Dashboard** (spec v1.0). Still at the **planning stage — no code exists yet**. The deliverable is a single, self-contained `index.html` (HTML5 + CSS3 + vanilla JS, no build tools) hosted on GitHub Pages for internal team use on phone and desktop.

- **Source of truth:** `healtguide.txt` (full spec: features, data model, tech stack, acceptance criteria).
- **Feature set (5 tabs, fixed bottom tab bar):**
  1. 📋 **Projects** – Excel upload (multi-sheet via SheetJS), project/task KPIs, task tracker, bar chart, risk summary.
  2. 🏥 **Health** – GRID3 facility map (~51k facilities, Leaflet + marker clusters), HDX indicator trends (1h cache), facility-type doughnut, refresh button.
  3. 🧠 **Quiz** – 10–12 questions per session (5 static Nigeria trivia + 5–7 dynamic from uploaded Excel), instant feedback, score tracker.
  4. 💬 **Ask (NLQ)** – simulated keyword-matching queries ("show", "top", state names, "budget", "tasks") that filter data/navigate tabs.
  5. 📤 **Export** – PNG via html2canvas, PDF via jsPDF, share link.

## Key locations

- `healtguide.txt` – the spec document (data architecture, quiz logic, theming, deployment checklist, acceptance criteria).
- `.agents/types/` – internal Codebuff agent tooling; **not part of the project**, ignore for feature work.
- Future: `index.html` goes in repo root (does not exist yet).

## Commands

- **No package.json, no build tooling, no tests.** This is a static single-file app.
- "Build" = author/edit `index.html`; "run" = open it in a browser or serve statically.
- All libraries come from **CDNs** (never npm): Chart.js v4, Leaflet.js + Leaflet.markercluster + OpenStreetMap tiles, SheetJS (XLSX), html2canvas, jsPDF.

## Conventions & gotchas

- **Mobile-first:** single column, max-width 480px, centred; must be fully usable at 375×812; minimum 44px touch targets.
- **Theme:** primary `#008751` (Nigerian green), secondary `#f5b041` (gold), bg `#f0f4f8`, text `#1a202c`, white cards with 16px radius, gradient header, system font stack.
- **Data:** synthetic but realistic Excel data (5 sheets: Projects, Tasks, Resources, Finances, Locations — projects keyed by `ProjectID`). Health APIs need **fallback sample data** so the demo never breaks.
- **NLQ is simulated**, not a real LLM — keyword → action mapping only.
- **No external icon library** – use emoji/Unicode.
- Acceptance criteria (section 13 of spec) are the definition of done; verify charts render without console errors and export works.