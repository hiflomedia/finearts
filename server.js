// server.js (UPDATED with Unique Admission Number Check)

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'registrations.json');
const POSTER_DIR = path.join(__dirname, 'posters');

// --- Initialization and Setup ---

// Ensure the posters directory exists
if (!fs.existsSync(POSTER_DIR)) {
    fs.mkdirSync(POSTER_DIR);
}

app.use(bodyParser.urlencoded({ extended: true }));
// Serve the 'posters' directory static files
app.use('/posters', express.static(POSTER_DIR)); 


// --- Helper Functions ---

function readRegistrations() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // If file doesn't exist or is empty/invalid JSON, start with an empty array
        return [];
    }
}

function saveRegistration(newEntry) {
    const registrations = readRegistrations();
    registrations.push(newEntry);
    fs.writeFileSync(DATA_FILE, JSON.stringify(registrations, null, 2), 'utf8');
}

/**
 * Checks if an admission number already exists in the registration file.
 * @param {string} admissionNumber - The number to check.
 * @returns {boolean} - True if already registered, false otherwise.
 */
function isAdmissionNumberRegistered(admissionNumber) {
    const registrations = readRegistrations();
    // Use .some() to efficiently check if any registration matches the admission number
    return registrations.some(reg => reg.admissionNumber === admissionNumber);
}

// Function to generate the poster (Async - NO CHANGES HERE)
function generatePoster(name, admissionNo, offStageEvents, onStageEvents) {
    return new Promise((resolve, reject) => {
        // Combine all events into one list
        const allEvents = (offStageEvents || []).concat(onStageEvents || []);
        
        // Pass arguments to Python script: Name, Admission No, JSON string of events
        const pythonProcess = spawn('python', [
            'generate_poster.py',
            name,
            admissionNo,
            JSON.stringify(allEvents)
        ]);

        let posterPath = '';
        let errorData = '';

        pythonProcess.stdout.on('data', (data) => {
            posterPath += data.toString().trim();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorData += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`Poster generation failed (Code ${code}):`, errorData);
                reject(new Error('Poster generation failed.'));
                return;
            }
            console.log(`Poster generated at: ${posterPath}`);
            resolve(posterPath);
        });
    });
}


// --- Routes ---

// Serve the registration form
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'form.html'));
});

// Handle form submission with uniqueness check
app.post('/submit_registration', async (req, res) => {
    const formData = req.body;
    const { fullName, admissionNumber, offStageEvents, onStageEvents } = formData;
    
    // 🛑 STEP 1: VALIDATION CHECK
    if (isAdmissionNumberRegistered(admissionNumber)) {
        console.warn(`Attempted duplicate registration for Admission No.: ${admissionNumber}`);
        // Send a conflict response (409) with a clear message
        return res.status(409).send(`
            <h1>⚠️ Registration Error: Duplicate Admission Number</h1>
            <p>The Admission Number <strong>${admissionNumber}</strong> is already registered for the Arts Fest.</p>
            <p>Please check the number entered or contact the administrator if you believe this is an error.</p>
            <a href="/">Go back to registration</a>
        `);
    }

    try {
        // 🚀 STEP 2: IF UNIQUE, PROCEED WITH SAVING AND POSTER GENERATION
        
        // Save the raw form data
        saveRegistration(formData);

        // Ensure event arrays are handled
        const offEvents = Array.isArray(offStageEvents) ? offStageEvents : (offStageEvents ? [offStageEvents] : []);
        const onEvents = Array.isArray(onStageEvents) ? onStageEvents : (onStageEvents ? [onStageEvents] : []);

        // Generate the poster
        const posterFilePath = await generatePoster(
            fullName, 
            admissionNumber, 
            offEvents, 
            onEvents
        );
        
        // Extract just the filename for the URL
        const posterFileName = path.basename(posterFilePath);
        const posterUrl = `/posters/${posterFileName}`;

        // Send a success response with the link
        res.send(`
            <h1>✅ Registration Successful!</h1>
            <p>Thank you, <strong>${fullName}</strong>. Your details have been saved successfully.</p>
            <h2>Your Registration Poster:</h2>
            <img src="${posterUrl}" alt="Registration Poster" style="max-width: 400px; height: auto;"><br><br>
            <a href="${posterUrl}" download>Download Poster</a>
            <hr>
            <p><strong>(Host Note:</strong> The student's details are saved in <code>registrations.json</code>)</p>
        `);

    } catch (error) {
        console.error("Submission Error:", error);
        res.status(500).send(`
            <h1>❌ System Error</h1>
            <p>We saved your details, but there was an error generating the poster.</p>
            <p>Please contact the administrator with admission number: ${formData.admissionNumber}</p>
        `);
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});