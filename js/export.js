/* ==========================================================================
 * js/export.js — Export tab: PNG snapshot + share link (Phase 3, spec §5)
 *
 * PNG: captures the active .tab-panel.active via html2canvas, retina-scaled,
 * themed to whatever data-theme is currently set on <html> (so dark-mode users
 * get a dark snapshot and light-mode users get a paper snapshot). Filename:
 * dashboard-YYYY-MM-DD.png.
 *
 * Share link: copies https://batestguy.github.io/HealthMgtDashboard/ + the
 * active tab hash so anyone opening it lands on the same tab.
 *
 * PDF is intentionally deferred (UI card already says "coming next");
 * this module does not touch jsPDF.
 * ========================================================================== */

(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  // Active tab name reuse the same hash logic app.js uses (activeTabName).
  function activeHash() {
    try {
      var t = (location.hash || '').replace('#', '');
      var known = (t === 'projects' || t === 'health' || t === 'showcase' ||
                  t === 'ask' || t === 'export');
      return known ? ('#' + t) : '';
    } catch (e) { return ''; }
  }

  // Current theme as CSS would render it, so the PNG honours light/dark.
  function currentTheme() {
    try {
      var t = document.documentElement.getAttribute('data-theme');
      return (t === 'dark' || t === 'light') ? t : 'light';
    } catch (e) { return 'light'; }
  }

  var BASE_URL = 'https://batestguy.github.io/HealthMgtDashboard/';

  // Plain-text copy with the clipboard API if available, else execCommand.
  function copyText(text) {
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch (e) { return false; }
  }

  function statusEl(id) { var el = $(id); if (!el) return null; el.classList.remove('ok', 'err'); return el; }

  function toast(msg) {
    if (window.PMApp && window.PMApp.toast) return window.PMApp.toast(msg);
    var t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    setTimeout(function () { t.hidden = true; }, 2600);
  }

  function pngStatus(msg, ok) {
    var el = statusEl('export-png-status');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    el.classList.toggle('ok', !!ok);
    el.classList.toggle('err', !ok && !!msg);
  }

  function shareStatus(msg, ok) {
    var el = statusEl('export-share-status');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    el.classList.toggle('ok', !!ok);
    el.classList.toggle('err', !ok && !!msg);
  }

  function dateStamp() {
    var d = new Date();
    var y = d.getFullYear();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var day = ('0' + d.getDate()).slice(-2);
    return y + '-' + m + '-' + day;
  }

  function capturePng() {
    var panel = document.querySelector('.tab-panel.active');
    if (!panel) { pngStatus('Nothing to capture — open a tab first.', false); return; }

    if (typeof html2canvas === 'undefined') {
      pngStatus('PNG library did not load from CDN.', false);
      return;
    }

    pngStatus('Capturing…', false);
    var scale = 2; // retina-ish
    var canvas = html2canvas(panel, {
      scale: scale,
      useCORS: true,
      allowTaint: false,
      backgroundColor: null, // honour the panel's own bg (paper or forest)
      logging: false
    });
    canvas.then(function (c) {
      try {
        var link = document.createElement('a');
        link.download = 'dashboard-' + dateStamp() + '.png';
        link.href = c.toDataURL('image/png');
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        pngStatus('PNG downloaded — ' + Math.round(c.width / scale) + '×' + Math.round(c.height / scale), true);
      } catch (e) {
        pngStatus('PNG download failed: ' + e.message, false);
      }
    }).catch(function (err) {
      pngStatus('PNG capture failed: ' + (err && err.message ? err.message : String(err)), false);
    });
  }

  function copyShareLink() {
    var hash = activeHash();
    var url = BASE_URL + hash;
    var ok = copyText(url);
    if (ok) {
      shareStatus('Share link copied — opens ' + (hash || 'the home tab'), true);
      // Brief success feedback that self-clears.
      setTimeout(function () {
        var el = statusEl('export-share-status');
        if (el) { el.textContent = 'Link copied — paste it anywhere.'; }
      }, 10);
    } else {
      shareStatus('Copy failed — press and hold to copy ' + url, false);
    }
  }

  function init() {
    var pngBtn = $('btn-export-png');
    var shareBtn = $('btn-export-share');
    if (pngBtn) pngBtn.addEventListener('click', capturePng);
    if (shareBtn) shareBtn.addEventListener('click', copyShareLink);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
