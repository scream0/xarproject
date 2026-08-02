"use client";
import { useState, useEffect } from "react";
import { getPublicSettings } from "@/services/settingsService";
import styles from "./Footer.module.css";
import footerData from "@/data/ui/footerConfig.json"; // Fallback default JSON
import { AppIcon } from "@/components/UI/Icon/AppIcon";

export function Footer() {
  const currentYear = new Date().getFullYear(); // Tahun dinamis

  // Resolved footer data (DB override JSON)
  const [footerInfo, setFooterInfo] = useState(footerData);

  useEffect(() => {
    const fetchFooter = async () => {
      try {
        const data = await getPublicSettings({ force: true });
        if (!data?.footer) return;
        setFooterInfo({
          ...footerData,
          ...data.footer,
          branding: {
            ...(footerData?.branding || {}),
            ...(data.footer?.branding || {}),
            logo: {
              ...(footerData?.branding?.logo || {}),
              ...(data.footer?.branding?.logo || {}),
            },
            socials:
              Array.isArray(data.footer?.branding?.socials) &&
              data.footer.branding.socials.length > 0
                ? data.footer.branding.socials
                : footerData?.branding?.socials || [],
          },
          navigation: {
            ...(footerData?.navigation || {}),
            ...(data.footer?.navigation || {}),
            links:
              Array.isArray(data.footer?.navigation?.links) &&
              data.footer.navigation.links.length > 0
                ? data.footer.navigation.links
                : footerData?.navigation?.links || [],
          },
          payment: {
            ...(footerData?.payment || {}),
            ...(data.footer?.payment || {}),
            methods:
              Array.isArray(data.footer?.payment?.methods) &&
              data.footer.payment.methods.length > 0
                ? data.footer.payment.methods
                : footerData?.payment?.methods || [],
          },
          copyright: {
            ...(footerData?.copyright || {}),
            ...(data.footer?.copyright || {}),
          },
        });
      } catch (error) {
        console.error("Failed to load footer settings", error);
      }
    };

    fetchFooter();
  }, []);

  return (
    <footer className={styles.siteFooter}>
      <div className={styles.footerContainer}>
        {/* KOLOM 1: BRANDING & SOSIAL MEDIA */}
        <div className={`${styles.footerBox} ${styles.footerBranding}`}>
          <a
            href={footerInfo?.branding?.logo?.href}
            className={styles.footerLogo}
          >
            {footerInfo?.branding?.logo?.text}
            <span>{footerInfo?.branding?.logo?.subtext}</span>.
          </a>
          <p className={styles.footerDesc}>
            {footerInfo?.branding?.description}
          </p>
          <div className={styles.footerSocial}>
            {footerInfo?.branding?.socials?.map((social, index) => (
              <SocialLink
                key={index}
                href={social.href}
                icon={social.icon}
                label={social.label}
              />
            ))}
          </div>
        </div>

        {/* KOLOM 2: NAVIGASI */}
        <div className={`${styles.footerBox} ${styles.footerLinks}`}>
          <h3>{footerInfo?.navigation?.title}</h3>
          <div className={styles.linksGrid}>
            {footerInfo?.navigation?.links?.map((link, index) => (
              <a key={index} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
        </div>

        {/* KOLOM 3: PAYMENT */}
        <div className={`${styles.footerBox} ${styles.footerPayment}`}>
          <h3>{footerInfo?.payment?.title}</h3>
          <p className={styles.mutedText}>{footerInfo?.payment?.subtitle}</p>
          <div className={styles.paymentBadges}>
            {footerInfo?.payment?.methods?.map((method, index) => (
              <span key={index} className={styles.badgePayment}>
                {method}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.footerBottom}>
        <p>
          &copy; {currentYear} {footerInfo?.copyright?.text}
        </p>
      </div>
    </footer>
  );
}

// Sub-komponen tetap dipertahankan
function SocialLink({ href, icon, label }) {
  const handleClick = (e) => {
    // Mencegah refresh jika href diawali dengan #
    if (href.startsWith("#")) {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      target={href.startsWith("#") ? "_self" : "_blank"}
      rel="noopener noreferrer"
      aria-label={label}
    >
      <AppIcon name={icon} className={styles.feather} />
    </a>
  );
}

