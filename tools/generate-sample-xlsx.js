/**
 * Generates assets/sample-data.xlsx — the seeded demo workbook for the
 * Nigeria Health + PM Dashboard (see dashboard-spec.md §4).
 *
 * Deterministic: all variation comes from a fixed-seed PRNG, so re-running
 * produces an identical file.
 *
 * Usage: node generate-sample-xlsx.js   (run from tools/)
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// --- Deterministic PRNG (mulberry32) so output is reproducible -----------------
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260904);
const between = (min, max) => min + rand() * (max - min);

// --- Dataset: 6 projects (2 On Track, 2 At Risk, 1 Completed, 1 On Hold) ------
// Budgets in naira (₦5M–₦120M), regions = Nigerian states, owners = assignees.
const projects = [
  { ProjectID: 'P1', Name: 'Lagos PHC Renovation Programme', Budget: 85000000, StartDate: '2026-01-15', EndDate: '2026-12-20', Status: 'On Track', Owner: 'Amina Bello', Region: 'Lagos' },
  { ProjectID: 'P2', Name: 'Kano Maternal Health Outreach', Budget: 62000000, StartDate: '2026-02-01', EndDate: '2027-03-31', Status: 'On Track', Owner: 'Ibrahim Musa', Region: 'Kano' },
  { ProjectID: 'P3', Name: 'Abuja EMR System Rollout', Budget: 120000000, StartDate: '2026-03-10', EndDate: '2027-06-30', Status: 'At Risk', Owner: 'Funke Adeyemi', Region: 'FCT' },
  { ProjectID: 'P4', Name: 'Rivers Cold-Chain Expansion', Budget: 45000000, StartDate: '2026-04-01', EndDate: '2026-11-30', Status: 'At Risk', Owner: 'Ngozi Eze', Region: 'Rivers' },
  { ProjectID: 'P5', Name: 'Kaduna CHW Training Programme', Budget: 5000000, StartDate: '2026-01-05', EndDate: '2026-06-30', Status: 'Completed', Owner: 'Chukwuemeka Okafor', Region: 'Kaduna' },
  { ProjectID: 'P6', Name: 'Enugu Vaccine Storage Audit', Budget: 18000000, StartDate: '2026-05-01', EndDate: '2026-10-31', Status: 'On Hold', Owner: 'Amina Bello', Region: 'Enugu' },
];

// --- 20 tasks (5 done, 8 in-progress, 7 todo) spread across all projects ------
const tasks = [
  { TaskID: 'T1',  ProjectID: 'P1', Title: 'Survey PHC buildings in Ikeja', Assignee: 'Amina Bello', Status: 'done', Priority: 'high', DueDate: '2026-03-01', Completion: 100 },
  { TaskID: 'T2',  ProjectID: 'P1', Title: 'Procure renovation materials', Assignee: 'Ibrahim Musa', Status: 'in-progress', Priority: 'medium', DueDate: '2026-09-15', Completion: 60 },
  { TaskID: 'T3',  ProjectID: 'P1', Title: 'Renovate Surulere PHC', Assignee: 'Chukwuemeka Okafor', Status: 'todo', Priority: 'high', DueDate: '2026-12-01', Completion: 0 },
  { TaskID: 'T4',  ProjectID: 'P1', Title: 'Prepare stakeholder sign-off pack', Assignee: 'Funke Adeyemi', Status: 'in-progress', Priority: 'medium', DueDate: '2026-10-30', Completion: 40 },
  { TaskID: 'T5',  ProjectID: 'P2', Title: 'Recruit 40 outreach nurses', Assignee: 'Amina Bello', Status: 'in-progress', Priority: 'high', DueDate: '2026-08-31', Completion: 70 },
  { TaskID: 'T6',  ProjectID: 'P2', Title: 'Source delivery kits', Assignee: 'Ibrahim Musa', Status: 'done', Priority: 'medium', DueDate: '2026-07-20', Completion: 100 },
  { TaskID: 'T7',  ProjectID: 'P2', Title: 'Schedule outreach calendar', Assignee: 'Ngozi Eze', Status: 'in-progress', Priority: 'low', DueDate: '2026-11-15', Completion: 25 },
  { TaskID: 'T8',  ProjectID: 'P2', Title: 'Run M&E baseline survey', Assignee: 'Chukwuemeka Okafor', Status: 'todo', Priority: 'medium', DueDate: '2026-12-20', Completion: 0 },
  { TaskID: 'T9',  ProjectID: 'P3', Title: 'Complete EMR vendor selection', Assignee: 'Funke Adeyemi', Status: 'in-progress', Priority: 'high', DueDate: '2026-09-30', Completion: 55 },
  { TaskID: 'T10', ProjectID: 'P3', Title: 'Configure EMR servers', Assignee: 'Ibrahim Musa', Status: 'todo', Priority: 'high', DueDate: '2026-12-15', Completion: 0 },
  { TaskID: 'T11', ProjectID: 'P3', Title: 'Train facility staff', Assignee: 'Ngozi Eze', Status: 'todo', Priority: 'medium', DueDate: '2027-03-01', Completion: 0 },
  { TaskID: 'T12', ProjectID: 'P3', Title: 'Pilot EMR in Garki hospital', Assignee: 'Chukwuemeka Okafor', Status: 'in-progress', Priority: 'high', DueDate: '2026-10-15', Completion: 30 },
  { TaskID: 'T13', ProjectID: 'P4', Title: 'Install solar refrigeration units', Assignee: 'Ibrahim Musa', Status: 'in-progress', Priority: 'high', DueDate: '2026-10-01', Completion: 45 },
  { TaskID: 'T14', ProjectID: 'P4', Title: 'Audit Port Harcourt LGA routes', Assignee: 'Amina Bello', Status: 'in-progress', Priority: 'medium', DueDate: '2026-09-20', Completion: 20 },
  { TaskID: 'T15', ProjectID: 'P4', Title: 'Hire cold-chain technician', Assignee: 'Funke Adeyemi', Status: 'todo', Priority: 'low', DueDate: '2026-11-01', Completion: 0 },
  { TaskID: 'T16', ProjectID: 'P5', Title: 'Develop CHW curriculum', Assignee: 'Ngozi Eze', Status: 'done', Priority: 'high', DueDate: '2026-02-28', Completion: 100 },
  { TaskID: 'T17', ProjectID: 'P5', Title: 'Train 300 community health workers', Assignee: 'Chukwuemeka Okafor', Status: 'done', Priority: 'high', DueDate: '2026-05-15', Completion: 100 },
  { TaskID: 'T18', ProjectID: 'P5', Title: 'Distribute training materials', Assignee: 'Ibrahim Musa', Status: 'done', Priority: 'medium', DueDate: '2026-06-20', Completion: 100 },
  { TaskID: 'T19', ProjectID: 'P6', Title: 'Audit fridge temperature logs', Assignee: 'Amina Bello', Status: 'todo', Priority: 'medium', DueDate: '2026-10-01', Completion: 0 },
  { TaskID: 'T20', ProjectID: 'P6', Title: 'Procure temperature data loggers', Assignee: 'Ngozi Eze', Status: 'todo', Priority: 'low', DueDate: '2026-10-31', Completion: 0 },
];

// --- 4 resources (2 People, 2 Equipment) ---------------------------------------
const resources = [
  { ResourceID: 'R1', ProjectID: 'P1', Type: 'Person', Name: 'Building Contractor', Cost: 8000000, Allocation: 40 },
  { ResourceID: 'R2', ProjectID: 'P2', Type: 'Person', Name: 'Community Nurse Supervisor', Cost: 3600000, Allocation: 55 },
  { ResourceID: 'R3', ProjectID: 'P3', Type: 'Equipment', Name: 'EMR Server Cluster', Cost: 15000000, Allocation: 30 },
  { ResourceID: 'R4', ProjectID: 'P4', Type: 'Equipment', Name: 'Solar Refrigeration Units (x4)', Cost: 9000000, Allocation: 25 },
];

// --- Finances: 12 months (2026-01..2026-12) x 6 projects, Variance left blank
//     (the dashboard computes Variance = Planned - Actual per the spec).
//     Planned spend follows a monthly profile; Actual deviates via the seeded PRNG,
//     with At Risk projects drifting over budget. Months before a project's start
//     date get zero planned spend.
function buildFinances() {
  const rows = [];
  for (const p of projects) {
    const startIdx = Number(p.StartDate.slice(5, 7)); // 1..12
    for (let m = 1; m <= 12; m++) {
      const month = `2026-${String(m).padStart(2, '0')}`;
      const monthLabel = new Date(2026, m - 1, 1).toLocaleString('en', { month: 'short' });
      // Bell-ish profile peaking mid-project life; simple deterministic curve.
      const profile = Math.sin(((m - startIdx) / 12) * Math.PI);
      const phase = m < startIdx ? 0 : Math.max(0.25, profile * 0.6 + 0.6);
      const planned = Math.round((p.Budget / 12) * phase / 1000) * 1000;
      let actual = planned === 0 ? 0 : Math.round((planned * between(0.85, 1.12)) / 1000) * 1000;
      if (p.Status === 'At Risk') actual = Math.max(actual, Math.round((planned * 1.08) / 1000) * 1000);
      if (p.Status === 'Completed') actual = Math.round((planned * between(0.9, 1.0)) / 1000) * 1000;
      rows.push({
        ProjectID: p.ProjectID,
        Month: month,
        MonthLabel: `${monthLabel} 2026`,
        PlannedSpend: planned,
        ActualSpend: actual,
        Variance: '', // computed client-side (Planned - Actual)
      });
    }
  }
  return rows;
}

// --- 10 locations across 6 states, all inside Nigeria bbox (lat 4-14, lng 2-15)
const locations = [
  { ProjectID: 'P1', State: 'Lagos', LGA: 'Ikeja', Latitude: 6.596, Longitude: 3.342 },
  { ProjectID: 'P1', State: 'Lagos', LGA: 'Surulere', Latitude: 6.501, Longitude: 3.351 },
  { ProjectID: 'P2', State: 'Kano', LGA: 'Kano Municipal', Latitude: 12.002, Longitude: 8.517 },
  { ProjectID: 'P2', State: 'Kano', LGA: 'Nassarawa', Latitude: 11.985, Longitude: 8.551 },
  { ProjectID: 'P3', State: 'FCT', LGA: 'Abuja Municipal', Latitude: 9.058, Longitude: 7.489 },
  { ProjectID: 'P3', State: 'FCT', LGA: 'Garki', Latitude: 9.013, Longitude: 7.416 },
  { ProjectID: 'P4', State: 'Rivers', LGA: 'Port Harcourt', Latitude: 4.816, Longitude: 7.048 },
  { ProjectID: 'P4', State: 'Rivers', LGA: 'Obio-Akpor', Latitude: 4.868, Longitude: 7.034 },
  { ProjectID: 'P5', State: 'Kaduna', LGA: 'Kaduna North', Latitude: 10.526, Longitude: 7.438 },
  { ProjectID: 'P6', State: 'Enugu', LGA: 'Enugu North', Latitude: 6.465, Longitude: 7.498 },
];

// --- Assemble workbook ----------------------------------------------------------
const sheetFromRows = (rows) => XLSX.utils.json_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, sheetFromRows(projects.map(r => ({ ...r, Budget: r.Budget }))), 'Projects');
XLSX.utils.book_append_sheet(wb, sheetFromRows(tasks.map(({ Completion, ...r }) => ({ ...r, 'Completion%': Completion }))), 'Tasks');
XLSX.utils.book_append_sheet(wb, sheetFromRows(resources.map(({ Allocation, ...r }) => ({ ...r, 'Allocation%': Allocation }))), 'Resources');
XLSX.utils.book_append_sheet(wb, sheetFromRows(buildFinances()), 'Finances');
XLSX.utils.book_append_sheet(wb, sheetFromRows(locations), 'Locations');

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'sample-data.xlsx');
XLSX.writeFile(wb, outFile);

// --- Report ----------------------------------------------------------------------
const count = (rows) => rows.length;
console.log('Wrote', outFile);
console.log(`  Projects:  ${count(projects)} (statuses: ${projects.map(p => p.Status).join(', ')})`);
console.log(`  Tasks:     ${count(tasks)} (done ${tasks.filter(t => t.Status === 'done').length}, in-progress ${tasks.filter(t => t.Status === 'in-progress').length}, todo ${tasks.filter(t => t.Status === 'todo').length})`);
console.log(`  Resources: ${count(resources)} (${resources.filter(r => r.Type === 'Person').length} Person, ${resources.filter(r => r.Type === 'Equipment').length} Equipment)`);
console.log(`  Finances:  ${count(buildFinances())} rows (12 months x ${count(projects)} projects)`);
console.log(`  Locations: ${count(locations)} across ${new Set(locations.map(l => l.State)).size} states`);
