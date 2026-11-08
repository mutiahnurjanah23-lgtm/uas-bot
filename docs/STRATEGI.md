# Strategi tertulis (versi UAS)

## 1. Ide
Mengikuti tren naik: masuk saat harga menembus level tertinggi N bar terakhir (breakout) **dan** berada di atas rata-rata tren **dan** tren cukup kuat (ADX). Keluar dengan stop yang mengikuti harga naik (Chandelier). Long-only: tanpa short, margin, atau leverage.

## 2. Aturan (semua dihitung dari bar 1 jam yang SUDAH TERTUTUP)
**Masuk** (semua harus benar pada close bar sinyal):
1. `close` > tertinggi (high) dari `bl` bar sebelumnya (Donchian breakout)
2. `close` > EMA(`tl`) dari close
3. ADX(`adxLen`) > `adxMin`

**Keluar:** stop Chandelier = `max(high chandLen bar) − chandMult × ATR`. Stop hanya boleh naik. Keluar bila `close` < stop.

**Sizing:** maksimum `maxPositionPct` (25%) dari equity per posisi; maksimum `maxPositions` (3) posisi.

**Risiko:** daily loss limit 3% (hari WIB), kill switch, tidak buka posisi bila data tidak valid / spread > 2%.

**Eksekusi:** beli di ask, jual di bid dari order book live (rata-rata menembus level). Modal awal Rp100.000.000.

## 3. Parameter (dibekukan di `src/config.ts`)
| Parameter | Nilai | Cara memilih |
|---|---|---|
| bl | _(isi)_ | grid in-sample, tanggal ... |
| tl | _(isi)_ | |
| adxMin | _(isi)_ | |
| adxLen / chandLen / chandMult | _(isi)_ | |

## 4. Universe dan kriteria
Pair: _(isi 3–10 pair)_

Kriteria likuiditas: _(contoh: rata-rata volume harian IDR pada **awal periode backtest** ≥ Rp ...)_.
Cara menghindari survivorship bias: _(jelaskan: likuiditas diukur pada tanggal awal backtest, bukan hari ini; pair yang datanya < 3 tahun tidak dipakai / dicatat)_.

## 5. Sumber biaya dan batas (cek ulang sebelum freeze)
| Item | Sumber | Angka | URL | Tanggal akses |
|---|---|---|---|---|
| Fee taker (API) | `/api/pairs` `trade_fee_percent_taker` | | https://indodax.com/api/pairs | |
| Fee taker (halaman resmi) | Rincian Biaya Transaksi | | https://help.indodax.com | |
| **Dipakai (yang lebih mahal)** | | | | |
| Minimum order | `/api/pairs` vs mode Pro | Rp10.000 vs Rp25.000 → pakai Rp25.000 | | |
| Kenaikan harga / pembulatan kuantitas | `/api/price_increments`, `/api/pairs` | | | |

## 6. Timeframe dan jadwal
1 jam. GitHub Actions memanggil `/api/tick` tiap jam menit ke-7 (UTC), `/api/snapshot` menit ke-37. Candle diproses hanya setelah tertutup.
