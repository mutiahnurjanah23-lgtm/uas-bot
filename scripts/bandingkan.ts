// Bandingkan backtest vs forward test pada JENDELA WAKTU YANG SAMA, dengan candle yang sama.
// Prasyarat: npm run export-log  dan  npm run tarik-data -- --recent
import * as fs from "fs";
import { CONFIG } from "../src/config";
import { evaluate, WINDOW } from "../src/signal";
import { simulate } from "../src/sim";
import { summarize, computeForward, median, Logs } from "../src/metrics";
import { makeStore } from "../src/storage";
import { loadCandles, loadCosts } from "./lib";

(async () => {
  const L: any = {};
  for (const n of ["calls", "signals", "orders", "equity", "errors", "events", "snapshots"]) L[n] = JSON.parse(fs.readFileSync(`data/logs/${n}.json`, "utf8"));
  const data = loadCandles(), { costs, warnings } = loadCosts();
  const start = CONFIG.tradingStartUnix;
  const end = Math.min(Math.max(...L.calls.map((c: any) => c.t)), start + 10 * 86400);

  // 1) Sinyal bot vs sinyal backtest, candle demi candle
  let n = 0, same = 0; const mismatches: any[] = [];
  const idx: Record<string, Map<number, number>> = {};
  for (const p of CONFIG.pairs) { idx[p] = new Map(); data[p].forEach((c, i) => idx[p].set(c.t, i)); }
  for (const s of L.signals.filter((x: any) => x.status === "ok" && x.t + CONFIG.tfSeconds > start && x.t + CONFIG.tfSeconds <= end)) {
    const i = idx[s.pair]?.get(s.t); if (i === undefined || i + 1 < WINDOW) continue;
    const ev = evaluate(data[s.pair].slice(i - WINDOW + 1, i + 1), null, CONFIG.params);
    n++;
    const ok = ev.entry === s.entry && Math.abs(ev.close - s.close) <= 1e-9 * ev.close && Math.abs(ev.chand - s.chand) <= 1e-9 * Math.abs(ev.chand);
    if (ok) same++; else mismatches.push({ pair: s.pair, bar: s.t, bot: { entry: s.entry, close: s.close, chand: s.chand }, backtest: { entry: ev.entry, close: ev.close, chand: ev.chand } });
  }

  // 2) Backtest dijalankan ulang pada jendela forward
  const bt = simulate(data, CONFIG, costs, { startT: start - CONFIG.tfSeconds, endT: end - CONFIG.tfSeconds });
  const btM = summarize(bt.trades, bt.equity, CONFIG.risk.initialCash, false);
  const fw = computeForward(L as Logs, CONFIG);

  // 3) Selisih harga fill per order (forward vs backtest, bar yang sama)
  const diffs: any[] = [];
  for (const o of L.orders) {
    const f = bt.fills.find(x => x.pair === o.pair && x.side === o.side && x.bar === o.bar);
    diffs.push({ pair: o.pair, side: o.side, bar: o.bar, forwardFill: o.avgFill, backtestFill: f?.price ?? null, signalPrice: o.signalPrice,
      diffPct: f ? (o.avgFill / f.price - 1) * 100 : null, slipVsSignalPct: o.slipVsSignalPct, bestBid: o.bestBid, bestAsk: o.bestAsk });
  }
  const onlyBt = bt.fills.filter(f => !L.orders.some((o: any) => o.pair === f.pair && o.side === f.side && o.bar === f.bar)).length;

  // 4) Spread yang dipakai backtest vs seluruh snapshot
  const spreadByPair: Record<string, any> = {};
  const used = fs.existsSync("data/spread_backtest.json") ? JSON.parse(fs.readFileSync("data/spread_backtest.json", "utf8")) : {};
  for (const p of CONFIG.pairs) {
    const sp = L.snapshots.filter((s: any) => s.pair === p && s.bids?.length && s.asks?.length).map((s: any) => ((s.asks[0][0] - s.bids[0][0]) / s.bids[0][0]) * 100);
    spreadByPair[p] = { usedInBacktestPct: used[p]?.spreadPct ?? null, measuredAllSnapshotsPct: median(sp), nSnapshots: sp.length };
  }

  const result = {
    generatedAt: Math.floor(Date.now() / 1000), window: { start, end }, warnings,
    signalMatch: { compared: n, identical: same, pct: n ? (same / n) * 100 : null, mismatches: mismatches.slice(0, 50) },
    backtestWindow: btM, forward: fw.metrics, gapReturnPct: fw.metrics.returnPct - btM.returnPct,
    fills: { nForward: L.orders.length, nBacktest: bt.fills.length, onlyInBacktest: onlyBt, medianDiffPct: median(diffs.map(d => d.diffPct).filter((x: any) => x != null)), rows: diffs },
    spreadByPair,
  };
  fs.writeFileSync("data/compare.json", JSON.stringify(result));
  try { await makeStore().set("compare", JSON.stringify(result)); } catch (e: any) { console.log("(gagal simpan ke storage:", e.message, ")"); }
  console.log(`Sinyal identik: ${same}/${n} (${result.signalMatch.pct?.toFixed(2)}%)`);
  console.log(`Return jendela: backtest ${btM.returnPct.toFixed(3)}% vs forward ${fw.metrics.returnPct.toFixed(3)}% (selisih ${result.gapReturnPct.toFixed(3)} poin)`);
})();
