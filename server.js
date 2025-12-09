const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const ESP32_IP = "http://192.168.1.103";
const POLL_INTERVAL = 3000;
const ESP_TIMEOUT = 4000;

let sonVeri = null;

// ✅ ESP32’den veri çek
async function veriCek() {
  try {
    const response = await axios.get(`${ESP32_IP}/api/data`, {
      timeout: ESP_TIMEOUT
    });

    const veri = response.data;
    sonVeri = veri;

    console.log(
      `📊 Nem:%${veri.nem} Pompa:${veri.pompa ? "AÇIK" : "KAPALI"} Su:${veri.su} Sulama:${veri.sulama}`
    );

    io.emit('veriGuncelle', veri);

  } catch (err) {
    console.log("❌ ESP32 bağlantı yok:", err.message);
    if (sonVeri) io.emit('veriGuncelle', sonVeri);
  }
}

setInterval(veriCek, POLL_INTERVAL);

// ✅ Manuel sulama
app.post('/api/sulama', async (req, res) => {
  try {
    await axios.post(`${ESP32_IP}/api/sulama`, {}, { timeout: ESP_TIMEOUT });
    res.json({ durum: "OK" });
  } catch (err) {
    console.log("❌ Manuel sulama hatası:", err.message);
    res.status(500).json({ hata: "ESP32'ye ulaşılamadı" });
  }
});

// ✅ Socket
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
