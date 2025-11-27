"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
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
  runTransaction,
  Timestamp,
  onSnapshot,
  orderBy,
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
  lockedQuantity?: number;
}

interface LimitOrder {
  id: string;
  userId: string;
  market: string;
  side: "buy" | "sell";
  price: number;
  amount: number;
  totalCost: number;
  status: "pending" | "executed" | "expired" | "cancelled";
  createdAt: Timestamp;
  expiresAt: Timestamp;
  executionPrice?: number;
  portfolioId?: string;
  baseCurrency: string;
  quoteCurrency: string;
}

const LIMIT_ORDER_TTL_MS = 60 * 60 * 1000;

const BuySell = ({ market }: { market: string }) => {
  const { currentUser, sendVerificationEmail, refreshUser } = useAuth();
  const router = useRouter();
  const [selectedView, setSelectedView] = useState<"buy" | "sell">("buy");
  const [order, setOrder] = useState<"limit" | "market">("limit");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [lockedBalance, setLockedBalance] = useState(0);
  const [currentMarketPrice, setCurrentMarketPrice] = useState<number | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [limitOrders, setLimitOrders] = useState<LimitOrder[]>([]);
  const processingOrders = useRef<Set<string>>(new Set());
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(false);

  const [base, quote] = market.split("_");
  const baseImg = `/${base.toLowerCase()}.webp`;
  const quoteImg = `/${quote.toLowerCase()}.webp`;
  const isEmailVerified = currentUser?.emailVerified ?? false;
  const getFirestoreClient = () => {
    if (!db) {
      alert("Firebase is not configured");
      return null;
    }
    return db;
  };


  const ensureVerifiedUser = useCallback(() => {
    if (!currentUser) {
      alert("Please login to place an order.");
      router.push("/auth");
      return false;
    }
    if (!currentUser.emailVerified) {
      alert("Please verify your email before trading or managing funds.");
      return false;
    }
    return true;
  }, [currentUser, router]);

  const handleResendVerification = async () => {
    if (!currentUser) return;
    try {
      setVerificationLoading(true);
      setVerificationMessage("");
      await sendVerificationEmail();
      setVerificationMessage("Verification email sent. Please check your inbox or spam folder.");
    } catch (error: any) {
      setVerificationMessage(error.message || "Failed to send verification email.");
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleRefreshVerificationStatus = async () => {
    try {
      setVerificationLoading(true);
      setVerificationMessage("");
      const updatedUser = await refreshUser();
      if (updatedUser?.emailVerified) {
        setVerificationMessage("Email verified! You now have full access.");
      } else {
        setVerificationMessage("Verification still pending. Please use the link sent to your email.");
      }
    } catch (error: any) {
      setVerificationMessage(error.message || "Failed to refresh verification status.");
    } finally {
      setVerificationLoading(false);
    }
  };

  const loadUserData = useCallback(async () => {
    if (!currentUser || !db) return;
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        setWalletBalance(userDoc.data().walletBalance || 0);
        setLockedBalance(userDoc.data().lockedBalance || 0);
      } else {
        setWalletBalance(0);
        setLockedBalance(0);
      }

      const portfolioQueryRef = query(
        collection(db, "portfolio"),
        where("userId", "==", currentUser.uid),
        where("currency", "==", base)
      );
      const portfolioSnapshot = await getDocs(portfolioQueryRef);
      const portfolioData: PortfolioItem[] = [];
      portfolioSnapshot.forEach((docSnap) => {
        portfolioData.push({ id: docSnap.id, ...docSnap.data() } as PortfolioItem);
      });
      setPortfolio(portfolioData);
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  }, [currentUser, base]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  useEffect(() => {
    if (!currentUser || !db) return;

    const limitOrdersQuery = query(
      collection(db, "limitOrders"),
      where("userId", "==", currentUser.uid),
      where("market", "==", market),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      limitOrdersQuery,
      (snapshot) => {
        const orders = snapshot.docs.map(
          (docSnap) =>
            ({
              id: docSnap.id,
              ...docSnap.data(),
            } as LimitOrder)
        );
        setLimitOrders(orders);
      },
      (error) => {
        console.error("Failed to subscribe to limit orders:", error);
      }
    );

    return () => unsubscribe();
  }, [currentUser, market]);

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
      ConnectionManager.getInstance().sendMessage({
        method: "UNSUBSCRIBE",
        params: [`ticker.${market}`],
      });
    };
  }, [market]);

  // Set market price when order type is market
  useEffect(() => {
    if (order === "market" && currentMarketPrice) {
      setPrice(currentMarketPrice.toString());
    }
  }, [order, currentMarketPrice]);

  const handleMarketBuy = async () => {
    if (!ensureVerifiedUser()) return;
    if (!currentUser) {
      alert("Please login to buy");
      router.push("/auth");
      return;
    }

    const firestore = getFirestoreClient();
    if (!firestore) return;

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

    try {
      // Check wallet balance
      const userDoc = await getDoc(doc(firestore, "users", currentUser.uid));
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
      await updateDoc(doc(firestore, "users", currentUser.uid), {
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

        await updateDoc(doc(firestore, "portfolio", existingCrypto.id), {
          quantity: totalQuantity,
          purchasePrice: averagePrice,
          currentPrice: buyPrice,
        });
      } else {
        // Add new portfolio item
        await addDoc(collection(firestore, "portfolio"), {
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
      const updatedUserDoc = await getDoc(doc(firestore, "users", currentUser.uid));
      if (updatedUserDoc.exists()) {
        setWalletBalance(updatedUserDoc.data().walletBalance || 0);
        setLockedBalance(updatedUserDoc.data().lockedBalance || 0);
      }

      const portfolioQuery = query(
        collection(firestore, "portfolio"),
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

  const handleMarketSell = async () => {
    if (!ensureVerifiedUser()) return;
    if (!currentUser) {
      alert("Please login to sell");
      router.push("/auth");
      return;
    }

    const firestore = getFirestoreClient();
    if (!firestore) return;

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

      // Update wallet balance
      const userDoc = await getDoc(doc(firestore, "users", currentUser.uid));
      if (!userDoc.exists()) {
        alert("Please create your profile first");
        router.push("/profile");
        return;
      }

      const currentBalance = userDoc.data().walletBalance || 0;
      const newBalance = currentBalance + totalValue;
      await updateDoc(doc(firestore, "users", currentUser.uid), {
        walletBalance: newBalance,
      });

      // Update portfolio
      const remainingQuantity = existingCrypto.quantity - sellAmount;
      if (remainingQuantity <= 0) {
        // Remove from portfolio if quantity becomes zero
        await deleteDoc(doc(firestore, "portfolio", existingCrypto.id));
      } else {
        // Update quantity
        await updateDoc(doc(firestore, "portfolio", existingCrypto.id), {
          quantity: remainingQuantity,
          currentPrice: sellPrice,
        });
      }

      alert(`Successfully sold ${sellAmount} ${base} for $${totalValue.toFixed(2)}`);
      setAmount("");
      setPrice(order === "limit" ? "" : currentMarketPrice?.toString() || "");

      // Reload data
      const updatedUserDoc = await getDoc(doc(firestore, "users", currentUser.uid));
      if (updatedUserDoc.exists()) {
        setWalletBalance(updatedUserDoc.data().walletBalance || 0);
        setLockedBalance(updatedUserDoc.data().lockedBalance || 0);
      }

      const portfolioQuery = query(
        collection(firestore, "portfolio"),
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

  const placeLimitBuy = async () => {
    if (!ensureVerifiedUser()) return;
    if (!currentUser) {
      alert("Please login to place a limit order");
      router.push("/auth");
      return;
    }

    const firestore = getFirestoreClient();
    if (!firestore) return;

    const limitPrice = parseFloat(price);
    const limitAmount = parseFloat(amount);

    if (isNaN(limitPrice) || limitPrice <= 0) {
      alert("Please enter a valid limit price");
      return;
    }

    if (isNaN(limitAmount) || limitAmount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    const totalCost = limitPrice * limitAmount;

    setLoading(true);
    try {
      await runTransaction(firestore, async (transaction) => {
        const userRef = doc(firestore, "users", currentUser.uid);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) {
          throw new Error("Please create your profile first");
        }

        const walletBalanceValue = userSnap.data().walletBalance || 0;
        const lockedBalanceValue = userSnap.data().lockedBalance || 0;

        if (walletBalanceValue < totalCost) {
          throw new Error("Insufficient available balance for this limit order");
        }

        transaction.update(userRef, {
          walletBalance: walletBalanceValue - totalCost,
          lockedBalance: lockedBalanceValue + totalCost,
        });

        const orderRef = doc(collection(firestore, "limitOrders"));
        const [orderBase, orderQuote] = market.split("_");
        transaction.set(orderRef, {
          userId: currentUser.uid,
          market,
          side: "buy",
          price: limitPrice,
          amount: limitAmount,
          totalCost,
          status: "pending",
          createdAt: Timestamp.now(),
          expiresAt: Timestamp.fromMillis(Date.now() + LIMIT_ORDER_TTL_MS),
          baseCurrency: orderBase,
          quoteCurrency: orderQuote,
        });
      });

      alert(`Limit buy order placed at $${limitPrice.toFixed(2)}`);
      setAmount("");
      setPrice("");
      await loadUserData();
    } catch (error: any) {
      console.error("Failed to place limit buy order:", error);
      alert(error.message || "Failed to place limit buy order");
    } finally {
      setLoading(false);
    }
  };

  const placeLimitSell = async () => {
    if (!ensureVerifiedUser()) return;
    if (!currentUser) {
      alert("Please login to place a limit order");
      router.push("/auth");
      return;
    }

    const firestore = getFirestoreClient();
    if (!firestore) return;

    const limitPrice = parseFloat(price);
    const limitAmount = parseFloat(amount);

    if (isNaN(limitPrice) || limitPrice <= 0) {
      alert("Please enter a valid limit price");
      return;
    }

    if (isNaN(limitAmount) || limitAmount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    const existingCrypto = portfolio.find((p) => p.currency === base);
    if (!existingCrypto || !existingCrypto.id) {
      alert(`You don't have any ${base} in your portfolio`);
      return;
    }

    const lockedQty = existingCrypto.lockedQuantity || 0;
    const availableQuantity = existingCrypto.quantity - lockedQty;
    if (availableQuantity < limitAmount) {
      alert(
        `Insufficient available ${base}. You have ${availableQuantity.toFixed(
          8
        )} ${base} after accounting for locked amounts.`
      );
      return;
    }

    setLoading(true);
    try {
      await runTransaction(firestore, async (transaction) => {
        const portfolioRef = doc(firestore, "portfolio", existingCrypto.id as string);
        const portfolioSnap = await transaction.get(portfolioRef);
        if (!portfolioSnap.exists()) {
          throw new Error("Portfolio item no longer exists");
        }

        const quantityValue = portfolioSnap.data().quantity || 0;
        const lockedQuantityValue = portfolioSnap.data().lockedQuantity || 0;
        if (quantityValue - lockedQuantityValue < limitAmount) {
          throw new Error("Insufficient available quantity for this limit order");
        }

        transaction.update(portfolioRef, {
          lockedQuantity: lockedQuantityValue + limitAmount,
        });

        const orderRef = doc(collection(firestore, "limitOrders"));
        const [orderBase, orderQuote] = market.split("_");
        transaction.set(orderRef, {
          userId: currentUser.uid,
          market,
          side: "sell",
          price: limitPrice,
          amount: limitAmount,
          totalCost: limitPrice * limitAmount,
          status: "pending",
          createdAt: Timestamp.now(),
          expiresAt: Timestamp.fromMillis(Date.now() + LIMIT_ORDER_TTL_MS),
          portfolioId: portfolioRef.id,
          baseCurrency: orderBase,
          quoteCurrency: orderQuote,
        });
      });

      alert(`Limit sell order placed at $${limitPrice.toFixed(2)}`);
      setAmount("");
      setPrice("");
      await loadUserData();
    } catch (error: any) {
      console.error("Failed to place limit sell order:", error);
      alert(error.message || "Failed to place limit sell order");
    } finally {
      setLoading(false);
    }
  };

  const adjustOrderFunds = useCallback(
    async (order: LimitOrder, nextStatus: "expired" | "cancelled") => {
      const firestore = db;
      if (!firestore) return false;

      let succeeded = false;
      try {
        await runTransaction(firestore, async (transaction) => {
          const orderRef = doc(firestore, "limitOrders", order.id);
          const orderSnap = await transaction.get(orderRef);
          if (!orderSnap.exists()) return;
          if (orderSnap.data().status !== "pending") return;

          const userRef = doc(firestore, "users", order.userId);
          const userSnap = await transaction.get(userRef);

          let portfolioRef: ReturnType<typeof doc> | null = null;
          let portfolioSnap: any = null;
          if (order.side === "sell" && order.portfolioId) {
            portfolioRef = doc(firestore, "portfolio", order.portfolioId);
            portfolioSnap = await transaction.get(portfolioRef);
          }

          transaction.update(orderRef, {
            status: nextStatus,
            closedAt: Timestamp.now(),
          });

          if (order.side === "buy" && userSnap.exists()) {
            const walletBalanceValue = userSnap.data().walletBalance || 0;
            const lockedBalanceValue = userSnap.data().lockedBalance || 0;
            transaction.update(userRef, {
              walletBalance: walletBalanceValue + order.totalCost,
              lockedBalance: Math.max(lockedBalanceValue - order.totalCost, 0),
            });
          } else if (portfolioRef && portfolioSnap?.exists()) {
            const lockedQuantityValue = portfolioSnap.data().lockedQuantity || 0;
            transaction.update(portfolioRef, {
              lockedQuantity: Math.max(lockedQuantityValue - order.amount, 0),
            });
          }
        });
        succeeded = true;
        await loadUserData();
      } catch (error) {
        console.error(`Failed to ${nextStatus} order`, error);
      }
      return succeeded;
    },
    [loadUserData]
  );

  const upsertPortfolioAfterBuy = useCallback(async (order: LimitOrder) => {
    const firestore = db;
    if (!firestore) return;
    try {
      const portfolioQueryRef = query(
        collection(firestore, "portfolio"),
        where("userId", "==", order.userId),
        where("currency", "==", order.baseCurrency)
      );
      const portfolioSnapshot = await getDocs(portfolioQueryRef);
      if (!portfolioSnapshot.empty) {
        const docSnap = portfolioSnapshot.docs[0];
        const existing = docSnap.data() as PortfolioItem;
        const currentQuantity = existing.quantity || 0;
        const totalQuantity = currentQuantity + order.amount;
        const totalCostExisting = currentQuantity * (existing.purchasePrice || order.price);
        const totalCostNew = order.amount * order.price;
        const averagePrice =
          totalQuantity > 0 ? (totalCostExisting + totalCostNew) / totalQuantity : order.price;

        await updateDoc(doc(firestore, "portfolio", docSnap.id), {
          quantity: totalQuantity,
          purchasePrice: averagePrice,
          currentPrice: order.price,
          lockedQuantity: existing.lockedQuantity || 0,
        });
      } else {
        await addDoc(collection(firestore, "portfolio"), {
          userId: order.userId,
          currency: order.baseCurrency,
          quantity: order.amount,
          purchasePrice: order.price,
          currentPrice: order.price,
          lockedQuantity: 0,
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error("Failed to update portfolio after limit buy:", error);
    }
  }, []);

  const executeLimitOrder = useCallback(
    async (order: LimitOrder) => {
      const firestore = db;
      if (!firestore) return;

      try {
        await runTransaction(firestore, async (transaction) => {
          const orderRef = doc(firestore, "limitOrders", order.id);
          const orderSnap = await transaction.get(orderRef);
          if (!orderSnap.exists()) return;
          if (orderSnap.data().status !== "pending") return;

          const userRef = doc(firestore, "users", order.userId);
          const userSnap = await transaction.get(userRef);
          if (!userSnap.exists()) return;

          const walletBalanceValue = userSnap.data().walletBalance || 0;
          const lockedBalanceValue = userSnap.data().lockedBalance || 0;

          if (order.side === "buy") {
            transaction.update(userRef, {
              lockedBalance: Math.max(lockedBalanceValue - order.totalCost, 0),
            });
          } else {
            transaction.update(userRef, {
              walletBalance: walletBalanceValue + order.totalCost,
            });

            if (order.portfolioId) {
              const portfolioRef = doc(firestore, "portfolio", order.portfolioId);
              const portfolioSnap = await transaction.get(portfolioRef);
              if (portfolioSnap.exists()) {
                const lockedQuantityValue = portfolioSnap.data().lockedQuantity || 0;
                const quantityValue = portfolioSnap.data().quantity || 0;
                const remainingQuantity = Math.max(quantityValue - order.amount, 0);
                transaction.update(portfolioRef, {
                  quantity: remainingQuantity,
                  lockedQuantity: Math.max(lockedQuantityValue - order.amount, 0),
                  currentPrice: order.price,
                });
              }
            }
          }

          transaction.update(orderRef, {
            status: "executed",
            executedAt: Timestamp.now(),
            executionPrice: order.price,
          });
        });

        if (order.side === "buy") {
          await upsertPortfolioAfterBuy(order);
        }
        await loadUserData();
      } catch (error) {
        console.error("Failed to execute limit order:", error);
      }
    },
    [loadUserData, upsertPortfolioAfterBuy]
  );

  const handleCancelOrder = async (orderId: string) => {
    const targetOrder = limitOrders.find((o) => o.id === orderId);
    if (!targetOrder) return;
    const success = await adjustOrderFunds(targetOrder, "cancelled");
    if (success) {
      alert("Limit order cancelled. Funds or holdings have been unlocked.");
    } else {
      alert("Unable to cancel order. Please try again.");
    }
  };

  const checkOrderLifecycle = useCallback(
    (forceExpiryOnly = false) => {
      if (!limitOrders.length) return;

      limitOrders.forEach((order) => {
        if (processingOrders.current.has(order.id)) {
          return;
        }

        const expiry = order.expiresAt?.toMillis
          ? order.expiresAt.toMillis()
          : new Date(order.expiresAt as unknown as string).getTime();
        const now = Date.now();

        if (now >= expiry) {
          processingOrders.current.add(order.id);
          adjustOrderFunds(order, "expired").finally(() => {
            processingOrders.current.delete(order.id);
          });
          return;
        }

        if (forceExpiryOnly || currentMarketPrice === null) return;

        const shouldExecute =
          order.side === "buy"
            ? currentMarketPrice <= order.price
            : currentMarketPrice >= order.price;
        if (shouldExecute) {
          processingOrders.current.add(order.id);
          executeLimitOrder(order).finally(() => {
            processingOrders.current.delete(order.id);
          });
        }
      });
    },
    [adjustOrderFunds, currentMarketPrice, executeLimitOrder, limitOrders]
  );

  useEffect(() => {
    checkOrderLifecycle();
  }, [checkOrderLifecycle]);

  useEffect(() => {
    const timer = setInterval(() => {
      checkOrderLifecycle(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [checkOrderLifecycle]);

  const handleSubmit = () => {
    if (!ensureVerifiedUser()) return;
    if (order === "market") {
      return selectedView === "buy" ? handleMarketBuy() : handleMarketSell();
    }
    return selectedView === "buy" ? placeLimitBuy() : placeLimitSell();
  };

  const totalCost = parseFloat(price) * parseFloat(amount) || 0;
  const basePortfolio = portfolio.find((p) => p.currency === base);
  const lockedQuantity = basePortfolio?.lockedQuantity || 0;
  const availableQuantity = Math.max((basePortfolio?.quantity || 0) - lockedQuantity, 0);

  return (
    <div className="flex flex-col bg-[#14151B] px-4 py-3 gap-4 rounded-lg text-sm">
      {currentUser && !isEmailVerified && (
        <div className="bg-[#382429] border border-[#DD3129]/40 text-sm text-[#F5A524] p-3 rounded">
          <p className="font-semibold mb-2">Verify your email to start trading or manage wallet funds.</p>
          <div className="flex flex-wrap gap-3 text-xs">
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={verificationLoading}
              className="px-3 py-1 rounded bg-[#DD3129] text-white hover:bg-[#b72822] disabled:opacity-50"
            >
              {verificationLoading ? "Sending..." : "Resend verification email"}
            </button>
            <button
              type="button"
              onClick={handleRefreshVerificationStatus}
              disabled={verificationLoading}
              className="px-3 py-1 rounded border border-[#F5A524] text-[#F5A524] hover:bg-[#F5A524]/10 disabled:opacity-50"
            >
              I have verified
            </button>
          </div>
          {verificationMessage && (
            <p className="mt-2 text-xs text-white">{verificationMessage}</p>
          )}
        </div>
      )}

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
            <>
              <p className="text-[#8991A1]">
                Available Balance: <span className="text-white">${walletBalance.toFixed(2)}</span>
              </p>
              <p className="text-[#717885]">
                Locked: <span className="text-white">${lockedBalance.toFixed(2)}</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-[#8991A1]">
                Available: <span className="text-white">{availableQuantity.toFixed(8)} {base}</span>
              </p>
              <p className="text-[#717885]">
                Locked: <span className="text-white">{lockedQuantity.toFixed(8)} {base}</span>
              </p>
            </>
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
          onClick={handleSubmit}
          disabled={loading || !currentUser || !price || !amount || !isEmailVerified}
          className={`mt-2 py-2 rounded text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            selectedView === "buy"
              ? "bg-[#00C26A] hover:bg-[#00a95c]"
              : "bg-[#DD3129] hover:bg-[#b72822]"
          }`}
        >
          {loading ? "Processing..." : selectedView === "buy" ? "Buy" : "Sell"}
        </button>
      </div>

      {currentUser && limitOrders.length > 0 && (
        <div className="bg-[#1A1B23] p-3 rounded-md text-xs space-y-2">
          <div className="flex justify-between text-[#8991A1] font-semibold">
            <span>Pending Limit Orders</span>
            <span>{limitOrders.length}</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
            {limitOrders.map((order) => {
              const expiresAtDate = order.expiresAt?.toMillis
                ? new Date(order.expiresAt.toMillis())
                : new Date(order.expiresAt as unknown as string);
              return (
                <div
                  key={order.id}
                  className="flex items-center justify-between bg-[#14151B] px-3 py-2 rounded"
                >
                  <div>
                    <p
                      className={`text-[11px] font-semibold ${
                        order.side === "buy" ? "text-[#00C26A]" : "text-[#DD3129]"
                      }`}
                    >
                      {order.side.toUpperCase()}
                    </p>
                    <p className="text-white">
                      {order.amount.toFixed(4)} {order.baseCurrency}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white">${order.price.toFixed(4)}</p>
                    <p className="text-[#717885]">
                      Expires {expiresAtDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCancelOrder(order.id)}
                    className="text-[#F5A524] text-[11px] hover:underline ml-3"
                  >
                    Cancel
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default BuySell;
