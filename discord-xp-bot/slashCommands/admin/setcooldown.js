const { SlashCommandBuilder, PermissionsBitField } = require('discord.js'); // Düzeltme 1: PermissionsBitField eklendi

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setcooldown')
    .setNameLocalizations({ tr: 'beklemesüresi' })
    .setDescription('Sets the XP cooldown time (in seconds) after gaining text XP.')
    .setDescriptionLocalizations({ tr: 'Metin XP\'si kazandıktan sonraki bekleme süresini (saniye) ayarlar.' })
    .addIntegerOption(option =>
      option.setName('seconds')
        .setNameLocalizations({ tr: 'saniye' })
        .setDescription('The cooldown duration in seconds (min 10).')
        .setDescriptionLocalizations({ tr: 'Bekleme süresi (min 10 saniye).' })
        .setMinValue(10)
        .setRequired(true)
    ),
  isAdmin: true,
  async execute(interaction, client, t, db) {
    // Düzeltme 2: Yetki kontrolü eklendi
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: t('common.noPermission'), ephemeral: true });
    }
    const seconds = interaction.options.getInteger('seconds');
    
    // Düzeltme 3: Hatalı db.updateGuild çağrısı düzeltildi
    const currentSettings = db.getGuild(interaction.guild.id);
    currentSettings.cooldown = seconds;
    
    db.updateGuild(currentSettings); // Artık tek bir obje gönderiyor

    await interaction.reply({
      content: t('commands.setcooldown.success', { seconds: seconds }),
      ephemeral: true
    });
  },
};