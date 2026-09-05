# "🚀 This Project" Showcase Tab — Spec (replaces 🧠 Quiz, Tab 3)

**Status:** Draft — decisions locked via interview (4 rounds). Build begins after copy placeholder pass.
**Applies to:** `batestguy/HealthMgtDashboard` (repo + GitHub Pages live site)
**Supersedes in `dashboard-spec.md`:** §6 Tab 3 (Quiz), decisions #8 and #9 (Quiz flow / Quiz end). When built, this content is merged into `dashboard-spec.md` as **§6 Tab 3: 🚀 This Project**, and Quiz references are scrubbed repo-wide (see §8 Checklist).
**Deliverable:** Replace the Quiz tab with a recruiter-facing **capabilities showcase** whose goal is to impress recruiters and hiring managers who open the live dashboard link.

---

## 1. Purpose & audience

The person who opens the live link is usually a **recruiter (non-technical)** who spends ~30 seconds deciding whether the candidate is relevant. This tab must, in that window, answer:

1. **What is this?** — A working, from-scratch Nigeria Health + PM data dashboard (live on the internet, real data + demo data).
2. **What does it prove about the person who built it?** — A feature→skill map, every claim traceable to a working tab.
3. **How do I contact the builder?** — Copy-email + GitHub repo link. (No CV in v1 of this tab.)

Below the recruiter layer sits **technical depth** (feature cards link to the actual tabs; "under the hood" card + GitHub repo for code reviewers), because the same link is also handed to hiring managers.

**Positioning (interview round 1):**
- Target roles: **generalist** — data/BI analyst, frontend/data-viz developer, and PM roles all plausibly served; no single persona dominates the copy.
- Skills to headline (all five, in priority order agreed): data analysis & visualization · domain knowledge (Nigeria health + PM) · UX & product thinking · live data + API integration · engineering & architecture.
- First reviewer: **non-technical recruiter** → hero must be plain-language, no jargon above the fold.

---

## 2. Locked decisions (interview log)

| # | Topic | Decision |
|---|-------|----------|
| S1 | Role target | **Generalist** — copy speaks to analyst, developer, and PM roles equally |
| S2 | Skills featured | All five areas (viz/analysis, domain, UX/product, live APIs, engineering) get equal feature cards; no single one dominates |
| S3 | Identity | **Pure showcase — no personal name, no photo.** No LinkedIn. The tab presents "what this project proves," not a résumé |
| S4 | CTAs | **Copy-to-clipboard email** (button + visible plain-text address) and **GitHub repo link**. **No CV slot in v1** (added later when a file exists — see Open Items) |
| S5 | Core content | **Capabilities + feature→skill map**: project hero → single radar (evidence summary) → "what this dashboard proves" evidence cards with deep-link **Try it** buttons → under-the-hood engineering card → toolchain chips (repo-proven + adjacent) → CTA footer |
| S6 | Landing tab | **Yes — the app opens on this showcase by default** when loaded with no hash; existing `#projects`/`#health` deep links still land correctly |
| S7 | Skill claims | Toolchain chips show the **repo stack plus common adjacent tools** (SQL, Python, Power BI…), with chips visually grouped so repo-proven tools are distinct from adjacent ones; evidence cards stay strictly repo-traceable |
| S8 | Visual identity | **Match the app theme** (§5.2): green/gold, light cards, Fraunces display face, gradient header. The tab must read as part of one polished product |
| S9 | Skill visualization | **Evidence cards + one radar.** The radar is not self-rated "9/10" meters — its five axes are populated from *counts of shipped evidence features* per area (see §4.2) so it stays defensible |
| S10 | Tab label | **🚀 This Project** in the bottom bar, slot 3 of 5 (Projects · Health · 🚀 This Project · Ask · Export). Internal id `showcase`, hash `#showcase` |
| S11 | Quiz fate | **Delete Quiz fully** — `js/quiz.js`, quiz CSS, markup, script tag, lazy-init wiring, and all Quiz references in `dashboard-spec.md`, `WORKFLOW.md`, `knowledge.md`, acceptance lists. No dormant code |
| S12 | Copy | **I draft placeholder copy now**; a dedicated **copy-lock pass happens before the link is shared with recruiters** (see §7 Copy inventory) |
| S13 | Engagement | The replacement must be *more engaging than a trivia quiz for a recruiter*: bold hero numbers ("51,022 facilities · live APIs · 0 build step"), Try-it deep links, and a radar that draws on open |
| S14 | Roadmap order | After this ships: **Ask (NLQ) tab, then Export tab**. When they land, their evidence cards in this showcase flip from "in progress" to real |

**Retired decisions (from `dashboard-spec.md`):** #8 Quiz flow (one-at-a-time), #9 Quiz results-with-review. **No longer apply.** Decision #3 "5 equal tabs, no persona dominates" is amended: the showcase is a deliberate front door, other tabs remain the working product.

---

## 3. Layout (top → bottom, single column, mobile-first)

Tab panel id: `<section id="tab-showcase" class="tab-panel" aria-label="This Project">`. All strings are placeholders (marked `⟦…⟧`) pending the copy-lock pass.

### 3.1 Hero card (the 30-second pitch)

- **Eyebrow tag** (small caps, gold): `⟦PORTFOLIO PROJECT — BUILT FROM SCRATCH⟧`
- **H1 (Fraunces):** `⟦A working Nigeria health + project-management dashboard⟧`
- **One-sentence plain-language blurb** (no jargon): `⟦Live data maps 51,000+ health facilities, turns uploaded Excel files into project dashboards, and survives losing its internet connection — all in a phone-first site with zero frameworks and zero build step.⟧`
- **Stat strip** (3 inline stats, Fraunces numerals — the "wow, it's real" numbers):
  - `51,022` — live health facilities mapped (GRID3)
  - `5` — interactive dashboard sections… *(replace with final copy; drafts below)*
  - `0` — frameworks · `0` — build step
- **Hero CTA row:**
  - `📁 View the code` → GitHub repo: `https://github.com/batestguy/HealthMgtDashboard` (opens new tab)
  - `✉️ Copy email` → clipboard button + toast (reuses `PMApp.toast`); the address also prints as plain text directly under the button (S4)
  - *(CV button intentionally absent in v1 — S4)*

### 3.2 Radar card — "Where this project is strong"

- Card head: `🎯 Capability radar` + tag `evidence-based`
- One Chart.js **radar** (new `PMCharts.radar()` helper, §4.2) with five axes, matching the five skill areas; values = **count of shipped evidence features mapped to that area** (§4.2 mapping). Colors from the app palette (`#008751` fill at low opacity, gold border).
- One-line caption under the chart: `⟦Axis values are counts of shipped features in this repo — every one has a working tab or code file.⟧`

### 3.3 Evidence cards — "What this dashboard proves"

One card per shipped/planned area. Each card: emoji, feature title (Fraunces), 1–2 line plain-language description, **skill tags** (small pills), and a **Try it →** button that deep-links to the relevant tab (and on mobile scrolls/activates it). Planned areas show a `coming next` pill and no Try-it.

Draft card set (copy-lock later):

| Card | Deep-link / tag | What it proves | Skill tags |
|---|---|---|---|
| 📋 **Excel → live dashboard in one tap** | `Try it` → `#projects` | Drag a multi-sheet Excel file in; 6 charts, KPI cards, and a task tracker rebuild instantly — and bad files are rejected with a list of exactly what's wrong | Data analysis · Excel/data quality · UX |
| 🏥 **National facility map from live APIs** | `Try it` → `#health` | 51,022 real facilities stream from a government data API into a zoomable map; if the internet dies mid-demo it falls back to sample data and says so | Live APIs · engineering · domain knowledge |
| 📈 **Trends + indicators** | `Try it` → `#health` (scrolls) | Immunization and malaria trend lines; key health indicators with toggle | Data viz · domain knowledge |
| 🧠 **Ask your data (plain English)** | `coming next` → built as Ask tab (S14) | Type "show top 3 tasks in Lagos" and the dashboard answers | NLQ design · UX · data analysis |
| 📤 **One-tap reports** | `coming next` → built as Export tab (S14) | PNG snapshot and a multi-section PDF report; share link | Engineering · UX |
| 🛠 **Under the hood** (static, no Try-it) | always shown | Vanilla JS only: 8+ hand-written modules, CDN-only libraries, no bundler; a spec + workflow doc drive every change; clean public git history | Engineering · process rigor |

*(Final evidence set and wording land in the copy-lock pass. Card 6 doubles as the "under the hood" engineering pitch and may render as its own section instead of a card — decide at build.)*

### 3.4 Toolchain chips

Two visually distinct groups:

- **Shipped in this repo** (green chips): Vanilla JavaScript (ES5, module-per-tab) · HTML5 + CSS3 · Chart.js · Leaflet + marker clusters · SheetJS (Excel) · Git + GitHub Pages · ARC REST (GRID3)
- **Adjacent toolbox** (gray chips, labeled `adjacent`): SQL · Python · Power BI · API design · Agile/PM delivery

### 3.5 CTA footer

- Repeat the two CTAs (View code, Copy email) at the bottom — recruiters who scrolled to the end shouldn't scroll back up.
- Data-credit line (kept from Health tab): GRID3 v2.0 · HDX/WHO.
- Small line: `⟦Built without frameworks, libraries via CDN only — inspect the source on GitHub.⟧`

---

## 4. Behavior & technical spec

### 4.1 Integration (replaces Quiz wiring)

- `index.html`: delete the quiz `<section>`, quiz tab button, `js/quiz.js` script tag; add `tab-showcase` panel after Health's section; bottom-bar slot 3 becomes `🚀 This Project` (`data-tab="showcase"`, hash `#showcase`); add `js/showcase.js` script **before** `app.js` (keep `app.js` last per §3.1).
- `js/app.js`:
  - tab registry + `activateTab('showcase')` lazy-inits showcase (consistent with health/quiz pattern), or renders it eagerly since it is the default landing view (decide at build — eager render is acceptable and simpler for a static-content tab).
  - **Default landing:** on boot with no hash, activate `showcase` instead of `projects`. Unknown/removed hashes (e.g., old `#quiz` bookmarks) also fall back to `showcase`.
  - `#projects`, `#health` deep links and the bottom-bar behavior are unchanged; tab switching keeps current semantics.
- Radar init + clipboard wiring live in `js/showcase.js` (`window.PMShowcase`, IIFE pattern matching other modules). If Chart.js is down, the radar card hides gracefully (existing destroy-on-missing pattern).

### 4.2 Radar — evidence-based values (S9)

- New `PMCharts.radar(canvasId, labels, values)` helper (Chart.js `type:'radar'`; theme colors; `maintainAspectRatio:false` inside a `.chart-wrap`).
- A single constant in `js/showcase.js` maps the **five axes → count of shipped evidence items**:

| Axis | Count basis (draft) |
|---|---|
| Data analysis & visualization | shipped chart/analysis features (Excel KPIs, 6 chart types, filters, tracker…) |
| Engineering & architecture | shipped modules + infra (8 modules, no-build deployment, fallbacks…) |
| Live data + APIs | working live integrations (GRID3 map, bbox queries, HDX attempt + fallback…) |
| UX & product thinking | shipped UX evidence (mobile-first, deep links, validation UX, toggles…) |
| Health/PM domain | domain surfaces (facility levels, PM portfolio health, indicators…) |

Counts are **derived from the real codebase** at build time (count the actual shipped items per area and hard-code the resulting small numbers, e.g. 4–7 range). The caption makes the basis explicit so no reviewer can read it as self-rated proficiency.

### 4.3 Try-it buttons

- Each evidence card's `Try it` does: `location.hash = '…'` then `PMApp` activates that tab (the app's existing deep-link handling already supports this; verify on mobile that it also scrolls the section into view).
- Ask/Export cards show `coming next` state pills (gold) instead of Try-it; they flip to real links when those tabs ship (S14).

### 4.4 Clipboard (email CTA)

- Reuse the pattern/helper the Export tab will need: `navigator.clipboard.writeText` with `execCommand` fallback; success/failure toast via `PMApp.toast('Email copied — ⟦address⟧')`.
- The plain-text address sits beside the button (readable even if clipboard is blocked).

### 4.5 Static-only, no data layer

- No fetch, no localStorage (respects decision #16 session-only). Content is static HTML + the radar constant. Everything resets on reload — fine, the showcase is deterministic by design.

---

## 5. Mobile + accessibility requirements

- Consistent with `dashboard-spec.md` §5: single column ≤480px, cards, 44px+ targets, Fraunces headings, green/gold theme (S8). No new theme tokens beyond a couple of chip/pill styles (adjacent-tool gray chip, `coming next` gold pill).
- Tab must stay ≤ ~3.5 phone screens tall so the recruiter CTA footer isn't buried; radar ~260px canvas.
- Copy email button and Try-it buttons are real `<button>`s with `aria-label`s; plain-text email present for AT users. Radar gets an `aria-label` summary (e.g., "Data visualization highest, five areas balanced").
- `prefers-reduced-motion`: radar draw animation off (mirror existing `@media` handling).
- Deep links from the hero/evidence cards open GitHub in a new tab (`target="_blank" rel="noopener"`).

---

## 6. Acceptance criteria (definition of done for the showcase tab)

1. `https://…/HealthMgtDashboard/` (no hash) lands on **🚀 This Project**; `#health` and `#projects` still land correctly; `#quiz` (dead) falls back to showcase.
2. Hero renders the eyebrow, H1, blurb, 3-stat strip, and both CTAs without console errors.
3. Radar draws with 5 labeled axes and evidence-count values; hidden gracefully if Chart.js CDN fails.
4. Every shipped-area evidence card's **Try it** activates its target tab on mobile (375×812) and desktop; `coming next` pills render on Ask + Export cards.
5. Copy-email button places the address on the clipboard and shows a toast; plain-text address visible when clipboard is blocked.
6. Toolchain chips render in two visually distinct groups (repo-proven green / adjacent gray).
7. No Quiz remnants anywhere in the repo (see §8) — verified by `rg -i quiz` returning nothing and the Export PDF spec no longer referencing a "quiz score summary".
8. Zero console errors in headless Chrome at 375×812 and desktop; visual pass per §9 of the main spec.

---

## 7. Copy inventory (placeholder → real, copy-lock pass)

All copy is placeholder `⟦…⟧` until the **copy-lock pass** (S12), which must happen before the link is shared with recruiters. Lock list:

| Item | Placeholder state | Needs from user |
|---|---|---|
| Hero H1 + blurb | Drafted (generic, jargon-free) | Personal voice, actual achievements, tone check |
| Stat strip values | Draft numbers from the real app (51,022 · 5 sections · 0 frameworks) | Confirm which stats sell best |
| Evidence card wording | Drafted per §3.3 | Factual check + which cards to keep |
| Email address | Placeholder `you@example.com` | **Real address** (public exposure — confirm) |
| GitHub URL | Real already (`batestguy/HealthMgtDashboard`) | — |
| Adjacent tools list | Draft (SQL, Python, Power BI, API design, Agile) | Add/remove |
| CV | **Absent by decision (S4)** | When a file exists: add download + decide in-repo vs external |
| Radar evidence counts | Computed at build from the codebase | Confirm basis wording |

---

## 8. Quiz-removal checklist (do with the build, one commit)

1. `index.html` — delete quiz panel, quiz tab button, `quiz.js` script tag; add showcase panel + script.
2. Delete file `js/quiz.js`.
3. `css/styles.css` — remove the Quiz section (§ styles incl. `.quiz-*`); keep generic helpers.
4. `js/app.js` — remove quiz lazy-init; swap `quiz` for `showcase` in tab handling; default landing = showcase.
5. `dashboard-spec.md` — replace §6 Tab 3 with showcase content; retire decisions #8/#9; update §5.1 tab-bar line, decision #2 v1-scope wording, §12 log with a retirement entry; acceptance §13 items mentioning Quiz replaced; Export §6 Tab 5 PDF contents no longer include "quiz score summary".
6. `WORKFLOW.md` — module map + script order (`quiz.js` out, `showcase.js` in), sign-off checklist rows referencing Quiz replaced.
7. `knowledge.md` — feature list, shipped-files list, live-status line (Quiz → showcase; "Ask + Export remain").
8. Verify `rg -i "quiz"` (excluding git history) returns nothing app-side; commit message notes the retirement.

---

## 9. Open items

1. **Email address** — user to supply before copy-lock.
2. **Copy-lock pass** — user-owner; scheduled after the first live visual check.
3. **CV** — absent in v1; design the slot (in-repo PDF vs external URL) when a file exists.
4. **Adjacent-tool claims** — confirm each adjacent tool is genuinely claimable (only chips, never evidence cards, per S7).
5. **Radar counts** — exact per-axis counts computed from the codebase at build.
6. **Eager vs lazy init** of the showcase — decide at build (default landing argues for eager).
7. **Ask/Export evidence cards** — flip from `coming next` to real links as those tabs ship (S14).

## 10. Build plan (when approved)

1. Copy-removal + markup: rewrite `index.html` tab 3, add `js/showcase.js`, add radar helper to `js/charts.js`, showcase CSS.
2. App wiring: default landing, tab registry, dead-hash fallback.
3. Scrub Quiz repo-wide (checklist §8) and update all three docs.
4. Verify: `node --check`, `rg -i quiz` clean, headless Chrome 375×812 + desktop of `#showcase` and default-load, deep links, clipboard behavior.
5. Commit, push to Pages, then build **Ask (NLQ)** (S14).
