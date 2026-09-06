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
 * Each chart is rendered to an offscreen canvas at the chart's own pixel size,
 * drawn from its Chart.js instance (registry[id].toBase64Image), then embedded
 * as a JPEG into the PDF at the section's column width. If a chart has no
 * instance (no data / not yet rendered), the PDF notes "No chart data" and
 * continues.
 *
 * Always re-renders the active tab's charts first (destroyAll + repaint active)
 * so the embedded JPEGs reflect the latest data and the latest theme-to-paper
 * styling. Does not disturb user filters beyond the brief re-render.
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

  // Hijack-resilient chart-instance getter. PMCharts keeps instances in a
  // module-local registry; we reach it through the public destroy/… surface
  // where possible, but toBase64Image needs the instance itself. We reach into
  // PMCharts._registry if present (the module closes over `registry`), else
  // fall back to null.
  function chartInstance(id) {
    try {
      var c = window.PMCharts && PMCharts._registry && PMCharts._registry[id];
      if (c && c.chart && c.chart.toBase64Image) return c.chart;
      // Older shape: the registry stores the Chart.js instance directly.
      if (c && c.toBase64Image) return c;
    } catch (e) { /* ignore */ }
    return null;
  }

  // Turn a Chart.js canvas into a JPEG data URI at a given output width (px).
  function chartJpeg(id, outWidth) {
    var ch = chartInstance(id);
    if (!ch) return null;
    try {
      var srcW = ch.width || ch.canvas.width || 400;
      var srcH = ch.height || ch.canvas.height || 220;
      var aspect = (srcH / srcW) || 0.55;
      var outHeight = Math.round(outWidth * aspect);
      return ch.toBase64Image('image/jpeg', 0.92);
    } catch (e) { return null; }
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

  // Body text helper.
  function body(pdf, x, y, w, text, size, color) {
    pdf.setFontSize(size || 10);
    pdf.setTextColor(color || PAL.inkSoft);
    var lines = pdf.splitTextToSize(text, w);
    pdf.text(lines, x, y);
    return y + lines.length * 4.6 + 2;
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
    // Ensure the active tab's charts are fresh so embedded JPEGs reflect latest
    // data and latest paper styling. We temporarily render in light mode for
    // the capture if the UI is dark (paper = paper) — but we do NOT persist
    // that change: we capture, then restore the UI theme to what it was.
    var uiTheme = 'light';
    try { uiTheme = document.documentElement.getAttribute('data-theme') || 'light'; } catch (e) { /* ignore */ }
    var wasDark = (uiTheme === 'dark');

    // Re-render active tab's charts from cached data (no extra network).
    try {
      if (window.PMCharts && PMCharts.destroyAll) PMCharts.destroyAll();
    } catch (e) { /* ignore */ }

    var active = 'showcase';
    try { active = window.PMApp && PMApp.activeTabName ? PMApp.activeTabName() : 'showcase'; } catch (e) { /* ignore */ }
    if (!active || !active.startsWith('#')) active = active.replace(/^#/, '');
    if (!active) active = 'showcase';

    // Re-render the active tab so charts exist for capture.
    try {
      var ds = null;
      if (window.PMData && PMData.getDataset) ds = PMData.getDataset();
      if (active === 'projects' && ds && ds.projects && ds.projects.length) {
        // Re-render projects tab charts via app.renderAll if available.
        if (window.PMApp && PMApp.renderAll) PMApp.renderAll();
      } else if (active === 'health') {
        var agg = null, ind = null;
        if (window.PMHealthData) {
          agg = PMHealthData.currentAggregates ? PMHealthData.currentAggregates() : null;
          ind = PMHealthData.currentIndicators ? PMHealthData.currentIndicators() : null;
        }
        if (window.PMHealth && PMHealth.repaint) PMHealth.repaint();
      } else if (active === 'showcase') {
        if (window.PMShowcase && PMShowcase.repaint) PMShowcase.repaint();
      }
    } catch (e) { /* render may be async; continue anyway */ }

    // Give charts a tick to actually paint before we snap them.
    window.setTimeout(function () {
      var pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compression: true
      });

      var pageW = pdf.internal.pageSize.getWidth();
      var pageH = pdf.internal.pageSize.getHeight();
      var margin = 15;
      var contentW = pageW - 2 * margin;

      // We'll accumulate pages as we go; helper to add a new page.
      function newPage() {
        pdf.addPage();
        return { x: margin, y: margin + 4, w: contentW };
      }

      // ---- Page 1: title page ----
      var p = { x: margin, y: margin + 6, w: contentW };
      pdf.setFillColor(PAL.bg);
      pdf.rect(0, 0, pageW, pageH, 'F');
      // gold top rule
      pdf.setFillColor(PAL.gold);
      pdf.rect(margin, p.y - 4, contentW, 2.2, 'F');
      pdf.setFontSize(11);
      pdf.setTextColor(PAL.inkFaint);
      pdf.text('DANDALI', p.x, p.y);
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(PAL.green);
      pdf.text('Nigeria Health + Project Management Dashboard', p.x, p.y + 7);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(PAL.inkSoft);
      pdf.text('A working health + project-management dashboard for Nigeria', p.x, p.y + 13);
      pdf.text('Built by hand — static files, no build step, live data where available', p.x, p.y + 17);
      pdf.setDrawColor(PAL.paperLine);
      pdf.line(p.x, p.y + 21, p.x + contentW, p.y + 21);
      pdf.setFontSize(8.5);
      pdf.setTextColor(PAL.inkFaint);
      pdf.text('Report generated ' + infoDateStamp(), p.x, p.y + 25);
      pdf.text('Live data: GRID3 NGA Health Facilities v2.0 (CC BY 4.0) · HDX/WHO — Nigeria Health Indicators', p.x, p.y + 28);
      pdf.text('Project data: uploaded Excel workbook (SheetJS) — sample data shown where no file is loaded', p.x, p.y + 31);

      var activeLabel = 'Home (This Project)';
      try {
        if (active === 'projects') activeLabel = 'Projects';
        else if (active === 'health') activeLabel = 'Health';
        else if (active === 'ask') activeLabel = 'Ask (NLQ)';
        else if (active === 'export') activeLabel = 'Export';
      } catch (e) { /* ignore */ }
      pdf.setFontSize(8.5);
      pdf.setTextColor(PAL.gold);
      pdf.text('Showing: ' + activeLabel + ' (active tab at export time)', p.x, p.y + 36);

      // ---- Section 2: Projects ----
      pdf.addPage();
      p = { x: margin, y: margin + 4, w: contentW };
      p.y = sectionHeader(pdf, p.x, p.y, p.w, 'SECTION — Project Portfolio');
      pdf.setFontSize(15);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(PAL.green);
      pdf.text('Project Portfolio', p.x, p.y + 5);
      p.y += 11;

      var ds = null;
      try { ds = window.PMData && PMData.getDataset ? PMData.getDataset() : null; } catch (e) { /* ignore */ }
      if (!ds || !ds.projects || !ds.projects.length) {
        p.y = body(pdf, p.x, p.y + 2, p.w, 'No project data loaded. Upload an Excel workbook on the Projects tab to populate this section.', 10, PAL.inkSoft);
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
        var allTasks = [];
        projs.forEach(function (p) { (tasksByP[p.ProjectID] || []).forEach(function (t) { allTasks.push(t); }); });
        var done = allTasks.filter(function (t) { return t.Status === 'done'; }).length;
        var totalTasks = allTasks.length;
        var budget = projs.reduce(function (s, p) { return s + (Number(p.Budget) || 0); }, 0);
        var spend = 0;
        projs.forEach(function (p) { (finByP[p.ProjectID] || []).forEach(function (f) { spend += Number(f.ActualSpend) || 0; }); });

        // KPI strip
        var kpis = [
          { label: 'Projects', value: String(projs.length) },
          { label: 'Tasks', value: String(totalTasks) },
          { label: 'Completion', value: (totalTasks ? Math.round((done / totalTasks) * 100) : 0) + '%' },
          { label: 'Total budget', value: fmtNaira(budget) }
        ];
        var colW = contentW / kpis.length;
        kpis.forEach(function (k, i) {
          var x = p.x + i * colW;
          var y = p.y;
          pdf.setFillColor(PAL.card);
          pdf.setDrawColor(PAL.hairline);
          pdf.roundedRect(x + 1, y - 2, colW - 2, 20, 2, 2, 'FD');
          pdf.setFontSize(7.5);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(PAL.inkFaint);
          pdf.text(k.label.toUpperCase(), x + 3, y + 3);
          pdf.setFontSize(13);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(PAL.green);
          pdf.text(k.value, x + 3, y + 9);
          pdf.setFont('helvetica', 'normal');
        });
        p.y += 24;

        // task summary sentence
        var summary = '';
        try { summary = window.PMApp && PMApp.summarySentence ? PMApp.summarySentence(projs) : ''; } catch (e) { /* ignore */ }
        if (!summary) {
          var parts = [];
          var sCounts = { 'On Track': 0, 'At Risk': 0, Completed: 0, 'On Hold': 0 };
          projs.forEach(function (p) { sCounts[p.Status] = (sCounts[p.Status] || 0) + 1; });
          Object.keys(sCounts).forEach(function (k) { if (sCounts[k]) parts.push(sCounts[k] + ' ' + k.toLowerCase()); });
          summary = parts.join(', ') + '.' || 'No project statuses recorded.';
        }
        p.y = body(pdf, p.x, p.y + 2, p.w, summary, 10, PAL.ink);
        p.y += 4;

        // budget line
        var spendStr = spend ? '  ·  ' + fmtNaira(spend) + ' spent' : '';
        pdf.setFontSize(9);
        pdf.setTextColor(PAL.inkSoft);
        pdf.text('Total planned spend: ' + fmtNaira(budget) + '.' + spendStr, p.x, p.y);
        p.y += 8;

        // project progress chart (bar)
        var progJpeg = chartJpeg('chart-progress', Math.round(contentW * 0.92));
        if (progJpeg) {
          p.y = body(pdf, p.x, p.y + 4, p.w, 'Project progress (% complete by project)', 9.5, PAL.ink);
          var imgW = contentW * 0.92;
          var imgH = Math.min(imgW * 0.5, 70);
          try {
            pdf.addImage(progJpeg, 'JPEG', p.x + (contentW - imgW) / 2, p.y + 1, imgW, imgH);
          } catch (e) { pdf.text('(chart unavailable)', p.x, p.y + 10); }
          p.y += imgH + 6;
        } else {
          p.y = body(pdf, p.x, p.y + 4, p.w, 'Project progress chart — no data rendered yet.', 9.5, PAL.inkFaint);
        }
      }

      // ---- Section 3: Health ----
      pdf.addPage();
      p = { x: margin, y: margin + 4, w: contentW };
      p.y = sectionHeader(pdf, p.x, p.y, p.w, 'SECTION — Nigeria Health');
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
        p.y = body(pdf, p.x, p.y + 2, p.w, 'No health data loaded yet. The Health tab loads live GRID3 + HDX data (or sample fallback) on open.', 10, PAL.inkSoft);
      } else {
        // KPI strip
        var hkpis = [
          { label: 'Facilities', value: fmtMetric(agg.total) },
          { label: 'States covered', value: String(agg.statesCovered) },
          { label: 'Public', value: fmtMetric(agg.ownership && agg.ownership.Public || 0) },
          { label: 'Private', value: fmtMetric(agg.ownership && agg.ownership.Private || 0) }
        ];
        var colW = contentW / hkpis.length;
        hkpis.forEach(function (k, i) {
          var x = p.x + i * colW;
          var y = p.y;
          pdf.setFillColor(PAL.card);
          pdf.setDrawColor(PAL.hairline);
          pdf.roundedRect(x + 1, y - 2, colW - 2, 18, 2, 2, 'F');
          pdf.setFontSize(7.5);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(PAL.inkFaint);
          pdf.text(k.label.toUpperCase(), x + 3, y + 3);
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(PAL.green);
          pdf.text(k.value, x + 3, y + 8.5);
          pdf.setFont('helvetica', 'normal');
        });
        p.y += 22;

        // attribution line
        var srcNote = 'Facilities: GRID3 NGA Health Facilities v2.0 (CC BY 4.0)';
        try {
          var src = null;
          if (window.PMHealthData && PMHealthData.currentState) src = PMHealthData.currentState();
          if (src && src.facilitySource === 'live') srcNote = srcNote + ' — live';
          else srcNote = srcNote + ' — sample data (fallback)';
        } catch (e) { /* ignore */ }
        pdf.setFontSize(8);
        pdf.setTextColor(PAL.inkFaint);
        pdf.text(srcNote, p.x, p.y);
        p.y += 7;

        // doughnut
        var doughnutJpeg = chartJpeg('chart-facility-types', Math.round(contentW * 0.62));
        if (doughnutJpeg) {
          var dw = contentW * 0.62;
          var dh = Math.min(dw * 0.75, 70);
          pdf.setFontSize(9.5);
          pdf.setTextColor(PAL.ink);
          pdf.text('Facilities by level', p.x, p.y);
          try {
            pdf.addImage(doughnutJpeg, 'JPEG', p.x + (contentW - dw) / 2, p.y + 2, dw, dh);
          } catch (e) { pdf.text('(chart unavailable)', p.x, p.y + 10); }
          p.y += dh + 6;
        } else {
          p.y = body(pdf, p.x, p.y + 2, p.w, 'Facilities-by-level chart — no data rendered yet.', 9.5, PAL.inkFaint);
        }

        // trend chart
        var trendJpeg = chartJpeg('chart-indicator-trends', Math.round(contentW * 0.92));
        if (trendJpeg) {
          pdf.setFontSize(9.5);
          pdf.setTextColor(PAL.ink);
          pdf.text('Indicator trends (DPT3 immunization vs malaria prevalence, under-5)', p.x, p.y);
          var tw = contentW * 0.92;
          var th = Math.min(tw * 0.42, 70);
          try {
            pdf.addImage(trendJpeg, 'JPEG', p.x + (contentW - tw) / 2, p.y + 1, tw, th);
          } catch (e) { pdf.text('(chart unavailable)', p.x, p.y + 10); }
          p.y += th + 6;
        } else {
          p.y = body(pdf, p.x, p.y + 2, p.w, 'Indicator trends chart — no data rendered yet.', 9.5, PAL.inkFaint);
        }

        // key indicators
        var items = [];
        try {
          if (ind && ind.keyIndicators && ind.keyIndicators.length) items = ind.keyIndicators;
        } catch (e) { /* ignore */ }
        if (items && items.length) {
          pdf.setDrawColor(PAL.paperLine);
          pdf.line(p.x, p.y + 1, p.x + contentW, p.y + 1);
          p.y += 5;
          pdf.setFontSize(9.5);
          pdf.setTextColor(PAL.ink);
          pdf.text('Key indicators', p.x, p.y);
          p.y += 5;
          pdf.setFontSize(9.5);
          pdf.setFont('courier', 'normal');
          pdf.setTextColor(PAL.green);
          var valX = p.x + contentW * 0.42;
          items.forEach(function (it) {
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(PAL.ink);
            var label = it.label || '';
            if (pdf.getTextWidth(label) > valX - p.x - 4) label = label.slice(0, Math.max(1, (valX - p.x - 4) / 1.6)) + '…';
            pdf.text(label, p.x, p.y);
            pdf.setFont('courier', 'bold');
            pdf.setTextColor(PAL.green);
            pdf.text(it.value || '–', valX, p.y);
            p.y += 4.6;
          });
          p.y += 3;
        } else {
          pdf.setFontSize(9.5);
          pdf.setTextColor(PAL.inkFaint);
          pdf.text('No key indicators available for this session.', p.x, p.y);
          p.y += 4;
        }
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
        p.y = sectionHeader(pdf, p.x, p.y, p.w, 'SECTION — Latest Ask Answer');
        pdf.setFontSize(15);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(PAL.green);
        pdf.text('Ask (Natural Language Query)', p.x, p.y + 5);
        p.y += 10;
        pdf.setDrawColor(PAL.gold);
        pdf.setFillColor(PAL.goldSoft);
        pdf.roundedRect(p.x, p.y - 1, contentW, 1.6, 1, 1, 'FD');
        p.y += 7;
        // render the answer HTML-ish as plain text lines
        pdf.setFontSize(10);
        pdf.setTextColor(PAL.ink);
        var lines = pdf.splitTextToSize(answerText.trim().replace(/\s+/g, ' '), contentW);
        pdf.text(lines, p.x, p.y);
        p.y += lines.length * 4.8 + 4;
        pdf.setFontSize(8.5);
        pdf.setTextColor(PAL.inkFaint);
        pdf.text('Ask more on the dashboard — type a question in the Ask tab and tap Ask.', p.x, p.y);
      }

      // ---- footer on every page ----
      var footerReached = false;
      pdf.on('pageAdded', function () {
        // jsPDF fires pageAdded; we add footer text per page.
      });
      // Manually stamp footers on each page we created.
      var totalPages = pdf.internal.getNumberOfPages();
      for (var i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(7.5);
        pdf.setTextColor(PAL.inkFaint);
        pdf.text('Dandali — Nigeria Health + PM Dashboard · Report ' + dateStamp() + ' · Page ' + i + ' of ' + totalPages,
                  margin, pageH - 5);
        pdf.text('Built by hand — static files, no build step', pageW - margin - pdf.getTextWidth('Built by hand — static files, no build step'), pageH - 5);
      }

      pdf.save('dashboard-report-' + dateStamp() + '.pdf');
      setStatus('export-pdf-status', 'PDF downloaded — ' + dateStamp(), true);
      toast('PDF report downloaded');
    }, 120);
  }

  function fmtNaira(n) {
    if (n === null || n === undefined || isNaN(n)) return '₦0';
    if (n >= 1e9) return '₦' + (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return '₦' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return '₦' + (n / 1e3).toFixed(0).replace(/\.0$/, '') + 'k';
    return '₦' + Math.round(n).toLocaleString();
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
      if (typeof jsPDF === 'undefined') {
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
