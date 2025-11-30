require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const { init: i18nInit } = require('./utils/i18n'); 
const db = require('./database/sqlite');
const { CooldownManager } = require('./utils/cooldown');

// --- GÖRSEL MODÜLLER ---
const chalk = require('chalk');
const Table = require('cli-table3');
const logger = require('./utils/logger'); // Az önce oluşturduğumuz logger

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, 
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel],
});

// Global Koleksiyonlar
client.commands = new Collection();
client.slashCommands = new Collection();
client.voiceXPIntervals = new Map();
client.cooldownManager = new CooldownManager(); 
client.db = db; 

// --- BAŞLANGIÇ BANNERI ---
console.clear();
console.log(chalk.yellow(`
██████╗  ██████╗ ████████╗
██╔══██╗██╔═══██╗╚══██╔══╝
██████╔╝██║   ██║   ██║   
██╔══██╗██║   ██║   ██║   
██████╔╝╚██████╔╝   ██║   
╚═════╝  ╚═════╝    ╚═╝   
`));
logger.info('Bot başlatma protokolü devrede...');


// --- 1. Prefix Komut Yükleyici (Tablolu) ---
const prefixTable = new Table({
  head: [chalk.cyan('Prefix Komutları'), chalk.cyan('Durum')],
  style: { head: [], border: [] } // Varsayılan renkleri kaldır, chalk kullanacağız
});

const commandFolders = fs.readdirSync(path.join(__dirname, 'commands'));
for (const folder of commandFolders) {
  const commandFiles = fs.readdirSync(path.join(__dirname, 'commands', folder)).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    try {
      const command = require(path.join(__dirname, 'commands', folder, file));
      client.commands.set(command.name, command);
      prefixTable.push([command.name, chalk.green('Yüklendi')]);
    } catch (e) {
      prefixTable.push([file, chalk.red('Hata')]);
      logger.error(`${file} yüklenirken hata: ${e.message}`);
    }
  }
}
if (prefixTable.length > 0) console.log(prefixTable.toString());


// --- 2. Slash Komut Yükleyici (Tablolu) ---
const slashTable = new Table({
  head: [chalk.blue('Slash Komutları'), chalk.blue('Klasör'), chalk.blue('Durum')],
});

const slashFolders = fs.readdirSync(path.join(__dirname, 'slashCommands'));
for (const folder of slashFolders) {
  const slashFiles = fs.readdirSync(path.join(__dirname, 'slashCommands', folder)).filter(file => file.endsWith('.js'));
  for (const file of slashFiles) {
    try {
      const slashCommand = require(path.join(__dirname, 'slashCommands', folder, file));
      client.slashCommands.set(slashCommand.data.name, slashCommand);
      slashTable.push([slashCommand.data.name, folder, chalk.green('OK')]);
    } catch (e) {
      slashTable.push([file, folder, chalk.red('FAIL')]);
      logger.error(`${file} Slash komutu hatası: ${e.message}`);
    }
  }
}
console.log(slashTable.toString());


// --- 3. Event Yükleyici ---
const eventFolders = fs.readdirSync(path.join(__dirname, 'events'));
let eventCount = 0;
for (const folder of eventFolders) {
  const eventFiles = fs.readdirSync(path.join(__dirname, 'events', folder)).filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    const event = require(path.join(__dirname, 'events', folder, file));
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
    eventCount++;
    // Her event için satır harcamayalım, log atalım
    // logger.event(`${event.name} yüklendi.`);
  }
}
logger.success(`${eventCount} adet Event başarıyla dinleniyor.`);


// --- Bot Girişi (Asenkron IIFE) ---
(async () => {
  try {
    const i18nInstance = await i18nInit();
    client.i18n = i18nInstance;
    // logger.info('Dil sistemi (i18n) entegre edildi.');
    
    await client.login(process.env.DISCORD_TOKEN);
    // Not: "Bot giriş yaptı" mesajını artık ready.js'de daha havalı vereceğiz.

  } catch (error) {
    logger.error('Bot başlatılırken kritik hata!');
    console.error(error);
  }
})();