# Rencana harian (mulai Minggu 8 Nov 2026)

> **PENTING — soal ini meminta forward test 10 hari penuh setelah freeze.** Freeze resmi (4 Nov) sudah lewat.
> Hubungi dosen **hari ini** dan tanyakan: (a) boleh freeze mulai sekarang dan mengumpulkan setelah 14 Nov (ada pengurangan nilai), atau (b) ada kebijakan lain.
> Jangan memalsukan tanggal commit atau log. Tulis tanggal sebenarnya di README dan refleksi.

## Hari 0 — Minggu 8 Nov: siapkan semuanya
- [ ] `npm install`, buat repo GitHub publik, push
- [ ] Buat Upstash Redis, isi env di Vercel, deploy, isi Secrets GitHub (lihat README)
- [ ] Jalankan workflow manual sekali → pastikan `/api/snapshot` jalan (uji koneksi Vercel → Indodax)
- [ ] **Snapshot mulai terkumpul tiap jam** (makin cepat dimulai makin baik)
- [ ] `npm run cek-aturan` → catat fee, minimum order, URL, tanggal akses → isi `docs/STRATEGI.md` dan `src/config.ts`
- [ ] Pilih universe 3–10 pair + tulis kriteria likuiditas di `docs/STRATEGI.md`
- [ ] `npm run tarik-data` (≥3 tahun per pair)
- [ ] `npm run backtest -- --grid` lalu pilih parameter dari in-sample

## Hari 1 — Senin 9 Nov: backtest final dan FREEZE
- [ ] `npm run export-log` → `npm run ukur-spread` (dari snapshot yang sudah ada; kalau sedikit, tulis jujur di refleksi)
- [ ] `npm run backtest` (final) dan simpan hasilnya
- [ ] `npm run tes` harus semua LULUS; `npm run cek-tipe` bersih
- [ ] Isi `tradingStartUnix` dan `feeTakerPct` di config; catat perubahan dari UTS di `docs/CATATAN_PERUBAHAN.md`
- [ ] Commit dan push **FREEZE** (catat hash dan waktu di README)
- [ ] Forward test mulai

## Hari 2–10 — pemantauan 5 menit per hari
- [ ] Buka dashboard Vercel: ada panggilan baru tiap jam? uptime? error?
- [ ] Kalau bot macet atau error berulang: perbaiki **bug saja** (bukan aturan), catat di `CATATAN_PERUBAHAN.md`
- [ ] Sambil menunggu: tulis `docs/STRATEGI.md` dan kerangka `docs/REFLEKSI.md`

## Hari akhir (10 hari setelah freeze)
- [ ] `npm run export-log`
- [ ] `npm run tarik-data -- --recent`
- [ ] `npm run bandingkan` (sinyal harus identik)
- [ ] `npm run hitung-ulang` → `dist/dashboard_offline.html`
- [ ] Isi `docs/REFLEKSI.md` dengan angka
- [ ] Susun ZIP sesuai `docs/CHECKLIST_PENGUMPULAN.md`, kumpulkan di RISE

## Cara kerja sama harian dengan Claude
Setiap hari kamu bisa kembali ke percakapan ini dan tempel: ringkasan dashboard (uptime, error, jumlah order) atau pesan error. Saya bantu membaca, mencari penyebab, dan menyusun refleksi.
