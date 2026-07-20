"use client";
import React from "react";
import styles from "./About.module.css";
import aboutData from "@/data/ui/aboutConfig.json"; // Pastikan path import sesuai

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
                src={aboutData?.image?.src}
                alt={aboutData?.image?.alt}
                className={styles.aboutImg}
              />
            </div>
          </div>

          {/* Sisi Kanan: Konten Luxury */}
          <div className={styles.aboutContent}>
            <h5 className={styles.aboutTagline}>
              {aboutData?.content?.tagline}
            </h5>
            <h3>{aboutData?.content?.heading}</h3>

            <p className={styles.aboutLead}>{aboutData?.content?.leadText}</p>

            <p>{aboutData?.content?.bodyText}</p>

            {/* List Fitur (Mapping dari JSON) */}
            <div className={styles.aboutFeatures}>
              {aboutData?.features?.map((feature, index) => (
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
