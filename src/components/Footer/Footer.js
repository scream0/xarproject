"use client";
import styles from "./Footer.module.css";
import footerData from "@/data/ui/footerConfig.json"; // Pastikan path sesuai

export function Footer() {
  const currentYear = new Date().getFullYear(); // Tahun dinamis

  return (
    <footer className={styles.siteFooter}>
      <div className={styles.footerContainer}>
        {/* KOLOM 1: BRANDING & SOSIAL MEDIA */}
        <div className={`${styles.footerBox} ${styles.footerBranding}`}>
          <a
            href={footerData?.branding?.logo?.href}
            className={styles.footerLogo}
          >
            {footerData?.branding?.logo?.text}
            <span>{footerData?.branding?.logo?.subtext}</span>.
          </a>
          <p className={styles.footerDesc}>
            {footerData?.branding?.description}
          </p>
          <div className={styles.footerSocial}>
            {footerData?.branding?.socials?.map((social, index) => (
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
          <h3>{footerData?.navigation?.title}</h3>
          <div className={styles.linksGrid}>
            {footerData?.navigation?.links?.map((link, index) => (
              <a key={index} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
        </div>

        {/* KOLOM 3: HUBUNGI */}
        <div className={`${styles.footerBox} ${styles.footerInfo}`}>
          <h3>{footerData?.contactInfo?.title}</h3>
          {footerData?.contactInfo?.details?.map((detail, index) => (
            <p key={index}>
              <strong>{detail.label}:</strong> {detail.value}
            </p>
          ))}
        </div>

        {/* KOLOM 4: PAYMENT */}
        <div className={`${styles.footerBox} ${styles.footerPayment}`}>
          <h3>{footerData?.payment?.title}</h3>
          <p className={styles.mutedText}>{footerData?.payment?.subtitle}</p>
          <div className={styles.paymentBadges}>
            {footerData?.payment?.methods?.map((method, index) => (
              <span key={index} className={styles.badgePayment}>
                {method}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.footerBottom}>
        <p>
          &copy; {currentYear} {footerData?.copyright?.text}
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
      <svg className={styles.feather}>
        <use href={`/assets/icon/feather-sprite.svg#${icon}`} />
      </svg>
    </a>
  );
}
