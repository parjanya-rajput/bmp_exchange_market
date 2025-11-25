"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { Ticker } from "../utils/types";
import { ConnectionManager } from "../utils/ConnectionManager";

interface PortfolioItem {
  id?: string;
  currency: string;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
}

const BuySell = ({ market }: { market: string }) => {
  const { currentUser } = useAuth();
  const router = useRouter();
  const [selectedView, setSelectedView] = useState<"buy" | "sell">("buy");
  const [order, setOrder] = useState<"limit" | "market">("limit");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [currentMarketPrice, setCurrentMarketPrice] = useState<number | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);

  const [base, quote] = market.split("_");
  const baseImg = `/${base.toLowerCase()}.webp`;
  const quoteImg = `/${quote.toLowerCase()}.webp`;

  // Load user data
  useEffect(() => {
    if (!currentUser || !db) return;

    const loadUserData = async () => {
      if (!db) return;
      try {
        // Load wallet balance
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          setWalletBalance(userDoc.data().walletBalance || 0);
        }

        // Load portfolio
        const portfolioQuery = query(
          collection(db, "portfolio"),
          where("userId", "==", currentUser.uid),
          where("currency", "==", base)
        );
        const portfolioSnapshot = await getDocs(portfolioQuery);
        const portfolioData: PortfolioItem[] = [];
        portfolioSnapshot.forEach((doc) => {
          portfolioData.push({ id: doc.id, ...doc.data() } as PortfolioItem);
        });
        setPortfolio(portfolioData);
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    };

    loadUserData();
  }, [currentUser, base]);

  // Get current market price
  useEffect(() => {
    ConnectionManager.getInstance().registerCallback(
      "ticker",
      (data: Partial<Ticker>) => {
        if (data?.lastPrice) {
          setCurrentMarketPrice(parseFloat(data.lastPrice));
        }
      },
      `TICKER-BUYSELL-${market}`
    );

    ConnectionManager.getInstance().sendMessage({
      method: "SUBSCRIBE",
      params: [`ticker.${market}`],
    });

    return () => {
      ConnectionManager.getInstance().deRegisterCallback(
        "ticker",
        `TICKER-BUYSELL-${market}`
      );
    };
  }, [market]);

  // Set market price when order type is market
  useEffect(() => {
    if (order === "market" && currentMarketPrice) {
      setPrice(currentMarketPrice.toString());
    }
  }, [order, currentMarketPrice]);

  const handleBuy = async () => {
    if (!currentUser) {
      alert("Please login to buy");
      router.push("/auth");
      return;
    }

    if (!db) {
      alert("Firebase is not configured");
      return;
    }

    const buyPrice = parseFloat(price);
    const buyAmount = parseFloat(amount);

    if (isNaN(buyPrice) || buyPrice <= 0) {
      alert("Please enter a valid price");
      return;
    }

    if (isNaN(buyAmount) || buyAmount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    const totalCost = buyPrice * buyAmount;

    if (!db) {
      alert("Firebase is not configured");
      return;
    }

    try {
      // Check wallet balance
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (!userDoc.exists()) {
        alert("Please create your profile first");
        router.push("/profile");
        return;
      }

      const currentBalance = userDoc.data().walletBalance || 0;
      if (currentBalance < totalCost) {
        alert(`Insufficient balance. You need $${totalCost.toFixed(2)} but have $${currentBalance.toFixed(2)}`);
        return;
      }

      setLoading(true);

      // Update wallet balance
      const newBalance = currentBalance - totalCost;
      await updateDoc(doc(db, "users", currentUser.uid), {
        walletBalance: newBalance,
      });

      // Update or add to portfolio
      const existingCrypto = portfolio.find((p) => p.currency === base);
      if (existingCrypto && existingCrypto.id) {
        // Update existing portfolio item
        const totalQuantity = existingCrypto.quantity + buyAmount;
        const totalCostOld = existingCrypto.quantity * existingCrypto.purchasePrice;
        const totalCostNew = buyAmount * buyPrice;
        const averagePrice = (totalCostOld + totalCostNew) / totalQuantity;

        await updateDoc(doc(db, "portfolio", existingCrypto.id), {
          quantity: totalQuantity,
          purchasePrice: averagePrice,
          currentPrice: buyPrice,
        });
      } else {
        // Add new portfolio item
        await addDoc(collection(db, "portfolio"), {
          userId: currentUser.uid,
          currency: base,
          quantity: buyAmount,
          purchasePrice: buyPrice,
          currentPrice: buyPrice,
          createdAt: new Date(),
        });
      }

      alert(`Successfully bought ${buyAmount} ${base} for $${totalCost.toFixed(2)}`);
      setAmount("");
      setPrice(order === "limit" ? "" : currentMarketPrice?.toString() || "");
      
      // Reload data
      const updatedUserDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (updatedUserDoc.exists()) {
        setWalletBalance(updatedUserDoc.data().walletBalance || 0);
      }

      const portfolioQuery = query(
        collection(db, "portfolio"),
        where("userId", "==", currentUser.uid),
        where("currency", "==", base)
      );
      const portfolioSnapshot = await getDocs(portfolioQuery);
      const portfolioData: PortfolioItem[] = [];
      portfolioSnapshot.forEach((doc) => {
        portfolioData.push({ id: doc.id, ...doc.data() } as PortfolioItem);
      });
      setPortfolio(portfolioData);
    } catch (error: any) {
      console.error("Error buying:", error);
      alert(`Error: ${error.message || "Failed to complete purchase"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSell = async () => {
    if (!currentUser) {
      alert("Please login to sell");
      router.push("/auth");
      return;
    }

    if (!db) {
      alert("Firebase is not configured");
      return;
    }

    const sellPrice = parseFloat(price);
    const sellAmount = parseFloat(amount);

    if (isNaN(sellPrice) || sellPrice <= 0) {
      alert("Please enter a valid price");
      return;
    }

    if (isNaN(sellAmount) || sellAmount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    try {
      // Check portfolio
      const existingCrypto = portfolio.find((p) => p.currency === base);
      if (!existingCrypto || !existingCrypto.id) {
        alert(`You don't have any ${base} in your portfolio`);
        return;
      }

      if (existingCrypto.quantity < sellAmount) {
        alert(`Insufficient quantity. You have ${existingCrypto.quantity} ${base} but trying to sell ${sellAmount}`);
        return;
      }

      setLoading(true);

      const totalValue = sellPrice * sellAmount;

      if (!db) {
        alert("Firebase is not configured");
        return;
      }

      // Update wallet balance
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (!userDoc.exists()) {
        alert("Please create your profile first");
        router.push("/profile");
        return;
      }

      const currentBalance = userDoc.data().walletBalance || 0;
      const newBalance = currentBalance + totalValue;
      await updateDoc(doc(db, "users", currentUser.uid), {
        walletBalance: newBalance,
      });

      // Update portfolio
      const remainingQuantity = existingCrypto.quantity - sellAmount;
      if (remainingQuantity <= 0) {
        // Remove from portfolio if quantity becomes zero
        await deleteDoc(doc(db, "portfolio", existingCrypto.id));
      } else {
        // Update quantity
        await updateDoc(doc(db, "portfolio", existingCrypto.id), {
          quantity: remainingQuantity,
          currentPrice: sellPrice,
        });
      }

      alert(`Successfully sold ${sellAmount} ${base} for $${totalValue.toFixed(2)}`);
      setAmount("");
      setPrice(order === "limit" ? "" : currentMarketPrice?.toString() || "");

      // Reload data
      const updatedUserDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (updatedUserDoc.exists()) {
        setWalletBalance(updatedUserDoc.data().walletBalance || 0);
      }

      const portfolioQuery = query(
        collection(db, "portfolio"),
        where("userId", "==", currentUser.uid),
        where("currency", "==", base)
      );
      const portfolioSnapshot = await getDocs(portfolioQuery);
      const portfolioData: PortfolioItem[] = [];
      portfolioSnapshot.forEach((doc) => {
        portfolioData.push({ id: doc.id, ...doc.data() } as PortfolioItem);
      });
      setPortfolio(portfolioData);
    } catch (error: any) {
      console.error("Error selling:", error);
      alert(`Error: ${error.message || "Failed to complete sale"}`);
    } finally {
      setLoading(false);
    }
  };

  const totalCost = parseFloat(price) * parseFloat(amount) || 0;
  const availableQuantity = portfolio.find((p) => p.currency === base)?.quantity || 0;

  return (
    <div className="flex flex-col bg-[#14151B] px-4 py-3 gap-4 rounded-lg text-sm">
      {/* Buy / Sell Toggle */}
      <div className="flex justify-center items-center mt-2">
        <button
          onClick={() => setSelectedView("buy")}
          className={`text-md px-10 py-2 rounded-l ${
            selectedView === "buy"
              ? "bg-[#1D2D2D] text-[#00C26A]"
              : "bg-[#202127] text-[#717885]"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setSelectedView("sell")}
          className={`text-md px-10 py-2 rounded-r ${
            selectedView === "sell"
              ? "bg-[#382429] text-[#DD3129]"
              : "bg-[#202127] text-[#717885]"
          }`}
        >
          Sell
        </button>
      </div>

      {/* Limit / Market Toggle */}
      <div className="flex space-x-4">
        <button
          onClick={() => {
            setOrder("limit");
            setPrice("");
          }}
          className={`px-3 py-1 rounded ${
            order === "limit" ? "bg-[#1F2026] text-[#DADADC]" : "text-[#8991A1]"
          }`}
        >
          Limit
        </button>
        <button
          onClick={() => {
            setOrder("market");
            if (currentMarketPrice) setPrice(currentMarketPrice.toString());
          }}
          className={`px-3 py-1 rounded ${
            order === "market"
              ? "bg-[#1F2026] text-[#DADADC]"
              : "text-[#8991A1]"
          }`}
        >
          Market
        </button>
      </div>

      {/* Wallet Balance / Available Quantity */}
      {currentUser && (
        <div className="bg-[#1A1B23] p-2 rounded text-xs">
          {selectedView === "buy" ? (
            <p className="text-[#8991A1]">
              Available Balance: <span className="text-white">${walletBalance.toFixed(2)}</span>
            </p>
          ) : (
            <p className="text-[#8991A1]">
              Available: <span className="text-white">{availableQuantity.toFixed(8)} {base}</span>
            </p>
          )}
        </div>
      )}

      {/* Input Fields */}
      <div className="flex flex-col gap-3">
        {order === "limit" && (
          <div className="flex flex-col gap-1">
            <label className="text-[#8991A1]">Price</label>
            <div className="relative w-full">
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Enter price"
                className="bg-[#1A1B23] text-white w-full px-3 py-2 pr-10 rounded outline-none focus:ring-2 focus:ring-[#00C26A]"
                step="0.01"
                min="0"
              />
              <Image
                src={quoteImg}
                alt={`${quote} icon`}
                width={20}
                height={20}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full pointer-events-none"
              />
            </div>
          </div>
        )}

        {order === "market" && currentMarketPrice && (
          <div className="flex flex-col gap-1">
            <label className="text-[#8991A1]">Market Price</label>
            <div className="bg-[#1A1B23] text-white w-full px-3 py-2 rounded">
              ${currentMarketPrice.toFixed(2)} {quote}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-[#8991A1]">Amount</label>
          <div className="relative w-full">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="bg-[#1A1B23] text-white w-full px-3 py-2 pr-10 rounded outline-none focus:ring-2 focus:ring-[#00C26A]"
              step="0.00000001"
              min="0"
            />
            <Image
              src={baseImg}
              alt={`${base} icon`}
              width={20}
              height={20}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full pointer-events-none"
            />
          </div>
        </div>

        {price && amount && (
          <div className="bg-[#1A1B23] p-2 rounded text-xs">
            <p className="text-[#8991A1]">
              Total: <span className="text-white">${totalCost.toFixed(2)}</span>
            </p>
          </div>
        )}

        {!currentUser && (
          <p className="text-xs text-[#8991A1] text-center">
            Please <button onClick={() => router.push("/auth")} className="text-[#00C26A] underline">login</button> to trade
          </p>
        )}

        <button
          onClick={selectedView === "buy" ? handleBuy : handleSell}
          disabled={loading || !currentUser || !price || !amount}
          className={`mt-2 py-2 rounded text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            selectedView === "buy"
              ? "bg-[#00C26A] hover:bg-[#00a95c]"
              : "bg-[#DD3129] hover:bg-[#b72822]"
          }`}
        >
          {loading ? "Processing..." : selectedView === "buy" ? "Buy" : "Sell"}
        </button>
      </div>
    </div>
  );
};

export default BuySell;
