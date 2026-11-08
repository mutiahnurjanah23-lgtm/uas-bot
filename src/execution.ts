// Fill simulasi dari order book LIVE: beli di ask, jual di bid, habiskan level berikutnya
// kalau order lebih besar dari level terbaik, pakai harga rata-rata. Dilarang fill di mid/close.
import { Level } from "./types";

/** Berapa koin yang bisa dibeli dengan budget rupiah (sebelum pembulatan). */
export function qtyForBudget(levels: Level[], budgetIdr: number): number {
  let rem = budgetIdr, qty = 0;
  for (const L of levels) {
    if (rem <= 0) break;
    const take = Math.min(L.amount, rem / L.price);
    qty += take; rem -= take * L.price;
  }
  return qty;
}

/** Fill untuk kuantitas tertentu. filled bisa < qty bila kedalaman order book tidak cukup. */
export function walkQty(levels: Level[], qty: number): { filled: number; cost: number; avg: number; levelsUsed: number } {
  let rem = qty, cost = 0, filled = 0, used = 0;
  for (const L of levels) {
    if (rem <= 0) break;
    const take = Math.min(L.amount, rem);
    cost += take * L.price; filled += take; rem -= take; used++;
  }
  return { filled, cost, avg: filled > 0 ? cost / filled : NaN, levelsUsed: used };
}
