import { useEffect, useRef } from "react";
import { ChartManager } from "../utils/ChartManager";
import { KLine } from "../utils/types";
import axios from "axios";

export const BASE_URL = "https://api.backpack.exchange/api/v1";


const LOCAL_PROXY_URL = "/api/klines";

async function getKlines(
  market: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<KLine[]> {
  try {
    const url = `${LOCAL_PROXY_URL}?symbol=${market}&interval=${interval}&startTime=${startTime}&endTime=${endTime}`;
    console.log("Requesting via proxy:", url);
    const response = await axios.get(url);

    const data: KLine[] = response.data;
    return data.sort((x, y) => Number(x.end) - Number(y.end));
  } catch (error: any) {
    console.error("Error fetching Klines:", error.message || error);
    throw error;
  }
}

export function TradeView({ market }: { market: string }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartManagerRef = useRef<ChartManager | null>(null);
  const lastCandleRef = useRef<any>(null);

  useEffect(() => {
    const init = async () => {
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      const oneWeekAgo = now - 7 * 24 * oneHour;

      const klineData = await getKlines(
        market,
        "1h",
        Math.floor(oneWeekAgo / 1000),
        Math.floor(now / 1000)
      );

      const parsedData = klineData.map((x) => ({
        close: parseFloat(x.close),
        high: parseFloat(x.high),
        low: parseFloat(x.low),
        open: parseFloat(x.open),
        timestamp: x.end,
      }));

      if (chartRef.current) {
        chartManagerRef.current?.destroy();

        chartManagerRef.current = new ChartManager(
          chartRef.current,
          parsedData,
          {
            background: "#14151B",
            color: "white",
          }
        );

        lastCandleRef.current = parsedData[parsedData.length - 1];
      }

      const ws = new WebSocket("wss://ws.backpack.exchange");

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            method: "SUBSCRIBE",
            params: [`trade.${market}`],
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.e !== "trade") return;

          const price = parseFloat(msg.p);
          const timestamp = msg.T;
          const bucket =
            Math.floor(timestamp / (60 * 60 * 1000)) * 60 * 60 * 1000;

          if (
            !lastCandleRef.current ||
            +new Date(lastCandleRef.current.timestamp) !== bucket
          ) {
            const newCandle = {
              open: price,
              high: price,
              low: price,
              close: price,
              timestamp: new Date(bucket).toISOString(),
            };
            lastCandleRef.current = newCandle;
            chartManagerRef.current?.update(newCandle);
          } else {
            const candle = lastCandleRef.current;
            candle.close = price;
            candle.high = Math.max(candle.high, price);
            candle.low = Math.min(candle.low, price);
            chartManagerRef.current?.update(candle);
          }
        } catch (err) {
          console.error("Failed to process trade message:", err);
        }
      };

      return () => {
        ws.close();
        chartManagerRef.current?.destroy();
      };
    };

    init();
  }, [market]);

  return (
    <div
      ref={chartRef}
      style={{
        height: "520px",
        width: "100%",
        marginTop: 4,
        background: "#14151B",
      }}
    />
  );
}
