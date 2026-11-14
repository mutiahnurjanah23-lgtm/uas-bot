# Catatan perubahan

## A. Dari strategi UTS ke UAS (selesai sebelum freeze)
| Hal | UTS | UAS | Alasan |
|---|---|---|---|
| Pasar | Saham Kompas100 (harian) | Kripto IDR Indodax (1 jam) | Soal UAS |
| Data | Yahoo Finance | `history_v2` Indodax, 1132 hari (3 Okt 2023 - 8 Nov 2026), ditarik mundur | Soal UAS |
| Satuan parameter | hari | bar 1 jam (bl 144, tl 150, chandMult 7, dst.) | Timeframe berbeda |
| Eksekusi | Open bar berikutnya +/- tick | Order book live: beli di ask, jual di bid, rata-rata beberapa level | Soal UAS (fill di mid/close dilarang) |
| Biaya | Fee tetap + tick | Fee taker all-in 0,41555% + spread/slippage hasil ukur snapshot | Soal UAS |
| Sizing | lihat laporan UTS | 25% equity per posisi, maksimum 3 posisi | Kripto tidak punya ADV saham; likuiditas dari order book |
| Universe | Anggota Kompas100 per tanggal tertentu (bias penyintas) | 5 pair IDR, likuiditas diukur di awal periode backtest | Hindari survivorship bias |
| Waktu keputusan | Close hari t, eksekusi open t+1 | Close bar 1 jam, eksekusi saat bot jalan (sekitar 1-8 menit setelah bar tertutup) | Bot berjalan terjadwal |
| Manajemen risiko | - | Daily loss limit, kill switch, idempotency, validasi data, retry terbatas | Soal UAS |
| Pemilihan parameter |  | Grid 36 kombinasi pada 70% data awal; titik tengah dataran stabil | Hindari memilih puncak di tepi grid |

### Perbaikan sebelum freeze (bukan perubahan aturan)
| Tanggal | Perubahan | Alasan |
|---|---|---|
| 8 Nov 2026 | `src/storage.ts` menerima nama variabel `KV_REST_API_URL`/`KV_REST_API_TOKEN` selain `UPSTASH_REDIS_REST_*` | Integrasi Upstash di Vercel memakai awalan KV |
| 9 Nov 2026 | `scripts/backtest.ts`: pencarian tanggal terawal dengan perulangan, bukan `Math.min(...)` | Bug "Maximum call stack size exceeded" pada data besar |
| 8-9 Nov 2026 | Rentang grid parameter di `scripts/backtest.ts` diperluas | Optimum grid pertama berada di tepi |

## B. Setelah freeze (bukan perubahan aturan)
Freeze: commit `83ce45f` ("FREEZE: aturan, parameter, universe, waktu mulai"), Senin 9 November 2026 (jam commit: lihat `docs/bukti_freeze.png`). `src/config.ts` dan `src/signal.ts` tidak diubah setelah commit itu.

| Waktu (WIB) | Commit / tindakan | Keterangan | Mengapa bukan perubahan aturan |
|---|---|---|---|
| 9 Nov 2026, setelah freeze | `catat hash freeze di README` | README memuat hash commit freeze | Hanya dokumentasi |
| 9 Nov 2026, sekitar 14.01 | Panggilan manual `/api/tick` dari laptop | Uji endpoint setelah waktu mulai; hasil `status ok`, 5 pair terproses, 0 order | Tidak mengubah kode |
| 9 Nov 2026, 14.05 | cron-job.org: eksekusi pertama gagal 401 | Header `Authorization` belum benar di penjadwal | Konfigurasi penjadwal luar, bukan kode atau aturan |
| 9 Nov 2026, setelah 14.05 | cron-job.org: header diperbaiki | ; eksekusi terjadwal pertama yang berhasil: 9 Nov 2026 pukul 15.05 WIB (200 OK)| Konfigurasi penjadwal luar |
| 9 Nov 2026 | Perlindungan Vercel Authentication dimatikan (sebelum freeze) | Dashboard harus bisa dibuka dosen; endpoint bot tetap dilindungi `CRON_SECRET` | Pengaturan platform |

| 12 Nov 2026, 19.30.05-19.30.39 | Uji kill switch manual lewat /api/kill | Dinyalakan 19.30.05, satu panggilan /api/tick tercatat "kill_switch_aktif" pukul 19.30.21, dimatikan 19.30.39 (34 detik), dilakukan di menit ke-30 setelah candle jam itu diproses | Operasi uji, tidak mengubah kode atau aturan |