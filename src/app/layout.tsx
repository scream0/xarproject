import type { ReactNode } from "react";
import "./globals.css";
import { StoreProvider } from "@/context/StoreContext";
import { Toaster } from "react-hot-toast";
import { Tenor_Sans, Lato } from "next/font/google";
import styles from "./not-found.module.css";
import Script from "next/script";

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // 2. Terapkan variable font ke html class
    <html lang="en" className={`${tenor.variable} ${lato.variable}`}>
      <body className="font-lato antialiased">
        <StoreProvider>
          {children}
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
        {/* untuk live production ganti ke app.midtrans.com , sama client production */}
        <Script
          src="https://app.sandbox.midtrans.com/snap/snap.js" // Gunakan 'app.midtrans.com' untuk mode Production
          data-client-key="Mid-client-mxAh3ynr_EVMKYpi" // GANTI DENGAN CLIENT KEY ANDA (Bukan Server Key!)
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
