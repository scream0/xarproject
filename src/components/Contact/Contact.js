"use client";
import { useState } from "react";
import styles from "./Contact.module.css";
import contactData from "@/data/ui/contactConfig.json"; // Sesuaikan path ini

export function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id.replace("input-", "")]: value }));
  };

  const kirimPesanKontak = (e) => {
    e.preventDefault();
    const teksPesan = `*📩 PESAN BARU - KONTAK KAMI*\n--------------------------------------------\n• *Nama* : ${formData.name}\n• *Email* : ${formData.email}\n• *No HP* : ${formData.phone}\n--------------------------------------------\n*💬 ISI PESAN:*\n"${formData.message}"`;

    // Mengambil nomor WA dinamis dari JSON
    const waNumber = contactData?.whatsappNumber || "6281234567890";

    window.open(
      `https://wa.me/${waNumber}?text=${encodeURIComponent(teksPesan)}`,
      "_blank",
    );

    setFormData({ name: "", email: "", phone: "", message: "" });
  };

  return (
    <section id="contact" className={styles.contact}>
      <div className={styles.contactContainer}>
        {/* Sisi Kiri: Informasi */}
        <div className={styles.contactInfoCard}>
          <div className={styles.infoHeader}>
            <h5>{contactData?.header?.tagline}</h5>
            <h2>
              {contactData?.header?.title?.main} <br />
              <span>{contactData?.header?.title?.highlight}</span>
            </h2>
          </div>

          <div className={styles.infoDetailsList}>
            {contactData?.infoItems?.map((item, index) => (
              <InfoItem
                key={index}
                icon={item.icon}
                title={item.title}
                value={item.value}
              />
            ))}
          </div>

          <div className={styles.addressBox}>
            <h4>{contactData?.headquarters?.title}</h4>
            <p>
              {contactData?.headquarters?.address?.[0]}
              <br />
              {contactData?.headquarters?.address?.[1]}
            </p>
            <span className={styles.coordinates}>
              {contactData?.headquarters?.coordinates}
            </span>
          </div>
        </div>

        {/* Sisi Kanan: Form */}
        <div className={styles.contactFormWrapper}>
          <form onSubmit={kirimPesanKontak} className={styles.contactForm}>
            <h3>{contactData?.form?.title}</h3>

            <InputBox
              id="input-name"
              label={contactData?.form?.fields?.name}
              value={formData.name}
              onChange={handleInputChange}
            />
            <InputBox
              id="input-email"
              label={contactData?.form?.fields?.email}
              type="email"
              value={formData.email}
              onChange={handleInputChange}
            />
            <InputBox
              id="input-phone"
              label={contactData?.form?.fields?.phone}
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
                {contactData?.form?.fields?.message}
              </label>
            </div>

            <button type="submit" className={styles.btnSubmit}>
              {contactData?.form?.submitText}
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
        <svg className={styles.feather}>
          {/* Pastikan menggunakan template literal yang benar di sini */}
          <use href={`/assets/icon/feather-sprite.svg#${icon}`} />
        </svg>
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
