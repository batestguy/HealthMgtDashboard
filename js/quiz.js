/* ==========================================================================
 * js/quiz.js — Quiz tab (spec §6, Tab 3)
 *
 * One question at a time (decision #8), batches of 3 in the progress header,
 * instant right/wrong feedback, a running score, and a results screen with
 * a per-question review (decision #9).
 *
 * Pool per session: 5 static Nigeria health/PM trivia + 5–7 dynamic questions
 * generated from the loaded Excel dataset (or the seeded sample if no Excel
 * data was uploaded).
 *
 * Question shape: { text, options[4], answer (index), topic, dynamic }
 * The pure helpers (buildPool / generateDynamicQuestions) avoid touching
 * document so they are testable from a Node harness.
 * ========================================================================== */

window.PMQuiz = (function () {
  'use strict';

  var BATCH_SIZE = 3;
  var MAX_TOTAL = 12;

  // ---------- static question bank (5, Nigeria health + PM trivia) ----------
  var STATIC_BANK = [
    {
      text: 'How many states, plus the Federal Capital Territory, make up Nigeria?',
      options: ['32', '36', '37', '41'],
      answer: 2,
      topic: 'Nigeria facts'
    },
    {
      text: 'Which therapy is the recommended first-line treatment for uncomplicated malaria in Nigeria?',
      options: [
        'Artemisinin-based combination therapy (ACT)',
        'Paracetamol',
        'Antibiotics',
        'Oral rehydration salts'
      ],
      answer: 0,
      topic: 'Malaria'
    },
    {
      text: 'Which agency leads disease surveillance and outbreak response in Nigeria?',
      options: ['NCDC', 'NNPC', 'NIMET', 'NIPOST'],
      answer: 0,
      topic: 'Public health'
    },
    {
      text: 'Where do Primary Health Centres (PHCs) mostly operate in Nigeria\u2019s health system?',
      options: [
        'At the ward / local community level',
        'Only at the federal level',
        'Only outside Nigeria',
        'At the continental level'
      ],
      answer: 0,
      topic: 'Health system'
    },
    {
      text: 'What is the primary aim of Universal Health Coverage (UHC)?',
      options: [
        'Quality health services for all without financial hardship',
        'Free electricity for all',
        'Free housing for all',
        'Free internet for all'
      ],
      answer: 0,
      topic: 'Policy'
    }
  ];

  // ---------- pure helpers (no DOM) ----------

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Re-shuffle a question's options and fix the answer index, so the correct
  // option is not always in the same position.
  function shuffleOptions(q) {
    var idx = shuffle(q.options.map(function (_, i) { return i; }));
    return {
      text: q.text,
      options: idx.map(function (i) { return q.options[i]; }),
      answer: idx.indexOf(q.answer),
      topic: q.topic,
      dynamic: !!q.dynamic
    };
  }

  function trimZero(s) { return s.replace(/\.0$/, ''); }

  function fmtNaira(n) {
    if (n >= 1e9) return '\u20A6' + trimZero((n / 1e9).toFixed(1)) + 'B';
    if (n >= 1e6) return '\u20A6' + trimZero((n / 1e6).toFixed(1)) + 'M';
    if (n >= 1e3) return '\u20A6' + trimZero((n / 1e3).toFixed(1)) + 'k';
    return '\u20A6' + Math.round(n).toLocaleString();
  }

  // 4 numeric options around `correct`, distractors drawn from candidates.
  // Returns { options: [String], answer: index }.
  function numericOptions(correct, distractorCandidates) {
    var uniq = [];
    distractorCandidates.forEach(function (v) {
      var n = Math.round(Number(v) || 0);
      if (n !== correct && n >= 0 && uniq.indexOf(n) === -1) uniq.push(n);
    });
    var pad = 1;
    while (uniq.length < 3) {
      if (correct + pad >= 0 && uniq.indexOf(correct + pad) === -1) uniq.push(correct + pad);
      pad++;
    }
    var distractors = shuffle(uniq).slice(0, 3);
    var raw = shuffle(distractors.concat([correct]));
    return { options: raw.map(String), answer: raw.indexOf(correct) };
  }

  // Same, but formatted through `fmt` (e.g. ₦-compact) — index tracked on the
  // raw values so a formatting collision cannot mislabel the answer.
  function formattedOptions(correct, distractorCandidates, fmt) {
    var uniq = [];
    distractorCandidates.forEach(function (v) {
      if (typeof v === 'number' && isFinite(v) && v !== correct && uniq.indexOf(v) === -1) uniq.push(v);
    });
    var mults = [2, 0.5, 1.5];
    mults.forEach(function (m) {
      if (uniq.length < 3) {
        var v = Math.round(correct * m);
        if (v !== correct && uniq.indexOf(v) === -1) uniq.push(v);
      }
    });
    var n = 1;
    while (uniq.length < 3) {
      var v2 = correct + 1000000 * n;
      if (v2 !== correct && uniq.indexOf(v2) === -1) uniq.push(v2);
      n++;
    }
    var raw = shuffle(uniq.slice(0, 3).concat([correct]));
    return { options: raw.map(fmt), answer: raw.indexOf(correct) };
  }

  // ---------- dynamic question generation (spec §6, Tab 3 templates) ----------

  function generateDynamicQuestions(ds) {
    var out = [];
    var projects = ds.projects || [];
    var tasks = ds.tasks || [];
    if (!projects.length) return out;

    // 1. Budget questions (up to 2 projects).
    shuffle(projects).slice(0, 2).forEach(function (p) {
      var budget = Number(p.Budget) || 0;
      if (budget <= 0) return;
      var others = projects
        .filter(function (o) { return o.ProjectID !== p.ProjectID; })
        .map(function (o) { return Number(o.Budget) || 0; })
        .filter(function (n) { return n > 0; });
      var o = formattedOptions(budget, others, fmtNaira);
      out.push({
        text: 'What is the budget for ' + (p.Name || p.ProjectID) + '?',
        options: o.options,
        answer: o.answer,
        topic: 'Your data · finance',
        dynamic: true
      });
    });

    // 2. Highest-budget project.
    if (projects.length >= 2) {
      var top = projects.slice().sort(function (a, b) {
        return (Number(b.Budget) || 0) - (Number(a.Budget) || 0);
      })[0];
      var names = shuffle(projects).slice(0, 4);
      if (names.indexOf(top) === -1) names[Math.floor(Math.random() * names.length)] = top;
      var nameOpts = shuffle(names.map(function (p) { return p.Name || p.ProjectID; }));
      out.push({
        text: 'Which project has the highest budget?',
        options: nameOpts,
        answer: nameOpts.indexOf(top.Name || top.ProjectID),
        topic: 'Your data · finance',
        dynamic: true
      });
    }

    // 3. Total planned spend (up to 2 projects that have finance rows).
    var finByP = {};
    (ds.finances || []).forEach(function (f) {
      finByP[f.ProjectID] = (finByP[f.ProjectID] || 0) + (Number(f.PlannedSpend) || 0);
    });
    shuffle(projects.filter(function (p) { return finByP[p.ProjectID] > 0; }))
      .slice(0, 2)
      .forEach(function (p) {
        var total = Math.round(finByP[p.ProjectID]);
        var others = projects
          .filter(function (o) { return o.ProjectID !== p.ProjectID; })
          .map(function (o) { return Math.round(finByP[o.ProjectID] || 0); })
          .filter(function (n) { return n > 0; });
        var o = formattedOptions(total, others, fmtNaira);
        out.push({
          text: 'What is the total planned spend for ' + (p.Name || p.ProjectID) + '?',
          options: o.options,
          answer: o.answer,
          topic: 'Your data · finance',
          dynamic: true
        });
      });

    // 4. Tasks per assignee (up to 2 assignees).
    var byAssignee = {};
    tasks.forEach(function (t) {
      var a = t.Assignee || 'Unassigned';
      byAssignee[a] = (byAssignee[a] || 0) + 1;
    });
    var assignees = Object.keys(byAssignee);
    shuffle(assignees).slice(0, 2).forEach(function (a) {
      var count = byAssignee[a];
      var others = assignees.filter(function (o) { return o !== a; }).map(function (o) { return byAssignee[o]; });
      var o = numericOptions(count, others);
      out.push({
        text: 'How many tasks are assigned to ' + a + '?',
        options: o.options,
        answer: o.answer,
        topic: 'Your data · tasks',
        dynamic: true
      });
    });

    // 5. Projects in a status (1).
    var byStatus = {};
    projects.forEach(function (p) { byStatus[p.Status] = (byStatus[p.Status] || 0) + 1; });
    var statuses = Object.keys(byStatus);
    if (statuses.length) {
      var status = statuses[Math.floor(Math.random() * statuses.length)];
      var count = byStatus[status];
      var others = statuses.filter(function (s) { return s !== status; }).map(function (s) { return byStatus[s]; });
      var so = numericOptions(count, others);
      out.push({
        text: 'How many projects are currently ' + String(status).toLowerCase() + '?',
        options: so.options,
        answer: so.answer,
        topic: 'Your data · portfolio',
        dynamic: true
      });
    }

    return out;
  }

  // 5 static + dynamic, all option-shuffled, session pool capped at 12.
  function buildPool(ds) {
    var pool = [];
    STATIC_BANK.forEach(function (q) { pool.push(shuffleOptions(q)); });
    generateDynamicQuestions(ds || {}).forEach(function (q) { pool.push(shuffleOptions(q)); });
    return shuffle(pool).slice(0, MAX_TOTAL);
  }

  // ---------- DOM helpers ----------
  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  // Reused progress ring (same visual language as the project cards).
  function ring(pct, color) {
    var r = 46;
    var c = 2 * Math.PI * r;
    var wrap = el('div', 'ring');
    wrap.style.width = '112px';
    wrap.style.height = '112px';
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', pct + '%');
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '112');
    svg.setAttribute('height', '112');
    svg.setAttribute('viewBox', '0 0 112 112');
    var track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    track.setAttribute('cx', '56'); track.setAttribute('cy', '56'); track.setAttribute('r', String(r));
    track.setAttribute('fill', 'none'); track.setAttribute('stroke-width', '10');
    track.setAttribute('class', 'ring-track');
    var fill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    fill.setAttribute('cx', '56'); fill.setAttribute('cy', '56'); fill.setAttribute('r', String(r));
    fill.setAttribute('fill', 'none'); fill.setAttribute('stroke-width', '10');
    fill.setAttribute('stroke', color);
    fill.setAttribute('class', 'ring-fill');
    fill.setAttribute('stroke-dasharray', String(c));
    fill.setAttribute('stroke-dashoffset', String(c));
    svg.appendChild(track);
    svg.appendChild(fill);
    wrap.appendChild(svg);
    wrap.appendChild(el('span', 'ring-label', pct + '%'));
    requestAnimationFrame(function () {
      fill.setAttribute('stroke-dashoffset', String(c * (1 - pct / 100)));
    });
    return wrap;
  }

  // ---------- quiz state ----------
  var inited = false;
  var started = false;
  var pool = [];
  var index = 0;
  var score = 0;
  var answers = [];
  var answering = false;

  function init() {
    if (inited) return;
    inited = true;
    renderStart();
  }

  // If no Excel data was uploaded, fall back to the seeded sample so dynamic
  // questions still work (spec: "dynamic questions come from the seeded sample").
  function ensureData() {
    if (PMData.hasData()) return Promise.resolve();
    return PMData.loadSample().catch(function () { /* static-only fallback */ });
  }

  function startQuiz() {
    if (started) return;
    var btn = $('btn-quiz-start');
    if (btn) btn.disabled = true;
    ensureData().then(function () {
      pool = buildPool(PMData.getDataset() || {});
      index = 0;
      score = 0;
      answers = [];
      answering = false;
      started = true;
      renderQuestion();
    });
  }

  function reset() {
    started = false;
    pool = [];
    index = 0;
    score = 0;
    answers = [];
    answering = false;
    renderStart();
  }

  function progressLine() {
    var batch = Math.ceil((index + 1) / BATCH_SIZE);
    return 'Q ' + (index + 1) + ' of ' + pool.length + ' • Batch ' + batch;
  }

  // ---------- screens ----------

  function renderStart() {
    var body = $('quiz-body');
    body.textContent = '';
    var wrap = el('div', 'quiz-start');
    wrap.appendChild(el('p', 'quiz-intro',
      'A mix of Nigeria health trivia and questions generated from your loaded Excel data. ' +
      'One at a time — tap an answer for instant feedback, then review everything on the results screen.'));
    var btn = el('button', 'btn btn-secondary btn-block', '▶ Start quiz');
    btn.id = 'btn-quiz-start';
    btn.type = 'button';
    btn.addEventListener('click', startQuiz);
    wrap.appendChild(btn);
    body.appendChild(wrap);
    $('quiz-score').textContent = '0/0';
  }

  function renderQuestion() {
    var q = pool[index];
    var body = $('quiz-body');
    body.textContent = '';

    body.appendChild(el('p', 'quiz-progress', progressLine()));
    body.appendChild(el('h3', 'quiz-question', q.text));

    var opts = el('div', 'quiz-options');
    var letters = ['A', 'B', 'C', 'D'];
    q.options.forEach(function (opt, i) {
      var b = el('button', 'quiz-option', null);
      b.type = 'button';
      b.appendChild(el('span', 'q-letter', letters[i]));
      b.appendChild(document.createTextNode(opt));
      b.addEventListener('click', function () { handleAnswer(i); });
      opts.appendChild(b);
    });
    body.appendChild(opts);

    var fb = el('p', 'quiz-feedback', null);
    fb.id = 'quiz-feedback';
    fb.hidden = true;
    body.appendChild(fb);

    var controls = el('div', 'quiz-controls');
    var resetBtn = el('button', 'btn btn-ghost', '↺ Reset');
    resetBtn.type = 'button';
    resetBtn.addEventListener('click', reset);
    controls.appendChild(resetBtn);
    var next = el('button', 'btn btn-secondary', index === pool.length - 1 ? 'See results' : 'Next →');
    next.id = 'btn-quiz-next';
    next.type = 'button';
    next.hidden = true;
    next.addEventListener('click', nextQuestion);
    controls.appendChild(next);
    body.appendChild(controls);
  }

  function handleAnswer(i) {
    if (!started || answering) return;
    answering = true;
    var q = pool[index];
    var correct = i === q.answer;
    if (correct) score++;
    answers.push({ question: q, chosen: i, correct: correct });

    var optBtns = document.querySelectorAll('.quiz-option');
    Array.prototype.forEach.call(optBtns, function (b, bi) {
      b.disabled = true;
      b.classList.add('disabled');
      if (bi === q.answer) b.classList.add('correct');
      else if (bi === i) b.classList.add('wrong');
    });

    var fb = $('quiz-feedback');
    fb.hidden = false;
    fb.classList.add(correct ? 'correct' : 'wrong');
    fb.textContent = correct
      ? '✓ Correct!'
      : '✗ Wrong — correct answer: ' + q.options[q.answer];

    $('btn-quiz-next').hidden = false;
    $('quiz-score').textContent = score + '/' + pool.length;
  }

  function nextQuestion() {
    answering = false;
    index++;
    if (index >= pool.length) { renderResults(); return; }
    renderQuestion();
  }

  function renderResults() {
    var body = $('quiz-body');
    body.textContent = '';
    var wrap = el('div', 'quiz-results');
    var pct = pool.length ? Math.round((score / pool.length) * 100) : 0;

    var ringWrap = el('div', 'quiz-score-ring');
    ringWrap.appendChild(ring(pct, pct >= 70 ? '#008751' : pct >= 50 ? '#f5b041' : '#e53e3e'));
    wrap.appendChild(ringWrap);

    wrap.appendChild(el('h3', null, score + ' / ' + pool.length + '  (' + pct + '%)'));
    var verdict = pct >= 70
      ? { cls: 'pass', text: '🎉 Great job! You know your stuff.' }
      : pct >= 50
        ? { cls: 'warn', text: '👍 Solid effort — scan the review below to level up.' }
        : { cls: 'fail', text: '📖 Worth another pass — the review below shows the right answers.' };
    wrap.appendChild(el('p', 'quiz-verdict ' + verdict.cls, verdict.text));

    var review = el('div', 'quiz-review');
    review.appendChild(el('h4', null, 'Review (' + answers.length + ' questions)'));
    var ol = el('ol', 'quiz-review-list');
    answers.forEach(function (a) {
      var q = a.question;
      var item = el('li', 'quiz-review-item');
      item.appendChild(el('span', 'qr-num', ''));
      item.appendChild(el('span', 'qr-mark ' + (a.correct ? 'ok' : 'no'), a.correct ? '✓' : '✗'));
      var main = el('div', 'qr-main');
      main.appendChild(el('div', 'qr-text', q.text));
      var you = el('div', 'qr-you');
      you.appendChild(document.createTextNode('You: '));
      you.appendChild(el('b', a.correct ? 'right' : 'missed', q.options[a.chosen]));
      if (!a.correct) {
        you.appendChild(document.createTextNode(' · Correct: '));
        you.appendChild(el('b', 'right', q.options[q.answer]));
      }
      if (q.topic) {
        you.appendChild(document.createTextNode('  ·  ' + q.topic));
      }
      main.appendChild(you);
      item.appendChild(main);
      ol.appendChild(item);
    });
    review.appendChild(ol);
    wrap.appendChild(review);

    var restart = el('button', 'btn btn-secondary btn-block', '🔄 Restart quiz');
    restart.type = 'button';
    restart.addEventListener('click', reset);
    wrap.appendChild(restart);

    body.appendChild(wrap);
    $('quiz-score').textContent = score + '/' + pool.length;
  }

  return {
    init: init,
    buildPool: buildPool,
    generateDynamicQuestions: generateDynamicQuestions,
    STATIC_BANK: STATIC_BANK
  };
})();