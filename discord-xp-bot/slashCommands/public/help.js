const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setNameLocalizations({ tr: 'yardım' })
    .setDescription('Displays a list of available commands.')
    .setDescriptionLocalizations({ tr: 'Mevcut komutların listesini görüntüler.' })
    .addStringOption(option => 
        option.setName('command')
        .setNameLocalizations({ tr: 'komut' })
        .setDescription('Get detailed info on a specific command')
        .setDescriptionLocalizations({ tr: 'Belirli bir komut hakkında detaylı bilgi al' })
        .setRequired(false)
    ),

  async execute(interaction, client, t, db) {
    const commandName = interaction.options.getString('command');

    // --- YARDIMCI: Komut Açıklamasını Getir ---
    // Önce dil dosyasından (JSON) dener, yoksa kodun içindeki description'ı alır.
    const getDescription = (cmd, cmdKey) => {
        const jsonDesc = t(`commands.${cmdKey}.description`);
        // Eğer çeviri anahtarı dönüyorsa (çeviri yoksa), fallback kullan
        if (jsonDesc === `commands.${cmdKey}.description`) {
            return cmd.data.descriptionLocalizations?.[interaction.locale] || cmd.data.description;
        }
        return jsonDesc;
    };

    // --- SENARYO 1: Tek Bir Komut Hakkında Detaylı Bilgi ---
    if (commandName) {
        const cmd = client.slashCommands.get(commandName);
        if (!cmd) {
            return interaction.reply({ 
                content: `❌ ${t('commands.help.notFound')}`, 
                flags: MessageFlags.Ephemeral 
            });
        }

        const realName = cmd.data.name;
        const desc = getDescription(cmd, realName);
        
        const embed = new EmbedBuilder()
            .setTitle(`🔍 /${realName}`)
            .setColor('#5865F2')
            .setDescription(desc)
            .addFields(
                { 
                    name: t('commands.help.category'), 
                    value: cmd.isAdmin ? `🛡️ ${t('commands.help.adminCategory')}` : `👤 ${t('commands.help.publicCategory')}`,
                    inline: true
                }
            );

        // Seçenekleri (Options) Listele
        if (cmd.data.options.length > 0) {
            const optionsList = cmd.data.options.map(opt => {
                // Seçenek açıklamasını çevir
                // (Basitlik için kod içindeki açıklamayı veya varsa yerelleştirmeyi alıyoruz)
                const optLocalDesc = opt.descriptionLocalizations?.[interaction.locale] || opt.description;
                return `• \`${opt.name}\`: ${optLocalDesc}`;
            }).join('\n');
            
            embed.addFields({ name: `⚙️ ${t('commands.help.options')}`, value: optionsList });
        } else {
            embed.addFields({ name: `⚙️ ${t('commands.help.options')}`, value: `_${t('commands.help.noOptions')}_` });
        }

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // --- SENARYO 2: Genel Komut Listesi (Ana Menü) ---
    const adminCommands = [];
    const publicCommands = [];

    client.slashCommands.forEach(cmd => {
        const realName = cmd.data.name;
        // Listede kısa açıklama göstermek daha şıktır, çok uzunsa kesebiliriz ama şimdilik tam gösterelim.
        const desc = getDescription(cmd, realName);
        
        // Tasarım:  `/komut` - Açıklama
        const line = `> **/${realName}**\n> └ ${desc}`;

        if (cmd.isAdmin) {
            adminCommands.push(line);
        } else {
            publicCommands.push(line);
        }
    });

    const embed = new EmbedBuilder()
        .setAuthor({ 
            name: `${client.user.username} - ${t('commands.help.title')}`, 
            iconURL: client.user.displayAvatarURL() 
        })
        .setDescription(t('commands.help.description'))
        .setColor('#2B2D31') // Modern Koyu Tema (Settings ile uyumlu)
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .addFields(
            // Kullanıcı Komutları (Sol Taraf - Genelde daha çok kullanılır)
            { 
                name: `👥 ${t('commands.help.publicTitle')} (${publicCommands.length})`, 
                value: publicCommands.join('\n\n') || '_Komut yok_', 
                inline: true 
            },
            // Yönetici Komutları (Sağ Taraf)
            { 
                name: `🛡️ ${t('commands.help.adminTitle')} (${adminCommands.length})`, 
                value: adminCommands.join('\n\n') || '_Komut yok_', 
                inline: true 
            }
        )
        .setFooter({ text: t('commands.help.footer') })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};