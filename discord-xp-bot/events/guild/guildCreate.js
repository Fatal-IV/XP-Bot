const { Events, PermissionsBitField } = require('discord.js');

module.exports = {
  name: Events.GuildCreate,
  async execute(guild, client) {
    const t = client.i18n.getFixedT('en'); // Varsayılan dil (henüz ayar yok)

    let sent = false;

    // 1. Sunucu sahibine DM göndermeyi dene
    try {
      const owner = await guild.fetchOwner();
      if (owner) {
        await owner.send(t('events.guildCreate.setupDM', { guildName: guild.name }));
        sent = true;
      }
    } catch (e) {
      console.log(`DM gönderilemedi: ${guild.ownerId}`);
    }

    // 2. DM başarısız olduysa veya ekleyen kişi bulunamadıysa (ki bu eventte zor)
    // Sunucuda konuşabildiği ilk kanalı bulup oraya mesaj atsın.
    if (!sent) {
      const channel = guild.channels.cache.find(
        (c) =>
          c.type === 0 && // TextChannel
          c.permissionsFor(guild.members.me).has(PermissionsBitField.Flags.SendMessages)
      );

      if (channel) {
        try {
          await channel.send(t('events.guildCreate.setupPublic', { ownerTag: `<@${guild.ownerId}>` }));
        } catch (e) {
           console.log("Kurulum mesajı genel kanala da gönderilemedi.");
        }
      }
    }
  },
};