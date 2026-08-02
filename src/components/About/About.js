"use client";
import React, { useEffect, useState } from "react";
import { getPublicSettings } from "@/services/settingsService";
import styles from "./About.module.css";
import aboutData from "@/data/ui/aboutConfig.json"; // Fallback default JSON

// Komponen kecil untuk fitur (tetap dipertahankan)
const FeatureItem = ({ number, title, desc }) => (
  <div className={styles.featureItem}>
    <span className={styles.featureNumber}>{number}</span>
    <div className={styles.featureText}>
      <h4>{title}</h4>
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
    <section id="about" className={styles.about}>
      <div className={styles.aboutContainer}>
        {/* Layout Utama */}
        <div className={styles.aboutRow}>
          {/* Sisi Kiri: Visual Editorial */}
          <div className={styles.aboutImgWrapper}>
            <div className={styles.imgFrame}></div>
            {/* Kontainer Gambar + Shimmer */}
            <div className={styles.imgContainer}>
              <img
                src={aboutImage || "/assets/images/about-bg.jpg"}
                alt={aboutImageAlt}
                className={styles.aboutImg}
              />
            </div>
          </div>

          {/* Sisi Kanan: Konten Luxury */}
          <div className={styles.aboutContent}>
            <h5 className={styles.aboutTagline}>
              {aboutContent?.tagline}
            </h5>
            <h3>{aboutContent?.heading}</h3>

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

