# Bot Dry Run Indodax di Vercel (UAS Algorithmic Trading)

Bot ini membaca harga dan order book **asli** Indodax, menghitung sinyal dari candle 1 jam yang sudah tertutup,
lalu **mensimulasikan** order (dry run: tanpa uang sungguhan, tanpa API key). Strategi: versi UTS
(Donchian breakout + EMA tren + ADX + Chandelier exit), long-only.

## Bagaimana cara kerjanya (versi singkat)

1. **GitHub Actions** memanggil alamat `/api/tick` di Vercel setiap jam (menit ke-7).
2. `/api/tick` mengambil candle dan order book Indodax, membuang candle yang belum tertutup, mengecek data.
3. Sinyal dihitung oleh `src/signal.ts` — **fungsi yang sama persis dengan backtest**.
4. Kalau ada sinyal, order disimulasikan: **beli di ask, jual di bid**, menghabiskan beberapa level order book kalau perlu.
5. State (kas, posisi) dan semua log disimpan di **Upstash Redis**. Dashboard membaca log itu.

## Isi folder

| Folder/file | Fungsi |
|---|---|
| `src/config.ts` | **Semua aturan, parameter, universe.** Dibekukan saat freeze. |
| `src/signal.ts` | Fungsi sinyal (dipakai backtest dan bot) |
| `src/bot.ts` | Satu panggilan bot: data → sinyal → order simulasi → log |
| `src/sim.ts` | Mesin backtest |
| `src/metrics.ts` | Semua rumus angka dashboard (return, MDD, profit factor, uptime, dll.) |
| `api/tick.ts` `api/snapshot.ts` `api/kill.ts` `api/dashboard-data.ts` | Endpoint Vercel |
| `public/index.html` | Dashboard (Vercel dan versi offline) |
| `scripts/` | Skrip di laptop: tarik data, backtest, ukur spread, export log, bandingkan, hitung_ulang |
| `.github/workflows/jadwal.yml` | Penjadwal (tick + snapshot) |
| `docs/` | Strategi tertulis, catatan perubahan, refleksi, rencana harian, checklist |

## Langkah awal (sekali saja)

1. Pasang Node.js 20+ lalu jalankan `npm install`.
2. Salin `.env.example` menjadi `.env` dan isi (lihat langkah 4-5). **`.env` tidak boleh di-commit.**
3. Buat repositori GitHub **publik**, push semua file ini.
4. Buat database gratis **Upstash Redis** (Vercel → Storage → Marketplace). Salin `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN`.
5. Buat string acak panjang untuk `CRON_SECRET` (contoh: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`).
6. Di Vercel: Import repositori, lalu isi Environment Variables: `CRON_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Deploy.
7. Di GitHub: Settings → Secrets → Actions, isi `BOT_URL` (alamat Vercel) dan `CRON_SECRET` (sama dengan di Vercel).
8. Uji koneksi: tab Actions → "jadwal-bot" → Run workflow. Lalu buka `https://<proyek>.vercel.app/api/snapshot` dengan header Authorization (atau lihat hasil run di Actions). Kalau Indodax tidak bisa diakses dari Vercel, **lapor ke dosen sebelum freeze**.

## Perintah di laptop

| Perintah | Fungsi |
|---|---|
| `npm run cek-aturan` | Cetak fee, minimum order, kenaikan harga dari API publik (untuk diisi ke config dan STRATEGI.md) |
| `npm run tarik-data` | Tarik candle historis ≥3 tahun, mundur dari sekarang (jalan sekali, beberapa menit) |
| `npm run backtest -- --grid` | Coba beberapa parameter **hanya di data awal (in-sample)** |
| `npm run export-log` | Ambil semua log dari Upstash ke `data/logs/` |
| `npm run ukur-spread` | Hitung spread dan slippage nyata dari snapshot (untuk backtest) |
| `npm run backtest` | Backtest final → `data/backtest_result.json` (juga diunggah ke Upstash untuk dashboard) |
| `npm run tarik-data -- --recent` | Tarik candle ~60 hari terakhir (setelah forward test selesai) |
| `npm run bandingkan` | Bandingkan sinyal dan hasil backtest vs forward pada jendela yang sama |
| `npm run hitung-ulang` | Hitung ulang semua angka dari log mentah + buat `dist/dashboard_offline.html` |
| `npm run tes` | Tes alur bot memakai data **sintetis** (hanya uji logika, bukan hasil) |
| `npm run cek-tipe` | Cek tipe TypeScript |

## Kill switch (tanpa deploy ulang)

* Nyalakan: buka `https://<proyek>.vercel.app/api/kill?on=1` dengan header `Authorization: Bearer <CRON_SECRET>` (mis. `curl -H "Authorization: Bearer ..." "<url>/api/kill?on=1"`). Matikan dengan `on=0`.
* Atau set environment variable `KILL_SWITCH=1` di Vercel.
* Saat aktif: bot **tidak membuka posisi baru**; posisi yang ada tetap bisa ditutup oleh sinyal keluar. Setiap pemakaian tercatat di log `events`.

## Aturan penting

* Setelah **freeze**, jangan ubah `src/config.ts` maupun `src/signal.ts`. Bug yang tidak mengubah aturan boleh diperbaiki, **wajib dicatat** di `docs/CATATAN_PERUBAHAN.md`.
* Jangan `force-push` dan jangan menulis ulang riwayat commit.
* Jangan pernah commit `.env`, token, atau `CRON_SECRET`.
* Semua angka dashboard harus bisa dihitung ulang: `npm run export-log` lalu `npm run hitung-ulang`.

## Cara membuktikan freeze

Setelah semua aturan final: isi bagian "Freeze" di bawah, lalu `git add -A && git commit -m "FREEZE: aturan, parameter, universe, waktu mulai" && git push`.
Catat hash commit (`git log -1 --format=%H`) dan waktunya.

### Freeze

* Hash commit freeze: 83ce45f (Senin 9 November 2026, waktu commit lihat riwayat GitHub)
* Waktu mulai forward test: Senin 9 November 2026, 14.00 WIB (tradingStartUnix = 1794207600)
* Universe: btcidr, ethidr, solidr, xrpidr, dogeidr (likuiditas diukur di awal periode backtest, lihat docs/STRATEGI.md)
* Parameter: bl 144, tl 150, adxLen 14, adxMin 25, chandLen 22, chandMult 7; timeframe 1 jam
* Eksekusi: beli di ask, jual di bid; fee taker 0,41555%; minimum order Rp25.000; maksimum 3 posisi; 25% equity per posisi; daily loss limit 3%
* Durasi forward test: kurang dari 10 hari atas persetujuan dosen (pengumpulan 14 November 2026)
## Catatan jujur tentang kode ini

* Format respons API Indodax (`history_v2`, `depth`, `server_time`) ditulis berdasarkan dokumentasi publik, **tapi belum diuji ke server asli** dari lingkungan pembuatan. Jalankan `npm run tarik-data` dan lihat apakah bar masuk dengan benar. Kalau ada bidang yang berbeda, perbaiki di `src/indodax.ts` (fungsi `parseCandles` / `depth`) **sebelum freeze**.
* Tes lokal memakai data sintetis hanya untuk membuktikan alur bot; hasilnya bukan hasil strategi.
