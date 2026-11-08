import { Config } from "./config";

/** Tanggal WIB (UTC+7) dari detik unix. Hari berganti 00.00 WIB = 17.00 UTC. */
export function wibDate(unix: number): string {
  return new Date((unix + 7 * 3600) * 1000).toISOString().slice(0, 10);
}

/** Nilai rupiah maksimum untuk SATU posisi baru (sebelum fee). */
export function positionBudget(equity: number, cash: number, cfg: Config): number {
  return Math.min(cfg.risk.maxPositionPct * equity, cash);
}

export function dailyLossBreached(dayStartEquity: number, equity: number, cfg: Config): boolean {
  return dayStartEquity > 0 && equity < dayStartEquity * (1 - cfg.risk.dailyLossLimitPct / 100);
}

export function floorDec(x: number, dec: number): number {
  const m = Math.pow(10, dec);
  return Math.floor(x * m + 1e-9) / m;
}
