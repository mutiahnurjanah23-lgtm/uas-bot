// Cetak fee, minimum order, kenaikan harga untuk pair di universe, dari API publik.
// Salin angkanya + URL + tanggal akses ke docs/STRATEGI.md, lalu isi src/config.ts.
import { CONFIG } from "../src/config";
import { getPairsInfo, getPriceIncrements } from "../src/indodax";

(async () => {
  const pairs = await getPairsInfo();
  const inc = await getPriceIncrements().catch(() => null);
  console.log("Diakses:", new Date().toISOString(), "\nURL: https://indodax.com/api/pairs , https://indodax.com/api/price_increments\n");
  for (const id of CONFIG.pairs) {
    const p = (Array.isArray(pairs) ? pairs : []).find((x: any) => x.id === id || x.ticker_id === id.replace("idr", "_idr"));
    console.log(id, p ? JSON.stringify({
      trade_fee_percent_taker: p.trade_fee_percent_taker, trade_min_base_currency: p.trade_min_base_currency,
      trade_min_traded_currency: p.trade_min_traded_currency, price_round: p.price_round, volume_precision: p.volume_precision, is_maintenance: p.is_maintenance,
    }) : "TIDAK DITEMUKAN - cek penulisan id pair", "| price_increment:", inc?.increments?.[id.replace("idr", "_idr")] ?? inc?.[id.replace("idr", "_idr")] ?? "?");
  }
  console.log("\nIngat: cek juga halaman resmi 'Rincian Biaya Transaksi' di help.indodax.com, pakai tarif yang LEBIH MAHAL.");
})();
