const { SlashCommandBuilder, ChannelType, PermissionsBitField } = require('discord.js'); // Düzeltme 1: PermissionsBitField eklendi

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlog')
    .setNameLocalizations({ tr: 'logayarla' })
    .setDescription('Sets the channel for level up notifications.')
    .setDescriptionLocalizations({ tr: 'Seviye atlama bildirimleri için kanalı ayarlar.' })
    .addChannelOption(option =>
      option.setName('channel')
        .setNameLocalizations({ tr: 'kanal' })
        .setDescription('The text channel for notifications.')
        .setDescriptionLocalizations({ tr: 'Bildirimler için metin kanalı.' })
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),
  isAdmin: true,
  async execute(interaction, client, t, db) {
    // Düzeltme 2: Yetki kontrolü eklendi
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: t('common.noPermission'), ephemeral: true });
    }
    const channel = interaction.options.getChannel('channel');
    
    // Düzeltme 3: Hatalı db.updateGuild çağrısı düzeltildi
    const currentSettings = db.getGuild(interaction.guild.id);
    currentSettings.log_channel_id = channel.id;
    
    db.updateGuild(currentSettings); // Artık tek bir obje gönderiyor

    await interaction.reply({
      content: t('commands.setlog.success', { channel: channel.toString() }),
      ephemeral: true
    });
  },
};