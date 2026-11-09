// Backtest dengan data asli Indodax (data/candles), fungsi sinyal SAMA dengan bot.
//   npm run backtest             -> jalankan sesuai config
//   npm run backtest -- --grid   -> coba beberapa kombinasi parameter HANYA di 70% data awal (in-sample)
import * as fs from "fs";
import { CONFIG } from "../src/config";
import { simulate, Costs } from "../src/sim";
import { summarize } from "../src/metrics";
import { makeStore } from "../src/storage";
import { loadCandles, loadCosts } from "./lib";

(async () => {
  if (!Number.isFinite(CONFIG.exec.feeTakerPct)) throw new Error("Isi dulu exec.feeTakerPct di src/config.ts");
  const data = loadCandles();
  const { costs, warnings } = loadCosts();
  warnings.forEach(x => console.log(x));
     let t0 = Infinity, t1 = -Infinity;
   for (const arr of Object.values(data)) for (const c of arr) { if (c.t < t0) t0 = c.t; if (c.t > t1) t1 = c.t; }
  if (process.argv.includes("--grid")) {
    const split = t0 + 0.7 * (t1 - t0);
    const rows: any[] = [];
      for (const bl of [48, 96, 144, 216]) for (const adxMin of [20, 25, 30]) for (const chandMult of [3.5, 5, 7]) {
      const params = { ...CONFIG.params, bl, adxMin, chandMult };
      const r = simulate(data, CONFIG, costs, { endT: split, params });
      const m = summarize(r.trades, r.equity, CONFIG.risk.initialCash, true);
      rows.push({ bl, adxMin, chandMult, returnPct: +m.returnPct.toFixed(1), mddPct: +m.maxDrawdownPct.toFixed(1), trades: m.nTrades, calmar: m.maxDrawdownPct ? +(m.returnPct / Math.abs(m.maxDrawdownPct)).toFixed(2) : null });
      console.log(JSON.stringify(rows[rows.length - 1]));
    }
    console.log("\nIn-sample sampai", new Date(split * 1000).toISOString().slice(0, 10), "- pilih kombinasi, ISI ke src/config.ts, lalu jalankan backtest TANPA --grid.");
    return;
  }

  const r = simulate(data, CONFIG, costs);
  const m = summarize(r.trades, r.equity, CONFIG.risk.initialCash, true);
  const eqStart = r.equity[0]?.[0] ?? t0, eqEnd = r.equity[r.equity.length - 1]?.[0] ?? t1;
  const btc = data["btcidr"] ?? Object.values(data)[0];
  const bhBtcPct = btc ? (btc[btc.length - 1].c / (btc.find(c => c.t + CONFIG.tfSeconds >= eqStart)?.c ?? btc[0].c) - 1) * 100 : null;
  const result = {
    generatedAt: Math.floor(Date.now() / 1000), period: { start: eqStart, end: eqEnd }, params: CONFIG.params, pairs: CONFIG.pairs,
    feeTakerPct: CONFIG.exec.feeTakerPct, costs, warnings, metrics: m, bhBtcPct,
    equityDaily: r.equity.filter((_, i) => i % 24 === 0), trades: r.trades.slice(-300),
  };
  fs.writeFileSync("data/backtest_result.json", JSON.stringify(result));
  try { await makeStore().set("backtest", JSON.stringify(result)); } catch (e: any) { console.log("(gagal simpan ke storage:", e.message, ")"); }
  console.log(JSON.stringify({ ...m, bhBtcPct, periode: `${new Date(eqStart * 1000).toISOString().slice(0, 10)} s/d ${new Date(eqEnd * 1000).toISOString().slice(0, 10)}` }, null, 1));
})();
