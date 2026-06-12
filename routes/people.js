/**
 * People routes — CRUD for availability submissions.
 * GET /api/people
 * POST /api/availability
 * PUT /api/availability/:id
 * DELETE /api/people/:id
 */

const express  = require("express");
const fs       = require("fs");
const path     = require("path");
const { getMaxHours } = require("../config/hours");

const router    = express.Router();
const DATA_FILE = path.join(__dirname, "../data/schedule.json");

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return { people: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET all people
router.get("/people", (req, res) => {
  res.json(readData());
});

// POST new person
router.post("/availability", (req, res) => {
  const { name, role, available_hours, availability } = req.body;

  if (!name || !role || !availability) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const data   = readData();
  const exists = data.people.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    return res.status(409).json({ error: "Person with this name already exists." });
  }

  const newPerson = {
    id:              `person_${Date.now()}`,
    name,
    role,
    available_hours: available_hours ?? 0, // computed from grid
    max_hours:       getMaxHours(role),    // hardcoded by role + semester
    availability,
    submitted_at:    new Date().toISOString(),
  };

  data.people.push(newPerson);
  writeData(data);
  res.status(201).json({ ok: true, person: newPerson });
});

// PUT update person
router.put("/availability/:id", (req, res) => {
  const data = readData();
  const idx  = data.people.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Person not found." });

  const updatedRole    = req.body.role ?? data.people[idx].role;
  data.people[idx]     = {
    ...data.people[idx],
    ...req.body,
    id:        req.params.id,
    max_hours: getMaxHours(updatedRole),
  };

  writeData(data);
  res.json({ ok: true, person: data.people[idx] });
});

// DELETE person
router.delete("/people/:id", (req, res) => {
  const data   = readData();
  const before = data.people.length;
  data.people  = data.people.filter(p => p.id !== req.params.id);
  if (data.people.length === before) {
    return res.status(404).json({ error: "Person not found." });
  }
  writeData(data);
  res.json({ ok: true });
});

module.exports = router;
