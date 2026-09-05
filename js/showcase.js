/* ==========================================================================
 * js/showcase.js — "This Project" showcase tab (spec showcase-spec.md)
 *
 * Renders the evidence-based capability radar, fills in the contact email,
 * and wires the Try-it deep links + copy-email buttons. All content copy is
 * draft (placeholder) pending the copy-lock pass — see showcase-spec.md §7.
 * ========================================================================== */

window.PMShowcase = (function () {
  'use strict';

  // ⟦COPY-LOCK⟧ Replace with the real address before sharing this link with
  // recruiters (showcase-spec.md §7). Single source of truth for the UI text
  // and the clipboard button.
  var EMAIL = 'you@example.com';

  var initialized = false;

  function $(id) { return document.getElementById(id); }

  // ------------------------------------------------------------------------
  // Evidence-based radar — each axis value is the count of shipped feature
  // items mapped to that area in this repository (not a self-rated score).
  // ------------------------------------------------------------------------
  var AREAS = [
    {
      label: 'Data analysis + viz',
      items: ['Excel → dashboard pipeline', '6 chart types', 'Filterable KPIs + tracker', 'Portfolio health bar', 'Spend vs plan analysis', 'Trend lines + indicator list']
    },
    {
      label: 'Engineering + architecture',
      items: ['One hand-written module per tab', 'No-build CDN-only deploy', 'Graceful API fallbacks', 'Per-sheet Excel validation', 'Spec + workflow docs', 'Clean slice-by-slice git history']
    },
    {
      label: 'Live data + APIs',
      items: ['51,022-facility GRID3 map', 'ArcGIS group-by aggregates', 'On-demand bbox point queries', 'HDX HAPI attempt + fallback', 'Session point caching']
    },
    {
      label: 'UX + product thinking',
      items: ['Mobile-first (375px) design', 'Deep-linkable tabs', '44px touch targets', 'Per-sheet error reporting UX', 'Upload, drag-drop + sample', 'Reduced-motion support']
    },
    {
      label: 'Health + PM domain',
      items: ['Facility level + ownership model', 'Immunization + malaria indicators', 'PM portfolio health statuses', 'Geo-validation against Nigeria', 'Key indicator taxonomy']
    }
  ];

  function radarLabels() {
    return AREAS.map(function (a) { return a.label; });
  }

  function radarValues() {
    return AREAS.map(function (a) { return a.items.length; });
  }

  // ------------------------------------------------------------------------
  // Radar chart
  // ------------------------------------------------------------------------
  function drawRadar() {
    var card = $('card-radar');
    if (!card) return;
    try {
      var opts = {};
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        opts.animation = false;
      }
      PMCharts.radar('chart-radar', radarLabels(), radarValues(), opts);
    } catch (e) {
      card.hidden = true; // Chart.js unavailable — degrade gracefully
    }
  }

  // ------------------------------------------------------------------------
  // Email CTA (two buttons share one handler)
  // ------------------------------------------------------------------------
  function fillEmail() {
    var node = $('show-email');
    if (node) node.textContent = EMAIL;
  }

  function copyText(text) {
    function legacyCopy() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, legacyCopy);
    }
    return Promise.resolve(legacyCopy());
  }

  function wireCopyEmail() {
    ['btn-copy-email', 'btn-copy-email-2'].forEach(function (id) {
      var btn = $(id);
      if (!btn) return;
      btn.addEventListener('click', function () {
        copyText(EMAIL).then(function (ok) {
          if (window.PMApp) PMApp.toast(ok ? 'Email copied — ' + EMAIL : 'Press and hold to copy ' + EMAIL);
        });
      });
    });
  }

  // ------------------------------------------------------------------------
  // Try-it deep links — simulate a tap on the matching bottom-tab button so
  // tab activation + hash handling stay in app.js (one source of truth).
  // ------------------------------------------------------------------------
  function wireTryIt() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-goto]'), function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.getAttribute('data-goto');
        var tabBtn = document.querySelector('.tab-btn[data-tab="' + name + '"]');
        if (tabBtn) tabBtn.click();
      });
    });
  }

  // ------------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------------
  function init() {
    if (initialized) return;
    initialized = true;
    fillEmail();
    drawRadar();
    wireCopyEmail();
    wireTryIt();
  }

  return { init: init };
})();
