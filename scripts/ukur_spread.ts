// Ukur spread dan slippage NYATA dari snapshot order book (data/logs/snapshots.json, hasil npm run export-log).
// Hasilnya dipakai backtest (data/spread_backtest.json).
import * as fs from "fs";
import { CONFIG } from "../src/config";
import { qtyForBudget, walkQty } from "../src/execution";
import { median } from "../src/metrics";

const snaps: any[] = JSON.parse(fs.readFileSync("data/logs/snapshots.json", "utf8"));
const size = CONFIG.risk.maxPositionPct * CONFIG.risk.initialCash; // ukuran order tipikal (Rp)
const out: Record<string, any> = {};
for (const pair of CONFIG.pairs) {
  const rows = snaps.filter(s => s.pair === pair && s.bids?.length && s.asks?.length);
  const sp: number[] = [], bp: number[] = [], sd: number[] = [];
  for (const s of rows) {
    const bids = s.bids.map((x: number[]) => ({ price: x[0], amount: x[1] })), asks = s.asks.map((x: number[]) => ({ price: x[0], amount: x[1] }));
    const mid = (bids[0].price + asks[0].price) / 2;
    sp.push(((asks[0].price - bids[0].price) / mid) * 100);
    const qb = qtyForBudget(asks, size), rb = walkQty(asks, qb);
    if (rb.cost >= size * 0.99) bp.push((rb.avg / mid - 1) * 100);       // hanya bila kedalaman cukup
    const rs = walkQty(bids, size / mid);
    if (rs.filled * mid >= size * 0.99) sd.push((1 - rs.avg / mid) * 100);
  }
  out[pair] = { n: rows.length, spreadPct: median(sp), buyPremiumPct: median(bp) ?? CONFIG.backtestFallback.buyPremiumPct,
    sellDiscountPct: median(sd) ?? CONFIG.backtestFallback.sellDiscountPct, nDepthOkBuy: bp.length, nDepthOkSell: sd.length };
  console.log(pair.padEnd(8), JSON.stringify(out[pair]));
}
fs.writeFileSync("data/spread_backtest.json", JSON.stringify(out, null, 1));
console.log("OK -> data/spread_backtest.json (ukuran order acuan Rp", size.toLocaleString("id-ID"), ")");
