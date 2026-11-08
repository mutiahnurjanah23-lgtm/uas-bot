import { authorized } from "../src/auth";
import { makeStore } from "../src/storage";
import { indodax } from "../src/indodax";
import { CONFIG } from "../src/config";
import { runTick } from "../src/bot";

export default async function handler(req: any, res: any) {
  if (!authorized(req)) return res.status(401).json({ error: "unauthorized" });
  try {
    const out = await runTick({ store: makeStore(), api: indodax, cfg: CONFIG, killEnv: process.env.KILL_SWITCH === "1" });
    return res.status(200).json(out);
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message ?? e) });
  }
}
