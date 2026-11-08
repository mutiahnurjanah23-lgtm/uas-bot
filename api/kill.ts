// Kill switch manual tanpa deploy ulang:  GET /api/kill?on=1  (aktif)  /  ?on=0  (nonaktif)
import { authorized } from "../src/auth";
import { makeStore } from "../src/storage";
import { logKey } from "../src/storage";

export default async function handler(req: any, res: any) {
  if (!authorized(req)) return res.status(401).json({ error: "unauthorized" });
  const on = String(req.query?.on ?? "") === "1";
  const store = makeStore();
  await store.set("killswitch", on ? "1" : "0");
  await store.push(logKey("events"), [{ t: Math.floor(Date.now() / 1000), type: on ? "kill_switch_dinyalakan" : "kill_switch_dimatikan" }]);
  return res.status(200).json({ killswitch: on });
}
