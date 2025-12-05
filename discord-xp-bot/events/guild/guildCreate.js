// discord-xp-bot/events/guild/guildCreate.js

const { Events, EmbedBuilder, Colors, ChannelType } = require('discord.js');
const { GUILD_LOG_CHANNEL_ID } = require('../../config'); //

module.exports = {
  name: Events.GuildCreate,

  async execute(guild, client) {
    const db = client.db;
    const t = client.i18n.getFixedT('tr'); // Log her zaman TR veya EN gönderilebilir, şimdilik TR seçildi

    try {
      // 1. Yeni Sunucuya Hoş Geldiniz Mesajı (Mevcut kodunuzdan)
      const owner = await guild.members.fetch(guild.ownerId).catch(() => null);

      if (owner) {
        const embed = new EmbedBuilder()
          .setColor(Colors.Green)
          .setDescription(t('events.guildCreate.setupDM', { guildName: guild.name }));
        
        // Sunucu sahibine DM gönderme
        owner.send({ embeds: [embed] }).catch(() => {
            // Eğer DM engelliyse, sunucudaki ilk kanala mesaj göndermeyi deneyin
            const defaultChannel = guild.channels.cache.find(channel => 
                channel.type === ChannelType.GuildText && 
                channel.permissionsFor(guild.members.me).has('SendMessages')
            );
            if (defaultChannel) {
                const publicEmbed = new EmbedBuilder()
                    .setColor(Colors.Green)
                    .setDescription(t('events.guildCreate.setupPublic', { ownerTag: owner.user.tag }));
                defaultChannel.send({ embeds: [publicEmbed] }).catch(() => {});
            }
        });
      }
      
      // 2. SUNUCU LOG KISMI (YENİ)
      if (GUILD_LOG_CHANNEL_ID) {
        const logChannel = client.channels.cache.get(GUILD_LOG_CHANNEL_ID);
        
        if (logChannel) {
            let inviteLink = 'Davet bağlantısı oluşturulamadı.';
            
            // Davet bağlantısı oluşturma (Botun davet yetkisi olan ilk kanalda)
            const channelWithInvitePerms = guild.channels.cache.find(channel => 
                channel.type === ChannelType.GuildText && 
                channel.permissionsFor(guild.members.me).has('CreateInstantInvite')
            );

            if (channelWithInvitePerms) {
                try {
                    const invite = await channelWithInvitePerms.createInvite({
                        maxAge: 0, // Süresiz
                        maxUses: 0, // Sınırsız
                        reason: 'Botun sunucu logu için bağlantı oluşturuldu.'
                    });
                    inviteLink = invite.url;
                } catch (e) {
                    inviteLink = 'Bağlantı oluşturulurken hata oluştu.';
                }
            }

            const logEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(`🟢 Yeni Sunucuya Katıldı!`)
                .setDescription(`Bot, **${guild.name}** sunucusuna katıldı.`)
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .addFields(
                    { name: 'Sunucu Adı', value: guild.name, inline: true },
                    { name: 'Sunucu ID', value: `\`${guild.id}\``, inline: true },
                    { name: 'Üye Sayısı', value: `\`${guild.memberCount}\``, inline: true },
                    { name: 'Sahip', value: owner ? owner.user.tag : 'Bilinmiyor', inline: true },
                    { name: 'Sahip ID', value: `\`${guild.ownerId}\``, inline: true },
                    { name: 'Davet Linki', value: `[Bağlan](${inviteLink})`, inline: false }
                )
                .setTimestamp();

            logChannel.send({ embeds: [logEmbed] }).catch(err => console.error("Log kanalı hatası:", err));
        }
      }

    } catch (error) {
      console.error('guildCreate eventinde hata:', error);
    }
  },
};