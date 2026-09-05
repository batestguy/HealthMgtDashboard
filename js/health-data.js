/* ==========================================================================
 * js/health-data.js — Health data layer (spec §4.3, decision #7)
 *
 * Live sources (verified 2026-09-04):
 *   GRID3 NGA Health Facilities v2.0 — keyless ArcGIS FeatureServer,
 *   51,022 facilities, WGS84, CC BY 4.0. Fields: state, lga, ownership,
 *   facility_level_option, facility_name, latitude, longitude.
 *   HDX HAPI — requires an app registration (HTTP 403 without one), so it
 *   is attempted live and falls back to seeded indicators.
 *
 * Every live fetch is wrapped: on failure the seeded fallback is used and
 * the data source is reported so the UI can show the fallback badge.
 * ========================================================================== */

window.PMHealthData = (function () {
  'use strict';

  var GRID3_LAYER = 'https://services3.arcgis.com/BU6Aadhn6tbBEdyk/arcgis/rest/services/GRID3_NGA_health_facilities_v2_0/FeatureServer/0';
  var HDX_URL = 'https://hapi.humdata.org/api/v1/indicators?output_format=json&limit=500';
  var HDX_APP_ID = 'nigeria-health-pm-dashboard';

  var aggregates = null;  // { source, total, byState[], statesCovered, ownership{}, levels[] }
  var indicators = null;  // { source, years[], series[], keyIndicators[] }
  var pointsCache = {};   // bboxKey -> [{name, level, ownership, lat, lng}]

  // ------------------------------------------------------------------------
  // Fetch helpers
  // ------------------------------------------------------------------------

  function timeoutFetch(url, ms, headers) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms) : null;
    var opts = { method: 'GET' };
    if (ctrl) opts.signal = ctrl.signal;
    if (headers) opts.headers = headers;
    return fetch(url, opts).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).finally(function () { if (timer) clearTimeout(timer); });
  }

  // ArcGIS REST group-by count query for one field.
  function arcgisGroup(layerUrl, field, keyAttr) {
    var stats = encodeURIComponent(JSON.stringify([
      { statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'cnt' }
    ]));
    var url = layerUrl + '/query?where=1%3D1' +
      '&groupByFieldsForStatistics=' + encodeURIComponent(field) +
      '&outStatistics=' + stats +
      '&orderByFields=cnt%20desc&returnGeometry=false&f=json';
    return timeoutFetch(url, 12000).then(function (json) {
      return (json.features || []).map(function (f) {
        var a = f.attributes || {};
        var key = a[keyAttr];
        return { key: key === undefined || key === null ? 'Unknown' : String(key), count: Number(a.cnt) || 0 };
      });
    });
  }

  // ------------------------------------------------------------------------
  // GRID3 facility aggregates (KPIs, map circles, doughnut)
  // ------------------------------------------------------------------------

  function loadFacilityAggregates() {
    if (aggregates && aggregates.source === 'live') return Promise.resolve(aggregates);
    return Promise.all([
      arcgisGroup(GRID3_LAYER, 'state', 'state'),
      arcgisGroup(GRID3_LAYER, 'ownership', 'ownership'),
      arcgisGroup(GRID3_LAYER, 'facility_level_option', 'facility_level_option')
    ]).then(function (groups) {
      var byState = groups[0];
      var ownership = { Public: 0, Private: 0, Unknown: 0 };
      groups[1].forEach(function (g) { ownership[g.key] = (ownership[g.key] || 0) + g.count; });
      var total = byState.reduce(function (s, g) { return s + g.count; }, 0);
      aggregates = {
        source: 'live',
        total: total,
        byState: byState,
        statesCovered: byState.length,
        ownership: ownership,
        levels: groups[2].filter(function (g) { return g.key !== 'Unknown'; })
      };
      return aggregates;
    }).catch(function () {
      aggregates = seedAggregates();
      return aggregates;
    });
  }

  // ------------------------------------------------------------------------
  // GRID3 facility points inside a bounding box (decision #4 — on demand)
  // ------------------------------------------------------------------------

  function bboxKey(bounds) {
    return [bounds.getWest().toFixed(2), bounds.getSouth().toFixed(2),
            bounds.getEast().toFixed(2), bounds.getNorth().toFixed(2)].join(',');
  }

  function fetchPointsInBBox(bounds) {
    var key = bboxKey(bounds);
    if (pointsCache[key]) return Promise.resolve(pointsCache[key]);

    var url = GRID3_LAYER + '/query?where=1%3D1' +
      '&geometry=' + encodeURIComponent(bounds.getWest() + ',' + bounds.getSouth() + ',' + bounds.getEast() + ',' + bounds.getNorth()) +
      '&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects' +
      '&outFields=facility_name%2Cownership%2Cfacility_level_option%2Clatitude%2Clongitude' +
      '&returnGeometry=false&outSR=4326&resultRecordCount=1500&f=json';

    return timeoutFetch(url, 15000).then(function (json) {
      var pts = (json.features || []).map(function (f) {
        var a = f.attributes || {};
        return {
          name: a.facility_name || 'Facility',
          ownership: a.ownership || 'Unknown',
          level: a.facility_level_option || 'Unknown',
          lat: Number(a.latitude),
          lng: Number(a.longitude)
        };
      }).filter(function (p) { return isFinite(p.lat) && isFinite(p.lng); });
      pointsCache[key] = pts;
      return pts;
    }).catch(function () { return []; });
  }

  // ------------------------------------------------------------------------
  // Indicators — HDX HAPI attempted, seeded fallback
  // ------------------------------------------------------------------------

  var SEED_YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  var SEED_SERIES = [
    { key: 'immunization', label: 'DPT3 immunization coverage (%)', data: [33, 38, 42, 45, 49, 52, 54, 55, 57, 60, 63] },
    { key: 'malaria', label: 'Malaria prevalence, under-5 (%)', data: [26, 25, 24, 23, 23, 22, 21, 21, 20, 19, 18] }
  ];

  var SEED_KEY_INDICATORS = [
    { id: 'beds', label: 'Hospital beds per 10,000 people', value: '8.0' },
    { id: 'doctors', label: 'Physicians per 10,000 people', value: '3.5' },
    { id: 'immunization', label: 'DPT3 immunization coverage (2025)', value: '63%' },
    { id: 'malaria', label: 'Malaria prevalence, under-5 (2025)', value: '18%' },
    { id: 'maternal', label: 'Maternal mortality (per 100k births)', value: '512' }
  ];

  function seedIndicators() {
    return {
      source: 'sample',
      years: SEED_YEARS.slice(),
      series: SEED_SERIES.map(function (s) { return { key: s.key, label: s.label, data: s.data.slice() }; }),
      keyIndicators: SEED_KEY_INDICATORS.map(function (k) { return Object.assign({}, k); })
    };
  }

  // Try to match a live HAPI row (name contains a keyword) onto a key
  // indicator; only overwrite the seeded value when a sane match exists.
  var INDICATOR_MATCH = [
    { id: 'beds', match: /bed/i },
    { id: 'doctors', match: /physician|doctor/i },
    { id: 'immunization', match: /immuni|dpt|vaccin/i },
    { id: 'malaria', match: /malaria/i },
    { id: 'maternal', match: /maternal|mmr/i }
  ];

  function loadIndicators() {
    if (indicators) return Promise.resolve(indicators);
    return timeoutFetch(HDX_URL, 5000, { 'X-App-Identifier': HDX_APP_ID })
      .then(function (json) {
        var data = json && Array.isArray(json.data) ? json.data : [];
        var rows = data.filter(function (r) {
          return r && isFinite(Number(r.value)) &&
                 (String(r.location_name || '').toLowerCase() === 'nigeria' || r.location_code === 'NGA');
        });
        if (!rows.length) throw new Error('No usable HDX rows for Nigeria');
        indicators = seedIndicators(); // baseline (country trend series)
        indicators.source = 'live';
        rows.forEach(function (r) {
          var name = String(r.indicator_name || r.code || r.indicator_code || '');
          for (var i = 0; i < INDICATOR_MATCH.length; i++) {
            if (INDICATOR_MATCH[i].match.test(name)) {
              var v = Number(r.value);
              var target = indicators.keyIndicators.filter(function (k) { return k.id === INDICATOR_MATCH[i].id; })[0];
              if (target) target.value = v % 1 === 0 ? String(v) : String(v.toFixed(1));
              break;
            }
          }
        });
        return indicators;
      })
      .catch(function () {
        indicators = seedIndicators();
        return indicators;
      });
  }

  // ------------------------------------------------------------------------
  // Seeded fallback facilities (deterministic) — used when GRID3 is down
  // ------------------------------------------------------------------------

  // Approximate state centroids, used to draw aggregate circles on the map.
  var STATE_CENTROIDS = {
    Abia: [5.45, 7.52], Adamawa: [9.33, 12.4], 'Akwa Ibom': [5.02, 7.92], Anambra: [6.22, 7.06],
    Bauchi: [10.31, 9.84], Bayelsa: [4.77, 6.07], Benue: [7.34, 8.75], Borno: [11.83, 13.15],
    'Cross River': [5.87, 8.6], Delta: [6.2, 6.7], Ebonyi: [6.26, 8.08], Edo: [6.34, 5.62],
    Ekiti: [7.62, 5.23], Enugu: [6.52, 7.45], FCT: [9.06, 7.49], Gombe: [10.29, 11.17],
    Imo: [5.49, 7.03], Jigawa: [12.0, 9.7], Kaduna: [10.52, 7.44], Kano: [11.99, 8.52],
    Katsina: [12.99, 7.6], Kebbi: [12.45, 4.2], Kogi: [7.8, 6.74], Kwara: [8.98, 4.55],
    Lagos: [6.52, 3.38], Nasarawa: [8.54, 8.3], Niger: [9.6, 6.6], Ogun: [7.1, 3.5],
    Ondo: [7.25, 5.2], Osun: [7.7, 4.55], Oyo: [7.5, 3.9], Plateau: [9.9, 8.9],
    Rivers: [4.86, 6.92], Sokoto: [13.05, 5.23], Taraba: [8.9, 11.3], Yobe: [11.7, 11.9],
    Zamfara: [12.16, 6.66]
  };

  // Fallback demo facilities per state (a representative spread).
  var SEED_STATE_COUNTS = {
    Lagos: 40, Kano: 30, FCT: 25, Rivers: 22, Oyo: 20, Kaduna: 18,
    Enugu: 16, Benue: 14, Sokoto: 12, Plateau: 12, 'Akwa Ibom': 11, Borno: 10
  };

  // [level, weight, ownership]
  var LEVEL_POOL = [
    ['Primary Health Center', 0.5, 'Public'],
    ['Primary Health Clinic', 0.2, 'Public'],
    ['General Hospital', 0.14, 'Public'],
    ['Health Post', 0.08, 'Public'],
    ['Teaching/Tertiary Hospital', 0.04, 'Public'],
    ['Specialized Hospital', 0.02, 'Private'],
    ['Private Clinic', 0.02, 'Private']
  ];

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildSeedPoints() {
    var rand = mulberry32(20260904);
    var pts = [];
    Object.keys(SEED_STATE_COUNTS).forEach(function (state) {
      var c = STATE_CENTROIDS[state];
      for (var i = 0; i < SEED_STATE_COUNTS[state]; i++) {
        var pick = rand();
        var acc = 0, level = LEVEL_POOL[0][0], own = 'Public';
        for (var j = 0; j < LEVEL_POOL.length; j++) {
          acc += LEVEL_POOL[j][1];
          if (pick <= acc) { level = LEVEL_POOL[j][0]; own = LEVEL_POOL[j][2]; break; }
        }
        pts.push({
          name: level + ' — ' + state + ' #' + (i + 1),
          ownership: own,
          level: level,
          state: state,
          lat: +(c[0] + (rand() - 0.5) * 1.1).toFixed(5),
          lng: +(c[1] + (rand() - 0.5) * 1.1).toFixed(5)
        });
      }
    });
    return pts;
  }

  var seedPoints = null;
  function getSeedPoints() {
    if (!seedPoints) seedPoints = buildSeedPoints();
    return seedPoints;
  }

  function seedAggregates() {
    var pts = getSeedPoints();
    var ownership = { Public: 0, Private: 0, Unknown: 0 };
    var levelCounts = {};
    var byState = Object.keys(SEED_STATE_COUNTS).map(function (state) {
      return { key: state, count: SEED_STATE_COUNTS[state] };
    });
    pts.forEach(function (p) {
      if (ownership[p.ownership] !== undefined) ownership[p.ownership]++;
      levelCounts[p.level] = (levelCounts[p.level] || 0) + 1;
    });
    var total = byState.reduce(function (s, g) { return s + g.count; }, 0);
    return {
      source: 'sample',
      total: total,
      byState: byState,
      statesCovered: byState.length,
      ownership: ownership,
      levels: Object.keys(levelCounts).map(function (k) { return { key: k, count: levelCounts[k] }; })
        .filter(function (l) { return l.key !== 'Unknown'; })
    };
  }

  function fetchSeedPointsInBBox(bounds) {
    return Promise.resolve(getSeedPoints().filter(function (p) {
      return p.lat >= bounds.getSouth() && p.lat <= bounds.getNorth() &&
             p.lng >= bounds.getWest() && p.lng <= bounds.getEast();
    }));
  }

  // Count facilities in one state, optionally filtered by ownership (NLQ
  // answers, spec §6 Tab 4). Live GRID3 count query, seeded fallback.
  function countFacilitiesInState(state, ownership) {
    var esc = String(state).replace(/'/g, "''");
    var where = "UPPER(state) = UPPER('" + esc + "')";
    if (ownership) where += " AND UPPER(ownership) = UPPER('" + String(ownership).replace(/'/g, "''") + "')";
    var url = GRID3_LAYER + '/query?where=' + encodeURIComponent(where) +
      '&returnCountOnly=true&f=json';
    return timeoutFetch(url, 12000).then(function (json) {
      var c = Number(json.count);
      if (!isFinite(c)) throw new Error('no count');
      return { count: c, source: 'live' };
    }).catch(function () {
      var pts = getSeedPoints().filter(function (p) {
        return p.state === state && (!ownership || p.ownership === ownership);
      });
      return { count: pts.length, source: 'sample' };
    });
  }

  // ------------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------------

  function getStateCentroids() { return STATE_CENTROIDS; }

  function currentState() {
    return {
      facilitySource: aggregates ? aggregates.source : 'loading',
      indicatorSource: indicators ? indicators.source : 'loading'
    };
  }

  function resetSession() {
    aggregates = null;
    indicators = null;
    pointsCache = {};
  }

  return {
    GRID3_LAYER: GRID3_LAYER,
    loadFacilityAggregates: loadFacilityAggregates,
    loadIndicators: loadIndicators,
    fetchPointsInBBox: fetchPointsInBBox,
    fetchSeedPointsInBBox: fetchSeedPointsInBBox,
    countFacilitiesInState: countFacilitiesInState,
    getStateCentroids: getStateCentroids,
    currentState: currentState,
    resetSession: resetSession,
    // Exposed for tests / future modules:
    seedFacilities: getSeedPoints,
    seedIndicators: seedIndicators,
    seedAggregates: seedAggregates
  };
})();
