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
  const [quote, setQuote] = useState("");

  useEffect(() => {
    // Ambil array quotes dari JSON, beri fallback jika kosong
    const quotesArray = notFoundData?.quotes || ["Aroma tidak ditemukan."];
    // Set kutipan acak hanya di client
    // 1. Ambil index terakhir yang disimpan di browser
    const lastIndex = sessionStorage.getItem("lastQuoteIndex");
    let randomIndex;

    // 2. Jika ada lebih dari 1 quote, pastikan yang terpilih tidak sama dengan sebelumnya
    if (quotesArray.length > 1) {
      do {
        randomIndex = Math.floor(Math.random() * quotesArray.length);
      } while (lastIndex !== null && randomIndex === parseInt(lastIndex));
    } else {
      randomIndex = 0; // Fallback jika isi array cuma 1
    }

    // 3. Simpan index baru ke sessionStorage untuk pengecekan di refresh berikutnya
    sessionStorage.setItem("lastQuoteIndex", randomIndex.toString());

    // 4. Set quote yang sudah dijamin berbeda
    setQuote(quotesArray[randomIndex]);
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
          <em>"{quote}"</em>
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
