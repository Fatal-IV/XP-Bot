const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ComponentType 
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setNameLocalizations({
      tr: 'sıralama',
      'en-US': 'top'
    })
    .setDescription('Displays the server leaderboard with a modern design.')
    .setDescriptionLocalizations({
      tr: 'Modern bir tasarımla sunucu liderlik tablosunu gösterir.',
      'en-US': 'Displays the server leaderboard with a modern design.'
    }),

  async execute(interaction, client) {
    const { guild, locale, user } = interaction;
    const t = client.i18n.getFixedT(locale);

    await interaction.deferReply();

    let currentPeriod = 'all';

    // --- YARDIMCI: XP Formatlayıcı ---
    const formatXP = (xp) => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(xp);

    // --- ANA FONKSİYON ---
    const generateLeaderboardMessage = async (period) => {
        // 1. Verileri Hazırla
        const fullLeaderboard = client.db.getLeaderboard(guild.id, period, 100); 
        const top10 = fullLeaderboard.slice(0, 10);

        // Periyot Başlığı
        let periodName;
        switch(period) {
            case 'day': periodName = t('top.daily'); break;
            case 'week': periodName = t('top.weekly'); break;
            case 'month': periodName = t('top.monthly'); break;
            default: periodName = t('top.alltime');
        }

        // 2. KULLANICI İSTATİSTİKLERİ
        const userStats = client.db.getUserStats(guild.id, user.id);
        const userEntryIndex = fullLeaderboard.findIndex(u => u.user_id === user.id);
        const userRank = userEntryIndex !== -1 ? `#${userEntryIndex + 1}` : '100+';

        const tLvl = userStats.level || 0;
        const tXP = userStats.text_xp || 0;
        const vLvl = userStats.voice_level || 0;
        const vXP = userStats.voice_xp || 0;

        // 3. LİDERLİK LİSTESİ
        const userIds = top10.map(entry => entry.user_id);
        const uniqueIds = [...new Set(userIds)];
        // Düzeltilmiş fetch syntax'ı ve hata yakalama
        const members = await guild.members.fetch({ user: uniqueIds }).catch(() => null);

        let rankString = "";

        if (top10.length === 0) {
            rankString = `*${t('top.empty')}*`;
        } else {
            for (let i = 0; i < top10.length; i++) {
                const entry = top10[i];
                const member = members ? members.get(entry.user_id) : null;
                
                let displayName = member ? member.displayName : (client.users.cache.get(entry.user_id)?.username || 'Unknown User');
                displayName = displayName.replace(/([*_`~|])/g, '\\$1');

                // DÜZELTME 1: İsim uzunluğunu sınırla
                const MAX_NAME_LENGTH = 18;
                if (displayName.length > MAX_NAME_LENGTH) {
                    displayName = displayName.substring(0, MAX_NAME_LENGTH - 1) + '…';
                }

                // Madalya ve Vurgu
                let rankIcon = `\`${i + 1}.\``; 
                let highlight = ""; 
                
                if (i === 0) { rankIcon = "🥇"; highlight = "**"; }
                if (i === 1) { rankIcon = "🥈"; highlight = "**"; }
                if (i === 2) { rankIcon = "🥉"; highlight = "**"; }

                const dLevel = entry.level || 0; 
                const dXP = entry.gained_xp || entry.total_xp || 0;

                // Satır 1: İsim ve Madalya
                rankString += `${rankIcon} ${highlight}${displayName}${highlight}\n`;
                // Satır 2: Detaylar
                rankString += `└ 💫 ${t('top.levelShort')} ${dLevel} • **${formatXP(dXP)} XP**\n`;
                
                // DÜZELTME 2: Her girişten sonra (sonuncusu hariç) ekstra bir satır boşluk bırak
                if (i < top10.length - 1) {
                    rankString += '\n'; 
                }
            }
        }

        // 4. EMBED TASARIMI
        const embed = new EmbedBuilder()
            .setColor('#FFD700') 
            .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
            .setTitle(`${t('top.title')}`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                // ALAN 1: Kişisel İstatistikler
                {
                    name: `${t('top.yourStatsTitle')} (${userRank})`,
                    value: `**${t('top.textInfo')}:** ${t('top.levelShort')} ${tLvl} \`(${formatXP(tXP)} XP)\`\n **${t('top.voiceInfo')}:** ${t('top.levelShort')} ${vLvl} \`(${formatXP(vXP)} XP)\``,
                    inline: false
                },
                // ALAN 2: Ayırıcı Çizgi
                { 
                    name: '\u200b', 
                    value: '─────────────────────────────', 
                    inline: false 
                },
                // ALAN 3: Liste Başlığı ve İçeriği
                { 
                    name: `**${t('top.title')}**`, 
                    value: rankString, 
                    inline: false 
                }
            )
            .setFooter({ 
                text: t('top.footer', { name: user.displayName }), 
                iconURL: user.displayAvatarURL() 
            })
            .setTimestamp();

        // 5. BUTONLAR
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('top_all')
                .setLabel(t('top.alltime'))
                .setStyle(period === 'all' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji('🏆'),
            new ButtonBuilder()
                .setCustomId('top_week')
                .setLabel(t('top.weekly'))
                .setStyle(period === 'week' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji('📅'),
            new ButtonBuilder()
                .setCustomId('top_day')
                .setLabel(t('top.daily'))
                .setStyle(period === 'day' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji('🔥')
        );

        return { embeds: [embed], components: [row] };
    };

    // İlk Yanıt
    const initialData = await generateLeaderboardMessage(currentPeriod);
    const message = await interaction.editReply(initialData);

    // Collector
    const collector = message.createMessageComponentCollector({ 
        componentType: ComponentType.Button, 
        time: 60000 
    });

    collector.on('collect', async (i) => {
        if (i.user.id !== user.id) {
            return i.reply({ content: client.i18n.getFixedT(i.locale)('common.noPermission'), ephemeral: true });
        }

        if (i.customId === 'top_all') currentPeriod = 'all';
        if (i.customId === 'top_week') currentPeriod = 'week';
        if (i.customId === 'top_day') currentPeriod = 'day';

        await i.deferUpdate(); 
        const newData = await generateLeaderboardMessage(currentPeriod);
        await interaction.editReply(newData);
    });

    collector.on('end', () => {
        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('top_all').setLabel(t('top.alltime')).setStyle(ButtonStyle.Secondary).setDisabled(true).setEmoji('🏆'),
            new ButtonBuilder().setCustomId('top_week').setLabel(t('top.weekly')).setStyle(ButtonStyle.Secondary).setDisabled(true).setEmoji('📅'),
            new ButtonBuilder().setCustomId('top_day').setLabel(t('top.daily')).setStyle(ButtonStyle.Secondary).setDisabled(true).setEmoji('🔥')
        );
        interaction.editReply({ components: [disabledRow] }).catch(() => {});
    });
  },
};