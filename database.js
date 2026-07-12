const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'database.json');

let dbData = {
    punishments: [],
    court_sessions: []
};

async function initDB() {
    if (fs.existsSync(DB_FILE)) {
        try {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            dbData = JSON.parse(data);
        } catch (e) {
            console.error("Error reading database.json:", e);
        }
    } else {
        saveDB();
    }
    console.log("Database initialized successfully!");
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf8');
}

// Punishments
async function addPunishment(guildId, userId, oldName, oldRolesArray, unpunishAt) {
    const rolesStr = JSON.stringify(oldRolesArray || []);
    dbData.punishments = dbData.punishments.filter(p => !(p.guild_id === guildId && p.user_id === userId));
    dbData.punishments.push({
        guild_id: guildId,
        user_id: userId,
        old_name: oldName,
        old_roles: rolesStr,
        unpunish_at: unpunishAt
    });
    saveDB();
}

async function getPunishments() {
    return dbData.punishments;
}

async function removePunishment(guildId, userId) {
    dbData.punishments = dbData.punishments.filter(p => !(p.guild_id === guildId && p.user_id === userId));
    saveDB();
}

// Court Sessions
async function saveCourtSession(guildId, channelId, accusedId, lawyerId, accusedOldName, lawyerOldName, judgeId, judgeOldName) {
    dbData.court_sessions = dbData.court_sessions.filter(c => !(c.guild_id === guildId && c.stage_channel_id === channelId));
    dbData.court_sessions.push({
        guild_id: guildId,
        stage_channel_id: channelId,
        accused_id: accusedId,
        lawyer_id: lawyerId,
        accused_old_name: accusedOldName,
        lawyer_old_name: lawyerOldName,
        judge_id: judgeId,
        judge_old_name: judgeOldName
    });
    saveDB();
}

async function getCourtSession(guildId, channelId) {
    return dbData.court_sessions.find(c => c.guild_id === guildId && c.stage_channel_id === channelId);
}

async function getGuildCourtSessions(guildId) {
    return dbData.court_sessions.filter(c => c.guild_id === guildId);
}

async function removeCourtSession(guildId, channelId) {
    dbData.court_sessions = dbData.court_sessions.filter(c => !(c.guild_id === guildId && c.stage_channel_id === channelId));
    saveDB();
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
