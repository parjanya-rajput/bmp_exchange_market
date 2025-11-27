"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    getDocs,
    query,
    where,
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

interface UserProfile {
    name: string;
    panNumber: string;
    contact: string;
    walletBalance: number;
}

export default function ProfilePage() {
    const { currentUser, logout, sendVerificationEmail, refreshUser } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<UserProfile>({
        name: "",
        panNumber: "",
        contact: "",
        walletBalance: 0,
    });
    const [profileExists, setProfileExists] = useState(false);
    const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
    const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});
    const [addMoneyAmount, setAddMoneyAmount] = useState("");
    const [verificationMessage, setVerificationMessage] = useState("");
    const [verificationLoading, setVerificationLoading] = useState(false);
    const isEmailVerified = currentUser?.emailVerified ?? false;

    useEffect(() => {
        if (!currentUser) {
            router.push("/auth");
            return;
        }
        loadUserData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser]);

    const loadUserData = async () => {
        if (!currentUser) return;

        // Check if we're on client side and Firebase is initialized
        if (typeof window === "undefined") return;

        // Ensure Firebase is ready
        if (!db) {
            console.error("Firebase Firestore is not initialized. Please check your environment variables.");
            alert("Firebase is not configured. Please set up your environment variables and restart the server.");
            return;
        }

        try {
            setLoading(true);
            const userDoc = await getDoc(doc(db, "users", currentUser.uid));

            if (userDoc.exists()) {
                const data = userDoc.data();
                setProfile({
                    name: data.name || "",
                    panNumber: data.panNumber || "",
                    contact: data.contact || "",
                    walletBalance: data.walletBalance || 0,
                });
                setProfileExists(true);

                // Load portfolio only if profile exists
                const portfolioQuery = query(
                    collection(db, "portfolio"),
                    where("userId", "==", currentUser.uid)
                );
                const portfolioSnapshot = await getDocs(portfolioQuery);
                const portfolioData: PortfolioItem[] = [];
                portfolioSnapshot.forEach((doc) => {
                    portfolioData.push({ id: doc.id, ...doc.data() } as PortfolioItem);
                });
                setPortfolio(portfolioData);
            } else {
                // Profile doesn't exist - reset everything
                setProfile({
                    name: "",
                    panNumber: "",
                    contact: "",
                    walletBalance: 0,
                });
                setProfileExists(false);
                setPortfolio([]);
                setCurrentPrices({});
            }
        } catch (error: any) {
            console.error("Error loading user data:", error);
            if (error.code === "failed-precondition" || error.code === "unavailable" || error.message?.includes("offline")) {
                alert("Please check your internet connection and try again.");
            } else {
                alert("Error loading profile. Please refresh the page.");
            }
        } finally {
            setLoading(false);
        }
    };

    // Subscribe to price updates for currencies in portfolio
    useEffect(() => {
        if (!profileExists || portfolio.length === 0) return;

        const subscriptions: string[] = [];

        portfolio.forEach((item) => {
            const currency: string = item.currency || "";
            if (currency) {
                const market = `${currency}_USDC`;
                const currencyKey = currency; // Capture for closure

                // Register callback with unique ID
                const callbackId = `TICKER-PORTFOLIO-${market}`;
                subscriptions.push(callbackId);

                ConnectionManager.getInstance().registerCallback(
                    "ticker",
                    (data: Partial<Ticker>) => {
                        // Only update if the symbol matches this specific market
                        if (data?.lastPrice && data?.symbol === market) {
                            const price = parseFloat(data.lastPrice);
                            if (!isNaN(price)) {
                                setCurrentPrices((prev) => ({
                                    ...prev,
                                    [currencyKey]: price,
                                }));
                            }
                        }
                    },
                    callbackId
                );

                ConnectionManager.getInstance().sendMessage({
                    method: "SUBSCRIBE",
                    params: [`ticker.${market}`],
                });
            }
        });

        // Cleanup function to unsubscribe
        return () => {
            subscriptions.forEach((callbackId) => {
                const market = callbackId.replace("TICKER-PORTFOLIO-", "");
                ConnectionManager.getInstance().deRegisterCallback("ticker", callbackId);
                ConnectionManager.getInstance().sendMessage({
                    method: "UNSUBSCRIBE",
                    params: [`ticker.${market}`],
                });
            });
        };
    }, [portfolio, profileExists]);

    // Update portfolio with current prices when prices change
    useEffect(() => {
        if (Object.keys(currentPrices).length > 0) {
            setPortfolio((prevPortfolio) =>
                prevPortfolio.map((item) => ({
                    ...item,
                    currentPrice: currentPrices[item.currency] || item.currentPrice,
                }))
            );
        }
    }, [currentPrices]);

    const handleCreateProfile = async () => {
        if (!currentUser) {
            alert("User not authenticated");
            return;
        }

        if (!profile.name.trim() || !profile.panNumber.trim() || !profile.contact.trim()) {
            alert("Please fill in all fields");
            return;
        }

        // Check if Firebase is initialized
        if (typeof window === "undefined") {
            alert("Please wait for the page to load completely.");
            return;
        }

        if (!db) {
            alert("Firebase not initialized. Please refresh the page.");
            console.error("Firestore db is not available");
            return;
        }

        try {
            setSaving(true);
            console.log("Creating profile for user:", currentUser.uid);
            console.log("Profile data:", {
                name: profile.name,
                panNumber: profile.panNumber,
                contact: profile.contact,
                walletBalance: 0,
            });

            await setDoc(doc(db, "users", currentUser.uid), {
                name: profile.name,
                panNumber: profile.panNumber,
                contact: profile.contact,
                walletBalance: 0,
                createdAt: new Date(),
            });

            console.log("Profile created successfully in Firestore");
            alert("Profile created successfully!");
            await loadUserData();
        } catch (error: any) {
            console.error("Error creating profile:", error);
            console.error("Error code:", error.code);
            console.error("Error message:", error.message);
            alert(`Error creating profile: ${error.message || error.code || "Unknown error"}`);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!currentUser) return;

        if (!db) {
            alert("Firebase is not configured. Please set up your environment variables.");
            return;
        }

        try {
            setSaving(true);
            await updateDoc(doc(db, "users", currentUser.uid), {
                name: profile.name,
                panNumber: profile.panNumber,
                contact: profile.contact,
            });
            alert("Profile saved successfully!");
        } catch (error) {
            console.error("Error saving profile:", error);
            alert("Error saving profile");
        } finally {
            setSaving(false);
        }
    };

    const handleAddMoney = async () => {
        if (!currentUser) return;
        if (!isEmailVerified) {
            alert("Please verify your email before adding funds to your wallet.");
            return;
        }

        if (!db) {
            alert("Firebase is not configured. Please set up your environment variables.");
            return;
        }

        const amount = parseFloat(addMoneyAmount);
        if (isNaN(amount) || amount <= 0) {
            alert("Please enter a valid amount");
            return;
        }

        try {
            setSaving(true);
            const newBalance = profile.walletBalance + amount;
            await updateDoc(doc(db, "users", currentUser.uid), {
                walletBalance: newBalance,
            });
            setAddMoneyAmount("");
            alert(`Added $${amount} to wallet`);
            // Reload user data to get updated balance
            await loadUserData();
        } catch (error) {
            console.error("Error adding money:", error);
            alert("Error adding money");
        } finally {
            setSaving(false);
        }
    };

    const handleResendVerification = async () => {
        if (!currentUser) return;
        try {
            setVerificationLoading(true);
            setVerificationMessage("");
            await sendVerificationEmail();
            setVerificationMessage("Verification email sent. Please check your inbox.");
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
            const updated = await refreshUser();
            if (updated?.emailVerified) {
                setVerificationMessage("Email verified! You now have access to wallet and trading.");
            } else {
                setVerificationMessage("Verification still pending. Click resend to get a new link.");
            }
        } catch (error: any) {
            setVerificationMessage(error.message || "Failed to refresh verification status.");
        } finally {
            setVerificationLoading(false);
        }
    };

    const VerificationBanner = () =>
        currentUser && !isEmailVerified ? (
            <div className="bg-[#382429] border border-[#DD3129]/40 text-[#F5A524] p-4 rounded mb-6 text-sm">
                <p className="font-semibold mb-2">Verify your email to unlock trading and wallet features.</p>
                <div className="flex flex-wrap gap-3 text-xs">
                    <button
                        onClick={handleResendVerification}
                        disabled={verificationLoading}
                        className="px-3 py-1 rounded bg-[#DD3129] text-white hover:bg-[#b72822] disabled:opacity-50"
                    >
                        {verificationLoading ? "Processing..." : "Resend verification email"}
                    </button>
                    <button
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
        ) : null;

    const handleLogout = async () => {
        try {
            await logout();
            router.push("/auth");
        } catch (error) {
            console.error("Error logging out:", error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                <div className="h-8 w-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    // Show create profile form if profile doesn't exist
    if (!profileExists) {
        return (
            <div className="min-h-screen bg-gray-950 text-white p-6">
                <div className="max-w-2xl mx-auto">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold">Create Your Profile</h1>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-[#382429] text-[#DD3129] rounded hover:bg-[#4a2f35] transition-all"
                        >
                            Sign Out
                        </button>
                    </div>

                    <VerificationBanner />

                    {/* Create Profile Form */}
                    <div className="bg-[#14151B] rounded-lg border border-slate-800 p-8">
                        <p className="text-[#8991A1] mb-6">
                            Welcome! Please create your profile to get started.
                        </p>
                        <div className="space-y-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-[#8991A1] text-sm">Name *</label>
                                <input
                                    type="text"
                                    value={profile.name}
                                    onChange={(e) =>
                                        setProfile({ ...profile, name: e.target.value })
                                    }
                                    required
                                    className="bg-[#1A1B23] text-white w-full px-3 py-2 rounded outline-none focus:ring-2 focus:ring-[#00C26A]"
                                    placeholder="Enter your name"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[#8991A1] text-sm">PAN Number *</label>
                                <input
                                    type="text"
                                    value={profile.panNumber}
                                    onChange={(e) =>
                                        setProfile({ ...profile, panNumber: e.target.value.toUpperCase() })
                                    }
                                    required
                                    maxLength={10}
                                    className="bg-[#1A1B23] text-white w-full px-3 py-2 rounded outline-none focus:ring-2 focus:ring-[#00C26A]"
                                    placeholder="Enter PAN number"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[#8991A1] text-sm">Contact Details *</label>
                                <input
                                    type="text"
                                    value={profile.contact}
                                    onChange={(e) =>
                                        setProfile({ ...profile, contact: e.target.value })
                                    }
                                    required
                                    className="bg-[#1A1B23] text-white w-full px-3 py-2 rounded outline-none focus:ring-2 focus:ring-[#00C26A]"
                                    placeholder="Enter contact details (email, phone, etc.)"
                                />
                            </div>

                            <button
                                onClick={handleCreateProfile}
                                disabled={saving || !profile.name.trim() || !profile.panNumber.trim() || !profile.contact.trim()}
                                className="w-full mt-6 py-3 rounded text-white font-medium transition-all bg-[#00C26A] hover:bg-[#00a95c] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? "Creating Profile..." : "Create Profile"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold">Profile</h1>
                    <div className="flex gap-4">
                        <button
                            onClick={() => router.push("/")}
                            className="px-4 py-2 bg-[#1A1B23] text-white rounded hover:bg-[#202127] transition-all"
                        >
                            Home
                        </button>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-[#382429] text-[#DD3129] rounded hover:bg-[#4a2f35] transition-all"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>

                <VerificationBanner />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Profile Information */}
                    <div className="bg-[#14151B] rounded-lg border border-slate-800 p-6">
                        <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
                        <div className="space-y-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-[#8991A1] text-sm">Name</label>
                                <input
                                    type="text"
                                    value={profile.name}
                                    onChange={(e) =>
                                        setProfile({ ...profile, name: e.target.value })
                                    }
                                    className="bg-[#1A1B23] text-white w-full px-3 py-2 rounded outline-none focus:ring-2 focus:ring-[#00C26A]"
                                    placeholder="Enter your name"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[#8991A1] text-sm">PAN Number</label>
                                <input
                                    type="text"
                                    value={profile.panNumber}
                                    onChange={(e) =>
                                        setProfile({ ...profile, panNumber: e.target.value.toUpperCase() })
                                    }
                                    maxLength={10}
                                    className="bg-[#1A1B23] text-white w-full px-3 py-2 rounded outline-none focus:ring-2 focus:ring-[#00C26A]"
                                    placeholder="Enter PAN number"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[#8991A1] text-sm">Contact Details</label>
                                <input
                                    type="text"
                                    value={profile.contact}
                                    onChange={(e) =>
                                        setProfile({ ...profile, contact: e.target.value })
                                    }
                                    className="bg-[#1A1B23] text-white w-full px-3 py-2 rounded outline-none focus:ring-2 focus:ring-[#00C26A]"
                                    placeholder="Enter contact details"
                                />
                            </div>

                            <button
                                onClick={handleSaveProfile}
                                disabled={saving}
                                className="w-full mt-4 py-2 rounded text-white font-medium transition-all bg-[#00C26A] hover:bg-[#00a95c] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? "Saving..." : "Save Profile"}
                            </button>
                        </div>
                    </div>

                    {/* Wallet Balance */}
                    <div className="bg-[#14151B] rounded-lg border border-slate-800 p-6">
                        <h2 className="text-xl font-semibold mb-4">Wallet Balance</h2>
                        <div className="space-y-4">
                            <div className="bg-[#1A1B23] p-4 rounded">
                                <p className="text-[#8991A1] text-sm mb-2">Current Balance</p>
                                <p className="text-3xl font-bold text-[#00C26A]">
                                    ${profile.walletBalance.toFixed(2)}
                                </p>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[#8991A1] text-sm">Add Money</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        value={addMoneyAmount}
                                        onChange={(e) => setAddMoneyAmount(e.target.value)}
                                        className="bg-[#1A1B23] text-white w-full px-3 py-2 rounded outline-none focus:ring-2 focus:ring-[#00C26A]"
                                        placeholder="Enter amount"
                                        min="0"
                                        step="0.01"
                                    />
                                    <button
                                        onClick={handleAddMoney}
                                        disabled={saving || !isEmailVerified}
                                        className="px-4 py-2 bg-[#00C26A] text-white rounded hover:bg-[#00a95c] transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                    >
                                        Add
                                    </button>
                                </div>
                                {!isEmailVerified && (
                                    <p className="text-xs text-[#F5A524] mt-2">
                                        Verify your email to add funds to your wallet.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Portfolio */}
                <div className="mt-6 bg-[#14151B] rounded-lg border border-slate-800 p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Portfolio</h2>
                    </div>


                    {portfolio.length === 0 ? (
                        <p className="text-[#8991A1] text-center py-8">
                            No crypto holdings yet. Add your first crypto to get started!
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-800">
                                        <th className="text-left py-3 px-4 text-[#8991A1] text-sm font-medium">
                                            Currency
                                        </th>
                                        <th className="text-left py-3 px-4 text-[#8991A1] text-sm font-medium">
                                            Quantity
                                        </th>
                                        <th className="text-left py-3 px-4 text-[#8991A1] text-sm font-medium">
                                            Purchase Price
                                        </th>
                                        <th className="text-left py-3 px-4 text-[#8991A1] text-sm font-medium">
                                            Current Price
                                        </th>
                                        <th className="text-left py-3 px-4 text-[#8991A1] text-sm font-medium">
                                            Total Value
                                        </th>
                                        <th className="text-left py-3 px-4 text-[#8991A1] text-sm font-medium">
                                            P&L
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {portfolio.map((item) => {
                                        // Use current price from state if available, otherwise use stored price
                                        const currentPrice = currentPrices[item.currency] || item.currentPrice;
                                        const totalValue = item.quantity * currentPrice;
                                        const totalCost = item.quantity * item.purchasePrice;
                                        const pnl = totalValue - totalCost;
                                        const pnlPercent = totalCost > 0 ? ((pnl / totalCost) * 100).toFixed(2) : "0.00";

                                        return (
                                            <tr
                                                key={item.id}
                                                className="border-b border-slate-800 hover:bg-[#1A1B23] transition-colors"
                                            >
                                                <td className="py-3 px-4 font-medium">{item.currency}</td>
                                                <td className="py-3 px-4">{item.quantity.toFixed(8)}</td>
                                                <td className="py-3 px-4">${item.purchasePrice.toFixed(2)}</td>
                                                <td className="py-3 px-4">
                                                    {currentPrices[item.currency] !== undefined
                                                        ? `$${currentPrice.toFixed(2)}`
                                                        : `$${item.currentPrice.toFixed(2)}`}
                                                </td>
                                                <td className="py-3 px-4">${totalValue.toFixed(2)}</td>
                                                <td
                                                    className={`py-3 px-4 ${pnl >= 0 ? "text-[#00C278]" : "text-[#FD382B]"
                                                        }`}
                                                >
                                                    {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} ({pnlPercent}%)
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

