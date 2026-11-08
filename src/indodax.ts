// Klien API PUBLIK Indodax (tanpa API key). Batas resmi 180 request/menit;
// kita jaga maksimal ~3 request/detik, berurutan (tidak paralel), dengan retry terbatas.
import { Api, Book, Candle, Level } from "./types";
import { CONFIG } from "./config";

const BASE = "https://indodax.com";
const MIN_GAP_MS = 350;
let lastCall = 0;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function getJson(url: string, tries = 3, timeoutMs = 10_000): Promise<any> {
  let err: any;
  for (let k = 1; k <= tries; k++) {
    const wait = MIN_GAP_MS - (Date.now() - lastCall);
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await fetch(url, { signal: ac.signal, headers: { accept: "application/json" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j == null || (Array.isArray(j) && j.length === 0)) throw new Error("respons_kosong");
      return j;
    } catch (e: any) {
      err = e;
      if (k < tries) await sleep(500 * k); // backoff sederhana
    } finally { clearTimeout(timer); }
  }
  throw new Error(`gagal ${url}: ${err?.message ?? err}`);
}

export function parseCandles(j: any): Candle[] {
  let rows: Candle[] = [];
  if (Array.isArray(j)) {
    rows = j.map((x: any) => ({
      t: Number(x.Time ?? x.time ?? x.t), o: Number(x.Open ?? x.open ?? x.o), h: Number(x.High ?? x.high ?? x.h),
      l: Number(x.Low ?? x.low ?? x.l), c: Number(x.Close ?? x.close ?? x.c), v: Number(x.Volume ?? x.volume ?? x.v),
    }));
  } else if (j && Array.isArray(j.t)) {          // format TradingView {t:[],o:[],...}
    rows = j.t.map((t: number, i: number) => ({ t: Number(t), o: Number(j.o[i]), h: Number(j.h[i]), l: Number(j.l[i]), c: Number(j.c[i]), v: Number(j.v[i]) }));
  }
  rows = rows.filter(r => [r.t, r.o, r.h, r.l, r.c].every(Number.isFinite));
  rows.sort((a, b) => a.t - b.t);
  return rows.filter((r, i) => i === 0 || r.t !== rows[i - 1].t);
}

function parseLevels(x: any): Level[] {
  return (Array.isArray(x) ? x : []).map((r: any) => ({ price: Number(r[0]), amount: Number(r[1]) }))
    .filter(l => Number.isFinite(l.price) && Number.isFinite(l.amount) && l.amount > 0);
}

export const indodax: Api = {
  async serverTime() {
    const j = await getJson(`${BASE}/api/server_time`);
    const t = Number(j.server_time);
    if (!Number.isFinite(t)) throw new Error("server_time_tidak_valid");
    return t > 1e12 ? Math.floor(t / 1000) : t;
  },
  async candles(pair, from, to) {
    const tf = CONFIG.tf;
    const j = await getJson(`${BASE}/tradingview/history_v2?symbol=${pair.toUpperCase()}&tf=${tf}&from=${from}&to=${to}`);
    return parseCandles(j);
  },
  async depth(pair) {
    const j = await getJson(`${BASE}/api/depth/${pair}`);
    const bids = parseLevels(j.buy).sort((a, b) => b.price - a.price);
    const asks = parseLevels(j.sell).sort((a, b) => a.price - b.price);
    return { bids, asks } as Book;
  },
};

export async function getPairsInfo(): Promise<any[]> { return getJson(`${BASE}/api/pairs`); }
export async function getPriceIncrements(): Promise<any> { return getJson(`${BASE}/api/price_increments`); }

/** Tarik candle historis MUNDUR: to=sekarang, lalu geser to ke bar paling awal yang didapat. */
export async function fetchHistoryBackward(pair: string, tfSeconds: number, startUnix: number, endUnix: number,
  onProgress?: (n: number, earliest: number) => void): Promise<Candle[]> {
  const all = new Map<number, Candle>();
  let cursor = endUnix;
  for (let guard = 0; guard < 400; guard++) {
    const rows = await indodax.candles(pair, startUnix, cursor);
    if (!rows.length) break;
    for (const r of rows) all.set(r.t, r);
    const earliest = rows[0].t;
    onProgress?.(all.size, earliest);
    if (earliest <= startUnix || earliest >= cursor) break; // sudah sampai awal / tidak ada kemajuan
    cursor = earliest;
  }
  return [...all.values()].sort((a, b) => a.t - b.t).filter(c => c.t + tfSeconds > startUnix);
}
