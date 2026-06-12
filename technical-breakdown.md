# IT Department Shift Scheduler — Technical Documentation

> Internal scheduling tool for UMass Lowell IT. Replaces manual Teams-based shift management with an algorithm-driven web app. 
> Built with Node/Express, plain HTML/CSS/JS, and a JSON data store.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Configuration](#configuration)
3. [Algorithm Overview](#algorithm-overview)
4. [Backend — Routes](#backend--routes)
5. [Frontend — Pages](#frontend--pages)
6. [Shared Utilities](#shared-utilities)
7. [Testing](#testing)
8. [Running the App](#running-the-app)

---

## Project Structure

```
Scheduler/
├── config/
│   └── hours.js              ← Semester mode + hardcoded max hours by role
├── utils/
│   ├── timeHelpers.js        ← Time conversion, slot generation, available hours calc
│   ├── passes.js             ← The three scheduling passes + slot-level helpers
│   ├── scheduler.js          ← Orchestrator — wires passes together, entry point
│   └── fairness.js           ← Utilization report and std deviation calculation
├── routes/
│   ├── people.js             ← CRUD endpoints for availability submissions
│   └── schedule.js           ← Schedule generation endpoint
├── public/
│   ├── admin/index.html      ← Admin view: people table + delete
│   ├── student/index.html    ← Student form: availability grid submission
│   ├── schedule/index.html   ← Schedule view: generated grid + utilization report
│   ├── hours/index.html      ← Clock in/out placeholder (not yet implemented)
│   └── css/
│       ├── shared.css        ← Base styles shared across all pages
│       └── schedule.css      ← Schedule-page-specific styles (grid, tabs, report cards)
├── data/
│   └── schedule.json         ← Availability data store (people array)
├── tests/
│   └── Scheduler.test.js     ← Algorithm correctness and fairness tests
└── server.js                 ← Express app entry point
```

---

## Configuration

**`config/hours.js`**

Controls the active semester mode and max schedulable hours per role. This is the single place to change when switching between school year and summer schedules.

```js
const SEMESTER = "schoolyr"; // "schoolyr" | "summer" | "fulltime"
```

| Role | School Year | Summer / Full-Time |
|---|---|---|
| student | 22h | 37.5h |
| international | 20h | 37.5h / 37.5h |
| senior | 20h | 37.5h |
| training | 22h | 37.5h / 37.5h |

`getMaxHours(role)` is called on every POST and PUT to `people.js` so that `max_hours` is always derived from the current semester, never user-supplied.

---

## Algorithm Overview

The scheduler runs in three sequential passes over a Mon–Fri, 8am–5pm window in 15-minute slots.

**Key concepts:**
- **Scarcity sort** — slots are processed rarest-first (fewest available workers). This ensures hard-to-cover slots get priority before workers hit their hour caps.
- **Block fill** — when a worker is assigned to a slot, they are scheduled for their entire contiguous availability block, not just that one slot. This prevents split shifts.
- **Seat softcap** — default of 4 non-training workers per slot. Trainees do not count toward this cap.

---

### Pass 1 — Senior Pass

```
Goal: ensure at least one senior analyst is present in every slot.

→ Sort all slots scarcest-first (fewest seniors available)
→ For each slot:
    - If a senior is already present (from a prior block fill), skip
    - Otherwise pick the senior with the fewest current hours (fairness tiebreak)
    - Fill their entire availability block starting from this slot
    - If no senior is available → flag slot as "no_senior"
```

---

### Pass 2 — Training Pass

```
Goal: maximize scheduled hours for trainees, only where supervision exists.

→ Sort slots scarcest-first (fewest trainees available)
→ For each slot:
    - Hard constraint: skip if no senior was assigned in Pass 1
    - Assign all available trainees up to their max_hours
    - Trainees go into a separate list — invisible to the softcap
```

---

### Pass 3 — General Pool Pass

```
Goal: fill remaining seats up to the softcap with seniors and students.

→ Re-sort by general pool scarcity (seniors + students combined)
→ For each slot:
    - Skip if already at softcap
    - Seniors re-enter the pool alongside students
    - Pick whoever has the fewest current hours (fairness tiebreak)
    - Flagged slots still get filled — they just keep the "no_senior" flag
```

---

### Fairness Metric

After scheduling, utilization rate is computed per worker:

```
utilization = assigned hours / min(available hours, max_hours)
```

The standard deviation of utilization rates across all workers is the primary fairness metric — lower is fairer. Raw hours are not used because a worker who submitted 5 hours of availability getting 5 hours scheduled is fairer than a worker who submitted 30 hours getting 5 hours.

---

## Backend — Routes

### `routes/people.js`

| Method | Path | Description |
|---|---|---|
| GET | `/api/people` | Returns all submitted people from `schedule.json` |
| POST | `/api/availability` | Adds a new person. Computes `max_hours` from role + semester config |
| PUT | `/api/availability/:id` | Updates a person. Recalculates `max_hours` if role changed |
| DELETE | `/api/people/:id` | Removes a person by ID |

**POST body shape:**
```json
{
  "name": "Alex Kim",
  "role": "senior",
  "available_hours": 18.5,
  "availability": {
    "Mon": [{ "start": "08:00", "end": "14:30" }],
    "Wed": [{ "start": "10:00", "end": "17:00" }]
  }
}
```

`available_hours` is computed from the grid on the frontend — it is the sum of all selected 15-minute slots converted to decimal hours. It is stored for reference but is not used by the algorithm. `max_hours` is always set server-side from `config/hours.js`.

---

### `routes/schedule.js`

| Method | Path | Description |
|---|---|---|
| GET | `/api/schedule/generate` | Runs the scheduler against current `schedule.json` and returns the result |

**Response shape:**
```json
{
  "schedule": {
    "Mon": {
      "8": { "assigned": ["person_123"], "trainees": [] },
      "8.25": { "assigned": [], "trainees": [] }
    }
  },
  "flags": {
    "Mon": { "8": null, "8.25": "no_senior" }
  },
  "workers": [ ...workers with updated currentHours ]
}
```

---

## Frontend — Pages

### `public/student/index.html` — Availability Submission

The student-facing form. Workers select their available time by clicking or dragging across a 15-minute slot grid (Mon–Fri, 8am–5pm).

**Key functions:**

`buildGrid()` — constructs the CSS grid DOM. The corner spacer aligns the time label row above the day rows. Time labels only appear every 4th slot (`s % 4 === 0`) since each hour has 4 slots — showing every label would be unreadable. The `hour-start` class adds a stronger left border at each full hour boundary.

`toggleSlot(day, slotIdx, forceTo)` — single function for both click and drag. `selected` is the source of truth; the DOM class is always derived from it, never managed independently. `forceTo` is used during drags so the entire drag gesture paints in one direction.

`buildAvailabilityPayload()` — converts the flat boolean arrays in `selected` into contiguous time ranges. The loop runs to `s = SLOTS` (one past the end) to guarantee that a run reaching the final slot is always closed before the loop exits.

`submitAvailability()` — sends `{ name, role, available_hours, availability }`. `available_hours` is derived from the grid via `calcAvailableHours()`, not user input. `max_hours` is not sent — it is computed server-side.

---

### `public/admin/index.html` — Admin View

Displays all submitted people in a table. Admins can review availability ranges and remove people.

**Key functions:**

`load()` — fetches `/api/people`, updates the submission count, renders the table. Each person's availability is formatted as `Day: HH:MM–HH:MM` with multiple ranges per day joined by commas.

`deletePerson(id)` — confirms before sending a DELETE request, then reloads the table.

`esc(s)` — escapes `&`, `<`, and `>` in user-supplied name strings before injecting into innerHTML. Required to prevent XSS since names come from user input.

---

### `public/schedule/index.html` — Schedule View

Generates and displays the weekly schedule as a time × worker grid, plus a per-worker utilization report.

**Key functions:**

`generate()` — calls `/api/schedule/generate`, stores the full response in `scheduleData` for tab switching (so switching days doesn't re-fetch). Finds the first day with any assignments to use as the default active tab.

`renderGrid(day)` — builds a CSS grid where rows are 15-minute slots and columns are workers who appear at least once on that day. Workers with no assignments on the selected day are excluded so there are no empty ghost columns. Cell background color reflects role (senior = green, trainee = purple, student = blue) with flagged slots (no senior) overriding to amber.

`renderReport(workers)` — computes utilization per worker (`assigned / available`, capped at 100%), renders summary stats (mean, std deviation, total workers), and draws per-worker bar cards sorted highest-to-lowest utilization.

`calcAvailableHours(worker)` — sums all availability ranges across the week and caps at `max_hours`. The cap is what makes utilization percentages meaningful — without it, a worker who submitted 40 hours but is capped at 20 would appear at 50% utilization even if fully scheduled.

---

## Shared Utilities

### `utils/timeHelpers.js`

| Function | Description |
|---|---|
| `timeToFloat(str)` | `"08:30"` → `8.5` |
| `generateSlots()` | Returns all slot start times as floats. Uses `Math.round(t * 100) / 100` to prevent floating-point drift accumulating over many iterations |
| `calcAvailableHours(worker)` | Sums availability ranges, caps at `max_hours` |

Constants: `START = 8`, `END = 17`, `INTERVAL = 0.25`

---

### `utils/passes.js`

Internal helpers used by the three pass functions:

`isAvailable(worker, day, slot)` — checks if a worker's availability ranges cover a given slot.

`getBlock(worker, day, slot)` — returns the `[start, end]` float pair of the contiguous range a worker is available in for that slot. Used by `insertWorker` to fill the full block.

`pickWorker(candidates, day, slot, alreadyAssigned)` — filters to eligible workers (available, not already assigned, under max hours) and returns the one with fewest current hours. This is the fairness tiebreak used in all three passes.

`insertWorker(worker, day, slot, targetList, schedule)` — fills every slot in the worker's contiguous availability block. Stops early if the worker hits `max_hours`. Uses `targetList` (`"assigned"` or `"trainees"`) to route into the correct list, keeping trainees invisible to the softcap.

`scarcitySort(availMap, days, slots, roleKey)` — sorts all day/slot combinations by how many workers from a given pool are available. `"general"` combines seniors and students. Secondary sort by slot time makes output deterministic.

---

### `utils/fairness.js`

`fairnessReport(workers, weeks)` — computes utilization per worker scaled by the number of weeks, then returns mean utilization, std deviation, and a per-worker breakdown. The `weeks` parameter scales `available_hours` so multi-week test runs produce accurate percentages.

---

## Testing

Tests live in `tests/Scheduler.test.js` and use Node's built-in `assert` module (no framework needed).

```bash
npm test
```

**Test 1 — Trainee never scheduled without senior**
Verifies the hard constraint: no slot in the schedule has a trainee present without at least one senior in `assigned`.

**Test 2 — No worker exceeds max hours**
Checks that `currentHours <= max_hours` for every worker after a full run.

**Test 3 — Slots without senior get flagged**
Removes all seniors from the pool and verifies every slot gets `"no_senior"` or `null` — no unexpected flag values.

**Test 4 — Fairness std deviation over 4 weeks**
Runs the scheduler 4 times, accumulates `totalHours`, then calls `fairnessReport(pool, 4)` and asserts `std < 15`. Uses `structuredClone` between runs to prevent state bleed.

---

## Running the App

```bash
# Install dependencies
npm install

# Development (auto-restarts on file changes)
npm run dev

# Production
npm start
```

App runs at `http://localhost:3000`. Pages:

| URL | Description |
|---|---|
| `/student` | Availability submission form |
| `/admin` | People management |
| `/schedule` | Schedule generation and utilization report |
| `/hours` | Clock in/out (not yet implemented) |

**Sharing locally (same network):**
```bash
ipconfig getifaddr en0   # get your local IP
# Others on the same WiFi visit http://<your-ip>:3000
```

**Quick public demo link:**
```bash
npx ngrok http 3000
```

---

*Last updated: June 2026 — PoC phase. JSON file store, no authentication, no Docker yet.*