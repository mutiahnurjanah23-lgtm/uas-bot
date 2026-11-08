import { timingSafeEqual } from "crypto";

/** Endpoint dilindungi CRON_SECRET: header  Authorization: Bearer <CRON_SECRET>  */
export function authorized(req: any): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false; // tanpa secret yang layak, endpoint selalu menolak
  const got = String(req.headers?.authorization ?? "");
  const want = `Bearer ${secret}`;
  const a = Buffer.from(got), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}
