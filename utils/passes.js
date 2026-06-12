/**
 * The three scheduling passes and supporting helpers.
 * Imported and orchestrated by scheduler.js.
 */

const { START, END, INTERVAL, timeToFloat } = require("./timeHelpers");

// ── Slot-level helpers ─────────────────────────────────────────────────────

/**
 * Check if a worker is available for a given slot on a given day.
 */
function isAvailable(worker, day, slot) {
  const ranges = worker.availability[day];
  if (!ranges) return false;
  return ranges.some(r => {
    const s = timeToFloat(r.start);
    const e = timeToFloat(r.end);
    return s <= slot && e > slot;
  });
}

/**
 * Find the contiguous availability block a worker has for a given slot.
 * Returns [blockStart, blockEnd] as floats, or null.
 */
function getBlock(worker, day, slot) {
  const ranges = worker.availability[day];
  if (!ranges) return null;
  for (const r of ranges) {
    const s = timeToFloat(r.start);
    const e = timeToFloat(r.end);
    if (s <= slot && e > slot) return [s, e];
  }
  return null;
}

/**
 * From a pool of candidates, pick the eligible worker with fewest current hours.
 */
function pickWorker(candidates, day, slot, alreadyAssigned) {
  const eligible = candidates.filter(w =>
    isAvailable(w, day, slot) &&
    !alreadyAssigned.includes(w.id) &&
    w.currentHours < w.max_hours
  );
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => a.currentHours - b.currentHours);
  return eligible[0];
}

/**
 * Insert a worker into the schedule for their full contiguous availability block.
 * Fills every slot in the block up to max_hours.
 */
function insertWorker(worker, day, slot, targetList, schedule) {
  const block = getBlock(worker, day, slot);
  if (!block) return;
  const [blockStart, blockEnd] = block;

  let t = blockStart;
  while (t < blockEnd) {
    const s = Math.round(t * 100) / 100;
    if (s < START || s >= END) { t += INTERVAL; continue; }
    if (worker.currentHours >= worker.max_hours) break;

    if (!schedule[day][s][targetList].includes(worker.id)) {
      schedule[day][s][targetList].push(worker.id);
      worker.currentHours += INTERVAL;
    }
    t += INTERVAL;
  }
}

/**
 * Sort all day/slot combinations by how many workers from a given pool are available.
 * Scarcest slots come first — ensures hard-to-fill slots are prioritized.
 */
function scarcitySort(availMap, days, slots, roleKey) {
  const entries = [];
  for (const day of days) {
    for (const slot of slots) {
      const count = roleKey === "general"
        ? availMap[day][slot].seniors.length + availMap[day][slot].students.length
        : availMap[day][slot][roleKey].length;
      entries.push({ day, slot, count });
    }
  }
  return entries.sort((a, b) => a.count - b.count || a.slot - b.slot);
}

// ── Passes ─────────────────────────────────────────────────────────────────

/**
 * Pass 1 — Senior pass.
 * Assigns one senior to every slot, scarcest first.
 * Flags slots where no senior is available as "no_senior".
 */
function passSenior(seniors, availMap, schedule, flags, days, slots) {
  const order = scarcitySort(availMap, days, slots, "seniors");

  for (const { day, slot } of order) {
    const alreadyAssigned = schedule[day][slot].assigned;
    const seniorPresent = alreadyAssigned.some(id => seniors.find(s => s.id === id));
    if (seniorPresent) continue;

    const picked = pickWorker(seniors, day, slot, alreadyAssigned);
    if (picked) {
      insertWorker(picked, day, slot, "assigned", schedule);
    } else {
      flags[day][slot] = "no_senior";
    }
  }
}

/**
 * Pass 2 — Training pass.
 * Schedules trainees for max hours, but only in slots where a senior is present.
 * Trainees go into a separate list and don't count toward the seat softcap.
 */
function passTraining(trainees, seniors, availMap, schedule, days, slots) {
  const order = scarcitySort(availMap, days, slots, "trainees");

  for (const { day, slot } of order) {
    const seniorPresent = schedule[day][slot].assigned.some(id =>
      seniors.find(s => s.id === id)
    );
    if (!seniorPresent) continue;

    const alreadyTrainees = schedule[day][slot].trainees;
    for (const trainee of trainees) {
      if (
        isAvailable(trainee, day, slot) &&
        !alreadyTrainees.includes(trainee.id) &&
        trainee.currentHours < trainee.max_hours
      ) {
        insertWorker(trainee, day, slot, "trainees", schedule);
      }
    }
  }
}

/**
 * Pass 3 — General pool pass.
 * Seniors re-enter alongside students to fill remaining seats up to softcap.
 * Flagged slots still get filled — they just keep their flag.
 */
function passGeneral(seniors, students, availMap, schedule, days, slots, softcap) {
  const order = scarcitySort(availMap, days, slots, "general");

  for (const { day, slot } of order) {
    const alreadyAssigned = schedule[day][slot].assigned;
    if (alreadyAssigned.length >= softcap) continue;

    const pool = [...seniors, ...students];
    const picked = pickWorker(pool, day, slot, alreadyAssigned);
    if (picked) {
      insertWorker(picked, day, slot, "assigned", schedule);
    }
  }
}

module.exports = { passSenior, passTraining, passGeneral, scarcitySort, isAvailable };
