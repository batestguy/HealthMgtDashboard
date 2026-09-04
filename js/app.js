/* ==========================================================================
 * js/app.js — boot + Projects tab (spec §6, Tab 1)
 *
 * Loaded last (after data.js and charts.js) since it wires everything up.
 * ========================================================================== */

window.PMApp = (function () {
  'use strict';

  // ---------- small DOM helpers ----------
  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function fmtNaira(n) {
    if (n === null || n === undefined || isNaN(n)) return '–';
    if (n >= 1e9) return '\u20A6' + trimZero((n / 1e9).toFixed(1)) + 'B';
    if (n >= 1e6) return '\u20A6' + trimZero((n / 1e6).toFixed(1)) + 'M';
    if (n >= 1e3) return '\u20A6' + trimZero((n / 1e3).toFixed(1)) + 'k';
    return '\u20A6' + Math.round(n).toLocaleString();
  }
  function trimZero(s) { return s.replace(/\.0$/, ''); }

  // ---------- status color maps ----------
  var PROJECT_STATUS_COLORS = {
    'On Track': '#008751',
    'Completed': '#2e9e5b',
    'At Risk': '#f5b041',
    'On Hold': '#e53e3e'
  };
  function projectColor(status) { return PROJECT_STATUS_COLORS[status] || '#a0aec0'; }

  var TASK_STATUS_COLORS = { done: '#008751', 'in-progress': '#e9a020', todo: '#a0aec0' };
  var TASK_STATUS_ORDER = { 'in-progress': 0, todo: 1, done: 2 };

  var toastTimer = null;
  function toast(message) {
    var node = $('toast');
    node.textContent = message;
    node.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.hidden = true; }, 2600);
  }

  // ---------- tab navigation ----------
  function initTabs() {
    var buttons = document.querySelectorAll('.tab-btn');
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener('click', function () { activateTab(btn.getAttribute('data-tab')); });
    });
  }

  function activateTab(name) {
    var panels = document.querySelectorAll('.tab-panel');
    Array.prototype.forEach.call(panels, function (p) {
      p.classList.toggle('active', p.id === 'tab-' + name);
    });
    var buttons = document.querySelectorAll('.tab-btn');
    Array.prototype.forEach.call(buttons, function (b) {
      var active = b.getAttribute('data-tab') === name;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  // ---------- Excel upload ----------
  function initUpload() {
    var zone = $('drop-zone');
    var input = $('file-input');

    zone.addEventListener('click', function () { input.click(); });
    zone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('dragover'); });
    });
    zone.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(f);
    });
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) handleFile(input.files[0]);
      input.value = ''; // allow re-selecting the same file
    });

    $('btn-load-sample').addEventListener('click', loadSample);
  }

  function handleFile(file) {
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      toast('Please choose a .xlsx or .xls file.');
      return;
    }
    PMData.loadFromFile(file)
      .then(function (out) {
        renderReport(out.report);
        renderAll();
        toast('Loaded ' + file.name);
      })
      .catch(function (err) { reportError(err.message); });
  }

  function loadSample() {
    PMData.loadSample()
      .then(function (out) {
        renderReport(out.report);
        renderAll();
        toast('Sample data loaded');
      })
      .catch(function (err) { reportError(err.message); });
  }

  function reportError(message) {
    var node = $('upload-report');
    node.classList.remove('ok');
    node.classList.add('err');
    node.textContent = message;
    node.hidden = false;
  }

  // ---------- upload report ----------
  function renderReport(report) {
    var node = $('upload-report');
    node.classList.toggle('ok', report.ok);
    node.classList.toggle('err', !report.ok);

    var lines = [];
    lines.push(report.source + ' — parsed');
    report.sheetResults.forEach(function (r) {
      var line = '• ' + r.name + ': ' + r.rowCount + ' row' + (r.rowCount === 1 ? '' : 's');
      if (!r.ok) line += ' — ' + r.errors.length + ' issue' + (r.errors.length === 1 ? '' : 's');
      lines.push(line);
    });
    if (!report.ok) {
      lines.push('');
      report.sheetResults.forEach(function (r) {
        if (r.ok) return;
        r.errors.slice(0, 4).forEach(function (err) { lines.push('⚠ ' + r.name + ': ' + err); });
      });
      lines.push('Keeping the previously loaded data (if any).');
    }
    node.textContent = lines.join('\n');
    node.hidden = false;
  }

  // ---------- KPIs ----------
  function computeKpis(ds) {
    var total = ds.tasks.length;
    var done = ds.tasks.filter(function (t) { return t.Status === 'done'; }).length;
    var budget = ds.projects.reduce(function (sum, p) { return sum + (Number(p.Budget) || 0); }, 0);
    return {
      projects: ds.projects.length,
      tasks: total,
      completion: total ? Math.round((done / total) * 100) : 0,
      budget: budget
    };
  }

  // ---------- summary sentence ----------
  function summarySentence(ds) {
    var counts = { 'On Track': 0, 'At Risk': 0, Completed: 0, 'On Hold': 0 };
    ds.projects.forEach(function (p) {
      if (p.Status in counts) counts[p.Status]++; else counts[p.Status] = 1;
    });
    var parts = [];
    Object.keys(counts).forEach(function (k) {
      if (counts[k]) parts.push(counts[k] + ' ' + k.toLowerCase());
    });
    if (!parts.length) return 'No project statuses recorded.';
    return parts.join(', ') + '.';
  }

  // ---------- project progress (avg task completion per project) ----------
  function projectProgress(ds) {
    var byProject = {};
    ds.tasks.forEach(function (t) {
      if (!byProject[t.ProjectID]) byProject[t.ProjectID] = [];
      byProject[t.ProjectID].push(t);
    });
    return ds.projects.map(function (p) {
      var tasks = byProject[p.ProjectID] || [];
      var avg = tasks.length
        ? tasks.reduce(function (s, t) { return s + (Number(t.Completion) || 0); }, 0) / tasks.length
        : 0;
      return { id: p.ProjectID, name: p.Name, status: p.Status, avg: avg };
    });
  }

  // ---------- renderers ----------
  function renderAll() {
    var ds = PMData.getDataset();
    if (!ds || !ds.projects.length) { renderEmpty(); return; }
    renderKpis(ds);
    renderChart(ds);
    renderSummary(ds);
    renderTracker(ds);
  }

  function renderEmpty() {
    $('kpi-projects').textContent = '–';
    $('kpi-tasks').textContent = '–';
    $('kpi-completion').textContent = '–';
    $('kpi-budget').textContent = '–';
    $('project-summary').textContent = 'No data loaded yet. Upload an Excel file or load the sample data above.';
    PMCharts.destroy('chart-progress');
    var list = $('task-tracker');
    list.textContent = '';
    list.appendChild(el('li', 'task-empty', 'No tasks yet.'));
  }

  function renderKpis(ds) {
    var k = computeKpis(ds);
    $('kpi-projects').textContent = String(k.projects);
    $('kpi-tasks').textContent = String(k.tasks);
    $('kpi-completion').textContent = k.completion + '%';
    $('kpi-budget').textContent = fmtNaira(k.budget);
  }

  function renderChart(ds) {
    var prog = projectProgress(ds);
    try {
      PMCharts.bar(
        'chart-progress',
        prog.map(function (p) { return p.name; }),
        prog.map(function (p) { return Math.round(p.avg); }),
        prog.map(function (p) { return projectColor(p.status); })
      );
    } catch (e) {
      toast(e.message);
    }
  }

  function renderSummary(ds) {
    $('project-summary').textContent = summarySentence(ds);
  }

  function renderTracker(ds) {
    var list = $('task-tracker');
    list.textContent = '';
    if (!ds.tasks.length) {
      list.appendChild(el('li', 'task-empty', 'No tasks yet.'));
      return;
    }
    var sorted = ds.tasks.slice().sort(function (a, b) {
      var so = (TASK_STATUS_ORDER[a.Status] !== undefined ? TASK_STATUS_ORDER[a.Status] : 3) -
               (TASK_STATUS_ORDER[b.Status] !== undefined ? TASK_STATUS_ORDER[b.Status] : 3);
      if (so !== 0) return so;
      if (a.DueDate !== b.DueDate) return a.DueDate < b.DueDate ? -1 : 1;
      return (Number(b.Completion) || 0) - (Number(a.Completion) || 0);
    });

    sorted.forEach(function (t) {
      var li = el('li', 'task-item');
      var dot = el('span', 'task-dot ' + (TASK_STATUS_COLORS[t.Status] ? t.Status : 'todo'));
      var main = el('div', 'task-main');
      main.appendChild(el('div', 'task-title', t.Title || t.TaskID));
      var meta = (t.Assignee ? t.Assignee : 'Unassigned') + (t.DueDate ? ' • due ' + t.DueDate : '');
      main.appendChild(el('div', 'task-meta', meta));
      var side = el('div', 'task-side');
      side.appendChild(el('div', 'task-pct', (Number(t.Completion) || 0) + '%'));
      side.appendChild(el('div', 'task-due', t.Status));
      li.appendChild(dot); li.appendChild(main); li.appendChild(side);
      list.appendChild(li);
    });
  }

  // ---------- boot ----------
  function init() {
    initTabs();
    initUpload();
    // Auto-load the seeded sample so the dashboard is demo-ready on first open.
    PMData.loadSample()
      .then(function (out) {
        renderReport(out.report);
        renderAll();
      })
      .catch(function () {
        renderEmpty();
        reportError('Could not load the sample workbook. Upload an .xlsx file above instead.');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
