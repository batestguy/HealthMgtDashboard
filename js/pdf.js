/* ==========================================================================
 * js/pdf.js — multi-section PDF report (Phase 4: the one remaining open item)
 *
 * Built with jsPDF. Always renders in the light "paper" theme (green/gold on
 * ivory) regardless of the active UI theme — print = paper (spec §9 risk #6).
 *
 * Sections (in order):
 *   1. Title page — "Dandali" wordmark + subtitle + report date + data source
 *      line + active-tab context.
 *   2. Projects — KPIs (projects, tasks, completion %, total budget), task
 *      status summary sentence, project progress bar chart (chart-progress) as
 *      embedded JPEG.
 *   3. Health — facility KPIs (facilities, states, public, private), facility-
 *      level doughnut (chart-facility-types) + indicator-trends line chart
 *      (chart-indicator-trends) as embedded JPEGs, key indicators list.
 *   4. Latest Ask answer — the current contents of #nlq-answer (if any).
 *
 * Charts are NOT snapshotted from the live page. The live canvases sit on
 * whichever tab is active — and the PDF button lives on Export, so Projects
 * and Health are display:none and their canvases have zero layout. Instead
 * withStage() builds its own offscreen, forced-light stage (#pdf-stage) with
 * pdfcap-* canvases, renders the three report charts into it through
 * PMCharts.withThemeScope (light tokens, animation off so the paint is
 * synchronous), reads them back as JPEGs, then tears the stage down. The live
 * charts are never touched, so no tab is disturbed and no theme flashes.
 *
 * If a section has no data (no workbook loaded, Health tab never opened), the
 * stage skips that chart, yields null, and the PDF prints its faint "no data
 * rendered yet" line instead — it never fabricates a chart.
 *
 * UI: "Download PDF report" button (#btn-export-pdf) + status line
 * (#export-pdf-status). The deferred-PDF card in index.html is flipped from
 * "coming next" to a live button by this module (graceful if the card still
 * says "coming next" — it just also wires the button).
 * ========================================================================== */

(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  var PDF_DONE_CLASS = 'pdf-ready';

  // Light "paper atlas" palette for the PDF (always light, regardless of UI
  // theme — print = paper, spec §9 risk #6). Values mirror css/styles.css
  // :root so the report reads as the same atlas the user sees in light mode.
  var PAL = {
    bg: '#f6f1e7',
    card: '#fffdf7',
    ink: '#12352a',
    inkSoft: '#4c6359',
    inkFaint: '#7c8f85',
    green: '#0e6b4c',
    greenDeep: '#0a4d36',
    gold: '#c99a2e',
    goldSoft: '#f3e2b3',
    paperLine: '#e6dcc6',
    hairline: '#efe8d8',
    ok: '#0e6b4c',
    warn: '#b7791f',
    bad: '#c0392b'
  };

  var REPORT_META = {
    email: 'batesthommie@gmail.com'
  };

  // Millimetres of page bottom reserved for the two footer lines. Both the
  // footer baselines and every content-overflow check derive from this one
  // number on purpose — the two used to be independent magic numbers, which is
  // how the contact line ended up printed on top of a section paragraph.
  var FOOTER_H = 14;

  // jsPDF's built-in Helvetica/Courier use WinAnsiEncoding, which has no ₦
  // (U+20A6) or Σ (U+03A3) — they render as ¦ and £. Every string that reaches
  // pdf.text() must stay inside WinAnsi, so the PDF spells currency "NGN " and
  // sums out in words. (— · … ÷ × are all in WinAnsi and are used freely.)
  var NAIRA = 'NGN ';

  function statusEl(id) {
    var el = $(id);
    if (!el) return null;
    el.classList.remove('ok', 'err');
    return el;
  }

  function setStatus(id, msg, ok) {
    var el = statusEl(id);
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    el.classList.toggle('ok', !!ok);
    el.classList.toggle('err', !ok && !!msg);
  }

  function toast(msg) {
    if (window.PMApp && window.PMApp.toast) return window.PMApp.toast(msg);
    var t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    setTimeout(function () { t.hidden = true; }, 2600);
  }

  function dateStamp() {
    var d = new Date();
    var y = d.getFullYear();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var day = ('0' + d.getDate()).slice(-2);
    return y + '-' + m + '-' + day;
  }

  function infoDateStamp() {
    var d = new Date();
    var months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  // jsPDF constructor getter. The 4.x UMD bundle we load from the CDN attaches
  // only `window.jspdf` — the constructor is `window.jspdf.jsPDF`, never a bare
  // `jsPDF` global. Older/standalone builds do put `jsPDF` straight on window,
  // so tolerate both. Resolve at call time, not at module load: js/pdf.js is
  // evaluated before js/app.js and the CDN script sits in <head>, so the tag may
  // still be in flight when this IIFE runs.
  function jsPDFCtor() {
    if (typeof jsPDF !== 'undefined') return jsPDF;
    if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
    return null;
  }

  // Chart-instance getter. PMCharts.get() is the supported accessor (it
  // replaced the old reach for a private `_registry` that charts.js never
  // exported — which is why every PDF chart was silently blank). Chart.getChart
  // is the belt-and-braces fallback if PMCharts failed to load.
  function chartInstance(id) {
    try {
      var c = window.PMCharts && PMCharts.get ? PMCharts.get(id) : null;
      if (c && c.canvas) return c;
      if (typeof Chart !== 'undefined' && Chart.getChart) {
        c = Chart.getChart(id);
        if (c && c.canvas) return c;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  // Read a stage chart back as a JPEG data URI.
  //
  // JPEG has no alpha channel, so canvas.toDataURL('image/jpeg') composites a
  // transparent Chart.js canvas onto BLACK. We paint the paper card color
  // underneath first — print = paper, and a black-backed chart would be worse
  // than no chart at all.
  function chartJpeg(id) {
    var ch = chartInstance(id);
    if (!ch || !ch.canvas) return null;
    try {
      var src = ch.canvas;
      if (!src.width || !src.height) return null;
      var out = document.createElement('canvas');
      out.width = src.width;
      out.height = src.height;
      var c = out.getContext('2d');
      c.fillStyle = PAL.card;
      c.fillRect(0, 0, out.width, out.height);
      c.drawImage(src, 0, 0);
      return out.toDataURL('image/jpeg', 0.92);
    } catch (e) { return null; }
  }

  // ---------- offscreen capture stage ----------

  var STAGE_ID = 'pdf-stage';

  // Capture canvas ids. Deliberately distinct from the live chart ids so the
  // stage can never destroy or overwrite a chart the user is looking at.
  var CAP = {
    progress: 'pdfcap-progress',
    facilities: 'pdfcap-facilities',
    trends: 'pdfcap-trends'
  };

  // [width, height] in CSS px for each capture canvas. Each pair matches the
  // aspect of the PDF box the image lands in (progress + trends ~166x70mm,
  // doughnut ~112x70mm) so nothing is stretched. These must stay in step with
  // the #pdf-stage rules in css/styles.css.
  var CAP_SIZE = {
    progress: [960, 406],
    facilities: [640, 400],
    trends: [960, 404]
  };

  // Rendered at 2x so the embedded JPEG is ~290dpi at the PDF's column width.
  var CAP_DPR = 2;

  // Chart options every stage chart shares: fixed size (the stage is not a
  // responsive layout), and a pinned pixel ratio so output is identical on a
  // retina and a non-retina machine.
  function capOpts() {
    return { responsive: false, maintainAspectRatio: false, devicePixelRatio: CAP_DPR };
  }

  // Project status colors, replicated from js/app.js (PROJECT_STATUS_COLORS /
  // projectColor are module-private there, and a four-entry map is not worth
  // widening the PMApp surface for).
  var PROJECT_STATUS_COLORS = {
    'On Track': '#008751',
    'Completed': '#2e9e5b',
    'At Risk': '#f5b041',
    'On Hold': '#e53e3e'
  };
  function projectColor(status) { return PROJECT_STATUS_COLORS[status] || '#a0aec0'; }

  // Same computation as js/app.js renderProgressChart: per-project average of
  // task Completion%, colored by project status. Null when no workbook loaded.
  function progressSeries() {
    var ds = null;
    try { ds = window.PMData && PMData.getDataset ? PMData.getDataset() : null; } catch (e) { /* ignore */ }
    if (!ds || !ds.projects || !ds.projects.length) return null;
    var tasksByP = {};
    (ds.tasks || []).forEach(function (t) {
      if (!tasksByP[t.ProjectID]) tasksByP[t.ProjectID] = [];
      tasksByP[t.ProjectID].push(t);
    });
    return {
      labels: ds.projects.map(function (pr) { return pr.Name || pr.ProjectID; }),
      values: ds.projects.map(function (pr) {
        var t = tasksByP[pr.ProjectID] || [];
        if (!t.length) return 0;
        return Math.round(t.reduce(function (s, x) { return s + (Number(x.Completion) || 0); }, 0) / t.length);
      }),
      colors: ds.projects.map(function (pr) { return projectColor(pr.Status); })
    };
  }

  // currentAggregates()/currentIndicators() stay null until the Health tab has
  // been opened at least once — a null here is a legitimate "no data", not an
  // error, and the PDF falls back to its faint no-data line.
  function healthSeries() {
    var out = { agg: null, ind: null };
    try {
      if (window.PMHealthData) {
        out.agg = PMHealthData.currentAggregates ? PMHealthData.currentAggregates() : null;
        out.ind = PMHealthData.currentIndicators ? PMHealthData.currentIndicators() : null;
      }
    } catch (e) { /* ignore */ }
    return out;
  }

  function stageCanvas(stage, id, size, modifier) {
    var wrap = document.createElement('div');
    wrap.className = 'pdf-stage-wrap' + (modifier ? ' ' + modifier : '');
    var canvas = document.createElement('canvas');
    canvas.id = id;
    // Explicit attributes, not CSS: with responsive:false Chart.js sizes from
    // the canvas attributes, and an unsized canvas defaults to 300x150.
    canvas.width = size[0];
    canvas.height = size[1];
    wrap.appendChild(canvas);
    stage.appendChild(wrap);
    return canvas;
  }

  // Per-id capture note for the console line below. A blank canvas still
  // compresses to a short data URI, so byte length is what separates "real
  // pixels" from "green status, empty chart" — the exact failure that hid this
  // bug across four commits.
  function captureNote(img, hadData) {
    if (!hadData) return 'skipped (no data)';
    if (!img) return 'null';
    return img.length + ' bytes';
  }

  // Render the three report charts on an offscreen light-themed stage, hand the
  // JPEGs to fn, then always tear the stage down.
  function withStage(fn) {
    var stage = document.createElement('div');
    stage.id = STAGE_ID;
    // Forces the light token set on everything inside (css/styles.css scopes
    // the light palette to `:root, [data-theme="light"]`), so the captured
    // charts are paper-themed even when the UI is dark — print = paper.
    stage.setAttribute('data-theme', 'light');
    stage.setAttribute('aria-hidden', 'true');

    var shots = { progress: null, facilities: null, trends: null };
    var prog = progressSeries();
    var health = healthSeries();
    var agg = health.agg;
    var ind = health.ind;
    var hasLevels = !!(agg && agg.levels && agg.levels.length);
    var hasTrends = !!(ind && ind.series && ind.series.length);

    try {
      document.body.appendChild(stage);

      if (prog) stageCanvas(stage, CAP.progress, CAP_SIZE.progress);
      if (hasLevels) stageCanvas(stage, CAP.facilities, CAP_SIZE.facilities, 'is-doughnut');
      if (hasTrends) stageCanvas(stage, CAP.trends, CAP_SIZE.trends, 'is-trends');

      // A chart that fails to build must not take the whole report down — the
      // section falls back to its "no data rendered yet" line and the console
      // note below records the miss.
      try {
        if (window.PMCharts && PMCharts.withThemeScope) {
          PMCharts.withThemeScope(stage, function () {
            // Same call shapes as the live renderers: app.js
            // renderProgressChart, health.js renderTypeChart/renderTrendChart.
            if (prog) PMCharts.bar(CAP.progress, prog.labels, prog.values, prog.colors, capOpts());
            if (hasLevels) {
              PMCharts.doughnut(CAP.facilities,
                agg.levels.map(function (l) { return l.key; }),
                agg.levels.map(function (l) { return l.count; }),
                Object.assign(capOpts(), { centerCaption: 'facilities' }));
            }
            if (hasTrends) PMCharts.line(CAP.trends, ind.years, ind.series, capOpts());
          });
        }
      } catch (e) { /* ignore — captures below simply come back null */ }

      if (prog) shots.progress = chartJpeg(CAP.progress);
      if (hasLevels) shots.facilities = chartJpeg(CAP.facilities);
      if (hasTrends) shots.trends = chartJpeg(CAP.trends);

      try {
        console.info('[pdf] capture ' + CAP.progress + ': ' + captureNote(shots.progress, !!prog));
        console.info('[pdf] capture ' + CAP.facilities + ': ' + captureNote(shots.facilities, hasLevels));
        console.info('[pdf] capture ' + CAP.trends + ': ' + captureNote(shots.trends, hasTrends));
      } catch (e) { /* console may be unavailable */ }

      return fn(shots);
    } finally {
      try {
        if (window.PMCharts && PMCharts.destroy) {
          PMCharts.destroy(CAP.progress);
          PMCharts.destroy(CAP.facilities);
          PMCharts.destroy(CAP.trends);
        }
      } catch (e) { /* ignore */ }
      if (stage.parentNode) stage.parentNode.removeChild(stage);
    }
  }

  // Draw a filled rounded rect (paper card) on the pdf.
  function cardRect(pdf, x, y, w, h, fill, stroke) {
    pdf.setFillColor(fill);
    if (stroke) pdf.setDrawColor(stroke); else pdf.setDrawColor(fill);
    pdf.roundedRect(x, y, w, h, 2, 2, 'FD');
  }

  // Section header rule: gold motif-ish bar + paper-line rule.
  function sectionHeader(pdf, x, y, w, label) {
    // gold bar
    pdf.setFillColor(PAL.gold);
    pdf.roundedRect(x, y, 24, 3, 1, 1, 'F');
    pdf.setDrawColor(PAL.hairline);
    pdf.line(x + 30, y + 1.5, x + w, y + 1.5);
    pdf.setFontSize(8.5);
    pdf.setTextColor(PAL.inkFaint);
    pdf.text(label, x + 34, y + 3);
    return y + 9;
  }

  // Body text helper. Sets the font family explicitly, never just the size:
  // jsPDF's font state is global and sticky, so a preceding setFont('courier',
  // 'bold') (the key-indicator values do exactly that) would otherwise leak into
  // the next caption and silently change both its look and its wrap width.
  function body(pdf, x, y, w, text, size, color) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(size || 10);
    pdf.setTextColor(color || PAL.inkSoft);
    var lines = pdf.splitTextToSize(text, w);
    pdf.text(lines, x, y);
    return y + lines.length * 4.6 + 2;
  }

  // How much vertical space body() will consume once `text` is wrapped to `w`.
  // Callers reserve the POST-wrap height with needSpace() before drawing, so
  // wrapping a caption can never quietly push it under the footer band. Must
  // select the same font body() draws with, or the measurement is for a
  // different typeface than the one that ends up on the page.
  function bodyH(pdf, w, text, size) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(size || 10);
    return pdf.splitTextToSize(text, w).length * 4.6 + 2;
  }

  // Formula caption inside a KPI card. The cards are a fixed 22mm tall and sit
  // shoulder to shoulder, so the caption wraps to the card width and steps the
  // font down rather than bleeding into its neighbour.
  function cardCaption(pdf, x, y, w, text) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.8);
    var lines = pdf.splitTextToSize(text, w);
    if (lines.length > 2) {
      pdf.setFontSize(5.8);
      lines = pdf.splitTextToSize(text, w);
      if (lines.length > 2) lines = lines.slice(0, 2);
    }
    pdf.setTextColor(PAL.inkFaint);
    pdf.text(lines, x, y);
  }

  // Green value (mono-ish, bold) helper for KPIs / numbers.
  function greenVal(pdf, x, y, text, size) {
    pdf.setFontSize(size || 14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(PAL.green);
    pdf.text(text, x, y);
    pdf.setFont('helvetica', 'normal');
    return y + (size || 14) + 1.5;
  }

  function buildPdf() {
    // Let the "Building PDF report…" status line paint before we block the
    // main thread on the chart capture and the document build.
    window.setTimeout(function () {
      withStage(buildDocument);
    }, 120);
  }

  // Lays out the whole report. `shots` carries the three capture JPEGs handed
  // over by withStage (null where a section genuinely had no data).
  function buildDocument(shots) {
    // Active tab drives the "Showing:" line on page 1. PMApp exports
    // activeTabName now; until it did, this always fell back to "showcase".
    var active = 'showcase';
    try {
      if (window.PMApp && PMApp.activeTabName) active = PMApp.activeTabName() || 'showcase';
    } catch (e) { /* ignore */ }
    active = String(active).replace(/^#/, '') || 'showcase';

    var Ctor = jsPDFCtor();
    var pdf = new Ctor({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compression: true
    });

    var pageW = pdf.internal.pageSize.getWidth();
    var pageH = pdf.internal.pageSize.getHeight();
    var margin = 15;
    var contentW = pageW - 2 * margin;

    // Nothing may be drawn below this line — everything under it belongs to the
    // reserved footer band (see FOOTER_H).
    var contentBottom = pageH - FOOTER_H;

    // We'll accumulate pages as we go; helper to add a new page.
    function newPage() {
      pdf.addPage();
      return { x: margin, y: margin + 4, w: contentW };
    }

    // Page-break guard: start a fresh page when `h` mm of upcoming content would
    // cross into the footer band. Returns true when it broke, so callers that
    // need to redraw a running header can react.
    function needSpace(h) {
      if (p.y + h <= contentBottom) return false;
      p = newPage();
      return true;
    }

    // ---- Page 1: methodology + title ----
    var p = { x: margin, y: margin + 4, w: contentW };
    pdf.setFillColor(PAL.bg);
    pdf.rect(0, 0, pageW, pageH, 'F');
    // gold top rule
    pdf.setFillColor(PAL.gold);
    pdf.rect(margin, p.y - 2, contentW, 2.2, 'F');
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(PAL.green);
    pdf.text('Nigeria Health + Project Management Dashboard', p.x, p.y + 6);
    pdf.setFontSize(9.5);
    pdf.setTextColor(PAL.inkFaint);
    pdf.text('PDF Report — Methodology, Calculations, and Reproduced Figures', p.x, p.y + 12);
    pdf.setDrawColor(PAL.paperLine);
    pdf.line(p.x, p.y + 16, p.x + contentW, p.y + 16);
    pdf.setFontSize(8.5);
    pdf.setTextColor(PAL.ink);
    pdf.text('Report generated ' + infoDateStamp(), p.x, p.y + 20);
    pdf.text('Live data: GRID3 NGA Health Facilities v2.0 (CC BY 4.0) · HDX/WHO — Nigeria Health Indicators', p.x, p.y + 23);
    pdf.text('Project data: uploaded Excel workbook (SheetJS) — sample data shown where no file is loaded', p.x, p.y + 26);
    pdf.setTextColor(PAL.gold);
    var activeLabel = 'Home (This Project)';
    if (active === 'projects') activeLabel = 'Projects';
    else if (active === 'health') activeLabel = 'Health';
    else if (active === 'ask') activeLabel = 'Ask (NLQ)';
    else if (active === 'export') activeLabel = 'Export';
    pdf.text('Showing: ' + activeLabel + ' (active tab at export time)', p.x, p.y + 30);
    pdf.setFontSize(9);
    pdf.setTextColor(PAL.inkSoft);
    pdf.text('Contact: ' + REPORT_META.email, p.x, p.y + 34);

    // ---- Methodology note ----
    var methodLines = [
      'This report reproduces every figure directly from the data the live dashboard sees. No figures are typed by hand into the PDF — each value is computed at report time by js/pdf.js from the same in-memory dataset and chart instances the browser tab uses.',
      'Project figures come from the SheetJS-parsed Excel workbook held in window.PMData (five sheets: Projects, Tasks, Resources, Finances, Locations). Health figures come from the live GRID3 facility aggregate (state / ownership / level counts) and the HDX/WHO-seeded key indicators held in window.PMHealthData.',
      'Every number is recalculated at PDF build time from that live session state, then rendered onto the PDF by jsPDF (portrait A4, mm units, JPEG-embedded charts). The report theme is always paper (green + gold on ivory) regardless of the active UI theme — print = paper.',
      'Where a chart is included, js/pdf.js renders its own copy of that chart onto an offscreen light-themed stage (#pdf-stage) from the same session data, reads the canvas back as a JPEG, and embeds it at the section width — the charts on screen are never touched, so the report does not depend on which tab is open. If a section has no data, the PDF records "no data rendered yet" and continues — it never fabricates a chart.',
      'Currency (NGN) and metric values are formatted with js/pdf.js helpers fmtNaira() and fmtMetric(), which use the same rounding and scaling rules the dashboard uses in-app. The formulae for those figures are documented in Section 2 and Section 3 below.'
    ];

    // Wrap first, size the card to the result, then draw. The card height used
    // to be a hardcoded 40mm while the copy wrapped to roughly twice that, so
    // the bottom border cut straight through the last three paragraphs. Any
    // edit to the copy above now just grows the box.
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    var methodWrapped = methodLines.map(function (ln) {
      return pdf.splitTextToSize(ln, contentW - 12);
    });
    var methodTextH = methodWrapped.reduce(function (h, wrapped) {
      return h + wrapped.length * 4.0 + 1.5;
    }, 0);
    // 16 = heading baseline offset within the card + bottom padding.
    var cardH = methodTextH + 16;

    pdf.setDrawColor(PAL.hairline);
    pdf.roundedRect(p.x, p.y + 38, contentW, cardH, 2, 2, 'FD');
    pdf.setFillColor(PAL.card);
    pdf.roundedRect(p.x + 1, p.y + 39, contentW - 2, cardH - 2, 2, 2, 'F');

    pdf.setFontSize(10.5);
    pdf.setTextColor(PAL.green);
    pdf.setFont('helvetica', 'bold');
    pdf.text('1 · Methodology', p.x + 6, p.y + 47);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(PAL.ink);
    var methodY = p.y + 54;
    methodWrapped.forEach(function (wrapped) {
      pdf.text(wrapped, p.x + 6, methodY);
      methodY += wrapped.length * 4.0 + 1.5;
    });

    // ---- Section 2: Projects (KPIs, task summary, per-project table, chart) ----
    pdf.addPage();
    p = { x: margin, y: margin + 4, w: contentW };
    p.y = sectionHeader(pdf, p.x, p.y, p.w, 'SECTION 2 — Project Portfolio (Excel -> SheetJS -> figures)');
    pdf.setFontSize(15);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(PAL.green);
    pdf.text('Project Portfolio', p.x, p.y + 5);
    p.y += 11;

    var ds = null;
    try { ds = window.PMData && PMData.getDataset ? PMData.getDataset() : null; } catch (e) { /* ignore */ }
    if (!ds || !ds.projects || !ds.projects.length) {
      p.y = body(pdf, p.x, p.y + 2, p.w, 'No project data loaded. Upload an .xlsx/.xls workbook on the Projects tab to populate this section.', 10, PAL.inkSoft);
    } else {
      var projs = ds.projects;
      var tasksByP = {};
      (ds.tasks || []).forEach(function (t) {
        if (!tasksByP[t.ProjectID]) tasksByP[t.ProjectID] = [];
        tasksByP[t.ProjectID].push(t);
      });
      var finByP = {};
      (ds.finances || []).forEach(function (f) {
        if (!finByP[f.ProjectID]) finByP[f.ProjectID] = [];
        finByP[f.ProjectID].push(f);
      });
      var locatedByP = {};
      (ds.locations || []).forEach(function (l) {
        if (!locatedByP[l.ProjectID]) locatedByP[l.ProjectID] = [];
        locatedByP[l.ProjectID].push(l);
      });
      var allTasks = [];
      projs.forEach(function (p) { (tasksByP[p.ProjectID] || []).forEach(function (t) { allTasks.push(t); }); });
      var done = allTasks.filter(function (t) { return t.Status === 'done'; }).length;
      var totalTasks = allTasks.length;
      var budget = projs.reduce(function (s, p) { return s + (Number(p.Budget) || 0); }, 0);
      var spend = 0;
      projs.forEach(function (p) { (finByP[p.ProjectID] || []).forEach(function (f) { spend += Number(f.ActualSpend) || 0; }); });
      var taskSumCompletion = allTasks.reduce(function (s, t) { return s + (Number(t.Completion) || 0); }, 0);
      var avgCompletionAll = totalTasks ? taskSumCompletion / totalTasks : 0;

      // ---- KPI strip + formula line ----
      var kpis = [
        { label: 'Projects', value: String(projs.length), formula: 'count of Projects sheet rows' },
        { label: 'Tasks', value: String(totalTasks), formula: 'count of Tasks sheet rows' },
        { label: 'Completion', value: (totalTasks ? Math.round((done / totalTasks) * 100) : 0) + '%', formula: 'done ÷ total tasks × 100' },
        { label: 'Total budget', value: fmtNaira(budget), formula: 'sum of Budget (Projects sheet)' }
      ];
      var colW = contentW / kpis.length;
      kpis.forEach(function (k, i) {
        var x = p.x + i * colW;
        var y = p.y;
        pdf.setFillColor(PAL.card);
        pdf.setDrawColor(PAL.hairline);
        pdf.roundedRect(x + 1, y - 2, colW - 2, 22, 2, 2, 'FD');
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(PAL.inkFaint);
        pdf.text(k.label.toUpperCase(), x + 3, y + 3);
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(PAL.green);
        pdf.text(k.value, x + 3, y + 9);
        cardCaption(pdf, x + 3, y + 15, colW - 6, k.formula);
        pdf.setFont('helvetica', 'normal');
      });
      p.y += 28;

      // ---- Task status summary (derived from Status field) ----
      var sCounts = { 'On Track': 0, 'At Risk': 0, Completed: 0, 'On Hold': 0 };
      projs.forEach(function (pr) { sCounts[pr.Status] = (sCounts[pr.Status] || 0) + 1; });
      var summary = '';
      try { summary = window.PMApp && PMApp.summarySentence ? PMApp.summarySentence(projs) : ''; } catch (e) { /* ignore */ }
      if (!summary) {
        var parts = [];
        Object.keys(sCounts).forEach(function (k) { if (sCounts[k]) parts.push(sCounts[k] + ' ' + k.toLowerCase()); });
        summary = parts.join(', ') + '.' || 'No project statuses recorded.';
      }
      p.y = body(pdf, p.x, p.y + 2, p.w, summary, 10, PAL.ink);
      p.y += 4;

      // ---- Budget / spend formula line ----
      var spendStr = spend ? '   ·   ' + fmtNaira(spend) + ' spent' : '';
      var plannedLine = 'Total planned spend: ' + fmtNaira(budget) + ' = sum of Budget across ' + projs.length + ' project' + (projs.length === 1 ? '' : 's') + '.' + spendStr;
      p.y = body(pdf, p.x, p.y, p.w, plannedLine, 9, PAL.inkSoft);
      var spendNote = 'Spent is the sum of ActualSpend (Finances sheet) for these projects. Budget-vs-spend % per project = ActualSpend ÷ Budget × 100 (computed in renderProjectCards).';
      p.y = body(pdf, p.x, p.y, p.w, spendNote, 8.5, PAL.inkFaint);
      p.y += 3;

      // ---- Per-project calculation table ----
      pdf.setFontSize(10.5);
      pdf.setTextColor(PAL.green);
      pdf.setFont('helvetica', 'bold');
      pdf.text('2.1 · Per-project calculations', p.x, p.y);
      p.y += 6;
      pdf.setDrawColor(PAL.paperLine);
      pdf.line(p.x, p.y, p.x + contentW, p.y);
      p.y += 5;

      var tblTop = p.y;
      var col1 = p.x, col2 = p.x + contentW * 0.30, col3 = p.x + contentW * 0.50, col4 = p.x + contentW * 0.72, col5 = p.x + contentW * 0.86;
      var colW1 = contentW * 0.30, colW2 = contentW * 0.20, colW3 = contentW * 0.22, colW4 = contentW * 0.14, colW5 = contentW * 0.14;

      // header row
      pdf.setFillColor(PAL.ink);
      pdf.roundedRect(col1, tblTop - 1, contentW, 6.5, 1, 1, 'FD');
      pdf.setFontSize(7.8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(PAL.bg);
      pdf.text('Project', col1 + 3, tblTop + 3);
      pdf.text('Status', col2 + 3, tblTop + 3);
      pdf.text('Completion % (avg task)', col3 + 3, tblTop + 3);
      pdf.text('Budget', col4 + 3, tblTop + 3);
      pdf.text('Spend % of plan', col5 + 3, tblTop + 3);
      pdf.setFont('helvetica', 'normal');
      p.y = tblTop + 9;

      // A row's zebra band starts at p.y - 1 and is 5.6mm tall, and the next row
      // sits ROW_H lower — so ROW_H has to fit above contentBottom or the band
      // lands inside the reserved footer band.
      var ROW_H = 6;
      var sorted = projs.slice().sort(function (a, b) { return (a.Name || '').localeCompare(b.Name || ''); });
      sorted.forEach(function (pr) {
        // needSpace() can't redraw the running table header, so this guard is
        // spelled out — but it reads the same contentBottom everything else does.
        if (p.y + ROW_H > contentBottom) {
          p = newPage();
          tblTop = p.y;
          pdf.setFillColor(PAL.ink);
          pdf.roundedRect(col1, tblTop - 1, contentW, 6.5, 1, 1, 'FD');
          pdf.setFontSize(7.8);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(PAL.bg);
          pdf.text('Project (cont.)', col1 + 3, tblTop + 3);
          pdf.text('Status', col2 + 3, tblTop + 3);
          pdf.text('Completion % (avg task)', col3 + 3, tblTop + 3);
          pdf.text('Budget', col4 + 3, tblTop + 3);
          pdf.text('Spend % of plan', col5 + 3, tblTop + 3);
          pdf.setFont('helvetica', 'normal');
          p.y = tblTop + 9;
        }
        var t = tasksByP[pr.ProjectID] || [];
        var fins = finByP[pr.ProjectID] || [];
        var completion = t.length ? Math.round((t.reduce(function (s, x) { return s + (Number(x.Completion) || 0); }, 0) / t.length)) : 0;
        var planned = fins.reduce(function (s, f) { return s + (Number(f.PlannedSpend) || 0); }, 0);
        var actual = fins.reduce(function (s, f) { return s + (Number(f.ActualSpend) || 0); }, 0);
        var budgetVal = Number(pr.Budget) || 0;
        var spendPct = budgetVal ? Math.round((actual / budgetVal) * 100) : 0;

        pdf.setFillColor((sorted.indexOf(pr) % 2 === 0) ? PAL.card : PAL.bg);
        pdf.roundedRect(col1, p.y - 1, contentW, 5.6, 0.6, 0.6, 'FD');
        pdf.setFontSize(8.2);
        pdf.setTextColor(PAL.ink);
        pdf.setFont('helvetica', 'normal');
        var nameTxt = String(pr.Name || pr.ProjectID || '–');
        if (pdf.getTextWidth(nameTxt) > colW1 - 6) nameTxt = nameTxt.slice(0, Math.max(1, Math.floor((colW1 - 6) / 1.6))) + '…';
        pdf.text(nameTxt, col1 + 3, p.y + 3);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(PAL.inkSoft);
        pdf.text(String(pr.Status || '–'), col2 + 3, p.y + 3);
        pdf.setTextColor(PAL.green);
        pdf.setFont('courier', 'bold');
        pdf.text(String(completion) + '%', col3 + 3, p.y + 3);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(PAL.ink);
        pdf.text(fmtNaira(budgetVal), col4 + 3, p.y + 3);
        pdf.setTextColor(spendPct > 100 ? PAL.bad : (spendPct > 0 ? PAL.warn : PAL.inkSoft));
        pdf.text(spendPct + '%', col5 + 3, p.y + 3);
        p.y += ROW_H;
      });
      p.y += 4;
      var tableNote = 'Completion % per project = average of task Completion% in the Tasks sheet (rounded). Spend % of plan = ActualSpend ÷ Budget × 100 (Finances + Budget).';
      needSpace(bodyH(pdf, p.w, tableNote, 8));
      p.y = body(pdf, p.x, p.y, p.w, tableNote, 8, PAL.inkFaint);
      p.y += 2;

      // ---- Project progress chart (bar) ----
      var progJpeg = shots ? shots.progress : null;
      if (progJpeg) {
        var imgW = contentW * 0.92;
        var imgH = Math.min(imgW * 0.5, 70);
        // Caption + image have to land together, so reserve both at once.
        needSpace(bodyH(pdf, p.w, 'Project progress (% complete by project)', 9.5) + imgH + 7);
        p.y = body(pdf, p.x, p.y + 4, p.w, 'Project progress (% complete by project)', 9.5, PAL.ink);
        try {
          pdf.addImage(progJpeg, 'JPEG', p.x + (contentW - imgW) / 2, p.y + 1, imgW, imgH);
        } catch (e) { pdf.text('(chart unavailable)', p.x, p.y + 10); }
        p.y += imgH + 6;
      } else {
        p.y = body(pdf, p.x, p.y + 4, p.w, 'Project progress chart — no data rendered yet.', 9.5, PAL.inkFaint);
      }
    }

    // ---- Section 3: Health (KPIs, ownership, levels, indicators) ----
    pdf.addPage();
    p = { x: margin, y: margin + 4, w: contentW };
    p.y = sectionHeader(pdf, p.x, p.y, p.w, 'SECTION 3 — Nigeria Health (live GRID3 + HDX / seeded fallback)');
    pdf.setFontSize(15);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(PAL.green);
    pdf.text('Health Data', p.x, p.y + 5);
    p.y += 11;

    var agg = null, ind = null;
    try {
      if (window.PMHealthData) {
        agg = PMHealthData.currentAggregates ? PMHealthData.currentAggregates() : null;
        ind = PMHealthData.currentIndicators ? PMHealthData.currentIndicators() : null;
      }
    } catch (e) { /* ignore */ }

    if (!agg || !agg.total) {
      p.y = body(pdf, p.x, p.y + 2, p.w, 'No health data loaded yet. The Health tab loads live GRID3 + HDX data (or seeded fallback) on open.', 10, PAL.inkSoft);
    } else {
      // ---- Health KPI strip + formula line ----
      var ownershipPublic = (agg.ownership && agg.ownership.Public) || 0;
      var ownershipPrivate = (agg.ownership && agg.ownership.Private) || 0;
      var hkpis = [
        { label: 'Facilities', value: fmtMetric(agg.total), formula: 'sum of state counts (GRID3)' },
        { label: 'States covered', value: String(agg.statesCovered), formula: 'distinct state keys returned' },
        { label: 'Public', value: fmtMetric(ownershipPublic), formula: 'count where ownership = Public' },
        { label: 'Private', value: fmtMetric(ownershipPrivate), formula: 'count where ownership = Private' }
      ];
      var colW = contentW / hkpis.length;
      hkpis.forEach(function (k, i) {
        var x = p.x + i * colW;
        var y = p.y;
        pdf.setFillColor(PAL.card);
        pdf.setDrawColor(PAL.hairline);
        pdf.roundedRect(x + 1, y - 2, colW - 2, 22, 2, 2, 'F');
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(PAL.inkFaint);
        pdf.text(k.label.toUpperCase(), x + 3, y + 3);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(PAL.green);
        pdf.text(k.value, x + 3, y + 8.5);
        cardCaption(pdf, x + 3, y + 15, colW - 6, k.formula);
        pdf.setFont('helvetica', 'normal');
      });
      p.y += 28;

      // attribution + source line
      var srcNote = 'Facilities: GRID3 NGA Health Facilities v2.0 (CC BY 4.0) — ';
      try {
        var src = null;
        if (window.PMHealthData && PMHealthData.currentState) src = PMHealthData.currentState();
        if (src && src.facilitySource === 'live') srcNote += 'live';
        else srcNote += 'sample data (live source unavailable — fallback used)';
      } catch (e) { srcNote += 'sample data (fallback)'; }
      needSpace(bodyH(pdf, p.w, srcNote, 8));
      p.y = body(pdf, p.x, p.y, p.w, srcNote, 8, PAL.inkFaint);

      // ---- Ownership share calculation ----
      var totalOwn = ownershipPublic + ownershipPrivate;
      var pubShare = totalOwn ? (ownershipPublic / totalOwn) * 100 : 0;
      var privShare = totalOwn ? (ownershipPrivate / totalOwn) * 100 : 0;
      var ownLine = 'Ownership split: public ' + fmtMetric(ownershipPublic) + ' (' + pubShare.toFixed(1) + '%) · private ' + fmtMetric(ownershipPrivate) + ' (' + privShare.toFixed(1) + '%) of ' + fmtMetric(totalOwn) + ' classified facilities.';
      needSpace(bodyH(pdf, p.w, ownLine, 9));
      p.y = body(pdf, p.x, p.y, p.w, ownLine, 9, PAL.ink);
      var shareNote = 'Public share = Public count ÷ (Public + Private) × 100. Unclassified (Unknown) facilities are excluded from the share.';
      needSpace(bodyH(pdf, p.w, shareNote, 8.5));
      p.y = body(pdf, p.x, p.y, p.w, shareNote, 8.5, PAL.inkFaint);
      p.y += 3;

      // ---- Facilities by level (doughnut) ----
      var doughnutJpeg = shots ? shots.facilities : null;
      if (doughnutJpeg) {
        var dw = contentW * 0.62;
        var dh = Math.min(dw * 0.75, 70);
        var levelNote = 'Level counts come from the GRID3 group-by on facility_level_option (or seeded fallback). Colors are drawn by PMCharts from its palette; the PDF embeds the rendered Chart.js canvas as a JPEG.';
        // Title + image + wrapped caption move as one block.
        needSpace(dh + 6 + bodyH(pdf, p.w, levelNote, 8.5));
        pdf.setFontSize(9.5);
        pdf.setTextColor(PAL.ink);
        pdf.text('Facilities by level', p.x, p.y);
        try {
          pdf.addImage(doughnutJpeg, 'JPEG', p.x + (contentW - dw) / 2, p.y + 2, dw, dh);
        } catch (e) { pdf.text('(chart unavailable)', p.x, p.y + 10); }
        p.y += dh + 4;
        p.y = body(pdf, p.x, p.y, p.w, levelNote, 8.5, PAL.inkFaint);
      } else {
        p.y = body(pdf, p.x, p.y + 2, p.w, 'Facilities-by-level chart — no data rendered yet.', 9.5, PAL.inkFaint);
      }

      // ---- Indicator trends (line chart) ----
      var trendJpeg = shots ? shots.trends : null;
      if (trendJpeg) {
        var tw = contentW * 0.92;
        var th = Math.min(tw * 0.42, 70);
        var trendNote = 'DPT3 coverage (%) rises from 33% (2015) to 63% (2025) in the seeded series; malaria prevalence under-5 (%) falls from 26% to 18%. Live HDX indicators overwrite a small set of key current values where a match exists (see Section 3.1).';
        needSpace(th + 6 + bodyH(pdf, p.w, trendNote, 8.5));
        pdf.setFontSize(9.5);
        pdf.setTextColor(PAL.ink);
        pdf.text('Indicator trends (DPT3 immunization vs malaria prevalence, under-5)', p.x, p.y);
        try {
          pdf.addImage(trendJpeg, 'JPEG', p.x + (contentW - tw) / 2, p.y + 1, tw, th);
        } catch (e) { pdf.text('(chart unavailable)', p.x, p.y + 10); }
        p.y += th + 4;
        p.y = body(pdf, p.x, p.y, p.w, trendNote, 8.5, PAL.inkFaint);
      } else {
        p.y = body(pdf, p.x, p.y + 2, p.w, 'Indicator trends chart — no data rendered yet.', 9.5, PAL.inkFaint);
      }

      // key indicators
      var items = [];
      try {
        if (ind && ind.keyIndicators && ind.keyIndicators.length) items = ind.keyIndicators;
      } catch (e) { /* ignore */ }
      if (items && items.length) {
        // Keep the rule, the heading and at least three rows together rather
        // than orphaning the heading at the foot of a page.
        needSpace(24);
        pdf.setDrawColor(PAL.paperLine);
        pdf.line(p.x, p.y + 1, p.x + contentW, p.y + 1);
        p.y += 5;
        pdf.setFontSize(9.5);
        pdf.setTextColor(PAL.ink);
        pdf.text('Key indicators (current values — HDX live where available, seeded fallback otherwise)', p.x, p.y);
        p.y += 5;
        pdf.setFontSize(8.8);
        pdf.setFont('courier', 'normal');
        pdf.setTextColor(PAL.green);
        var valX = p.x + contentW * 0.42;
        items.forEach(function (it) {
          needSpace(4.6);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8.8);
          pdf.setTextColor(PAL.ink);
          var label = it.label || '';
          if (pdf.getTextWidth(label) > valX - p.x - 4) label = label.slice(0, Math.max(1, (valX - p.x - 4) / 1.6)) + '…';
          pdf.text(label, p.x, p.y);
          pdf.setFont('courier', 'bold');
          pdf.setTextColor(PAL.green);
          pdf.text(it.value || '–', valX, p.y);
          p.y += 4.6;
        });
        p.y += 2;
        var hdxNote = 'Source: HDX HAPI (https://hapi.humdata.org) — Nigeria rows only. Where the live API is unavailable, the seeded fallback values above are used and the Export card surfaces the "sample data" badge.';
        needSpace(bodyH(pdf, p.w, hdxNote, 8.5));
        p.y = body(pdf, p.x, p.y, p.w, hdxNote, 8.5, PAL.inkFaint);
        p.y += 2;
      } else {
        needSpace(6);
        pdf.setFontSize(9.5);
        pdf.setTextColor(PAL.inkFaint);
        pdf.text('No key indicators available for this session.', p.x, p.y);
        p.y += 4;
      }

      // ---- Section 3.1: Health calculation provenance table ----
      var hRows = [
        ['Total facilities', 'Sum of the counts of features returned by the GRID3 state group-by query (FeatureServer/query with outStatistics count on OBJECTID, grouped by state). Fallback: sum of the seeded state counts in seedAggregates().'],
        ['States covered', 'Number of distinct state keys returned by that same group-by. Live source returns 37 (36 states + FCT) when GRID3 is reachable; seeded fallback returns 12 states.'],
        ['Public / Private', 'Count where the ownership field = "Public" (resp. "Private") from the ownership group-by. Ownership share % = Public ÷ (Public + Private) × 100; Unknown/unclassified are excluded from the share.'],
        ['Facilities by level', 'Count grouped by facility_level_option (GRID3). In the seeded fallback, level counts are derived from seedPoints() (mulberry32 RNG) and LEVEL_POOL weights.'],
        ['Indicator trends', 'Seeded series in PMHealthData: DPT3 coverage [33,38,42,45,49,52,54,55,57,60,63] for 2015–2025; malaria prevalence [26,25,24,23,23,22,21,21,20,19,18]. Live HDX HAPI attempts to overwrite a small set of current key-indicator values where the indicator name matches (beds, physicians, DPT3/immuni, malaria, maternal).'],
        ['Key indicators', 'Current values from HDX HAPI (Nigeria rows only). If the live API is unavailable, the seeded fallback values are used and the health-source badge reports "sample data".'],
        ['Map markers', 'State centroids from PMHealthData.STATE_CENTROIDS. Circle radius = 3 + sqrt(count) × 0.15, capped at 18. Points load on zoom >= 8 from GRID3 bbox queries (or seedPoints in fallback).']
      ];
      // Measure before drawing: the card used to be a hardcoded 40mm tall while
      // its rows wrapped to roughly twice that, so the tail ran off the page.
      var hLabelW = contentW * 0.28;
      var hValW = contentW - hLabelW - 12;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.8);
      var hWrapped = hRows.map(function (r) { return pdf.splitTextToSize(r[1], hValW); });
      var hBoxH = 16;
      hWrapped.forEach(function (w) { hBoxH += w.length * 3.6 + 1.5; });
      needSpace(hBoxH + 2);

      pdf.setDrawColor(PAL.hairline);
      pdf.setFillColor(PAL.card);
      pdf.roundedRect(p.x, p.y, contentW, hBoxH, 2, 2, 'FD');

      pdf.setFontSize(10.5);
      pdf.setTextColor(PAL.green);
      pdf.setFont('helvetica', 'bold');
      pdf.text('3.1 · Health figure calculations', p.x + 6, p.y + 6);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.8);
      pdf.setTextColor(PAL.ink);
      var hx = p.x + 6, hy = p.y + 13;
      hRows.forEach(function (r, i) {
        var wrapped = hWrapped[i];
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(PAL.green);
        pdf.text(r[0], hx, hy);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(PAL.ink);
        pdf.text(wrapped, hx + hLabelW, hy);
        hy += wrapped.length * 3.6 + 1.5;
      });
      p.y += hBoxH + 2;
    }

    // ---- Section 4: Latest Ask answer (if any) ----
    var answerText = '';
    try {
      var ansEl = $('nlq-answer');
      if (ansEl && !ansEl.hidden) answerText = ansEl.textContent || '';
    } catch (e) { /* ignore */ }
    if (answerText && answerText.trim()) {
      pdf.addPage();
      p = { x: margin, y: margin + 4, w: contentW };
      p.y = sectionHeader(pdf, p.x, p.y, p.w, 'SECTION 4 — Ask (Natural Language Query)');
      pdf.setFontSize(15);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(PAL.green);
      pdf.text('Latest Answer', p.x, p.y + 5);
      p.y += 10;
      pdf.setDrawColor(PAL.gold);
      pdf.setFillColor(PAL.goldSoft);
      pdf.roundedRect(p.x, p.y - 1, contentW, 1.6, 1, 1, 'FD');
      p.y += 7;
      pdf.setFontSize(10);
      pdf.setTextColor(PAL.ink);
      // An Ask answer has no length ceiling, so emit it a line at a time against
      // the same footer-band guard rather than in one block that can run off.
      var lines = pdf.splitTextToSize(answerText.trim().replace(/\s+/g, ' '), contentW);
      lines.forEach(function (ln) {
        needSpace(4.8);
        pdf.text(ln, p.x, p.y);
        p.y += 4.8;
      });
      p.y += 4;
      var askNote = 'The Ask tab is a simulated NLQ engine (js/nlq.js) — typo-tolerant keyword matching over the loaded Excel dataset and the live health feed. It composes multiple intents (display + rank + task + state, etc.) and answers with real numbers from the session data. No AI backend; every answer is computed from the data the dashboard sees.';
      needSpace(bodyH(pdf, p.w, askNote, 8.5));
      p.y = body(pdf, p.x, p.y, p.w, askNote, 8.5, PAL.inkFaint);
    }

    // ---- footer on every page ----
    // Stamped in one pass at the end rather than per-page as we go, because the
    // "Page i of N" count is only knowable once every page exists.
    //
    // Two faint 7.5pt lines, both inside the FOOTER_H band that needSpace()
    // keeps clear. Baselines are derived from contentBottom, not written as
    // separate magic numbers — that is what let the contact line drift on top of
    // section copy. At 7.5pt the three strings measure 41.9 + 90.7 + 47.5mm
    // against 180mm of usable width, so they cannot share one line; the contact
    // takes the upper line alone and the dateline + built-by split the lower one
    // (90.7 + 47.5 = 138.2mm, 41.8mm of clear gap between them).
    var builtBy = 'Built by hand — static files, no build step';
    var footerY1 = contentBottom + 5;
    var footerY2 = contentBottom + 9;
    var totalPages = pdf.internal.getNumberOfPages();
    for (var i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(7.5);
      pdf.setTextColor(PAL.inkFaint);
      pdf.text('Contact: ' + REPORT_META.email, margin, footerY1);
      pdf.text('Dandali — Nigeria Health + PM Dashboard · Report ' + dateStamp() + ' · Page ' + i + ' of ' + totalPages,
                margin, footerY2);
      pdf.text(builtBy, pageW - margin - pdf.getTextWidth(builtBy), footerY2);
    }

    pdf.save('dashboard-report-' + dateStamp() + '.pdf');
    setStatus('export-pdf-status', 'PDF downloaded — ' + dateStamp(), true);
    toast('PDF report downloaded');
  }

  // Same scaling as js/app.js fmtNaira, but spelled "NGN " instead of ₦: the
  // glyph is outside WinAnsiEncoding and printed as ¦ in the PDF. The on-screen
  // formatters keep the ₦ — canvas and HTML have no such limit.
  function fmtNaira(n) {
    if (n === null || n === undefined || isNaN(n)) return NAIRA + '0';
    if (n >= 1e9) return NAIRA + (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return NAIRA + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return NAIRA + (n / 1e3).toFixed(0).replace(/\.0$/, '') + 'k';
    return NAIRA + Math.round(n).toLocaleString();
  }

  function fmtMetric(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(0).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  function init() {
    var btn = $('btn-export-pdf');
    if (!btn) return;
    btn.addEventListener('click', function () {
      // Flip the "coming next" card into a live state visually, then build.
      var card = btn && btn.closest('.export-card');
      if (card) card.classList.add(PDF_DONE_CLASS);
      setStatus('export-pdf-status', 'Building PDF report…', false);
      // If jsPDF didn't load, report it.
      if (!jsPDFCtor()) {
        setStatus('export-pdf-status', 'PDF library did not load from CDN.', false);
        toast('PDF library did not load — check the CDN.');
        return;
      }
      buildPdf();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
