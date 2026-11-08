// Semua angka dashboard dihitung di sini dari log mentah. Skrip hitung_ulang memakai fungsi yang sama.
import { Config } from "./config";
import { wibDate } from "./risk";

export interface Trade { pair: string; entryT: number; exitT: number; entryPrice: number; exitPrice: number; qty: number; fees: number; pnl: number; spreadSlip: number }

export function maxDrawdown(eq: number[]): number {
  let peak = -Infinity, mdd = 0;
  for (const v of eq) { peak = Math.max(peak, v); if (peak > 0) mdd = Math.min(mdd, v / peak - 1); }
  return mdd;
}

export function summarize(trades: Trade[], equity: [number, number][], initial: number, withCagr: boolean) {
  const eq = equity.map(e => e[1]);
  const last = eq.length ? eq[eq.length - 1] : initial;
  const wins = trades.filter(t => t.pnl > 0), losses = trades.filter(t => t.pnl <= 0);
  const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
  const net = sum(trades.map(t => t.pnl)), fees = sum(trades.map(t => t.fees)), ss = sum(trades.map(t => t.spreadSlip));
  const gross = net + fees + ss;
  const out: any = {
    returnPct: (last / initial - 1) * 100,
    maxDrawdownPct: maxDrawdown([initial, ...eq]) * 100,
    nTrades: trades.length,
    winRatePct: trades.length ? (wins.length / trades.length) * 100 : null,
    avgWin: wins.length ? sum(wins.map(t => t.pnl)) / wins.length : null,
    avgLoss: losses.length ? sum(losses.map(t => t.pnl)) / losses.length : null,
    profitFactor: losses.length && sum(losses.map(t => t.pnl)) < 0 ? sum(wins.map(t => t.pnl)) / Math.abs(sum(losses.map(t => t.pnl))) : null,
    netPnl: net, feeTotal: fees, spreadSlipTotal: ss, grossProfit: gross,
    costSharePct: gross > 0 ? ((fees + ss) / gross) * 100 : null,
  };
  if (withCagr && equity.length > 1) {
    const years = (equity[equity.length - 1][0] - equity[0][0]) / (365.25 * 86400);
    out.cagrPct = years > 0 && last > 0 ? (Math.pow(last / initial, 1 / years) - 1) * 100 : null;
  }
  return out;
}

/** Jadikan baris order (buy/sell) menjadi trade (dari buka posisi sampai qty kembali 0). */
export function tradesFromOrders(orders: any[]): Trade[] {
  const open: Record<string, any> = {}, out: Trade[] = [];
  for (const o of [...orders].sort((a, b) => a.t - b.t)) {
    const mid = (o.bestBid + (o.bestAsk ?? o.bestBid)) / 2;
    const x = (open[o.pair] ??= { qty: 0, buyQty: 0, buyCost: 0, sellQty: 0, sellGot: 0, fees: 0, ss: 0, entryT: o.t });
    if (o.side === "buy") { x.qty += o.qty; x.buyQty += o.qty; x.buyCost += o.qty * o.avgFill; x.ss += o.qty * (o.avgFill - mid); }
    else { x.qty -= o.qty; x.sellQty += o.qty; x.sellGot += o.qty * o.avgFill; x.ss += o.qty * (mid - o.avgFill); }
    x.fees += o.fee;
    if (o.side === "sell" && x.qty < 1e-9) {
      out.push({ pair: o.pair, entryT: x.entryT, exitT: o.t, entryPrice: x.buyCost / x.buyQty, exitPrice: x.sellGot / x.sellQty, qty: x.buyQty,
        fees: x.fees, pnl: x.sellGot - x.buyCost - x.fees, spreadSlip: x.ss });
      delete open[o.pair];
    }
  }
  return out;
}

export function uptime(signals: any[], cfg: Config, startUnix: number, endUnix: number) {
  const tf = cfg.tfSeconds;
  if (!startUnix || endUnix <= startUnix) return { expected: 0, onTime: 0, late: 0, missing: 0, uptimePct: null };
  let t = Math.floor(startUnix / tf) * tf; if (t + tf <= startUnix) t += tf;
  const byBar = new Map<number, Map<string, number>>();
  for (const s of signals) if (s.status === "ok") {
    const m = byBar.get(s.t) ?? new Map<string, number>(); m.set(s.pair, Math.min(m.get(s.pair) ?? Infinity, s.processedAt)); byBar.set(s.t, m);
  }
  let expected = 0, onTime = 0, late = 0;
  for (; t + tf <= endUnix; t += tf) {
    expected++;
    const m = byBar.get(t);
    if (!m || m.size < cfg.pairs.length) continue;
    if ([...m.values()].every(p => p <= t + 2 * tf)) onTime++; else late++;
  }
  return { expected, onTime, late, missing: expected - onTime - late, uptimePct: expected ? (onTime / expected) * 100 : null };
}

export interface Logs { calls: any[]; signals: any[]; orders: any[]; equity: any[]; errors: any[]; events: any[]; snapshots: any[] }

export function computeForward(L: Logs, cfg: Config) {
  const start = cfg.tradingStartUnix;
  const calls = L.calls.filter(c => c.status === "ok" && c.t >= start);
  const equity: [number, number][] = calls.map(c => [c.t, c.equity]);
  const trades = tradesFromOrders(L.orders);
  const m = summarize(trades, equity, cfg.risk.initialCash, false);
  const btc = calls.map(c => c.btcBid).filter((x: any) => x > 0);
  const bhBtcPct = btc.length > 1 ? (btc[btc.length - 1] / btc[0] - 1) * 100 : null;
  const end = L.calls.length ? Math.max(...L.calls.map(c => c.t)) : start;
  const up = uptime(L.signals, cfg, start, Math.min(end, start + 10 * 86400));
  const slip = L.orders.map(o => o.slipVsSignalPct).filter((x: any) => Number.isFinite(x));
  const spreads = L.snapshots.map(s => (s.asks?.[0] && s.bids?.[0]) ? ((s.asks[0][0] - s.bids[0][0]) / s.bids[0][0]) * 100 : null).filter((x: any) => x != null) as number[];
  return {
    metrics: m, bhBtcPct, equity, trades,
    ops: {
      callsTotal: L.calls.length, callsOk: calls.length, callsFailed: L.calls.filter(c => c.status === "gagal").length,
      uptime: up, apiErrors: L.errors.length, killSwitchUses: L.events.filter(e => e.type === "kill_switch_aktif").length,
      dailyLossTriggers: L.events.filter(e => e.type === "daily_loss_limit").length,
      duplicatesSkipped: L.events.filter(e => e.type === "duplikat_dilewati").length,
      invalidData: L.events.filter(e => e.type === "data_tidak_valid").length,
      medianSlipVsSignalPct: median(slip), medianSpreadSnapshotPct: median(spreads), nSnapshots: L.snapshots.length,
    },
    orders: L.orders, days: [...new Set(L.equity.map(e => e.date))].length, dailyEquity: L.equity.map(e => ({ date: e.date ?? wibDate(e.t), equity: e.equity })),
  };
}

export function median(a: number[]): number | null {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
