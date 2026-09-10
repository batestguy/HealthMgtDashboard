# Nigeria Health + Project Management Dashboard — Detailed Spec v1.1

**Status:** Approved for build (decisions locked via interview, 5 rounds)
**Supersedes:** `healtguide.txt` (spec v1.0)
**Deliverable:** A mobile-first, multi-file static dashboard hosted on GitHub Pages, for internal team use (project managers, analysts, executives) on phone and desktop.

---

## 1. Executive Summary

A **mobile-first dashboard** combining project management (multi-sheet Excel import), live Nigerian health data (GRID3 facilities + HDX indicators), a simulated natural-language query, a recruiter-facing project showcase, and export/share — all in **static files with no build step** and no backend.

### Locked decisions (interview log)

| # | Topic | Decision |
|---|-------|----------|
| 1 | File structure | **Multi-file** — `index.html` + separate `css/` and `js/` (no bundler; plain script tags) |
| 2 | v1 scope | **All 5 tabs** ship in v1 (Projects, Health, 🚀 showcase, Ask, Export) — Quiz retired 2026-09-05 (showcase-spec.md) |
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

### Tab 3: 🚀 This Project — recruiter showcase

**Retired the Quiz tab 2026-09-05.** Full spec in `showcase-spec.md` (decisions S1–S14): hero + evidence-based radar, feature→skill cards with Try-it deep links, toolchain chips (repo-proven + adjacent), copy-email + GitHub CTAs, default landing tab, Quiz code deleted repo-wide.

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
- **GitHub Pages:** enabled, deploy from `main` at root. **Live URL: `https://batestguy.github.io/HealthMgtDashboard/`** (this is the Share Link the Export tab copies). First `index.html` committed 2026-09-04 — the live site serves the dashboard shell with Projects, Health, 🚀 showcase, and Ask built (Export pending).
- All libraries stay on CDN (no build artifacts to commit beyond source + `assets/sample-data.xlsx`).
- Verify live URL works on iPhone (Safari) and Android (Chrome) before sign-off (testing devices: **both available**).
- (Optional later) `CNAME` for custom domain.

---

## 9. Acceptance Criteria (v1 sign-off)

**Must-pass (locked in interview):**
- [x] Excel upload works with complex multi-sheet files (Projects/Tasks/Resources/Finances/Locations), with per-sheet error reporting.
- [x] Health data (GRID3 aggregates + HDX indicators) loads within 3s or gracefully falls back with visible badge.
- [ ] Map clusters correctly and loads facility points on demand by zoom. — **partial**, see note.
- [x] 🚀 showcase renders (hero stats, evidence radar, feature→skill cards, copy-email, default landing). Quiz retired.
- [x] NLQ understands ≥10 keyword combos including fuzzy/typo tolerance and multi-intent queries.
- [x] Fully usable on a 375×812 phone (44px targets, bottom tabs). — see §9.1; two documented exemptions.
- [x] All charts render without console errors.

**Nice-to-have (still implemented):**
- [x] PNG/PDF export generates valid downloadable files.

**Test matrix:** iPhone (Safari), Android (Chrome), Desktop (Chrome/Edge/Firefox) — full 5-tab walkthrough on each. **Not done:** the ticks below are a Chrome pass (desktop + 375×812 device emulation) only. Emulation is not a device — tap accuracy, thumb reach, Safari/Firefox rendering and Leaflet pinch-zoom still need the physical matrix.

### 9.1 Evidence for the ticks (2026-09-08, Chrome, localhost + live Pages)

| Row | Result | Evidence |
|---|---|---|
| Excel multi-sheet | pass | `loadSample()` → 6 projects / 20 tasks / 4 resources / 72 finance rows / 10 locations, per-sheet report object present. Broken-file error reporting was verified in the 2026-09-04 Node harness and was **not** re-run in this pass. |
| Health ≤ 3s or badge | pass | Facility aggregates 1,071 ms (live GRID3, 51,022), indicators 1,790 ms. Badge read `Live GRID3 facilities • Sample indicators (fallback)` — the mixed live/fallback case, which is the one that matters. |
| Map clusters / zoom | partial | 36 state circles, OSM tiles, marker-cluster elements all present. Could not cleanly exercise the zoom-8 on-demand point path: `renderAggregates()` re-fits to Nigeria (`fitBounds`, `minZoom` 5), so a programmatic `setView(…, 9)` snaps back to 6. Needs a real pinch-zoom pass. |
| Showcase | pass | Radar chart live at 1702×390; `batesthommie@gmail.com` present in the panel. Lands by default; `#quiz` falls back. |
| NLQ | pass | All 12 examples answered from real data — e.g. `highest budget` → "Abuja EMR System Rollout … ₦120M", `how many tasks are assigned to Amina` → "4 tasks", `show public facilities in Kano` → "1,493 public facilities" (live GRID3). Typos recovered: `showw all projcts` and `budgt for lagis` → "₦83.3M". Gibberish correctly falls through to the "I didn't catch that" prompt. |
| 375×812 phone | pass | No horizontal overflow on any of the five tabs (scrollWidth == clientWidth == 375). The 30 sub-44px targets found on 2026-09-08 are fixed (`.chip` and `.btn-sm` 36→44, indicator labels 21→44, Leaflet zoom 30→44, `.icon-btn` 40→44, `.brand` 39→44); the §9.2 legend overprint is fixed. Re-audited by measuring every `button, a[href], input, select, textarea, label[for], [role=button]` on all five tabs. **Two remaining sub-44px elements, both exempt:** the Leaflet/OpenStreetMap attribution links (43×11 and 71×11) are inline links inside a sentence, which WCAG 2.5.8 explicitly excepts and which may not be removed for licensing reasons; and the five indicator checkboxes render at 24×24, but their `<label for>` now stretches an invisible overlay across the whole 44px row, so the *effective* target — verified by `elementFromPoint` and by clicking at the row's left edge, middle and far-right edge — is the full row. |
| Charts, no console errors | pass | All five Projects charts (`chart-progress`, `chart-finance`, `chart-task-status`, `chart-priority`, `chart-resources`), both Health charts, and the Showcase radar are live instances. Zero console errors across a full five-tab walkthrough. |
| PNG/PDF download | pass | Verified on the deployed site: PDF 4 pages with all three charts embedded (capture log `100691` / `74363` / `106711` bytes); PNG a real 2.3 MB file. Note Chrome blocks a *second* automatic download from one page without permission, and `export.js` cannot observe that — it still reports "PNG downloaded". |

### 9.2 Resolved — Health legend overprinted the credit line at narrow widths (fixed 2026-09-08)

At 375px the bespoke Health trend legend wrapped to two lines and painted on top of the source-attribution paragraph below the card:

| Element | Before (px) | After (px) |
|---|---|---|
| `.hl-label` "DPT3 immunization coverage (%)" | 2371–2388 | 2331–2347 |
| `p.credit` "Facilities: GRID3 …" | **2385–2417** | 2417–2448 |
| `.hl-label` "Malaria prevalence, under-5 (%)" | 2406–2422 | 2365–2381 |

Cause: `renderHealthLegend()` appends the legend into `host.parentNode`, which is `.chart-wrap.chart-wrap-tall` — a **fixed-height** box sized for the canvas alone. The legend therefore rendered outside its parent's box and reserved no space. On a wide screen the legend is one line and the slack hid it; at 375px it is two lines and spilled.

Fixed in CSS only — `renderHealthLegend()` is the protected legend path (§4.6 of `redesign-spec.md` records six commits spent on it) and is untouched. `#tab-health .chart-wrap-tall` now reserves a `--hl-band` padding band and the legend is absolutely positioned into it.

**The obvious fix was wrong and is worth recording.** Letting the wrapper grow (column flex, `height: auto`, canvas pinned by `flex: 0 0 280px`) looks correct by every visible measure — legend inside the box, no overlap, canvas still 280px — but Chart.js sizes its backing store from the canvas's **parent**, so it allocated a 344px surface and squashed it into the 280px box: the chart drew ~19% vertically compressed and pointer hit-testing drifted by the same amount. The tell is `canvas.height`, which read 1041 where `280 × devicePixelRatio` = 840. Keeping the wrapper's *content* box at exactly 280px and pushing the legend into padding keeps them in agreement. **Assert `canvas.height === canvasCssHeight * devicePixelRatio` when changing any chart wrapper** — the visual check alone passes on a broken layout.

Known limitation: the band is a fixed 64px, sized for the two-line wrap the two-series legend reaches at 375px (59px measured). A third series would need a taller band.

### 9.3 Resolved — Health tab showed three source indicators, two of which contradicted each other (found 2026-09-10, fixed 2026-09-10)

On the deployed site the Health tab rendered the amber **"Sample data — live source unavailable"** badge while `PMHealthData.currentAggregates().source === 'live'`. Only the HDX indicators had fallen back; the GRID3 facility aggregates were live. At the same moment the header pill read **"LIVE DATA"** and the source line correctly read *"Live GRID3 facilities • Sample indicators (fallback)"*.

So a visitor saw three status indicators for one mixed live/fallback state, and two of them disagreed. The source line was the one that was right. The amber badge was driven by "did *anything* fall back?" rather than by which feed actually did.

This is the case §9.1 calls "the mixed live/fallback case, which is the one that matters", so getting the badge wrong here cost more than it would in the all-live or all-fallback case — and it is the *normal* case, because §11.2 records that HDX 403s without an app registration.

**Cause.** The two feeds fail independently, so there are four states, but `renderSourceState()` collapsed them onto two booleans computed separately — `anySample = !facLive || !indLive` drove the badge, `anyLive = facLive || indLive` drove the pill. In the mixed case both are true, so both fired. The badge text compounded it by being a fixed string in `index.html` that named neither feed.

**Fix.** A single `sourceState(facLive, indLive)` helper returns the badge text, the pill label and the pill's live flag for all four states, so every indicator is derived from one decision and they cannot disagree. The badge now names the feed that fell back:

| facilities | indicators | Badge | Header pill |
|---|---|---|---|
| live | live | *(hidden)* | Live data |
| live | sample | Sample indicators — live HDX unavailable | Partly live |
| sample | live | Sample facilities — live GRID3 unavailable | Partly live |
| sample | sample | Sample data — live sources unavailable | Sample data |

The same bug had a second instance the original report missed: the refresh toast read `agg.source === 'live' ? 'Live GRID3 + HDX' : …`, testing the facilities source alone and so claiming live HDX over fallback indicators. It now reports the same label as the pill.

Verified at 375×812 and 1440×900 by stubbing both loaders and driving all four states through the refresh button: badge, pill and source line agree in every one; toast reads "Refreshed — Partly live"; "PARTLY LIVE" fits the header at 375px (chip 104px, right edge 307 of 375) and the badge stays on one line; no horizontal overflow on any of the five tabs; `chart-indicator-trends` backing store still 840 == 280 × DPR 3 and the legend/credit clearance still 36px. The only console errors are the expected HDX CORS/fetch failure that *is* the fallback path. Cache-bust `?v=14` → `?v=15`.

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
- 2026-09-04 — **Eyeball render of redesigned Projects tab on the live site.** Captured the deployed `https://batestguy.github.io/HealthMgtDashboard/` in headless Chrome at phone (375×812), full-page mobile (390×5600), and desktop (1280×900). Confirmed: KPI cards with context lines and Fraunces numerals, portfolio-health segmented bar + legend, status chips + region dropdown, six project cards with colored progress rings and expandable details, all five charts drawn, and the tracker with priority chips / project tags / overdue flags — zero console errors. Screenshots kept in `output/playwright/` (gitignored). Caveat logged: headless renders at phone dimensions are not a physical-device pass; tap targets, thumb reach, and Leaflet zoom still need the on-device matrix.
- 2026-09-04 — **Quiz tab shipped.** Files: `js/quiz.js` (5 static Nigeria health/PM trivia + up to 7 dynamic questions generated from the loaded dataset — budget, highest-budget, total planned spend, tasks-per-assignee, projects-per-status templates; option-shuffled so the correct answer isn't position-predictable), one-at-a-time flow with `Q X of Y • Batch Z` progress (batches of 3), instant right/wrong feedback with the correct answer shown, running `score/total` in the card header, Reset (new randomized pool), and a results screen with an animated score ring, pass/warn/fail verdict, and per-question review (user answer vs correct answer + topic tag). Quiz falls back to the seeded sample when no Excel data is loaded. Verified in a Node harness (pool composition 5+7, answer correctness recomputed independently for every dynamic template, option uniqueness across repeated shuffled runs, static-only fallback on an empty dataset) and in headless Chrome: a DOM drive page exercised the real module end-to-end — start → answer → feedback → results → review → restart (14/14 checks, `QUIZ_DRIVE_OK`), and the live `index.html#quiz` deep-link renders the start screen with zero console errors. Screenshot in `output/playwright/quiz-live.png`.
- 2026-09-04 — **Health tab shipped.** Files: `js/health-data.js` (GRID3 FeatureServer provider + HDX HAPI attempt + deterministic seeds + state centroids), `js/map.js` (Leaflet aggregates + zoom-8 bbox point loading with marker clusters), `js/health.js` (KPIs, doughnut, trend lines, configurable key indicators, refresh, fallback badge), plus `doughnut`/`line` helpers in `charts.js`, Leaflet/markercluster CDNs, and deep-link tabs (`#health`). Verified in a Node harness (seeds deterministic; stubbed-fetch live path parses group-bys, bbox points cache) and in headless Chrome against **live GRID3**: KPIs 51,022 facilities / 37 states / 34,680 public / 11,716 private, all 37 state circles drawn on OSM tiles, both charts rendered, HDX indicator fallback badge shown. Acceptance #2 browser-verified (live GRID3 + graceful HDX fallback); #3 needs a zoom interaction check on a device.
- 2026-09-05 — **Render speed + map framing fixes.** (1) The Google Fonts stylesheet was render-blocking — `index.html` now loads Fraunces non-blocking (`media="print"` + `onload` swap + `<noscript>` fallback) so the page paints with the system fallback face immediately and swaps when the webfont arrives. (2) `js/map.js` now pins the map to Nigeria: `minZoom: 6` plus a padded-country `maxBounds` (`[[2.5,1.0],[15.0,15.5]]`) with `maxBoundsViscosity: 0.8`, and the initial view is `[9.0, 8.0]` at zoom 6 — the basemap can no longer zoom out to all of Africa (which was fetching hundreds of tiles — the slowness — and rendering continent clutter). Point clusters still appear on zoom to level 8+. Verified: map initializes cleanly under the new options in a real-browser probe, and a fresh headless render of `#health` captures with tiles drawn (screenshot `output/playwright/map-nigeria.png`).
- 2026-09-05 — **Quiz retired; 🚀 showcase shipped** (commit `1480515`, per `showcase-spec.md` S1–S14). Quiz markup, `js/quiz.js`, quiz CSS, and the 🧠 tab button deleted; tab 3 is now the recruiter-facing showcase (hero stats, evidence-based capability radar via new `PMCharts.radar`, feature→skill cards with Try-it deep links into Projects/Health, toolchain chips, copy-email + GitHub CTAs). The app lands on the showcase by default; dead `#quiz` hashes fall back to it. Follow-ups: map reframed to show all of Nigeria including the southern states (`59c1313` — `fitBounds` + `minZoom` 5, re-fit on render), state-circle sizes shrunk (`9b684f0` — sqrt·0.15, 18px cap), and local assets cache-busted with `?v=` (`d8919a5`, bumped to v4) because Pages caches ~10 min.
- 2026-09-05 — **Ask (NLQ) tab shipped.** `js/nlq.js`: simulated fuzzy multi-intent engine — Levenshtein-based typo tolerance (allowed distance scales with token length so 3–4-letter filler words can't false-match the vocabulary), intents compose (display · rank · aggregate · finance · task · health), entities resolved from the loaded dataset (36 states + FCT with aliases, assignees, project names/IDs, `top N`, `this month`, public/private ownership), and actions drive the real dashboard through new `PMApp` APIs (`goto`, `setProjectFilters`, `loadSample`). Health answers use live GRID3 count queries with a seeded fallback (`countFacilitiesInState`). 12 example chips cover the §6 acceptance set. Verified with a Node harness against the real sample workbook: **17/17 checks** (all 12 acceptance combos + typos `showw`/`lagis`/`budgt` + compound "top 3 tasks in lagos" + gibberish fallback). The matcher caught two real bugs during the harness run: `levenshtein` returned distances above the allowed bound, and short tokens over-matched — both fixed.
- 2026-09-07 — **PDF report charts fixed (they had never rendered); chart restyle + copy-lock.** The multi-section report had shipped chartless across four commits without a single console error. Four faults compounded: `js/pdf.js` `chartInstance()` read `PMCharts._registry`, which `js/charts.js` keeps module-local and never exported, so every `chartJpeg()` returned `null`; `buildPdf()` called `PMCharts.destroyAll()` before capturing; it then repainted only the tab named by `PMApp.activeTabName`, which was *also* unexported, so `active` silently fell back to `'showcase'`; and `.tab-panel { display: none }` leaves hidden panels' canvases with zero layout anyway — the PDF button lives on Export, so Projects and Health are always hidden at capture time. The failure was invisible because the fallback is a faint styled line ("…chart — no data rendered yet."), not an error. Rebuilt rather than patched: `js/pdf.js` now renders its **own** `pdfcap-progress` / `pdfcap-facilities` / `pdfcap-trends` canvases into a fixed-size offscreen stage (`#pdf-stage`, `position: fixed; left: -10000px` — deliberately not `display: none`, which would capture blank) using the new `PMCharts.withThemeScope(el, fn)` (repoints `token()` at the stage, so `data-theme="light"` forces the paper palette with no flash on the live page) and `PMCharts.get(id)` (public instance accessor replacing the private-registry reach). Capture-time animation is forced off (`animation()`) so `toBase64Image` reads a finished canvas, and each JPEG is composited over the paper card color first because JPEG has no alpha and a transparent canvas prints on black. All three images are captured once up front and handed to `buildDocument(shots)`; each logs `[pdf] capture <id>: <n> bytes` / `null` / `skipped (no data)` via `console.info` so a silent regression is visible in the console. Data sourcing mirrors the live renderers exactly (`app.js renderProgressChart`, `health.js renderTypeChart`/`renderTrendChart`); the existing "no data rendered yet" lines stay for sections that genuinely have none (no workbook loaded, Health tab never opened). Supporting fixes in `js/charts.js` + `css/styles.css`: the light token block is scoped `:root, [data-theme="light"]`, `PALETTE` became `palette()` (the module-load array froze light hexes in dark mode), and `gridAxes()` merges overrides per axis instead of replacing them. Shipped `redesign-spec.md` §4.6's chart restyle at the same time (gradient bar/hbar/grouped fills with the leading bar in gold, chartArea-aware under-line wash, doughnut centre label + 4px gaps, dashed hairline y-grid) — the bespoke Health trend legend, `healthTrendColors()`, and the line chart's `legend: { display: false }` path are untouched by design. `js/showcase.js` `EMAIL` moved from `you@example.com` to `batesthommie@gmail.com`, closing the last `showcase-spec.md` §7 copy-lock row. `index.html` cache-bust `?v=10` → `?v=11`. **All of that capture work was unreachable, though: the button had never produced a file.** `js/pdf.js` tested `typeof jsPDF === 'undefined'` and called `new jsPDF(...)`, but the `jspdf@4.2.1` UMD bundle attaches only `window.jspdf` (constructor at `window.jspdf.jsPDF`), so the guard always fired and `buildPdf()` never ran — which is why commit `a6c7ec2` ("load jsPDF from the CDN") did not fix the button: it added the `<script>` and left the wrong global. Behind that, `pdf.on('pageAdded', …)` threw (jsPDF has no `.on()` and no `pageAdded` event — the real API is `internal.events.subscribe`) after every section was drawn but before `pdf.save()`, hanging the status on "Building PDF report…". Both are now gone: a `jsPDFCtor()` resolver called at click time (tolerates `window.jspdf.jsPDF` and a bare `jsPDF`, since the `<head>` script may still be loading when the module is evaluated) and the `pdf.on` block deleted — the manual footer loop it shadowed was already correct and is the right approach, because "Page i of N" needs the final page count. Third fault found in the same pass: the footer printed the dateline and the contact line at the identical `(margin, pageH - 5)` coordinate, overprinting on every page; the contact moved to its own line at `pageH - 9` and the project-table page break moved from `pageH - 12` to `pageH - 18` so the last zebra row can't run under it. The v1 §9 "PNG/PDF export generates valid downloadable files" row stays unchecked pending a browser walkthrough.
- 2026-09-08 — **PDF report browser-verified end-to-end; PNG export was never wired at all.** With the button finally reaching `pdf.save()`, four rendering defects became visible in the actual file and were fixed. (1) The footer contact line at `pageH - 9` still overprinted the health section's trailing caption, rendering `Sourceatesthommie@gmail.com://hapi.humdata.org)`; the ad-hoc `pageH - 5` / `-9` / `-12` / `-18` magic numbers are replaced by a single reserved band, `FOOTER_H = 14` → `contentBottom = pageH - FOOTER_H`, with a `needSpace(h)` helper that every section calls before drawing and both footer baselines derived from `contentBottom` rather than written independently. (2) jsPDF's built-in Helvetica/Courier use **WinAnsiEncoding**, which has no `₦` (U+20A6) or `Σ` (U+03A3) — they printed as `¦` and `£`, so page 1 read `Currency (¦)` and every budget figure was wrong. PDF-bound strings now spell `NGN ` (new `fmtNaira` variant local to `js/pdf.js`) and write sums out in words; the on-screen formatters in `js/app.js`/`js/charts.js` keep `₦`, since canvas and HTML have no such limit. `— · … ÷ × – §` are all in WinAnsi and are used freely. (3) Bare `pdf.text()` calls overflowed the right margin; captions now reserve their **post-wrap** height via `bodyH()` + `needSpace()`, KPI card captions wrap and step down a font size (`cardCaption()`), and long project names / indicator labels truncate on measured `getTextWidth()`. (4) The `1 · Methodology` card on page 1 drew a hardcoded 40 mm box around copy that wraps to roughly twice that, so the bottom border cut through the last three paragraphs; the card is now measured from the wrapped text and sized to fit. Also fixed a font-state leak: `body()` and `bodyH()` set `helvetica/normal` explicitly, because jsPDF's font state is global and the `courier/bold` used for key-indicator values leaked into the following caption — changing both its typeface and, via `bodyH()`, the height reserved for it. Verified by generating the report in Chrome and parsing the output: 4 pages, all three charts embedded (1920×812, 1280×800, 1920×808) with cream `rgb(254,253,248)` corners rather than black, zero `¦`/`£`, no body span below the footer band on any page, no span past the content column, and the methodology card enclosing its text with ~11 pt padding. **Separately, `js/export.js` had called `html2canvas` since the Export tab shipped, but `index.html` never carried the `<script>` tag** — the `typeof html2canvas === 'undefined'` guard reported "PNG library did not load from CDN", which reads as a CDN outage rather than a missing tag, so the PNG button had never worked either. This is the same failure shape as the jsPDF global bug and the `_registry` bug: a graceful fallback that made a hard failure look like a soft one. Added `html2canvas@1.4.1` to the `<head>` library block and verified a real 148 KB PNG downloads with zero console errors. Dropped the meaningless `?v=10` from the pinned jsPDF CDN URL (the cache-bust convention is for local `css/`+`js/` only). Acceptance §9 "PNG/PDF export generates valid downloadable files" now passes.
- 2026-09-08 — **Theme toggle no longer strands the charts on hidden tabs.** Switching theme while a chart tab was *not* the visible one destroyed its charts permanently. `applyTheme()` calls `PMCharts.destroyAll()` — correctly, since charts bake theme tokens in at draw time — but then repainted only the active tab, and re-opening the stranded tab was a no-op because `PMHealth.init()` / `PMShowcase.init()` are guarded by an `initialized` flag. The canvas sat at its unsized 300×150 default with no chart attached, and nothing short of a page reload brought it back. Repro (live site, before the fix): open Health → switch to Projects → toggle theme → return to Health. Fix: `applyTheme()` now flags the non-active chart tabs in a module-local `staleCharts` map, and `activateTab()` repaints a flagged tab once its panel is laid out — hidden panels are `display: none`, so they genuinely cannot be repainted in place. `repaintActive()` was split into `repaintTab(name)` + a thin `repaintActive()`. The `staleCharts` declaration sits above `activateTab()` rather than next to `applyTheme()` on purpose: `init()` is invoked partway through the IIFE and calls `activateTab()` synchronously when the DOM is already parsed, so a declaration further down would be hoisted-but-`undefined` and throw on the first tab activation. Verified for all three chart tabs (Health doughnut + trend, Projects progress, Showcase radar): charts return at full size (1702×390) across two consecutive theme round-trips, and they genuinely restyle rather than merely re-exist — the Projects y-grid token moves `#efe8d8` → `#1e2e25`. Zero console errors. Cache-bust `?v=11` → `?v=12`.
- 2026-09-08 — **PDF polish, and a chart accent that was overwriting real meaning.** Three fixes from a close read of the generated report. (1) The Health section showed a `51k` Facilities KPI directly above a doughnut whose centre read `46.1k facilities`, with nothing reconciling them — the six GRID3 levels genuinely do not cover every row. The level caption now states the reconciliation using **exact** counts (`46,113 of the 51,022 … remaining 4,909 carry no facility_level_option value`) via a new `groupNum()` helper, and explicitly distinguishes that subset from the ownership split, which excludes the *Unknown-ownership* rows and is a different 46k. `fmtMetric()` is deliberately not used here: rounding to "46k + 5k = 51k" beside a "46.1k" chart label reintroduces the mismatch the sentence exists to explain. (2) **`bar()` was silently reporting the wrong project status.** §4.6's "leading bar switches to gold" flourish applied unconditionally, so the highest-completion project always painted gold — Kaduna at 100% rendered gold while its actual status is "Completed" (green), on screen *and* in the PDF, wherever bar color is the status encoding. New `accentFor(colors, values)` returns `-1` when the caller passed more than one distinct color, so a meaningful palette wins over the flourish; single-hue charts keep the accent. Verified by sampling the live canvas: On Track `rgb(0,135,80)`, At Risk `rgb(245,176,64)`, Kaduna now `rgb(49,161,94)`. (3) Long project names on the report's bar chart were rotated by Chart.js and, being anchored at their tick, trailed right so each name sat under the *next* bar; the capture now shortens labels to their first two words (the per-project table above carries the full names) and they render horizontal and centred. Verified in the regenerated PDF: 4 pages, 3 images, zero `¦`/`£`/U+FFFD, GRID3 attribution exactly once, no body text in the footer band. Cache-bust `?v=12` → `?v=13`.
- 2026-09-08 — **375×812 acceptance row closed: 44px targets everywhere, and the Health legend stopped overprinting the credit line.** The two defects recorded on 2026-09-08 in §9.1/§9.2 are fixed, both in CSS only. (1) **Touch targets.** 30 interactive elements sat under the 44px floor that `dashboard-spec.md` §5 and `redesign-spec.md` R-mobile both mandate. `.chip` and `.btn-sm` were 36px — "small" is a type-and-padding scale, not a hit-area scale, so both go to `min-height: 44px`; `.icon-btn` 40→44; `.brand` gains `min-height: 44px`; Leaflet's 30×30 zoom buttons are overridden to 44 (third-party chrome is not exempt from the floor). The key-indicator rows were the interesting case: the row's own `padding: 13px 0` supplied the visual rhythm while the `<label for>` stayed text-height at ~21px, so the actual target was a sliver. The padding moved onto the label (`min-height: 44px`, row height unchanged at 47→44) and the label draws an `::before` overlay across the whole row, so the effective target includes the 24px checkbox and the value column — `js/health.js` is untouched, and clicking the row's left edge, middle and far-right edge each fire exactly one `change`. Re-audited by measuring every `button, a[href], input, select, textarea, label[for], [role=button]` on all five tabs: 30 offenders → 7. Those 7 are still literally under 44px and are listed as such in §9.1 — five are the 24px checkboxes, each now covered edge-to-edge by its 44px label overlay (verified with `elementFromPoint` at 0.03, 0.5 and 0.98 of the row width), and two are Leaflet/OSM attribution links (43×11, 71×11), inline links in a sentence, which WCAG 2.5.8 excepts and licensing requires. No element remains that is both small *and* uncovered. (2) **Legend overprint** (§9.2), fixed without touching the protected `renderHealthLegend()`: `#tab-health .chart-wrap-tall` reserves a `--hl-band: 64px` padding band and the legend is absolutely positioned into it. **The first attempt was wrong in an instructive way** — letting the wrapper grow (column flex, `height: auto`, canvas pinned with `flex: 0 0 280px`) passed every visible check yet left `canvas.height` at 1041 where `280 × devicePixelRatio` is 840, because Chart.js sizes its backing store from the canvas's *parent*: the chart drew ~19% vertically squashed with pointer hit-testing off by the same margin. Keeping the wrapper's content box at exactly 280px is what makes CSS and Chart.js agree. Verified at 375×812 and 1280×900, in both themes: legend fully inside its wrapper, credit clear of it (2381 vs 2417), backing store matches CSS × DPR, no horizontal overflow on any tab, all eight charts survive two theme round-trips, and zero console errors. The landmine is intact — `legend: { display: false }` still set, DPT3 dot green, Malaria dot bright gold with a dark outline. Cache-bust `?v=13` → `?v=14`.
- 2026-09-10 — **README, MIT licence, and the two junk root PNGs removed.** The repo had no `README.md`, so a GitHub visitor landed on a bare file listing — the worst possible first screen for a project whose own showcase tab is written for a non-technical recruiter. Added a recruiter-first `README.md` (pitch and stat strip adapted from the copy-locked showcase text, one screenshot per tab, run instructions with *why* a server is required, the `window.PM*` architecture table, data sources with the real GRID3/HDX endpoints, CDN versions verified against `index.html`, and an explicit Known-limits section) fronted by seven WebP screenshots in new `docs/screenshots/` (869 KB total), captured from the deployed site with sample data loaded so no shot shows an empty state. Added `LICENSE` (MIT, © 2026 batestguy), noting in the README that it covers the **code** only — GRID3 data stays CC BY 4.0 with its in-app attribution. Deleted `redesign-desktop.png` (a screenshot of the Google new-tab page — the wrong window had been captured and committed) and `redesign-mobile.png` (clipped mid-layout, and still showing the `you@example.com` placeholder retired on 2026-09-07); both are recoverable from history. No shipped `css/`/`js/`/`index.html` change, so no `?v=` bump. **Two process notes worth keeping.** A review pass caught the README describing the Health fallback badge as trustworthy while §9.3 — written in the same change — documented it as broken in exactly that case; the README was corrected to point at the source line instead, and the defect itself is now fixed (next entry). And the dark + mobile screenshot pair wrapped onto separate lines on github.com but not locally: GitHub renders the README column at **839px** on a 1440px window and the pair was `620 + 220 = 840`, one pixel over. Measure the rendered page, not the local preview. Now `540 + 190`.
- 2026-09-10 — **Health source indicators reconciled (§9.3).** The amber badge, the header pill and the source line disagreed in the mixed live/fallback state — which is the *normal* state, since HDX 403s (§11.2). The badge was driven by `anySample = !facLive || !indLive` and the pill by `anyLive = facLive || indLive`, two booleans computed independently from the same pair, so in the mixed case both fired: an amber "Sample data — live source unavailable" badge sitting over 51,022 live GRID3 facilities, beside a green "LIVE DATA" chip. The badge text made it worse by being a fixed string in `index.html` that named neither feed. Replaced with a single `sourceState(facLive, indLive)` helper in `js/health.js` returning the badge text, the pill label and the pill's live flag for all four states, so every indicator derives from one decision; the badge now names the feed that fell back and the mixed state reads **"Partly live"** rather than claiming either extreme. The same bug had a second instance the original report missed — the refresh toast tested `agg.source` alone and so announced "Live GRID3 + HDX" over fallback indicators; it now reports the pill's label. `js/charts.js` untouched. Verified by stubbing both loaders and driving all four states through the refresh button at 375×812 and 1440×900: badge/pill/source line agree in every state, toast reads "Refreshed — Partly live", "PARTLY LIVE" fits the 375px header (chip 104px wide, right edge 307 of 375), badge stays on one line, no horizontal overflow on any of the five tabs, and the §9.2 invariants hold unchanged (`chart-indicator-trends` backing store 840 == 280 × DPR 3, legend/credit clearance 36px). Cache-bust `?v=14` → `?v=15`.
