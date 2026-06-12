/* Hardcoded max hours by role + semester */

const SEMESTER = "schoolyr"; // "schoolyr" | "summer"

const MAX_HOURS = {
  schoolyr: {
    student:  22,
    international : 20,
    senior:   20,
    training: 22,
  },
  summer: {
    student:  37.5,
    international : 37.5,
    senior:   37.5,
    training: 37.5,
  },
  fulltime: {
    student:  37.5,
    international : 35,
    senior:   37.5,
    training: 20,
  }
};

function getMaxHours(role) {
  return MAX_HOURS[SEMESTER][role] ?? 20;
}

module.exports = { SEMESTER, MAX_HOURS, getMaxHours };
