
export interface Trade {
  id: number;
  isBuyerMaker: boolean;
  price: string;
  quantity: string;
  timestamp: number;
}

export interface Depth {
    bids: [string, string][];
    asks: [string, string][];
    lastUpdateId: string;
}

export interface Ticker {
    firstPrice: string;
    high: string;
    lastPrice: string;
    low: string;
    priceChange: string;
    priceChangePercent: string;
    quoteVolume: string;
    symbol: string;
    trades: string;
    volume: string;
}

export interface KLine {
  open: string;
  high: string;
  low: string;
  close: string;
  start: string;
  end: string;
  volume: string;
  quoteVolume: string;
  trades: string;
}