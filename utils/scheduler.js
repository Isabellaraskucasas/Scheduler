/**
 * Main scheduler orchestrator.
 * Builds the schedule skeleton, runs the three passes in order,
 * and returns the completed schedule, flags, and updated workers.
 *
 * Import this from routes or tests — don't import passes.js directly.
 */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const SEAT_SOFTCAP = 4;

const { generateSlots }                       = require("./timeHelpers");
const { isAvailable }                         = require("./passes");
const { passSenior, passTraining, passGeneral } = require("./passes");
const { fairnessReport }                      = require("./fairness");

/**
 * Run the full scheduling algorithm for one week.
 *
 * @param {Array}  workers            — people from schedule.json, with currentHours: 0
 * @param {Object} options
 * @param {number} options.seatSoftcap — max non-training workers per slot (default 4)
 * @returns {{ schedule, flags, workers }}
 */
function runScheduler(workers, options = {}) {
  const softcap = options.seatSoftcap ?? SEAT_SOFTCAP;
  const slots   = generateSlots();

  // Reset hours for this run
  workers.forEach(w => { w.currentHours = 0; });

  // Split into role pools
  const seniors  = workers.filter(w => w.role === "senior");
  const students = workers.filter(w => w.role === "student");
  const trainees = workers.filter(w => w.role === "training");

  // ── Build schedule skeleton ──────────────────────────────────────────────
  const schedule = {};
  const flags    = {};

  for (const day of DAYS) {
    schedule[day] = {};
    flags[day]    = {};
    for (const slot of slots) {
      schedule[day][slot] = { assigned: [], trainees: [] };
      flags[day][slot]    = null;
    }
  }

  // ── Build availability map ───────────────────────────────────────────────
  // availMap[day][slot] = { seniors, students, trainees }
  const availMap = {};
  for (const day of DAYS) {
    availMap[day] = {};
    for (const slot of slots) {
      availMap[day][slot] = {
        seniors:  seniors.filter(w  => isAvailable(w, day, slot)),
        students: students.filter(w => isAvailable(w, day, slot)),
        trainees: trainees.filter(w => isAvailable(w, day, slot)),
      };
    }
  }

  // ── Run passes ───────────────────────────────────────────────────────────
  passSenior  (seniors,                    availMap, schedule, flags, DAYS, slots);
  passTraining(trainees, seniors,           availMap, schedule,        DAYS, slots);
  passGeneral (seniors,  students,          availMap, schedule,        DAYS, slots, softcap);

  return { schedule, flags, workers };
}

module.exports = { runScheduler, fairnessReport };
