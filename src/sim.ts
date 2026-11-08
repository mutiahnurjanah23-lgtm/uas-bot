// Simulasi backtest. Memakai evaluate() yang SAMA dengan bot. Eksekusi: harga close bar sinyal
// ditambah premi beli / dikurangi diskon jual hasil ukur snapshot (spread + slippage). Bukan fill di mid/close murni.
import { Candle } from "./types";
import { Config } from "./config";
import { evaluate, Params, WINDOW } from "./signal";
import { wibDate, positionBudget, dailyLossBreached, floorDec } from "./risk";
import { Trade } from "./metrics";

export interface Cost { buyPremiumPct: number; sellDiscountPct: number }
export type Costs = Record<string, Cost>;
export interface Fill { pair: string; side: "buy" | "sell"; bar: number; price: number; qty: number }
export interface SimOut { trades: Trade[]; equity: [number, number][]; signals: any[]; fills: Fill[]; open: { pair: string; qty: number }[] }

export function simulate(data: Record<string, Candle[]>, cfg: Config, costs: Costs, o: { startT?: number; endT?: number; params?: Params } = {}): SimOut {
  const P = o.params ?? cfg.params, tf = cfg.tfSeconds, feeF = cfg.exec.feeTakerPct / 100;
  const idx: Record<string, Map<number, number>> = {};
  const tset = new Set<number>();
  for (const pair of cfg.pairs) {
    idx[pair] = new Map();
    (data[pair] ?? []).forEach((c, i) => { idx[pair].set(c.t, i); if ((o.startT ?? 0) <= c.t && c.t <= (o.endT ?? Infinity)) tset.add(c.t); });
  }
  const times = [...tset].sort((a, b) => a - b);
  const costOf = (p: string): Cost => costs[p] ?? { buyPremiumPct: 0.3, sellDiscountPct: 0.3 };
  let cash = cfg.risk.initialCash, day = "", dayStart = cash, halted = false;
  const pos: Record<string, { qty: number; entryPrice: number; entryT: number; stop: number; feeBuy: number; ss: number }> = {};
  const lastClose: Record<string, number> = {};
  const trades: Trade[] = [], equity: [number, number][] = [], signals: any[] = [], fills: Fill[] = [];
  const eqNow = () => cash + Object.entries(pos).reduce((s, [p, x]) => s + x.qty * (lastClose[p] ?? x.entryPrice) * (1 - costOf(p).sellDiscountPct / 100), 0);

  for (const t of times) {
    const sells: { pair: string; close: number }[] = [], buys: { pair: string; close: number; stop: number }[] = [];
    for (const pair of cfg.pairs) {
      const i = idx[pair].get(t);
      if (i === undefined) continue;
      const arr = data[pair];
      lastClose[pair] = arr[i].c;
      if (i + 1 < WINDOW) continue;
      const ev = evaluate(arr.slice(i - WINDOW + 1, i + 1), pos[pair] ?? null, P);
      signals.push({ t, pair, entry: ev.entry, close: ev.close, chand: ev.chand });
      if (pos[pair]) { pos[pair].stop = ev.newStop; if (ev.exit) sells.push({ pair, close: ev.close }); }
      else if (ev.entry) buys.push({ pair, close: ev.close, stop: ev.newStop });
    }
    const eq0 = eqNow(), d = wibDate(t + tf);
    if (d !== day) { day = d; dayStart = eq0; halted = false; }
    if (!halted && dailyLossBreached(dayStart, eq0, cfg)) halted = true;

    for (const s of sells) {
      const x = pos[s.pair], c = costOf(s.pair);
      const px = s.close * (1 - c.sellDiscountPct / 100), proceeds = x.qty * px, fee = proceeds * feeF;
      cash += proceeds - fee;
      trades.push({ pair: s.pair, entryT: x.entryT, exitT: t + tf, entryPrice: x.entryPrice, exitPrice: px, qty: x.qty, fees: x.feeBuy + fee,
        pnl: proceeds - fee - (x.qty * x.entryPrice + x.feeBuy), spreadSlip: x.ss + x.qty * s.close * c.sellDiscountPct / 100 });
      fills.push({ pair: s.pair, side: "sell", bar: t, price: px, qty: x.qty });
      delete pos[s.pair];
    }
    for (const b of buys) {
      if (halted || Object.keys(pos).length >= cfg.risk.maxPositions) continue;
      const c = costOf(b.pair), px = b.close * (1 + c.buyPremiumPct / 100);
      const qty = floorDec(positionBudget(eqNow(), cash, cfg) / (1 + feeF) / px, cfg.exec.qtyDecimals);
      if (qty * px < cfg.exec.minOrderIdr) continue;
      const fee = qty * px * feeF;
      cash -= qty * px + fee;
      fills.push({ pair: b.pair, side: "buy", bar: t, price: px, qty });
      pos[b.pair] = { qty, entryPrice: px, entryT: t + tf, stop: b.stop, feeBuy: fee, ss: qty * b.close * c.buyPremiumPct / 100 };
    }
    equity.push([t + tf, eqNow()]);
  }
  return { trades, equity, signals, fills, open: Object.entries(pos).map(([pair, x]) => ({ pair, qty: x.qty })) };
}
