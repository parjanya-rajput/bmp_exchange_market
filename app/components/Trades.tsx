import { useEffect, useState } from "react";
import { ConnectionManager } from "../utils/ConnectionManager";
import { Trade } from "../utils/types";

const Trades = ({ market }: { market: string }) => {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    const conn = ConnectionManager.getInstance();

    const handleTrade = (data: Partial<Trade>) => {
      if (
        data.id !== undefined &&
        data.price &&
        data.quantity &&
        data.timestamp !== undefined &&
        typeof data.isBuyerMaker === "boolean"
      ) {
        const newTrade: Trade = {
          id: data.id,
          isBuyerMaker: data.isBuyerMaker,
          price: data.price,
          quantity: data.quantity,
          timestamp: data.timestamp,
        };

        // Keep only the latest 15 trades
        setTrades((prev) => [newTrade, ...prev.slice(0, 14)]);
      }
    };

    conn.registerCallback("trade", handleTrade, `TRADE-${market}`);

    conn.sendMessage({
      method: "SUBSCRIBE",
      params: [`trade.${market}`],
    });

    return () => {
      conn.sendMessage({
        method: "UNSUBSCRIBE",
        params: [`trade.${market}`],
      });
      conn.deRegisterCallback("trade", `TRADE-${market}`);
    };
  }, [market]);

  return (
    <div className="text-white text-xs h-full overflow-hidden">
      <div className="flex justify-between px-2 mb-1 font-semibold text-slate-400">
        <span>Price</span>
        <span>Quantity</span>
        <span>Time</span>
      </div>
      {/* No scroll and only show max 15 trades */}
      <div className="space-y-[2px] max-h-[80vh]   pr-1">
        {trades.map((trade) => {
          const time = new Date(trade.timestamp).toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });

          return (
            <div
              key={trade.id}
              className={`flex justify-between px-2 py-[2px] rounded ${
                trade.isBuyerMaker
                  ? "bg-red-900/20 text-red-400"
                  : "bg-green-900/20 text-green-400"
              }`}
            >
              <span>{parseFloat(trade.price).toFixed(2)}</span>
              <span>{parseFloat(trade.quantity).toFixed(2)}</span>
              <span className="text-slate-400">{time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Trades;
