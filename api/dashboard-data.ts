import { makeStore, LOGS, logKey } from "../src/storage";
import { CONFIG } from "../src/config";
import { computeForward, Logs } from "../src/metrics";

export default async function handler(_req: any, res: any) {
  try {
    const store = makeStore();
    const L: any = {};
    for (const n of LOGS) L[n] = await store.list(logKey(n));
    const j = async (k: string) => { const v = await store.get(k); return v ? JSON.parse(v) : null; };
    const fw = computeForward(L as Logs, CONFIG);
    // snapshot mentah tidak dikirim ke browser (besar); angkanya sudah diringkas di ops
    res.setHeader("Cache-Control", "s-maxage=60");
    return res.status(200).json({
      generatedAt: Math.floor(Date.now() / 1000),
      config: { pairs: CONFIG.pairs, params: CONFIG.params, tradingStartUnix: CONFIG.tradingStartUnix, feeTakerPct: CONFIG.exec.feeTakerPct },
      forward: fw, backtest: await j("backtest"), compare: await j("compare"),
    });
  } catch (e: any) { return res.status(500).json({ error: String(e?.message ?? e) }); }
}
