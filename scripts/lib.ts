import * as fs from "fs";
import { CONFIG } from "../src/config";
import { Costs } from "../src/sim";
import { Candle } from "../src/types";

export function loadCandles(): Record<string, Candle[]> {
  const d: Record<string, Candle[]> = {};
  for (const p of CONFIG.pairs) {
    const f = `data/candles/${p}.json`;
    if (!fs.existsSync(f)) throw new Error(`Belum ada ${f}. Jalankan: npm run tarik-data`);
    d[p] = JSON.parse(fs.readFileSync(f, "utf8")).candles;
  }
  return d;
}
export function loadCosts(): { costs: Costs; warnings: string[] } {
  const w: string[] = [];
  if (fs.existsSync("data/spread_backtest.json")) {
    const j = JSON.parse(fs.readFileSync("data/spread_backtest.json", "utf8"));
    const costs: Costs = {};
    for (const p of CONFIG.pairs) { costs[p] = j[p] ?? { ...CONFIG.backtestFallback }; if (!j[p]) w.push(`spread ${p} belum terukur, pakai fallback`); }
    return { costs, warnings: w };
  }
  w.push("PERINGATAN: data/spread_backtest.json belum ada -> backtest memakai biaya FALLBACK dari config (bukan hasil ukur). Jalankan npm run ukur-spread.");
  const costs: Costs = {}; for (const p of CONFIG.pairs) costs[p] = { ...CONFIG.backtestFallback };
  return { costs, warnings: w };
}

