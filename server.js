const express = require("express");
const path    = require("path");

const peopleRouter   = require("./routes/people");
const scheduleRouter = require("./routes/schedule");

const app  = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// API routes
app.use("/api", peopleRouter);
app.use("/api", scheduleRouter);

// Page routes
app.get("/admin",    (req, res) => res.sendFile(path.join(__dirname, "public/admin/index.html")));
app.get("/student",  (req, res) => res.sendFile(path.join(__dirname, "public/student/index.html")));
app.get("/hours",    (req, res) => res.sendFile(path.join(__dirname, "public/hours/index.html")));
app.get("/schedule", (req, res) => res.sendFile(path.join(__dirname, "public/schedule/index.html")));

app.listen(PORT, () => {
  console.log(`IT Scheduler running at http://localhost:${PORT}`);
  console.log(`  Student:  http://localhost:${PORT}/student`);
  console.log(`  Admin:    http://localhost:${PORT}/admin`);
  console.log(`  Schedule: http://localhost:${PORT}/schedule`);
  console.log(`  Hours:    http://localhost:${PORT}/hours`);
});
