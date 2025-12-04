const { Events, ChannelType } = require('discord.js');
const db = require('../../database/sqlite');
const { VOICE_XP_INTERVAL_MINUTES } = require('../../config');
const { getRandomVoiceXP } = require('../../utils/levelSystem');
const logger = require('../../utils/logger');
const chalk = require('chalk');
const Table = require('cli-table3');

// Dakikayı milisaniyeye çevir
const XP_INTERVAL = VOICE_XP_INTERVAL_MINUTES * 60 * 1000; 

module.exports = {
  name: Events.ClientReady,
  once: true,
  
  async execute(client) {
    
    // --- DASHBOARD OLUŞTURMA ---
    const userCount = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
    const guildCount = client.guilds.cache.size;
    const botTag = client.user.tag;
    
    const dashboard = new Table({
        head: [chalk.white('İstatistik'), chalk.white('Değer')],
        colWidths: [20, 40]
    });

    dashboard.push(
        [chalk.cyan('Bot Kullanıcısı'), chalk.bold(botTag)],
        [chalk.cyan('Sunucu Sayısı'), guildCount],
        [chalk.cyan('Toplam Kullanıcı'), userCount],
        [chalk.cyan('Ses XP Aralığı'), `${VOICE_XP_INTERVAL_MINUTES} Dakika`],
        [chalk.cyan('Durum'), chalk.bgGreen.black(' ÇEVRİMİÇİ ')]
    );

    console.log(dashboard.toString());
    logger.success(`${client.user.username} göreve hazır!`);
    
    // --- MASTER VOICE XP LOOP (ANA SES DÖNGÜSÜ) ---
    logger.info(`Master Ses Döngüsü başlatılıyor...`);

    setInterval(async () => {
      // Botun bulunduğu tüm sunucuları gez
      for (const guild of client.guilds.cache.values()) {
        try {
          // ... (Buradaki Ses XP mantığı aynen kalacak, sadece console.log yerine logger kullan)
          
          const guildConfig = db.getGuild(guild.id);
          if (!guildConfig) continue; 
          const ignores = db.getIgnores(guild.id);
          const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice);

          for (const channel of voiceChannels.values()) {
            if (channel.id === guild.afkChannelId) continue;
            const isChannelIgnored = ignores.some(i => i.type === 'channel' && i.target_id === channel.id);
            if (isChannelIgnored) continue;

            for (const member of channel.members.values()) {
              if (member.user.bot) continue;
              if (member.voice.selfMute || member.voice.selfDeaf || member.voice.serverMute || member.voice.serverDeaf) continue;
              
              const isRoleIgnored = ignores.some(i => i.type === 'role' && member.roles.cache.has(i.target_id));
              if (isRoleIgnored) continue;

              // XP DAĞITIMI
              try {
                const userStats = db.getUserStats(guild.id, member.id);
                const xpAmount = getRandomVoiceXP(userStats.level);
                db.addVoiceXP(guild.id, member.id, xpAmount);
                
                // Geliştirme modunda görmek istersen:
                // logger.info(`${member.displayName} -> +${xpAmount} XP (Ses)`);
                 
              } catch (err) {
                logger.error(`${member.displayName} XP hatası: ${err.message}`);
              }
            }
          }
        } catch (guildError) {
          logger.error(`Sunucu tarama hatası: ${guild.name} - ${guildError.message}`);
        }
      }
    }, XP_INTERVAL);
  },
};