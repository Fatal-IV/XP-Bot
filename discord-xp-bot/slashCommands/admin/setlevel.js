const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlevel')
    .setNameLocalizations({ tr: 'seviyeayarla' })
    .setDescription('Manually sets a user\'s level.')
    .setDescriptionLocalizations({ tr: 'Bir kullanıcının seviyesini manuel olarak ayarlar.' })
    .addUserOption(option =>
      option.setName('user')
        .setNameLocalizations({ tr: 'kullanıcı' })
        .setDescription('The user whose level you want to set.')
        .setDescriptionLocalizations({ tr: 'Seviyesini ayarlamak istediğiniz kullanıcı.' })
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('level')
        .setNameLocalizations({ tr: 'seviye' })
        .setDescription('The new level you want to set.')
        .setDescriptionLocalizations({ tr: 'Ayarlamak istediğiniz yeni seviye.' })
        .setMinValue(0) 
        .setRequired(true)
    ),
  isAdmin: true,

  async execute(interaction, client, t, db) {
    // Sadece 'Manage Server' yetkisi olanlar
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: t('common.noPermission'), ephemeral: true });
    }
    
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user');
    const newLevel = interaction.options.getInteger('level');
    
    // --- KRİTİK DÜZELTME: targetUser'ın varlığını kontrol et ---
    if (!targetUser) {
        // Eğer kullanıcı bulunamazsa (null ise) hata mesajı döndür.
        return interaction.editReply({ content: t('commands.rank.userNotFound') });
    }
    // --- DÜZELTME SONU ---

    const guildId = interaction.guild.id;

    if (targetUser.bot) {
      return interaction.editReply({ content: t('commands.setlevel.isBot') });
    }

    try {
      // targetUser.id artık güvenli bir şekilde okunabilir
      const { oldLevel } = db.setLevel(guildId, targetUser.id, newLevel);
      
      await interaction.editReply({
        content: t('commands.setlevel.success', { 
          user: targetUser.username, 
          oldLevel: oldLevel, 
          newLevel: newLevel 
        })
      });
    } catch (error) {
      console.error("Setlevel hatası:", error);
      await interaction.editReply({ content: t('common.commandError') });
    }
  },
};