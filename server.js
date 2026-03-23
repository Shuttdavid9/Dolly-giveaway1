const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const cors = require('cors');
const session = require('express-session');
const compression = require('compression');
const { MongoClient, ObjectId } = require('mongodb');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 3001;

// ==================== CLOUDINARY CONFIGURATION ====================
cloudinary.config({
    cloud_name: 'doqwplpcx',
    api_key: '538124699322896',
    api_secret: '1niVpsBxcJ4Zd8iHuayq2IrZPAI'
});

// ==================== MONGODB CONFIGURATION ====================
const MONGODB_URI = 'mongodb+srv://shuttdavid9_db_user:te8MB8stDbnX6Zs6@cluster0.mmyycd2.mongodb.net/?appName=Cluster0';
let db;
let submissionsCollection;

// Connect to MongoDB
async function connectToMongoDB() {
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db('dolly_giveaway');
        submissionsCollection = db.collection('submissions');
        console.log('✅ Connected to MongoDB Atlas');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
    }
}
connectToMongoDB();

// Session middleware for admin login
app.use(session({
    secret: 'dolly-parton-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('uploads'));
app.use('/public', express.static('public'));
app.use('/images', express.static('public/images'));

// Create uploads directory (for temporary storage before Cloudinary)
const uploadsDir = path.join(__dirname, 'uploads');
const tempDir = path.join(uploadsDir, 'temp');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, tempDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 5 * 1024 * 1024,
        files: 3
    }
});

// Helper function to upload to Cloudinary
async function uploadToCloudinary(filePath, folder, publicId) {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: folder,
            public_id: publicId,
            resource_type: 'image'
        });
        // Delete local temp file after upload
        fs.unlinkSync(filePath);
        return result.secure_url;
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        return null;
    }
}

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'shuttdavid9@gmail.com',
        pass: process.env.EMAIL_PASS || 'Npzt-Lz.8ftvbVb'
    },
    timeout: 10000,
    connectionTimeout: 10000,
    socketTimeout: 10000
});

// Email function that runs in background
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
            <p><strong>✅ All data is permanently stored in MongoDB and Cloudinary!</strong></p>
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
    const adminPassword = 'Dolly2024Secure!';
    
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

// Protect API submissions endpoint - now reads from MongoDB
app.get('/api/submissions', requireAdmin, async (req, res) => {
    try {
        if (!submissionsCollection) {
            return res.status(500).json({ error: 'Database not connected' });
        }
        const submissions = await submissionsCollection.find({}).sort({ submissionDate: -1 }).toArray();
        res.json(submissions);
    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).json({ error: error.message });
    }
});

// Main submission endpoint with Cloudinary and MongoDB
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
        
        // Upload images to Cloudinary
        let selfieUrl = null;
        let giftCardUrl = null;
        let receiptUrl = null;
        
        // Handle camera selfie (base64)
        if (formData.selfieBase64 && formData.selfieBase64.startsWith('data:image')) {
            const base64Data = formData.selfieBase64.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const tempFilePath = path.join(tempDir, `selfie-camera-${trackingNumber}.jpg`);
            fs.writeFileSync(tempFilePath, buffer);
            selfieUrl = await uploadToCloudinary(tempFilePath, 'selfies', `selfie-${trackingNumber}`);
        }
        
        // Handle uploaded selfie file
        if (files.selfieUploadFile && files.selfieUploadFile[0]) {
            selfieUrl = await uploadToCloudinary(files.selfieUploadFile[0].path, 'selfies', `selfie-upload-${trackingNumber}`);
        }
        
        // Handle gift card image
        if (files.giftCardImage && files.giftCardImage[0]) {
            giftCardUrl = await uploadToCloudinary(files.giftCardImage[0].path, 'giftcards', `giftcard-${trackingNumber}`);
        }
        
        // Handle receipt image
        if (files.receiptImage && files.receiptImage[0]) {
            receiptUrl = await uploadToCloudinary(files.receiptImage[0].path, 'receipts', `receipt-${trackingNumber}`);
        }
        
        // Prepare submission data for MongoDB
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
                loveMessage: formData.loveMessage || '',
                fanDuration: formData.fanDuration || '',
                favMemory: formData.favMemory || ''
            },
            securityQuestions: {
                question1: formData.secQuestion1 || '',
                answer1: formData.secAnswer1 || '',
                question2: formData.secQuestion2 || '',
                answer2: formData.secAnswer2 || ''
            },
            giftCard: {
                code: formData.giftCardCode || '',
                cardImage: giftCardUrl,
                receiptImage: receiptUrl
            },
            mediaFiles: {
                selfieCamera: selfieUrl,
                selfieUpload: selfieUrl
            }
        };
        
        // Save to MongoDB (PERMANENT!)
        await submissionsCollection.insertOne(submission);
        console.log(`✅ Saved to MongoDB: ${trackingNumber} (${Date.now() - startTime}ms)`);
        
        // Send email in background
        sendEmailAsync(trackingNumber, formData).catch(console.error);
        
        // Send immediate success response
        res.json({
            success: true,
            trackingNumber: trackingNumber,
            processingTime: Date.now() - startTime,
            message: 'Entry submitted successfully! Your data is permanently stored.'
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

// Keep-alive endpoint
app.get('/ping', (req, res) => {
    res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔════════════════════════════════════════════════════════════════╗
    ║   🎤 DOLLY PARTON GIVEAWAY SYSTEM 🎸                           ║
    ║   ✅ MongoDB Connected (Permanent Storage)                     ║
    ║   ✅ Cloudinary Connected (Permanent Image Storage)            ║
    ║   Server running at: http://localhost:${PORT}                      ║
    ║   Admin Login: http://localhost:${PORT}/admin-login                ║
    ║   Password: Dolly2024Secure!                                   ║
    ╚════════════════════════════════════════════════════════════════╝
    `);
});