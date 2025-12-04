const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionsBitField, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetxp')
    .setNameLocalizations({ tr: 'xpsıfırla' })
    .setDescription('Resets ALL XP and level data for this server.')
    .setDescriptionLocalizations({ tr: 'Bu sunucudaki TÜM XP ve seviye verilerini sıfırlar.' }),
  isAdmin: true,
  
  async execute(interaction, client, t, db) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: t('common.noPermission'), flags: MessageFlags.Ephemeral });
    }
    
    const confirmButton = new ButtonBuilder()
      .setCustomId('resetxp_confirm')
      .setLabel(t('commands.resetxp.confirmButton'))
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId('resetxp_cancel')
      .setLabel(t('common.no'))
      .setStyle(ButtonStyle.Secondary);
      
    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    // DEPRECATION FIX: fetchReply -> withResponse, ephemeral -> flags
    const response = await interaction.reply({
      content: t('commands.resetxp.confirmMessage'),
      components: [row],
      flags: MessageFlags.Ephemeral,
      withResponse: true, 
    });

    const message = response.resource ? response.resource.message : response;

    try {
      const confirmation = await message.awaitMessageComponent({ 
        filter: (i) => i.user.id === interaction.user.id, 
        time: 15000 
      });

      if (confirmation.customId === 'resetxp_confirm') {
        await confirmation.update({ content: t('commands.resetxp.loading'), components: [] });
        db.resetGuild(interaction.guild.id);
        
        await confirmation.editReply({
          content: t('commands.resetxp.success')
        });
      } 
      else if (confirmation.customId === 'resetxp_cancel') {
        await confirmation.update({ 
          content: t('commands.resetxp.cancelled'), 
          components: [] 
        });
      }
    } catch (e) {
      await interaction.editReply({ 
        content: t('common.timeout'), 
        components: [] 
      });
    }
  },
};