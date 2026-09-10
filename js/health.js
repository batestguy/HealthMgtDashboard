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
          // Same trap as the badge (§9.3): `agg.source` only describes the
          // facilities, so testing it alone claimed "Live GRID3 + HDX" over
          // fallback indicators. Report whatever the header chip reports.
          var src = sourceState(agg.source === 'live', ind.source === 'live').chip;
          window.PMApp && PMApp.toast(doneToast + ' — ' + src);
        }
      })
      .catch(function () {
        renderSourceState('sample', 'sample');
      })
      .finally(function () { loading = false; });
  }

  // The two feeds fail independently, so there are four states, not two —
  // and the mixed one is the normal case, because HDX 403s without an app
  // registration (spec §11.2). Every indicator below is derived from the
  // same `facLive`/`indLive` pair so they cannot disagree.
  function renderSourceState(facSource, indSource) {
    var badge = $('data-badge');
    var line = $('health-source-line');
    var facLive = facSource === 'live';
    var indLive = indSource === 'live';
    var parts = [];
    parts.push(facLive ? 'Live GRID3 facilities' : 'Sample facilities (fallback)');
    parts.push(indLive ? 'Live HDX indicators' : 'Sample indicators (fallback)');
    line.textContent = parts.join(' • ');
    // The badge names *which* feed fell back. Driving it off "did anything
    // fall back?" made it announce "Sample data" over live GRID3 facilities
    // while the header chip simultaneously read "Live data" — spec §9.3.
    var state = sourceState(facLive, indLive);
    badge.hidden = !state.badge;
    if (state.badge) badge.textContent = state.badge;
    // Reflect the same state in the header chip (redesign-spec §4.5).
    if (window.PMApp && PMApp.setLiveStatus) {
      PMApp.setLiveStatus(state.anyLive, state.chip);
    }
  }

  function sourceState(facLive, indLive) {
    if (facLive && indLive) {
      return { badge: null, anyLive: true, chip: 'Live data' };
    }
    if (!facLive && !indLive) {
      return { badge: 'Sample data — live sources unavailable', anyLive: false, chip: 'Sample data' };
    }
    if (facLive) {
      return { badge: 'Sample indicators — live HDX unavailable', anyLive: true, chip: 'Partly live' };
    }
    return { badge: 'Sample facilities — live GRID3 unavailable', anyLive: true, chip: 'Partly live' };
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
