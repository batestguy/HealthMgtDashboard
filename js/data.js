/* ==========================================================================
 * js/data.js — data layer (spec §4)
 *
 * Parses the 5-sheet Excel workbook (Projects, Tasks, Resources, Finances,
 * Locations), validates each sheet, and keeps a normalized in-memory store.
 * Also loads the seeded sample workbook (assets/sample-data.xlsx).
 *
 * Session-only: nothing is persisted (decision #16).
 * ========================================================================== */

window.PMData = (function () {
  'use strict';

  var SAMPLE_URL = 'assets/sample-data.xlsx';

  // Sheet name -> required columns (canonical display names, spec §4.1).
  var SHEET_SPECS = {
    Projects:   { cols: ['ProjectID', 'Name', 'Budget', 'StartDate', 'EndDate', 'Status', 'Owner', 'Region'] },
    Tasks:      { cols: ['TaskID', 'ProjectID', 'Title', 'Assignee', 'Status', 'Priority', 'DueDate', 'Completion%'] },
    Resources:  { cols: ['ResourceID', 'ProjectID', 'Type', 'Name', 'Cost', 'Allocation%'] },
    Finances:   { cols: ['ProjectID', 'Month', 'PlannedSpend', 'ActualSpend', 'Variance'] },
    Locations:  { cols: ['ProjectID', 'State', 'LGA', 'Latitude', 'Longitude'] }
  };

  var NIGERIA_BBOX = { latMin: 4, latMax: 14, lngMin: 2, lngMax: 15 };

  // Normalized (lowercase, alnum-only) column name -> canonical column name.
  function normalizeHeader(h) {
    return String(h).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  var HEADER_LOOKUP = {};
  Object.keys(SHEET_SPECS).forEach(function (sheet) {
    SHEET_SPECS[sheet].cols.forEach(function (col) {
      HEADER_LOOKUP[normalizeHeader(col)] = col;
    });
  });

  var dataset = null;   // normalized rows, or null until a workbook is loaded
  var lastReport = null;

  // ------------------------------------------------------------------------
  // Workbook → rows + report
  // ------------------------------------------------------------------------

  function parseWorkbook(workbook, sourceLabel) {
    var report = {
      source: sourceLabel,
      ok: true,
      sheetResults: [], // { name, rowCount, ok, errors: [] }
      unknownSheets: []
    };

    var next = { projects: [], tasks: [], resources: [], finances: [], locations: [] };

    Object.keys(SHEET_SPECS).forEach(function (sheetName) {
      var ws = findSheet(workbook, sheetName);
      var result = { name: sheetName, rowCount: 0, ok: true, errors: [] };
      if (!ws) {
        result.ok = false;
        result.errors.push('Sheet "' + sheetName + '" not found in workbook.');
        report.ok = false;
        report.sheetResults.push(result);
        return;
      }
      try {
        var rows = XLSX.utils.sheet_to_json(ws, { defval: null });
      } catch (e) {
        result.ok = false;
        result.errors.push('Could not read sheet: ' + e.message);
        report.ok = false;
        report.sheetResults.push(result);
        return;
      }
      if (!rows.length) {
        result.ok = false;
        result.errors.push('Sheet is empty (no data rows).');
        report.ok = false;
        report.sheetResults.push(result);
        return;
      }

      // sheet_to_json returns data rows only (first row was consumed as the
      // header), so every row here is a data row — never slice off row 1.
      var headerMap = buildHeaderMap(rows[0] || {}, sheetName, result, report);

      rows.forEach(function (row, i) {
        var excelRow = i + 2; // 1-based, incl. the header row
        var parsed = parseRow(sheetName, row, headerMap, excelRow, result, report);
        if (parsed) next[lowerCaseFirst(sheetName)].push(parsed);
      });

      result.rowCount = next[lowerCaseFirst(sheetName)].length;
      if (result.rowCount === 0 && result.errors.length === 0) {
        result.ok = false;
        result.errors.push('No valid data rows.');
        report.ok = false;
      }
      report.sheetResults.push(result);
    });

    // Foreign-key integrity across sheets.
    applyForeignKeys(next, report);

    if (report.ok) dataset = next;
    lastReport = report;
    return { dataset: next, report: report };
  }

  function findSheet(workbook, expectedName) {
    if (!workbook.SheetNames) return null;
    for (var i = 0; i < workbook.SheetNames.length; i++) {
      var name = workbook.SheetNames[i];
      if (String(name).trim().toLowerCase() === expectedName.toLowerCase()) {
        return workbook.Sheets[name];
      }
    }
    return null;
  }

  function buildHeaderMap(firstRow, sheetName, result, report) {
    // firstRow: { [originalHeader]: value } — map normalized -> canonical column
    var map = {}; // canonical col -> index? we use header names: canonical col name -> original header key
    Object.keys(firstRow).forEach(function (original) {
      var norm = normalizeHeader(original);
      var canonical = HEADER_LOOKUP[norm];
      if (canonical && !(canonical in map)) map[canonical] = original;
    });
    SHEET_SPECS[sheetName].cols.forEach(function (col) {
      if (!(col in map)) {
        result.ok = false;
        report.ok = false;
        result.errors.push('Missing required column "' + col + '".');
      }
    });
    return map;
  }

  function cleanValue(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return v;
    return String(v).trim();
  }

  function parseNumber(v, name, excelRow, sheetName, result, report) {
    if (v === null || v === undefined || v === '') return { value: null, skip: false };
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[₦$,]/g, ''));
    if (isNaN(n)) {
      result.ok = false;
      report.ok = false;
      result.errors.push('Row ' + excelRow + ': "' + name + '" is not a number.');
      return { value: null, skip: true };
    }
    return { value: n, skip: false };
  }

  function parsePercent(v, name, excelRow, sheetName, result, report) {
    var p = parseNumber(v, name, excelRow, sheetName, result, report);
    if (p.skip || p.value === null) return p;
    if (p.value < 0 || p.value > 100) {
      result.errors.push('Row ' + excelRow + ': "' + name + '" should be 0–100.');
    }
    return p;
  }

  function parseRow(sheetName, row, headerMap, excelRow, result, report) {
    var get = function (col) {
      var key = headerMap[col];
      return key === undefined ? null : row[key];
    };

    // A row is unusable if every cell is blank.
    var anyValue = Object.keys(row).some(function (k) { return cleanValue(row[k]) !== ''; });
    if (!anyValue) return null;

    if (sheetName === 'Projects') {
      var id = cleanValue(get('ProjectID'));
      if (!id) { reportError(result, report, excelRow, 'ProjectID is blank.'); return null; }
      var budget = parseNumber(get('Budget'), 'Budget', excelRow, sheetName, result, report);
      if (budget.skip) return null;
      return {
        ProjectID: id, Name: cleanValue(get('Name')), Budget: budget.value,
        StartDate: cleanValue(get('StartDate')), EndDate: cleanValue(get('EndDate')),
        Status: cleanValue(get('Status')), Owner: cleanValue(get('Owner')), Region: cleanValue(get('Region'))
      };
    }

    if (sheetName === 'Tasks') {
      var tid = cleanValue(get('TaskID'));
      var pid = cleanValue(get('ProjectID'));
      if (!tid) { reportError(result, report, excelRow, 'TaskID is blank.'); return null; }
      var comp = parsePercent(get('Completion%'), 'Completion%', excelRow, sheetName, result, report);
      if (comp.skip) return null;
      return {
        TaskID: tid, ProjectID: pid, Title: cleanValue(get('Title')),
        Assignee: cleanValue(get('Assignee')), Status: cleanValue(get('Status')),
        Priority: cleanValue(get('Priority')), DueDate: cleanValue(get('DueDate')),
        Completion: comp.value === null ? 0 : comp.value
      };
    }

    if (sheetName === 'Resources') {
      var rid = cleanValue(get('ResourceID'));
      var rpid = cleanValue(get('ProjectID'));
      if (!rid) { reportError(result, report, excelRow, 'ResourceID is blank.'); return null; }
      var cost = parseNumber(get('Cost'), 'Cost', excelRow, sheetName, result, report);
      if (cost.skip) return null;
      var alloc = parsePercent(get('Allocation%'), 'Allocation%', excelRow, sheetName, result, report);
      if (alloc.skip) return null;
      return {
        ResourceID: rid, ProjectID: rpid, Type: cleanValue(get('Type')),
        Name: cleanValue(get('Name')), Cost: cost.value,
        Allocation: alloc.value === null ? 0 : alloc.value
      };
    }

    if (sheetName === 'Finances') {
      var fpid = cleanValue(get('ProjectID'));
      if (!fpid) { reportError(result, report, excelRow, 'ProjectID is blank.'); return null; }
      var planned = parseNumber(get('PlannedSpend'), 'PlannedSpend', excelRow, sheetName, result, report);
      if (planned.skip) return null;
      var actual = parseNumber(get('ActualSpend'), 'ActualSpend', excelRow, sheetName, result, report);
      if (actual.skip) return null;
      var varianceRaw = get('Variance');
      var variance = null;
      if (varianceRaw !== null && varianceRaw !== undefined && cleanValue(varianceRaw) !== '') {
        var v = parseNumber(varianceRaw, 'Variance', excelRow, sheetName, result, report);
        if (v.skip) return null;
        variance = v.value;
      }
      if (variance === null) {
        variance = (planned.value || 0) - (actual.value || 0); // computed (spec §4.1)
      }
      return {
        ProjectID: fpid, Month: cleanValue(get('Month')),
        PlannedSpend: planned.value || 0, ActualSpend: actual.value || 0, Variance: variance
      };
    }

    if (sheetName === 'Locations') {
      var lpid = cleanValue(get('ProjectID'));
      if (!lpid) { reportError(result, report, excelRow, 'ProjectID is blank.'); return null; }
      var lat = parseNumber(get('Latitude'), 'Latitude', excelRow, sheetName, result, report);
      if (lat.skip) return null;
      var lng = parseNumber(get('Longitude'), 'Longitude', excelRow, sheetName, result, report);
      if (lng.skip) return null;
      var la = lat.value, lo = lng.value;
      if (la !== null && lo !== null &&
          (la < NIGERIA_BBOX.latMin || la > NIGERIA_BBOX.latMax ||
           lo < NIGERIA_BBOX.lngMin || lo > NIGERIA_BBOX.lngMax)) {
        result.errors.push('Row ' + excelRow + ': coordinates outside Nigeria bbox (lat 4–14, lng 2–15).');
      }
      return {
        ProjectID: lpid, State: cleanValue(get('State')), LGA: cleanValue(get('LGA')),
        Latitude: la, Longitude: lo
      };
    }
    return null;
  }

  function reportError(result, report, excelRow, message) {
    result.ok = false;
    report.ok = false;
    result.errors.push('Row ' + excelRow + ': ' + message);
  }

  function applyForeignKeys(next, report) {
    var projectIds = {};
    next.projects.forEach(function (p) { projectIds[p.ProjectID] = true; });

    ['tasks', 'resources', 'finances', 'locations'].forEach(function (kind) {
      var kept = [];
      next[kind].forEach(function (row) {
        if (!row.ProjectID) {
          report.ok = false;
          return; // dropped silently (already reported as blank at parse time)
        }
        if (!projectIds[row.ProjectID]) {
          report.ok = false;
          var res = findResult(report, kind);
          res.ok = false;
          res.errors.push('Row references unknown project "' + row.ProjectID + '" (skipped).');
          return;
        }
        kept.push(row);
      });
      next[kind] = kept;
    });
  }

  function findResult(report, kind) {
    var name = kind.charAt(0).toUpperCase() + kind.slice(1);
    for (var i = 0; i < report.sheetResults.length; i++) {
      if (report.sheetResults[i].name === name) return report.sheetResults[i];
    }
    var r = { name: name, rowCount: 0, ok: false, errors: [] };
    report.sheetResults.push(r);
    return r;
  }

  function lowerCaseFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }

  // ------------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------------

  function loadFromArrayBuffer(arrayBuffer, sourceLabel) {
    if (typeof XLSX === 'undefined') {
      return Promise.reject(new Error('SheetJS library failed to load from CDN.'));
    }
    return Promise.resolve().then(function () {
      var wb;
      try {
        wb = XLSX.read(arrayBuffer, { type: 'array' });
      } catch (e) {
        throw new Error('Could not parse the file as an Excel workbook: ' + e.message);
      }
      var out = parseWorkbook(wb, sourceLabel);
      return out;
    });
  }

  function loadFromFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read the selected file.')); };
      reader.onload = function () {
        loadFromArrayBuffer(reader.result, file.name)
          .then(resolve)
          .catch(reject);
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function loadSample() {
    return fetch(SAMPLE_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('Sample workbook not found (' + res.status + ').');
        return res.arrayBuffer();
      })
      .then(function (buf) { return loadFromArrayBuffer(buf, 'sample-data.xlsx'); });
  }

  function getDataset() { return dataset; }
  function getReport() { return lastReport; }
  function hasData() { return !!(dataset && dataset.projects.length); }

  return {
    loadFromFile: loadFromFile,
    loadFromArrayBuffer: loadFromArrayBuffer,
    loadSample: loadSample,
    getDataset: getDataset,
    getReport: getReport,
    hasData: hasData
  };
})();
