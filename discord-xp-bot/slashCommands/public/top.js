const { SlashCommandBuilder, EmbedBuilder, Collection } = require('discord.js');

const guildCooldowns = new Collection();
const HEAVY_QUERY_COOLDOWN = 30; // Ağır sorgular (Aylık/Haftalık) için bekleme süresi

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setNameLocalizations({ tr: 'liderlik' })
    .setDescription('Shows the server leaderboard (Text XP only).')
    .setDescriptionLocalizations({ tr: 'Sunucu liderlik tablosunu gösterir (Sadece Metin XP).' })
    .addStringOption(option =>
      option.setName('duration')
        .setNameLocalizations({ tr: 'süre' })
        .setDescription('The time period for the leaderboard.')
        .setDescriptionLocalizations({ tr: 'Liderlik tablosu için zaman aralığı.' })
        .setRequired(false)
        .addChoices(
          { name: 'All Time', name_localizations: { tr: 'Tüm Zamanlar' }, value: 'alltime' },
          { name: 'Monthly', name_localizations: { tr: 'Aylık' }, value: 'month' },
          { name: 'Weekly', name_localizations: { tr: 'Haftalık' }, value: 'week' },
          { name: 'Daily', name_localizations: { tr: 'Günlük' }, value: 'day' }
        )
    )
    .addIntegerOption(option =>
      option.setName('page')
        .setNameLocalizations({ tr: 'sayfa' })
        .setDescription('The page number of the leaderboard (default: 1).')
        .setDescriptionLocalizations({ tr: 'Liderlik tablosunun sayfa numarası (varsayılan: 1).' })
        .setMinValue(1)
        .setRequired(false)
    ),
  isAdmin: false,
  
  async execute(interaction, client, t, db) {
    const duration = interaction.options.getString('duration') || 'alltime';
    const page = interaction.options.getInteger('page') || 1; 
    const guildId = interaction.guild.id;

    // --- 1. SPAM KORUMASI (Ağır Sorgular İçin) ---
    if (duration !== 'alltime') {
      const now = Date.now();
      const lastUsed = guildCooldowns.get(guildId) || 0;
      const expirationTime = lastUsed + (HEAVY_QUERY_COOLDOWN * 1000);

      if (now < expirationTime) {
        const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
        return interaction.reply({
          content: t('commands.top.heavyQueryCooldown', { seconds: timeLeft }),
          ephemeral: true
        });
      }
      guildCooldowns.set(guildId, now);
    }

    await interaction.deferReply();
    
    // --- 2. VERİTABANINDAN VERİ ÇEKME ---
    // Not: "sqlite.js" dosyasındaki aggregation (günlük toplama) mantığı sayesinde
    // bu sorgu artık çok daha hızlı çalışacak.
    const leaderboardData = db.getLeaderboard(interaction.guild.id, { duration, page }); 

    if (!leaderboardData || leaderboardData.length === 0) {
      return interaction.editReply({ content: t('commands.top.noData', { page: page }) });
    }

    // --- 3. LİSTEYİ OLUŞTURMA (Modern Tasarım) ---
    const leaderboardEntries = await Promise.all(
      leaderboardData.map(async (entry, index) => {
        try {
          // Kullanıcıyı önbellekten veya API'den çek
          const user = await client.users.fetch(entry.user_id);
          const globalRank = (page - 1) * 10 + index + 1;
          
          // XP Değerini al ve formatla (örn: 15.230)
          const rawXP = duration === 'alltime' ? entry.total_xp : entry.total_xp_gained;
          const formattedXP = rawXP.toLocaleString('tr-TR'); // Binlik ayracı ekler

          // MADALYA SİSTEMİ
          let rankDisplay = `**#${globalRank}**`; // Varsayılan: #4, #5...
          let highlight = ""; // Satır içi vurgu
          
          if (globalRank === 1) {
             rankDisplay = "🥇"; 
             highlight = "👑 "; // Lider için ekstra ikon
          }
          else if (globalRank === 2) rankDisplay = "🥈";
          else if (globalRank === 3) rankDisplay = "🥉";

          // Format: 🥇 Kullanıcı Adı
          //         └ ✨ 15.000 XP
          return `${rankDisplay} **${user.username}**\n└ ${highlight}✨ \`${formattedXP} XP\``;

        } catch (e) {
          // Kullanıcı sunucudan çıktıysa veya bulunamazsa
          const globalRank = (page - 1) * 10 + index + 1;
          return `**#${globalRank}** *Bilinmeyen Kullanıcı*\n└ 👻 \`Veri yok\``;
        }
      })
    );

    // --- 4. EMBED TASARIMI ---
    // Başlık için süreye göre dinamik metin (İsteğe bağlı, şu an sabit title kullanıyoruz)
    const periodText = {
        'alltime': 'Tüm Zamanlar',
        'month': 'Bu Ay',
        'week': 'Bu Hafta',
        'day': 'Bugün'
    }[duration] || 'Tüm Zamanlar';

    const embed = new EmbedBuilder()
      .setAuthor({ 
          name: `${interaction.guild.name} - Liderlik Tablosu (${periodText})`, 
          iconURL: interaction.guild.iconURL({ dynamic: true }) 
      })
      .setDescription(leaderboardEntries.join('\n\n')) // Satırlar arası boşluk artırıldı
      .setColor('#FFD700') // Altın sarısı tema rengi
      .setThumbnail('https://cdn-icons-png.flaticon.com/512/3112/3112946.png') // Trophy ikonu (veya sunucu ikonu)
      .setFooter({ text: t('commands.top.footer', { page: page }) + ` • ${periodText}` })
      .setTimestamp();
      
    await interaction.editReply({ embeds: [embed] });
  },
};