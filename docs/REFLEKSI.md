# Refleksi: backtest vs forward test

Angka di dokumen ini dibekukan pada ekspor log **Sabtu 14 November 2026** (jendela forward test berakhir 11.05 WIB) dan sama dengan `dist/dashboard_offline.html` serta hasil `npm run hitung-ulang`. Dashboard Vercel terus berjalan setelah pengumpulan sehingga angkanya akan melampaui angka di sini.

## 1. Ringkasan
* Forward test dimulai Senin 9 November 2026 pukul 14.00 WIB (commit freeze `83ce45f`) dan dihentikan pencatatannya untuk pengumpulan pada 14 November 2026 pukul 11.05 WIB: sekitar **4 hari 21 jam (4,9 hari), kurang dari 10 hari atas persetujuan dosen** (bukti: `docs/persetujuan_dosen.png`).
* Candle diproses: **117 dari 117 tepat waktu, uptime 100%**. Terlambat 0, terlewat 0, error API 0, data tidak valid 0.
* Return forward **0,00%** dan backtest pada jendela yang sama **0,00%** (selisih 0,000 poin). Tidak ada order dan tidak ada trade karena tidak ada sinyal masuk. Buy and hold BTC/IDR pada jendela forward: sekitar **-8,62%**. Hasil 0% bukan tanda strategi lebih pandai: itu hanya karena bot tidak membuka posisi (kas utuh), sedangkan BTC turun.
* Backtest penuh (3 Okt 2023 - 8 Nov 2026): +47,8%, drawdown maksimum -39,6%, 265 trade, profit factor 1,15, porsi biaya 69,3%; buy and hold BTC/IDR pada periode itu +218,7%.

## 2. Kecocokan sinyal
Sinyal bot dibandingkan dengan sinyal backtest candle demi candle pada candle yang sama: **585 dari 585 identik (100,00%)** (117 candle x 5 pair). Hasil ini sesuai rancangan karena bot dan backtest memanggil fungsi `evaluate()` yang sama pada jendela 400 bar tertutup terakhir, dan hanya bar yang sudah tertutup yang dipakai (bar yang masih berjalan dibuang).

## 3. Selisih harga fill per trade
Tidak ada order selama forward test, sehingga selisih harga fill per trade tidak dapat dihitung. Backtest yang dijalankan ulang pada jendela yang sama juga menghasilkan 0 trade, sehingga keduanya konsisten (0 fill backtest dan 0 order forward).
Bila ada order, yang akan diukur adalah selisih antara harga sinyal (close bar) dan harga fill rata-rata di order book (ask untuk beli, bid untuk jual), yang dipengaruhi spread, kedalaman order book, dan jeda antara candle tertutup dan bot berjalan.

## 4. Spread
Spread yang dipakai backtest berasal dari median 9 snapshot awal per pair; spread dari **seluruh snapshot** diukur dari 161 snapshot per pair (805 snapshot total, median seluruh pair 0,0812%):

| Pair | Dipakai backtest | Seluruh snapshot (n=161) | Selisih |
|---|---|---|---|
| btcidr | 0,065% | 0,025% | nyata lebih kecil (sekitar -62%) |
| ethidr | 0,041% | 0,070% | nyata lebih besar (sekitar +71%) |
| solidr | 0,097% | 0,093% | hampir sama (sekitar -4%) |
| xrpidr | 0,080% | 0,074% | hampir sama (sekitar -7%) |
| dogeidr | 0,158% | 0,158% | sama |

Interpretasi: untuk SOL, XRP, dan DOGE spread backtest hampir sama dengan spread nyata. BTC lebih murah dari asumsi, sehingga biaya BTC di backtest terlalu pesimis (konservatif); ETH lebih mahal, sehingga biaya ETH di backtest terlalu optimis. Selisih terbesar hanya sekitar 0,04 poin persentase, jauh lebih kecil daripada fee taker 0,41555% per sisi, sehingga dampaknya terhadap hasil backtest kecil dibandingkan fee. Keterbatasan: yang dibandingkan hanya spread; slippage untuk order Rp25 juta pada seluruh snapshot belum dihitung ulang, dan 9 snapshot awal (sekitar 9 jam, sebagian besar malam hari WIB) kurang mewakili jam sibuk.

## 5. Dampak keterlambatan jadwal
Dua penjadwal memanggil bot tiap jam: cron-job.org (menit ke-5) dan GitHub Actions (menit ke-7). Setiap candle diproses tepat sekali; panggilan kedua dilewati sebagai duplikat (**90 panggilan duplikat dilewati**), yang membuktikan idempotency.
Jeda antara penutupan candle dan pemrosesan oleh bot: median **311 detik (sekitar 5,2 menit)**, terbesar 314 detik, terkecil 5 detik (kemungkinan dari panggilan uji manual, bukan jadwal reguler). Jeda ini sesuai rancangan jadwal (menit ke-5 ditambah beberapa detik eksekusi) dan jauh di bawah batas satu jam, sehingga seluruh candle terproses sebelum candle berikutnya tertutup dan uptime tidak berkurang. Karena semua candle diproses dalam 314 detik atau kurang, sedangkan jadwal GitHub Actions jatuh di menit ke-7 (420 detik), cron-job.org yang memproses setiap candle dan GitHub Actions berperan sebagai cadangan; keterlambatan GitHub Actions sendiri tidak dapat diukur dari log sinyal.
Dampak pada harga fill: order dieksekusi sekitar 5 menit setelah harga sinyal (close bar), sehingga harga order book dapat bergeser; pada forward test ini hal itu tidak terukur karena tidak ada order.
Catatan operasional: cron-job.org sempat gagal 401 pada eksekusi pertama (9 Nov, 14.05 WIB) karena header `Authorization` belum benar; setelah diperbaiki, eksekusi terjadwal pertama yang berhasil terjadi pukul 15.05 WIB (200 OK). Candle pada jam itu tetap terproses oleh GitHub Actions dan panggilan manual, sehingga uptime tidak terpengaruh.

## 6. Porsi biaya
(fee + spread + slippage) / laba kotor: backtest **69,3%** (fee Rp94,7 juta, spread dan slippage Rp13,3 juta, laba kotor Rp155,9 juta). Forward: tidak dapat dihitung (0 trade). Fee taker 0,41555% per sisi (angka jual, dipakai untuk beli dan jual sesuai aturan "pakai yang lebih mahal") adalah komponen biaya terbesar. Sebagai pembanding, parameter cepat mirip UTS (bl 48, adxMin 20, chandMult 3) menghasilkan 856 trade dan -75,8% karena fee total Rp109,4 juta melebihi modal.

## 7. Keterbatasan (jujur)
* **Durasi sangat pendek** (4,9 hari, kurang dari 10 hari) dan **0 trade**: forward test tidak dapat menguji eksekusi, hanya kecocokan sinyal, stabilitas bot, dan idempotency.
* **Strategi kalah dari buy and hold BTC** (+47,8% vs +218,7% pada backtest), dengan drawdown -39,6%.
* **Performa memburuk di data akhir.** Parameter dipilih pada 70% data awal (hasil +121,8%, drawdown -27,1%), sedangkan hasil seluruh periode hanya +47,8%. Selisih itu menunjukkan bahwa pada data akhir (Des 2025 - Nov 2026) strategi rugi sekitar 33% (perkiraan kasar dari 1,478 dibagi 2,218; data awal dan akhir tidak dihitung terpisah dengan skrip segmen). Ini indikasi penyesuaian pada data awal dan perubahan kondisi pasar. Parameter tidak dipilih ulang setelah melihat data akhir.
* Data awal mencakup pasar kripto yang naik besar, dan strategi ini long-only.
* Universe hanya 5 pair besar; pair yang likuid di awal periode tetapi sudah di-delist tidak dapat diuji (survivorship bias tersisa). Likuiditas DOGE/IDR turun lebih dari separuh dari awal periode.
* Asumsi dry run: fill dihitung dari snapshot order book saat bot berjalan (tanpa antrean, tanpa fill sebagian di luar kedalaman 30 level); fee beli memakai angka jual yang lebih mahal.
* **Kill switch terbukti di log:** diuji sekali pada Kamis 12 November 2026 pukul 19.30 WIB (dinyalakan 19.30.05, satu panggilan `/api/tick` tercatat `kill_switch_aktif` pukul 19.30.21, dimatikan 19.30.39).
* **Daily loss limit** ada di kode tetapi tidak terpicu selama forward test (tidak ada kerugian), sehingga tidak terbukti di log.

## 8. Pelajaran
* Biaya menentukan: strategi yang sama berubah dari -75,8% menjadi +47,8% hanya dengan memperlambat frekuensi trade, tetapi tetap kalah dari buy and hold.
* Memilih parameter dari titik tengah dataran stabil dan tidak memilih ulang setelah melihat data akhir menjaga kejujuran pengujian, walaupun hasil akhirnya kurang bagus.
* Dua penjadwal dengan idempotency membuat uptime 100% tanpa risiko order ganda.
* Semua angka dapat dihitung ulang dari log mentah (`data/logs/*.json`) dengan `npm run hitung-ulang`.
