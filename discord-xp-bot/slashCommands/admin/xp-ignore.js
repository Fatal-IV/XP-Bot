const { SlashCommandBuilder, PermissionsBitField, ChannelType, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xp-ignore')
    .setDescription('Disables/Enables XP for specific channels or roles.')
    .setDescriptionLocalizations({ tr: 'Belirli kanal veya roller için XP kazanımını kapatır/açar.' })
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setNameLocalizations({ tr: 'ekle' })
        .setDescription('Adds a channel or role to the ignore list.')
        .setDescriptionLocalizations({ tr: 'Bir kanalı veya rolü yasaklı listesine ekler.' })
        .addChannelOption(option => 
             option.setName('channel')
                .setNameLocalizations({ tr: 'kanal' })
                .setDescription('Channel to ignore')
                .setDescriptionLocalizations({ tr: 'Yasaklanacak Kanal' })
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice))
        .addRoleOption(option => 
             option.setName('role')
                .setNameLocalizations({ tr: 'rol' })
                .setDescription('Role to ignore')
                .setDescriptionLocalizations({ tr: 'Yasaklanacak Rol' }))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setNameLocalizations({ tr: 'kaldır' })
        .setDescription('Removes a channel or role from the ignore list.')
        .setDescriptionLocalizations({ tr: 'Bir kanalın veya rolün yasağını kaldırır.' })
        .addChannelOption(option => 
             option.setName('channel')
                .setNameLocalizations({ tr: 'kanal' })
                .setDescription('Channel to un-ignore')
                .setDescriptionLocalizations({ tr: 'Yasağı kaldırılacak Kanal' })
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice))
        .addRoleOption(option => 
             option.setName('role')
                .setNameLocalizations({ tr: 'rol' })
                .setDescription('Role to un-ignore')
                .setDescriptionLocalizations({ tr: 'Yasağı kaldırılacak Rol' }))
    ),
  
  isAdmin: true, 

  async execute(interaction, client, t, db) {
    const subcommand = interaction.options.getSubcommand();
    const channel = interaction.options.getChannel('channel');
    const role = interaction.options.getRole('role');

    // Seçim yapılmadıysa hata döndür
    // DÜZELTME: JSON anahtarı 'xp-ignore' olarak güncellendiği için burayı da güncelliyoruz.
    if (!channel && !role) {
      return interaction.reply({ 
          content: t('xp-ignore.missingSelection'), 
          flags: MessageFlags.Ephemeral 
      });
    }

    const targetId = channel ? channel.id : role.id;
    const type = channel ? 'channel' : 'role';
    const targetName = channel ? channel.name : role.name;
    
    // Çeviri için tür ismini hazırla
    const typeLabel = type === 'channel' ? t('common.channel') : t('common.role');

    if (subcommand === 'add') {
      db.addIgnore(interaction.guild.id, targetId, type);
      return interaction.reply({ 
        content: t('xp-ignore.added', { target: targetName, type: typeLabel }),
        flags: MessageFlags.Ephemeral 
      });
    } 
    
    if (subcommand === 'remove') {
      db.removeIgnore(interaction.guild.id, targetId);
      return interaction.reply({ 
        content: t('xp-ignore.removed', { target: targetName, type: typeLabel }),
        flags: MessageFlags.Ephemeral 
      });
    }
  },
};