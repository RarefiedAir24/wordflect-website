import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <footer className="w-full bg-black bg-opacity-70 text-white py-8 px-4 border-t border-gray-800">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 mb-2 md:mb-0">
              <img src="/apple-touch-icon.png" alt="Wordflect Logo" width={32} height={32} className="rounded-lg" />
              <span className="font-bold text-lg tracking-wide">Wordflect</span>
            </div>
            <div className="flex gap-6 text-base font-medium">
              <a href="/privacy-policy" className="hover:text-blue-300 transition">Privacy Policy</a>
              <a href="/terms" className="hover:text-blue-300 transition">Terms</a>
              <a href="/support" className="hover:text-blue-300 transition">Support</a>
            </div>
            <div className="text-sm text-gray-400 text-center w-full mt-4">
              © {new Date().getFullYear()} Wordflect Team. support@wordflect.com
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
