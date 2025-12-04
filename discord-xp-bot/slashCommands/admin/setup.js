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

// DÜZELTME 1: client parametresi eklendi
async function startSetupFlow(interaction, client, t, db, currentSettings, defaultCooldown) {
    const guildId = interaction.guild.id;

    const embed = new EmbedBuilder()
      .setTitle(t('commands.setup.title'))
      .setDescription(t('commands.setup.startPrompt'))
      .setColor('#5865F2');

    const yesButton = new ButtonBuilder()
      .setCustomId('setup_yes_start') 
      .setLabel(t('common.yes'))
      .setStyle(ButtonStyle.Success);

    const noButton = new ButtonBuilder()
      .setCustomId('setup_no_start') 
      .setLabel(t('common.no'))
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(yesButton, noButton);

    const response = await interaction.editReply({ 
      embeds: [embed],
      components: [row],
      content: " ", 
    });

    const buttonCollector = response.createMessageComponentCollector({ 
        componentType: ComponentType.Button, 
        time: 60000 
    });

    buttonCollector.on('collect', async (i) => {
      // Sadece bu interaksiyonu başlatan kişi yanıt verebilir.
      if (i.user.id !== interaction.user.id) {
          await i.reply({ content: t('common.noPermission'), ephemeral: true });
          return;
      }
      
      if (i.customId === 'setup_no_start') {
        await i.update({ content: t('commands.setup.cancelled'), embeds: [], components: [] });
        buttonCollector.stop();
        return;
      }

      if (i.customId === 'setup_yes_start') {
        await i.update({ 
            content: t('commands.setup.askChannel'), 
            embeds: [], 
            components: [] 
        });
        buttonCollector.stop(); 

        // Kanal Bekleme
        const channelCollector = interaction.channel.createMessageCollector({
          filter: m => m.author.id === interaction.user.id,
          max: 1,
          time: 60000
        });

        channelCollector.on('collect', async (msg) => {
          const collectedChannel = msg.mentions.channels.first(); 
          
          try { await msg.delete(); } catch(e) {}

          if (!collectedChannel || collectedChannel.type !== ChannelType.GuildText) {
            await interaction.followUp({ content: t('commands.setup.invalidChannel'), flags: MessageFlags.Ephemeral });
            channelCollector.stop();
            return;
          }

          await interaction.followUp({ 
              content: t('commands.setup.askCooldown', { default: defaultCooldown }), 
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
              await interaction.followUp({ content: t('commands.setup.invalidCooldown'), flags: MessageFlags.Ephemeral });
              cooldownCollector.stop();
              return;
            }

            try {
              // Veritabanına yeni ayarları kaydet
              const newSettings = {
                guild_id: guildId,
                log_channel_id: collectedChannel.id,
                cooldown: cooldown,
                spamWindow: currentSettings.spamWindow || 10,
                spamCount: currentSettings.spamCount || 5,
                level_up_message: currentSettings.level_up_message 
              };

              db.updateGuild(newSettings);
            
              await interaction.followUp({
                content: t('commands.setup.success'),
                flags: MessageFlags.Ephemeral
              });
              
              // client kullanılarak log kanalı bulundu
              const logChannel = client.channels.cache.get(collectedChannel.id); 
              if (logChannel) {
                logChannel.send(t('commands.setup.testMessage', {
                    user: interaction.user.toString(),
                    channel: collectedChannel.toString()
                })).catch(() => {
                    interaction.followUp({ content: t('commands.setup.testMessageError'), flags: MessageFlags.Ephemeral });
                });
              }

            } catch (dbError) {
              console.error("Setup veritabanı hatası:", dbError);
              await interaction.followUp({ content: t('common.commandError'), flags: MessageFlags.Ephemeral });
            }
          });
          
          cooldownCollector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.followUp({ content: t('common.timeout'), flags: MessageFlags.Ephemeral });
            }
          });
        });

        channelCollector.on('end', (collected, reason) => {
          if (reason === 'time') {
              interaction.followUp({ content: t('common.timeout'), flags: MessageFlags.Ephemeral });
          }
        });
      }
    });

    buttonCollector.on('end', (collected, reason) => {
      if (reason === 'time') {
        interaction.editReply({ content: t('common.timeout'), embeds: [], components: [] }).catch(() => {});
      }
    });
}


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
    
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });


    // --- KURULUM KONTROLÜ VE ONAYI ---
    if (currentSettings.log_channel_id) {
        
        const existingLogChannel = `<#${currentSettings.log_channel_id}>`;
        const existingCooldown = currentSettings.cooldown;
        
        const settingsList = t('commands.setup.settingsLogChannel', { channel: existingLogChannel }) + 
                             '\n' + 
                             t('commands.setup.settingsCooldown', { seconds: existingCooldown });
        
        const warningEmbed = new EmbedBuilder()
            .setTitle(t('commands.setup.alreadySetupTitle'))
            .setColor(0xF1C40F) 
            .setDescription(t('commands.setup.alreadySetupWarning'))
            .addFields(
                { 
                    name: t('commands.setup.currentSettings'), 
                    value: settingsList,
                    inline: false
                }
            );

        const confirmButton = new ButtonBuilder()
            .setCustomId('setup_confirm_reset')
            .setLabel(t('common.yes'))
            .setStyle(ButtonStyle.Danger); 

        const cancelButton = new ButtonBuilder()
            .setCustomId('setup_cancel')
            .setLabel(t('common.no'))
            .setStyle(ButtonStyle.Secondary);
            
        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        const response = await interaction.editReply({ 
            content: t('commands.setup.alreadySetupConfirm'),
            embeds: [warningEmbed],
            components: [row],
        });

        const message = response.resource ? response.resource.message : response;
        
        try {
            const confirmation = await message.awaitMessageComponent({ 
                filter: (i) => i.customId === 'setup_confirm_reset' || i.customId === 'setup_cancel', 
                time: 30000 
            });
            
            if (confirmation.customId === 'setup_cancel') {
                await confirmation.update({ 
                    content: t('commands.setup.cancelled'), 
                    embeds: [], 
                    components: [] 
                });
                return;
            } 
            
            if (confirmation.customId === 'setup_confirm_reset') {
                
                db.deleteGuildData(guildId); 

                await confirmation.update({ 
                    content: "Eski ayarlar sıfırlandı. Yeni kurulum başlıyor...", 
                    embeds: [], 
                    components: [] 
                });
                
                // DÜZELTME 2: client parametresi eklendi
                await startSetupFlow(interaction, client, t, db, currentSettings, DEFAULT_COOLDOWN);
            }

        } catch (e) {
             await interaction.editReply({ 
                content: t('common.timeout'), 
                components: [],
                embeds: []
             });
        }
        
        return;
    }
    
    // MEVCUT KURULUM YOKSA NORMAL AKIŞA DEVAM ET
    
    // DÜZELTME 3: client parametresi eklendi
    await startSetupFlow(interaction, client, t, db, currentSettings, DEFAULT_COOLDOWN);
  },
};