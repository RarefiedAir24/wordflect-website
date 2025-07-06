"use client";

import React, { useState } from "react";
import Link from "next/link";

const sections = [
  {
    title: "Game Basics",
    content: (
      <div>
        <p className="mb-2">Welcome to Wordflect! 🥳 Form words from adjacent tiles to score points and keep the stack from reaching the top.</p>
        <ul className="list-disc list-inside mb-2">
          <li><b>Tap or drag</b> to select a path of 3 or more adjacent tiles (horizontally, vertically, or diagonally).</li>
          <li><b>Submit valid words</b> found in the dictionary.</li>
          <li><b>New rows</b> are added at intervals and after every word you find, pushing the stack upward.</li>
          <li><b>Game Over:</b> The game ends if the stack reaches the top.</li>
        </ul>
        <p className="text-green-300 font-semibold">Pro Tip:</p>
        <p className="mb-0">Longer words score more points and buy you more time. Only adjacent tiles can be chained—plan your moves! 💡</p>
      </div>
    ),
  },
  {
    title: "Missions",
    content: (
      <div>
        <p>Complete <b className="text-yellow-300">Daily</b>, <b className="text-blue-300">Weekly</b>, and <b className="text-red-400">Global</b> missions for extra rewards! 🎯</p>
        <ul className="list-disc list-inside">
          <li><b>Daily Missions:</b> Change every day. Complete for quick rewards.</li>
          <li><b>Weekly Missions:</b> Bigger challenges, bigger rewards.</li>
          <li><b>Global Missions:</b> Long-term goals for dedicated players.</li>
        </ul>
      </div>
    ),
  },
  {
    title: "Battle Arena",
    content: (
      <div>
        <p>Challenge friends or accept invitations from other players. Both players play the same board; the highest score wins! ⚔️</p>
        <ul className="list-disc list-inside">
          <li>Go to the <b>Battle Arena</b> and tap the + to invite a player by username.</li>
          <li>Accept or decline invitations from others.</li>
          <li>Play your round, wait for your opponent, and see results after both have played.</li>
        </ul>
        <p>Track your <b className="text-green-300">battle wins/losses</b> and climb the leaderboard! 🏆</p>
      </div>
    ),
  },
  {
    title: "Profile & Stats",
    content: (
      <div>
        <p>Track your journey and show off your achievements! 🏅</p>
        <p><b>Word Titles:</b> Earn unique titles as you find more words and hit milestones. Your current title (like <i>Syllable Searcher</i> or <i>Lexicon Legend</i>) is displayed under your username and on the leaderboard. Titles are a badge of honor for your word skills! 🏆</p>
        <p><b>Belt Level:</b> Your colored belt badge shows your current level and progress. Level up to unlock new belts and show off your experience! Belts change color as you advance (white, yellow, green, blue, purple, brown, black). Your level number is shown inside the badge. 🥋</p>
        <p className="font-semibold">Stats Explained:</p>
        <ul className="list-disc list-inside mb-2">
          <li><b>Games Played:</b> Total games you&apos;ve started.</li>
          <li><b>Top Score:</b> Your highest single-game score.</li>
          <li><b>Words Found:</b> Total unique words discovered.</li>
          <li><b>Longest Word:</b> The longest word you&apos;ve found.</li>
          <li><b>Podium Finishes:</b> 🥇🥈🥉 1st, 2nd, and 3rd place finishes in monthly leaderboards.</li>
          <li><b>Battle Stats:</b> Track your battle wins and losses.</li>
        </ul>
        <p>Earn badges for achievements and display them on your profile! 🏅</p>
      </div>
    ),
  },
  {
    title: "Frames & Customization",
    content: (
      <div>
        <p>Unlock and select unique frames to decorate your avatar. 🖼️</p>
        <ul className="list-disc list-inside">
          <li><b>Level up</b> your account, complete special missions, or purchase frames in the Store.</li>
          <li>Go to your <b>Profile</b> and tap <b>'Manage Frames'</b> to view and select available frames.</li>
        </ul>
        <p>Show off your style and achievements with every game! ✨</p>
      </div>
    ),
  },
  {
    title: "Store",
    content: (
      <div>
        <p>Buy gems to unlock frames, themes, and more. Customize the app's appearance with different color schemes. 🛒</p>
        <ul className="list-disc list-inside">
          <li>Go to the <b>Store</b> from the main menu.</li>
          <li>Select a gem pack or theme and complete your purchase using your app store account.</li>
        </ul>
        <p>Upgrade your experience and stand out from the crowd! 💎</p>
      </div>
    ),
  },
  {
    title: "Notifications & Settings",
    content: (
      <div>
        <p>Stay updated on new missions, battle invitations and results, rewards, and achievements. 🔔</p>
        <ul className="list-disc list-inside">
          <li><b>Toggle sound and music</b> on/off.</li>
          <li><b>Manage your account</b> and privacy settings in the Settings screen.</li>
        </ul>
        <p>Personalize your experience and stay in the loop!</p>
      </div>
    ),
  },
  {
    title: "FAQ",
    content: (
      <div>
        <div className="space-y-2">
          <div>
            <p className="font-semibold text-blue-900">Q: How do I get more gems?</p>
            <p className="text-blue-900">A: Complete missions, win battles, or purchase in the Store.</p>
          </div>
          <div>
            <p className="font-semibold text-blue-900">Q: How do I change my avatar?</p>
            <p className="text-blue-900">A: Tap your avatar on the Profile screen to upload a new photo.</p>
          </div>
          <div>
            <p className="font-semibold text-blue-900">Q: What happens if I run out of moves?</p>
            <p className="text-blue-900">A: The game ends when the stack reaches the top—try to plan ahead!</p>
          </div>
        </div>
      </div>
    ),
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="mb-6 flex justify-start">
        <Link href="/">
          <button className="bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold px-5 py-2 rounded-lg shadow hover:scale-105 transition-all duration-150">
            Home
          </button>
        </Link>
      </div>
      <h1 className="text-3xl font-extrabold mb-6 text-center text-white">How to Play & App Guide</h1>
      <div className="space-y-4">
        {sections.map((section, idx) => (
          <div key={section.title} className="bg-blue-100 rounded-lg">
            <button
              className="w-full text-left px-4 py-3 font-bold text-blue-900 flex justify-between items-center focus:outline-none"
              onClick={() => setOpen(open === idx ? null : idx)}
            >
              <span>{section.title}</span>
              <span className={`transform transition-transform ${open === idx ? "rotate-180" : "rotate-0"}`}>▼</span>
            </button>
            {open === idx && (
              <div className="px-6 pb-4 pt-1 text-blue-900 bg-white rounded-b-lg border-t border-blue-200 animate-fade-in">
                {section.content}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 