/* ==========================================================================
 * js/map.js — facility map (spec §6 Tab 2, decision #4)
 *
 * Two layers:
 *   1. Aggregates — a circle per state, sized by facility count (shown by
 *      default at low zoom).
 *   2. Points — when zoomed to level 8+, fetch facilities inside the current
 *      bounding box (GRID3 live, or the seeded set when the live source is
 *      unavailable) and render them in a Leaflet.markercluster group.
 * ========================================================================== */

window.PMMap = (function () {
  'use strict';

  var DETAIL_ZOOM = 8;
  // Padded country box: full Nigeria frame for the initial view (southern
  // states included), and a wider maxBounds so panning never drifts to the
  // whole continent.
  var NIGERIA_FRAME = [[4.0, 2.7], [14.1, 14.8]];
  var MAX_BOUNDS = [[2.5, 1.0], [15.0, 15.5]];
  var map = null;
  var aggLayer = null;
  var clusterLayer = null;
  var seenPointKeys = {};
  var initialized = false;
  var loadInProgress = false;

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function init(containerId) {
    if (initialized) return true;
    if (typeof L === 'undefined') return false;

    var container = document.getElementById(containerId);
    if (!container) return false;

    // Nigeria-focused framing: minZoom 5 + padded country maxBounds so the
    // basemap never zooms out to the whole continent (slow tile load, clutter),
    // while the initial view fits ALL of Nigeria — southern states included.
    map = L.map(container, {
      zoomControl: true,
      minZoom: 5,
      maxBounds: MAX_BOUNDS,
      maxBoundsViscosity: 0.8
    });
    fitToNigeria();

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    aggLayer = L.layerGroup().addTo(map);
    clusterLayer = L.markerClusterGroup({ maxClusterRadius: 45, chunkedLoading: true });
    map.addLayer(clusterLayer);

    map.on('zoomend', function () {
      if (map.getZoom() >= DETAIL_ZOOM) loadVisiblePoints();
    });

    initialized = true;
    return true;
  }

  // State aggregate circles from current aggregates (live or sample).
  function renderAggregates(aggregates) {
    if (!map || !aggLayer) return;
    aggLayer.clearLayers();
    var centroids = PMHealthData.getStateCentroids();

    aggregates.byState.forEach(function (g) {
      var c = centroids[g.key];
      if (!c) return; // state centroid table lacks the key
      var radius = 5 + Math.sqrt(g.count) * 0.5;
      var marker = L.circleMarker([c[0], c[1]], {
        radius: Math.min(radius, 26),
        color: '#ffffff',
        weight: 1.5,
        fillColor: '#008751',
        fillOpacity: 0.55
      });
      marker.bindTooltip(g.key + ': ' + g.count.toLocaleString() + ' facilities', { direction: 'top' });
      marker.on('click', function () {
        map.flyTo([c[0], c[1]], 9, { duration: 1.2 });
      });
      aggLayer.addLayer(marker);
    });
  }

  function addPointMarkers(points) {
    if (!clusterLayer) return;
    points.forEach(function (p) {
      var key = p.lat.toFixed(4) + ',' + p.lng.toFixed(4);
      if (seenPointKeys[key]) return;
      seenPointKeys[key] = true;
      var m = L.marker([p.lat, p.lng]);
      m.bindPopup(
        '<strong>' + escapeHtml(p.name) + '</strong><br>' +
        escapeHtml(p.level) + ' • ' + escapeHtml(p.ownership)
      );
      clusterLayer.addLayer(m);
    });
  }

  function isSampleSource() {
    try {
      return PMHealthData.currentState().facilitySource === 'sample';
    } catch (e) { return true; }
  }

  function loadVisiblePoints() {
    if (!map || loadInProgress) return;
    loadInProgress = true;
    var bounds = map.getBounds();
    var fetcher = isSampleSource() ? PMHealthData.fetchSeedPointsInBBox(bounds)
                                   : PMHealthData.fetchPointsInBBox(bounds);
    fetcher.then(function (points) {
      if (points && points.length) addPointMarkers(points);
    }).finally(function () { loadInProgress = false; });
  }

  function invalidateSize() {
    if (map) setTimeout(function () { map.invalidateSize(); }, 60);
  }

  // Frame the whole country (narrow screens drop to zoom 5 to fit it).
  function fitToNigeria() {
    if (!map) return;
    map.fitBounds(NIGERIA_FRAME, { padding: [12, 12], maxZoom: 6 });
  }

  function getMap() { return map; }

  return {
    init: init,
    renderAggregates: renderAggregates,
    invalidateSize: invalidateSize,
    fitToNigeria: fitToNigeria,
    isReady: function () { return initialized; },
    getMap: getMap
  };
})();
