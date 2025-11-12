const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
// Assuming you have the 'ejs' package if you use any dynamic rendering, 
// but for this example, we'll focus on static HTML serving and data handling.

const app = express();
const PORT = 3000;

// --- CONFIGURATION ---
const DATA_FILE = path.join(__dirname, 'registration.json');
const POSTER_DIR = path.join(__dirname, '..', 'posters'); // One level up from 'backend'

// Dual Limit Constants
const MAX_TOTAL = 10;
const MAX_OFFSTAGE = 6;


// --- MIDDLEWARE SETUP ---
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Set up serving static files (like posters)
// Note: This serves files from the /posters URL route
app.use('/posters', express.static(POSTER_DIR)); 


// --- HELPER FUNCTIONS (Placeholder Logic) ---

// 1. Load registered data
const loadRegistrations = () => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // If file doesn't exist or is invalid JSON, return an empty array
        return [];
    }
};

// 2. Save registration data
const saveRegistration = (newEntry) => {
    const registrations = loadRegistrations();
    registrations.push(newEntry);
    fs.writeFileSync(DATA_FILE, JSON.stringify(registrations, null, 2));
};

// 3. Check for duplicates
const isAdmissionNumberRegistered = (admissionNumber) => {
    const registrations = loadRegistrations();
    return registrations.some(entry => entry.admissionNumber === admissionNumber);
};

// 4. Poster generation placeholder (You need to implement this fully)
const generatePoster = async (fullName, admissionNumber, offEvents, onEvents) => {
    // --- IMPORTANT: This is a placeholder ---
    // In a real application, this function would use a library (like jspdf, canvas, etc.)
    // to dynamically create an image/PDF file based on the data provided.

    const timestamp = Date.now();
    const posterFileName = `${admissionNumber}_${timestamp}.txt`; // Using .txt for simplicity
    const posterFilePath = path.join(POSTER_DIR, posterFileName);

    // Ensure the posters directory exists
    if (!fs.existsSync(POSTER_DIR)) {
        fs.mkdirSync(POSTER_DIR, { recursive: true });
    }

    const posterContent = `
        PEECKA Arts Fest Registration Poster
        ---------------------------------
        Name: ${fullName}
        Admission No: ${admissionNumber}
        Total Events: ${offEvents.length + onEvents.length}
        
        Off-Stage Events (${offEvents.length}/${MAX_OFFSTAGE}):
        ${offEvents.join('\n')}

        On-Stage Events:
        ${onEvents.join('\n')}
    `;
    
    fs.writeFileSync(posterFilePath, posterContent);
    return posterFilePath;
};


// --- ROUTES ---

// 1. Serve the registration form from the frontend directory
app.get('/', (req, res) => {
    // Navigate from 'backend' (where server.js is) up one level ('..') then into 'frontend'
    const formPath = path.join(__dirname, '..', 'frontend', 'form.html');
    
    res.sendFile(formPath, (err) => {
        if (err) {
            console.error("Error serving form.html. Check path:", formPath, err);
            // Display a user-friendly error if the file is missing
            res.status(500).send('<h1>Error 500: Registration Form Not Found</h1><p>The server failed to locate the form file. Please contact the administrator.</p>');
        }
    });
});

// 2. Handle form submission
app.post('/submit_registration', async (req, res) => {
    const formData = req.body;
    const rawAdmissionNumber = formData.admissionNumber || '';

    // Normalize the Admission Number
    const admissionNumber = rawAdmissionNumber.toUpperCase().trim();
    formData.admissionNumber = admissionNumber;
    
    // --- SERVER-SIDE VALIDATION ---
    
    // Ensure event fields are treated as arrays (handle single or no selections)
    const offEvents = Array.isArray(formData.offStageEvents) ? formData.offStageEvents : (formData.offStageEvents ? [formData.offStageEvents] : []);
    const onEvents = Array.isArray(formData.onStageEvents) ? formData.onStageEvents : (formData.onStageEvents ? [formData.onStageEvents] : []);
    
    const totalEvents = offEvents.length + onEvents.length;
    const offStageCount = offEvents.length;

    // A. CHECK RULE 1: Total Event Limit (10)
    if (totalEvents > MAX_TOTAL) {
        return res.status(400).send(`
            <h1>❌ Submission Rejected: Event Limit Exceeded</h1>
            <p>You selected ${totalEvents} events. The maximum allowed is **${MAX_TOTAL}** events combined (Off-Stage + On-Stage).</p>
            <p>Please go back and adjust your selection.</p>
            <a href="/">Go back to registration</a>
        `);
    }

    // B. CHECK RULE 2: Off-Stage Sub-Limit (6)
    if (offStageCount > MAX_OFFSTAGE) {
        return res.status(400).send(`
            <h1>❌ Submission Rejected: Off-Stage Limit Exceeded</h1>
            <p>You selected ${offStageCount} Off-Stage events. The maximum allowed for Off-Stage is **${MAX_OFFSTAGE}**.</p>
            <p>Please go back and adjust your selection.</p>
            <a href="/">Go back to registration</a>
        `);
    }

    // C. CHECK ADMISSION NUMBER DUPLICATE
    if (isAdmissionNumberRegistered(admissionNumber)) {
        console.warn(`Attempted duplicate registration for Admission No.: ${admissionNumber}`);
        return res.status(409).send(`
            <h1>⚠️ Registration Error: Duplicate Admission Number</h1>
            <p>The Admission Number <strong>${admissionNumber}</strong> is already registered. Only one submission is allowed per student.</p>
            <p>If you believe this is an error, please contact the administrator.</p>
            <a href="/">Go back to registration</a>
        `);
    }

    // --- EXECUTION (Runs if all checks pass) ---
    try {
        // Save the new, valid registration entry
        saveRegistration(formData);

        const { fullName } = formData;
        
        // Generate the poster
        const posterFilePath = await generatePoster(
            fullName, 
            admissionNumber, 
            offEvents, 
            onEvents
        );
        
        // Respond with success and the poster link
        const posterFileName = path.basename(posterFilePath);
        const posterUrl = `/posters/${posterFileName}`;

        res.send(`
            <h1>✅ Registration Successful!</h1>
            <p>Thank you, <strong>${fullName}</strong>, for registering for the Arts Fest!</p>
            <p>Your admission number (<strong>${admissionNumber}</strong>) has been recorded with <strong>${totalEvents}</strong> total events.</p>
            <p>Your poster/confirmation is ready:</p>
            <h2><a href="${posterUrl}" target="_blank">View/Download Confirmation Poster</a></h2>
            <hr>
            <p>Please print this poster for your records.</p>
            <a href="/">Register another student</a>
        `);

    } catch (error) {
        console.error("Submission/Poster Generation Error:", error);
        res.status(500).send(`
            <h1>❌ System Error</h1>
            <p>Your details were saved (Admission No: ${admissionNumber}), but there was an error generating the poster.</p>
            <p>Please notify the administrator immediately and quote your admission number.</p>
            <a href="/">Go back to registration</a>
        `);
    }
});


// --- SERVER START ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Serving form.html from: ${path.join(__dirname, '..', 'frontend', 'form.html')}`);
});