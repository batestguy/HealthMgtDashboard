# WORKFLOW — How this project gets built and shipped

A clean, repeatable process for every change to the **Nigeria Health + PM Dashboard**.
Read this before starting any work; follow it for every feature, fix, and release.

**Doc map — three files, three jobs:**

| File | Answers | When to touch it |
|------|---------|------------------|
| `dashboard-spec.md` | **What** we build (decisions, per-tab requirements, acceptance criteria, §12 already-done log) | When a requirement or decision changes |
| `WORKFLOW.md` (this) | **How** we build, verify, commit, and ship | When the process changes |
| `knowledge.md` | Quick orientation: what the project is, key files, commands, gotchas | When project facts change |

---

## 1. Golden rules

1. **Spec-first.** No code before the relevant `dashboard-spec.md` section is settled. Change the spec *and* log it in §12 **in the same commit** as the code it describes.
2. **Static app, no build step.** The dashboard is plain HTML/CSS/JS served as-is. All runtime libraries come from **CDNs** — never `npm install` anything that ships to the browser. The only Node tooling is `tools/` (dev-only data generation).
3. **Verify before you commit.** Browser console must be clean; the spec §9 must-pass criteria relevant to the change must pass.
4. **Small, coherent commits.** One logical change per commit; message explains *why*; docs ride along with the change they describe.
5. **`main` is the release branch.** Anything pushed to `main` deploys to GitHub Pages automatically. No feature branches for this project's size unless a change is large or risky.

---

## 2. The change workflow (one loop per feature/fix)

1. **Locate the requirement** — read the relevant `dashboard-spec.md` section (§4 data, §5 UI, §6 per-tab). If it's underspecified, ask the user and lock the decision into the spec before coding.
2. **Check the already-done log** (§12) — don't rebuild what exists.
3. **Implement in the right module** (spec §3.1):

   | Concern | File |
   |---------|------|
   | Shell, tabs, boot, shared state | `index.html`, `js/app.js` |
   | Seed data, Excel parse/validate/store | `js/data.js` |
   | Chart.js wrappers (bar/doughnut/line) | `js/charts.js` |
   | Health data: GRID3 provider, HDX attempt, seeds | `js/health-data.js` |
   | Leaflet map + on-demand loading | `js/map.js` |
   | Health tab controller (KPIs, badge, refresh) | `js/health.js` |
   | Recruiter showcase tab (radar, evidence, copy-email) | `js/showcase.js` |
   | NLQ engine (Ask tab) | `js/nlq.js` |
   | PNG/PDF/share | `js/export.js` (pending) |
   | All styles | `css/styles.css` |
   | Seeded workbook source | `tools/generate-sample-xlsx.js` |

   Script order in `index.html`: leaflet → markercluster → data → charts → health-data → map → health → showcase → nlq → app (app wires everything last). Add `export.js` before `app.js` when Export ships — keep `app.js` last.
4. **Preview locally** — serve the folder over HTTP (no bundler, no dev server config):

   ```bash
   python -m http.server 8000        # or: npx serve .
   # open http://localhost:8000
   ```

   Test at **375×812** (DevTools device mode) plus a desktop width.
5. **Verify** against §9 criteria for that change (see the checklist in §4.3) and confirm **zero console errors**.
6. **Commit** (conventions in §4.1), then **push** — Pages deploys the new `main` (release procedure §4.2).

---

## 3. Procedures (runbooks)

### 3.1 Regenerate the seeded sample workbook

The dashboard's demo data (`assets/sample-data.xlsx`) is **generated, never hand-edited**.

```bash
cd tools
npm install                 # first time only (dev-only dependency)
npm run generate:sample     # writes ../assets/sample-data.xlsx
```

Rules:
- The generator is **deterministic** (fixed PRNG seed) so the workbook is reproducible. If you change the seed or data, say so in the commit.
- Commit `generate-sample-xlsx.js` **and** the regenerated `.xlsx` together.
- After regenerating, sanity-check the round-trip (schema must match spec §4.1):

  ```bash
  node -e "const XLSX=require('xlsx');const wb=XLSX.readFile('../assets/sample-data.xlsx');console.log(wb.SheetNames)"
  ```

### 3.2 Release to GitHub Pages

```bash
git push origin main        # Pages auto-builds from main — that IS the release
```

- Live URL: **https://batestguy.github.io/HealthMgtDashboard/** (the Export tab's Share Link).
- After deploy: hard-refresh (Cache-busting shift) and re-run the affected §9 checks on the live URL — phones included.
- Pages **404s until a root `index.html` exists** — until the first app shell is committed, the live URL is expected to be empty.

### 3.3 v1 sign-off runbook (acceptance — spec §9)

Run through the full matrix — **iPhone (Safari), Android (Chrome), Desktop (Chrome/Edge/Firefox)** — on the live URL:

| # | Criterion | How to verify |
|---|-----------|---------------|
| 1 | Excel upload: multi-sheet, per-sheet errors | Upload `assets/sample-data.xlsx`; KPIs update; row counts shown. Upload a broken file (rename/missing sheet) → clear per-sheet error list, no crash |
| 2 | Health data ≤3s or graceful fallback | Airplane-mode / block CDN → fallback badge shows; restore → refresh button reloads live data |
| 3 | Map clusters + on-demand by zoom | Zoom out = aggregate counts; zoom past threshold = clustered points |
| 4 | Quiz static + dynamic mix; review screen | Start quiz → ≥1 Excel-derived question; finish → results + answer review |
| 5 | NLQ ≥10 combos, fuzzy, multi-intent | Run the §6 Ask acceptance set; misspell a keyword ("showw", "lagis") |
| 6 | Usable at 375×812 | All 5 tabs reachable via bottom bar; no horizontal scroll; 44px targets |
| 7 | No console errors | Walk all 5 tabs + upload + export; console empty |
| 8 (nice-to-have) | PNG/PDF export | Both files download and open |

Check each box in spec §9 as it passes; log the sign-off date in §12.

---

## 4. Conventions

### 4.1 Commits

- **Subject:** imperative, ~50 chars, says *what*. **Body:** *why* + key decisions.
- Stage only files relevant to the change (`git add <files>` — never `git add -A` blindly).
- Never commit `node_modules/`, `tools/node_modules/`, `.env` (all gitignored).
- AI-assisted commits carry the Codebuff co-author footer.
- Commit granularity examples: "Add seeded sample workbook and its generator tool" · "Build Projects tab: upload, KPIs, tracker, chart" · "Record deployment status and resolved open items in spec".

### 4.2 Branching & pushing

- Work directly on `main` (project scale); push after each verified change.
- No destructive history rewrites; don't force-push shared `main`.

### 4.3 Code hygiene

- Destroy Chart.js instances before recreating (spec §7 — prevents leaks after uploads).
- No `localStorage`/`sessionStorage` — session-only state by design (decision #16).
- Emoji/Unicode icons only; Nigeria theme tokens per spec §5.2.
- NLQ stays keyword-based — never wire a real LLM into the static page (that's Phase 2, requires backend).

---

## 5. Gotchas & troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| Live URL 404s | No root `index.html` yet — expected until the app shell is committed (§3.2) |
| Facilities/indicators missing | Live API down or blocked → **fallback badge must appear**; never ship a silent empty state (decision #7) |
| `fatal: dubious ownership` | Should be fixed; if it recurs, re-add `safe.directory` for this folder (Windows FS quirk) |
| `LF will be replaced by CRLF` warnings | Cosmetic on Windows; harmless |
| Generator output differs | PRNG seed or dataset edited — expected; mention in the commit |
| Map jank on phone | Points fetched for whole Nigeria at once — respect the on-demand-by-zoom strategy (§6.2), cache per session |

---

## 6. Definition of done

A change is done when:

- [ ] Spec §12 already-done log updated (if behavior/decision changed)
- [ ] Locally verified with zero console errors at 375×812 **and** desktop
- [ ] Relevant §9 must-pass criteria pass (runbook §3.3)
- [ ] Committed small and pushed to `main`
- [ ] Live URL smoke-tested after deploy
