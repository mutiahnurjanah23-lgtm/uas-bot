# Strategi tertulis (versi UAS)

Pemilik: Mutiah Nurjanah. Dibekukan pada commit `83ce45f` (Senin 9 November 2026). Forward test mulai Senin 9 November 2026 pukul 14.00 WIB (`tradingStartUnix = 1794207600`).

## 1. Ide
Mengikuti tren naik pada candle 1 jam: masuk saat harga menembus level tertinggi `bl` bar terakhir (breakout) **dan** berada di atas rata-rata tren **dan** tren cukup kuat (ADX). Keluar dengan stop yang mengikuti harga naik (Chandelier). Strategi **long-only**: tanpa short, margin, atau leverage.

## 2. Aturan (semua dari bar 1 jam yang SUDAH TERTUTUP)
**Masuk** (semua harus benar pada close bar sinyal):
1. `close` > tertinggi (high) dari `bl` bar sebelumnya (Donchian breakout).
2. `close` > EMA(`tl`) dari close.
3. ADX(`adxLen`) > `adxMin`.

**Keluar:** stop Chandelier = `max(high chandLen bar terakhir) - chandMult x ATR`. Stop hanya boleh naik. Keluar bila `close` < stop.

**Sizing:** maksimum 25% dari equity per posisi; maksimum 3 posisi terbuka.

**Risiko:** daily loss limit 3% (hari WIB, ganti pukul 00.00 WIB); kill switch manual (flag di storage atau environment variable, tercatat di log); bot tidak membuka posisi bila data tidak valid (candle usang, candle hilang, harga/volume nol, order book kosong, spread bid-ask > 2%); setiap candle hanya diproses sekali (idempotency); retry API terbatas.

**Eksekusi (dry run):** beli di ask, jual di bid dari order book live; bila order lebih besar dari level terbaik, level berikutnya dihabiskan dan dipakai harga rata-rata. Tidak ada fill di harga tengah atau close. Modal awal Rp100.000.000.

## 3. Parameter (dibekukan di `src/config.ts`)
| Parameter | Nilai | Cara memilih |
|---|---|---|
| bl (breakout) | 144 bar | Grid pada 70% data awal (3 Okt 2023 - 3 Des 2025) |
| tl (EMA tren) | 150 bar | Tetap dari versi UTS yang diskalakan ke bar 1 jam |
| adxLen | 14 | Tetap |
| adxMin | 25 | Grid pada data awal |
| chandLen | 22 | Tetap |
| chandMult | 7 | Grid pada data awal |
| Timeframe | 1 jam | Disarankan soal agar trade cukup banyak |

**Cara pemilihan.** Grid pertama (12 kombinasi, biaya cadangan 0,3% per sisi) semuanya rugi karena biaya. Setelah spread dan slippage diukur dari snapshot order book, grid kedua (36 kombinasi: bl {48, 96, 144, 216} x adxMin {20, 25, 30} x chandMult {3,5; 5; 7}) dijalankan **hanya pada 70% data awal**. Kombinasi dipilih di tengah dataran yang stabil (semua tetangga untung), bukan puncak tertinggi yang berada di tepi grid. Hasil di data awal untuk (144, 25, 7): return +121,8%, drawdown maksimum -27,1%, 181 trade. Parameter tidak dipilih ulang setelah melihat data akhir.

## 4. Universe dan kriteria
Pair: **BTC/IDR, ETH/IDR, SOL/IDR, XRP/IDR, DOGE/IDR** (`btcidr, ethidr, solidr, xrpidr, dogeidr`).

**Kriteria likuiditas:** median volume transaksi harian dalam rupiah (close x volume candle 1 jam, dijumlahkan per hari) pada **90 hari pertama setelah masa pemanasan indikator (20 Okt 2023 - 18 Jan 2024)**, minimal Rp3 miliar, dan data historis minimal 3 tahun (diukur: 1132 hari, 3 Okt 2023 - 8 Nov 2026).

| Pair | Median volume harian, awal periode | 30 hari terakhir | Lolos |
|---|---|---|---|
| btcidr | Rp21,8 miliar | Rp19,2 miliar | ya |
| ethidr | Rp7,6 miliar | Rp6,2 miliar | ya |
| solidr | Rp6,9 miliar | Rp5,6 miliar | ya |
| xrpidr | Rp5,6 miliar | Rp5,6 miliar | ya |
| dogeidr | Rp3,9 miliar | Rp1,8 miliar | ya |

**Survivorship bias.** Likuiditas diukur pada awal periode backtest, bukan hanya hari ini. Keterbatasan yang diakui: pool kandidat hanya lima pair besar; pair yang likuid di awal periode tetapi sudah di-delist tidak dapat diuji; batas Rp3 miliar ditetapkan setelah melihat angkanya. DOGE/IDR likuiditasnya turun lebih dari separuh dari awal periode.

## 5. Biaya dan batas (dicek 8 November 2026)
| Item | Sumber | Angka | URL | Tanggal akses |
|---|---|---|---|---|
| Fee taker (API) | `/api/pairs` `trade_fee_percent_taker` | 0,2% | https://indodax.com/api/pairs | 8 Nov 2026 |
| Fee taker beli, IDR Market (PRO) | Halaman Profil & Setting akun Indodax (tangkapan layar di `docs/`) | 0,20555% (service fee 0,2% + pajak 0% + biaya bursa 0,00555%) | Halaman Profil & Setting akun Indodax (perlu login) | 8 Nov 2026 |
| Fee taker jual, IDR Market (PRO) | idem | 0,41555% (service fee 0,2% + pajak 0,21% + biaya bursa 0,00555%) | Halaman Profil & Setting akun Indodax (perlu login) | 8 Nov 2026 |
| **Dipakai (yang lebih mahal)** | | **0,41555% untuk beli dan jual** | | |
| Minimum order | `/api/pairs` `trade_min_base_currency` vs mode Pro | Rp10.000 vs Rp25.000, dipakai **Rp25.000** | https://indodax.com/api/pairs | 8 Nov 2026 |
| Kenaikan harga | `/api/price_increments` | BTC dan ETH: 1000; SOL, XRP, DOGE: 1 | https://indodax.com/api/price_increments | 8 Nov 2026 |

Catatan: angka fee 0,2% dari API hanyalah service fee; total sebenarnya termasuk pajak dan biaya bursa, sehingga angka akun yang dipakai.

## 6. Spread dan slippage untuk backtest (diukur dari snapshot order book)
Ukuran order acuan Rp25.000.000. Jumlah snapshot per pair saat pengukuran: 9 (sedikit; snapshot terus dikumpulkan selama forward test dan dibandingkan di refleksi).

| Pair | Spread | Premi beli | Diskon jual |
|---|---|---|---|
| btcidr | 0,065% | 0,037% | 0,049% |
| ethidr | 0,041% | 0,048% | 0,035% |
| solidr | 0,097% | 0,049% | 0,082% |
| xrpidr | 0,080% | 0,040% | 0,079% |
| dogeidr | 0,158% | 0,079% | 0,100% |

## 7. Hasil backtest (3 Okt 2023 - 8 Nov 2026, parameter beku)
Return +47,8% (CAGR 13,4%), drawdown maksimum -39,6%, 265 trade, win rate 34,7%, profit factor 1,15, rata-rata untung Rp3,96 juta, rata-rata rugi Rp1,83 juta. Fee total Rp94,7 juta, spread dan slippage Rp13,3 juta, laba kotor Rp155,9 juta, sehingga **porsi biaya 69,3%**. Benchmark buy and hold BTC/IDR: **+218,7%**.

Hasil ini mencampur data awal (tempat parameter dipilih, +121,8%) dan data akhir (Des 2025 - Nov 2026), yang memburuk: sekitar -33% (perkiraan kasar). Strategi **kalah dari buy and hold BTC** dan sangat sensitif pada biaya. Sebagai pembanding, parameter cepat yang mirip UTS (bl 48, adxMin 20, chandMult 3) rugi -75,8% dengan 856 trade karena fee total Rp109,4 juta melahap modal.

## 8. Timeframe dan jadwal
1 jam. GitHub Actions memanggil `/api/tick` tiap jam pada menit ke-7 dan `/api/snapshot` pada menit ke-37; cron-job.org memanggil `/api/tick` pada menit ke-5 (penjadwal kedua untuk memperkuat uptime). Candle hanya diproses setelah tertutup; panggilan ganda untuk candle yang sama dilewati.
