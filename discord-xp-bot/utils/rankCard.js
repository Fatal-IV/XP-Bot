// utils/rankCard.js
const { createCanvas, loadImage } = require('canvas');
const { AttachmentBuilder } = require('discord.js');
const { getLevelProgress } = require('./levelSystem');

// Yuvarlak köşeli dikdörtgen çizim fonksiyonu
function roundedRect(ctx, x, y, w, h, r, color) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (color) ctx.fillStyle = color;
  ctx.fill();
}

// Avatarı daire içinde çizme fonksiyonu
function drawCircularImage(ctx, img, cx, cy, r, border = 0, color = '#fff') {
  ctx.save();
  if (border > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r + border, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

// Arka plan için Bokeh efekti
function drawBokeh(ctx, W, H) {
  const colors = ['#D47B2F', '#E89A45'];
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 40 + Math.random() * 80;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const opacity = 0.05 + Math.random() * 0.15;

    const rgb = [
      parseInt(color.slice(1, 3), 16),
      parseInt(color.slice(3, 5), 16),
      parseInt(color.slice(5, 7), 16)
    ];

    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${opacity})`);
    grad.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

async function generateRankCard(member, userStats, rank) {
  const W = 900, H = 300;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const user = member.user;

  // --- HESAPLAMALAR ---
  // Ana ilerleme (Avatar etrafındaki halka) sadece Metin XP'ye (Ana Level) bağlıdır.
  const mainProgressXP = userStats.text_xp || 0; 
  const totalProgress = getLevelProgress(mainProgressXP);
  
  const ringRequired = totalProgress.requiredXP || 1;
  const ringProgress = totalProgress.currentXP / ringRequired;

  // --- ARKA PLAN ÇİZİMİ ---
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0.00, '#2A1C26');
  grad.addColorStop(0.20, '#5A2E22');
  grad.addColorStop(0.45, 'rgba(253,93,168,0.70)');
  grad.addColorStop(0.70, '#B35A1E');
  grad.addColorStop(1.00, '#E89A45');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Siyah yarı saydam perde
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, W, H);

  // Bokeh efektleri
  drawBokeh(ctx, W, H);

  // Buzlu cam paneli
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  roundedRect(ctx, 40, 30, W - 80, H - 60, 25);

  // --- AVATAR VE HALKA ---
  const avatarURL = user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
  let avatar = null;
  try {
    avatar = await loadImage(avatarURL);
  } catch (e) {
    console.error('Avatar yüklenirken hata:', e);
  }

  const avX = 130;
  const avY = 150;
  const avR = 60;

  // Halka arka planı (sönük çizgi)
  ctx.beginPath();
  ctx.arc(avX, avY, avR + 14, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 10;
  ctx.stroke();

  // Aktif XP Halkası (Ana Level Durumu)
  const ringGrad = ctx.createLinearGradient(0, 0, W, H);
  ringGrad.addColorStop(0, '#FF8A3C');
  ringGrad.addColorStop(1, '#E47A24');

  ctx.beginPath();
  ctx.arc(
    avX,
    avY,
    avR + 14,
    -Math.PI / 2,
    -Math.PI / 2 + Math.max(0, Math.min(1, ringProgress)) * Math.PI * 2
  );
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth = 10;
  ctx.stroke();

  if (avatar) {
    drawCircularImage(ctx, avatar, avX, avY, avR, 4, '#fff');
  }

  // --- KULLANICI BİLGİSİ ---
  const tag = user.discriminator === '0' ? `@${user.username}` : user.tag;

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '600 38px "Segoe UI"';
  ctx.fillText(member.displayName, 240, 95, 460); // İsim uzunsa sığdır

  ctx.font = '24px "Segoe UI"';
  ctx.fillText(tag, 240, 130);

  // --- SAĞ ÜST LEVEL & RANK KUTUCUKLARI ---
  const chipY = 60, chipH = 36, chipR = 12;
  const chipLevelX = W - 280;
  const chipRankX = chipLevelX + 120;

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundedRect(ctx, chipLevelX, chipY, 100, chipH, chipR);
  roundedRect(ctx, chipRankX, chipY, 100, chipH, chipR);

  ctx.fillStyle = '#FFB86B';
  ctx.font = 'bold 14px "Segoe UI"';
  ctx.fillText('LEVEL', chipLevelX + 14, chipY + 24);
  ctx.fillText('RANK', chipRankX + 14, chipY + 24);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px "Segoe UI"';
  ctx.textAlign = 'right';
  
  // Buradaki LEVEL ana leveldir (Text Level)
  ctx.fillText(totalProgress.level, chipLevelX + 86, chipY + 24);
  ctx.fillText(`#${rank}`, chipRankX + 86, chipY + 24);
  ctx.textAlign = 'left';

  // --- İLERLEME ÇUBUKLARI (TEXT & VOICE) ---
  const barX = 240, barW = W - barX - 60, barH = 30, barR = 15;

  const voiceXP = userStats.voice_xp || 0;

  // Text ve Voice ilerlemelerini ayrı ayrı hesaplıyoruz
  const textProgress = totalProgress; 
  const voiceProgress = getLevelProgress(voiceXP); 

  const bars = [
    {
      y: 185,
      label: '💭 TEXT',
      color1: '#E47A24',
      color2: '#D0601F',
      progress: textProgress
    },
    {
      y: 235,
      label: '🎙 VOICE',
      color1: '#D47B2F',
      color2: '#B35A1E',
      progress: voiceProgress
    }
  ];

  bars.forEach(b => {
    // 'level' bilgisini de alıyoruz
    const { currentXP, requiredXP, level } = b.progress; 
    const safeReq = requiredXP || 1;
    
    // Bar doluluk oranı
    const ratio = Math.max(0, Math.min(1, currentXP / safeReq));
    const fillW = Math.max(barR * 2, ratio * barW);

    // 1. Boş Bar Arka Planı
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundedRect(ctx, barX, b.y, barW, barH, barR);

    // 2. Dolu Kısım (Gradyan)
    const gradBar = ctx.createLinearGradient(barX, b.y, barX + fillW, b.y + barH);
    gradBar.addColorStop(0, b.color1);
    gradBar.addColorStop(1, b.color2);

    ctx.fillStyle = gradBar;
    roundedRect(ctx, barX, b.y, fillW, barH, barR);

    // 3. Yazılar (Bar İçi)
    ctx.fillStyle = '#000'; // Siyah yazı (okunabilirlik için)
    ctx.font = 'bold 15px "Segoe UI"';
    
    // YENİ: Etiketin yanına level bilgisini ekliyoruz (Örn: "🎙 VOICE • Lv. 5")
    const labelWithLevel = `${b.label}  •  Lv. ${level}`; 
    ctx.fillText(labelWithLevel, barX + 14, b.y + 20);
    
    // XP Sayacı (Sağ taraf)
    ctx.textAlign = 'right';
    const displayCurrentXP = Math.min(currentXP, requiredXP); 
    ctx.fillText(`${displayCurrentXP} / ${requiredXP} XP`, barX + barW - 14, b.y + 20);
    ctx.textAlign = 'left';
  });

  return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'rank-card.png' });
}

module.exports = { generateRankCard };