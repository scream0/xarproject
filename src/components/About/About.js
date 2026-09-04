"use client";
import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { getPublicSettings } from "@/services/settingsService";
import styles from "./About.module.css";
import aboutData from "@/data/ui/aboutConfig.json"; // Fallback default JSON

// Komponen kecil untuk fitur (tetap dipertahankan)
const FeatureItem = ({ number, title, desc }) => (
  <div className={styles.featureItem}>
    <span className={styles.featureNumber}>{number}</span>
    <div className={styles.featureText}>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  </div>
);

export function About() {
  // Fallback: gambar & konten dari JSON, akan di-override data DB jika tersedia
  const [aboutImage, setAboutImage] = useState(aboutData?.image?.src || null);
  const [aboutImageAlt, setAboutImageAlt] = useState(
    aboutData?.image?.alt || "About image",
  );
  const [aboutContent, setAboutContent] = useState(aboutData?.content || {});
  const [aboutFeatures, setAboutFeatures] = useState(
    aboutData?.features || [],
  );

  const aboutRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  // Intersection Observer untuk memicu animasi saat di-scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Hanya animasi sekali
        }
      },
      { threshold: 0.2 }
    );

    if (aboutRef.current) {
      observer.observe(aboutRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fetchAbout = async () => {
      try {
        const data = await getPublicSettings({ force: true });
        if (!data) return;

        // Gambar About dari settings DB
        if (data?.about?.image) setAboutImage(data.about.image);
        if (data?.about?.imageAlt) setAboutImageAlt(data.about.imageAlt);

        // Konten About dari settings DB (fallback parsial ke JSON)
        if (data?.about?.content) {
          setAboutContent({
            ...(aboutData?.content || {}),
            ...data.about.content,
          });
        }

        // Fitur About dari settings DB
        if (
          Array.isArray(data?.about?.features) &&
          data.about.features.length > 0
        ) {
          setAboutFeatures(data.about.features);
        }
      } catch (error) {
        console.error("Failed to load about settings", error);
      }
    };

    fetchAbout();
  }, []);

  return (
    <section id="about" className={`${styles.about} ${isVisible ? styles.visible : ""}`} ref={aboutRef}>
      <div className={styles.aboutContainer}>
        {/* Layout Utama */}
        <div className={styles.aboutRow}>
          {/* Sisi Kiri: Visual Editorial */}
          <div className={styles.aboutImgWrapper}>
            {/* Glowing Blob Decoration */}
            <div className={styles.aboutGlowBlob}></div>

            <div className={styles.imgFrame}></div>
            {/* Kontainer Gambar + Shimmer */}
            <div className={styles.imgContainer}>
              <Image
                src={aboutImage || "/assets/images/about-bg.jpg"}
                alt={aboutImageAlt}
                className={styles.aboutImg}
                width={600}
                height={750}
                loading="lazy"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          </div>

          {/* Sisi Kanan: Konten Luxury */}
          <div className={styles.aboutContent}>
            <p className={styles.aboutTagline}>
              {aboutContent?.tagline}
            </p>
            <h2>{aboutContent?.heading}</h2>

            <p className={styles.aboutLead}>{aboutContent?.leadText}</p>

            <p>{aboutContent?.bodyText}</p>

            {/* List Fitur (Mapping dari JSON/Settings) */}
            <div className={styles.aboutFeatures}>
              {aboutFeatures?.map((feature, index) => (
                <FeatureItem
                  key={index}
                  number={feature.number}
                  title={feature.title}
                  desc={feature.desc}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

