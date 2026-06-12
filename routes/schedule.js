/**
 * Schedule routes.
 * GET /api/schedule/generate
 */

const express        = require("express");
const fs             = require("fs");
const path           = require("path");
const { runScheduler } = require("../utils/scheduler");

const router    = express.Router();
const DATA_FILE = path.join(__dirname, "../data/schedule.json");

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return { people: [] };
  }
}

// GET generate schedule from current availability data
router.get("/schedule/generate", (req, res) => {
  const data    = readData();
  const workers = data.people.map(p => ({
    ...p,
    currentHours: 0,
    totalHours:   0,
  }));
  const result = runScheduler(workers);
  res.json(result);
});

module.exports = router;
