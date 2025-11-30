const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); 
require('dotenv').config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID; // ARTIK .ENV DOSYASINDAN GELİYOR

// --- GÜVENLİK KONTROLÜ ---
if (!token || !clientId) {
    console.error('❌ HATA: .env dosyasında DISCORD_TOKEN veya CLIENT_ID eksik!');
    process.exit(1);
}

const commands = [];
const foldersPath = path.join(__dirname, 'slashCommands');
const commandFolders = fs.readdirSync(foldersPath);

// Komutları oku
for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
    } else {
      console.log(`[UYARI] ${filePath} dosyasındaki komut 'data' veya 'execute' özelliğine sahip değil.`);
    }
  }
}

// --- AKILLI KONTROL SİSTEMİ ---
const hashFile = path.join(__dirname, 'commands-hash.json');

// Mevcut komutların hash'ini hesapla
const currentHash = crypto.createHash('sha256').update(JSON.stringify(commands)).digest('hex');

// Eski hash'i kontrol et
let lastHash = '';
if (fs.existsSync(hashFile)) {
    try {
        lastHash = JSON.parse(fs.readFileSync(hashFile, 'utf8')).hash;
    } catch (e) {
        console.log('[Bilgi] Hash dosyası okunamadı, yeniden oluşturulacak.');
    }
}

// Eğer zorla yükleme parametresi (--force) yoksa ve hashler aynıysa dur
const forceUpdate = process.argv.includes('--force');

if (!forceUpdate && currentHash === lastHash) {
    console.log('✅ Komutlarda değişiklik algılanmadı. Discord API isteği atlandı.');
    console.log('ℹ️  Zorla güncellemek için: node deploy-commands.js --force');
    process.exit(0);
}
// --- KONTROL SONU ---

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`🔄 Değişiklikler algılandı. Toplam ${commands.length} komut (Client ID: ${clientId}) yenileniyor...`);

    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands },
    );

    // Başarılı olursa yeni hash'i kaydet
    fs.writeFileSync(hashFile, JSON.stringify({ hash: currentHash, lastUpdate: Date.now() }));

    console.log(`✅ Başarıyla ${data.length} komut yüklendi ve hash güncellendi.`);
    
  } catch (error) {
    console.error('❌ Komut yükleme hatası:', error);
  }
})();