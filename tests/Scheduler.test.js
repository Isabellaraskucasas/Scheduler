// not working 
const { runScheduler, fairnessReport } = require("../utils/Scheduler");
const assert = require("assert");

const fs = require("fs");
const path = require("path");

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/schedule.json"), "utf-8"));
const workers = raw.people.map(p => ({
  ...p,
  currentHours: 0,
  totalHours: 0
}));

// ── Test 1: trainee never scheduled without senior ────────
{
  const { schedule, flags } = runScheduler(structuredClone(workers));
  let violated = false;
  for (const day in schedule) {
    for (const slot in schedule[day]) {
      const { assigned, trainees } = schedule[day][slot];
      const hasSenior = assigned.some(id => id === "w1");
      if (trainees.length > 0 && !hasSenior) violated = true;
    }
  }
  assert.strictEqual(violated, false, "FAIL: trainee scheduled without senior");
  console.log("✓ trainee never scheduled without senior");
}

// ── Test 2: no worker exceeds max_hours ───────────────────
{
  const cloned = structuredClone(workers);
  const { workers: result } = runScheduler(cloned);
  result.forEach(w => {
    assert.ok(
      w.currentHours <= w.max_hours,
      `FAIL: ${w.name} exceeded max hours (${w.currentHours} > ${w.max_hours})`
    );
  });
  console.log("✓ no worker exceeds max hours");
}

// ── Test 3: slots with no senior get flagged ──────────────
{
  const noSeniorWorkers = structuredClone(workers).filter(w => w.role !== "senior");
  const { flags } = runScheduler(noSeniorWorkers);
  const monSlots = Object.values(flags.Mon);
  const allFlagged = monSlots.every(f => f === "no_senior" || f === null);
  assert.ok(allFlagged, "FAIL: unexpected flag value");
  console.log("✓ no-senior slots flagged correctly");
}

// ── Test 4: fairness std dev over 4 weeks ─────────────────
{
  const pool = structuredClone(workers);
  pool.forEach(w => { w.totalHours = 0; });

  for (let week = 0; week < 4; week++) {
    const { workers: result } = runScheduler(structuredClone(pool));
    result.forEach(w => {
      const original = pool.find(p => p.id === w.id);
      original.totalHours = (original.totalHours ?? 0) + w.currentHours;
    });
  }

  const report = fairnessReport(pool, 4);
  console.log("✓ fairness report (4 weeks):", report);
  assert.ok(report.std < 15, `FAIL: utilization std too high (${report.std}%)`);
}

console.log("\nAll tests passed.");