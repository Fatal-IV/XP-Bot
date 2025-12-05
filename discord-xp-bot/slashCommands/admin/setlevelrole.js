const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlevelrole')
    .setNameLocalizations({ tr: 'seviyerolü' })
    .setDescription('Assigns a role to be given at a specific level.')
    .setDescriptionLocalizations({ tr: 'Belirli bir seviyede verilecek rolü ayarlar.' })
    .addIntegerOption(option =>
      option.setName('level')
        .setNameLocalizations({ tr: 'seviye' })
        .setDescription('The level to achieve.')
        .setDescriptionLocalizations({ tr: 'Ulaşılması gereken seviye.' })
        .setMinValue(1)
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName('role')
        .setNameLocalizations({ tr: 'rol' })
        .setDescription('The role to be awarded.')
        .setDescriptionLocalizations({ tr: 'Kazanılacak rol.' })
        .setRequired(true)
    ),
  isAdmin: true,
  async execute(interaction, client, t, db) {
    const level = interaction.options.getInteger('level');
    const role = interaction.options.getRole('role');

    // Botun rol hiyerarşisini kontrol et
    if (role.position >= interaction.guild.members.me.roles.highest.position) {
      return interaction.reply({
        content: t('setlevelrole.hierarchyError'),
        ephemeral: true
      });
    }

    db.setRoleReward(interaction.guild.id, level, role.id);

    await interaction.reply({
      content: t('setlevelrole.success', { level: level, role: role.toString() }),
      ephemeral: true
    });
  },
};