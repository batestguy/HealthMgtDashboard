/* ==========================================================================
 * js/nlq.js — Ask tab: simulated natural-language query (spec §6 Tab 4,
 * decision #10 — fuzzy + multi-intent)
 *
 * Not an LLM: typo-tolerant keyword matching over the loaded Excel dataset
 * and the live health feed. Detected intents compose (e.g. "show top 3 tasks
 * in lagos" = display + rank + task + state) and drive the real dashboard:
 * tab navigation, Projects filters, and text answers with real numbers.
 *
 * parse() is pure (query + dataset -> plan) and exported for tests.
 * ========================================================================== */

window.PMNlq = (function () {
  'use strict';

  // ------------------------------------------------------------------------
  // Keyword vocabulary (per category). A token fuzzy-matches a category when
  // it is within Levenshtein distance ≤ 2 of one of these words.
  // ------------------------------------------------------------------------
  var INTENT_WORDS = {
    display: ['show', 'list', 'display', 'view', 'get', 'find', 'give', 'see', 'open'],
    rank: ['top', 'highest', 'max', 'most', 'biggest', 'largest', 'best'],
    aggregate: ['count', 'total', 'average', 'many', 'number', 'sum', 'how', 'much'],
    finance: ['budget', 'cost', 'spend', 'spending', 'finance', 'fund', 'naira', 'money', 'planned'],
    task: ['task', 'tasks', 'assignee', 'assigned', 'due', 'priority', 'deadline', 'todo', 'done', 'overdue'],
    health: ['facility', 'facilities', 'health', 'hospital', 'clinic', 'map', 'immunization', 'malaria', 'vaccine']
  };

  var STATES = [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
    'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
    'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
    'Yobe', 'Zamfara'
  ];
  var STATE_ALIASES = {
    lag: 'Lagos', lagos: 'Lagos', abj: 'FCT', abuja: 'FCT', fct: 'FCT',
    katsina: 'Katsina', 'cross river': 'Cross River', 'akwa ibom': 'Akwa Ibom',
    'akwaibom': 'Akwa Ibom', rivers: 'Rivers', 'river': 'Rivers', lagis: 'Lagos'
  };

  var EXAMPLES = [
    'show projects',
    'list tasks',
    'top 3 tasks',
    'highest budget',
    'projects in Lagos',
    'facilities by state',
    'how many tasks are assigned to Amina',
    'total planned spend for Abuja EMR System Rollout',
    'show facilities',
    'top 5 projects by completion',
    'tasks due this month',
    'show public facilities in Kano'
  ];

  // ------------------------------------------------------------------------
  // Small helpers
  // ------------------------------------------------------------------------
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }

  function tokens(query) {
    return norm(query).split(/\s+/).filter(function (t) { return t.length > 0; });
  }

  function levenshtein(a, b, max) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return -1;
    var rows = a.length + 1, cols = b.length + 1;
    var prev = [], cur = [];
    for (var j = 0; j < cols; j++) prev[j] = j;
    for (var i = 1; i < rows; i++) {
      cur[0] = i;
      for (var k = 1; k < cols; k++) {
        var cost = a[i - 1] === b[k - 1] ? 0 : 1;
        cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + cost);
      }
      if (Math.min.apply(null, cur) > max) return -1; // early exit (lower bound)
      prev = cur.slice();
    }
    // Only a match when the true distance is within the allowed bound — the
    // early exit above prunes some rows but NOT all overshoot cases.
    var d = prev[cols - 1];
    return d <= max ? d : -1;
  }

  // token against a word list; returns the word or null.
  // Short tokens must match almost exactly (typo tolerance scales with
  // length) — otherwise 3-4 letter filler words fuzzy-match half the
  // vocabulary and every query looks like every intent.
  function matchAgainst(token, words, maxDist) {
    var allowed = token.length >= 5 ? maxDist : 1;
    for (var i = 0; i < words.length; i++) {
      if (levenshtein(token, words[i], allowed) >= 0) return words[i];
    }
    return null;
  }

  function fmtNaira(n) {
    if (n === null || n === undefined || isNaN(n)) return '–';
    if (n >= 1e9) return '\u20A6' + (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return '\u20A6' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return '\u20A6' + (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return '\u20A6' + Math.round(n).toLocaleString();
  }

  function unique(arr) {
    var out = [], seen = {};
    arr.forEach(function (v) { if (v && !seen[v]) { seen[v] = true; out.push(v); } });
    return out;
  }

  // ------------------------------------------------------------------------
  // Entity matchers
  // ------------------------------------------------------------------------
  function matchState(toks) {
    var i, s;
    for (i = 0; i < toks.length - 1; i++) {
      s = exactState(toks[i] + ' ' + toks[i + 1]);
      if (s) return s;
    }
    for (i = 0; i < toks.length; i++) {
      s = exactState(toks[i]);
      if (s) return s;
    }
    return null;
  }

  function exactState(token) {
    if (STATE_ALIASES[token]) return STATE_ALIASES[token];
    var best = null, bestD = 99;
    for (var i = 0; i < STATES.length; i++) {
      var d = levenshtein(token, norm(STATES[i]).replace(/\s+/g, ''), 1);
      if (d >= 0 && d < bestD) { bestD = d; best = STATES[i]; }
    }
    return best;
  }

  function matchAssignee(toks, ds) {
    var names = unique((ds.tasks || []).map(function (t) { return t.Assignee; }));
    var best = null, bestD = 99;
    toks.forEach(function (t) {
      if (t.length < 4) return;
      names.forEach(function (n) {
        var full = norm(n).replace(/\s+/g, '');
        var first = norm(n).split(' ')[0];
        var df = levenshtein(t, first, 1);
        var dFull = levenshtein(t, full, 2);
        var d = Math.min(df >= 0 ? df : 99, dFull >= 0 ? dFull : 99);
        if (d < bestD) { bestD = d; best = n; }
      });
    });
    return best;
  }

  function matchProject(toks, ds) {
    var best = null, bestScore = 0;
    (ds.projects || []).forEach(function (p) {
      var id = String(p.ProjectID || '').toLowerCase();
      if (toks.indexOf(id) >= 0) { best = p; bestScore = 99; return; }
      var nameToks = norm(p.Name).split(/\s+/).filter(function (t) { return t.length >= 4; });
      var score = 0;
      toks.forEach(function (t) {
        if (t.length < 4) return;
        var hit = nameToks.some(function (nt) { return levenshtein(t, nt, 1) >= 0; });
        if (hit) score++;
      });
      if (score > bestScore) { bestScore = score; best = p; }
    });
    return bestScore > 0 ? best : null;
  }

  // ------------------------------------------------------------------------
  // Parse: query + dataset -> plan (pure, testable)
  // ------------------------------------------------------------------------
  function parse(query, ds) {
    var q = norm(query);
    var toks = tokens(query);
    var plan = {
      intents: {},       // display, rank, aggregate, finance, task, health
      state: null,       // matched Nigerian state or FCT
      assignee: null,    // matched assignee name
      project: null,     // matched project row
      ownership: null,   // 'Public' | 'Private'
      rankN: null,
      byState: false,
      thisMonth: false,
      rankField: null,   // 'completion' | 'budget' | 'priority'
      hasProjectsWord: false
    };

    var m = q.match(/top\s*(\d+)/);
    if (m) plan.rankN = parseInt(m[1], 10);
    if (/\bthis\s*month\b/.test(q)) plan.thisMonth = true;
    if (/\bpublic\b/.test(q)) plan.ownership = 'Public';
    else if (/\bprivate\b/.test(q)) plan.ownership = 'Private';
    if (/\bstate\b/.test(q)) plan.byState = true;
    if (/\bproj/.test(q) || /\bportfolio\b/.test(q)) plan.hasProjectsWord = true;

    toks.forEach(function (t) {
      if (t.length < 3) return;
      Object.keys(INTENT_WORDS).forEach(function (cat) {
        if (plan.intents[cat]) return;
        if (matchAgainst(t, INTENT_WORDS[cat], 2)) plan.intents[cat] = true;
      });
    });

    // A bare "show projects" is a display intent over projects even though
    // the word "projects" itself isn't in the vocabulary.
    if (plan.hasProjectsWord && !plan.intents.display && !plan.intents.task && !plan.intents.health) {
      plan.intents.display = true;
    }

    if (ds) {
      plan.state = matchState(toks);
      plan.assignee = matchAssignee(toks, ds);
      plan.project = matchProject(toks, ds);
    }

    if (plan.intents.rank) {
      if (plan.rankN === null) {
        // "top" defaults to 3; "highest/max/most/biggest" to 1.
        var rankWord = toks.map(function (t) { return matchAgainst(t, INTENT_WORDS.rank, 2); }).filter(Boolean);
        var strong = ['highest', 'max', 'most', 'biggest', 'largest', 'best'];
        plan.rankN = strong.indexOf(rankWord[0]) >= 0 ? 1 : 3;
      }
      if (/\bcompletion\b/.test(q)) plan.rankField = 'completion';
      else if (plan.intents.finance) plan.rankField = 'budget';
      else if (plan.intents.task) plan.rankField = 'priority';
      else plan.rankField = 'completion';
    }

    return plan;
  }

  // ------------------------------------------------------------------------
  // Data helpers used by the handlers
  // ------------------------------------------------------------------------
  function projectCompletion(p, tasksByProject) {
    var ts = tasksByProject[p.ProjectID] || [];
    if (!ts.length) return 0;
    return ts.reduce(function (s, t) { return s + (Number(t.Completion) || 0); }, 0) / ts.length;
  }

  function plannedSpendFor(project, ds) {
    var sum = (ds.finances || []).reduce(function (s, f) {
      return s + (f.ProjectID === project.ProjectID ? (Number(f.PlannedSpend) || 0) : 0);
    }, 0);
    return sum > 0 ? sum : (Number(project.Budget) || 0);
  }

  function tasksDueThisMonth(ds) {
    var now = new Date();
    var ym = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2);
    return (ds.tasks || []).filter(function (t) {
      return t.DueDate && String(t.DueDate).slice(0, 7) === ym;
    });
  }

  function tasksByProjectMap(ds) {
    var map = {};
    (ds.tasks || []).forEach(function (t) {
      if (!map[t.ProjectID]) map[t.ProjectID] = [];
      map[t.ProjectID].push(t);
    });
    return map;
  }

  // ------------------------------------------------------------------------
  // Execution — turn a plan into a reply + dashboard actions
  // ------------------------------------------------------------------------
  function run(query) {
    var answer = document.getElementById('nlq-answer');
    var ds = window.PMData ? window.PMData.getDataset() : null;

    if (!ds || !ds.projects.length) {
      renderAnswer(answer, 'No data loaded yet — loading the sample workbook, then asking again…', null);
      if (window.PMApp && window.PMApp.loadSample) {
        window.PMApp.loadSample().then(function () { run(query); });
      }
      return;
    }

    var plan = parse(query, ds);
    execute(plan, ds, answer);
  }

  function execute(plan, ds, answer) {
    var tasksByP = tasksByProjectMap(ds);

    // ---- Health-family queries (facility counts from live/fallback data) ----
    if (plan.intents.health || plan.byState) {
      healthAnswer(plan, answer);
      return;
    }

    // ---- Task-family queries ----
    if (plan.intents.task) {
      if (plan.assignee) {
        var mine = (ds.tasks || []).filter(function (t) { return t.Assignee === plan.assignee; });
        renderAnswer(answer, mine.length + ' task' + (mine.length === 1 ? '' : 's') + ' assigned to ' + plan.assignee + '.', null);
        offerOpen(answer, 'projects');
        return;
      }
      if (plan.thisMonth) {
        var due = tasksDueThisMonth(ds);
        renderAnswer(answer,
          due.length + ' task' + (due.length === 1 ? '' : 's') + ' due this month.' +
          (due.length ? ' They’re shown in the tracker on the Projects tab.' : ''),
          due.map(function (t) { return t.Title + ' — ' + t.DueDate; }));
        offerOpen(answer, 'projects');
        return;
      }
      if (plan.intents.rank) {
        var n = plan.rankN || 3;
        var weighted = (ds.tasks || []).slice().sort(function (a, b) {
          var wa = { high: 3, medium: 2, low: 1 }[String(a.Priority || '').toLowerCase()] || 0;
          var wb = { high: 3, medium: 2, low: 1 }[String(b.Priority || '').toLowerCase()] || 0;
          if (wb !== wa) return wb - wa;
          return (Number(b.Completion) || 0) - (Number(a.Completion) || 0);
        }).slice(0, n);
        var names = {};
        (ds.projects || []).forEach(function (p) { names[p.ProjectID] = p.Name; });
        renderAnswer(answer,
          'Top ' + weighted.length + ' task' + (weighted.length === 1 ? '' : 's') + ' by priority:',
          weighted.map(function (t) { return t.Title + ' · ' + (names[t.ProjectID] || t.ProjectID) + ' · due ' + (t.DueDate || '—'); }));
        offerOpen(answer, 'projects');
        return;
      }
      renderAnswer(answer, (ds.tasks || []).length + ' tasks across the portfolio — the tracker is sorted by status then due date.', null);
      offerOpen(answer, 'projects');
      return;
    }

    // ---- Finance-family queries ----
    if (plan.intents.finance) {
      if (plan.project) {
        var spend = plannedSpendFor(plan.project, ds);
        renderAnswer(answer, 'Total planned spend for ' + plan.project.Name + ': ' + fmtNaira(spend) + '.', null);
        goto('projects');
        return;
      }
      if (plan.intents.rank) {
        var top = (ds.projects || []).slice().sort(function (a, b) { return (Number(b.Budget) || 0) - (Number(a.Budget) || 0); })[0];
        renderAnswer(answer, top.Name + ' has the highest budget — ' + fmtNaira(Number(top.Budget) || 0) + '.', null);
        offerOpen(answer, 'projects');
        return;
      }
      var totalBudget = (ds.projects || []).reduce(function (s, p) { return s + (Number(p.Budget) || 0); }, 0);
      renderAnswer(answer, 'Total portfolio budget: ' + fmtNaira(totalBudget) + ' across ' + (ds.projects || []).length + ' projects.', null);
      offerOpen(answer, 'projects');
      return;
    }

    // ---- Project-list queries (state filter, rank by completion, show all) ----
    if (plan.state || plan.hasProjectsWord || plan.intents.rank || plan.intents.display) {
      if (plan.state) {
        var inState = (ds.projects || []).filter(function (p) { return p.Region === plan.state; });
        if (window.PMApp && window.PMApp.setProjectFilters) {
          window.PMApp.setProjectFilters({ status: 'all', region: plan.state });
        }
        renderAnswer(answer,
          inState.length + ' project' + (inState.length === 1 ? '' : 's') + ' in ' + plan.state +
          (inState.length ? ' — filters applied; open the Projects tab to see them.' : ' — nothing matches, filters cleared.'),
          inState.map(function (p) { return p.Name + ' · ' + p.Status; }));
        offerOpen(answer, 'projects');
        return;
      }
      if (plan.intents.rank && plan.rankField === 'completion') {
        var n2 = plan.rankN || 3;
        var byComp = (ds.projects || []).slice().sort(function (a, b) {
          return projectCompletion(b, tasksByP) - projectCompletion(a, tasksByP);
        }).slice(0, n2);
        renderAnswer(answer, 'Top ' + byComp.length + ' project' + (byComp.length === 1 ? '' : 's') + ' by completion:',
          byComp.map(function (p) { return p.Name + ' · ' + Math.round(projectCompletion(p, tasksByP)) + '% complete'; }));
        offerOpen(answer, 'projects');
        return;
      }
      // show projects / portfolio
      if (window.PMApp && window.PMApp.setProjectFilters) {
        window.PMApp.setProjectFilters({ status: 'all', region: 'all' });
      }
      renderAnswer(answer, 'Here are all ' + (ds.projects || []).length + ' projects:',
        (ds.projects || []).map(function (p) { return p.Name + ' · ' + p.Status; }));
      offerOpen(answer, 'projects');
      return;
    }

    // ---- Pure aggregate ----
    if (plan.intents.aggregate) {
      var taskCount = (ds.tasks || []).length;
      renderAnswer(answer,
        (ds.projects || []).length + ' projects · ' + taskCount + ' tasks · total budget ' +
        fmtNaira((ds.projects || []).reduce(function (s, p) { return s + (Number(p.Budget) || 0); }, 0)) + '.', null);
      offerOpen(answer, 'projects');
      return;
    }

    renderAnswer(answer, 'I didn’t catch that. Try one of the example questions below — or ask about projects, tasks, budgets, or facilities.', null);
  }

  // ------------------------------------------------------------------------
  // Health answers (async — live GRID3 with seeded fallback)
  // ------------------------------------------------------------------------
  function healthAnswer(plan, answer) {
    renderAnswer(answer, 'Checking the facility data…', null);
    if (!window.PMHealthData) {
      renderAnswer(answer, 'The health data module is unavailable right now — try again in a moment.', null);
      return;
    }
    var hd = window.PMHealthData;

    if (plan.byState && !plan.state) {
      hd.loadFacilityAggregates().then(function (agg) {
        var top = agg.byState.slice().sort(function (a, b) { return b.count - a.count; }).slice(0, 5);
        var lines = top.map(function (g) { return g.key + ' — ' + g.count.toLocaleString() + ' facilities'; });
        renderAnswer(answer, 'Facility counts by state (top 5 of ' + agg.byState.length + '):', lines);
        offerOpen(answer, 'health');
      }).catch(function () {
        renderAnswer(answer, 'Could not fetch facility data — the Health tab shows whatever it last loaded.', null);
        offerOpen(answer, 'health');
      });
      return;
    }

    if (plan.state && (plan.ownership || plan.intents.health)) {
      hd.countFacilitiesInState(plan.state, plan.ownership).then(function (r) {
        var label = plan.ownership ? (plan.ownership === 'Public' ? 'public' : 'private') + ' facilities' : 'facilities';
        renderAnswer(answer, r.count.toLocaleString() + ' ' + label + ' in ' + plan.state +
          (r.source === 'sample' ? ' (sample data — live feed unavailable).' : '.'), null);
        offerOpen(answer, 'health');
      }).catch(function () {
        renderAnswer(answer, 'Could not count facilities in ' + plan.state + ' right now.', null);
        offerOpen(answer, 'health');
      });
      return;
    }

    // Plain "show facilities"
    hd.loadFacilityAggregates().then(function (agg) {
      renderAnswer(answer, agg.total.toLocaleString() + ' health facilities across ' + agg.statesCovered + ' states — open the map to explore.',
        [agg.ownership.Public.toLocaleString() + ' public · ' + agg.ownership.Private.toLocaleString() + ' private']);
      offerOpen(answer, 'health');
    }).catch(function () {
      renderAnswer(answer, 'Could not load facility data right now — try again in a moment.', null);
      offerOpen(answer, 'health');
    });
  }

  // ------------------------------------------------------------------------
  // DOM rendering + wiring
  // ------------------------------------------------------------------------
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function renderAnswer(container, reply, items) {
    if (!container) return;
    container.textContent = '';
    if (reply) container.appendChild(el('p', 'nlq-reply', reply));
    if (items && items.length) {
      var ol = el('ol', 'nlq-list');
      items.forEach(function (it) { ol.appendChild(el('li', null, it)); });
      container.appendChild(ol);
    }
  }

  function goto(name) {
    if (window.PMApp && window.PMApp.goto) { window.PMApp.goto(name); return; }
    var btn = document.querySelector('.tab-btn[data-tab="' + name + '"]');
    if (btn) btn.click();
  }

  // Answers stay visible on the Ask tab; this adds an optional jump link so
  // the user can open the tab the query acted on (avoids yanking them away
  // from the answer they just asked for).
  function offerOpen(container, tabName) {
    if (!container) return;
    var label = tabName === 'health' ? 'Open facility map →' : 'Open Projects tab →';
    var btn = el('button', 'btn btn-ghost btn-sm nlq-open', label);
    btn.type = 'button';
    btn.addEventListener('click', function () { goto(tabName); });
    container.appendChild(btn);
  }

  function buildChips() {
    var wrap = document.getElementById('nlq-chips');
    if (!wrap) return;
    EXAMPLES.forEach(function (q) {
      var chip = el('button', 'chip', q);
      chip.type = 'button';
      chip.addEventListener('click', function () { run(q); });
      wrap.appendChild(chip);
    });
  }

  function init() {
    var form = document.getElementById('nlq-form');
    var input = document.getElementById('nlq-input');
    var go = document.getElementById('btn-nlq-go');
    if (!form || !input) return;
    buildChips();
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (!q) return;
      input.value = '';
      run(q);
    });
    if (go) go.addEventListener('click', function () { form.dispatchEvent(new Event('submit', { cancelable: true })); });
  }

  return { init: init, parse: parse, run: run, EXAMPLES: EXAMPLES };
})();