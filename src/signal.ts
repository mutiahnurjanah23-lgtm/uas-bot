// =====================================================================
//  FUNGSI SINYAL - dipakai OLEH BACKTEST DAN BOT (kode yang sama persis).
//  Sinyal hanya dihitung dari WINDOW bar tertutup terakhir, jadi hasilnya
//  identik kapan pun dihitung (di backtest maupun di bot).
//  Strategi = versi UTS: Donchian breakout + EMA trend + ADX + Chandelier exit.
// =====================================================================
import { Candle } from "./types";

export interface Params { bl: number; tl: number; adxLen: number; adxMin: number; chandLen: number; chandMult: number }
export const WINDOW = 400; // jumlah bar tertutup yang dipakai untuk satu sinyal

export interface Eval {
  ready: boolean;
  t: number;
  close: number;
  entry: boolean;      // sinyal masuk (breakout + tren naik + ADX kuat)
  exit: boolean;       // sinyal keluar (hanya relevan bila punya posisi)
  newStop: number;     // stop Chandelier terbaru (stop hanya boleh naik)
  don: number; emaT: number; adx: number; atr: number; chand: number;
}

// EWMA seperti pandas ewm(alpha, adjust=False) - sama dengan versi UTS
function ewma(x: number[], alpha: number): number[] {
  const out = new Array<number>(x.length);
  out[0] = x[0];
  for (let i = 1; i < x.length; i++) out[i] = alpha * x[i] + (1 - alpha) * out[i - 1];
  return out;
}

export function evaluate(candles: Candle[], pos: { stop: number } | null, p: Params): Eval {
  const w = candles.slice(-WINDOW);
  const i = w.length - 1;
  const empty: Eval = { ready: false, t: w[i]?.t ?? 0, close: w[i]?.c ?? NaN, entry: false, exit: false, newStop: pos?.stop ?? -Infinity,
    don: NaN, emaT: NaN, adx: NaN, atr: NaN, chand: NaN };
  if (w.length < WINDOW) return empty;

  const n = w.length;
  const tr: number[] = new Array(n), pdm: number[] = new Array(n), mdm: number[] = new Array(n);
  tr[0] = w[0].h - w[0].l; pdm[0] = 0; mdm[0] = 0;
  for (let k = 1; k < n; k++) {
    const pc = w[k - 1].c;
    tr[k] = Math.max(w[k].h - w[k].l, Math.abs(w[k].h - pc), Math.abs(w[k].l - pc));
    const up = w[k].h - w[k - 1].h, dn = w[k - 1].l - w[k].l;
    pdm[k] = up > dn && up > 0 ? up : 0;
    mdm[k] = dn > up && dn > 0 ? dn : 0;
  }
  const a = 1 / p.adxLen;
  const atrS = ewma(tr, a), pS = ewma(pdm, a), mS = ewma(mdm, a);
  const dx: number[] = new Array(n);
  for (let k = 0; k < n; k++) {
    const pdi = atrS[k] > 0 ? (100 * pS[k]) / atrS[k] : 0;
    const mdi = atrS[k] > 0 ? (100 * mS[k]) / atrS[k] : 0;
    dx[k] = pdi + mdi > 0 ? (100 * Math.abs(pdi - mdi)) / (pdi + mdi) : 0;
  }
  const adx = ewma(dx, a)[i];
  const atr = atrS[i];

  let don = -Infinity;                       // level tertinggi bl bar SEBELUMNYA (tidak termasuk bar sekarang)
  for (let k = i - p.bl; k < i; k++) don = Math.max(don, w[k].h);

  const ea = 2 / (p.tl + 1);
  let emaT = w[0].c;
  for (let k = 1; k < n; k++) emaT = ea * w[k].c + (1 - ea) * emaT;

  let hh = -Infinity;
  for (let k = i - p.chandLen + 1; k <= i; k++) hh = Math.max(hh, w[k].h);
  const chand = hh - p.chandMult * atr;

  const close = w[i].c;
  const entry = close > don && close > emaT && adx > p.adxMin;
  const newStop = pos ? Math.max(pos.stop, chand) : chand;
  const exit = pos ? close < newStop : false;
  return { ready: true, t: w[i].t, close, entry, exit, newStop, don, emaT, adx, atr, chand };
}
