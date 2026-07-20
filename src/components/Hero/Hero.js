"use client";
import { useState, useEffect } from "react";
import { HeroParticles } from "@/components/UI/HeroParticles/HeroParticles";
import styles from "./Hero.module.css";
import heroData from "@/data/ui/heroConfig.json"; // Pastikan path ini sesuai

export function Hero() {
  // 1. Definisikan state
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // 2. Efek untuk melacak mouse
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
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

      <main className={styles.content}>
        <h5 className={styles.heroTagline}>{heroData?.tagline}</h5>
        <h1 className={styles.heroTitle}>
          {heroData?.title?.main} <br />
          <span>{heroData?.title?.highlight}</span>
        </h1>
        <p className={styles.heroDesc}>
          {heroData?.description?.prefix}
          <em>{heroData?.description?.italic}</em>
          {heroData?.description?.suffix}
        </p>
        <div className={styles.heroButtons}>
          <a
            href={heroData?.buttons?.primary?.href}
            className={styles.ctaPrimary}
          >
            {heroData?.buttons?.primary?.label}
          </a>
          <a
            href={heroData?.buttons?.secondary?.href}
            className={styles.ctaSecondary}
          >
            {heroData?.buttons?.secondary?.label}
          </a>
        </div>
      </main>
    </section>
  );
}
