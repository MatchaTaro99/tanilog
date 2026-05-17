import type { Metadata, Viewport } from "next";
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
  title: "TaniLog - Logbook Harian & Kalkulator Finansial Petani",
  description: "Aplikasi catatan harian perawatan tanaman dan kalkulator finansial BEP modular offline-ready untuk petani.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TaniLog",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#064e3b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-900 selection:bg-emerald-200 selection:text-emerald-900">
        {children}
      </body>
    </html>
  );
}
