"use client";
import { useState, useEffect, useRef } from "react";
import { getPublicSettings } from "@/services/settingsService";
import styles from "./Contact.module.css";
import contactData from "@/data/ui/contactConfig.json"; // Fallback default JSON
import { AppIcon } from "@/components/UI/Icon/AppIcon";

export function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  // State resolved dari DB (fallback ke JSON)
  const [contactInfo, setContactInfo] = useState(contactData);

  const contactRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    if (contactRef.current) {
      observer.observe(contactRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fetchContact = async () => {
      try {
        const data = await getPublicSettings({ force: true });
        if (!data?.contact) return;
        setContactInfo({
          ...contactData,
          ...data.contact,
          header: {
            ...(contactData?.header || {}),
            ...(data.contact?.header || {}),
            title: {
              ...(contactData?.header?.title || {}),
              ...(data.contact?.header?.title || {}),
            },
          },
          infoItems:
            Array.isArray(data.contact?.infoItems) &&
            data.contact.infoItems.length > 0
              ? data.contact.infoItems
              : contactData?.infoItems || [],
          headquarters: {
            ...(contactData?.headquarters || {}),
            ...(data.contact?.headquarters || {}),
          },
          form: {
            ...(contactData?.form || {}),
            ...(data.contact?.form || {}),
            fields: {
              ...(contactData?.form?.fields || {}),
              ...(data.contact?.form?.fields || {}),
            },
          },
        });
      } catch (error) {
        console.error("Failed to load contact settings", error);
      }
    };

    fetchContact();
  }, []);

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id.replace("input-", "")]: value }));
  };

  const kirimPesanKontak = (e) => {
    e.preventDefault();
    const teksPesan = `*📩 PESAN BARU - KONTAK KAMI*\n--------------------------------------------\n• *Nama* : ${formData.name}\n• *Email* : ${formData.email}\n• *No HP* : ${formData.phone}\n--------------------------------------------\n*💬 ISI PESAN:*\n"${formData.message}"`;

    // Mengambil nomor WA dinamis dari settings DB / JSON
    const waNumber =
      contactInfo?.whatsappNumber || contactData?.whatsappNumber || "6281234567890";

    window.open(
      `https://wa.me/${waNumber}?text=${encodeURIComponent(teksPesan)}`,
      "_blank",
    );

    setFormData({ name: "", email: "", phone: "", message: "" });
  };

  return (
    <section id="contact" className={`${styles.contact} ${isVisible ? styles.visible : ""}`} ref={contactRef}>
      <div className={styles.contactContainer}>
        {/* Sisi Kiri: Informasi */}
        <div className={styles.contactInfoCard}>
          <div className={styles.infoHeader}>
            <p className={styles.contactTagline}>{contactInfo?.header?.tagline}</p>
            <h2>
              {contactInfo?.header?.title?.main} <br />
              <span>{contactInfo?.header?.title?.highlight}</span>
            </h2>
          </div>

          <div className={styles.infoDetailsList}>
            {contactInfo?.infoItems?.map((item, index) => (
              <InfoItem
                key={index}
                icon={item.icon}
                title={item.title}
                value={item.value}
              />
            ))}
          </div>

          <div className={styles.addressBox}>
            <h3>{contactInfo?.headquarters?.title}</h3>
            <p>
              {contactInfo?.headquarters?.address?.[0]}
              <br />
              {contactInfo?.headquarters?.address?.[1]}
            </p>
            <span className={styles.coordinates}>
              {contactInfo?.headquarters?.coordinates}
            </span>
          </div>
        </div>

        {/* Sisi Kanan: Form */}
        <div className={styles.contactFormWrapper}>
          <form onSubmit={kirimPesanKontak} className={styles.contactForm}>
            <h3>{contactInfo?.form?.title}</h3>

            <InputBox
              id="input-name"
              label={contactInfo?.form?.fields?.name}
              value={formData.name}
              onChange={handleInputChange}
            />
            <InputBox
              id="input-email"
              label={contactInfo?.form?.fields?.email}
              type="email"
              value={formData.email}
              onChange={handleInputChange}
            />
            <InputBox
              id="input-phone"
              label={contactInfo?.form?.fields?.phone}
              type="tel"
              value={formData.phone}
              onChange={handleInputChange}
            />

            <div className={styles.inputBox}>
              <textarea
                required
                value={formData.message}
                onChange={handleInputChange}
                placeholder=" "
                id="input-message"
              ></textarea>
              <label htmlFor="input-message">
                {contactInfo?.form?.fields?.message}
              </label>
            </div>

            <button type="submit" className={styles.btnSubmit}>
              {contactInfo?.form?.submitText}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

// Sub-komponen
function InfoItem({ icon, title, value }) {
  return (
    <div className={styles.infoItem}>
      <div className={styles.infoIcon}>
        <AppIcon name={icon} className={styles.feather} />
      </div>
      <div className={styles.infoText}>
        <h4>{title}</h4>
        <p>{value}</p>
      </div>
    </div>
  );
}

function InputBox({ id, label, type = "text", value, onChange }) {
  return (
    <div className={styles.inputBox}>
      <input
        type={type}
        required
        value={value}
        onChange={onChange}
        placeholder=" "
        id={id}
      />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

