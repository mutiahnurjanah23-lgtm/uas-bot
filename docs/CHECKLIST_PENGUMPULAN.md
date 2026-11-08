# Checklist pengumpulan (RISE, tenggat Sabtu 14 Nov 2026 23.59 WIB — atau sesuai kesepakatan dengan dosen)

Satu file ZIP berisi:
- [ ] Source code bot dan backtest + `README.md` (langkah jalan dan deploy)
- [ ] `docs/STRATEGI.md` dan `docs/CATATAN_PERUBAHAN.md`
- [ ] Commit freeze: hash + waktu (README), bisa dicek di riwayat repo
- [ ] Bukti commit: **link repo GitHub publik berisi seluruh riwayat** ATAU ZIP menyertakan folder `.git` utuh
- [ ] Log mentah forward test: `data/logs/*.json` (calls, signals, orders, equity, errors, events, snapshots)
- [ ] Skrip `hitung_ulang` (`scripts/hitung_ulang.ts`) dan hasilnya sama dengan dashboard
- [ ] `dist/dashboard_offline.html` (bisa dibuka tanpa internet) + link dashboard Vercel
- [ ] `docs/REFLEKSI.md` (dengan angka)
- [ ] `.env.example` — **tidak ada `.env`, token, atau secret di mana pun** (cek: `git grep -i -E "secret|token|upstash"` dan lihat riwayat commit)
- [ ] Semua snapshot order book mentah (`data/logs/snapshots.json`)
- [ ] `data/backtest_result.json`, `data/compare.json`, `data/spread_backtest.json`

Di kolom catatan saat submit: **link Vercel** dan **link repositori GitHub**. Link Vercel harus masih aktif saat penilaian.

Jangan: force-push, hapus riwayat commit, ubah aturan setelah freeze, hardcode angka dashboard.
