const { Events } = require('discord.js');
const db = require('../../database/sqlite');
const { getRandomVoiceXP } = require('../../utils/levelSystem');

module.exports = {
  name: Events.VoiceStateUpdate,
  
  async execute(oldState, newState, client) {
    // Botları yoksay
    if (newState.member && newState.member.user.bot) return;

    const guildId = newState.guild.id;
    const userId = newState.id;

    // Kullanıcı bir ses kanalına katıldığında (veya kanal değiştirdiğinde)
    // Sadece "Giriş" anını yakalıyoruz. Döngü YOK.
    const joinedChannel = (!oldState.channelId || oldState.channelId === newState.guild.afkChannelId) && (newState.channelId);

    if (joinedChannel) {
      // --- YASAK KONTROLÜ (Ignore System) ---
      const ignores = db.getIgnores(guildId);
      
      // Kanal Yasağı
      if (newState.channelId) {
          const isChannelIgnored = ignores.some(i => i.type === 'channel' && i.target_id === newState.channelId);
          if (isChannelIgnored) return;
      }

      // Rol Yasağı
      if (newState.member) {
          const isRoleIgnored = ignores.some(i => i.type === 'role' && newState.member.roles.cache.has(i.target_id));
          if (isRoleIgnored) return;
      }
      
      // AFK Kanalı kontrolü
      if (newState.channelId === newState.guild.afkChannelId) return;

      // Cooldown Kontrolü (Giriş XP'si spamlanmasın diye)
      const joinCategory = 'xp:voice:join';
      if (client.cooldownManager.checkCooldown(joinCategory, userId)) return; 
      client.cooldownManager.setCooldown(joinCategory, userId, 60); // 60 saniye cooldown

      // Sadece giriş anında ufak bir XP verilir (Opsiyoneldir, teşvik için)
      const userStats = db.getUserStats(guildId, userId);
      const joinXP = getRandomVoiceXP(userStats.level); 
      
      // Not: Level atlama mesajı ses kanalında rahatsız edici olabileceği için sadece XP ekliyoruz
      db.addVoiceXP(guildId, userId, joinXP); 
      
      // Log (İsteğe bağlı, çok spam yaparsa kapatılabilir)
      // console.log(`[Ses Giriş] ${newState.member.displayName} kanala katıldı ve ${joinXP} XP kazandı.`);
    }
  },
};