// --- IMPORTS ---
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

// --- APP CONFIG ---
const app = express();
const PORT = process.env.PORT || 3000;

// Paths
const DATA_FILE = path.join(__dirname, "registrations.json");
const POSTER_DIR = path.join(__dirname, "..", "posters");

// Limits
const MAX_TOTAL = 10;
const MAX_OFFSTAGE = 6;

// --- MIDDLEWARE ---
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use("/posters", express.static(POSTER_DIR)); // serve generated posters

// --- UTILITIES ---
const ensureFileExists = (filePath) => {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "[]");
};

const loadRegistrations = () => {
  ensureFileExists(DATA_FILE);
  try {
    const data = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
};

const saveRegistration = (newEntry) => {
  const registrations = loadRegistrations();
  registrations.push(newEntry);
  fs.writeFileSync(DATA_FILE, JSON.stringify(registrations, null, 2));
};

const isAdmissionNumberRegistered = (admissionNumber) => {
  const registrations = loadRegistrations();
  return registrations.some(
    (entry) => entry.admissionNumber === admissionNumber
  );
};

const generatePoster = async (fullName, admissionNumber, offEvents, onEvents) => {
  const timestamp = Date.now();
  const posterFileName = `${admissionNumber}_${timestamp}.txt`;
  const posterFilePath = path.join(POSTER_DIR, posterFileName);

  if (!fs.existsSync(POSTER_DIR)) fs.mkdirSync(POSTER_DIR, { recursive: true });

  const posterContent = `
==============================
 PEECKA ARTS FEST REGISTRATION
==============================

Name: ${fullName}
Admission No: ${admissionNumber}

Total Events: ${offEvents.length + onEvents.length}
Off-Stage Events (${offEvents.length}/${MAX_OFFSTAGE}):
${offEvents.join("\n") || "None"}

On-Stage Events (${onEvents.length}):
${onEvents.join("\n") || "None"}

Generated on: ${new Date().toLocaleString()}
  `;

  fs.writeFileSync(posterFilePath, posterContent);
  return posterFilePath;
};

// --- ROUTES ---
app.get("/", (req, res) => {
  const formPath = path.join(__dirname, "..", "frontend", "form.html");
  res.sendFile(formPath, (err) => {
    if (err) {
      console.error("Error serving form.html:", err);
      res
        .status(500)
        .send(
          "<h1>500: Registration Form Missing</h1><p>Please contact the admin.</p>"
        );
    }
  });
});

app.post("/submit_registration", async (req, res) => {
  try {
    const formData = req.body;
    const rawAdmissionNumber = formData.admissionNumber || "";
    const admissionNumber = rawAdmissionNumber.toUpperCase().trim();
    formData.admissionNumber = admissionNumber;

    // Normalize event arrays
    const offEvents = Array.isArray(formData.offStageEvents)
      ? formData.offStageEvents
      : formData.offStageEvents
      ? [formData.offStageEvents]
      : [];
    const onEvents = Array.isArray(formData.onStageEvents)
      ? formData.onStageEvents
      : formData.onStageEvents
      ? [formData.onStageEvents]
      : [];

    const totalEvents = offEvents.length + onEvents.length;
    const offStageCount = offEvents.length;

    // --- VALIDATION ---
    if (totalEvents > MAX_TOTAL) {
      return res.status(400).send(`
        <h1>❌ Event Limit Exceeded</h1>
        <p>You selected ${totalEvents} events. The max is ${MAX_TOTAL}.</p>
        <a href="/">Go Back</a>
      `);
    }

    if (offStageCount > MAX_OFFSTAGE) {
      return res.status(400).send(`
        <h1>❌ Off-Stage Limit Exceeded</h1>
        <p>You selected ${offStageCount} Off-Stage events. Max allowed is ${MAX_OFFSTAGE}.</p>
        <a href="/">Go Back</a>
      `);
    }

    if (isAdmissionNumberRegistered(admissionNumber)) {
      return res.status(409).send(`
        <h1>⚠️ Duplicate Registration</h1>
        <p>Admission No. ${admissionNumber} is already registered.</p>
        <a href="/">Go Back</a>
      `);
    }

    // --- SAVE AND GENERATE POSTER ---
    saveRegistration(formData);

    const posterFilePath = await generatePoster(
      formData.fullName,
      admissionNumber,
      offEvents,
      onEvents
    );

    const posterFileName = path.basename(posterFilePath);
    const posterUrl = `/posters/${posterFileName}`;

    res.send(`
      <h1>✅ Registration Successful!</h1>
      <p>Thank you, <strong>${formData.fullName}</strong>.</p>
      <p>Your Admission No: <strong>${admissionNumber}</strong></p>
      <p><a href="${posterUrl}" target="_blank">View Confirmation Poster</a></p>
      <a href="/">Register Another</a>
    `);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send(`
      <h1>❌ Server Error</h1>
      <p>Something went wrong. Please try again later.</p>
      <a href="/">Go Back</a>
    `);
  }
});

// --- SERVER START ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(
    `🗂️  Serving registration form from: ${path.join(
      __dirname,
      "..",
      "frontend",
      "form.html"
    )}`
  );
});
