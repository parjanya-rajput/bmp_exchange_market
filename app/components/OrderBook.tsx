import { useEffect, useState } from "react";
import { ConnectionManager } from "../utils/ConnectionManager";
import { BidTable } from "./BidTable";
import { AskTable } from "./AskTable";

function TableHeader() {
  return (
    <div className="flex justify-between text-xs px-1 mb-1">
      <div className="text-white">Price</div>
      <div className="text-slate-500">Size</div>
      <div className="text-slate-500">Total</div>
    </div>
  );
}

function PriceMarker({ price }: { price: string | null }) {
  return (
    <div className="text-center py-1 text-sm font-semibold text-yellow-400 border-y border-gray-700 my-1">
      {price ? `Last Price: ${price}` : "Loading..."}
    </div>
  );
}

const OrderBook = ({ market }: { market: string }) => {
  const [bids, setBids] = useState<[string, string][]>([]);
  const [asks, setAsks] = useState<[string, string][]>([]);
  const [price, setPrice] = useState<string | null>(null);

  useEffect(() => {
    const cm = ConnectionManager.getInstance();

    cm.registerCallback(
      "depth",
      (data: any) => {
        setBids((prev) => {
          const map = new Map(prev ?? []);
          for (const [p, q] of data.bids) map.set(p, q);
          return Array.from(map.entries()).sort(
            (a, b) => parseFloat(b[0]) - parseFloat(a[0])
          );
        });

        setAsks((prev) => {
          const map = new Map(prev ?? []);
          for (const [p, q] of data.asks) map.set(p, q);
          return Array.from(map.entries()).sort(
            (a, b) => parseFloat(a[0]) - parseFloat(b[0])
          );
        });
      },
      `DEPTH-${market}`
    );

    cm.registerCallback(
      "ticker",
      (data: any) => {
        if (data?.lastPrice) setPrice(data.lastPrice);
      },
      `TICKER-${market}`
    );
    cm.sendMessage({
      method: "SUBSCRIBE",
      params: [`depth.${market}`],
    });

    cm.sendMessage({
      method: "SUBSCRIBE",
      params: [`ticker.${market}`],
    });

    return () => {
      cm.sendMessage({
        method: "UNSUBSCRIBE",
        params: [`depth.${market}`],
      });
      cm.sendMessage({
        method: "UNSUBSCRIBE",
        params: [`ticker.${market}`],
      });
      cm.deRegisterCallback("depth", `DEPTH-${market}`);
      cm.deRegisterCallback("ticker", `TICKER-${market}`);
    };
  }, [market]);

  return (
    <div className="px-2  pt-2 space-y-1 ">
      <TableHeader />
      {asks && <AskTable asks={asks} />}
      <PriceMarker price={price} />
      {bids && <BidTable bids={bids} />}
    </div>
  );
};

export default OrderBook;
