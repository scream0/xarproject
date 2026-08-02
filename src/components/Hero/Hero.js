"use client";
import { useState, useEffect } from "react";
import { HeroParticles } from "@/components/UI/HeroParticles/HeroParticles";
import { getPublicSettings } from "@/services/settingsService";
import styles from "./Hero.module.css";
import heroData from "@/data/ui/heroConfig.json"; // Fallback default JSON

export function Hero() {
  // 1. Definisikan state
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [promoSettings, setPromoSettings] = useState(null);
  const [resolvedHero, setResolvedHero] = useState(heroData);

  // 2. Efek untuk melacak mouse
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // 3. Muat settings publik (hero + promo) via service layer
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await getPublicSettings({ force: true });
        if (!data) return;
        setPromoSettings(data);

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
  }, []);

  // Contoh logika sederhana di komponen Hero.jsx
  const [isDimmed, setIsDimmed] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Jika section konten sudah terlihat, gelapkan background Hero
        setIsDimmed(entries[0].isIntersecting);
      },
      { threshold: 0.1 },
    );

    const section = document.querySelector(".content-section");
    if (section) observer.observe(section);
  }, []);

  return (
    <section id="home" className={styles.hero}>
      <div className={styles.heroBackground}></div>

      <div
        className={styles.heroSpotlight}
        style={{
          background: `radial-gradient(
      600px circle at ${mousePos.x}px ${mousePos.y}px, 
      ${heroData?.effects?.spotlightColor || "rgba(229, 228, 226, 0.1)"}, 
      transparent 80%
    )`,
        }}
      ></div>

      <div className={styles.heroOverlay}></div>
      <div className={styles.heroParticlesContainer}>
        <HeroParticles />
      </div>

      {promoSettings?.promoBannerEnabled && (
        <div className={styles.promoBanner}>
          <span className={styles.promoGlow} aria-hidden="true" />
          <span className={styles.promoBadge}>Exclusive</span>
          <span className={styles.promoText}>
            {promoSettings?.promoBannerText ||
              "Diskon khusus untuk pelanggan setia"}
          </span>
          <span className={styles.promoArrow} aria-hidden="true">
            ↗
          </span>
        </div>
      )}

      <main className={styles.content}>
        <div className={styles.contentGlow} aria-hidden="true" />
        <h5 className={styles.heroTagline}>{resolvedHero?.tagline}</h5>
        <h1 className={styles.heroTitle}>
          {resolvedHero?.title?.main} <br />
          <span>{resolvedHero?.title?.highlight}</span>
        </h1>
        <p className={styles.heroDesc}>
          {resolvedHero?.description?.prefix}
          <em>{resolvedHero?.description?.italic}</em>
          {resolvedHero?.description?.suffix}
        </p>
        <div className={styles.heroButtons}>
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

