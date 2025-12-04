const { Collection } = require('discord.js');

/**
 * Tek merkezden tüm cooldown türlerini (komut, XP) yöneten sınıf.
 * Bu sınıf, sadece süre dolduğunda yeni bir kayıt yapılmasını engelleyerek RAM'de kalıcı iz bırakmaz.
 */
class CooldownManager {
    constructor() {
        /**
         * @type {Collection<string, number>} // Anahtar: 'CATEGORY:USER_ID', Değer: Expiration Timestamp (ms)
         */
        this.cooldowns = new Collection();
    }

    /**
     * Kullanıcının bekleme süresinde olup olmadığını kontrol eder.
     * @param {string} category Kategoriyi (örn: 'command:rank', 'xp:text') belirtir.
     * @param {string} userId Discord kullanıcı ID'si.
     * @returns {number | false} Beklenmesi gereken kalan süreyi (saniye) döndürür, değilse false.
     */
    checkCooldown(category, userId) {
        const key = `${category}:${userId}`;
        const expirationTime = this.cooldowns.get(key);
        const now = Date.now();

        if (expirationTime) {
            if (now < expirationTime) {
                // Cooldown aktif
                return ((expirationTime - now) / 1000).toFixed(1);
            } else {
                // Cooldown dolmuş, Map'ten temizle (Memory Leak önleme)
                this.cooldowns.delete(key);
            }
        }
        return false;
    }

    /**
     * Kullanıcıya yeni bir bekleme süresi ekler.
     * @param {string} category Kategoriyi (örn: 'command:rank', 'xp:text') belirtir.
     * @param {string} userId Discord kullanıcı ID'si.
     * @param {number} durationSeconds Cooldown süresi (saniye).
     */
    setCooldown(category, userId, durationSeconds) {
        const key = `${category}:${userId}`;
        const expirationTime = Date.now() + (durationSeconds * 1000);
        this.cooldowns.set(key, expirationTime);
    }

    /**
     * Kullanıcının belirtilen kategorideki cooldown'unu temizler.
     * @param {string} category
     * @param {string} userId
     */
    clearCooldown(category, userId) {
        const key = `${category}:${userId}`;
        this.cooldowns.delete(key);
    }
}

module.exports = { CooldownManager };