// Ukur likuiditas tiap pair di AWAL periode backtest (bukan hanya hari ini) dari data/candles/*.json.
// Jalankan:  npx tsx scripts/ukur_likuiditas.ts            (semua pair yang ada di data/candles)
//            npx tsx scripts/ukur_likuiditas.ts --min=1000000000   (tandai lolos bila median volume harian awal >= Rp1 miliar)
// Catatan: volume harian IDR dihitung = close x volume (asumsi volume candle dalam koin). Cek kolom "contoh" untuk memastikan masuk akal.
import * as fs from "fs";
import * as path from "path";
import { WINDOW } from "../src/signal";

const minArg = process.argv.find(a => a.startsWith("--min="));
const MIN = minArg ? Number(minArg.split("=")[1]) : null;
const DAY = 86400, fmt = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
const idr = (x: number | null) => (x == null ? "-" : "Rp" + Math.round(x).toLocaleString("id-ID"));
const median = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function dailyIdr(cs: { t: number; c: number; v: number }[]): number[] {
  const d = new Map<number, number>();
  for (const x of cs) { const k = Math.floor(x.t / DAY); d.set(k, (d.get(k) ?? 0) + x.c * x.v); }
  return [...d.values()];
}

const dir = "data/candles";
if (!fs.existsSync(dir)) throw new Error("Folder data/candles belum ada. Jalankan: npm run tarik-data");
const rows: any[] = [];
for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".json"))) {
  const { pair, candles } = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  if (candles.length < WINDOW + 24 * 30) { rows.push({ pair, catatan: "data terlalu pendek" }); continue; }
  const startBars = candles.slice(WINDOW, WINDOW + 24 * 90);          // 90 hari pertama SETELAH masa pemanasan indikator
  const lastBars = candles.slice(-24 * 30);                           // 30 hari terakhir (pembanding)
  const days = (candles[candles.length - 1].t - candles[0].t) / DAY;
  const startMed = median(dailyIdr(startBars)), nowMed = median(dailyIdr(lastBars));
  const last = candles[candles.length - 1];
  rows.push({ pair, bars: candles.length, hari: Math.round(days), awalData: fmt(candles[0].t), awalUkur: fmt(startBars[0].t), akhirUkur: fmt(startBars[startBars.length - 1].t),
    medVolHarianAwal: startMed, medVolHarian30HariTerakhir: nowMed, lolos3Tahun: days >= 3 * 365 - 10,
    lolosKriteria: MIN == null ? null : (startMed ?? 0) >= MIN && days >= 3 * 365 - 10, contoh: `close=${last.c} vol=${last.v} -> ${idr(last.c * last.v)}/jam` });
}
rows.sort((a, b) => (b.medVolHarianAwal ?? -1) - (a.medVolHarianAwal ?? -1));
console.log("\nPeringkat likuiditas di AWAL periode backtest (90 hari pertama setelah pemanasan):\n");
rows.forEach((r, i) => console.log(`${String(i + 1).padStart(2)}. ${r.pair.padEnd(9)} awal: ${idr(r.medVolHarianAwal).padEnd(20)} sekarang: ${idr(r.medVolHarian30HariTerakhir).padEnd(20)} data: ${r.hari ?? "?"} hari${r.lolosKriteria == null ? "" : r.lolosKriteria ? "  LOLOS" : "  tidak lolos"}${r.catatan ? "  (" + r.catatan + ")" : ""}`));
console.log("\nPeriode ukur: " + (rows.find(r => r.awalUkur)?.awalUkur ?? "-") + " s/d " + (rows.find(r => r.akhirUkur)?.akhirUkur ?? "-"));
console.log("Cek kewajaran: " + rows.filter(r => r.contoh).map(r => `${r.pair}: ${r.contoh}`).join(" | "));
fs.writeFileSync("data/likuiditas.json", JSON.stringify({ generatedAt: Math.floor(Date.now() / 1000), minKriteria: MIN, rows }, null, 1));
console.log("\nOK -> data/likuiditas.json (salin kriteria dan hasilnya ke docs/STRATEGI.md)");
