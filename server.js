// backend/server.js
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg'); // Use pg for Supabase/PostgreSQL
const nodemailer = require('nodemailer');
const pgSession = require('connect-pg-simple')(require('express-session'));
const session = require('express-session');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const { body, validationResult } = require('express-validator');
const path = require('path'); // Import the path module
const cors = require('cors'); // For cross-origin requests
const helmet = require('helmet'); // For security headers
const rateLimit = require('express-rate-limit'); // For rate limiting
const https = require('https');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080; // Use the new port from .env, default to 8080
const isProduction = process.env.NODE_ENV === 'production';

// Trust the Nginx proxy (Required for secure cookies and rate limiting behind Nginx)
if (isProduction) {
    app.set('trust proxy', 1);
}

// Middleware
if (isProduction) {
    app.use(
        helmet.contentSecurityPolicy({
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "script-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://kit.fontawesome.com"],
                "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://ka-f.fontawesome.com"],
                "font-src": ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "https://ka-f.fontawesome.com"],
                "img-src": ["'self'", "data:", "https:"], // Allow images from self, data URIs, and external HTTPS sources
                "upgrade-insecure-requests": [],
            },
        })
    );
}
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Create a PostgreSQL connection pool
// Only use SSL if connecting to a remote database (like Supabase), not localhost
const useSSL = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSSL ? { rejectUnauthorized: false } : undefined,
    max: 10, // Equivalent to connectionLimit
    idleTimeoutMillis: 30000
});

// --- Session Middleware Setup ---
app.use(session({
    store: new pgSession({
        pool: pool,                // Use existing database connection
        tableName: 'session',      // Table to store sessions
        createTableIfMissing: true // Automatically create the table if it doesn't exist
    }),
    secret: process.env.SESSION_SECRET || 'local-dev-secret',
    resave: false,
    saveUninitialized: false, // Set to false, we will save sessions only on login
    cookie: { 
        httpOnly: true, 
        secure: isProduction, // Use secure cookies in production
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

// --- Rate Limiting (Production Only) ---
if (isProduction) {
    const apiLimiter = rateLimit({
    	windowMs: 15 * 60 * 1000, // 15 minutes
    	max: 100, // Limit each IP to 100 requests per windowMs
    	standardHeaders: true,
    	legacyHeaders: false,
        message: 'Too many requests from this IP, please try again after 15 minutes'
    });
    // Apply the rate limiting middleware to API calls
    app.use('/app-api/', apiLimiter);
}

// --- Authentication Middleware (Moved Up) ---
const authMiddleware = (req, res, next) => {
    if (req.session && req.session.user) {
        return next(); // User is authenticated
    } else {
        return res.redirect('/login.html');
    }
};

// Protect the admin.html file specifically before serving static files
app.use('/admin.html', authMiddleware);

// Nodemailer Transporter Setup
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ? process.env.SMTP_HOST.trim() : '',
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    name: 'techandjamesconsult.com', // Identifies the client to the server (helps with spam)
    auth: {
        user: process.env.SMTP_USER ? process.env.SMTP_USER.trim() : '',
        pass: process.env.SMTP_PASS ? process.env.SMTP_PASS.trim() : '',
    },
    // Add DNS configuration to improve resilience against local DNS issues
    dns: {
        timeout: 30000, // 30 seconds
        servers: ['8.8.8.8', '1.1.1.1'] // Use reliable public DNS servers
    }
});

// --- SMTP Connection Verification (On Startup) ---
console.log(`\n📧 Attempting to connect to SMTP server: ${process.env.SMTP_HOST}`);
console.log(`   User: ${process.env.SMTP_USER}`);

transporter.verify((error, success) => {
    if (error) {
        console.error('❌ SMTP Connection Error:', error.message);
    } else {
        console.log('✅ SMTP Server is ready to take messages');
    }
});

// --- Login and Logout Routes ---
app.post('/app-api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find the user in the database (Postgres uses $1 for placeholders)
        const result = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);

        if (result.rows.length === 0) {
            // User not found
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const adminUser = result.rows[0];

        // Compare the provided password with the stored hash
        const match = await bcrypt.compare(password, adminUser.password);

        if (match) {
            // Passwords match, create a session
            req.session.user = { id: adminUser.id, username: adminUser.username };
            return res.status(200).json({ message: 'Login successful' });
        } else {
            // Passwords do not match
            return res.status(401).json({ message: 'Invalid username or password' });
        }
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Server error during login.' });
    }
});

app.get('/app-api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Could not log out.');
        }
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.redirect('/login.html');
    });
});

// --- Convenience route for login ---
app.get('/login', (req, res) => {
    res.redirect('/login.html');
});

// --- Main Admin Entry Point ---
// This will redirect to /login.html if not authenticated, or serve admin.html if authenticated.
app.get('/admin', authMiddleware, (req, res) => {
    res.redirect('/admin.html');
});

// --- Protected Admin Route for admin.html ---
app.get('/admin.html', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// --- API Route to get all submissions ---
// NOTE: For a production app, this endpoint should be protected with authentication.
app.get('/app-api/submissions', authMiddleware, async (req, res) => {
    try {
        // Query the database to get all submissions, ordered by the newest first
        const result = await pool.query('SELECT * FROM submissions ORDER BY submitted_at DESC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).json({ message: 'Failed to fetch submissions.' });
    }
});


// API Route for Form Submission
app.post('/app-api/submit', [
    // --- Add Validation and Sanitization Rules ---
    body('name', 'Full Name is required').not().isEmpty().trim().escape(),
    body('email', 'Please include a valid email').isEmail().normalizeEmail(),
    body('phone', 'Phone Number is required').not().isEmpty().trim().escape(),
    body('service', 'Service selection is required').not().isEmpty().trim().escape()
], async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // If there are errors, send a 400 response with the first error message
            return res.status(400).json({ message: errors.array()[0].msg });
        }

        const { name, email, phone, service, message } = req.body; // Assuming a message field might exist
        const initialMessage = `Service Interest: ${service}\n\n${message || 'No initial message provided.'}`;

        // Connect a client from the pool to run a transaction
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Insert into submissions table
            // Postgres requires "RETURNING id" to get the inserted ID
            const submissionResult = await client.query(
                'INSERT INTO submissions (name, email, phone, service) VALUES ($1, $2, $3, $4) RETURNING id',
                [name, email, phone, service]
            );
            const submissionId = submissionResult.rows[0].id;

            // 2. Insert the initial message into the messages table
            await client.query(
                'INSERT INTO messages (submission_id, sender, body) VALUES ($1, $2, $3)',
                [submissionId, 'user', initialMessage]
            );

            await client.query('COMMIT'); // Commit both inserts
            console.log(`New submission and initial message saved for: ${email}`);
        } catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError; // Let the outer catch handle it
        } finally {
            client.release();
        }

        // --- Send Email Notification ---
        const mailOptions = {
            from: `"Tech & James Consult" <ceo@techandjamesconsult.com>`,
            replyTo: 'ceo@techandjamesconsult.com', // Use own email to prevent spam flagging
            to: `"CEO" <ceo@techandjamesconsult.com>`, // The email address to receive notifications
            subject: 'New Consultation Request',
            text: `New Form Submission\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nService of Interest: ${service}\n\nMessage:\n${message}`, // Plain text version
            html: `
                <h2>New Form Submission</h2>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Phone:</strong> ${phone}</p>
                <p><strong>Service of Interest:</strong> ${service}</p>
                <p><strong>Message:</strong><br>${message ? message.replace(/\n/g, '<br>') : 'No message provided.'}</p>
                <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;"><a href="mailto:${email}?subject=Re: Your Consultation Request" style="background-color: #00AEEF; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reply to ${name}</a></p>
            `
        };

        // Send the email but don't let it block the user response.
        transporter.sendMail(mailOptions)
            .then(info => {
                console.log('✅ Email notification sent successfully:', info.response);
            })
            .catch(emailError => {
                console.error('❌ Failed to send email notification:', emailError.message);
                if (emailError.code === 'EAUTH') {
                    console.error('   👉 Tip: Check your SMTP_USER and SMTP_PASS in the .env file.');
                    console.error('   👉 If using Gmail, make sure you are using an App Password, not your login password.');
                }
            });
 
        res.status(201).json({ message: 'Submission received successfully!' });
    } catch (error) {
        console.error('Error processing submission:', error);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});

// --- API Route to send a reply ---
app.post('/app-api/reply', authMiddleware, [
    body('submission_id', 'Submission ID is required').isInt(),
    body('to', 'Recipient email is required').isEmail(),
    body('message', 'Reply message cannot be empty').not().isEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { submission_id, to, message } = req.body;
    const subject = `Re: Your Consultation Request with Tech & James Consult`;

    const mailOptions = {
        from: `"Tech & James Consult" <ceo@techandjamesconsult.com>`,
        replyTo: 'ceo@techandjamesconsult.com',
        to: to, // The user's email address
        subject: subject,
        text: `Hello,\n\n${message}\n\nBest regards,\nThe Tech & James Consult Team`, // Plain text version
        html: `<p>Hello,</p><p>${message.replace(/\n/g, '<br>')}</p><p>Best regards,<br>The Tech & James Consult Team</p>`
    };

    try {
        // 1. Send the email
        await transporter.sendMail(mailOptions);
        console.log(`Reply sent successfully to: ${to}`);

        // 2. Save the reply to the messages table
        await pool.query( // Using pool.query directly is fine for single statements
            'INSERT INTO messages (submission_id, sender, body) VALUES ($1, $2, $3)',
            [submission_id, 'admin', message]
        );
        console.log(`Reply for submission ${submission_id} saved to database.`);

        res.status(200).json({ message: 'Reply sent successfully!' });
    } catch (error) {
        console.error('❌ EMAIL SENDING ERROR:', error);
        if (error.code === 'EAUTH') {
            console.error('   👉 Tip: Check your SMTP_USER and SMTP_PASS in the .env file.');
            console.error('   👉 If using Gmail, make sure you are using an App Password, not your login password.');
        }
        res.status(500).json({ message: `Failed to send reply email. Error: ${error.message}` });
    }
});

// --- API Route to get messages for a submission ---
app.get('/app-api/messages/:submissionId', authMiddleware, async (req, res) => {
    try {
        const { submissionId } = req.params;
        const result = await pool.query(
            'SELECT * FROM messages WHERE submission_id = $1 ORDER BY sent_at ASC',
            [submissionId]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Failed to fetch messages.' });
    }
});

// --- Serve Static Frontend Files (Moved after API routes to prevent conflicts) ---
app.use(express.static(path.join(__dirname)));

// Redirect favicon.ico requests to the new SVG favicon
app.get('/favicon.ico', (req, res) => {
    res.redirect('/favicon.svg');
});

// --- Catch-all route to serve index.html for any other GET request ---
// This must be the LAST route defined so it doesn't interfere with API routes.
// We use a regular expression to match any path that does NOT start with /api
// We updated the regex to match /app-api instead of /api
app.get(/^\/(?!app-api|images|css|js|webfonts|icons|assets|favicon.ico|.*\.png|.*\.jpg|.*\.html).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

async function startServer() {
    try {
        // Test the database connection
        const client = await pool.connect();
        console.log('✅ Supabase/PostgreSQL connected successfully.');
        client.release(); // Release the connection back to the pool

        // Check if SSL certificates are configured and the files actually exist
        if (isProduction && process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH && 
            fs.existsSync(process.env.SSL_KEY_PATH) && fs.existsSync(process.env.SSL_CERT_PATH)) {
            
            // Vercel handles SSL automatically, so we only run this block if NOT on Vercel
            if (!process.env.VERCEL) {
                const options = {
                    key: fs.readFileSync(process.env.SSL_KEY_PATH),
                    cert: fs.readFileSync(process.env.SSL_CERT_PATH)
                };

                // Create HTTPS Server on port 443
                https.createServer(options, app).listen(443, '0.0.0.0', () => {
                    console.log(`HTTPS Server is running on Port 443`);
                    console.log(`Public URL: https://techandjamesconsult.com`);
                });

                // Create HTTP Server on port 80 to redirect to HTTPS
                const httpApp = express();
                httpApp.get('*', (req, res) => {
                    // Strip port number if present to ensure clean redirect to default HTTPS port
                    const host = req.headers.host.split(':')[0];
                    res.redirect(`https://${host}${req.url}`);
                });
            
                httpApp.listen(80, '0.0.0.0', () => {
                    console.log('HTTP Server running on port 80 and redirecting to HTTPS');
                });
            }

        } else {
            // Fallback: Start standard HTTP server for development or if no SSL certs are provided
            const serverPort = isProduction ? 80 : PORT;
            app.listen(serverPort, '0.0.0.0', () => {
                if (isProduction) {
                    console.log('SSL certificates not found. Starting in HTTP mode on Port 80.');
                    console.log(`Public URL: http://techandjamesconsult.com`);
                } else {
                    console.log(`\n🚀 Local Server running at http://localhost:${serverPort}`);
                }
            });
        }
    } catch (err) {
        // Handle common database errors gracefully
        if (err.code === 'ECONNREFUSED' || 
           (err.name === 'AggregateError' && err.errors && err.errors.some(e => e.code === 'ECONNREFUSED'))) {
            console.error('\n❌ Database Connection Failed: Could not connect to Supabase.');
            console.error('   👉 Check your .env file to ensure DATABASE_URL is correct.');
        } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('\n❌ Database Authentication Failed: Access Denied.');
            console.error('   👉 Check your .env file for the correct DB_USER and DB_PASSWORD.');
        } else {
            console.error('❌ Server startup error:', err);
        }
        
        process.exit(1); // Exit the process with an error code
    }
}

// Only run startServer directly if this file is run via `node server.js`
// On Vercel, this file is imported, so we export the app instead.
if (require.main === module) {
    startServer();
}

module.exports = app;
