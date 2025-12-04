const { Events, PermissionsBitField } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  
  async execute(interaction, client) {
    const db = client.db;
    const t = client.i18n.getFixedT(interaction.locale);

    // --- Düzeltme 1: Autocomplete (Otomatik Tamamlama) Desteği ---
    if (interaction.isAutocomplete()) {
      const command = client.slashCommands.get(interaction.commandName);
      if (!command) {
        console.error(`Autocomplete için '${interaction.commandName}' komutu bulunamadı.`);
        return;
      }
      try {
        if (command.autocomplete) {
          await command.autocomplete(interaction, client);
        }
      } catch (error) {
        console.error(`Autocomplete hatası (${interaction.commandName}):`, error);
      }
      return; // Autocomplete ise komut çalıştırmayı durdur
    }
    // --- Düzeltme Sonu ---


    // Sadece slash komutlarını işle
    if (!interaction.isChatInputCommand()) return;

    const command = client.slashCommands.get(interaction.commandName);
    if (!command) {
      console.error(`'${interaction.commandName}' komutu bulunamadı.`);
      return;
    }

    try {
      const defaultCooldown = 5;
      const commandCooldownSeconds = command.cooldown || defaultCooldown; 
      const category = `command:${command.data.name}`; 

      const timeLeft = client.cooldownManager.checkCooldown(category, interaction.user.id);
      if (timeLeft) {
        return interaction.reply({
          content: t('common.cooldown', { seconds: timeLeft }),
          ephemeral: true
        });
      }
      
      client.cooldownManager.setCooldown(category, interaction.user.id, commandCooldownSeconds);

      if (command.isAdmin && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.reply({ 
          content: t('common.noPermission'), 
          ephemeral: true 
        });
      }
      
      await command.execute(interaction, client, t, db);

    } catch (error) {
      console.error(`'${command.data.name}' komutu çalıştırılırken hata:`, error);
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ 
          content: t('common.commandError'), 
          ephemeral: true 
        });
      } else {
        await interaction.reply({ 
          content: t('common.commandError'), 
          ephemeral: true 
        });
      }
    }
  },
};