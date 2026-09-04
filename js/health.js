/* ==========================================================================
 * js/health.js — Health tab controller (spec §6 Tab 2)
 *
 * Called by app.js the first time the Health tab is opened. Renders KPIs,
 * the facility map, the facility-level doughnut, indicator trend lines, a
 * configurable key-indicator list, and keeps the sample-data badge in sync
 * with whether the live sources are actually being used (decision #7).
 * ========================================================================== */

window.PMHealth = (function () {
  'use strict';

  var initialized = false;
  var loading = false;

  function $(id) { return document.getElementById(id); }

  function init() {
    if (initialized) return;
    initialized = true;

    var mapOk = PMMap.init('health-map');
    if (!mapOk) {
      $('health-source-line').textContent = 'Map library could not load from CDN.';
    }

    $('btn-health-refresh').addEventListener('click', function () {
      if (loading) return;
      PMHealthData.resetSession();
      loadAll('Refreshed');
    });

    loadAll();
  }

  function loadAll(doneToast) {
    loading = true;
    $('health-source-line').textContent = 'Loading live GRID3 + HDX data…';
    Promise.all([PMHealthData.loadFacilityAggregates(), PMHealthData.loadIndicators()])
      .then(function (results) {
        var agg = results[0];
        var ind = results[1];
        renderSourceState(agg.source, ind.source);
        renderKpis(agg);
        PMMap.renderAggregates(agg);
        PMMap.invalidateSize();
        renderTypeChart(agg);
        renderTrendChart(ind);
        renderKeyIndicators(ind.keyIndicators);
        if (doneToast) {
          var src = agg.source === 'live' ? 'Live GRID3 + HDX' : 'Sample data (fallback)';
          window.PMApp && PMApp.toast(doneToast + ' — ' + src);
        }
      })
      .catch(function () {
        renderSourceState('sample', 'sample');
      })
      .finally(function () { loading = false; });
  }

  function renderSourceState(facSource, indSource) {
    var badge = $('data-badge');
    var line = $('health-source-line');
    var parts = [];
    if (facSource === 'live') parts.push('Live GRID3 facilities');
    else parts.push('Sample facilities (fallback)');
    if (indSource === 'live') parts.push('Live HDX indicators');
    else parts.push('Sample indicators (fallback)');
    line.textContent = parts.join(' • ');
    var anySample = facSource !== 'live' || indSource !== 'live';
    badge.hidden = !anySample;
  }

  function renderKpis(agg) {
    $('kpi-facilities').textContent = agg.total.toLocaleString();
    $('kpi-states').textContent = String(agg.statesCovered);
    $('kpi-public').textContent = (agg.ownership.Public || 0).toLocaleString();
    $('kpi-private').textContent = (agg.ownership.Private || 0).toLocaleString();
  }

  function renderTypeChart(agg) {
    var labels = agg.levels.map(function (l) { return l.key; });
    var values = agg.levels.map(function (l) { return l.count; });
    if (!labels.length) { PMCharts.destroy('chart-facility-types'); return; }
    PMCharts.doughnut('chart-facility-types', labels, values);
  }

  function renderTrendChart(ind) {
    if (!ind.series.length) { PMCharts.destroy('chart-indicator-trends'); return; }
    PMCharts.line('chart-indicator-trends', ind.years, ind.series);
  }

  function renderKeyIndicators(items) {
    var list = $('key-indicator-list');
    list.textContent = '';
    items.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'indicator-row';
      li.dataset.id = item.id;

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.setAttribute('aria-label', 'Show ' + item.label);
      cb.addEventListener('change', function () {
        li.hidden = !cb.checked;
      });

      var label = document.createElement('span');
      label.className = 'indicator-label';
      label.textContent = item.label;

      var value = document.createElement('span');
      value.className = 'indicator-value';
      value.textContent = item.value;

      li.appendChild(cb);
      li.appendChild(label);
      li.appendChild(value);
      list.appendChild(li);
    });
  }

  return { init: init };
})();
