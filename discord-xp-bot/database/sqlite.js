// database/sqlite.js
const Database = require('better-sqlite3');
const { getLevelFromXP, getTotalXPForLevel } = require('../utils/levelSystem');

const db = new Database('db.sqlite');

function setupDatabase() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS guilds (
      guild_id TEXT PRIMARY KEY,
      log_channel_id TEXT,
      cooldown INTEGER DEFAULT 60,
      spamWindow INTEGER DEFAULT 10,
      spamCount INTEGER DEFAULT 5,
      level_up_message TEXT 
    )
  `).run();

  // --- MIGRATION (Sütun Ekleme) ---
  // Eğer eski bir veritabanı varsa ve 'level_up_message' sütunu yoksa, hata vermeden ekle.
  try {
    db.prepare("ALTER TABLE guilds ADD COLUMN level_up_message TEXT").run();
  } catch (error) {
    // Sütun zaten varsa hata verir, bunu görmezden geliyoruz (Expected behavior)
  }

  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT,
      guild_id TEXT,
      total_xp INTEGER DEFAULT 0,
      text_xp INTEGER DEFAULT 0,
      voice_xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 0,
      voice_level INTEGER DEFAULT 0,
      last_text_xp_gain INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, guild_id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS level_roles (
      role_id TEXT,
      guild_id TEXT,
      level INTEGER,
      PRIMARY KEY (role_id, guild_id)
    )
  `).run();
  
  db.prepare(`
    CREATE TABLE IF NOT EXISTS xp_history (
      user_id TEXT,
      guild_id TEXT,
      text_xp INTEGER DEFAULT 0,
      voice_xp INTEGER DEFAULT 0,
      timestamp INTEGER
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS xp_ignores (
      guild_id TEXT,
      target_id TEXT,
      type TEXT,
      PRIMARY KEY (guild_id, target_id)
    )
  `).run();
}
setupDatabase();

// --- YARDIMCI: GÜN BAŞLANGICI TIMESTAMP ---
function getDayStartTimestamp() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor(now.getTime() / 1000);
}

// --- Guild (Sunucu) Fonksiyonları ---
const getGuild = db.prepare("SELECT * FROM guilds WHERE guild_id = ?");

// GÜNCELLENDİ: level_up_message eklendi
const updateGuild = db.prepare(`
    REPLACE INTO guilds (guild_id, log_channel_id, cooldown, spamWindow, spamCount, level_up_message) 
    VALUES (@guild_id, @log_channel_id, @cooldown, @spamWindow, @spamCount, @level_up_message)
`);

function getGuildSettings(guildId) {
  let settings = getGuild.get(guildId);
  if (!settings) {
    // Varsayılan ayarlarda level_up_message null
    settings = { guild_id: guildId, log_channel_id: null, cooldown: 60, spamWindow: 10, spamCount: 5, level_up_message: null };
    updateGuild.run(settings);
  }
  return settings;
}

// --- Diğer Fonksiyonlar (AYNEN KALIYOR) ---
const deleteGuildStmt = db.prepare("DELETE FROM guilds WHERE guild_id = ?");
const deleteGuildRolesStmt = db.prepare("DELETE FROM level_roles WHERE guild_id = ?");
const deleteGuildIgnoresStmt = db.prepare("DELETE FROM xp_ignores WHERE guild_id = ?");
const resetGuildUsers = db.prepare("DELETE FROM users WHERE guild_id = ?");
const resetGuildHistory = db.prepare("DELETE FROM xp_history WHERE guild_id = ?");

function deleteGuildData(guildId) {
    deleteGuildStmt.run(guildId);
    resetGuildUsers.run(guildId);
    resetGuildHistory.run(guildId);
    deleteGuildRolesStmt.run(guildId);
    deleteGuildIgnoresStmt.run(guildId);
    console.log(`[DB] Sunucu verileri kalıcı olarak silindi: ${guildId}`);
}

const getUser = db.prepare("SELECT * FROM users WHERE user_id = ? AND guild_id = ?");
const createUser = db.prepare("INSERT INTO users (user_id, guild_id) VALUES (?, ?)");

function getUserStats(guildId, userId) {
  let user = getUser.get(userId, guildId);
  if (!user) {
    createUser.run(userId, guildId);
    user = getUser.get(userId, guildId);
  }
  return user;
}

const checkHistory = db.prepare("SELECT * FROM xp_history WHERE user_id = ? AND guild_id = ? AND timestamp = ?");
const insertHistory = db.prepare("INSERT INTO xp_history (user_id, guild_id, text_xp, voice_xp, timestamp) VALUES (?, ?, ?, ?, ?)");
const updateTextHistory = db.prepare("UPDATE xp_history SET text_xp = text_xp + ? WHERE user_id = ? AND guild_id = ? AND timestamp = ?");
const updateVoiceHistory = db.prepare("UPDATE xp_history SET voice_xp = voice_xp + ? WHERE user_id = ? AND guild_id = ? AND timestamp = ?");

const addXPStatement = db.prepare(`
  UPDATE users 
  SET 
    text_xp = text_xp + @xp, 
    total_xp = total_xp + @xp, 
    level = @newLevel,
    last_text_xp_gain = @now
  WHERE user_id = @userId AND guild_id = @guildId
`);

function addXP(guildId, userId, textXP) {
  const userStats = getUserStats(guildId, userId);
  const newTotalXP = userStats.total_xp + textXP;
  const newLevel = getLevelFromXP(newTotalXP);
  const oldLevel = userStats.level;
  const now = Date.now();

  addXPStatement.run({
    xp: textXP,
    newLevel: newLevel,
    now: now,
    userId: userId,
    guildId: guildId
  });
  
  const today = getDayStartTimestamp();
  const historyEntry = checkHistory.get(userId, guildId, today);

  if (historyEntry) {
    updateTextHistory.run(textXP, userId, guildId, today);
  } else {
    insertHistory.run(userId, guildId, textXP, 0, today);
  }

  return { oldLevel, newLevel };
}

const addVoiceXPStatement = db.prepare(`
  UPDATE users 
  SET voice_xp = voice_xp + @xp,
      voice_level = @newVoiceLevel
  WHERE user_id = @userId AND guild_id = @guildId
`);

function addVoiceXP(guildId, userId, voiceXP) {
  const userStats = getUserStats(guildId, userId);
  const currentVoiceXP = userStats.voice_xp || 0;
  const newTotalVoiceXP = currentVoiceXP + voiceXP;
  const newVoiceLevel = getLevelFromXP(newTotalVoiceXP);

  addVoiceXPStatement.run({
    xp: voiceXP,
    newVoiceLevel: newVoiceLevel,
    userId: userId,
    guildId: guildId
  });
  
  const today = getDayStartTimestamp();
  const historyEntry = checkHistory.get(userId, guildId, today);

  if (historyEntry) {
    updateVoiceHistory.run(voiceXP, userId, guildId, today);
  } else {
    insertHistory.run(userId, guildId, 0, voiceXP, today);
  }
}

const setLevelStatement = db.prepare(`
  UPDATE users 
  SET level = @newLevel, 
      text_xp = @newTextXP, 
      total_xp = @newTextXP 
  WHERE user_id = @userId AND guild_id = @guildId
`);

function setLevel(guildId, userId, newLevel) {
  const userStats = getUserStats(guildId, userId);
  const requiredXP = getTotalXPForLevel(newLevel);

  setLevelStatement.run({
    newLevel: newLevel,
    newTextXP: requiredXP,
    userId: userId,
    guildId: guildId
  });
  
  return { oldLevel: userStats.level };
}

function resetGuild(guildId) {
  resetGuildUsers.run(guildId);
  resetGuildHistory.run(guildId);
}

const getLeaderboardAllTime = db.prepare("SELECT user_id, text_xp AS total_xp FROM users WHERE guild_id = ? ORDER BY text_xp DESC LIMIT 10 OFFSET ?");

function getLeaderboard(guildId, options = { duration: 'alltime', page: 1 }) {
  const { duration, page } = options;
  const offset = (page - 1) * 10;

  if (duration === 'alltime') {
    return getLeaderboardAllTime.all(guildId, offset);
  }

  let timeLimit = 0;
  const now = Math.floor(Date.now() / 1000);
  if (duration === 'day') timeLimit = now - 86400;
  if (duration === 'week') timeLimit = now - 604800;
  if (duration === 'month') timeLimit = now - 2592000;

  const query = `
    SELECT user_id, SUM(text_xp) as total_xp_gained 
    FROM xp_history 
    WHERE guild_id = ? AND timestamp > ? 
    GROUP BY user_id 
    ORDER BY total_xp_gained DESC 
    LIMIT 10 OFFSET ?
  `;
  
  return db.prepare(query).all(guildId, timeLimit, offset);
}

const setRoleStmt = db.prepare("REPLACE INTO level_roles (role_id, guild_id, level) VALUES (?, ?, ?)");
const getRolesStmt = db.prepare("SELECT * FROM level_roles WHERE guild_id = ? AND level <= ?");

function setRoleReward(guildId, level, roleId) {
  setRoleStmt.run(roleId, guildId, level);
}

function getLevelRoles(guildId, level) {
  return getRolesStmt.all(guildId, level);
}

const getUserRankStmt = db.prepare(`
  SELECT COUNT(*) + 1 AS rank 
  FROM users 
  WHERE guild_id = ? AND text_xp > (SELECT text_xp FROM users WHERE user_id = ? AND guild_id = ?)
`);

function getUserRank(guildId, userId) {
  const result = getUserRankStmt.get(guildId, userId, guildId);
  return result ? result.rank : 1;
}

const addIgnoreStmt = db.prepare("REPLACE INTO xp_ignores (guild_id, target_id, type) VALUES (?, ?, ?)");
const removeIgnoreStmt = db.prepare("DELETE FROM xp_ignores WHERE guild_id = ? AND target_id = ?");
const getIgnoresStmt = db.prepare("SELECT * FROM xp_ignores WHERE guild_id = ?");

function addIgnore(guildId, targetId, type) {
  addIgnoreStmt.run(guildId, targetId, type);
}

function removeIgnore(guildId, targetId) {
  removeIgnoreStmt.run(guildId, targetId);
}

function getIgnores(guildId) {
  return getIgnoresStmt.all(guildId);
}

module.exports = {
  getGuild: getGuildSettings,
  updateGuild: updateGuild.run.bind(updateGuild), 
  getUserStats,
  addXP,
  addVoiceXP,
  setLevel,
  resetGuild,
  deleteGuildData,
  getLeaderboard,
  setRoleReward,
  getLevelRoles,
  getUserRank,
  addIgnore,
  removeIgnore,
  getIgnores
};