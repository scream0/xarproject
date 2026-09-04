"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Particles } from "./404Particles";
import styles from "./not-found.module.css";
import notFoundData from "@/data/ui/notFoundConfig.json"; // Sesuaikan path ini

export default function NotFound() {
  // Inisialisasi null untuk mencegah hydration mismatch
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [quote, setQuote] = useState("Aroma tidak ditemukan.");

  useEffect(() => {
    const quotesArray = notFoundData?.quotes || [];
    if (quotesArray.length > 0) {
      const lastIndex = window.sessionStorage.getItem("lastQuoteIndex");
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * quotesArray.length);
      } while (
        quotesArray.length > 1 &&
        lastIndex !== null &&
        randomIndex === Number.parseInt(lastIndex, 10)
      );

      window.sessionStorage.setItem("lastQuoteIndex", randomIndex.toString());
      setQuote(quotesArray[randomIndex]);
    }
  }, []); // Empty dependency array ensures this runs only once on the client

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div
      className={styles.notFoundContainer}
      style={{
        // Menggunakan warna perak dari config
        background: mousePos
          ? `radial-gradient(800px circle at ${mousePos.x}px ${mousePos.y}px, ${notFoundData?.effects?.spotlightColor}, ${notFoundData?.effects?.backgroundColor} 70%)`
          : notFoundData?.effects?.backgroundColor,
      }}
    >
      <Particles />

      {/* Gabungkan class container konten dan animasi fade in */}
      <div className={`${styles.notFoundContent} ${styles.fadeContainer}`}>
        <h1 className={`${styles.errorCode} ${styles.animate1}`}>
          {notFoundData?.content?.errorCode}
        </h1>

        <h2 className={`${styles.errorTitle} ${styles.animate2}`}>
          {notFoundData?.content?.title}
        </h2>

        <p className={`${styles.errorQuote} ${styles.animate3}`}>
          <em>&quot;{quote}&quot;</em>
        </p>

        <p className={`${styles.errorDesc} ${styles.animate4}`}>
          {notFoundData?.content?.description}
        </p>

        <div className={`${styles.animate5}`}>
          <Link
            href={notFoundData?.button?.href || "/"}
            className={styles.btnBackHome}
          >
            {notFoundData?.button?.label}
          </Link>
        </div>
      </div>
    </div>
  );
}
