// =====================================================================
//  CONFIG = semua aturan, parameter, dan universe.
//  Setelah FREEZE, file ini TIDAK BOLEH diubah (kecuali bug yang tidak
//  mengubah aturan, dan wajib dicatat di docs/CATATAN_PERUBAHAN.md).
//  Bagian bertanda "ISI" harus kamu isi sebelum freeze.
// =====================================================================
export const CONFIG = {
  // ISI: waktu mulai forward test, dalam DETIK unix (UTC). Contoh membuatnya:
  //   node -e "console.log(Math.floor(new Date('2026-11-09T00:00:00+07:00')/1000))"
  // Sebelum waktu ini bot HANYA mengumpulkan snapshot order book, tidak bertransaksi.
     tradingStartUnix: 1794207600,

  // Timeframe 1 jam (disarankan soal agar trade cukup banyak)
  tf: "60",
  tfSeconds: 3600,

  // ISI: universe 3-10 pasangan IDR (id huruf kecil seperti di API). Ini CONTOH.
  // Tulis kriteria pemilihannya di docs/STRATEGI.md.
  pairs: ["btcidr", "ethidr", "solidr", "xrpidr", "dogeidr"],

  // Parameter strategi (Donchian + EMA + ADX + Chandelier). Satuan = BAR 1 jam.
   params: { bl: 144, tl: 150, adxLen: 14, adxMin: 25, chandLen: 22, chandMult: 7 },
  exec: {
    // ISI: tarif taker all-in (%) -> pakai yang LEBIH MAHAL antara /api/pairs dan halaman biaya resmi.
    // Cantumkan kedua angka, URL, dan tanggal akses di docs/STRATEGI.md. Selama NaN, bot menolak jalan.
       feeTakerPct: 0.41555 as number,
    minOrderIdr: 25000,   // pakai yang lebih ketat (Pro mode Rp25.000), kecuali halaman resmi menyatakan lain
    qtyDecimals: 8,       // ISI: pembulatan kuantitas (cek per pair dengan npm run cek-aturan)
    maxSpreadPct: 2,      // aturan soal: spread > 2% -> tidak buka posisi
  },

  risk: {
    initialCash: 100_000_000,
    maxPositions: 3,          // batas jumlah posisi terbuka
    maxPositionPct: 0.25,     // ukuran maksimum per posisi = 25% dari equity
    dailyLossLimitPct: 3,     // rugi harian > 3% -> stop buka posisi baru sampai hari WIB berikutnya
  },

  // Biaya untuk backtest bila snapshot belum cukup (akan diberi PERINGATAN).
  // Nilai asli diukur dari snapshot: npm run ukur-spread
  backtestFallback: { buyPremiumPct: 0.3, sellDiscountPct: 0.3 },
};

export type Config = typeof CONFIG;
