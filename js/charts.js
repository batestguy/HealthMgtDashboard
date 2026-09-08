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

  // Token lookups normally resolve against <html>. withThemeScope() repoints
  // them at another element, so an offscreen stage carrying data-theme="light"
  // renders paper-themed charts while the live page stays on whatever theme
  // the user picked (js/pdf.js is the only caller).
  var scopeEl = null;
  // True while a withThemeScope() capture is running. Animation is forced off
  // for the duration so the canvas is fully painted by the time the caller
  // reads it back — an animated chart snapshots half-drawn.
  var capturing = false;

  function destroy(id) {
    if (registry[id]) {
      registry[id].destroy();
      delete registry[id];
    }
  }

  function destroyAll() {
    Object.keys(registry).forEach(destroy);
  }

  // Public accessor for a live Chart.js instance (js/pdf.js needs the instance
  // itself to read its canvas back). Replaces the old reach for a private
  // `_registry` that was never exported.
  function get(id) { return registry[id]; }

  // Read a CSS token (--name) as a string, resolved against the current theme
  // scope (see withThemeScope) or <html> by default.
  function token(name) {
    try {
      return (getComputedStyle(scopeEl || document.documentElement).getPropertyValue('--' + name) || '').trim();
    } catch (e) { return ''; }
  }

  // Render fn() with tokens resolved against `el` and animation disabled.
  // CSS custom properties inherit, so an element carrying data-theme="light"
  // yields the light palette with no flash on the real page. Restores the
  // previous scope even if fn() throws.
  function withThemeScope(el, fn) {
    var prevScope = scopeEl;
    var prevCapturing = capturing;
    scopeEl = el || null;
    capturing = true;
    try {
      return fn();
    } finally {
      scopeEl = prevScope;
      capturing = prevCapturing;
    }
  }

  var BODY_FONT = "'Space Grotesk', system-ui, sans-serif";
  var MONO_FONT = "'IBM Plex Mono', ui-monospace, monospace";

  // Evaluated per chart build: `false` under reduced-motion, and `false` during
  // a capture so the chart paints synchronously in the constructor.
  function animation() {
    if (REDUCED || capturing) return false;
    return { duration: 700, easing: 'easeOutQuart' };
  }

  // Shared legend config (only where legends are shown).
  // Chart.js auto-swatches from dataset pointBackgroundColor; for multi-series
  // charts we override per-dataset so the legend markers match the in-chart dots
  // (Health trend chart is the canonical case).
  // Per-dataset legend marker color override for multi-series charts.
  // Chart.js v4 may ignore a function pointBackgroundColor on the legend and
  // fall back to the dataset's own pointBackgroundColor (which for DPT3 is gold,
  // not green). So we accept a source key (line = 'borderColor', dot =
  // 'pointBackgroundColor') and read the legend marker hue from that key per
  // dataset. The Health trend chart passes 'borderColor' so the legend marker
  // hue matches the line hue (DPT3 green, Malaria bright gold) even though the
  // in-chart dots themselves are intentionally different.
  function legend(display, datasetColors, sourceKey) {
    var base = {
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
    sourceKey = sourceKey || 'pointBackgroundColor';
    if (datasetColors && datasetColors.length) {
      base.plugins = base.plugins || {};
      base.plugins.legend = base.plugins.legend || {};
      base.plugins.legend.labels = base.plugins.legend.labels || {};
      base.plugins.legend.labels.pointBackgroundColor = function (ctx) {
        var i = ctx.datasetIndex;
        if (i >= datasetColors.length) return token('ink-soft');
        var ds = ctx.chart.data.datasets[i];
        return ds[sourceKey] || datasetColors[i];
      };
      base.plugins.legend.labels.padding = 14;
    }
    return base;
  }

  // Health trend chart gets a bespoke HTML legend (two dots painted exactly
  // green and bright-gold with a dark outline on the malaria one) because Chart.js
  // v4 on this build does not honor the per-dataset legend-marker override for the
  // DPT3 series and falls back to the dataset pointBackgroundColor (gold). The
  // helper itself is left generic and unused by the other chart types.
  function renderHealthLegend(canvasId, colors, labels) {
    var host = document.getElementById(canvasId);
    if (!host) return;
    var wrap = host.parentNode;
    if (!wrap) return;
    // Remove any previous bespoke legend we may have appended.
    var prev = wrap.querySelector('.' + HEALTH_LEGEND_CLASS);
    if (prev) prev.remove();
    var row = document.createElement('div');
    row.className = HEALTH_LEGEND_CLASS;
    var items = [
      { color: colors[0], stroke: null },
      { color: colors[1], stroke: token('ink') }
    ];
    items.forEach(function (it, i) {
      var item = document.createElement('div');
      item.className = 'hl-item';
      var dot = document.createElement('span');
      dot.className = 'hl-dot';
      dot.style.background = it.color;
      dot.style.display = 'inline-block';
      dot.style.width = '9px';
      dot.style.height = '9px';
      dot.style.borderRadius = '50%';
      if (it.stroke) {
        dot.style.outline = '1.5px solid ' + it.stroke;
        dot.style.outlineOffset = '1px';
      }
      var txt = document.createElement('span');
      txt.className = 'hl-label';
      txt.textContent = labels[i];
      item.appendChild(dot);
      item.appendChild(txt);
      row.appendChild(item);
    });
    wrap.appendChild(row);
  }
  var HEALTH_LEGEND_CLASS = 'hl-legend';

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

  // Y-axis only, dashed hairline grid, mono ticks (redesign-spec §4.6).
  // Overrides are merged *per axis* rather than replacing the whole axis:
  // every caller restates `y`/`x` for its own ticks, and a flat Object.assign
  // silently dropped the grid/border styling here for all of them.
  function gridAxes(overrides) {
    var base = {
      y: {
        beginAtZero: true,
        grid: { color: token('hairline'), drawBorder: false, borderDash: [3, 4] },
        border: { display: false },
        ticks: { color: token('ink-faint'), font: { family: MONO_FONT, size: 10 }, padding: 6 }
      },
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: token('ink-faint'), font: { family: MONO_FONT, size: 10 } }
      }
    };
    Object.keys(overrides || {}).forEach(function (axis) {
      base[axis] = Object.assign({}, base[axis], overrides[axis]);
    });
    return base;
  }

  // ---------- gradient fills (redesign-spec §4.6) ----------

  // Append an 8-digit-hex alpha suffix to a #rrggbb color. Every color in this
  // app is hex (tokens + the status maps in app.js); anything else is returned
  // untouched so a stray rgb()/named color degrades to a flat fill.
  function alpha(color, suffix) {
    var c = String(color || '');
    return /^#[0-9a-fA-F]{6}$/.test(c) ? c + suffix : c;
  }

  // Scriptable gradient fill across the chart area. `vertical` runs
  // bottom -> top (bars grow up, so the strong stop sits on the axis and the
  // tip fades); horizontal runs left -> right for hbar.
  //
  // MUST return the flat color when chartArea is undefined: Chart.js evaluates
  // scriptable options once before the first layout pass, and reading
  // area.bottom there throws.
  function gradient(color, vertical, fromAlpha, toAlpha) {
    return function (ctx) {
      var area = ctx && ctx.chart && ctx.chart.chartArea;
      if (!area) return color;
      var g;
      try {
        g = vertical
          ? ctx.chart.ctx.createLinearGradient(0, area.bottom, 0, area.top)
          : ctx.chart.ctx.createLinearGradient(area.left, 0, area.right, 0);
        g.addColorStop(0, alpha(color, fromAlpha || 'ff'));
        g.addColorStop(1, alpha(color, toAlpha || '33'));
      } catch (e) { return color; }
      return g;
    };
  }

  // Index of the leading (highest) bar — it gets the gold accent gradient.
  // -1 when every value is zero, so an empty chart has no false leader.
  function leadIndex(values) {
    var best = 0, at = -1;
    (values || []).forEach(function (v, i) {
      var n = Number(v) || 0;
      if (n > best) { best = n; at = i; }
    });
    return at;
  }

  // The gold accent (§4.6 "green -> gold for the last bar") is a flourish for
  // bars that are all one hue. When the caller passes per-bar colors that MEAN
  // something — the Projects progress chart colors each bar by project status —
  // recoloring the tallest bar gold silently reports the wrong status: Kaduna
  // rendered gold at 100% while its actual status is "Completed" (green), both
  // on screen and in the PDF. So: more than one distinct color in, no accent.
  function accentFor(colors, values) {
    var distinct = {};
    (colors || []).forEach(function (c) { if (c) distinct[String(c)] = 1; });
    return Object.keys(distinct).length > 1 ? -1 : leadIndex(values);
  }

  // Per-bar scriptable fill: each bar gradients in its own color, and the
  // leading bar switches to gold (§4.6 "green -> gold for the last bar").
  function barFill(colors, vertical, accentIndex) {
    return function (ctx) {
      var i = ctx && ctx.dataIndex ? ctx.dataIndex : 0;
      var base = colors[i % colors.length];
      if (accentIndex >= 0 && i === accentIndex) base = token('gold') || base;
      return gradient(base, vertical, 'ff', '33')(ctx);
    };
  }

  // Center label for the doughnut ring (§4.6 "center label optional"): the
  // total in mono, a caption underneath. Declared inline per chart so it is
  // never registered globally and only ever affects the chart it is given to.
  function centerLabel(caption) {
    return {
      id: 'pmCenterLabel',
      afterDatasetsDraw: function (chart) {
        var area = chart.chartArea;
        if (!area) return;
        var data = (chart.data.datasets[0] && chart.data.datasets[0].data) || [];
        var total = 0;
        data.forEach(function (v) { total += Number(v) || 0; });
        var meta = chart.getDatasetMeta(0);
        var arc = meta && meta.data && meta.data[0];
        var cx = arc ? arc.x : (area.left + area.right) / 2;
        var cy = arc ? arc.y : (area.top + area.bottom) / 2;
        var c = chart.ctx;
        c.save();
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = token('ink');
        c.font = '600 18px ' + MONO_FONT;
        c.fillText(compact(total), cx, cy - 6);
        c.fillStyle = token('ink-faint');
        c.font = '500 10px ' + BODY_FONT;
        c.fillText(caption, cx, cy + 10);
        c.restore();
      }
    };
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
      animation: animation(),
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
          backgroundColor: barFill(colors, true, accentFor(colors, values)),
          borderRadius: 6,
          maxBarThickness: 40,
          hoverBackgroundColor: colors
        }]
      },
      options: options
    });
    return registry[id];
  }

  // Evaluated per call, never cached: reading the tokens once at module load
  // froze the light-theme hexes for the whole session, so every palette-driven
  // series (doughnut slices, grouped bars) stayed light in dark mode.
  function palette() {
    return [token('green'), token('gold'), token('green-soft'), token('bad'), token('info'), token('ink-faint')];
  }
  function colorFor(i) {
    var p = palette();
    return p[i % p.length] || '#a0aec0';
  }

  // Distinct two-color scheme for health trend lines so the two series never
  // collide (the global PALETTE assigns the same gold to both the 1st and 2nd
  // series in some renderings). Green = immunization/coverage (up is good);
  // deep gold = malaria prevalence (down is good) — kept visually distinct
  // from the doughtnut ring and from each other.
  function healthTrendColors(i) {
    // DPT3 immunization (series 0) = clear green; Malaria prevalence
    // under-5 (series 1) = true warm gold. Use a brighter gold + a dark
    // outline for the malaria dots so the two series are unmistakable in
    // both themes (the lighter gold-deep alone can read as 'dark green-ish'
    // on a dark background at legend-swatch size).
    return i === 0 ? token('green') : token('gold-bright');
  }

  function doughnut(id, labels, values, opts) {
    if (typeof Chart === 'undefined') {
      throw new Error('Chart.js failed to load from CDN.');
    }
    destroy(id);
    var canvas = document.getElementById(id);
    if (!canvas) return;
    var options = Object.assign({
      responsive: true,
      maintainAspectRatio: false,
      animation: animation(),
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
    }, opts || {});

    registry[id] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: labels.map(function (_, i) { return colorFor(i); }),
          borderWidth: 4, // §4.6: 4px gaps between slices
          borderColor: token('card'),
          hoverOffset: 6
        }]
      },
      options: options,
      plugins: [centerLabel((opts && opts.centerCaption) || 'total')]
    });
    return registry[id];
  }

  function line(id, labels, series, opts) {
    if (typeof Chart === 'undefined') {
      throw new Error('Chart.js failed to load from CDN.');
    }
    destroy(id);
    var canvas = document.getElementById(id);
    if (!canvas) return;
    // Under-line wash for series 0 only (§4.6). Derived from the real
    // chartArea rather than a hardcoded 300px height, so it still fades to
    // the axis at any canvas size — including the tall PDF capture stage.
    var grad = gradient(token('green'), true, '00', '33');
    var options = Object.assign({
      responsive: true,
      maintainAspectRatio: false,
      animation: animation(),
      plugins: {
        legend: { display: false },
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
    }, opts || {});

    registry[id] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: series.map(function (s, i) {
          var base = healthTrendColors(i);
          return {
            label: s.label,
            data: s.data,
            borderColor: base,
            backgroundColor: i === 0 ? grad : 'transparent',
            tension: 0.35,
            pointRadius: 3,
            pointBackgroundColor: i === 0 ? token('gold') : token('gold-bright'),
            pointBorderColor: i === 0 ? token('card') : token('ink'),
            pointBorderWidth: i === 0 ? 1.5 : 1.25,
            borderWidth: 2.5,
            fill: i === 0 ? true : false
          };
        })
      },
      options: options
    });
    renderHealthLegend(id, [token('green'), token('gold-bright')], series.map(function (s) { return s.label; }));
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
            backgroundColor: gradient(s.color || colorFor(i), true, 'ff', '33'),
            hoverBackgroundColor: s.color || colorFor(i),
            borderRadius: 4,
            maxBarThickness: 20,
            borderSkipped: false
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: animation(),
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
          backgroundColor: barFill(colors, false, -1),
          hoverBackgroundColor: colors,
          borderRadius: 6,
          maxBarThickness: 16,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: animation(),
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
      animation: animation(),
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

  return {
    bar: bar, groupedBar: groupedBar, hbar: hbar, doughnut: doughnut, line: line, radar: radar,
    destroy: destroy, destroyAll: destroyAll, get: get, withThemeScope: withThemeScope
  };
})();