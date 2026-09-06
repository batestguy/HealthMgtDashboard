/* ==========================================================================
 * js/charts.js — Chart.js v4 wrappers (spec §3.1, §7; redesign-spec §4.6)
 *
 * Every chart is registered by id and destroyed before being recreated, so
 * data changes never leak instances. Styling is token-driven: colors and
 * fonts are read from the CSS custom properties at draw time, so light and
 * dark themes (and any future accent change) restyle every chart without
 * code changes. Draw-in animation is disabled under prefers-reduced-motion.
 * ========================================================================== */

window.PMCharts = (function () {
  'use strict';

  var registry = {};
  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function destroy(id) {
    if (registry[id]) {
      registry[id].destroy();
      delete registry[id];
    }
  }

  function destroyAll() {
    Object.keys(registry).forEach(destroy);
  }

  // Read a CSS token (--name) as a string.
  function token(name) {
    try {
      return (getComputedStyle(document.documentElement).getPropertyValue('--' + name) || '').trim();
    } catch (e) { return ''; }
  }

  var BODY_FONT = "'Space Grotesk', system-ui, sans-serif";
  var MONO_FONT = "'IBM Plex Mono', ui-monospace, monospace";

  var ANIMATION = REDUCED ? false : { duration: 700, easing: 'easeOutQuart' };

  // Shared legend config (only where legends are shown).
  function legend(display) {
    return {
      position: 'bottom',
      display: display !== false,
      labels: {
        boxWidth: 12,
        boxHeight: 12,
        usePointStyle: true,
        pointStyle: 'circle',
        color: token('ink-soft'),
        font: { family: BODY_FONT, size: 11, weight: 500 }
      }
    };
  }

  // Brand-themed tooltip (gold rule accent via border + colored dot).
  function tooltipTheme() {
    return {
      backgroundColor: token('ink'),
      titleColor: token('bg'),
      bodyColor: token('bg'),
      borderColor: token('gold'),
      borderWidth: 1.5,
      padding: 10,
      cornerRadius: 10,
      displayColors: true,
      boxWidth: 8,
      boxHeight: 8,
      usePointStyle: true,
      titleFont: { family: MONO_FONT, size: 11, weight: 600 },
      bodyFont: { family: BODY_FONT, size: 12, weight: 500 }
    };
  }

  // Y-axis only, hairline grid, mono ticks.
  function gridAxes(overrides) {
    return Object.assign({
      y: {
        beginAtZero: true,
        grid: { color: token('hairline'), drawBorder: false },
        border: { display: false },
        ticks: { color: token('ink-faint'), font: { family: MONO_FONT, size: 10 }, padding: 6 }
      },
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: token('ink-faint'), font: { family: MONO_FONT, size: 10 } }
      }
    }, overrides || {});
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
      animation: ANIMATION,
      plugins: {
        legend: { display: false },
        tooltip: Object.assign(tooltipTheme(), {
          callbacks: {
            label: function (ctx) {
              return ' ' + Math.round(ctx.parsed.y) + '% average completion';
            }
          }
        })
      },
      scales: gridAxes({ y: { beginAtZero: true, max: 100, ticks: { callback: function (v) { return v + '%'; }, color: token('ink-faint'), font: { family: MONO_FONT, size: 10 } } } })
    }, opts || {});

    registry[id] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderRadius: 5,
          maxBarThickness: 40,
          hoverBackgroundColor: colors.map(function (c) { return c; })
        }]
      },
      options: options
    });
    return registry[id];
  }

  var PALETTE = [token('green'), token('gold'), token('green-soft'), token('bad'), token('info'), token('ink-faint')];
  function colorFor(i) { return PALETTE[i % PALETTE.length] || '#a0aec0'; }

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
          borderWidth: 3,
          borderColor: token('card'),
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: ANIMATION,
        plugins: {
          legend: legend(true),
          tooltip: Object.assign(tooltipTheme(), {
            callbacks: {
              label: function (ctx) {
                var total = ctx.dataset.data.reduce(function (a, b) { return a + b; }, 0) || 1;
                return ' ' + ctx.label + ': ' + ctx.parsed.toLocaleString() + ' (' + Math.round((ctx.parsed / total) * 100) + '%)';
              }
            }
          })
        },
        cutout: '58%'
      }
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
    var ctx = canvas.getContext('2d');
    var grad = ctx.createLinearGradient(0, 0, 0, 300);
    grad.addColorStop(0, token('green') + '33'); // ~20% alpha hex suffix
    grad.addColorStop(1, token('green') + '00');
    registry[id] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: series.map(function (s, i) {
          var base = i === 0 ? token('green') : colorFor(i);
          return {
            label: s.label,
            data: s.data,
            borderColor: base,
            backgroundColor: i === 0 ? grad : 'transparent',
            tension: 0.35,
            pointRadius: 3,
            pointBackgroundColor: token('gold'),
            pointBorderColor: token('card'),
            pointBorderWidth: 1.5,
            borderWidth: 2.5,
            fill: i === 0 ? true : false
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: ANIMATION,
        plugins: {
          legend: legend(true),
          tooltip: Object.assign(tooltipTheme(), {
            callbacks: {
              label: function (ctx) { return ' ' + ctx.dataset.label + ': ' + ctx.parsed.y; }
            }
          })
        },
        scales: gridAxes({
          y: { beginAtZero: true, ticks: { color: token('ink-faint'), font: { family: MONO_FONT, size: 10 } } },
          x: { ticks: { maxTicksLimit: 8, color: token('ink-faint'), font: { family: MONO_FONT, size: 10 } } }
        })
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
            borderRadius: 4,
            maxBarThickness: 20,
            borderSkipped: false
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: ANIMATION,
        plugins: {
          legend: legend(true),
          tooltip: Object.assign(tooltipTheme(), {
            callbacks: {
              label: function (ctx) { return ' ' + ctx.dataset.label + ': ' + compact(ctx.parsed.y); }
            }
          })
        },
        scales: gridAxes({
          y: { beginAtZero: true, ticks: { callback: function (v) { return '\u20A6' + compact(v); }, color: token('ink-faint'), font: { family: MONO_FONT, size: 10 } } },
          x: { ticks: { color: token('ink-faint'), font: { family: MONO_FONT, size: 10 } } }
        })
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
          borderRadius: 5,
          maxBarThickness: 16,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: ANIMATION,
        plugins: {
          legend: { display: false },
          tooltip: Object.assign(tooltipTheme(), {
            callbacks: { label: function (ctx) { return ' ' + fmt(ctx.parsed.x); } }
          })
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: token('hairline'), drawBorder: false },
            border: { display: false },
            ticks: { color: token('ink-faint'), font: { family: MONO_FONT, size: 10 } }
          },
          y: { grid: { display: false }, border: { display: false }, ticks: { color: token('ink-soft'), font: { family: BODY_FONT, size: 11, weight: 500 } } }
        }
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
      animation: ANIMATION,
      plugins: {
        legend: { display: false },
        tooltip: Object.assign(tooltipTheme(), {
          callbacks: { label: function (ctx) { return ' ' + ctx.parsed.r + ' shipped features'; } }
        })
      },
      scales: {
        r: {
          beginAtZero: true,
          suggestedMax: 8,
          ticks: { stepSize: 2, font: { family: MONO_FONT, size: 9 }, color: token('ink-faint'), backdropColor: 'transparent' },
          pointLabels: { font: { family: BODY_FONT, size: 11, weight: 600 }, color: token('ink') },
          grid: { color: token('hairline') },
          angleLines: { color: token('hairline') }
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
          backgroundColor: token('green') + '29', // ~16% alpha
          borderColor: token('green'),
          borderWidth: 2,
          pointBackgroundColor: token('gold'),
          pointBorderColor: token('card'),
          pointBorderWidth: 1.5,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: options
    });
    return registry[id];
  }

  return { bar: bar, groupedBar: groupedBar, hbar: hbar, doughnut: doughnut, line: line, radar: radar, destroy: destroy, destroyAll: destroyAll };
})();