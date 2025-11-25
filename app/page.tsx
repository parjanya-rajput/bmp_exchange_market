"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useState } from "react";
import { useAuth } from "./contexts/AuthContext";

const markets = [
  { name: "SOL/USDC", market: "SOL_USDC", image: "sol.webp" },
  { name: "BTC/USDC", market: "BTC_USDC", image: "btc.webp" },
  { name: "ETH/USDC", market: "ETH_USDC", image: "eth.webp" },
  { name: "SUI/USDC", market: "SUI_USDC", image: "sui.webp" },
  { name: "BOME/USDC", market: "BOME_USDC", image: "bome.webp" },
  { name: "HAEDAL/USDC", market: "HAEDAL_USDC", image: "haedal.webp" },
];

export default function Home() {
  const router = useRouter();
  const { currentUser, logout } = useAuth();
  const [loadingMarket, setLoadingMarket] = useState<string | null>(null);

  const handleClick = (market: string) => {
    setLoadingMarket(market);
    router.push(`/trade/${market}`);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/auth");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Select a Market</h1>
        <div className="flex gap-4">
          {currentUser ? (
            <>
              <button
                onClick={() => router.push("/profile")}
                className="px-4 py-2 bg-[#1A1B23] text-white rounded hover:bg-[#202127] transition-all"
              >
                Profile
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-[#382429] text-[#DD3129] rounded hover:bg-[#4a2f35] transition-all"
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push("/auth")}
              className="px-4 py-2 bg-[#00C26A] text-white rounded hover:bg-[#00a95c] transition-all"
            >
              Login
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {markets.map(({ name, market, image }) => {
          const isLoading = loadingMarket === market;
          return (
            <div
              key={market}
              onClick={() => handleClick(market)}
              className={`cursor-pointer bg-gray-900 hover:bg-gray-800 transition-all p-4 rounded-xl shadow-lg flex items-center space-x-4 relative ${isLoading ? "opacity-50 pointer-events-none" : ""
                }`}
            >
              {isLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900 bg-opacity-80 rounded-xl">
                  <div className="h-6 w-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}

              <Image
                src={`/${image}`}
                alt={name}
                width={50}
                height={50}
                className="rounded-full"
              />
              <span className="text-xl font-semibold">{name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
