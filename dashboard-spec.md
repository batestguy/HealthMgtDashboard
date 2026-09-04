# Nigeria Health + Project Management Dashboard — Detailed Spec v1.1

**Status:** Approved for build (decisions locked via interview, 5 rounds)
**Supersedes:** `healtguide.txt` (spec v1.0)
**Deliverable:** A mobile-first, multi-file static dashboard hosted on GitHub Pages, for internal team use (project managers, analysts, executives) on phone and desktop.

---

## 1. Executive Summary

A **mobile-first dashboard** combining project management (multi-sheet Excel import), live Nigerian health data (GRID3 facilities + HDX indicators), a simulated natural-language query, an interactive quiz, and export/share — all in **static files with no build step** and no backend.

### Locked decisions (interview log)

| # | Topic | Decision |
|---|-------|----------|
| 1 | File structure | **Multi-file** — `index.html` + separate `css/` and `js/` (no bundler; plain script tags) |
| 2 | v1 scope | **All 5 tabs** ship in v1 (Projects, Health, Quiz, Ask, Export) |
| 3 | Audience | **Balanced** — 5 equal tabs; no single persona dominates; info density tuned to mobile |
| 4 | Map data strategy | **On-demand by zoom** — LGA/state aggregate counts by default; detailed facility points fetched only when zoomed in |
| 5 | Excel template | **Downloadable sample `.xlsx` template** (multi-sheet) + in-app "load sample data" button |
| 6 | Key indicators | **Configurable with defaults** — a default set, user can toggle which indicators show |
| 7 | Fallback visibility | **Always-visible badge** whenever live APIs are down/not loaded and seeded data is in use |
| 8 | Quiz flow | **One question at a time**; header `Q X of Y • Batch Z` (batches of 3) |
| 9 | Quiz end | **Results screen with review** — score, %, and per-question answer review |
| 10 | NLQ depth | **Fuzzy + multi-intent** — typo tolerance, `top N`, compound queries, tab navigation |
| 11 | PNG export | **Charts + KPI cards only** (no header/nav chrome) |
| 12 | PDF export | **Full multi-tab report** (all sections in one document) |
| 13 | Theming | **Light theme only** (Nigeria green/gold); no dark mode in v1 |
| 14 | Branding | **Generic title** — "Nigeria Health + PM Dashboard" |
| 15 | Language | **English only** |
| 16 | Persistence | **Session only** — everything resets on reload; no localStorage for data |
| 17 | Sample dataset size | **Small demo set** — ~6 projects, ~20 tasks, 4 resources, 12 months of finances |
| 18 | Deployment | **Repo created now** from this workspace, populated and tracked; GitHub Pages enabled from `main`; Share Link copies the live URL |

---

## 2. Target Users

| Role | Primary Needs |
|------|---------------|
| Project Managers | Task tracker, KPIs, resource allocation |
| Healthcare Administrators | Facility maps, public/private split, indicator trends |
| Data Analysts | Excel upload, dynamic charts, NLQ exploration |
| Executives | High-level KPIs, PDF reports, quiz for knowledge check |
| General Public | Simple overview, map visualisation, educational quiz |

All personas get equal prominence (decision #3).

---

## 3. File Structure & Tech Stack

### 3.1 File layout (multi-file, decision #1)

```
/ (repo root)
├── index.html                 # App shell: header, 5 tab sections, bottom tab bar
├── css/
│   └── styles.css             # All styles (no CSS framework)
├── js/
│   ├── app.js                 # Boot, tab navigation, shared state store, renderers
│   ├── data.js                # Seeded sample data + SheetJS parsing/validation + store
│   ├── charts.js              # Chart.js v4 wrappers (bar, doughnut, line, scatter)
│   ├── map.js                 # Leaflet map + on-demand/zoom-based loading + clustering
│   ├── quiz.js                # Static + dynamic question generation, scoring, review
│   ├── nlq.js                 # Fuzzy keyword NLQ engine
│   └── export.js              # html2canvas (PNG) + jsPDF (PDF) + share link
├── assets/
│   └── sample-data.xlsx       # Pre-built multi-sheet sample workbook (downloadable)
└── tools/
    └── generate-sample-xlsx.js # One-time Node script that produces assets/sample-data.xlsx
                                # (dev-only; not part of runtime, no build step to serve)
```

Load order in `index.html`: data.js → charts.js → map.js → quiz.js → nlq.js → export.js → app.js (last, since it wires everything).

### 3.2 Libraries (CDN only, no npm at runtime)

| Library | Purpose | Version |
|---------|---------|---------|
| Chart.js | Bar / doughnut / line / scatter | v4 (current stable) |
| Leaflet + Leaflet.markercluster | Facility map + clustering | current stable |
| OpenStreetMap tiles | Basemap (free, no API key) | — |
| SheetJS (xlsx.full.min.js) | Multi-sheet XLSX parsing | current stable (CDN build) |
| html2canvas | PNG capture | current stable |
| jsPDF | PDF report | current stable |

All libs loaded via `<script src="https://cdn...">`. **No icon library** — emoji/Unicode only.

---

## 4. Data Architecture

### 4.1 Excel schema (5 sheets — source of truth for upload AND seed)

| Sheet | Required Columns | Types / Rules |
|-------|-----------------|---------------|
| **Projects** | `ProjectID`, `Name`, `Budget`, `StartDate`, `EndDate`, `Status`, `Owner`, `Region` | Budget: number (₦/$, millions). Dates: `YYYY-MM-DD`. Status ∈ {On Track, At Risk, Completed, On Hold}. Region: Nigerian state or zone. |
| **Tasks** | `TaskID`, `ProjectID` (FK), `Title`, `Assignee`, `Status`, `Priority`, `DueDate`, `Completion%` | Status ∈ {todo, in-progress, done}. Priority ∈ {low, medium, high}. Completion%: 0–100 number. |
| **Resources** | `ResourceID`, `ProjectID` (FK), `Type`, `Name`, `Cost`, `Allocation%` | Type ∈ {Person, Equipment}. Allocation%: 0–100. |
| **Finances** | `ProjectID` (FK), `Month`, `PlannedSpend`, `ActualSpend`, `Variance` | Month: `YYYY-MM`. Variance may be blank → computed = Planned − Actual. |
| **Locations** | `ProjectID` (FK), `State`, `LGA`, `Latitude`, `Longitude` | lat/lng floats; validate Nigeria bbox (lat 4–14, lng 2–15). |

**Upload validation (must-have error UX):**
- Report per-sheet results: sheet name, rows parsed, errors.
- Missing required column → sheet flagged invalid, other sheets still import; user sees a clear list of what failed and why.
- FK violations (Task without its Project) → row skipped with reason, import continues.
- Bad number/date cells → coerced or skipped with per-row warning.
- On success show filename + row count per sheet.

### 4.2 Seeded sample dataset (decision #17 — small demo set)

- **6 projects** across statuses: 2 On Track, 2 At Risk, 1 Completed, 1 On Hold; budgets ₦5M–₦120M; regions span North/South (e.g., Lagos, Kano, Abuja, Rivers, Kaduna, Enugu).
- **20 tasks** spread across projects; mix of statuses/priorities; ~5 assignees (realistic Nigerian names).
- **4 resources** (2 People, 2 Equipment) with allocation %.
- **12 months** of Finances (Planned vs Actual with some variance).
- **8–10 Locations** across ≥5 states (LGA, lat/lng inside Nigeria bbox).
- The same seed powers: in-app "Load sample data" button, the downloadable `sample-data.xlsx` (decision #5), and dynamic quiz questions.
- Generator: `tools/generate-sample-xlsx.js` (Node + `xlsx` package, dev-only). Run once, commit the `.xlsx`.

### 4.3 Health APIs

| API | Endpoint | Data | Auth | Caching |
|-----|----------|------|------|---------|
| **GRID3 NGA Health Facilities v2.0** | ArcGIS FeatureServer (keyless). Item: `a0ed9627a8b240ff8b315a84575754a4` on ArcGIS Online; org pattern `services3.arcgis.com/BU6Aadhn6tbBEdyk`. Exact layer URL verified at build time (GRID3 may rehost). CC BY 4.0. | ~51k facilities: `name`, `category`, `ownership` (Public/Private), `state`, `lga`, `lat`, `lng`, `id` | None | On-demand per zoom (see §6.2) |
| **HDX HAPI** | `https://data.humdata.org/api/...` (dataset "Nigeria – Health Indicators", `who-data-for-nga`) | Immunization coverage, vaccine-preventable diseases, and other standardized indicators | None (open data) | 1 hour in-memory cache |

**Fallback rule (decision #7):** any failed/unavailable live request falls back to seeded data, and a **badge is always visible** (e.g., "Sample data — live API unavailable") whenever fallback data is what's being displayed. Badge clears when live data loads.

---

## 5. Global UI / UX Spec

### 5.1 Layout & navigation

- Mobile-first single column, max-width 480px, centred; desktop gets the same column (optionally a wider 720px cap for charts).
- **Fixed bottom tab bar**, 5 tabs: 📋 Projects · 🏥 Health · 🧠 Quiz · 💬 Ask · 📤 Export. 44px+ touch targets, thumb-optimized.
- Header: gradient (green → darker green), white text, generic title "Nigeria Health + PM Dashboard" (decision #14).

### 5.2 Theme (decision #13 — light only)

| Element | Value |
|---------|-------|
| Primary | `#008751` (Nigerian green) |
| Secondary | `#f5b041` (gold) |
| Background | `#f0f4f8` |
| Text | `#1a202c` |
| Cards | White, subtle shadow, 16px border-radius |
| Status dots | Green (done/on track), Yellow (in-progress/at risk), Gray (todo/on hold) |
| Font | Display: **Fraunces** (Google Fonts) for KPI numerals + card headings; body: system stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) |
| Touch targets | ≥44px height for all buttons |

### 5.3 Language & branding

- **English only** (decision #15).
- Generic title, no org logo (decision #14).

### 5.4 Persistence

- **Session only** (decision #16). No localStorage/sessionStorage for data or preferences. Reload = clean slate. (Only exception: nothing — keep it zero-persistence for predictable demos.)

---

## 6. Tab-by-Tab Requirements

### Tab 1: 📋 Projects — portfolio command center (redesigned v1.2)

| Feature | Precise behavior |
|---------|------------------|
| Excel upload | Drag-and-tap area, `.xlsx`/`.xls` only. On success: filename + per-sheet row counts. On failure: per-sheet error list (see §4.1). Also: **"Load sample data"** button and **"Download sample template"** link (decision #5). |
| Project KPIs | 4 cards with icon chip, accent bar, display-font value, and a **context line** (regions covered · open tasks · x of y done · spend to date). Recomputed after upload **and on filter change**. |
| Portfolio health | Segmented status bar (On Track / At Risk / On Hold / Completed widths by count) + legend chips + dynamic summary sentence. |
| Filters | Status chips (All + each present status) and a region dropdown (union of project `Region` + `Locations` states). Filtering drives KPIs, health bar, cards, charts, and tracker. |
| Project cards | One card per project: **SVG progress ring** (avg task completion, status-colored, animated), status pill, owner • region • task count, budget, and tap-to-expand detail (spent vs planned vs budget, spend % of plan, task breakdown). |
| Project chart | Bar chart, avg completion % per project, bars colored by status. |
| Spend vs plan | Grouped monthly bar chart of planned vs actual spend across the filtered portfolio (hidden when no finance rows). |
| Task charts | Doughnut of task statuses + horizontal bars of task priorities (side-by-side on ≥360px). |
| Resource chart | Horizontal cost bars per resource (Person teal / Equipment green) + total; hidden when no resource rows. |
| Task tracker | Status dot, title, **priority chip**, project tag, assignee • due date (overdue flagged red), thin progress bar, %. Sorted by status then due date. |

### Tab 2: 🏥 Health

| Feature | Precise behavior |
|---------|------------------|
| Health KPIs | 4 cards: Total Facilities · States Covered · Public Facilities · Private Facilities (computed from loaded GRID3 data or fallback seed). |
| Facility map | Leaflet + OSM. **On-demand loading (decision #4):** default view shows **state/LGA aggregate counts** (markers sized by count, labeled); when the user zooms past a threshold (e.g., zoom ≥ 8) or taps an aggregate, fetch the detailed points inside the current bbox from the FeatureServer (`outFields` = name, category, ownership; `returnGeometry` with `where` on bbox) and render with marker clustering. Cache fetched tiles/points in memory for the session. |
| Facility type chart | Doughnut: PHC, General Hospital, Teaching, Clinic, etc. (from `category` field). |
| Indicator trends | Line chart from HDX (e.g., immunization coverage 2015–2025). 1h cache. |
| Key indicators | **Configurable list with defaults (decision #6):** default set = beds/10k · doctors/10k · immunization coverage · malaria prevalence · maternal mortality. Checkboxes persist for the session only. |
| Refresh button | Manually re-fetch live GRID3 + HDX; updates badge accordingly. |
| Fallback badge | Always visible when seeded data is displayed (decision #7). |

### Tab 3: 🧠 Quiz

| Feature | Precise behavior |
|---------|------------------|
| Delivery | **One question at a time** (decision #8). Header: `Q X of Y • Batch Z` — batches of 3 questions (Q1–3 = Batch 1, Q4–6 = Batch 2, …). |
| Pool | 10–12 questions per session: **5 static** (hard-coded Nigeria health/PM trivia) + **5–7 dynamic** generated from loaded Excel data. If no Excel data is loaded, dynamic questions come from the seeded sample. |
| Question display | 4 multiple-choice options; 1 correct. On tap: all buttons disabled; correct highlighted green, chosen-wrong highlighted red. |
| Feedback | Instant "Correct/Wrong" message; correct answer shown when wrong. |
| Score | Running `5/10` display in header. |
| Navigation | Next → proceeds; Reset → restarts (new randomized pool). |
| End (decision #9) | **Results screen:** final score, percentage, pass/warn message, and a **review list** — every question with user's answer vs correct answer. |

**Dynamic question templates:**
- "What is the budget for [Project Name]?" — distractors: budgets of 3 other projects.
- "How many tasks are assigned to [Assignee]?" — numeric-range options.
- "What is the total planned spend for [Project]?" — 4 numeric options.

### Tab 4: 💬 Ask (NLQ) — simulated

**Engine (decision #10 — fuzzy + multi-intent):**

1. **Normalize:** lowercase, strip punctuation, split into tokens.
2. **Fuzzy match:** each token compared against the keyword vocabulary with Levenshtein distance ≤ 1–2 (typo tolerance, e.g., "showw" → "show", "lagis" → "lagos").
3. **Intent detection** (first match wins per category, intents compose):

| Category | Keywords / aliases | Action |
|----------|--------------------|--------|
| display | show, list, display, view | Filter data + refresh charts |
| rank | top, highest, max, most | Sort and show top N (default 3; `top N` parsed) |
| state | all 36 states + FCT (+ common aliases: "lag", "katsina"…) | Filter projects/facilities by state |
| finance | budget, cost, spend | Highlight financial KPIs, show budget summary |
| task | tasks, assignee, due, priority | Focus task tracker |
| health | facilities, health, hospital, clinic | Switch to Health tab + filter |
| aggregate | count, total, average, how many | Compute aggregate and answer numerically |

4. **Multi-intent (compound):** split on connectors (`and`, `also`, `,`) and run intents in sequence — e.g., "show top 3 tasks in lagos" → display + rank(N=3) + state(Lagos) + task. "How many facilities in kano" → aggregate + health + state(Kano) + answer in text.
5. **Response:** answer paragraph updates; KPIs/charts/tab reflect the action; example chips persist for one-tap reuse.

**Minimum acceptance set (≥10 combos):** show projects · list tasks · top 3 tasks · highest budget · projects in Lagos · facilities by state · how many tasks for [assignee] · total planned spend for [project] · show facilities · top 5 projects by completion · tasks due this month · show public facilities in Kano.

### Tab 5: 📤 Export

| Feature | Precise behavior |
|---------|------------------|
| **PNG** (decision #11) | html2canvas captures **charts + KPI cards only** (hidden header/tab chrome), at 2× scale for retina. Filename: `dashboard-YYYY-MM-DD.png`. |
| **PDF** (decision #12) | jsPDF full multi-tab report: title/date header → project KPIs + task summary + project chart → health KPIs + facility-type doughnut + indicator trends + key indicators table → quiz score summary → latest NLQ answer. Charts embedded via canvas→JPEG. Filename: `dashboard-report-YYYY-MM-DD.pdf`. |
| **Share link** | Copies `https://{username}.github.io/{repo}/` to clipboard (`navigator.clipboard` with `execCommand` fallback), toast "Link copied". |

---

## 7. Performance & Quality Budget

- Initial load < 3s on 4G; no console errors (must-pass).
- Lazy/deferred script loading; charts only initialize when their tab first opens.
- Map: never block UI on the 51k-facility fetch — aggregates first, points on demand (§6.2).
- All chart instances destroyed/recreated on data change to avoid Chart.js leaks.

---

## 8. Deployment (decision #18) — status: in progress

- **Repo:** `batestguy/HealthMgtDashboard` — created 2026-09-04, `main` branch, public (https://github.com/batestguy/HealthMgtDashboard).
- **GitHub Pages:** enabled, deploy from `main` at root. **Live URL: `https://batestguy.github.io/HealthMgtDashboard/`** (this is the Share Link the Export tab copies). First `index.html` committed 2026-09-04 — the live site now serves the dashboard shell + Projects tab.
- All libraries stay on CDN (no build artifacts to commit beyond source + `assets/sample-data.xlsx`).
- Verify live URL works on iPhone (Safari) and Android (Chrome) before sign-off (testing devices: **both available**).
- (Optional later) `CNAME` for custom domain.

---

## 9. Acceptance Criteria (v1 sign-off)

**Must-pass (locked in interview):**
- [ ] Excel upload works with complex multi-sheet files (Projects/Tasks/Resources/Finances/Locations), with per-sheet error reporting.
- [ ] Health data (GRID3 aggregates + HDX indicators) loads within 3s or gracefully falls back with visible badge.
- [ ] Map clusters correctly and loads facility points on demand by zoom.
- [ ] Quiz shows a mix of static and dynamic questions; results screen with review.
- [ ] NLQ understands ≥10 keyword combos including fuzzy/typo tolerance and multi-intent queries.
- [ ] Fully usable on a 375×812 phone (44px targets, bottom tabs).
- [ ] All charts render without console errors.

**Nice-to-have (still implemented):**
- [ ] PNG/PDF export generates valid downloadable files.

**Test matrix:** iPhone (Safari), Android (Chrome), Desktop (Chrome/Edge/Firefox) — full 5-tab walkthrough on each.

---

## 10. Future Phases (explicitly out of v1)

| Phase | Feature |
|-------|---------|
| Phase 2 | Real LLM NLQ (OpenAI/Gemini) replacing the simulated engine |
| Phase 3 | Lightweight Node backend to proxy MCP calls (Power BI/Tableau live data refresh) |
| Phase 4 | Dark mode; user auth to save quiz scores/preferences |
| Phase 5 | Push notifications for project deadlines / health alerts |
| Phase 6 | Custom domain via CNAME |

---

## 11. Open Items (resolve at build start)

1. ~~Exact GRID3 FeatureServer layer URL~~ — **resolved:** `https://services3.arcgis.com/BU6Aadhn6tbBEdyk/arcgis/rest/services/GRID3_NGA_health_facilities_v2_0/FeatureServer/0`. Verified live 2026-09-04: 51,022 facilities, keyless, WGS84; group-by works on `state`, `ownership`, `facility_level_option`.
2. ~~Exact HDX HAPI query params~~ — **resolved (partial):** `https://hapi.humdata.org/api/v1/indicators` requires an app registration (`X-App-Identifier` header alone returns 403). The app attempts HDX live and falls back to seeded indicators with the badge; revisit if an app identifier is ever registered.
3. ~~Repo name~~ — **resolved:** `batestguy/HealthMgtDashboard`; live URL `https://batestguy.github.io/HealthMgtDashboard/`.
4. **Fuzzy tolerance level** — start at Levenshtein ≤ 2 for keywords, ≤ 1 for state names; tune against the ≥10-combo acceptance set.

## 12. Already-Done Log

- 2026-09-04 — Repo initialized (commit `dbbea06`): `dashboard-spec.md`, `healtguide.txt`, `knowledge.md`, `.gitignore`, `.agents/` scaffolding.
- 2026-09-04 — Seeded sample workbook shipped (commit `d398a25`): `assets/sample-data.xlsx` (6 projects / 20 tasks / 4 resources / 72 finance rows / 10 locations) generated deterministically by `tools/generate-sample-xlsx.js` (`npm run generate:sample` in `tools/`).
- 2026-09-04 — GitHub Pages enabled from `main`; live URL `https://batestguy.github.io/HealthMgtDashboard/`.
- 2026-09-04 — **App shell + Projects tab shipped.** Files: `index.html`, `css/styles.css`, `js/data.js` (SheetJS multi-sheet parse + per-sheet validation + sample loader), `js/charts.js` (Chart.js v4 wrapper, destroy-on-recreate), `js/app.js` (tabs, upload/drag-drop/sample/template, KPIs, tracker, chart, summary).  Upload validation verified in a Node harness: good workbook parses 6/20/4/72/10; broken file reports missing columns, non-numeric cells, FK violations, out-of-bbox coordinates, and keeps prior data. Health/Quiz/Ask/Export tabs are visible placeholders pending their build steps.
- 2026-09-04 — **Live render verified in real Chrome (headless).** Captured at 375×812 and desktop from `https://batestguy.github.io/HealthMgtDashboard/`: KPIs show 6 projects / 20 tasks / 25% / ₦335M, upload report reads "sample-data.xlsx — parsed", Chart.js drew the progress canvas, the summary line reads "2 on track, 2 at risk, 1 completed, 1 on hold.", and all 20 tracker rows render sorted (in-progress → todo → done by due date). Screenshots + DOM dump kept locally in `output/playwright/` (gitignored). Acceptance #1, #6, #7 browser-verified; full §9 sign-off still needs the on-device matrix (iPhone/Android/desktop).
- 2026-09-04 — **Projects tab redesigned** ("portfolio command center"): Fraunces display type, KPI cards with context lines, portfolio-health segmented bar, status + region filters, expandable project cards with animated SVG progress rings, and five charts (progress bar, monthly spend vs plan, task-status doughnut, priority bars, resource allocation). Grounded in Linear's dashboard best-practices (context not bare numbers, glanceable density, surface at-risk work) and common PM-portfolio patterns (rings, status segmentation, drill-down). Verified headlessly at 375px: all 6 cards, rings, filters, charts render with zero errors; screenshot in `output/playwright/projects-v2.png`.
- 2026-09-04 — **Health tab shipped.** Files: `js/health-data.js` (GRID3 FeatureServer provider + HDX HAPI attempt + deterministic seeds + state centroids), `js/map.js` (Leaflet aggregates + zoom-8 bbox point loading with marker clusters), `js/health.js` (KPIs, doughnut, trend lines, configurable key indicators, refresh, fallback badge), plus `doughnut`/`line` helpers in `charts.js`, Leaflet/markercluster CDNs, and deep-link tabs (`#health`). Verified in a Node harness (seeds deterministic; stubbed-fetch live path parses group-bys, bbox points cache) and in headless Chrome against **live GRID3**: KPIs 51,022 facilities / 37 states / 34,680 public / 11,716 private, all 37 state circles drawn on OSM tiles, both charts rendered, HDX indicator fallback badge shown. Acceptance #2 browser-verified (live GRID3 + graceful HDX fallback); #3 needs a zoom interaction check on a device.