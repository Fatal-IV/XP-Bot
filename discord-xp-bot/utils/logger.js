// utils/logger.js
const chalk = require('chalk');
const moment = require('moment');

function timestamp() {
  return moment().format('DD-MM-YYYY HH:mm:ss');
}

module.exports = {
  success: (message) => {
    // Boşluklar kaldırıldı
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.green.bold('[BAŞARILI]')} ${message}`);
  },
  error: (message) => {
    // Boşluklar kaldırıldı
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.red.bold('[HATA]')} ${message}`);
  },
  warn: (message) => {
    // Boşluklar kaldırıldı
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.yellow.bold('[UYARI]')} ${message}`);
  },
  info: (message) => {
    // Boşluklar kaldırıldı
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.cyan.bold('[BİLGİ]')} ${message}`);
  },
  event: (message) => {
    // Boşluklar kaldırıldı
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.magenta.bold('[EVENT]')} ${message}`);
  },
  
  // --- YENİ: i18n İşlem Logları ---
  i18nStart: (message) => {
    // Zaman damgası ve mor renk
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.magenta.bold('[i18n]')} ${message}`);
  },
  i18nLoad: (path) => {
    // Yüklenen dosyayı açık gri ile gösterir
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.magenta.bold('[i18n]')} ${chalk.gray('-> Okunuyor:')} ${chalk.white(path)}`);
  },
  i18nSuccess: (lang) => {
    // Başarıyla yüklendi
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.magenta.bold('[i18n]')} ${chalk.green.bold(`[${lang}]`)} Başarıyla yüklendi.`);
  },
  i18nDone: (message) => {
    // Tüm süreç bittiğinde tek bir özet log
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.magenta.bold('[i18n]')} ${chalk.yellow(message)}`);
  },

  // Loader'ı olduğu gibi bırakıyoruz
  loader: (type, name, status) => {
    const icon = status ? chalk.green('✔') : chalk.red('✘');
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.blue.bold(`[${type}]`)} ${name} ${icon}`);
  }
};