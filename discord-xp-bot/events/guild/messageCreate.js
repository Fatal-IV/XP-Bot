const { Events } = require('discord.js');
const { getRandomTextXP } = require('../../utils/levelSystem');
const db = require('../../database/sqlite');
const { SPAM_WINDOW_SECONDS, SPAM_MESSAGE_COUNT } = require('../../config');

const userSpamTrackers = new Map(); 

// --- GÜVENLİK YAMASI: BELLEK TEMİZLİĞİ ---
// Her 5 dakikada bir (300000 ms), süresi dolmuş spam kayıtlarını temizle.
// Bu işlem, botun RAM kullanımının zamanla şişmesini (Memory Leak) engeller.
setInterval(() => {
  const now = Date.now();
  const expirationTime = SPAM_WINDOW_SECONDS * 1000;
  
  for (const [userId, data] of userSpamTrackers) {
    if (now - data.startTime > expirationTime) {
      userSpamTrackers.delete(userId);
    }
  }
}, 5 * 60 * 1000); // 5 Dakika

module.exports = {
  name: Events.MessageCreate,

  async execute(message, client) {
    if (message.author.bot || !message.guild) return; 

    const guildId = message.guild.id;
    const userId = message.author.id;
    
    // --- 1. YASAK KONTROLÜ (Ignore System) ---
    const ignores = db.getIgnores(guildId);
    
    const isChannelIgnored = ignores.some(i => i.type === 'channel' && i.target_id === message.channel.id);
    if (isChannelIgnored) return;

    const isRoleIgnored = ignores.some(i => i.type === 'role' && message.member.roles.cache.has(i.target_id));
    if (isRoleIgnored) return;
    
    const now = Date.now();
    const guildConfig = db.getGuild(guildId);
    
    // --- 2. SPAM KORUMASI ---
    if (!userSpamTrackers.has(userId)) {
      userSpamTrackers.set(userId, { count: 1, startTime: now });
    } else {
      const userData = userSpamTrackers.get(userId);
      if (now - userData.startTime < SPAM_WINDOW_SECONDS * 1000) {
        userData.count++;
        if (userData.count > SPAM_MESSAGE_COUNT) return; 
      } else {
        // Süre dolduysa sayacı sıfırla ve zamanı güncelle
        userData.count = 1;
        userData.startTime = now;
      }
    }
    
    // --- 3. COOLDOWN KONTROLÜ ---
    const cooldownTime = guildConfig.cooldown || 60;
    const userStats = db.getUserStats(guildId, userId);
    
    const category = 'xp:text';

    if (client.cooldownManager.checkCooldown(category, userId)) {
      return; 
    }

    // --- 4. XP VERME VE LEVEL ATLAMA ---
    const newXP = getRandomTextXP(userStats.level);
    const { oldLevel, newLevel } = db.addXP(guildId, userId, newXP); 

    client.cooldownManager.setCooldown(category, userId, cooldownTime);
    
    // Seviye atladı mı?
    if (newLevel > oldLevel) {
      try {
        const logChannelId = guildConfig.log_channel_id;
        const logChannel = logChannelId ? client.channels.cache.get(logChannelId) : null;
        
        // --- ÖZEL MESAJ MANTIĞI ---
        const t = client.i18n.getFixedT(message.guild.preferredLocale || 'en');
        let levelUpMsg;

        if (guildConfig.level_up_message) {
            levelUpMsg = guildConfig.level_up_message
                .replace(/{user}/g, message.author.toString())
                .replace(/{level}/g, newLevel)
                .replace(/{guild}/g, message.guild.name);
        } else {
            levelUpMsg = t('events.levelUp.message', {
                user: message.author.toString(),
                level: newLevel
            });
        }

        const targetChannel = logChannel || message.channel;

        await targetChannel.send({
            content: levelUpMsg,
            allowedMentions: { users: [message.author.id] }
        });
        
        // Rol Ödüllerini Ver
        const rolesToAward = db.getLevelRoles(guildId, newLevel);
        if (rolesToAward.length > 0) {
          rolesToAward.forEach(roleData => {
            const role = message.guild.roles.cache.get(roleData.role_id);
            if (role && !message.member.roles.cache.has(role.id)) {
              message.member.roles.add(role).catch(e => console.error(`Rol verilemedi: ${e.message}`));
            }
          });
        }

      } catch (err) {
        console.error(`XP verme hatası: ${err.message}`);
      }
    }
  },
};