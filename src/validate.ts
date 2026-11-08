import { Candle, Book } from "./types";
import { WINDOW } from "./signal";

/** Kembalikan daftar alasan data TIDAK valid (kosong = valid). `closed` = hanya bar yang sudah tertutup. */
export function validateCandles(closed: Candle[], tfSec: number, nowSec: number): string[] {
  const why: string[] = [];
  if (closed.length === 0) return ["candle_kosong"];
  const last = closed[closed.length - 1];
  if (nowSec - (last.t + tfSec) > 2 * tfSec) why.push("candle_terakhir_usang");
  if (closed.length < WINDOW) why.push(`bar_kurang(${closed.length}<${WINDOW})`);
  const win = closed.slice(-WINDOW);
  for (let k = 1; k < win.length; k++) {
    if (win[k].t - win[k - 1].t !== tfSec) { why.push("candle_hilang_di_jendela"); break; }
  }
  if (win.some(c => !(c.o > 0 && c.h > 0 && c.l > 0 && c.c > 0))) why.push("harga_nol");
  if (!(last.v > 0)) why.push("volume_nol");
  return why;
}

export function validateBook(b: Book, maxSpreadPct: number): string[] {
  if (!b.bids.length || !b.asks.length) return ["orderbook_kosong"];
  const bid = b.bids[0].price, ask = b.asks[0].price;
  if (!(bid > 0 && ask > 0)) return ["harga_nol"];
  const spread = ((ask - bid) / bid) * 100;
  if (spread > maxSpreadPct) return [`spread_lebar(${spread.toFixed(2)}%)`];
  return [];
}
