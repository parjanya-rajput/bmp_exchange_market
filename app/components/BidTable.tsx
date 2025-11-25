export const BidTable = ({ bids }: { bids: [string, string][] }) => {
  let total = 0;
  const relevant = bids.slice(0, 9);
  const bidsWithTotal = relevant.map(([p, q]) => {
    total += Number(q);
    return [p, q, total] as [string, string, number];
  });
  const maxTotal = total;

  return (
    <div className="space-y-[2px]">
      {bidsWithTotal.map(([price, quantity, total]) => (
        <Bid
          key={price}
          price={price}
          quantity={quantity}
          total={total}
          maxTotal={maxTotal}
        />
      ))}
    </div>
  );
};

function Bid({
  price,
  quantity,
  total,
  maxTotal,
}: {
  price: string;
  quantity: string;
  total: number;
  maxTotal: number;
}) {
  return (
    <div className="relative flex justify-between text-xs h-[24px] px-1">
      <div
        className="absolute top-0 right-0 h-full z-0 transition-all duration-300"
        style={{
          width: `${(100 * total) / maxTotal}%`,
          backgroundColor: "rgba(1, 167, 129, 0.3)",
        }}
      />
      <div className="flex justify-between w-full z-10">
        <div className="text-green-400">{price}</div>
        <div>{quantity}</div>
        <div>{total.toFixed(2)}</div>
      </div>
    </div>
  );
}
