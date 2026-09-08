# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Dandali** — a Nigeria Health + Project Management dashboard. A *zero-build* static site (HTML5 + CSS3 + ES5-style vanilla JS) deployed to GitHub Pages at https://batestguy.github.io/HealthMgtDashboard/. Five tabs: Projects, Health, This Project (showcase), Ask (NLQ), Export.

There is no bundler, transpiler, package manager, linter, or test runner for the app. Every runtime library comes from a CDN `<script>` in `index.html`. The only `node_modules/` in the repo is `tools/`, which is dev-only and never ships.

## Commands

```bash
# Preview (the only way to "run" the app — file:// breaks fetch/CORS)
python -m http.server 8000      # or: npx serve .
# open http://localhost:8000

# Regenerate the seeded demo workbook (dev-only tooling)
cd tools && npm install && npm run generate:sample   # writes ../assets/sample-data.xlsx

# Release = push to main; GitHub Pages auto-deploys
git push origin main
```

There are no automated tests. Verification is manual: walk all five tabs at **375×812** (DevTools device mode) *and* a desktop width, confirm **zero console errors**, then run the relevant rows of the acceptance matrix in `WORKFLOW.md` §3.3.

## Architecture

### Module pattern

Each `js/*.js` file is an IIFE assigned to a single `window.PM*` global — there are no ES modules, no imports. Cross-module calls go through those globals, always defensively (`if (window.PMApp && PMApp.toast)`), because load order and CDN availability are not guaranteed.

| Global | File | Owns |
|---|---|---|
| `PMApp` | `js/app.js` | Tab routing, Projects tab, theme, shared helpers (`toast`, `goto`, `countUp`). Wires everything — **loads last**. |
| `PMData` | `js/data.js` | SheetJS parse + per-sheet validation + the in-memory dataset (`getDataset()`, `getReport()`, `hasData()`) |
| `PMCharts` | `js/charts.js` | Chart.js v4 wrappers (`bar`/`groupedBar`/`hbar`/`doughnut`/`line`/`radar`) + `renderHealthLegend()` |
| `PMHealthData` | `js/health-data.js` | GRID3 facilities, HDX indicators, state centroids, seeded fallbacks |
| `PMMap` | `js/map.js` | Leaflet map, Nigeria-framed, on-demand points by zoom |
| `PMHealth` | `js/health.js` | Health tab controller (KPIs, live/fallback badge, refresh) |
| `PMShowcase` | `js/showcase.js` | "This Project" recruiter tab (static, no data layer) |
| `PMNlq` | `js/nlq.js` | Simulated fuzzy keyword NLQ engine (`parse`, `run`, `EXAMPLES`) |
| — | `js/export.js` | PNG snapshot (html2canvas) + share link |
| — | `js/pdf.js` | Multi-section jsPDF report |

**Script order in `index.html` is load-bearing** and documented in `WORKFLOW.md` §2.3: jsPDF + html2canvas (CDN, in `<head>`) → leaflet → markercluster → data → charts → health-data → map → health → showcase → nlq → export → pdf → app.

**Every library a `js/*.js` calls needs an actual `<script>` tag.** Both Export features shipped as "done" while their library tag was simply missing from `index.html`. The `typeof html2canvas === 'undefined'` / `jsPDFCtor()` guards turn that into a tidy red status line ("PNG/PDF library did not load from CDN"), which reads like a CDN outage rather than a missing tag — so the bug survived several commits. If an Export button reports a library failure, check `index.html` before suspecting the CDN.

### Data flow

Two independent sources feed everything:

1. **Excel** → user upload or `PMData.loadSample()` (`assets/sample-data.xlsx`, 5 sheets: Projects, Tasks, Resources, Finances, Locations, keyed by `ProjectID`) → validated into the `PMData` dataset → read by `app.js` (Projects render), `nlq.js`, and `pdf.js`.
2. **Live health APIs** (GRID3 facilities, HDX indicators) → `PMHealthData`, with **seeded fallbacks baked into the same module**. A live-fetch failure must degrade to the fallback badge — never a silent empty state.

Both are session-only. No persistence except the theme (see below).

### Theming

Every color/font is a CSS custom property on `:root` / `[data-theme="dark"]` in `css/styles.css`. `charts.js` reads those tokens at draw time via `token()`, so switching theme restyles every chart with no chart-code change. Adding a color means adding a token, not a hex literal. Tokens are specified in `redesign-spec.md` §4.1.

`js/pdf.js` deliberately ignores the active theme and hardcodes its own light "paper" palette (`PAL`) so printed output is always green/gold on cream.

## Conventions

- **Spec-first.** `dashboard-spec.md` is the source of truth for *what*; `redesign-spec.md` for the visual system; `showcase-spec.md` for the showcase tab; `WORKFLOW.md` for *how*. When behavior changes, update the spec **and** its §12 already-done log in the *same commit* as the code. `healtguide.txt` is the superseded v1.0 spec — do not read it for current requirements.
- **Never `npm install` anything that reaches the browser.** New library = new CDN `<script>` tag.
- **Cache-bust local assets.** `index.html` appends `?v=N` to every local `css/` and `js/` reference (currently `?v=11`). Bump N on every app change — Pages caches ~10 minutes and a stale mix of old/new files is the usual "it works locally" failure.
- **Destroy Chart.js instances before recreating** — use `PMCharts.destroy(id)` / the wrappers, which handle it. Re-rendering without destroying leaks instances after every upload.
- **Icons are the inline SVG sprite** (`#pm-*`, `stroke="currentColor"`) defined in `index.html`. Emoji appear in copy and tab labels, but are not the icon system for chrome.
- **The NLQ engine stays keyword-based.** Never wire a real LLM into the static page — that requires a backend and is explicitly a future phase.
- **Mobile-first:** single column, max-width 480px, centred, 44px minimum touch targets.
- Tabs are deep-linkable: `#projects`, `#health`, `#showcase`, `#ask`, `#export`.
- Work directly on `main`; stage only files relevant to the change (never blind `git add -A`).

## Gotchas

- `WORKFLOW.md` §4.3 says "no `localStorage`/`sessionStorage`" — that rule is about *data*. The theme toggle is the one sanctioned exception (`pm-theme`, in `applyTheme()`), wrapped in try/catch for blocked storage.
- **PDF chart staging contract.** `js/pdf.js` renders its **own** `pdfcap-progress` / `pdfcap-facilities` / `pdfcap-trends` canvases into an offscreen `#pdf-stage` (`withStage()`) and never reaches into the live charts — hidden tabs are `display: none`, so their canvases have zero layout and capture blank. `PMCharts.get(id)` is the instance accessor (the old `PMCharts._registry` reach was never exported and always returned `null`); `PMCharts.withThemeScope(el, fn)` forces the light palette inside the stage and disables animation so the canvas is painted before it is read. The stage must stay laid out (`position: fixed; left: -10000px`), never `display: none`. Each capture logs its byte length via `console.info` — that line is the regression detector, because the no-chart fallback is styled text, not an error.
- **Theme switching destroys *every* chart, not just the visible one.** `applyTheme()` calls `PMCharts.destroyAll()` because charts bake theme tokens in at draw time, but a hidden `.tab-panel` is `display: none` and cannot be repainted in place (it would draw at 0×0). So `applyTheme()` flags the other chart tabs in `staleCharts` and `activateTab()` repaints them on the way back in. Anything new that draws a chart must be reachable from `repaintTab()`, or it will vanish on the first theme toggle and never return — module `init()`s are guarded by an `initialized` flag, so re-opening the tab will not save you. `staleCharts` must stay declared **above** `activateTab()`: `init()` runs partway through the IIFE and calls `activateTab()` synchronously when the DOM is already parsed.
- The `.xlsx` generator is deterministic (fixed PRNG seed). Commit `tools/generate-sample-xlsx.js` and the regenerated workbook together, and call out any seed/dataset change in the commit message.
- `.agents/types/` is external agent tooling, not part of this project. Ignore it for feature work.
- `output/` is gitignored render/screenshot scratch space.
