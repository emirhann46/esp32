const fs = require('fs');

// ===============================
// TARİHLER (SENİN İSTEDİĞİN GİBİ)
// ===============================
const startDate = new Date('2025-12-28T00:00:00'); // 28 Aralık 2025 Pazar
const endDate = new Date('2026-01-07T23:59:59'); // 7 Ocak 2026

// ===============================
// MOCK VERİLER
// ===============================
let mockData = [];

// ===============================
// VERİ ÜRETİMİ (30 DAKİKA)
// ===============================
function generateMockData() {
  let currentDate = new Date(startDate);
  let toplamSulama = 0;
  let pompa = false;

  while (currentDate <= endDate) {
    // Nem değerini biraz gerçekçi yapalım
    let nem = Math.floor(Math.random() * 50) + 30; // 30–80 arası

    // Eşik mantığı (projeyle birebir)
    if (nem < 35) {
      pompa = true;
      toplamSulama++;
    } else if (nem > 65) {
      pompa = false;
    }

    const data = {
      timestamp: currentDate.toISOString(),
      nem: nem,
      pompa: pompa,
      su: "DEPO DOLU",
      sulama: toplamSulama
    };

    mockData.push(data);

    // 30 dakika ekle
    currentDate = new Date(currentDate.getTime() + 30 * 60 * 1000);
  }

  fs.writeFileSync(
    'mock_data.json',
    JSON.stringify(mockData, null, 2),
    'utf-8'
  );

  console.log(`✅ ${mockData.length} adet mock veri üretildi`);
}

// Çalıştır
generateMockData();
