# Catatan perubahan

## A. Dari strategi UTS ke UAS (selesai sebelum freeze)
| Hal | UTS | UAS | Alasan |
|---|---|---|---|
| Pasar | Saham Kompas100 (harian) | Kripto IDR Indodax (1 jam) | Soal UAS |
| Data | Yahoo Finance (yfinance) | `history_v2` Indodax, ≥3 tahun, ditarik mundur | Soal UAS |
| Satuan parameter | hari | bar 1 jam | Timeframe berbeda |
| Eksekusi | Open bar berikutnya ± tick | Order book live: beli di ask, jual di bid | Soal UAS (fill mid/close dilarang) |
| Biaya | Fee 0,15% / 0,25% tetap + tick | Fee taker all-in + spread/slippage hasil ukur snapshot | Soal UAS |
| Sizing | 10% equity, maks 5% ADV20 | 25% equity, dibatasi kedalaman order book | Kripto: tidak ada ADV; likuiditas dari order book |
| Universe | Anggota Kompas100 per 15 Okt 2026 (bias penyintas) | 3–10 pair, likuiditas diukur di awal backtest | Hindari survivorship bias |
| Waktu keputusan | Close hari t, eksekusi open t+1 | Close bar 1 jam, eksekusi saat bot jalan (~menit ke-7) | Bot berjalan terjadwal |
| Risiko | – | Daily loss limit, kill switch, idempotency, validasi data | Soal UAS |
| Parameter dioptimasi | _(isi)_ | _(isi)_ | |

## B. Perbaikan bug setelah freeze (bukan perubahan aturan)
Isi setiap perbaikan: tanggal-waktu, commit hash, apa bug-nya, kenapa ini **tidak** mengubah aturan.

| Waktu (WIB) | Commit | Bug | Mengapa bukan perubahan aturan |
|---|---|---|---|
| | | | |
