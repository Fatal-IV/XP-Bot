const i18next = require('i18next');
const fs = require('fs'); 
const path = require('path'); 
const logger = require('./logger'); 

/**
 * i18next'i başlatır, çeviri dosyalarını MANUEL yükler
 * ve tam hazır instance'ı (örneği) geri döndürür.
 */
async function initializeI18next() {
  logger.i18nStart('Başlatılıyor... (Manuel Yükleme Modu)');

  let resources = {};
  const localesPath = path.join(__dirname, '..', 'locales'); 
  const projectRoot = path.join(__dirname, '..', '..');

  try {
    // 1. İngilizce'yi Yükle
    const enPath = path.join(localesPath, 'en', 'translation.json');
    const relativeEnPath = path.relative(projectRoot, enPath); 
    logger.i18nLoad(relativeEnPath);
    
    const enFile = fs.readFileSync(enPath, 'utf8');
    resources.en = { translation: JSON.parse(enFile) };
    logger.i18nSuccess('en');

    // 2. Türkçe'yi Yükle
    const trPath = path.join(localesPath, 'tr', 'translation.json');
    const relativeTrPath = path.relative(projectRoot, trPath);
    logger.i18nLoad(relativeTrPath);
    
    const trFile = fs.readFileSync(trPath, 'utf8');
    resources.tr = { translation: JSON.parse(trFile) };
    logger.i18nSuccess('tr');

  } catch (err) {
    logger.error(`Çeviri dosyaları okunurken KRİTİK HATA: ${err.message}`);
    throw new Error('Çeviri dosyaları okunamadı. Dosya yapısını kontrol edin.');
  }

  await i18next
    .init({
      debug: false,
      fallbackLng: 'en',
      supportedLngs: ['en', 'tr'],
      resources: resources,
      ns: 'translation',
      defaultNS: 'translation',
      
      // --- İŞTE BURASI: Değişken Tanıtımı (Interpolation) ---
      interpolation: {
        escapeValue: false, // Discord için KRİTİK (XSS korumasını kapatır, etiketlerin çalışmasını sağlar)
        prefix: '{{',       // Değişken başlangıcı
        suffix: '}}'        // Değişken bitişi
      }
    });
    
  logger.i18nDone('Çeviri modülleri başarıyla entegre edildi.');
  
  return i18next;
}

module.exports = {
  init: initializeI18next,
};