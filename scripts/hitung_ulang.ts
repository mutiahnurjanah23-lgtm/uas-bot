// Menghasilkan ULANG semua angka dashboard dari log mentah (data/logs/*.json) + membuat dashboard HTML offline.
//   npm run export-log   (ambil log)   ->   npm run hitung-ulang
import * as fs from "fs";
import { CONFIG } from "../src/config";
import { computeForward, Logs } from "../src/metrics";

const L: any = {};
for (const n of ["calls", "signals", "orders", "equity", "errors", "events", "snapshots"]) L[n] = JSON.parse(fs.readFileSync(`data/logs/${n}.json`, "utf8"));
const fw = computeForward(L as Logs, CONFIG);
const j = (f: string) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null);
const data = {
  generatedAt: Math.floor(Date.now() / 1000),
  config: { pairs: CONFIG.pairs, params: CONFIG.params, tradingStartUnix: CONFIG.tradingStartUnix, feeTakerPct: CONFIG.exec.feeTakerPct },
  forward: fw, backtest: j("data/backtest_result.json"), compare: j("data/compare.json"),
};
fs.writeFileSync("data/metrics_forward.json", JSON.stringify(data));
fs.mkdirSync("dist", { recursive: true });
const html = fs.readFileSync("public/index.html", "utf8").replace("/*DATA*/null", JSON.stringify(data).replace(/</g, "\\u003c"));
fs.writeFileSync("dist/dashboard_offline.html", html);
console.log("Forward:", JSON.stringify(fw.metrics, null, 1));
console.log("Ops:", JSON.stringify(fw.ops, null, 1));
console.log("OK -> data/metrics_forward.json , dist/dashboard_offline.html");
