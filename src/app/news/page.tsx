"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";

const newsPosts = [
  {
    title: "Wordflect Launches on the App Store!",
    date: "July 2025",
    summary: "We're excited to announce that Wordflect is now available on the Apple App Store. Download now and start reflecting, connecting, and winning!",
    link: "#",
  },
  {
    title: "Beta Program Open for TestFlight Users",
    date: "June 2025",
    summary: "Join our TestFlight beta to get early access to new features and help shape the future of Wordflect.",
    link: "#",
  },
  {
    title: "Major Update: Multiplayer Battles Released",
    date: "May 2025",
    summary: "Challenge friends and players worldwide in real-time multiplayer battles. Update now to try the new mode!",
    link: "#",
  },
];

export default function News() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black">
      {/* Navigation Bar */}
      <nav className="relative z-10 flex justify-between items-center p-6 bg-black bg-opacity-20 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Image src="/apple-touch-icon.png" alt="Wordflect Logo" width={40} height={40} className="rounded-lg" />
          </Link>
          <span className="text-2xl font-bold text-white tracking-wide hidden sm:inline">Wordflect</span>
        </div>
        <div className="flex gap-8 text-white font-medium text-lg">
          <Link href="/news" className="hover:text-blue-300 transition">News</Link>
          <Link href="/faq" className="hover:text-blue-300 transition">FAQ</Link>
          <Link href="/tips" className="hover:text-blue-300 transition">Tips</Link>
          <Link href="/support" className="hover:text-blue-300 transition">Support</Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto py-16 px-4">
        <div className="text-center mb-12">
          <h1 className="text-5xl sm:text-6xl font-extrabold text-white mb-4 animate-text-glow">News</h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto">Stay up to date with the latest Wordflect announcements, updates, and community news.</p>
        </div>
        <div className="space-y-8">
          {newsPosts.map((post, idx) => (
            <div key={idx} className="bg-black/40 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/10 hover:border-blue-400 transition group">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                <h2 className="text-2xl font-bold text-white group-hover:text-blue-300 transition">{post.title}</h2>
                <span className="text-blue-200 text-sm mt-2 sm:mt-0">{post.date}</span>
              </div>
              <p className="text-blue-100 mb-4">{post.summary}</p>
              {post.link !== "#" && (
                <Link href={post.link} className="inline-block px-6 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold shadow hover:scale-105 transition-all duration-150 text-base">
                  Read More
                </Link>
              )}
            </div>
          ))}
        </div>
        {/* Back to Home */}
        <div className="text-center mt-12">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 text-white font-bold rounded-lg hover:scale-105 transition-all duration-150 border border-gray-600"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeWidth="2" d="m15 18-6-6 6-6"/>
            </svg>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
} 