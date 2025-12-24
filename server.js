const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const { exec } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ---------------------------------------
// 🔗 ESP IP
// ---------------------------------------
const ESP32_IP = "http://10.251.131.212";

// ---------------------------------------
// 🔗 N8N WEBHOOK
// ---------------------------------------
const WEBHOOK_URL = "https://n8n-emirhan.com.tr/webhook/c00e68ed-38b7-46e7-b56f-0fc59a41e753";

// ---------------------------------------
let sonVeri = null;
let sonSesZamani = 0;
const SES_GECIKME = 5000;

let sonGonderilenDurum = null; // spam engelleme

// ---------------------------------------
// Ses çalma fonksiyonu
// ---------------------------------------
function sesCal(dosya) {
  exec(`mpg123 ${dosya}`, (err) => {
    if (err) console.log("❌ Ses çalınamadı:", err.message);
  });
}

// ---------------------------------------
// 🔔 Telegram / N8N Bildirim Fonksiyonu
// ---------------------------------------
async function webhookMesajGonder(text) {
  try {
    await axios.post(WEBHOOK_URL, { mesaj: text });
    console.log("📨 Webhook gönderildi →", text);
  } catch (err) {
    console.log("❌ Webhook hatası:", err.message);
  }
}

// ---------------------------------------
// 🔄 ESP32 Veri Çekme Döngüsü
// ---------------------------------------
setInterval(async () => {
  try {
    const res = await axios.get(`${ESP32_IP}/api/data`, { timeout: 4000 });
    const veri = res.data;

    const nem = veri.nem;
    const simdi = Date.now();

    // ---------------------------------------
    // 🔊 SES EŞİKLERİ (aynı kaldı)
    // ---------------------------------------
    if (nem < 35) {
      if (simdi - sonSesZamani > SES_GECIKME) {
        console.log("🔊 0002.mpeg (SUSADIM)");
        sesCal("0002.mpeg");
        sonSesZamani = simdi;
      }

    } else if (nem > 65) {
      if (simdi - sonSesZamani > SES_GECIKME) {
        console.log("🔊 0001.mpeg (SU YETERLİ)");
        sesCal("0001.mpeg");
        sonSesZamani = simdi;
      }
    }

    // ---------------------------------------
    // 📲 TELEGRAM / WEBHOOK NEM BOTU
    // ---------------------------------------
    let yeniDurum = null;

    if (nem < 25) yeniDurum = "SUSADIM 😢 Toprak çok kuru!";
    else if (nem > 65) yeniDurum = "SU YETERLİ 💧🌱";

    if (yeniDurum && yeniDurum !== sonGonderilenDurum) {
      webhookMesajGonder(`Nem: %${nem} → ${yeniDurum}`);
      sonGonderilenDurum = yeniDurum;
    }

    // ---------------------------------------
    // Arayüze veri gönder
    // ---------------------------------------
    sonVeri = veri;

    console.log(
      `📊 GERÇEK Nem:%${nem} Pompa:${veri.pompa ? "AÇIK" : "KAPALI"}`
    );

    io.emit("veriGuncelle", veri);

  } catch (err) {
    console.log("❌ ESP32 bağlantı yok:", err.message);
    if (sonVeri) io.emit('veriGuncelle', sonVeri);
  }

}, 3000);

// ---------------------------------------
// Socket bağlantısı
// ---------------------------------------
io.on('connection', (socket) => {
  console.log('✅ Client bağlandı');
  if (sonVeri) socket.emit('veriGuncelle', sonVeri);

  socket.on('disconnect', () => {
    console.log('❌ Client ayrıldı');
  });
});

server.listen(3000, () => {
  console.log(`\n🚀 Sunucu çalışıyor: http://localhost:3000\n`);
});
