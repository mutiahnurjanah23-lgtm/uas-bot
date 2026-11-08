// TES LOKAL dengan data SINTETIS (bukan data pasar!) hanya untuk memastikan alur bot berjalan benar:
// bar belum tertutup dibuang, idempotency, kill switch, risk limit, fill dari order book. JANGAN dipakai sebagai hasil.
import * as fs from "fs";
import { CONFIG } from "../src/config";
import { runTick } from "../src/bot";
import { FileStore, logKey } from "../src/storage";
import { Api, Candle } from "../src/types";
import { evaluate, WINDOW } from "../src/signal";
import { simulate } from "../src/sim";

const cfg = { ...CONFIG, pairs: ["btcidr", "ethidr"], tradingStartUnix: 1, exec: { ...CONFIG.exec, feeTakerPct: 0.5 } };
const T0 = 1_760_000_000 - (1_760_000_000 % 3600), N = 620, TF = 3600;
function series(scale: number): Candle[] {
  let seed = 7, p = 100 * scale; const out: Candle[] = [];
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
  for (let i = 0; i < N + 1; i++) {                       // bar ke-N = candle yang masih berjalan
    const o = p; p = i === N - 1 ? p * 1.06 : p * (1 + 0.0012 + 0.004 * rnd());
    out.push({ t: T0 + i * TF, o, h: Math.max(o, p) * 1.001, l: Math.min(o, p) * 0.999, c: p, v: 10 });
  }
  return out;
}
const data: Record<string, Candle[]> = { btcidr: series(1e6), ethidr: series(5e4) };
const now = T0 + N * TF + 420;                              // 7 menit setelah bar N-1 tertutup
const mkApi = (): Api => ({
  serverTime: async () => now,
  candles: async (pair) => data[pair],                       // sengaja ikut mengirim bar yang masih berjalan
  depth: async (pair) => { const c = data[pair][N - 1].c; return {
    bids: [0, 1, 2, 3].map(k => ({ price: c * (0.999 - k * 0.001), amount: 5 })),
    asks: [0, 1, 2, 3].map(k => ({ price: c * (1.001 + k * 0.001), amount: 0.0004 * (k + 1) * (k ? 1 : 1) })) }; },
});
const ok = (c: boolean, m: string) => { console.log((c ? "LULUS  " : "GAGAL  ") + m); if (!c) process.exitCode = 1; };
const fresh = () => { const f = "/tmp/uas_test_store.json"; if (fs.existsSync(f)) fs.unlinkSync(f); return new FileStore(f); };

(async () => {
  // sinyal bar terakhir tertutup (indeks N-1) harus entry
  const ev = evaluate(data.btcidr.slice(0, N), null, cfg.params);
  ok(ev.ready && ev.entry, `sinyal entry pada bar tertutup terakhir (adx=${ev.adx.toFixed(1)})`);
  const evRunning = evaluate(data.btcidr.slice(0, N + 1), null, cfg.params);
  ok(evRunning.t !== ev.t, "bar berjalan memang beda dengan bar tertutup (bot harus membuangnya)");

  let store = fresh();
  const r1 = await runTick({ store, api: mkApi(), cfg });
  const o1 = await store.list(logKey("orders"));
  ok(r1.status === "ok" && o1.length >= 1, `tick 1 membuat order beli (${o1.length} order)`);
  const sig = (await store.list(logKey("signals")))[0];
  ok(sig.t === T0 + (N - 1) * TF, "bot memproses bar tertutup terakhir, bukan bar berjalan");
  ok(o1.every((o: any) => o.avgFill >= o.bestAsk - 1e-9), "fill beli >= best ask (bukan mid/close)");
  ok(o1.some((o: any) => o.levelsUsed > 1), "order besar menghabiskan >1 level order book (harga rata-rata)");
  const st1 = JSON.parse((await store.get("state"))!);
  const r2 = await runTick({ store, api: mkApi(), cfg });
  const o2 = await store.list(logKey("orders"));
  ok(o2.length === o1.length, "tick 2 pada candle yang sama TIDAK membeli lagi (idempotency)");
  ok((await store.list(logKey("events"))).some((e: any) => e.type === "duplikat_dilewati"), "duplikat tercatat di log events");
  ok(Math.abs(JSON.parse((await store.get("state"))!).cash - st1.cash) < 1e-6, "kas tidak berubah pada panggilan duplikat");

  store = fresh();
  await runTick({ store, api: mkApi(), cfg, killEnv: true });
  ok((await store.list(logKey("orders"))).length === 0, "kill switch menahan pembelian");
  ok((await store.list(logKey("events"))).some((e: any) => e.type === "kill_switch_aktif"), "pemakaian kill switch tercatat");

  store = fresh();
  await store.set("killswitch", "1");
  await runTick({ store, api: mkApi(), cfg });
  ok((await store.list(logKey("orders"))).length === 0, "kill switch lewat storage (tanpa deploy ulang) bekerja");

  const cfg2 = { ...cfg, risk: { ...cfg.risk, maxPositions: 1 } };
  store = fresh();
  await runTick({ store, api: mkApi(), cfg: cfg2 });
  ok((await store.list(logKey("orders"))).length === 1, "batas jumlah posisi terbuka dipatuhi");

  // paritas: sinyal di simulasi backtest pada bar terakhir sama dengan sinyal bot
  const sim = simulate({ btcidr: data.btcidr.slice(0, N), ethidr: data.ethidr.slice(0, N) }, cfg, {});
  const last = sim.signals.filter(s => s.pair === "btcidr" && s.t === T0 + (N - 1) * TF)[0];
  ok(!!last && last.entry === sig.entry && Math.abs(last.chand - sig.chand) < 1e-9 * Math.abs(sig.chand), "sinyal backtest = sinyal bot pada candle yang sama (100% identik)");

  // pre-start: sebelum tradingStartUnix tidak ada order
  store = fresh();
  await runTick({ store, api: mkApi(), cfg: { ...cfg, tradingStartUnix: now + 1000 } });
  ok((await store.list(logKey("orders"))).length === 0 && (await store.list(logKey("snapshots"))).length > 0, "sebelum waktu mulai: hanya snapshot, tanpa order");
})().catch(e => { console.error("ERROR", e); process.exit(1); });
