"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import MarketBar from "@/app/components/MarketBar";
import OrderBook from "@/app/components/OrderBook";
import Trades from "@/app/components/Trades";
import { TradeView } from "@/app/components/TradeView";
import BuySell from "@/app/components/BuySell";

export default function Page() {
  const { market } = useParams() as { market: string };
  const [selectedView, setSelectedView] = useState<"orderbook" | "trades">(
    "orderbook"
  );

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      {/* Left side: Chart + Orderbook/Trades */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* MarketBar */}
        <div className="w-full p-2">
          <MarketBar market={market} />
        </div>

        {/* Main content: TradeView + Orderbook/Trades */}
        <div className="flex flex-col lg:flex-row flex-1 border-y border-slate-800 overflow-hidden">
          {/* Chart area */}
          <div className="flex flex-col flex-1 min-w-0 p-1">
            <TradeView market={market} />
          </div>

          {/* Orderbook/Trades */}
          <div className="flex w-full lg:w-[30%] overflow-auto p-2 custom-scrollbar">
            <div className="bg-[#14151B] w-full border-l border-slate-800 p-2 rounded-md">
              {/* Tabs */}
              <div className="flex mb-2 space-x-2 mt-2">
                <button
                  onClick={() => setSelectedView("orderbook")}
                  className={`text-sm px-2 py-1 rounded ${
                    selectedView === "orderbook"
                      ? "bg-slate-700 text-white"
                      : "bg-slate-900 text-slate-400"
                  }`}
                >
                  Order Book
                </button>
                <button
                  onClick={() => setSelectedView("trades")}
                  className={`text-sm px-2 py-1 rounded ${
                    selectedView === "trades"
                      ? "bg-slate-700 text-white"
                      : "bg-slate-900 text-slate-400"
                  }`}
                >
                  Trades
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto max-h-[400px]">
                {selectedView === "orderbook" ? (
                  <OrderBook market={market} />
                ) : (
                  <Trades market={market} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Divider (Desktop only) */}
      <div className="hidden lg:block w-[10px] border-l border-slate-800"></div>

      {/* BuySell Panel */}
      <div className="w-full lg:w-[20%] p-2">
        <BuySell market={market} />
      </div>
    </div>
  );
}
