const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let db;

async function initDB() {
    db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS punishments (
            guild_id TEXT,
            user_id TEXT,
            old_name TEXT,
            old_roles TEXT,
            unpunish_at INTEGER,
            PRIMARY KEY (guild_id, user_id)
        );
        
        CREATE TABLE IF NOT EXISTS court_sessions (
            guild_id TEXT,
            stage_channel_id TEXT,
            accused_id TEXT,
            lawyer_id TEXT,
            accused_old_name TEXT,
            lawyer_old_name TEXT,
            PRIMARY KEY (guild_id, stage_channel_id)
        );
    `);
    
    // Add judge columns safely if they don't exist
    try {
        await db.exec(`ALTER TABLE court_sessions ADD COLUMN judge_id TEXT;`);
        await db.exec(`ALTER TABLE court_sessions ADD COLUMN judge_old_name TEXT;`);
    } catch (e) {
        // Ignore errors if columns already exist
    }
    
    console.log("Database initialized successfully!");
}

// Punishments
async function addPunishment(guildId, userId, oldName, oldRolesArray, unpunishAt) {
    const rolesStr = JSON.stringify(oldRolesArray || []);
    await db.run(
        `INSERT OR REPLACE INTO punishments (guild_id, user_id, old_name, old_roles, unpunish_at) VALUES (?, ?, ?, ?, ?)`,
        [guildId, userId, oldName, rolesStr, unpunishAt]
    );
}

async function getPunishments() {
    return await db.all(`SELECT * FROM punishments`);
}

async function removePunishment(guildId, userId) {
    await db.run(`DELETE FROM punishments WHERE guild_id = ? AND user_id = ?`, [guildId, userId]);
}

// Court Sessions
async function saveCourtSession(guildId, channelId, accusedId, lawyerId, accusedOldName, lawyerOldName, judgeId, judgeOldName) {
    await db.run(
        `INSERT OR REPLACE INTO court_sessions (guild_id, stage_channel_id, accused_id, lawyer_id, accused_old_name, lawyer_old_name, judge_id, judge_old_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [guildId, channelId, accusedId, lawyerId, accusedOldName, lawyerOldName, judgeId, judgeOldName]
    );
}

async function getCourtSession(guildId, channelId) {
    return await db.get(`SELECT * FROM court_sessions WHERE guild_id = ? AND stage_channel_id = ?`, [guildId, channelId]);
}

async function getGuildCourtSessions(guildId) {
    return await db.all(`SELECT * FROM court_sessions WHERE guild_id = ?`, [guildId]);
}

async function removeCourtSession(guildId, channelId) {
    await db.run(`DELETE FROM court_sessions WHERE guild_id = ? AND stage_channel_id = ?`, [guildId, channelId]);
}

module.exports = {
    initDB,
    addPunishment,
    getPunishments,
    removePunishment,
    saveCourtSession,
    getCourtSession,
    getGuildCourtSessions,
    removeCourtSession
};
