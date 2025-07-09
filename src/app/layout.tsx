import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Image from "next/image";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wordflect",
  description: "Wordflect - Word Search Game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="icon" type="image/x-icon" href="/favicon-wordflect.ico" />
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <footer className="w-full bg-black bg-opacity-70 text-white py-8 px-4 border-t border-gray-800">
          <div className="max-w-5xl mx-auto flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <Image src="/apple-touch-icon.png" alt="Wordflect Logo" width={32} height={32} className="rounded-lg" />
              <span className="font-bold text-lg text-white">Wordflect</span>
            </div>
            <div className="flex gap-6 text-gray-300 text-sm mt-2">
              <a href="/privacy" className="hover:text-blue-300 transition">Privacy Policy</a>
              <a href="/terms" className="hover:text-blue-300 transition">Terms</a>
              <a href="/support" className="hover:text-blue-300 transition">Support</a>
            </div>
            <div className="text-sm text-gray-400 text-center mt-2">
              © 2025 Montebay Innovations, LLC. Contact@montebay.io
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
