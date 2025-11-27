"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, signup, currentUser, sendPasswordReset } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (currentUser) {
      router.push("/");
    }
  }, [currentUser, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        router.push("/");
      } else {
        await signup(email, password);
        setInfoMessage("Verification email sent. Please verify before trading.");
        router.push("/profile");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Enter your email to reset password");
      return;
    }
    try {
      setError("");
      setInfoMessage("");
      setResetLoading(true);
      await sendPasswordReset(email);
      setInfoMessage("Password reset email sent. Please check your inbox.");
    } catch (err: any) {
      setError(err.message || "Failed to send reset email");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#14151B] rounded-lg border border-slate-800 p-8">
        <h1 className="text-3xl font-bold mb-6 text-center">
          {isLogin ? "Login" : "Create Account"}
        </h1>

        {/* Toggle between Login and Signup */}
        <div className="flex justify-center items-center mb-6">
          <button
            onClick={() => {
              setIsLogin(true);
              setError("");
            }}
            className={`text-md px-10 py-2 rounded-l ${
              isLogin
                ? "bg-[#1D2D2D] text-[#00C26A]"
                : "bg-[#202127] text-[#717885]"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => {
              setIsLogin(false);
              setError("");
            }}
            className={`text-md px-10 py-2 rounded-r ${
              !isLogin
                ? "bg-[#1D2D2D] text-[#00C26A]"
                : "bg-[#202127] text-[#717885]"
            }`}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[#382429] text-[#DD3129] rounded text-sm">
            {error}
          </div>
        )}
        {infoMessage && (
          <div className="mb-4 p-3 bg-[#1D2D2D] text-[#00C26A] rounded text-sm">
            {infoMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-[#8991A1] text-sm">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-[#1A1B23] text-white w-full px-3 py-2 rounded outline-none focus:ring-2 focus:ring-[#00C26A]"
              placeholder="Enter your email"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[#8991A1] text-sm">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="bg-[#1A1B23] text-white w-full px-3 py-2 rounded outline-none focus:ring-2 focus:ring-[#00C26A]"
              placeholder="Enter your password"
            />
          </div>
          {isLogin && (
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetLoading || loading}
              className="text-xs text-[#00C26A] hover:text-[#00a95c] transition self-end"
            >
              {resetLoading ? "Sending reset link..." : "Forgot password?"}
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-2 rounded text-white font-medium transition-all bg-[#00C26A] hover:bg-[#00a95c] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Processing..." : isLogin ? "Login" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}

