// Ambil semua log mentah dari storage (Upstash) ke data/logs/*.json untuk dikumpulkan dan dihitung ulang.
import * as fs from "fs";
import { makeStore, LOGS, logKey } from "../src/storage";

(async () => {
  const store = makeStore();
  fs.mkdirSync("data/logs", { recursive: true });
  for (const n of LOGS) {
    const rows = await store.list(logKey(n));
    fs.writeFileSync(`data/logs/${n}.json`, JSON.stringify(rows));
    console.log(n.padEnd(10), rows.length, "baris");
  }
  const st = await store.get("state");
  if (st) fs.writeFileSync("data/logs/state.json", st);
  console.log("OK -> data/logs/");
})();
