# Refleksi: backtest vs forward test

Isi **dengan angka** dari dashboard / `data/compare.json`. Hasil buruk yang bisa dibuktikan lebih baik daripada hasil bagus yang tidak bisa dibuktikan.

## 1. Ringkasan
Periode forward test: ... s/d ... (WIB). Jumlah candle: ... Uptime: ...%.
Return forward: ...% vs backtest (jendela sama): ...%. Selisih: ... poin.

## 2. Kecocokan sinyal
Sinyal dibandingkan candle demi candle: ... dari ... identik (...%). Jika < 100%, jelaskan setiap selisih (candle terlambat? data berubah?).

## 3. Selisih harga fill per trade
Tabel: trade, harga fill backtest, harga fill forward, selisih (%), penyebab (spread, slippage, keterlambatan jadwal).
Median selisih: ...%.

## 4. Spread
Spread yang dipakai backtest (median snapshot sampai freeze): ...% per pair.
Spread dari **seluruh** snapshot (sampai akhir forward): ...% per pair. Beda: ... Dampaknya ke selisih return: ...

## 5. Dampak keterlambatan jadwal
Median keterlambatan panggilan terhadap menit ke-0: ... menit. Panggilan terlambat melewati batas: ... Dampak ke uptime dan harga fill: ...

## 6. Porsi biaya
(fee + spread + slippage) / laba kotor: backtest ...% vs forward ...%.

## 7. Keterbatasan (jujur)
* Jumlah trade forward hanya ... → sulit menyimpulkan apa pun secara statistik.
* Snapshot sebelum freeze hanya ... jam.
* (isi lainnya)

## 8. Pelajaran
...
