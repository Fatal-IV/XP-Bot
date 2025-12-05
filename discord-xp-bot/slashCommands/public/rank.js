const { SlashCommandBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const { generateRankCard } = require('../../utils/rankCard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setNameLocalizations({ tr: 'seviye' })
    .setDescription('Shows your or another user\'s level rank.')
    .setDescriptionLocalizations({ tr: 'Sizin veya başka bir kullanıcının seviye kartını gösterir.' })
    .addUserOption(option => 
      option.setName('user')
        .setNameLocalizations({ tr: 'kullanıcı' })
        .setDescription('The user whose rank you want to see.')
        .setDescriptionLocalizations({ tr: 'Seviyesini görmek istediğiniz kullanıcı.' })
        .setRequired(false)
    ),
    cooldown: 15,

  async execute(interaction, client, t, db) {
    // --- 1. KONTROL: SETUP YAPILMIŞ MI? ---
    const guildSettings = db.getGuild(interaction.guild.id);
    if (!guildSettings || !guildSettings.log_channel_id) {
        return interaction.reply({ 
            // DÜZELTME: Dil dosyasından 'setupRequired' mesajını çekiyoruz
            content: t('common.setupRequired'), 
            flags: MessageFlags.Ephemeral 
        });
    }

    const targetUser = interaction.options.getUser('user') || interaction.user;
    
    // Bot kontrolü
    if (targetUser.bot) {
        return interaction.reply({ 
            // DÜZELTME: Dil dosyasından 'isBot' mesajını çekiyoruz
            content: t('rank.isBot'), 
            flags: MessageFlags.Ephemeral 
        });
    }

    // Kullanıcıyı sunucudan (member olarak) çekmeye çalış
    const member = interaction.guild.members.cache.get(targetUser.id);
    if (!member) {
        return interaction.reply({ 
            content: t('rank.userNotFound'), 
            flags: MessageFlags.Ephemeral 
        });
    }

    await interaction.deferReply();

    try {
        const userStats = db.getUserStats(interaction.guild.id, targetUser.id);
        
        // --- 2. KONTROL: HİÇ VERİSİ VAR MI? (Metin VEYA Ses) ---
        // Eğer hem Text XP hem de Voice XP sıfırsa hata ver.
        // Ama bir tanesi bile varsa (örn: sadece ses) kartı göster.
        const hasTextXP = userStats.text_xp > 0;
        const hasVoiceXP = userStats.voice_xp > 0;

        if (!hasTextXP && !hasVoiceXP) {
            return interaction.editReply({ 
                content: t('rank.noData') 
            });
        }

        const rank = db.getUserRank(interaction.guild.id, targetUser.id);
        
        // Kartı oluştur
        const attachment = await generateRankCard(member, userStats, rank);

        await interaction.editReply({ files: [attachment] });

    } catch (error) {
        console.error('Rank kartı oluşturulurken hata:', error);
        await interaction.editReply({ content: t('rank.cardError') });
    }
  },
};