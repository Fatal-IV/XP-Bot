module.exports = {
  // Orijinal Metin XP Formülü: baseXP + (a * level) + (b * level^2)
  BASE_XP: 30,
  A_FACTOR: 50,
  B_FACTOR: 5,

  // Metin XP
  MIN_XP_PER_MESSAGE: 10,
  MAX_XP_PER_MESSAGE: 25,

  // Ses XP
  MIN_XP_PER_VOICE: 10,
  MAX_XP_PER_VOICE: 25,
  VOICE_XP_INTERVAL_MINUTES: 2.5, // 2.5 dakika

  // Yüksek XP Aralığı
  // (Bu seviyeden sonra 10-25 aralığı 25-45'e yükselir)
  HIGH_XP_THRESHOLD_LEVEL: 15, 
  MIN_XP_HIGH: 25,
  MAX_XP_HIGH: 45,
  
  // Spam Filtresi (Bu, cooldown'dan ayrıdır)
  // 10 saniye içinde 5'ten fazla mesaj
  SPAM_WINDOW_SECONDS: 10,
  SPAM_MESSAGE_COUNT: 5,
};