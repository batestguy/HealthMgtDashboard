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
      btn.addEventListener('click', function () {
        var name = btn.getAttribute('data-tab');
        activateTab(name);
        try {
          if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
        } catch (e) { /* hash update is a nicety only */ }
      });
    });
  }

  function tabFromHash() {
    var t = (location.hash || '').replace('#', '');
    var known = (t === 'projects' || t === 'health' || t === 'showcase' || t === 'ask' || t === 'export');
    // Landing view is the 🚀 showcase; unknown/dead hashes (#quiz, …) fall back to it.
    return known ? t : 'showcase';
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
    // Lazily build a tab the first time it is opened.
    if (name === 'health' && window.PMHealth) window.PMHealth.init();
    if (name === 'showcase' && window.PMShowcase) window.PMShowcase.init();
    if (name === 'ask' && window.PMNlq) window.PMNlq.init();
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

  // ---------- filter state ----------
  var filters = { status: 'all', region: 'all' };

  // ---------- derived data ----------
  function regionList(ds) {
    var regions = {};
    ds.projects.forEach(function (p) { if (p.Region) regions[p.Region] = true; });
    (ds.locations || []).forEach(function (l) { if (l.State) regions[l.State] = true; });
    return Object.keys(regions).sort();
  }

  function projectNameMap(ds) {
    var map = {};
    ds.projects.forEach(function (p) { map[p.ProjectID] = p.Name; });
    return map;
  }

  function filteredProjects(ds) {
    return ds.projects.filter(function (p) {
      if (filters.status !== 'all' && p.Status !== filters.status) return false;
      if (filters.region !== 'all' && p.Region !== filters.region) return false;
      return true;
    });
  }

  function projectTasksMap(ds) {
    var map = {};
    ds.tasks.forEach(function (t) {
      if (!map[t.ProjectID]) map[t.ProjectID] = [];
      map[t.ProjectID].push(t);
    });
    return map;
  }

  function projectFinancesMap(ds) {
    var map = {};
    (ds.finances || []).forEach(function (f) {
      if (!map[f.ProjectID]) map[f.ProjectID] = [];
      map[f.ProjectID].push(f);
    });
    return map;
  }

  function statusCounts(projects) {
    var counts = { 'On Track': 0, 'At Risk': 0, Completed: 0, 'On Hold': 0 };
    projects.forEach(function (p) {
      counts[p.Status] = (counts[p.Status] || 0) + 1;
    });
    return counts;
  }

  function summarySentence(projects) {
    var counts = statusCounts(projects);
    var parts = [];
    Object.keys(counts).forEach(function (k) {
      if (counts[k]) parts.push(counts[k] + ' ' + k.toLowerCase());
    });
    if (!parts.length) return 'No project statuses recorded.';
    return parts.join(', ') + '.';
  }

  function monthlyFinance(ds, projects) {
    var pids = {};
    projects.forEach(function (p) { pids[p.ProjectID] = true; });
    var agg = {};
    (ds.finances || []).forEach(function (f) {
      if (!pids[f.ProjectID] || !f.Month) return;
      if (!agg[f.Month]) agg[f.Month] = { planned: 0, actual: 0 };
      agg[f.Month].planned += Number(f.PlannedSpend) || 0;
      agg[f.Month].actual += Number(f.ActualSpend) || 0;
    });
    var months = Object.keys(agg).sort();
    return {
      labels: months.map(function (m) { return monthShort(m); }),
      planned: months.map(function (m) { return agg[m].planned; }),
      actual: months.map(function (m) { return agg[m].actual; })
    };
  }

  function monthShort(ym) {
    var m = Number(ym.slice(5, 7));
    var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return names[m - 1] || ym;
  }

  function projectAvgCompletion(tasks) {
    if (!tasks.length) return 0;
    var sum = tasks.reduce(function (s, t) { return s + (Number(t.Completion) || 0); }, 0);
    return sum / tasks.length;
  }

  // ---------- renderers ----------
  function renderAll() {
    var ds = PMData.getDataset();
    if (!ds || !ds.projects.length) { renderEmpty(); return; }

    var projs = filteredProjects(ds);
    var tasksByP = projectTasksMap(ds);
    var finByP = projectFinancesMap(ds);
    var nameMap = projectNameMap(ds);

    renderFilters(ds);
    renderKpis(ds, projs, tasksByP, finByP);
    renderHealthBar(ds, projs);
    renderProjectCards(ds, projs, tasksByP, finByP);
    renderProgressChart(projs, tasksByP);
    renderFinanceChart(ds, projs, finByP);
    renderTaskStatusChart(projs, tasksByP);
    renderPriorityChart(projs, tasksByP);
    renderResourceChart(ds);
    renderTracker(ds, projs, tasksByP, nameMap);
  }

  function renderEmpty() {
    ['projects', 'tasks', 'completion', 'budget'].forEach(function (k) {
      $('kpi-' + k).textContent = '–';
      $('kpi-' + k + '-ctx').textContent = '';
    });
    $('portfolio-count').textContent = '0 projects';
    $('projects-shown').textContent = '';
    $('tracker-count').textContent = '';
    $('project-summary').textContent = 'No data loaded yet. Upload an Excel file or load the sample data above.';
    $('health-bar').textContent = '';
    $('health-legend').textContent = '';
    $('project-list').textContent = '';
    renderFilters({ projects: [], locations: [] });
    destroyProjectCharts();
    $('task-tracker').textContent = '';
  }

  function destroyProjectCharts() {
    ['chart-progress', 'chart-finance', 'chart-task-status', 'chart-priority', 'chart-resources']
      .forEach(function (id) { PMCharts.destroy(id); });
    $('card-finance').classList.add('hidden');
    $('card-resources').classList.add('hidden');
  }

  function renderFilters(ds) {
    var chipWrap = $('status-chips');
    chipWrap.textContent = '';

    var statuses = ['all'].concat(Object.keys(statusCounts(ds.projects || [])));
    statuses.forEach(function (status) {
      var label = status === 'all' ? 'All' : status;
      var chip = el('button', 'chip' + (filters.status === status ? ' active' : ''), label);
      chip.setAttribute('data-status', status);
      chip.setAttribute('aria-pressed', filters.status === status ? 'true' : 'false');
      chip.addEventListener('click', function () {
        filters.status = status;
        renderAll();
      });
      chipWrap.appendChild(chip);
    });

    var select = $('region-select');
    var current = filters.region;
    select.textContent = '';
    select.appendChild(el('option', null, 'All regions'));
    select.firstChild.value = 'all';
    regionList(ds).forEach(function (r) {
      var opt = el('option', null, r);
      opt.value = r;
      select.appendChild(opt);
    });
    select.value = current;
    if (regionList(ds).indexOf(current) === -1) filters.region = 'all';
    select.value = filters.region;
  }

  function renderKpis(ds, projs, tasksByP, finByP) {
    var tasks = [];
    projs.forEach(function (p) { tasks = tasks.concat(tasksByP[p.ProjectID] || []); });
    var done = tasks.filter(function (t) { return t.Status === 'done'; }).length;
    var open = tasks.length - done;
    var budget = projs.reduce(function (s, p) { return s + (Number(p.Budget) || 0); }, 0);
    var spend = 0;
    projs.forEach(function (p) {
      (finByP[p.ProjectID] || []).forEach(function (f) { spend += Number(f.ActualSpend) || 0; });
    });

    $('kpi-projects').textContent = String(projs.length);
    $('kpi-projects-ctx').textContent = projs.length ? regionList({ projects: projs, locations: [] }).length + ' regions' : '';
    $('kpi-tasks').textContent = String(tasks.length);
    $('kpi-tasks-ctx').textContent = open + ' open'; // tasks list shows ALL tasks; ctx reflects open count
    $('kpi-completion').textContent = tasks.length ? Math.round((done / tasks.length) * 100) + '%' : '–';
    $('kpi-completion-ctx').textContent = done + ' of ' + tasks.length + ' done';
    $('kpi-budget').textContent = fmtNaira(budget);
    $('kpi-budget-ctx').textContent = spend ? fmtNaira(spend) + ' spent' : '';
  }

  function renderHealthBar(ds, projs) {
    var counts = statusCounts(projs);
    var order = ['On Track', 'At Risk', 'On Hold', 'Completed'];
    var colors = { 'On Track': '#008751', 'At Risk': '#f5b041', 'On Hold': '#e53e3e', Completed: '#2e9e5b' };
    var total = projs.length || 1;

    var bar = $('health-bar');
    bar.textContent = '';
    order.forEach(function (status) {
      if (!counts[status]) return;
      var seg = el('span', 'health-seg');
      seg.style.width = ((counts[status] / total) * 100) + '%';
      seg.style.background = colors[status];
      bar.appendChild(seg);
    });
    if (!projs.length) {
      bar.appendChild(el('span', 'health-seg'));
      bar.firstChild.style.width = '100%';
      bar.firstChild.style.background = '#e8eef4';
    }

    var legend = $('health-legend');
    legend.textContent = '';
    order.forEach(function (status) {
      if (!counts[status]) return;
      var item = el('span', 'legend-item');
      item.appendChild(el('span', 'legend-dot'));
      item.firstChild.style.background = colors[status];
      item.appendChild(document.createTextNode(status + ' ' + counts[status]));
      legend.appendChild(item);
    });

    $('portfolio-count').textContent = projs.length + ' project' + (projs.length === 1 ? '' : 's');
    $('project-summary').textContent = projs.length ? summarySentence(projs) : 'No projects match the current filters.';
  }

  // ---------- project cards with progress rings ----------
  function renderProjectCards(ds, projs, tasksByP, finByP) {
    var list = $('project-list');
    list.textContent = '';
    $('projects-shown').textContent = projs.length + ' shown';
    if (!projs.length) {
      list.appendChild(el('p', 'task-empty', 'No projects match the current filters.'));
      return;
    }

    projs.forEach(function (p) {
      var tasks = tasksByP[p.ProjectID] || [];
      var fins = finByP[p.ProjectID] || [];
      var pct = Math.round(projectAvgCompletion(tasks));
      var spend = fins.reduce(function (s, f) { return s + (Number(f.ActualSpend) || 0); }, 0);
      var planned = fins.reduce(function (s, f) { return s + (Number(f.PlannedSpend) || 0); }, 0);

      var card = el('div', 'project-card');
      var row = el('div', 'project-row');
      row.appendChild(ring(pct, projectColor(p.Status)));

      var main = el('div', 'pc-main');
      main.appendChild(el('div', 'pc-name', p.Name || p.ProjectID));
      var meta = (p.Owner ? p.Owner + ' • ' : '') + (p.Region || '') + ' • ' + tasks.length + ' tasks';
      main.appendChild(el('div', 'pc-meta', meta));

      var side = el('div', 'pc-side');
      side.appendChild(el('span', 'status-pill ' + pillClass(p.Status), p.Status));
      side.appendChild(el('div', 'pc-budget', fmtNaira(Number(p.Budget) || 0)));
      side.appendChild(el('div', 'pc-expand', '▾'));

      row.appendChild(main);
      row.appendChild(side);
      card.appendChild(row);

      var detail = el('div', 'project-detail');
      var grid = el('div', 'pd-grid');
      grid.appendChild(pdCell(pct + '%', 'complete'));
      grid.appendChild(pdCell(fmtNaira(spend), 'spent'));
      grid.appendChild(pdCell(fmtNaira(planned), 'planned'));
      detail.appendChild(grid);

      var financeLine = el('div', 'pd-finance', 'Budget ');
      financeLine.appendChild(el('b', null, fmtNaira(Number(p.Budget) || 0)));
      financeLine.appendChild(document.createTextNode(' · spend ' + (planned ? Math.round((spend / planned) * 100) : 0) + '% of plan'));
      detail.appendChild(financeLine);

      var tDone = tasks.filter(function (t) { return t.Status === 'done'; }).length;
      var tIn = tasks.filter(function (t) { return t.Status === 'in-progress'; }).length;
      var tTodo = tasks.filter(function (t) { return t.Status === 'todo'; }).length;
      var tLine = el('div', 'pd-tasks');
      tLine.appendChild(el('b', null, String(tDone)));
      tLine.appendChild(document.createTextNode(' done · '));
      tLine.appendChild(el('b', null, String(tIn)));
      tLine.appendChild(document.createTextNode(' in progress · '));
      tLine.appendChild(el('b', null, String(tTodo)));
      tLine.appendChild(document.createTextNode(' todo'));
      detail.appendChild(tLine);

      card.appendChild(detail);
      list.appendChild(card);
    });
  }

  function pdCell(value, label) {
    var cell = el('div', 'pd-cell');
    cell.appendChild(el('b', null, value));
    cell.appendChild(el('span', null, label));
    return cell;
  }

  function pillClass(status) {
    var map = { 'On Track': 'on-track', 'At Risk': 'at-risk', 'On Hold': 'on-hold', Completed: 'completed' };
    return map[status] || 'on-hold';
  }

  function ring(pct, color) {
    var r = 24;
    var c = 2 * Math.PI * r;
    var wrap = el('div', 'ring');
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', Math.round(pct) + '% complete');
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '58');
    svg.setAttribute('height', '58');
    svg.setAttribute('viewBox', '0 0 58 58');

    var track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    track.setAttribute('cx', '29'); track.setAttribute('cy', '29'); track.setAttribute('r', String(r));
    track.setAttribute('fill', 'none'); track.setAttribute('stroke-width', '6');
    track.setAttribute('class', 'ring-track');

    var fill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    fill.setAttribute('cx', '29'); fill.setAttribute('cy', '29'); fill.setAttribute('r', String(r));
    fill.setAttribute('fill', 'none'); fill.setAttribute('stroke-width', '6');
    fill.setAttribute('stroke', color);
    fill.setAttribute('class', 'ring-fill');
    fill.setAttribute('stroke-dasharray', String(c));
    fill.setAttribute('stroke-dashoffset', String(c));

    svg.appendChild(track);
    svg.appendChild(fill);
    wrap.appendChild(svg);
    wrap.appendChild(el('span', 'ring-label', Math.round(pct) + '%'));

    requestAnimationFrame(function () {
      fill.setAttribute('stroke-dashoffset', String(c * (1 - pct / 100)));
    });
    return wrap;
  }

  // ---------- charts ----------
  function renderProgressChart(projs, tasksByP) {
    if (!projs.length) { PMCharts.destroy('chart-progress'); return; }
    try {
      PMCharts.bar(
        'chart-progress',
        projs.map(function (p) { return p.Name; }),
        projs.map(function (p) { return Math.round(projectAvgCompletion(tasksByP[p.ProjectID] || [])); }),
        projs.map(function (p) { return projectColor(p.Status); })
      );
    } catch (e) { toast(e.message); }
  }

  function renderFinanceChart(ds, projs, finByP) {
    var card = $('card-finance');
    var fin = monthlyFinance(ds, projs);
    var anyActual = fin.actual.some(function (v) { return v > 0; });
    if (!fin.labels.length || !anyActual) { card.classList.add('hidden'); PMCharts.destroy('chart-finance'); return; }
    card.classList.remove('hidden');
    try {
      PMCharts.groupedBar('chart-finance', fin.labels, [
        { label: 'Planned', data: fin.planned, color: '#a0aec0' },
        { label: 'Actual', data: fin.actual, color: '#008751' }
      ]);
    } catch (e) { toast(e.message); }
  }

  function renderTaskStatusChart(projs, tasksByP) {
    var counts = { done: 0, 'in-progress': 0, todo: 0 };
    projs.forEach(function (p) {
      (tasksByP[p.ProjectID] || []).forEach(function (t) {
        counts[t.Status] = (counts[t.Status] !== undefined ? counts[t.Status] : 0) + 1;
      });
    });
    var labels = ['done', 'in-progress', 'todo'];
    var values = labels.map(function (l) { return counts[l]; });
    if (!values.reduce(function (a, b) { return a + b; }, 0)) { PMCharts.destroy('chart-task-status'); return; }
    PMCharts.doughnut('chart-task-status',
      labels.map(function (l) { return l === 'in-progress' ? 'in progress' : l; }),
      values);
  }

  function renderPriorityChart(projs, tasksByP) {
    var counts = { high: 0, medium: 0, low: 0 };
    projs.forEach(function (p) {
      (tasksByP[p.ProjectID] || []).forEach(function (t) {
        var key = String(t.Priority || '').toLowerCase();
        counts[key] = (counts[key] !== undefined ? counts[key] : 0) + 1;
      });
    });
    var labels = ['high', 'medium', 'low'];
    var values = labels.map(function (l) { return counts[l]; });
    if (!values.reduce(function (a, b) { return a + b; }, 0)) { PMCharts.destroy('chart-priority'); return; }
    PMCharts.hbar('chart-priority', labels, values,
      ['#e53e3e', '#f5b041', '#0e7490'],
      function (v) { return v + ' tasks'; });
  }

  function renderResourceChart(ds) {
    var card = $('card-resources');
    var res = ds.resources || [];
    if (!res.length) { card.classList.add('hidden'); PMCharts.destroy('chart-resources'); return; }
    card.classList.remove('hidden');
    var sorted = res.slice().sort(function (a, b) { return (Number(b.Cost) || 0) - (Number(a.Cost) || 0); });
    $('resource-total').textContent = fmtNaira(sorted.reduce(function (s, r) { return s + (Number(r.Cost) || 0); }, 0));
    PMCharts.hbar('chart-resources',
      sorted.map(function (r) { return r.Name || r.ResourceID; }),
      sorted.map(function (r) { return Number(r.Cost) || 0; }),
      sorted.map(function (r) { return r.Type === 'Person' ? '#0e7490' : '#008751'; }),
      function (v) { return fmtNaira(v); });
  }

  // ---------- task tracker ----------
  function renderTracker(ds, projs, tasksByP, nameMap) {
    var list = $('task-tracker');
    list.textContent = '';
    var pids = {};
    projs.forEach(function (p) { pids[p.ProjectID] = true; });
    var tasks = [];
    ds.tasks.forEach(function (t) { if (pids[t.ProjectID]) tasks.push(t); });
    $('tracker-count').textContent = tasks.length + ' shown';
    if (!tasks.length) {
      list.appendChild(el('li', 'task-empty', 'No tasks yet.'));
      return;
    }
    var today = new Date().toISOString().slice(0, 10);
    var sorted = tasks.slice().sort(function (a, b) {
      var so = (TASK_STATUS_ORDER[a.Status] !== undefined ? TASK_STATUS_ORDER[a.Status] : 3) -
               (TASK_STATUS_ORDER[b.Status] !== undefined ? TASK_STATUS_ORDER[b.Status] : 3);
      if (so !== 0) return so;
      if (a.DueDate !== b.DueDate) return a.DueDate < b.DueDate ? -1 : 1;
      return (Number(b.Completion) || 0) - (Number(a.Completion) || 0);
    });

    sorted.forEach(function (t) {
      var li = el('li', 'task-item');
      li.appendChild(el('span', 'task-dot ' + (TASK_STATUS_COLORS[t.Status] ? t.Status : 'todo')));

      var main = el('div', 'task-main');
      var titleRow = el('div', 'task-title-row');
      titleRow.appendChild(el('div', 'task-title', t.Title || t.TaskID));
      var prio = String(t.Priority || 'medium').toLowerCase();
      titleRow.appendChild(el('span', 'task-prio ' + prio, prio));
      main.appendChild(titleRow);

      if (nameMap[t.ProjectID]) main.appendChild(el('span', 'task-project', nameMap[t.ProjectID]));
      var meta = (t.Assignee ? t.Assignee : 'Unassigned') + (t.DueDate ? ' • due ' + t.DueDate : '');
      main.appendChild(el('div', 'task-meta', meta));

      var pct = Number(t.Completion) || 0;
      var bar = el('div', 'task-progress');
      bar.appendChild(el('i', null));
      bar.firstChild.style.width = pct + '%';
      main.appendChild(bar);

      var side = el('div', 'task-side');
      side.appendChild(el('div', 'task-pct', pct + '%'));
      var overdue = t.DueDate && t.DueDate < today && t.Status !== 'done';
      side.appendChild(el('div', 'task-due' + (overdue ? ' overdue' : ''), overdue ? 'overdue' : t.Status));
      li.appendChild(main);
      li.appendChild(side);
      list.appendChild(li);
    });
  }

  // ---------- projects list interactions (delegated, wired once) ----------
  function initProjectList() {
    var list = $('project-list');
    list.addEventListener('click', function (e) {
      var card = e.target && e.target.closest ? e.target.closest('.project-card') : null;
      if (card) card.classList.toggle('open');
    });
    $('region-select').addEventListener('change', function () {
      filters.region = this.value;
      renderAll();
    });
  }

  // ---------- boot ----------
  function init() {
    initTabs();
    initUpload();
    initProjectList();
    // Deep-link support (#health, #showcase, …) — also used by tab switches.
    activateTab(tabFromHash());
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

  // ---------- APIs for the NLQ engine (js/nlq.js) ----------
  function goto(name) {
    var btn = document.querySelector('.tab-btn[data-tab="' + name + '"]');
    if (btn) { btn.click(); return; }
    activateTab(name);
  }

  function setProjectFilters(next) {
    if (next) {
      if (next.status !== undefined) filters.status = next.status;
      if (next.region !== undefined) filters.region = next.region;
    }
    if (PMData.hasData()) renderAll();
  }

  return { toast: toast, goto: goto, setProjectFilters: setProjectFilters, loadSample: loadSample };
})();
