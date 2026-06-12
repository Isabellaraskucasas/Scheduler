/**
 * Fairness and utilization reporting.
 * Run after one or more weeks of scheduling to measure how equitably
 * hours were distributed relative to each worker's availability.
 */

const { calcAvailableHours } = require("./timeHelpers");

/**
 * Compute utilization rate per worker and overall std deviation.
 *
 * @param {Array}  workers — workers with totalHours or currentHours set
 * @param {number} weeks   — number of weeks accumulated (scales available hours)
 * @returns {{ mean, std, breakdown }}
 *
 * Utilization = assigned hours / available hours (capped at max_hours).
 * Std deviation of utilization rates — lower means fairer distribution.
 */
function fairnessReport(workers, weeks = 1) {
  const breakdown = workers.map(w => {
    const available = calcAvailableHours(w) * weeks;
    const assigned  = w.totalHours ?? w.currentHours;
    const utilization = available > 0
      ? Math.round((assigned / available) * 100)
      : 0;
    return { name: w.name, role: w.role, assigned, available, utilization };
  });

  const rates = breakdown.map(b => b.utilization);
  const mean  = rates.reduce((a, b) => a + b, 0) / rates.length;
  const std   = Math.sqrt(
    rates.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / rates.length
  );

  return {
    mean: Math.round(mean * 100) / 100,
    std:  Math.round(std  * 100) / 100,
    breakdown,
  };
}

module.exports = { fairnessReport };
