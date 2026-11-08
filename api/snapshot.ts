import { authorized } from "../src/auth";
import { makeStore } from "../src/storage";
import { indodax } from "../src/indodax";
import { CONFIG } from "../src/config";
import { takeSnapshots } from "../src/bot";

export default async function handler(req: any, res: any) {
  if (!authorized(req)) return res.status(401).json({ error: "unauthorized" });
  try { return res.status(200).json(await takeSnapshots(makeStore(), indodax, CONFIG)); }
  catch (e: any) { return res.status(500).json({ error: String(e?.message ?? e) }); }
}
