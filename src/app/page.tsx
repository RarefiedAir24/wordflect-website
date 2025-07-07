"use client";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { apiService } from "@/services/api";
import dynamic from "next/dynamic";
const PrivacyPolicy = dynamic(() => import("./privacy-policy"), { ssr: false });

// Sparkle type for TypeScript
interface Sparkle {
  cx: number;
  cy: number;
  r: number;
  duration: number;
  delay: number;
}

interface User {
  username?: string;
  // Add other fields as needed
}

export default function Home() {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showPrivacyBar, setShowPrivacyBar] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  useEffect(() => {
    // Only run on client
    const newSparkles: Sparkle[] = Array.from({ length: 18 }).map(() => ({
      cx: Math.random() * 100, // percent
      cy: Math.random() * 100, // percent
      r: Math.random() * 60 + 20, // px
      duration: Math.random() * 6 + 6, // 6-12s
      delay: Math.random() * 6, // 0-6s
    }));
    setSparkles(newSparkles);

    // Check authentication status
    const checkAuth = () => {
      const authenticated = apiService.isAuthenticated();
      setIsAuthenticated(authenticated);
      if (authenticated) {
        setUser(apiService.getStoredUser());
      }
    };

    checkAuth();

    // Show privacy bar if not accepted
    if (typeof window !== 'undefined' && !localStorage.getItem('privacyAccepted')) {
      setShowPrivacyBar(true);
    }
  }, []);

  const handleAcceptPrivacy = () => {
    localStorage.setItem('privacyAccepted', 'true');
    setShowPrivacyBar(false);
    setShowPrivacyModal(false);
  };

  const handleShowPolicy = () => {
    setShowPrivacyModal(true);
  };

  const handleClosePolicy = () => {
    setShowPrivacyModal(false);
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-gradient-to-br from-purple-900 via-blue-900 to-black overflow-hidden">
      {/* Privacy Policy Bottom Bar */}
      {showPrivacyBar && (
        <div className="fixed bottom-0 left-0 w-full z-50 flex justify-center animate-fade-in">
          <div className="m-4 px-6 py-4 rounded-2xl shadow-xl bg-gray-900 bg-opacity-95 text-white flex flex-col sm:flex-row items-center gap-4 max-w-2xl w-full">
            <span className="flex-1 text-center sm:text-left text-base">
              We use cookies and collect data to improve your experience.{' '}
              <button
                onClick={handleShowPolicy}
                className="underline text-blue-300 hover:text-blue-400 font-semibold focus:outline-none"
              >
                Read our Privacy Policy
              </button>.
            </span>
            <button
              onClick={handleAcceptPrivacy}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold shadow hover:scale-105 transition-all duration-150 text-base"
            >
              Accept
            </button>
          </div>
        </div>
      )}
      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl mx-auto p-0">
            <div className="bg-gray-900 rounded-2xl shadow-2xl overflow-y-auto max-h-[80vh] animate-fade-in text-white">
              <button
                onClick={handleClosePolicy}
                className="absolute top-3 right-3 text-gray-400 hover:text-red-400 text-2xl font-bold focus:outline-none"
                aria-label="Close Privacy Policy"
              >
                &times;
              </button>
              <PrivacyPolicy />
              <div className="flex justify-center pb-6">
                <button
                  onClick={handleAcceptPrivacy}
                  className="mt-4 px-8 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold shadow hover:scale-105 transition-all duration-150 text-lg"
                >
                  I Accept
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animated background sparkles (client only) */}
      <div className="absolute inset-0 z-0 pointer-events-none animate-bg-move">
        <svg width="100%" height="100%" className="w-full h-full opacity-30">
          <defs>
            <radialGradient id="sparkle" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>
          {sparkles.map((s, i) => (
            <circle
              key={i}
              cx={s.cx + "%"}
              cy={s.cy + "%"}
              r={s.r}
              fill="url(#sparkle)"
              style={{
                animation: `sparkleMove ${s.duration}s ease-in-out ${s.delay}s infinite alternate`,
              }}
              className="sparkle-anim"
            />
          ))}
        </svg>
      </div>

      {/* Navigation Bar */}
      <nav className="relative z-10 flex justify-between items-center p-6 bg-black bg-opacity-20 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Image src="/favicon-wordflect.ico" alt="Wordflect Logo" width={40} height={40} className="rounded-lg" />
          <span className="text-2xl font-bold text-white tracking-wide hidden sm:inline">Wordflect</span>
        </div>
        <div className="flex gap-8 text-white font-medium text-lg">
          <a href="#" className="hover:text-blue-300 transition">News</a>
          <a href="/faq" className="hover:text-blue-300 transition">FAQ</a>
          <a href="/tips" className="hover:text-blue-300 transition">Tips</a>
        </div>
        <div className="flex gap-4 items-center">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <span className="text-white text-sm hidden sm:block">
                Welcome, {user?.username || "User"}!
              </span>
              <a href="/profile">
                <button className="px-5 py-2 rounded-full bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold shadow hover:scale-105 transition-all duration-150">
                  My Profile
                </button>
              </a>
            </div>
          ) : (
            <a href="/signin">
              <button className="px-5 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold shadow hover:scale-105 transition-all duration-150">
                Sign In
              </button>
            </a>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4">
        <div className="bg-black p-2 rounded-lg mb-6 drop-shadow-2xl animate-bounce-slow inline-block">
          <Image
            src="/favicon-wordflect.ico"
            alt="Wordflect App Icon"
            width={120}
            height={120}
            priority
          />
        </div>
        <h1 className="text-5xl sm:text-7xl font-extrabold text-white tracking-widest mb-2 animate-text-glow text-center">
          WORDFLECT
        </h1>
        <div className="flex flex-col items-center mb-8">
          <span className="text-2xl sm:text-3xl font-bold text-white mb-1 animate-fade-in text-center">Reflect. Connect. Win.</span>
          <span className="text-base sm:text-lg text-blue-100 font-light animate-fade-in text-center max-w-xl">A word creation game providing stress relief, enhancing cognitive skills, and fostering social connections.</span>
        </div>
        <a
          id="download"
          href="#"
          className="flex items-center gap-3 px-7 py-3 rounded-2xl bg-gradient-to-r from-gray-900 via-black to-gray-800 text-white font-semibold text-lg shadow-lg border border-gray-600 hover:shadow-xl hover:scale-105 transition-all duration-200 animate-fade-in"
          style={{ minWidth: 260 }}
        >
          <Image src="/apple-logo.svg" alt="Apple logo" width={28} height={28} className="invert" />
          <span className="flex flex-col items-start leading-tight">
            <span className="text-base font-bold text-white">Download on the Apple Store</span>
          </span>
        </a>
      </main>
    </div>
  );
}

// Tailwind custom animations (add to globals.css):
// .animate-bg-move { animation: bgMove 20s linear infinite alternate; }
// .animate-bounce-slow { animation: bounce 2.5s infinite; }
// .animate-text-glow { text-shadow: 0 0 16px #a78bfa, 0 0 32px #60a5fa; animation: glow 2s ease-in-out infinite alternate; }
// .animate-fade-in { animation: fadeIn 1.5s ease; }
// @keyframes bgMove { 0% { background-position: 0 0; } 100% { background-position: 100% 100%; } }
// @keyframes glow { 0% { text-shadow: 0 0 16px #a78bfa, 0 0 32px #60a5fa; } 100% { text-shadow: 0 0 32px #a78bfa, 0 0 64px #60a5fa; } }
// @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
// @keyframes sparkleMove {
//   0% { transform: translateY(0) scale(1); opacity: 1; }
//   100% { transform: translateY(-40px) scale(1.2); opacity: 0.7; }
// }
// .sparkle-anim { will-change: transform, opacity; }
