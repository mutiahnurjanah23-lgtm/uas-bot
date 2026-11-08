export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number } // t = detik unix, waktu BUKA bar
export interface Level { price: number; amount: number }
export interface Book { bids: Level[]; asks: Level[] } // bids: tertinggi dulu, asks: terendah dulu

export interface Position {
  qty: number;
  entryPrice: number;
  entryT: number;
  stop: number;
  feeBuy: number;
}

export interface State {
  cash: number;
  positions: Record<string, Position>;
  lastBar: Record<string, number>;   // bar terakhir yang sudah diproses per pair (idempotency)
  day: string;                       // tanggal WIB terakhir
  dayStartEquity: number;
  halted: boolean;                   // daily loss limit kena
  lastBid: Record<string, number>;   // best bid terakhir yang diketahui (untuk menilai posisi bila order book gagal)
}

export interface Api {
  serverTime(): Promise<number>;
  candles(pair: string, from: number, to: number): Promise<Candle[]>;
  depth(pair: string): Promise<Book>;
}
