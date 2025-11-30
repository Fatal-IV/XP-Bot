const { 
  SlashCommandBuilder, 
  ChannelType, 
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder, 
  PermissionsBitField, 
  EmbedBuilder, 
  MessageFlags,
  ComponentType 
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setNameLocalizations({ tr: 'kurulum' })
    .setDescription('Starts the initial setup for the XP bot.')
    .setDescriptionLocalizations({ tr: 'XP botu için ilk kurulumu başlatır.' }),
  isAdmin: true,

  async execute(interaction, client, t, db) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: t('common.noPermission'), flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guild.id;
    const currentSettings = db.getGuild(guildId); 
    const DEFAULT_COOLDOWN = 60;

    // Zaten kurulu mu kontrolü
    if (currentSettings.log_channel_id) {
         return interaction.reply({ 
             content: "Bu sunucuda kurulum zaten tamamlanmış. Ayarları değiştirmek için `/settings`, `/setlog` veya `/setcooldown` komutlarını kullanabilirsiniz.",
             flags: MessageFlags.Ephemeral 
         });
    }

    const embed = new EmbedBuilder()
      .setTitle(t('commands.setup.title'))
      .setDescription(t('commands.setup.startPrompt'))
      .setColor('#5865F2');

    const yesButton = new ButtonBuilder()
      .setCustomId('setup_yes')
      .setLabel(t('common.yes'))
      .setStyle(ButtonStyle.Success);

    const noButton = new ButtonBuilder()
      .setCustomId('setup_no')
      .setLabel(t('common.no'))
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(yesButton, noButton);

    const response = await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: MessageFlags.Ephemeral,
      withResponse: true
    });

    const message = response.resource ? response.resource.message : response;

    const buttonCollector = message.createMessageComponentCollector({ 
        componentType: ComponentType.Button, 
        time: 60000 
    });

    buttonCollector.on('collect', async (i) => {
      if (i.customId === 'setup_no') {
        await i.update({ content: t('commands.setup.cancelled'), embeds: [], components: [] });
        return;
      }

      if (i.customId === 'setup_yes') {
        await i.update({ 
            content: t('commands.setup.askChannel'), 
            embeds: [], 
            components: [] 
        });
        
        // Kanal Bekleme
        const channelCollector = interaction.channel.createMessageCollector({
          filter: m => m.author.id === interaction.user.id,
          max: 1,
          time: 60000
        });

        channelCollector.on('collect', async (msg) => {
          const collectedChannel = msg.mentions.channels.first(); // Sadece mention edilen kanalı al
          
          // Mesajı temizle
          try { await msg.delete(); } catch(e) {}

          if (!collectedChannel || collectedChannel.type !== ChannelType.GuildText) {
            await i.followUp({ content: t('commands.setup.invalidChannel'), flags: MessageFlags.Ephemeral });
            return;
          }

          await i.followUp({ 
              content: t('commands.setup.askCooldown', { default: DEFAULT_COOLDOWN }), 
              flags: MessageFlags.Ephemeral 
          });

          // Cooldown Bekleme
          const cooldownCollector = interaction.channel.createMessageCollector({
            filter: m => m.author.id === interaction.user.id,
            max: 1,
            time: 60000
          });

          cooldownCollector.on('collect', async (msg2) => {
            const content = msg2.content.trim();
            const cooldown = parseInt(content, 10);
            
            try { await msg2.delete(); } catch(e) {}

            if (isNaN(cooldown) || cooldown < 10) {
              await i.followUp({ content: t('commands.setup.invalidCooldown'), flags: MessageFlags.Ephemeral });
              return;
            }

            try {
              // --- DÜZELTME BURADA ---
              // updateGuild fonksiyonu artık level_up_message parametresini de bekliyor.
              // Mevcut ayarı korumak için currentSettings.level_up_message değerini geçiriyoruz.
              const newSettings = {
                guild_id: guildId,
                log_channel_id: collectedChannel.id,
                cooldown: cooldown,
                spamWindow: currentSettings.spamWindow,
                spamCount: currentSettings.spamCount,
                level_up_message: currentSettings.level_up_message // EKLENDİ
              };

              db.updateGuild(newSettings);
            
              await i.followUp({
                content: t('commands.setup.success'),
                flags: MessageFlags.Ephemeral
              });
              
              const logChannel = client.channels.cache.get(collectedChannel.id);
              if (logChannel) {
                logChannel.send(t('commands.setup.testMessage', {
                    user: interaction.user.toString(),
                    channel: collectedChannel.toString()
                })).catch(() => {
                    i.followUp({ content: t('commands.setup.testMessageError'), flags: MessageFlags.Ephemeral });
                });
              }

            } catch (dbError) {
              console.error("Setup veritabanı hatası:", dbError);
              await i.followUp({ content: t('common.commandError'), flags: MessageFlags.Ephemeral });
            }
          });
        });
      }
    });

    buttonCollector.on('end', (collected, reason) => {
      if (reason === 'time') {
        interaction.editReply({ content: t('common.timeout'), embeds: [], components: [] }).catch(() => {});
      }
    });
  },
};