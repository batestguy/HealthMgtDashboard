# Visual Redesign — "Editorial National Atlas" — Spec

**Status:** Draft — direction locked via interview (4 rounds). Build phases follow; Phase 1 (design system + showcase + Projects) is the next implementation slice.
**Applies to:** `batestguy/HealthMgtDashboard` (static, GitHub Pages — live at https://batestguy.github.io/HealthMgtDashboard/)
**Amends `dashboard-spec.md`:** decision #13 (light-only → **light + dark with toggle**), decision #14 (generic title → **coined name + factual subtitle**), decision #16 (session-only → **single localStorage exception for the theme choice**). §5 (global UI/UX) is rewritten by this spec when Phase 1 lands.
**Goal:** make the dashboard *really beautiful and unique* — a warm, editorial, unmistakably Nigerian visual identity that stuns recruiters in the first 30 seconds and stays comfortable for daily data work.

---

## 1. Critique of the current design (why we're doing this)

Read from the live app + `css/styles.css` + `index.html` (2026-09-05). Honest assessment:

1. **Generic "SaaS template" look.** White rounded cards, soft gray shadows, pastel status pills, gradient green header — competent, interchangeable, and instantly forgettable. Nothing about it could only be *this* project. It reads "nice default", not "made by hand for Nigeria".
2. **Emoji as the icon system.** 📋🏥🚀💬📤 in the tab bar and card heads render differently per OS (flat Windows glyphs vs Apple's), look unpolished at nav scale, and can't be tinted or animated to match a theme. This is the single biggest uniqueness lever available.
3. **National identity reduced to a flag emoji + two colors.** The one thing no other dashboard has — Nigeria — is barely used. Green `#008751` and gold `#f5b041` exist but nothing *rhymes* with them: no pattern, no motif, no heritage texture, no brand mark.
4. **Thin type system.** Fraunces only touches KPI numerals and card headings; body is the default system stack; there is no mono face for data; hierarchy is font-weight 700 on everything. Numbers jitter as they change (no tabular figures).
5. **Chart.js defaults everywhere.** Rounded default bars, default palette, default tooltips, default grids — the charts are the least-branded surface in the app.
6. **Flat card stacks.** Every tab is a vertical pile of equal-weight white cards; no focal hero, no rhythm, no section identity. Desktop is still a 480–720px centered column — a stretched phone app on a monitor, not a product.
7. **The header is a default gradient.** The one constant across all tabs is the least designed. No wordmark, no status, no identity.
8. **Inconsistent component language.** Projects KPIs got the "fancy" treatment (accent bars, icon chips) while Health KPIs are bare; showcase has its own idioms; no shared tokens beyond a few colors.
9. **Small/weak typography details** — 0.62–0.7rem labels in places, muted grays on light gray (contrast risk), tab-bar labels tiny.
10. **Motion is minimal.** One card-reveal animation; tabs snap; charts pop in; no draw-in, no counters, no panel transitions. (Reduced-motion is respected — that must survive the redesign.)
11. **Missed brand moments:** the map could be styled to match; empty/loading states are plain text; the toast is a bare dark pill; the showcase hero is a good idea in a default card.

**What's good and must survive:** mobile-first discipline (375px, 44px targets), the deep-link tabs, session-only data, the no-build/static constraint, reduced-motion support, the information architecture and all working features. This is a *visual* redesign, not a functional rewrite.

---

## 2. Design principles

1. **An atlas, not an app.** The dashboard should feel like a beautifully printed national report that happens to be alive: warm paper, ink-green type, gold for emphasis, thin rules, numbered sections, generous margins.
2. **Nigeria is the identity.** Green + gold are the DNA; a hand-drawn geometric motif (inspired by Nigerian textile/chevron rhythm, anchored by the Adinkra *Wawa Aba* — "strength and resilience" — as the brand mark) appears subtly everywhere but never becomes noise.
3. **Warm & human.** Rounded-but-refined corners, soft paper textures, friendly-rigorous copy tone, gentle motion. Not cold, not loud.
4. **Data is the protagonist.** Numbers get the biggest, most confident typography (Fraunces display + mono numerals). Charts are restyled end-to-end to belong to the brand.
5. **Recruiters first, workers second.** The first 30 seconds (landing on the showcase) must stun; every tab below must stay scannable for daily use. Beauty leads the pitch; comfort follows it.
6. **Restraint is part of uniqueness.** Patterns and color are used at low opacity and in dedicated bands — the effect is "crafted", never busy.

---

## 3. Locked decisions (interview log)

| # | Topic | Decision |
|---|-------|----------|
| R1 | Art direction | **Editorial national atlas** — warm paper, deep green ink, gold accents, big serif headlines, thin rules, numbered sections, subtle Nigerian pattern bands |
| R2 | Personality | **Warm & human** (craft, approachability, gentle motion) |
| R3 | Theme | **Light + dark, switchable via a header toggle** (amends decision #13). Dark = forest-ink control-room variant of the same atlas |
| R4 | Primary audience | **Recruiters opening the link** — showcase/landing must stun in 30s; other tabs stay comfortable |
| R5 | Palette | **Refined green + gold on warm paper** — deep forest-green ink, warm ivory background, refined gold accent (amends §5.2 color table) |
| R6 | Display type | **Fraunces** stays (variable optical size, weights 500–700) for headlines, KPI numerals, section titles |
| R7 | Body/UI type | **Space Grotesk** for body, labels, buttons, chips (characterful but legible) |
| R8 | Data numerals | **Mono face** (IBM Plex Mono or Space Mono, 400/600) with `font-variant-numeric: tabular-nums` for KPIs, chart ticks, tables — instrument-panel precision |
| R9 | Icons | **Hand-drawn inline SVG set replaces all emoji** in the tab bar, headers, buttons, chips, empty states (stroke style, `currentColor`, theme-aware). No icon library, no build step |
| R10 | Pattern/motif | Nigerian textile-inspired geometric rhythm (chevron/triangle band) + **Wawa Aba** brand mark; used in **all three placements**: header band + section dividers · hero background + card watermarks · chart tooltips + empty states |
| R11 | Desktop layout | **True multi-column at ≥900px**: KPI rows, chart grids, map + side panels, sticky in-tab section header. Mobile stays single-column ≤480 cap |
| R12 | Branding | **Coined name + wordmark** in the header, with the factual subtitle retained (`<title>` keeps "Nigeria Health + PM Dashboard"). Name choice = open item (shortlist below) |
| R13 | Wow moments | **All six**: animated KPI counters · chart draw-in animation · panel transitions · custom map treatment · hero art moment on the showcase · micro-interactions (press/hover/chip/toast) |
| R14 | Chart styling | **Full bespoke**: brand palette, mono ticks, Space Grotesk legends, minimal grids, gradient fills, custom motif-accented tooltips, refined rounded bars, hover states |
| R15 | Scope | **Phased**: Phase 1 = design system + header/tab bar + showcase + Projects; Phase 2 = Health + map treatment; Phase 3 = Ask + Export (incl. PDF tokens) |
| R16 | Theme persistence | **Persist the theme choice** in `localStorage` (single exception to decision #16; key `pm-theme`; no other persistence) |
| R17 | Constraints | **Stay 100% static, no build**: Google Fonts (non-blocking), inline SVG icons/patterns, CDN-only libraries. The "zero build step" repo claim stays true |
| R18 | Taste benchmark | **Supabase / Vercel polish** applied *through* the editorial-atlas lens: crisp, confident, joyful, never default |

---

## 4. Visual system specification

### 4.1 Color tokens (light + dark)

Reorganize `:root` into a token system driven by `[data-theme="light|dark"]` on `<html>` (set before paint to avoid flash — inline script in `<head>` reading `localStorage`).

**Light ("paper atlas")**
| Token | Value | Use |
|---|---|---|
| `--bg` | warm ivory `#f6f1e7` | page background |
| `--bg-raised` | `#fbf8f0` | inset surfaces, hover |
| `--card` | `#fffdf7` | cards |
| `--ink` | deep forest green `#12352a` | primary text (replaces `#1a202c`) |
| `--ink-soft` | `#4c6359` | secondary text (replaces muted gray — green-tinted) |
| `--ink-faint` | `#7c8f85` | tertiary/labels |
| `--green` | deep green `#0e6b4c` (refined from `#008751`) | primary actions, accents |
| `--green-deep` | `#0a4d36` | hover/pressed, header ink |
| `--gold` | `#c99a2e` (refined from `#f5b041` — deeper, editorial) | accent, highlights, brand mark |
| `--gold-soft` | `#f3e2b3` | gold tints, pattern bands |
| `--paper-line` | `#e6dcc6` | hairline rules, dividers |
| status | `--ok #0e6b4c` · `--warn #b7791f` · `--bad #c0392b` · `--info #2f6f8f` | semantics only |
| `--radius` | 14px (slightly smaller, crisper) | cards/controls |
| `--shadow` | warmer, softer: `0 1px 2px rgba(18,53,42,.05), 0 8px 24px rgba(18,53,42,.06)` | |

**Dark ("forest control room")** — same structure inverted with green undertones, not pure gray:
| Token | Value |
|---|---|
| `--bg` | `#0e1a15` (deep forest ink) |
| `--card` | `#16241e` |
| `--ink` | `#e9efe9` |
| `--ink-soft` | `#a8b8ad` |
| `--green` | `#2eae7d` (lighter for contrast on dark) |
| `--gold` | `#e8b64c` |
| `--paper-line` | `#24362c` |
| status | adjusted for dark contrast |

Charts read tokens at draw time (see §4.6) so both themes restyle automatically.

### 4.2 Typography

- **Display:** Fraunces (variable `opsz 9..144`, weights 500/600/700) — headlines, KPI numerals, section titles, hero.
- **Body/UI:** Space Grotesk 400/500/600 — body, labels, buttons, chips, inputs, tab bar.
- **Data numerals:** mono face (IBM Plex Mono or Space Mono 400/600) — KPI values, chart ticks/tooltips, tables, tracker %s, with `font-variant-numeric: tabular-nums`.
- Loading: all three faces via one Google Fonts request, using the existing non-blocking `media="print"` swap pattern (extend to cover the new families; keep the `<noscript>` fallback).
- Type scale (mobile): hero 1.6–1.9rem · section titles 1.15rem · card titles 1rem · body 0.95rem · meta 0.8rem · micro 0.72rem. Tabular mono for all numerals.
- Space Grotesk has no italic; use weight + color for emphasis (fine for this voice).

### 4.3 Icon system (inline SVG, replaces emoji)

Hand-drawn stroke-style set, `stroke="currentColor"`, `stroke-width 1.6–1.8`, `fill:none`, 24×24 viewBox, rounded caps. One `<svg style="display:none">` sprite with `<symbol id="pm-…">` in `index.html` + a tiny `pmIcon(name)` helper in `js/app.js` (injects `<use>`), OR inline per-use — decide at build (sprite is cleaner, still zero-build).

Required glyphs (~16): tabs — projects(grid) · health(plus/cross) · showcase(rocket→**star/comet or map-pin-starburst**) · ask(chat) · export(download); sections — upload(arrow-up-tray) · filter(funnel) · finance(naira note: `₦` drawn as glyph) · task(check-square) · resource(wrench/people) · map(map) · trend(line-up) · indicator(gauge) · copy(clipboard) · code(brackets) · refresh · toast-check. All emoji in `index.html` chrome are replaced; inline copy may keep emoji only where it carries tone (e.g., empty-state flavor) — none in nav, headers, or buttons.

**Brand mark:** Wawa Aba (Adinkra — strength/resilience), hand-drawn, gold, used as: favicon, header wordmark accent, hero watermark, pattern module seed.

### 4.4 Pattern & motif system

A small library of CSS/SVG pattern recipes (all inline — no assets, no build):
1. **Woven band** — the signature: a 24–28px band of repeating chevron/triangle rhythm (Nigerian textile feel) rendered as a repeating CSS gradient or tiny inline SVG `data:` URI, colored `--green`/`--gold` at low opacity. Used: under the header, above section titles as a divider rule, behind the hero title.
2. **Hero texture** — the woven band scaled up + rotated slightly as a very-low-opacity background to the showcase hero card.
3. **Card watermark** — a single Wawa Aba or chevron glyph at 4–6% opacity in a card corner (data cards only — never on charts).
4. **Tooltip/empty-state accent** — a 3px gold rule + motif dot in Chart.js tooltips and empty/loading states.
- Reduced-motion + `print` friendly (patterns degrade to flat rules).

### 4.5 Layout

- **Mobile (≤480):** unchanged skeleton — single column, 44px targets, fixed bottom tab bar (restyled, SVG icons, active state = green ink pill + gold dot or underline).
- **Header:** wordmark (coined name in Fraunces) + Wawa Aba mark · right side: live-data status dot ("Live" when GRID3/HDX up, "Sample" badge when fallback — reuses the existing badge logic) + **theme toggle** (sun/moon SVG). Sticky, ink-green, with the woven band beneath.
- **≥900px multi-column:** `.app-main` max-width ~1200px; per-tab grids:
  - Projects: KPI row (4-up) → two-column chart band (finance + progress) → two-column (task doughnut + priority hbars + resources) → full-width tracker; project cards in a 2-col grid; filters row pinned with the section header.
  - Showcase: hero spans full width with pattern band; evidence cards in a 2–3 col grid; radar + toolchain side by side.
  - Health: map (2/3 width) + indicator side panel (1/3) on ≥900px; KPIs 4-up.
  - Ask: input + chips left, answer panel right on desktop.
- Sticky per-tab section headers (backdrop-blur paper) at ≥900px.

### 4.6 Chart theming (full bespoke, `js/charts.js`)

Central token read at draw time from computed CSS variables (so light/dark works without rebuilding charts — rebuild on theme switch):
- Fonts: ticks + tooltips in mono (tabular), legends in Space Grotesk.
- Grids: only `y` gridlines, hairline `--paper-line`, no x-grid, no chart border.
- Bars: gradient fill (green → transparent or green → gold for the last bar), radius 4–6, `maxBarThickness` kept.
- Lines: 2.5px strokes, subtle gradient fill under the line (top ~20% opacity), dots in gold for the first series only.
- Doughnut: brand palette ring, 4px gaps (borderWidth), center label optional.
- Tooltips: custom HTML — paper/dark card, mono numerals, motif gold rule + dot accent, Space Grotesk labels.
- Animation: draw-in per dataset (Chart.js `animation` config), 600–800ms ease-out; disabled under `prefers-reduced-motion`.
- Radar (showcase): green fill ~16% alpha, gold points, mono ticks.
- **Series color rule (lessons-learned, commited 2026-09-06):** do **not** color line/poly series from the global `PALETTE` via a single `colorFor(i)` index when a chart can have more than one series — the same palette slot can collide across series in some renderings. Scope-specific color helpers (e.g. `healthTrendColors(i)` in `js/charts.js`) must be used for multi-series charts, and the per-point fill should also be series-differentiated (gold node on series 0, paper node on series 1) so the legend, the line, and the dots agree. The Health indicator trend chart is the canonical case: DPT3 immunization (green, up-is-good) vs Malaria prevalence under-5 (gold, down-is-good).
- **Theme-specific legibility (commited 2026-09-06):** when a series color must be distinguishable in **both** light and dark themes, prefer a token that is saturated and hue-contrasted in both (e.g. `--gold-bright`, a warm gold with a dark `--ink` outline on series 1 points) rather than a single deeper gold that can read as 'dark-green-adjacent' on a dark background at legend-swatch size. The Health trend chart is the canonical case: DPT3 = `--green`, Malaria = `--gold-bright` with a dark outline on the dots.
- **Bespoke chart legend for the Health trend chart (commited 2026-09-06):** Chart.js v4 on this build does not honor the per-dataset legend-marker color override for the DPT3 series (it falls back to the dataset's `pointBackgroundColor`, which for DPT3 is gold, so the DPT3 legend marker rendered gold instead of green). Fix: render a small bespoke HTML legend below the trend canvas with two explicitly-painted dots — DPT3 = `token('green')`, Malaria = `token('gold-bright')` with a dark `--ink` outline — matching the in-chart dots/lines exactly. The `PMCharts.line()` Health path now disables the native legend (`legend: { display: false }`) and calls `renderHealthLegend(...)`. The generic `legend()` helper and all other chart types are untouched.

### 4.7 Motion system

All motion gated by `prefers-reduced-motion` (existing pattern extended):
1. **KPI counters** — count up (~700ms, ease-out) on first render of a tab (Projects + Health + showcase stats).
2. **Chart draw-in** — via Chart.js animation config (above).
3. **Panel transitions** — tab switches: 160–220ms cross-fade + 8px rise on the incoming panel (class-based, no library).
4. **Micro-interactions** — press scale 0.98 (already), card hover lift + border tint, chip toggle spring, toast slide-up, section header underline grow, link arrows nudge on hover.
5. Hero: staggered reveal of eyebrow → title → stats → CTAs (200ms steps).

---

## 5. Phase plan (per R15)

### Phase 1 — design system + showcase + Projects (next slice)
1. Token overhaul (§4.1) with `[data-theme]` + inline pre-paint theme script + `localStorage('pm-theme')` toggle in header.
2. Fonts: add Space Grotesk + mono to the non-blocking Google Fonts link.
3. SVG icon sprite + `pmIcon()` + replace all emoji in: tab bar, header, Projects sections, showcase, Ask, Export placeholder, toast.
4. Pattern module: woven band, hero texture, card watermark, tooltip accent.
5. Header redesign: wordmark + Wawa Aba + live/sample status + theme toggle.
6. Tab bar redesign (SVG icons, active treatment).
7. **Showcase:** hero art moment (giant Fraunces title over pattern band, staggered reveal, animated 51,022 stat), evidence grid (2–3 col on desktop), radar restyled, CTA buttons in brand styles.
8. **Projects:** KPI counters + mono numerals, project cards 2-col on desktop, chart band restyle (all six chart types), tracker typography/rows, filters + chips restyle, section headers.
9. Desktop ≥900px grid for Projects + showcase.
10. Empty/loading states + toast restyle.
11. Verify: 375 + 1280, light + dark, reduced-motion on; zero console errors; `?v=` bump; commit.

### Phase 2 — Health + map treatment
1. Map: styled to match the atlas — options: keep OSM tiles but restyle markers/circles/controls/attribution (safe, no API key) **or** switch basemap to CARTO light/dark (cleaner, still keyless) — decide during build; keep Nigeria framing + zoom-8 clustering (accepted behaviors unchanged).
2. Health KPIs get counters + the same component language as Projects.
3. Doughnut + trend lines restyled; key-indicator rows; badge/status chip in header ties to map source.
4. Desktop split layout (map 2/3 + indicators 1/3).

### Phase 3 — Ask + Export
1. **Ask tab — atlas shell restyle (engine untouched).** Section rule + atlas-styled input, Ask button, answer panel (3px gold rule, mono numerals in replies/lists), and atlas chip styling for the example chips; desktop split (input + answer left, example chips + "how it works" right at ≥900px, single-column on mobile). The NLQ engine (`js/nlq.js`) is unchanged — `parse`/`run` and the 17-check harness stay green; Phase 3 only restyles the shell around a finished engine.
2. **Export tab — real first cut (PNG + share link now; PDF deferred).** PNG snapshot of the active tab via `html2canvas` (retina-scaled, themed to the active light/dark theme, filename `dashboard-YYYY-MM-DD.png`). Share link that copies the live Pages URL + active tab hash (clipboard API with `execCommand` fallback, toast feedback). PDF is intentionally deferred — the UI card says "coming next"; `jsPDF` is not wired in this phase.
3. **Bespoke Health trend legend (lessons-learned implement).** Because Chart.js v4 on this build does not honor the per-dataset legend-marker color override for the DPT3 series, the trend chart disables its native legend and renders a small bespoke HTML legend (`renderHealthLegend` in `js/charts.js`) with two explicitly-painted dots — DPT3 = `token('green')`, Malaria = `token('gold-bright')` with a dark `--ink` outline — matching the in-chart dots and lines exactly. Other chart types keep the auto legend.
4. Final sweep: consistent dark mode everywhere, empty states, print stylesheet pass.

---

## 6. Naming (R12 — open item)

Shortlist for the header wordmark (user picks or supplies another; `<title>` keeps the factual subtitle):
- **Dandali** (Hausa — "story/tale") — *Dandali: The Nigeria Health Atlas*
- **Ase** (Yoruba — power to make things happen) — *Ase Health & Delivery*
- **Naija Atlas** — plain, friendly, instantly clear
- **The Green Atlas** — green + atlas, memorable
Pick one in the follow-up; default if unopened: **Dandali**.

---

## 7. Technical constraints & notes

- **Zero build stays.** Fonts via Google Fonts; icons/patterns as inline SVG/CSS; no icon lib, no Tailwind, no bundler.
- Theme toggle: `<html data-theme>` set by an inline head script from `localStorage('pm-theme')` (flash-free); toggle button persists; **no other** persistence (decision #16 otherwise intact).
- Charts re-read tokens on theme switch: simplest = destroy + redraw registered charts on toggle (pattern already exists — `PMCharts.destroyAll` then re-render current tab).
- Cache-busting: bump `?v=` in `index.html` when these files change (v6 → v7).
- Performance: keep initial load <3s on 4G; font requests non-blocking; patterns are cheap CSS/data-URIs; no layout thrash from counters (use `requestAnimationFrame`).
- Accessibility: contrast-checked ink/muted pairs in both themes; focus-visible rings in gold; 44px targets; icon `aria-hidden` + text labels; reduced-motion fully honored; `tabular-nums` avoids jitter.

---

## 8. Acceptance criteria (Phase 1 definition of done)

1. Light + dark themes both polished; toggle persists across reloads; no flash of wrong theme.
2. **Zero emoji** in the tab bar, headers, buttons, or card chrome — all SVG icons.
3. Hero art moment renders on the showcase (pattern band + giant serif + animated stat + staggered reveal).
4. KPI counters animate on Projects + Health + showcase; charts draw in; tab panels transition; reduced-motion disables all of it.
5. All six chart types restyled (mono ticks, brand gradients, motif tooltips) and rebuild cleanly on theme switch — zero console errors.
6. ≥900px: Projects + showcase go multi-column; 375×812 remains fully usable with 44px targets.
7. Pattern identity visible in: header band, section dividers, hero, card watermark, tooltip accent — subtle, never noisy.
8. Before/after screenshots at 375 + 1280 (light + dark) captured for sign-off; Brave eyeball by the user; `?v=` bumped; commit per phase.## 9. Risks & open items

1. **Name choice** (R12) — user pick from the shortlist or custom; header/subtitle/title text depends on it. (Default used: **Dandali**, shipped.)
2. **Font weight/load budget** — 3 families may add ~150–250KB; mitigate with variable axes + limited weights + non-blocking load; verify <3s budget.
3. **Map basemap** — OSM (safe) vs CARTO light/dark (cleaner, keyless) — locked to **OSM + atlas app-layer restyle** (decided with user during Phase 2; no API key).
4. **Pattern final form** — chevron/wave band + Wawa Aba mark; locked visually during Phase 1 rendering.
5. **Dark-mode chart rebuild** — implemented as destroyAll + re-render of the *active* tab only (applies to theme toggle; does not disturb filters).
6. **Export/PDF in dark mode** — PDFs always render in the light "paper" theme regardless of active UI theme (print = paper). **PDF itself is still deferred** (PNG + share link shipped in Phase 3; `jsPDF` not yet wired).

## 10. Already delivered — current state (as shipped)

**All five tabs are built.** The redesign (Editorial National Atlas) shipped in three phases on top of the existing feature app; the feature app itself (Excel → dashboards, live facility map, Ask NLQ) was already complete before the redesign.

**Shipped identity (design system — Phases 1–3):**
- **Name:** Dandali (Hausa — "story/tale"). Header wordmark + Wawa Aba brand mark; `<title>` keeps the factual subtitle "Nigeria Health + PM Dashboard".
- **Themes:** light "paper atlas" + dark "forest control room", switchable via a header toggle, persisted in `localStorage('pm-theme')`, set pre-paint to avoid flash. Tokens in `css/styles.css` (`:root` + `[data-theme="dark"]`).
- **Type:** Fraunces (display) + Space Grotesk (body/UI) + IBM Plex Mono (data numerals, tabular-nums). Non-blocking Google Fonts load.
- **Icons:** hand-drawn inline SVG sprite (`pm-*`) replacing all emoji in the chrome (tab bar, headers, buttons, chips, empty states).
- **Pattern/motif:** woven chevron band under the header + as section dividers; hero texture; card watermarks; motif gold rule + dot on tooltips/empty states.
- **Charts:** full bespoke theming from CSS tokens — mono ticks, Space Grotesk legends, hairline grids, brand gradients, motif-accented tooltips, draw-in animation; rebuilds on theme toggle.
- **Motion:** KPI counters, chart draw-ins, panel transitions, micro-interactions — all gated by `prefers-reduced-motion`.
- **Desktop:** true multi-column at ≥900px (Projects, showcase, Health split, Ask split); mobile stays single-column.

**Tabs (all built):**
1. **Projects** — Excel upload (multi-sheet via SheetJS), KPIs, filters, project cards, six charts, task tracker. Restyled in Phase 1.
2. **Health** — GRID3 facility map (Nigeria-framed, zoom-8 detail, marker clusters, atlas-styled circles + Leaflet chrome + bespoke state-tooltip), HDX indicator trends + facility-level doughnut + key indicators; KPIs with mono numerals + footer summary; atlas section rules. Restyled in Phase 2.
3. **🚀 This Project** — recruiter-facing showcase: hero art moment, evidence-based radar, feature→skill cards with Try-it deep links, toolchain chips, copy-email + GitHub CTAs. Default landing tab. Restyled in Phase 1.
4. **💬 Ask** — simulated fuzzy multi-intent NLQ engine (typo-tolerant keyword matching over Excel data + health feed; answers with real numbers, filters Projects, opens tabs; 17-check parse harness green). Atlas shell restyle (input, answer panel, chips, desktop split) shipped in Phase 3; engine itself untouched.
5. **📤 Export** — **PNG snapshot** (active-tab `html2canvas`, retina, themed to active theme, `dashboard-YYYY-MM-DD.png`) **+ share link** (live Pages URL + active tab hash, clipboard + `execCommand` fallback, toast) **now live**; **PDF deferred** (UI card says "coming next"; `jsPDF` not yet wired).

**Known shipped lessons (see also §4.6):**
- Multi-series chart colors must come from a scope-specific helper (`healthTrendColors`), not the global `PALETTE` via `colorFor(i)`.
- When a series color must read in both themes, prefer a saturated hue-contrasted token (`--gold-bright`, with a dark outline on dots) over a single deeper gold that can read as dark-green-adjacent on dark.
- Chart.js v4 on this build does not honor a per-dataset legend-marker color override for the DPT3 series (falls back to `pointBackgroundColor`); the trend chart therefore uses a bespoke HTML legend instead of fighting the native one.

**Current build:** `?v=9` (9 js files + css/styles.css) on GitHub Pages → https://batestguy.github.io/HealthMgtDashboard/.

**Still open (the one remaining functional item):** the multi-section PDF report (`jsPDF`) — deferred, UI card says "coming next".
