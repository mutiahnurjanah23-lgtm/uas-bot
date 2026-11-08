// Tarik candle historis ASLI Indodax, MUNDUR dari sekarang (jalankan di laptop, bukan di Vercel).
//   npm run tarik-data                 -> 3,1 tahun untuk semua pair di config
//   npm run tarik-data -- --recent     -> hanya ~60 hari terakhir (dipakai setelah forward test untuk bandingkan)
import * as fs from "fs";
import * as path from "path";
import { CONFIG } from "../src/config";
import { fetchHistoryBackward, indodax } from "../src/indodax";
import { Candle } from "../src/types";

(async () => {
  const recent = process.argv.includes("--recent");
  const years = Number(process.argv.find(a => a.startsWith("--years="))?.split("=")[1] ?? 3.1);
  const now = await indodax.serverTime();
  const start = recent ? now - 60 * 86400 : Math.floor(now - years * 365.25 * 86400);
  fs.mkdirSync("data/candles", { recursive: true });
  for (const pair of CONFIG.pairs) {
    const file = path.join("data/candles", `${pair}.json`);
    const old: Candle[] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")).candles : [];
    process.stdout.write(`${pair}: menarik mundur... `);
    const got = await fetchHistoryBackward(pair, CONFIG.tfSeconds, start, now, (n, e) => process.stdout.write(`\r${pair}: ${n} bar, terawal ${new Date(e * 1000).toISOString().slice(0, 10)}   `));
    const m = new Map<number, Candle>();
    for (const c of [...old, ...got]) if (c.t + CONFIG.tfSeconds <= now) m.set(c.t, c);   // simpan HANYA candle tertutup
    const all = [...m.values()].sort((a, b) => a.t - b.t);
    fs.writeFileSync(file, JSON.stringify({ pair, tf: CONFIG.tf, fetchedAt: now, candles: all }));
    const days = all.length ? (all[all.length - 1].t - all[0].t) / 86400 : 0;
    console.log(`\n  -> ${all.length} bar, ${days.toFixed(0)} hari (${all.length ? new Date(all[0].t * 1000).toISOString().slice(0, 10) : "-"} s/d ${all.length ? new Date(all[all.length - 1].t * 1000).toISOString().slice(0, 10) : "-"})`);
    if (!recent && days < 3 * 365 - 10) console.log(`  !! PERINGATAN: ${pair} datanya kurang dari 3 tahun. Backtest wajib >= 3 tahun: ganti pair ini atau lapor ke dosen.`);
  }
})();
