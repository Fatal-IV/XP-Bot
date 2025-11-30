const { 
  SlashCommandBuilder, 
  PermissionsBitField, 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder, 
  MessageFlags, 
  ComponentType 
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlevelmessage')
    .setNameLocalizations({ tr: 'seviyemesajı' })
    .setDescription('Sets a custom level-up message for the server.')
    .setDescriptionLocalizations({ tr: 'Sunucu için özel bir seviye atlama mesajı ayarlar.' }),
  
  isAdmin: true,

  async execute(interaction, client, t, db) {
    // 1. Yetki Kontrolü
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: t('common.noPermission'), flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guild.id;
    let guildSettings = db.getGuild(guildId);

    // --- ARAYÜZ OLUŞTURMA (Embed & Butonlar) ---

    const currentMsg = guildSettings.level_up_message 
        ? `\`${guildSettings.level_up_message}\`` 
        : `_${t('commands.setlevelmessage.default')}_`;

    // Bilgi Paneli
    const infoEmbed = new EmbedBuilder()
      .setTitle(t('commands.setlevelmessage.title'))
      .setColor('#5865F2')
      .addFields(
        { 
          name: t('commands.setlevelmessage.current'), 
          value: currentMsg, 
          inline: false 
        },
        { 
          name: t('commands.setlevelmessage.variablesTitle'), 
          value: t('commands.setlevelmessage.variablesDesc'), 
          inline: false 
        }
      );

    // Ana Menü Butonları
    const setBtn = new ButtonBuilder()
      .setCustomId('lvlmsg_set')
      .setLabel(t('commands.setlevelmessage.setButton'))
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✏️');

    const resetBtn = new ButtonBuilder()
      .setCustomId('lvlmsg_reset')
      .setLabel(t('commands.setlevelmessage.resetButton'))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!guildSettings.level_up_message); 

    const cancelBtn = new ButtonBuilder()
      .setCustomId('lvlmsg_cancel')
      .setLabel(t('commands.setlevelmessage.cancelButton'))
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(setBtn, resetBtn, cancelBtn);

    const response = await interaction.reply({
      embeds: [infoEmbed],
      components: [row],
      flags: MessageFlags.Ephemeral,
      withResponse: true
    });

    const message = response.resource ? response.resource.message : response;

    // --- BUTON COLLECTOR (Ana Menü) ---
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000 
    });

    collector.on('collect', async (i) => {
      // 1. İPTAL
      if (i.customId === 'lvlmsg_cancel') {
        await i.update({ 
          content: t('commands.setlevelmessage.cancelled'), 
          embeds: [], 
          components: [] 
        });
        collector.stop();
      }

      // 2. SIFIRLA
      else if (i.customId === 'lvlmsg_reset') {
        guildSettings.level_up_message = null;
        db.updateGuild(guildSettings);

        await i.update({
          content: t('commands.setlevelmessage.reset'),
          embeds: [],
          components: []
        });
        collector.stop();
      }

      // 3. AYARLA (Mesaj Yazma Modu)
      else if (i.customId === 'lvlmsg_set') {
        
        // Hatırlatma Paneli
        const promptEmbed = new EmbedBuilder()
            .setColor('#F1C40F') 
            .setTitle('📝 Mesaj Düzenleme Modu') 
            .setDescription(`**${t('commands.setlevelmessage.prompt')}**`)
            .addFields({
                name: t('commands.setlevelmessage.variablesTitle'), 
                value: t('commands.setlevelmessage.variablesDesc')
            })
            .setFooter({ text: 'Zaman aşımı: 60 saniye' });

        await i.update({
          content: '', 
          embeds: [promptEmbed], 
          components: []
        });
        
        collector.stop(); 

        // --- MESAJ COLLECTOR (Kullanıcının Yazısını Bekle) ---
        const msgFilter = (m) => m.author.id === interaction.user.id;
        const msgCollector = interaction.channel.createMessageCollector({
          filter: msgFilter,
          max: 1,
          time: 60000
        });

        msgCollector.on('collect', async (msg) => {
          const newMessage = msg.content;
          
          try { await msg.delete(); } catch(e) {}

          // --- ONAY AŞAMASI ---
          
          // Önizleme Oluştur (Değişkenleri gerçek verilerle değiştir)
          const previewText = newMessage
            .replace(/{user}/g, interaction.user.toString())
            .replace(/{level}/g, '5')
            .replace(/{guild}/g, interaction.guild.name);

          // Onay Paneli
          const confirmEmbed = new EmbedBuilder()
            .setColor('#E67E22')
            .setTitle(t('commands.setlevelmessage.confirmTitle'))
            .setDescription(t('commands.setlevelmessage.confirmDesc'))
            .addFields(
                { name: t('commands.setlevelmessage.preview'), value: previewText },
                { name: 'Raw (Ham Mesaj)', value: `\`${newMessage}\`` }
            );

          // Onay Butonları
          const saveBtn = new ButtonBuilder()
            .setCustomId('confirm_save')
            .setLabel(t('commands.setlevelmessage.saveButton'))
            .setStyle(ButtonStyle.Success)
            .setEmoji('💾');

          const cancelEditBtn = new ButtonBuilder()
            .setCustomId('confirm_cancel')
            .setLabel(t('commands.setlevelmessage.cancelEditButton'))
            .setStyle(ButtonStyle.Danger)
            .setEmoji('✖️');

          const confirmRow = new ActionRowBuilder().addComponents(saveBtn, cancelEditBtn);

          // interaction.followUp mesajı döndürür
          const confirmMsg = await interaction.followUp({
             embeds: [confirmEmbed],
             components: [confirmRow],
             flags: MessageFlags.Ephemeral
          });

          // confirmMsg üzerinden yeni buton dinleyicisi
          const confirmCollector = confirmMsg.createMessageComponentCollector({
              componentType: ComponentType.Button,
              time: 60000
          });

          confirmCollector.on('collect', async (btnI) => {
              if (btnI.customId === 'confirm_cancel') {
                  await btnI.update({
                      content: t('commands.setlevelmessage.cancelled'),
                      embeds: [],
                      components: []
                  });
                  confirmCollector.stop();
              } 
              else if (btnI.customId === 'confirm_save') {
                  // Veritabanına kaydet
                  const freshSettings = db.getGuild(guildId);
                  freshSettings.level_up_message = newMessage;
                  db.updateGuild(freshSettings);

                  const successEmbed = new EmbedBuilder()
                      .setColor('#2ECC71') // Yeşil (Başarılı)
                      .setTitle(t('commands.setlevelmessage.success'))
                      // --- GÜNCELLEME BURADA ---
                      // Eskisi: `\`${newMessage}\`` (Ham mesaj)
                      // Yenisi: previewText (İşlenmiş, önizleme mesajı)
                      .setDescription(previewText);

                  await btnI.update({
                      embeds: [successEmbed],
                      components: []
                  });
                  confirmCollector.stop();
              }
          });
        });

        msgCollector.on('end', (collected, reason) => {
          if (reason === 'time') {
            interaction.followUp({ 
              content: t('common.timeout'), 
              flags: MessageFlags.Ephemeral 
            });
          }
        });
      }
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time') {
        interaction.editReply({ components: [] }).catch(() => {});
      }
    });
  },
};