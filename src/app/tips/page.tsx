"use client";
import React, { useState } from "react";
import Link from "next/link";

const tipsSections = [
  {
    title: "Tips",
    content: (
      <ul className="list-disc list-inside text-lg text-blue-900 space-y-2">
        <li>Look for longer words for higher scores and more time.</li>
        <li>Complete missions for extra rewards.</li>
        <li>Challenge friends in the Battle Arena for more fun and competition.</li>
      </ul>
    ),
  },
];

export default function Tips() {
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
      <h1 className="text-3xl font-extrabold mb-6 text-center text-white">Tips</h1>
      <div className="space-y-4">
        {tipsSections.map((section, idx) => (
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