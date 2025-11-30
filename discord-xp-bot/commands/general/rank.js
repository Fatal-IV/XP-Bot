const { AttachmentBuilder } = require('discord.js');
const { generateRankCard } = require('../../utils/rankCard');

module.exports = {
  name: 'rank',
  description: 'Kendi XP ve seviye durumunuzu gösterir.',
  isAdmin: false,

  async execute(message, args, client, t, db) {
    const member = message.member;
    const userStats = db.getUser(member.id, message.guild.id);
    const rank = db.getUserRank(member.id, message.guild.id);

    if (!userStats) {
      return message.reply(t('commands.rank.noData'));
    }
    
    // Kart oluşturulurken gecikme olabilir
    await message.channel.sendTyping();

    try {
      const card = await generateRankCard(member, userStats, rank);
      await message.reply({ files: [card] });
    } catch (e) {
      console.error("Rank kartı hatası:", e);
      await message.reply(t('commands.rank.cardError'));
    }
  },
};