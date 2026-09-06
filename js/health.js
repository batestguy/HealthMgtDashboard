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
      // Reload the cached aggregates so the KPI cards re-count up on the
      // next render (counters fire from renderKpis); keep the map's current
      // pan/zoom — renderAggregates replaces only the circle layer.
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
        // Re-frame Nigeria once the container definitely has its final size
        // (first open + every refresh) so no southern states are cropped.
        setTimeout(function () { PMMap.fitToNigeria(); }, 150);
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
    // Reflect the same state in the header chip (redesign-spec §4.5).
    var anyLive = facSource === 'live' || indSource === 'live';
    if (window.PMApp && PMApp.setLiveStatus) {
      PMApp.setLiveStatus(anyLive, anyLive ? 'Live data' : 'Sample data');
    }
  }

  function fmtNaira(n) {
    if (n === null || n === undefined || isNaN(n)) return '\u20A6' + '0';
    if (n >= 1e9) return '\u20A6' + trimZero((n / 1e9).toFixed(1)) + 'B';
    if (n >= 1e6) return '\u20A6' + trimZero((n / 1e6).toFixed(1)) + 'M';
    if (n >= 1e3) return '\u20A6' + trimZero((n / 1e3).toFixed(1)) + 'k';
    return '\u20A6' + Math.round(n).toLocaleString();
  }
  function trimZero(s) { return s.replace(/\.0$/, ''); }

  function renderKpis(agg) {
    var up = window.PMApp && PMApp.countUp ? PMApp.countUp : function (el, v, fmt) {
      el.textContent = fmt ? fmt(v) : String(v);
    };
    up($('kpi-facilities'), agg.total, function (v) { return v.toLocaleString(); });
    $('kpi-states').textContent = agg.statesCovered.toLocaleString();
    up($('kpi-public'), agg.ownership.Public || 0, function (v) { return v.toLocaleString(); });
    up($('kpi-private'), agg.ownership.Private || 0, function (v) { return v.toLocaleString(); });
    // Second-row footer KPI renders after count-up settles so it never
    // reads a mid-tween value (redesign-spec §4.7 #1).
    if (window.PMApp && PMApp.countUp) {
      setTimeout(function () {
        $('kpi-facilities-ctx').textContent = measurementsFriendly(agg);
      }, 700);
    } else {
      $('kpi-facilities-ctx').textContent = measurementsFriendly(agg);
    }
  }

  function measurementsFriendly(agg) {
    var parts = [];
    if (agg.total) parts.push(formatMetric(agg.total) + ' facilities');
    if (agg.statesCovered) parts.push(agg.statesCovered + ' states');
    if (agg.ownership && agg.ownership.Public) {
      parts.push(formatMetric(agg.ownership.Public) + ' public');
    }
    if (agg.ownership && agg.ownership.Private) {
      parts.push(formatMetric(agg.ownership.Private) + ' private');
    }
    return parts.join(' \u00B7 ') || '';
  }

  function formatMetric(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(0) + 'k';
    return String(n);
  }

  function renderTypeChart(agg) {
    var labels = agg.levels.map(function (l) { return l.key; });
    var values = agg.levels.map(function (l) { return l.count; });
    var empty = $('facility-types-empty');
    if (!labels.length) {
      PMCharts.destroy('chart-facility-types');
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    PMCharts.doughnut('chart-facility-types', labels, values);
  }

  function renderTrendChart(ind) {
    var empty = $('trends-empty');
    if (!ind || !ind.series.length) {
      PMCharts.destroy('chart-indicator-trends');
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    PMCharts.line('chart-indicator-trends', ind.years, ind.series);
  }

  function renderKeyIndicators(items) {
    var list = $('key-indicator-list');
    var empty = $('indicators-empty');
    list.textContent = '';
    if (!items || !items.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    items.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'indicator-row';
      li.dataset.id = item.id;

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.setAttribute('aria-label', 'Show ' + item.label);
      cb.setAttribute('id', 'ind-cb-' + item.id);
      cb.addEventListener('change', function () {
        li.hidden = !cb.checked;
      });

      var label = document.createElement('label');
      label.className = 'indicator-label';
      label.setAttribute('for', 'ind-cb-' + item.id);
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

  // Re-render the visible charts/KPIs from cached data (no network) — used
  // after a theme toggle so charts pick up the new CSS tokens (redesign-spec
  // §4.6) and after a refresh so the KPI values re-count up.
  function repaint() {
    var agg = PMHealthData.currentAggregates();
    var ind = PMHealthData.currentIndicators();
    if (!agg) return;
    renderKpis(agg);
    renderTypeChart(agg);
    if (ind) renderTrendChart(ind);
    if (ind) renderKeyIndicators(ind.keyIndicators);
  }

  return { init: init, repaint: repaint };
})();
