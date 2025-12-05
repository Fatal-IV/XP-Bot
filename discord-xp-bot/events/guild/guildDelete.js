const { Events } = require('discord.js');
// DÜZELTME: İki nokta (..) yerine üç nokta (../..) kullanarak iki üst dizine çıkıyoruz
const db = require('../../database/sqlite');

// Silinmeyecek Sunucu ID'si (Whitelist)
const WHITELISTED_GUILD_ID = '776904485296668712';

module.exports = {
  name: Events.GuildDelete,
  async execute(guild, client) {
    console.log(`[Event] Bot sunucudan ayrıldı: ${guild.name} (${guild.id})`);

    // Eğer ayrılınan sunucu Whitelist'te ise silme işlemi yapma
    if (guild.id === WHITELISTED_GUILD_ID) {
        console.log(`[Veri Koruma] ${guild.name} (${guild.id}) whitelist'te olduğu için verileri silinmedi.`);
        return;
    }

    try {
        // Veritabanından her şeyi sil
        db.deleteGuildData(guild.id);
        console.log(`[Temizlik] ${guild.name} sunucusuna ait tüm veriler silindi.`);
    } catch (error) {
        console.error(`[Hata] Sunucu verileri silinirken hata oluştu: ${error}`);
    }
  },
};