/* ==========================================================================
 * js/charts.js — Chart.js v4 wrappers (spec §3.1, §7)
 *
 * Every chart is registered by id and destroyed before being recreated, so
 * data changes (Excel uploads) never leak Chart.js instances.
 * ========================================================================== */

window.PMCharts = (function () {
  'use strict';

  var registry = {};

  function destroy(id) {
    if (registry[id]) {
      registry[id].destroy();
      delete registry[id];
    }
  }

  function destroyAll() {
    Object.keys(registry).forEach(destroy);
  }

  function bar(id, labels, values, colors, opts) {
    if (typeof Chart === 'undefined') {
      throw new Error('Chart.js failed to load from CDN.');
    }
    destroy(id);
    var canvas = document.getElementById(id);
    if (!canvas) return;
    var options = Object.assign({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              return ' ' + Math.round(ctx.parsed.y) + '% average completion';
            }
          }
        }
      },
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { callback: function (v) { return v + '%'; } } }
      }
    }, opts || {});

    registry[id] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderRadius: 6,
          maxBarThickness: 40
        }]
      },
      options: options
    });
    return registry[id];
  }

  return { bar: bar, destroy: destroy, destroyAll: destroyAll };
})();
