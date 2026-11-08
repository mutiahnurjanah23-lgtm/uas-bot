// =====================================================================
//  BOT: satu panggilan runTick() = baca state -> ambil data -> hitung sinyal
//  -> eksekusi simulasi (dry run) -> simpan state dan log.
//  Dipanggil oleh api/tick.ts (dijadwalkan tiap jam, menit ke-7).
// =====================================================================
import { Api, Book, Candle, State } from "./types";
import { Config } from "./config";
import { Store, logKey } from "./storage";
import { evaluate } from "./signal";
import { validateCandles, validateBook } from "./validate";
import { qtyForBudget, walkQty } from "./execution";
import { wibDate, positionBudget, dailyLossBreached, floorDec } from "./risk";

export const initState = (cfg: Config): State => ({
  cash: cfg.risk.initialCash, positions: {}, lastBar: {}, day: "", dayStartEquity: cfg.risk.initialCash, halted: false, lastBid: {},
});

export interface Deps { store: Store; api: Api; cfg: Config; killEnv?: boolean }

const topLevels = (b: Book) => ({ bids: b.bids.slice(0, 30).map(l => [l.price, l.amount]), asks: b.asks.slice(0, 30).map(l => [l.price, l.amount]) });

export async function runTick(d: Deps): Promise<any> {
  const { store, api, cfg } = d;
  if (!Number.isFinite(cfg.exec.feeTakerPct)) throw new Error("feeTakerPct belum diisi di src/config.ts");
  if (!(await store.lock("tick", 240))) return { status: "locked" };

  const t0 = Date.now();
  const L: Record<string, any[]> = { calls: [], signals: [], orders: [], equity: [], errors: [], events: [], snapshots: [] };
  let now = 0;
  try {
    now = await api.serverTime();
    const st: State = JSON.parse((await store.get("state")) ?? "null") ?? initState(cfg);

    // ---- 1. ambil data semua pair (berurutan, retry terbatas ada di klien API) ----
    const data: Record<string, { closed?: Candle[]; book?: Book; why: string[] }> = {};
    for (const pair of cfg.pairs) {
      const rec: { closed?: Candle[]; book?: Book; why: string[] } = { why: [] };
      try {
        const cs = await api.candles(pair, now - 600 * cfg.tfSeconds, now);
        rec.closed = cs.filter(c => c.t + cfg.tfSeconds <= now);   // BUANG candle yang masih berjalan
      } catch (e: any) { L.errors.push({ t: now, pair, where: "candles", msg: String(e?.message ?? e) }); rec.why.push("error_api_candle"); }
      try { rec.book = await api.depth(pair); }
      catch (e: any) { L.errors.push({ t: now, pair, where: "depth", msg: String(e?.message ?? e) }); rec.why.push("error_api_depth"); }
      data[pair] = rec;
      if (rec.book?.bids.length) st.lastBid[pair] = rec.book.bids[0].price;
      if (rec.book) L.snapshots.push({ t: now, pair, ...topLevels(rec.book) });
    }
    let btcBid: number | null = data["btcidr"]?.book?.bids[0]?.price ?? null;
    if (btcBid == null) {
      try { btcBid = (await api.depth("btcidr")).bids[0]?.price ?? null; }
      catch (e: any) { L.errors.push({ t: now, pair: "btcidr", where: "depth_btc", msg: String(e?.message ?? e) }); }
    }

    const bidOf = (pair: string) => data[pair]?.book?.bids[0]?.price ?? st.lastBid[pair] ?? st.positions[pair]?.entryPrice ?? 0;
    const equityNow = () => st.cash + Object.entries(st.positions).reduce((s, [p, x]) => s + x.qty * bidOf(p), 0);

    // ---- 2. sebelum waktu mulai: hanya kumpulkan snapshot ----
    if (cfg.tradingStartUnix === 0 || now < cfg.tradingStartUnix) {
      L.calls.push({ t: now, startedAtMs: t0, durationMs: Date.now() - t0, status: "pre_start", btcBid, nErrors: L.errors.length });
      await flush(store, L);
      return { status: "pre_start", snapshots: L.snapshots.length };
    }

    // ---- 3. equity harian (panggilan pertama setelah 00.00 WIB) dan daily loss limit ----
    let equity = equityNow();
    const today = wibDate(now);
    if (st.day !== today) {
      st.day = today; st.dayStartEquity = equity; st.halted = false;
      L.equity.push({ t: now, date: today, equity, cash: st.cash, openPositions: Object.keys(st.positions).length });
    }
    if (!st.halted && dailyLossBreached(st.dayStartEquity, equity, cfg)) {
      st.halted = true;
      L.events.push({ t: now, type: "daily_loss_limit", equity, dayStartEquity: st.dayStartEquity });
    }
    const killed = !!d.killEnv || (await store.get("killswitch")) === "1";
    if (killed) L.events.push({ t: now, type: "kill_switch_aktif" });

    // ---- 4. validasi data + hitung sinyal (fungsi evaluate() sama dengan backtest) ----
    const sells: { pair: string; ev: ReturnType<typeof evaluate>; barT: number }[] = [];
    const buys: typeof sells = [];
    const processed: { pair: string; bar: number }[] = [];
    for (const pair of cfg.pairs) {
      const rec = data[pair];
      const barT = rec.closed?.length ? rec.closed[rec.closed.length - 1].t : null;
      const why = rec.closed ? [...rec.why, ...validateCandles(rec.closed, cfg.tfSeconds, now)] : [...rec.why];
      if (why.length) {
        L.signals.push({ t: barT, pair, status: "data_tidak_valid", reasons: why, processedAt: now });
        L.events.push({ t: now, type: "data_tidak_valid", pair, reasons: why });
        continue;
      }
      if (st.lastBar[pair] === barT) { L.events.push({ t: now, type: "duplikat_dilewati", pair, bar: barT }); continue; } // idempotency
      const pos = st.positions[pair] ?? null;
      const ev = evaluate(rec.closed!, pos, cfg.params);
      L.signals.push({ t: barT, pair, status: "ok", entry: ev.entry, exit: ev.exit, close: ev.close, don: ev.don, emaT: ev.emaT, adx: ev.adx,
        atr: ev.atr, chand: ev.chand, newStop: ev.newStop, hasPos: !!pos, processedAt: now });
      st.lastBar[pair] = barT!;
      processed.push({ pair, bar: barT! });
      if (pos) { pos.stop = ev.newStop; if (ev.exit) sells.push({ pair, ev, barT: barT! }); }
      else if (ev.entry) buys.push({ pair, ev, barT: barT! });
    }

    const feeF = cfg.exec.feeTakerPct / 100;

    // ---- 5. jual dulu (di BID), lalu beli (di ASK) ----
    for (const s of sells) {
      const book = data[s.pair].book, pos = st.positions[s.pair];
      if (!book || !book.bids.length) { L.events.push({ t: now, type: "jual_gagal_tanpa_orderbook", pair: s.pair }); continue; }
      const r = walkQty(book.bids, pos.qty);
      if (r.filled <= 0 || r.cost < cfg.exec.minOrderIdr) { L.events.push({ t: now, type: "jual_di_bawah_minimum", pair: s.pair, nilai: r.cost }); continue; }
      const fee = r.cost * feeF;
      st.cash += r.cost - fee;
      pos.qty -= r.filled;
      if (pos.qty < 1e-10) delete st.positions[s.pair];
      L.orders.push({ t: now, pair: s.pair, side: "sell", qty: r.filled, bestBid: book.bids[0].price, bestAsk: book.asks[0]?.price ?? null,
        avgFill: r.avg, fee, signalPrice: s.ev.close, slipVsSignalPct: (r.avg / s.ev.close - 1) * 100, bar: s.barT, levelsUsed: r.levelsUsed });
    }
    for (const b of buys) {
      const why = (killed && "kill_switch") || (st.halted && "daily_loss_limit") || (Object.keys(st.positions).length >= cfg.risk.maxPositions && "batas_posisi") || "";
      if (why) { L.events.push({ t: now, type: "beli_diblokir", pair: b.pair, alasan: why }); continue; }
      const book = data[b.pair].book;
      const bw = book ? validateBook(book, cfg.exec.maxSpreadPct) : ["orderbook_tidak_ada"];
      if (bw.length || !book) { L.events.push({ t: now, type: "beli_diblokir", pair: b.pair, alasan: bw.join(",") }); continue; }
      const eq = equityNow();
      const budget = positionBudget(eq, st.cash, cfg);
      let qty = floorDec(qtyForBudget(book.asks, budget / (1 + feeF)), cfg.exec.qtyDecimals);
      let r = walkQty(book.asks, qty);
      if (r.filled > 0 && r.cost * (1 + feeF) > st.cash) { qty = floorDec(qty * st.cash / (r.cost * (1 + feeF)) * 0.999, cfg.exec.qtyDecimals); r = walkQty(book.asks, qty); }
      if (r.filled < qty) { qty = floorDec(r.filled, cfg.exec.qtyDecimals); r = walkQty(book.asks, qty); }
      if (r.filled <= 0 || r.cost < cfg.exec.minOrderIdr) { L.events.push({ t: now, type: "beli_diblokir", pair: b.pair, alasan: "di_bawah_minimum_order", nilai: r.cost }); continue; }
      const fee = r.cost * feeF;
      st.cash -= r.cost + fee;
      st.positions[b.pair] = { qty: r.filled, entryPrice: r.avg, entryT: now, stop: b.ev.newStop, feeBuy: fee };
      L.orders.push({ t: now, pair: b.pair, side: "buy", qty: r.filled, bestBid: book.bids[0].price, bestAsk: book.asks[0].price,
        avgFill: r.avg, fee, signalPrice: b.ev.close, slipVsSignalPct: (r.avg / b.ev.close - 1) * 100, bar: b.barT, levelsUsed: r.levelsUsed });
    }

    // ---- 6. simpan ----
    equity = equityNow();
    L.calls.push({ t: now, startedAtMs: t0, durationMs: Date.now() - t0, status: "ok", processed, equity, cash: st.cash,
      openPositions: Object.keys(st.positions).length, btcBid, killed, halted: st.halted, nErrors: L.errors.length });
    await store.set("state", JSON.stringify(st));
    await flush(store, L);
    return { status: "ok", now, processed: processed.length, orders: L.orders.length, equity, errors: L.errors.length };
  } catch (e: any) {
    L.errors.push({ t: now, pair: null, where: "runTick", msg: String(e?.message ?? e) });
    L.calls.push({ t: now, startedAtMs: t0, durationMs: Date.now() - t0, status: "gagal", nErrors: L.errors.length });
    try { await flush(store, L); } catch { /* abaikan */ }
    throw e;
  } finally {
    await store.unlock("tick");
  }
}

async function flush(store: Store, L: Record<string, any[]>) {
  for (const k of Object.keys(L)) if (L[k].length) await store.push(logKey(k), L[k]);
}

/** Hanya simpan snapshot order book (dipanggil terpisah, mis. tiap jam sebelum freeze). */
export async function takeSnapshots(store: Store, api: Api, cfg: Config) {
  const now = await api.serverTime();
  const rows: any[] = [], errs: any[] = [];
  for (const pair of cfg.pairs) {
    try { rows.push({ t: now, pair, ...topLevels(await api.depth(pair)) }); }
    catch (e: any) { errs.push({ t: now, pair, where: "snapshot", msg: String(e?.message ?? e) }); }
  }
  await store.push(logKey("snapshots"), rows);
  await store.push(logKey("errors"), errs);
  return { saved: rows.length, errors: errs.length };
}
