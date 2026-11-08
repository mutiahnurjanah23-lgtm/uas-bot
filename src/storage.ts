// Penyimpanan persisten. Di Vercel: Upstash Redis (REST). Lokal/tes: file JSON.
import * as fs from "fs";
import * as path from "path";

export interface Store {
  get(key: string): Promise<string | null>;
  set(key: string, val: string): Promise<void>;
  push(list: string, items: object[]): Promise<void>;
  list(list: string): Promise<any[]>;
  lock(key: string, ttlSec: number): Promise<boolean>;
  unlock(key: string): Promise<void>;
}

class UpstashStore implements Store {
  constructor(private url: string, private token: string) {}
  private async cmd(args: (string | number)[]): Promise<any> {
    const r = await fetch(this.url, { method: "POST", headers: { Authorization: `Bearer ${this.token}`, "content-type": "application/json" }, body: JSON.stringify(args) });
    const j: any = await r.json();
    if (!r.ok || j.error) throw new Error(`Upstash: ${j.error ?? r.status}`);
    return j.result;
  }
  async get(k: string) { return (await this.cmd(["GET", k])) ?? null; }
  async set(k: string, v: string) { await this.cmd(["SET", k, v]); }
  async push(l: string, items: object[]) { if (items.length) await this.cmd(["RPUSH", l, ...items.map(i => JSON.stringify(i))]); }
  async list(l: string) { const r: string[] = (await this.cmd(["LRANGE", l, 0, -1])) ?? []; return r.map(x => JSON.parse(x)); }
  async lock(k: string, ttl: number) { return (await this.cmd(["SET", k, "1", "NX", "EX", ttl])) === "OK"; }
  async unlock(k: string) { await this.cmd(["DEL", k]); }
}

export class FileStore implements Store {
  private db: Record<string, any>;
  constructor(private file = path.join(process.cwd(), "data", "local-store.json")) {
    this.db = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  }
  private save() { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file, JSON.stringify(this.db)); }
  async get(k: string) { return this.db[k] ?? null; }
  async set(k: string, v: string) { this.db[k] = v; this.save(); }
  async push(l: string, items: object[]) { (this.db[l] ??= []).push(...items); this.save(); }
  async list(l: string) { return this.db[l] ?? []; }
  async lock(k: string) { if (this.db["lock:" + k]) return false; this.db["lock:" + k] = 1; return true; }
  async unlock(k: string) { delete this.db["lock:" + k]; }
}

export function makeStore(): Store {
    const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
   const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) return new UpstashStore(url, token);
  if (process.env.VERCEL) throw new Error("Storage Upstash belum dikonfigurasi di Vercel (UPSTASH_REDIS_REST_URL/TOKEN)");
  return new FileStore();
}

export const LOGS = ["calls", "signals", "orders", "equity", "errors", "events", "snapshots"] as const;
export const logKey = (n: string) => `log:${n}`;
