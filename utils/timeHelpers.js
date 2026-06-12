/**
 * Time utility functions shared across the scheduler.
 */

const START = 8;   // 8am
const END   = 17;  // 5pm
const INTERVAL = 0.25; // 15 min 

/**
 * Convert "HH:MM" string to decimal hour float
 * e.g. "08:30" → 8.5
 */
function timeToFloat(str) {
  const [h, m] = str.split(":").map(Number);
  return h + m / 60;
}

/**
 * Generate all slot start times for one day as floats
 * e.g. [8.0, 8.25, 8.5, ..., 19.75]
 */
function generateSlots() {
  const slots = [];
  let t = START;
  while (t < END) {
    slots.push(Math.round(t * 100) / 100); // avoid float drift
    t += INTERVAL;
  }
  return slots;
}

/**
 * Total hours a worker is available this week, capped at max_hours.
 * Used for utilization calculations.
 */
function calcAvailableHours(worker) {
  let total = 0;
  for (const day in worker.availability) {
    for (const range of worker.availability[day]) {
      total += timeToFloat(range.end) - timeToFloat(range.start);
    }
  }
  return Math.min(total, worker.max_hours);
}

module.exports = { START, END, INTERVAL, timeToFloat, generateSlots, calcAvailableHours };
