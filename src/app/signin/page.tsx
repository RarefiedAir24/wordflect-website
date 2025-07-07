"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { apiService } from "@/services/api";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await apiService.signIn({ email, password });
      router.push("/profile");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-blue-950 to-purple-950 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-black/80 rounded-2xl shadow-2xl p-8 flex flex-col gap-6 animate-fade-in"
        style={{ boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)" }}
        aria-label="Sign in form"
      >
        <div className="flex flex-col items-center mb-2">
          <Image
            src="/apple-touch-icon.png"
            alt="Wordflect Logo"
            width={64}
            height={64}
            className="mb-2 rounded-lg shadow-lg"
            priority
          />
          <h1 className="text-3xl font-extrabold text-white mb-1 tracking-wide">Sign In</h1>
          <span className="text-blue-200 text-base font-light">Welcome back! Sign in to your Wordflect account.</span>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="block font-bold text-blue-200 mb-1">Email</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" d="M3 7.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7.5m-18 0A2 2 0 0 1 5 5.5h14a2 2 0 0 1 2 2m-18 0 10 7 10-7"/></svg>
            </span>
            <input
              id="email"
              type="email"
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-blue-400 bg-white text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition placeholder-blue-400"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={isLoading}
              placeholder="you@email.com"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="block font-bold text-blue-200 mb-1">Password</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm6-2c0 3.314-2.686 6-6 6s-6-2.686-6-6 2.686-6 6-6 6 2.686 6 6Z"/></svg>
            </span>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="w-full pl-10 pr-12 py-2 rounded-lg border border-blue-400 bg-white text-blue-900 focus:outline-none focus:ring-2 focus:ring-purple-500 transition placeholder-blue-400"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={isLoading}
              placeholder="Your password"
            />
            <button
              type="button"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-200 focus:outline-none"
              onClick={() => setShowPassword(v => !v)}
            >
              {showPassword ? (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" d="M3 3l18 18M10.7 10.7A3 3 0 0 0 12 15a3 3 0 0 0 2.12-.88M9.88 9.88A3 3 0 0 1 15 12c0 .83-.34 1.58-.88 2.12M12 5c-7 0-9 7-9 7s2 7 9 7 9-7 9-7-2-7-9-7Z"/></svg>
              ) : (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" d="M12 5c-7 0-9 7-9 7s2 7 9 7 9-7 9-7-2-7-9-7Zm0 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/></svg>
              )}
            </button>
          </div>
          <div className="flex justify-end mt-1">
            <button
              type="button"
              className="text-blue-300 text-sm hover:underline focus:outline-none"
              tabIndex={-1}
              disabled
            >
              Forgot password?
            </button>
          </div>
        </div>
        {error && (
          <div className="bg-red-600/90 text-white font-semibold rounded-lg px-4 py-2 text-center animate-shake shadow-md border border-red-400">
            {error}
          </div>
        )}
        <button
          type="submit"
          className={`w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold shadow-lg text-lg tracking-wide transition-all duration-150 ${
            isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
          }`}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
              Signing In...
            </span>
          ) : (
            "Sign In"
          )}
        </button>
      </form>
    </div>
  );
} 