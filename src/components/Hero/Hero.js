"use client";
import { useState, useEffect, useRef } from "react";
import { HeroParticles } from "@/components/UI/HeroParticles/HeroParticles";
import { getPublicSettings } from "@/services/settingsService";
import styles from "./Hero.module.css";
import heroData from "@/data/ui/heroConfig.json"; // Fallback default JSON

export function Hero() {
  // 1. Definisikan state
  const [resolvedHero, setResolvedHero] = useState(heroData);
  const [isDimmed, setIsDimmed] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  // Ref buat spotlight, supaya mousemove gak trigger re-render React
  const spotlightRef = useRef(null);

  // 2. Efek untuk melacak mouse (throttled via requestAnimationFrame, pakai CSS var)
  useEffect(() => {
    let rafId = null;

    const handleMouseMove = (e) => {
      if (rafId) return; // sudah ada frame pending, skip
      rafId = requestAnimationFrame(() => {
        if (spotlightRef.current) {
          spotlightRef.current.style.setProperty("--spotlight-x", `${e.clientX}px`);
          spotlightRef.current.style.setProperty("--spotlight-y", `${e.clientY}px`);
        }
        rafId = null;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // 3. Muat settings publik (hero) via service layer
  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const data = await getPublicSettings({ force: true });
        if (!data || !isMounted) return;

        // Gabungkan hero dari DB dengan default JSON (fallback field parsial)
        if (data?.hero) {
          setResolvedHero({
            ...heroData,
            ...data.hero,
            title: {
              ...(heroData?.title || {}),
              ...(data.hero?.title || {}),
            },
            description: {
              ...(heroData?.description || {}),
              ...(data.hero?.description || {}),
            },
            buttons: {
              ...(heroData?.buttons || {}),
              ...(data.hero?.buttons || {}),
              primary: {
                ...(heroData?.buttons?.primary || {}),
                ...(data.hero?.buttons?.primary || {}),
              },
              secondary: {
                ...(heroData?.buttons?.secondary || {}),
                ...(data.hero?.buttons?.secondary || {}),
              },
            },
          });
        }
      } catch (error) {
        console.error("Failed to load hero settings", error);
      }
    };

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  // 4. Trigger reveal animation setelah mount (sedikit delay biar browser sempat paint dulu)
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      setIsRevealed(true); // langsung tampil tanpa animasi
      return;
    }

    const timer = requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsRevealed(true));
    });
    return () => cancelAnimationFrame(timer);
  }, []);

  // 5. Observer buat dimming background pas section berikutnya keliatan
  useEffect(() => {
    const section = document.querySelector(".content-section");
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setIsDimmed(entries[0].isIntersecting);
      },
      { threshold: 0.1 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // Ambil URL gambar latar belakang dari resolvedHero (jika ada)
  const heroBackgroundImage = resolvedHero?.image;
  const spotlightColor =
    resolvedHero?.effects?.spotlightColor || "rgba(229, 228, 226, 0.1)";

  return (
    <section id="home" className={styles.hero}>
      {/* Background dinamis dari gambar yang di-upload */}
      <div
        className={`${styles.heroBackground} ${isDimmed ? styles.dimmed : ""}`}
        style={
          heroBackgroundImage
            ? {
                backgroundImage: `url(${heroBackgroundImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }
            : undefined
        }
      ></div>

      <div
        ref={spotlightRef}
        className={styles.heroSpotlight}
        style={{
          background: `radial-gradient(
      600px circle at var(--spotlight-x, 50%) var(--spotlight-y, 50%),
      ${spotlightColor},
      transparent 80%
    )`,
        }}
      ></div>

      <div className={styles.heroOverlay}></div>
      <div className={styles.heroParticlesContainer}>
        <HeroParticles />
      </div>

      <main className={styles.content}>
        <div className={styles.contentGlow} aria-hidden="true" />
        <h5
          className={`${styles.heroTagline} ${styles.reveal} ${isRevealed ? styles.revealed : ""}`}
          style={{ "--reveal-delay": "0ms" }}
        >
          {resolvedHero?.tagline}
        </h5>
        <h1
          className={`${styles.heroTitle} ${styles.reveal} ${isRevealed ? styles.revealed : ""}`}
          style={{ "--reveal-delay": "120ms" }}
        >
          {resolvedHero?.title?.main} <br />
          <span>{resolvedHero?.title?.highlight}</span>
        </h1>
        <p
          className={`${styles.heroDesc} ${styles.reveal} ${isRevealed ? styles.revealed : ""}`}
          style={{ "--reveal-delay": "240ms" }}
        >
          {resolvedHero?.description?.prefix}
          <em>{resolvedHero?.description?.italic}</em>
          {resolvedHero?.description?.suffix}
        </p>
        <div
          className={`${styles.heroButtons} ${styles.reveal} ${isRevealed ? styles.revealed : ""}`}
          style={{ "--reveal-delay": "360ms" }}
        >
          <a
            href={resolvedHero?.buttons?.primary?.href}
            className={styles.ctaPrimary}
          >
            {resolvedHero?.buttons?.primary?.label}
          </a>
          <a
            href={resolvedHero?.buttons?.secondary?.href}
            className={styles.ctaSecondary}
          >
            {resolvedHero?.buttons?.secondary?.label}
          </a>
        </div>
      </main>
    </section>
  );
}