const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ---------------------------------------
// 🔗 ESP32 IP
// ---------------------------------------
const ESP32_IP = "http://10.36.36.212";

// ---------------------------------------
// 🔗 N8N WEBHOOK
// ---------------------------------------
const WEBHOOK_URL =
  "https://n8n-emirhan.com.tr/webhook/c00e68ed-38b7-46e7-b56f-0fc59a41e753";

// ---------------------------------------
let sonVeri = null;
let sonSesZamani = 0;
const SES_GECIKME = 5000;
let sonGonderilenDurum = null;

// ---------------------------------------
// 🔊 Ses Çalma
// ---------------------------------------
function sesCal(dosya) {
  exec(`mpg123 ${dosya}`, (err) => {
    if (err) console.log("❌ Ses çalınamadı:", err.message);
  });
}

// ---------------------------------------
// 📲 Telegram / N8N Webhook
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
// 📦 MOCK DATA YÜKLE
// ---------------------------------------
let mockData = [];

try {
  mockData = JSON.parse(fs.readFileSync('./mock_data.json', 'utf-8'));
  console.log(`📦 Mock data yüklendi: ${mockData.length} kayıt`);
} catch (err) {
  console.log("❌ Mock data okunamadı:", err.message);
}

// ---------------------------------------
// 🔄 ESP32 Veri Döngüsü
// ---------------------------------------
setInterval(async () => {
  try {
    const res = await axios.get(`${ESP32_IP}/api/data`, { timeout: 4000 });
    const veri = res.data;

    const nem = veri.nem;
    const simdi = Date.now();

    // 🔊 SES EŞİKLERİ
    if (nem < 35 && simdi - sonSesZamani > SES_GECIKME) {
      sesCal("0002.mpeg");
      sonSesZamani = simdi;
    }

    if (nem > 65 && simdi - sonSesZamani > SES_GECIKME) {
      sesCal("0001.mpeg");
      sonSesZamani = simdi;
    }

    // 📲 TELEGRAM BOT
    let yeniDurum = null;
    if (nem < 25) yeniDurum = "🌱 Bitki susadı! Toprak çok kuru 😢";
    else if (nem > 65) yeniDurum = "💧 Su yeterli, her şey yolunda 🌿";

    if (yeniDurum && yeniDurum !== sonGonderilenDurum) {
      webhookMesajGonder(`Nem: %${nem}\n${yeniDurum}`);
      sonGonderilenDurum = yeniDurum;
    }

    // 📈 Canlı veri mock listesine eklenir
    const liveEntry = {
      timestamp: new Date().toISOString(),
      ...veri
    };

    mockData.push(liveEntry);
    sonVeri = veri;

    // 💾 Dosyaya kaydet
    try {
      fs.writeFileSync('./mock_data.json', JSON.stringify(mockData, null, 2));
    } catch (writeErr) {
      console.log("❌ Veri kaydedilemedi:", writeErr.message);
    }

    console.log(
      `📊 GERÇEK Nem:%${nem} Pompa:${veri.pompa ? "AÇIK" : "KAPALI"}`
    );

    io.emit("veriGuncelle", liveEntry);

  } catch (err) {
    console.log("❌ ESP32 bağlantı yok:", err.message);
  }
}, 3000);

// ---------------------------------------
// 🔌 Socket
// ---------------------------------------
io.on('connection', (socket) => {
  console.log('✅ Client bağlandı');

  // 🔹 Önce geçmiş veriler
  socket.emit("mockData", mockData);

  // 🔹 Son canlı veri
  if (sonVeri) socket.emit("veriGuncelle", sonVeri);

  socket.on('disconnect', () => {
    console.log('❌ Client ayrıldı');
  });
});

const envPort = Number.parseInt(process.env.PORT, 10);
const BASE_PORT = Number.isFinite(envPort) && envPort > 0 ? envPort : 3000;
const MAX_PORT_TRIES = 5;

function startServer(port, attemptsLeft) {
  const onError = (err) => {
    if (err.code === "EADDRINUSE" && attemptsLeft > 0) {
      const nextPort = port + 1;
      console.log(`⚠️ Port ${port} kullanımda, ${nextPort} deneniyor...`);
      startServer(nextPort, attemptsLeft - 1);
      return;
    }

    console.log("❌ Sunucu başlatılamadı:", err.message);
    process.exit(1);
  };

  server.once("error", onError);
  server.listen(port, () => {
    server.off("error", onError);
    console.log(`🚀 Sunucu çalışıyor → http://localhost:${port}`);
  });
}

startServer(BASE_PORT, MAX_PORT_TRIES);
