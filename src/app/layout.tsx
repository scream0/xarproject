import type { ReactNode } from "react";
import "./globals.css";
import nextDynamic from "next/dynamic";
import { StoreProvider } from "@/context/StoreContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { Toaster } from "react-hot-toast";
import { Tenor_Sans, Lato } from "next/font/google";
import styles from "./not-found.module.css";
import Script from "next/script";

import { AddressModal } from "@/components/UI/Modal/AddressModal";

// 1. Setup Font
const tenor = Tenor_Sans({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-tenor",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-lato",
});

export const metadata = {
  title: "mameko",
  description: "Artisanal Craftsmanship",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  let storeConfig: any = null;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
    const res = await fetch(`${baseUrl}/api/settings`);
    if (res.ok) {
      storeConfig = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch settings from API in layout:", error);
  }

  const isProduction = storeConfig?.midtrans_is_production === true;
  const enableMidtrans = storeConfig?.enable_midtrans !== false;
  const scriptSrc = isProduction ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js";
  const clientKey = isProduction ? process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY_PRODUCTION : process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY_SANDBOX;

  return (
    // 2. Terapkan variable font ke html class
    <html lang="en" className={`${tenor.variable} ${lato.variable}`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://gwdvcfuzwchnfrhnhaek.supabase.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.mameko.my.id" />
        <link rel="dns-prefetch" href="https://app.midtrans.com" />
        {enableMidtrans && (
          <Script
            src={scriptSrc}
            data-client-key={clientKey}
            strategy="lazyOnload"
          />
        )}
      </head>
      <body className="font-lato antialiased">
        <ThemeProvider>
          <StoreProvider>
            {children}
            <AddressModal />
            <Toaster
              position="bottom-left"
              toastOptions={{
                duration: 3000,
                style: {
                  background: "#333",
                  color: "#fff",
                  borderRadius: "8px",
                },
              }}
            />
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
