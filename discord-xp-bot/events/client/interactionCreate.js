// discord-xp-bot/events/client/interactionCreate.js (GÜNCELLENMİŞ)

const { Events, PermissionsBitField } = require('discord.js');
const { OWNER_ID } = require('../../config'); //

module.exports = {
  name: Events.InteractionCreate,
  
  async execute(interaction, client) {
    const db = client.db;
    const t = client.i18n.getFixedT(interaction.locale);

    // ... (Autocomplete ve Komut Bulma Mantığı) ...
    if (interaction.isAutocomplete() || !interaction.isChatInputCommand()) return;

    const command = client.slashCommands.get(interaction.commandName);
    if (!command) {
        console.error(`'${interaction.commandName}' komutu bulunamadı.`);
        return;
    }

    try {
      const isOwner = interaction.user.id === OWNER_ID;

      // ----------------------------------------------------
      // Kontroller SADECE BOT SAHİBİ DEĞİLSE çalışır
      // ----------------------------------------------------
      if (!isOwner) {
          
          let requiredPermission = null;

          // 1. ADIM: Komutta özel bir 'permissions' tanımı var mı?
          if (command.permissions) {
              requiredPermission = command.permissions;
          }
          // 2. ADIM: Özel tanım yoksa, 'isAdmin: true' varsayılanı kullanılsın mı?
          else if (command.isAdmin) {
              requiredPermission = PermissionsBitField.Flags.ManageGuild; // Varsayılan Yönetici yetkisi
          }

          // 3. ADIM: Yetki Kontrolü
          if (requiredPermission && !interaction.member.permissions.has(requiredPermission)) {
            return interaction.reply({ 
              content: t('common.noPermission'), 
              ephemeral: true 
            });
          }
          
          // 4. ADIM: COOLDOWN KONTROLÜ
          // ... (Cooldown mantığı, değişmiyor) ...
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
      }
      
      // Komutu Çalıştır
      await command.execute(interaction, client, t, db);

    } catch (error) {
      // ... (Hata Yakalama Mantığı) ...
    }
  },
};