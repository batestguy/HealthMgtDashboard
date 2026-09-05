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

  var PALETTE = ['#008751', '#f5b041', '#38a169', '#e53e3e', '#3182ce', '#805ad5', '#dd6b20', '#4a5568'];
  function colorFor(i) { return PALETTE[i % PALETTE.length]; }

  function doughnut(id, labels, values) {
    if (typeof Chart === 'undefined') {
      throw new Error('Chart.js failed to load from CDN.');
    }
    destroy(id);
    var canvas = document.getElementById(id);
    if (!canvas) return;
    registry[id] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: labels.map(function (_, i) { return colorFor(i); }),
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, font: { size: 11 } }
          }
        },
        cutout: '55%'
      }
    });
    return registry[id];
  }

  // Five-axis capability summary (showcase tab); values are evidence counts.
  function radar(id, labels, values, opts) {
    if (typeof Chart === 'undefined') {
      throw new Error('Chart.js failed to load from CDN.');
    }
    destroy(id);
    var canvas = document.getElementById(id);
    if (!canvas) return;
    var options = Object.assign({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          beginAtZero: true,
          suggestedMax: 8,
          ticks: { stepSize: 2, font: { size: 9 }, color: '#5b6b7c', backdropColor: 'transparent' },
          pointLabels: { font: { size: 11, weight: '600' }, color: '#1a202c' },
          grid: { color: '#eef2f6' },
          angleLines: { color: '#eef2f6' }
        }
      }
    }, opts || {});

    registry[id] = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Shipped features',
          data: values,
          backgroundColor: 'rgba(0, 135, 81, 0.16)',
          borderColor: '#008751',
          borderWidth: 2,
          pointBackgroundColor: '#f5b041',
          pointBorderColor: '#ffffff',
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: options
    });
    return registry[id];
  }

  function line(id, labels, series) {
    if (typeof Chart === 'undefined') {
      throw new Error('Chart.js failed to load from CDN.');
    }
    destroy(id);
    var canvas = document.getElementById(id);
    if (!canvas) return;
    registry[id] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: series.map(function (s, i) {
          return {
            label: s.label,
            data: s.data,
            borderColor: colorFor(i),
            backgroundColor: colorFor(i),
            tension: 0.3,
            pointRadius: 3,
            borderWidth: 2,
            fill: false
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, font: { size: 11 } }
          }
        },
        scales: {
          y: { beginAtZero: true },
          x: { ticks: { maxTicksLimit: 8, font: { size: 10 } } }
        }
      }
    });
    return registry[id];
  }

  // Two series side by side per category, e.g. planned vs actual spend.
  function groupedBar(id, labels, series) {
    if (typeof Chart === 'undefined') {
      throw new Error('Chart.js failed to load from CDN.');
    }
    destroy(id);
    var canvas = document.getElementById(id);
    if (!canvas) return;
    registry[id] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: series.map(function (s, i) {
          return {
            label: s.label,
            data: s.data,
            backgroundColor: s.color || colorFor(i),
            borderRadius: 5,
            maxBarThickness: 22
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, font: { size: 11 } }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: function (v) { return '\u20A6' + compact(v); }, font: { size: 10 } }
          },
          x: { ticks: { font: { size: 10 } } }
        }
      }
    });
    return registry[id];
  }

  function compact(n) {
    if (n >= 1e6) return trimZero((n / 1e6).toFixed(1)) + 'M';
    if (n >= 1e3) return trimZero((n / 1e3).toFixed(1)) + 'k';
    return String(Math.round(n));
  }
  function trimZero(s) { return s.replace(/\.0$/, ''); }

  // Horizontal bars, e.g. priority counts or resource costs.
  function hbar(id, labels, values, colors, valueFormatter) {
    if (typeof Chart === 'undefined') {
      throw new Error('Chart.js failed to load from CDN.');
    }
    destroy(id);
    var canvas = document.getElementById(id);
    if (!canvas) return;
    var fmt = valueFormatter || function (v) { return v; };
    registry[id] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderRadius: 6,
          maxBarThickness: 18
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { return ' ' + fmt(ctx.parsed.x); } } }
        },
        scales: {
          x: { beginAtZero: true, ticks: { font: { size: 10 } } },
          y: { ticks: { font: { size: 10 } } }
        }
      }
    });
    return registry[id];
  }

  return { bar: bar, groupedBar: groupedBar, hbar: hbar, doughnut: doughnut, line: line, radar: radar, destroy: destroy, destroyAll: destroyAll };
})();
