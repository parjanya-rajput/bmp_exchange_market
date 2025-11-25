"use client";
import { useEffect, useState } from "react";
import { Ticker } from "../utils/types";
import { ConnectionManager } from "../utils/ConnectionManager";
import Image from "next/image";

const MarketBar = ({ market }: { market: string }) => {
  const [ticker, setTicker] = useState<Partial<Ticker> | null>(null);

  const [base, quote] = market.split("_");
  const baseImg = `/${base.toLowerCase()}.webp`;
  const quoteImg = `/${quote.toLowerCase()}.webp`;

  useEffect(() => {
    ConnectionManager.getInstance().registerCallback(
      "ticker",
      (data: Partial<Ticker>) =>
        setTicker((prevTicker) => ({
          firstPrice: data?.firstPrice ?? prevTicker?.firstPrice ?? "",
          high: data?.high ?? prevTicker?.high ?? "",
          lastPrice: data?.lastPrice ?? prevTicker?.lastPrice ?? "",
          low: data?.low ?? prevTicker?.low ?? "",
          priceChange: data?.priceChange ?? prevTicker?.priceChange ?? "",
          priceChangePercent:
            data?.priceChangePercent ?? prevTicker?.priceChangePercent ?? "",
          quoteVolume: data?.quoteVolume ?? prevTicker?.quoteVolume ?? "",
          symbol: data?.symbol ?? prevTicker?.symbol ?? "",
          trades: data?.trades ?? prevTicker?.trades ?? "",
          volume: data?.volume ?? prevTicker?.volume ?? "",
        })),
      `TICKER-${market}`
    );

    ConnectionManager.getInstance().sendMessage({
      method: "SUBSCRIBE",
      params: [`ticker.${market}`],
    });

    return () => {
      ConnectionManager.getInstance().deRegisterCallback(
        "ticker",
        `TICKER-${market}`
      );
      ConnectionManager.getInstance().sendMessage({
        method: "UNSUBSCRIBE",
        params: [`ticker.${market}`],
      });
    };
  }, [market]);

  const priceChange = Number(ticker?.priceChange || 0);
  const priceChangePercent = Number(ticker?.priceChangePercent || 0).toFixed(2);
  const isPositive = priceChange > 0;

  return (
    <div className="w-full bg-[#14151B] text-white border-b border-slate-800 px-4 py-3 rounded-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between overflow-auto no-scrollbar">
        {/* Market Info */}
        <div className="flex items-center min-w-0">
          <div className="relative flex items-center shrink-0">
            <Image
              src={baseImg}
              alt={`${base} icon`}
              width={24}
              height={24}
              className="rounded-full z-10"
            />
            <Image
              src={quoteImg}
              alt={`${quote} icon`}
              width={24}
              height={24}
              className="rounded-full -ml-2 border-2 border-white"
            />
          </div>
          <span className="ml-2 text-base font-medium whitespace-nowrap">
            {base} / {quote}
          </span>
        </div>

        {/* Last Price */}
        <div className="flex flex-col text-center sm:text-left">
          <span className="text-lg font-semibold text-green-400">
            ${ticker?.lastPrice ?? "--"}
          </span>
          <span className="text-sm text-[#969D9B]">Last Price</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-center sm:divide-x divide-slate-700 text-sm font-medium text-slate-300 gap-2 sm:gap-1">
          <div className="px-2 sm:px-4">
            <p className="text-xs text-[#969D9B]">24H Change</p>
            <p
              className={`${isPositive ? "text-[#00C278]" : "text-[#FD382B]"}`}
            >
              {isPositive ? "+" : ""}
              {ticker?.priceChange ?? "--"} ({priceChangePercent}%)
            </p>
          </div>
          <div className="px-2 sm:px-4">
            <p className="text-xs text-[#969D9B]">24H High</p>
            <p>{ticker?.high ?? "--"}</p>
          </div>
          <div className="px-2 sm:px-4">
            <p className="text-xs text-[#969D9B]">24H Low</p>
            <p>{ticker?.low ?? "--"}</p>
          </div>
          <div className="px-2 sm:px-4">
            <p className="text-xs text-[#969D9B]">24H Volume</p>
            <p>{ticker?.volume ?? "--"}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketBar;
