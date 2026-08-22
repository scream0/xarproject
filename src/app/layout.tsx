import type { ReactNode } from "react";
import "./globals.css";
import { StoreProvider } from "@/context/StoreContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { Toaster } from "react-hot-toast";
import { AddressModal } from "@/components/UI/Modal/AddressModal";
import { Tenor_Sans, Lato } from "next/font/google";
import styles from "./not-found.module.css";
import Script from "next/script";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
  const { data: storeConfig } = await supabaseAdmin
    .from("store_config")
    .select("midtrans_is_production, enable_midtrans")
    .eq("id", "main")
    .single();

  const isProduction = storeConfig?.midtrans_is_production === true;
  const enableMidtrans = storeConfig?.enable_midtrans !== false;
  const scriptSrc = isProduction ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js";
  const clientKey = isProduction ? process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY_PRODUCTION : process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY_SANDBOX;

  return (
    // 2. Terapkan variable font ke html class
    <html lang="en" className={`${tenor.variable} ${lato.variable}`}>
      <head>
        {enableMidtrans && (
          <Script
            src={scriptSrc}
            data-client-key={clientKey}
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className="font-lato antialiased">
        <ThemeProvider>
          <StoreProvider>
            {children}
            <AddressModal />
            <Toaster
              position="bottom-right"
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
