const { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ComponentType,
  ChannelType,
  Colors 
} = require('discord.js');

// Varsayılan spam ayarlarını config dosyasından çekiyoruz
const { SPAM_WINDOW_SECONDS, SPAM_MESSAGE_COUNT } = require('../../config');
const { isAdmin } = require('./xp-ignore');

/**
 * Adım Adım Kurulum Sihirbazı (Sadeleştirilmiş - 2 Adım)
 */
async function startSetupWizard(interaction, client, db, t) {
  const { channel, user, guild } = interaction;
  
  const newSettings = {
    guild_id: guild.id,
    log_channel_id: null,
    cooldown: 60,
    spamWindow: SPAM_WINDOW_SECONDS, 
    spamCount: SPAM_MESSAGE_COUNT,
    level_up_message: null
  };

  const filter = m => m.author.id === user.id;

  try {
    // --- ADIM 1: Log Kanalı ---
    const step1Title = t('setup.stepTitle', { current: 1, total: 2, name: t('setup.stepLog') });
    
    const step1Embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setAuthor({ name: step1Title, iconURL: 'https://cdn-icons-png.flaticon.com/512/2921/2921222.png' })
      .setTitle(t('setup.stepLog')) // "Log Kanalı"
      .setDescription(
        `${t('setup.askChannel')}\n\n` +
        `> *${t('setup.askChannelNote')}*`
      )
      .setFooter({ text: t('setup.footerCancel') });
    
    if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: null, embeds: [step1Embed], components: [] });
    } else {
        await interaction.reply({ embeds: [step1Embed], fetchReply: true });
    }
    
    const collected1 = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });
    const msg1 = collected1.first();
    
    if (['iptal', 'cancel'].includes(msg1.content.toLowerCase())) {
        msg1.delete().catch(() => {});
        const cancelEmbed = new EmbedBuilder().setColor(Colors.Red).setDescription(`❌ ${t('setup.setupCancelled')}`);
        return interaction.editReply({ embeds: [cancelEmbed] });
    }

    const targetChannel = msg1.mentions.channels.first() || guild.channels.cache.get(msg1.content);
    
    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      msg1.delete().catch(() => {});
      const errorEmbed = new EmbedBuilder().setColor(Colors.Red).setDescription(t('setup.invalidChannel'));
      return interaction.editReply({ embeds: [errorEmbed] });
    }

    newSettings.log_channel_id = targetChannel.id;
    msg1.delete().catch(() => {});

    // --- ADIM 2: Cooldown (Bekleme Süresi) ---
    const step2Title = t('setup.stepTitle', { current: 2, total: 2, name: t('setup.stepCooldown') });

    const step2Embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setAuthor({ name: step2Title, iconURL: 'https://cdn-icons-png.flaticon.com/512/2921/2921222.png' })
      .setTitle(t('setup.stepCooldown'))
      .setDescription(
        `${t('setup.askCooldown')}\n\n` +
        `> *${t('setup.askCooldownNote')}*`
      )
      .setFooter({ text: t('setup.footerCancel') });
      
    const step2Msg = await channel.send({ embeds: [step2Embed] });
    
    const collected2 = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });
    const msg2 = collected2.first();
    
    if (['iptal', 'cancel'].includes(msg2.content.toLowerCase())) {
        msg2.delete().catch(() => {});
        step2Msg.delete().catch(() => {});
        const cancelEmbed = new EmbedBuilder().setColor(Colors.Red).setDescription(`❌ ${t('setup.setupCancelled')}`);
        return interaction.editReply({ embeds: [cancelEmbed] });
    }
    
    const inputCooldown = parseInt(msg2.content);
    if (!isNaN(inputCooldown) && inputCooldown >= 10) {
      newSettings.cooldown = inputCooldown;
    } else {
       msg2.delete().catch(() => {});
       step2Msg.delete().catch(() => {});
       const errorEmbed = new EmbedBuilder().setColor(Colors.Red).setDescription(t('setup.invalidCooldown'));
       return interaction.editReply({ embeds: [errorEmbed] });
    }
    
    msg2.delete().catch(() => {});
    step2Msg.delete().catch(() => {});

    // --- KAYDETME ---
    db.updateGuild(newSettings);

    const successEmbed = new EmbedBuilder()
      .setColor('#57F287') 
      .setTitle(`✅ ${t('setup.successTitle')}`)
      .setDescription(t('setup.successDesc'))
      .addFields(
        { name: `📜 ${t('setup.stepLog')}`, value: `<#${newSettings.log_channel_id}>`, inline: true },
        { name: `⏱️ ${t('setup.stepCooldown')}`, value: `\`${newSettings.cooldown} sn\``, inline: true },
        { name: `🛡️ ${t('setup.stepSpam')}`, value: `\`${newSettings.spamWindow}s / ${newSettings.spamCount}m\` ${t('setup.spamFixed')}`, inline: true }
      )
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .setTimestamp();

    await channel.send({ embeds: [successEmbed] });

  } catch (error) {
    console.error(error);
    const timeoutEmbed = new EmbedBuilder().setColor(Colors.Red).setDescription(`qc ${t('setup.timeout')}`);
    await channel.send({ embeds: [timeoutEmbed] });
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setNameLocalizations({
      tr: 'kurulum',
      'en-US': 'setup'
    })
    .setDescription('Starts or updates the server setup for the XP bot.')
    .setDescriptionLocalizations({
      tr: 'XP botu için sunucu kurulumunu başlatır veya günceller.',
      'en-US': 'Starts or updates the server setup for the XP bot.'
    }),

    isAdmin: true,
    
  async execute(interaction, client) {
    const { guild, locale } = interaction;
    const db = client.db;
    const t = client.i18n.getFixedT(locale);

    // 1. Mevcut Ayarları Çek
    let currentSettings = db.getGuild(guild.id);
    const isAlreadySetup = currentSettings && currentSettings.log_channel_id;

    // --- SENARYO A: Zaten Kurulmuş ---
    if (isAlreadySetup) {
      const logChannel = guild.channels.cache.get(currentSettings.log_channel_id);
      
      const statusEmbed = new EmbedBuilder()
        .setColor('#2B2D31')
        .setAuthor({ name: `${guild.name}`, iconURL: guild.iconURL({ dynamic: true }) })
        .setTitle(t('setup.alreadySetupTitle'))
        .setDescription(t('setup.alreadySetupWarning'))
        .addFields(
          { 
            name: `📜 ${t('settings.logChannel')}`, 
            value: logChannel ? logChannel.toString() : `*${t('common.notSet')}*`, 
            inline: true 
          },
          { 
            name: `⏱️ ${t('settings.cooldown')}`, 
            value: `\`${currentSettings.cooldown} sn\``, 
            inline: true 
          },
          { 
             name: `🛡️ ${t('settings.spamProtection')}`,
             value: `\`${currentSettings.spamWindow}s / ${currentSettings.spamCount}m\``,
             inline: true
          }
        )
        .setFooter({ text: t('setup.alreadySetupFooter') });

      const continueBtn = new ButtonBuilder()
        .setCustomId('setup_continue')
        .setLabel(t('setup.btnReset'))
        .setStyle(ButtonStyle.Success)
        .setEmoji('▶️');

      const cancelBtn = new ButtonBuilder()
        .setCustomId('setup_cancel')
        .setLabel(t('setup.btnCancel'))
        .setStyle(ButtonStyle.Secondary) 
        .setEmoji('✖️');

      const row = new ActionRowBuilder().addComponents(cancelBtn, continueBtn);

      const response = await interaction.reply({
        embeds: [statusEmbed],
        components: [row],
        fetchReply: true 
      });

      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30000 
      });

      collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: t('common.noPermission'), ephemeral: true });
        }

        if (i.customId === 'setup_cancel') {
          await i.update({ 
            content: t('setup.cancelledByUser'), 
            embeds: [], 
            components: [] 
          });
          collector.stop('cancelled');
        } 
        else if (i.customId === 'setup_continue') {
          // --- FABRİKA AYARLARINA DÖNÜŞ ---
          await i.update({ 
            content: t('setup.processing'), 
            embeds: [], 
            components: [] 
          });
          
          db.deleteGuildData(guild.id);
          
          await new Promise(r => setTimeout(r, 1000));

          startSetupWizard(interaction, client, db, t);
          collector.stop('confirmed');
        }
      });

      collector.on('end', (collected, reason) => {
        if (reason === 'time') {
          interaction.editReply({ 
              content: t('setup.timeout'), 
              embeds: [], 
              components: [] 
          }).catch(() => {});
        }
      });

    } else {
      // --- SENARYO B: İlk Kez Kurulum ---
      startSetupWizard(interaction, client, db, t);
    }
  }
};