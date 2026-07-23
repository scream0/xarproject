"use client";
import { useState } from "react";
import { useStore } from "@/context/StoreContext";
import styles from "./AddressModal.module.css";
import config from "@/data/ui/addressModalConfig.json";

export function AddressModal() {
  const {
    isAddressModalOpen,
    setIsAddressModalOpen,
    saveAddressAndPay,
    isProcessing,
  } = useStore();

  const [formData, setFormData] = useState({
    recipientName: "",
    recipientPhone: "",
    street: "",
    city: "",
    postalCode: "",
  });

  if (!isAddressModalOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.recipientName || !formData.street || !formData.city) {
      return alert(config.validationAlert);
    }
    saveAddressAndPay(formData);
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h3 className={styles.modalTitle}>{config.title}</h3>
        <p className={styles.modalDescription}>{config.description}</p>

        <form onSubmit={handleSubmit} className={styles.formGroup}>
          <input
            type="text"
            name="recipientName"
            placeholder={config.placeholders.recipientName}
            value={formData.recipientName}
            onChange={handleChange}
            required
            className={styles.inputField}
          />
          <input
            type="text"
            name="recipientPhone"
            placeholder={config.placeholders.recipientPhone}
            value={formData.recipientPhone}
            onChange={handleChange}
            required
            className={styles.inputField}
          />
          <textarea
            name="street"
            placeholder={config.placeholders.street}
            value={formData.street}
            onChange={handleChange}
            required
            className={`${styles.inputField} ${styles.textareaField}`}
          />
          <input
            type="text"
            name="city"
            placeholder={config.placeholders.city}
            value={formData.city}
            onChange={handleChange}
            required
            className={styles.inputField}
          />
          <input
            type="text"
            name="postalCode"
            placeholder={config.placeholders.postalCode}
            value={formData.postalCode}
            onChange={handleChange}
            className={styles.inputField}
          />

          <div className={styles.buttonGroup}>
            <button
              type="button"
              onClick={() => setIsAddressModalOpen(false)}
              className={styles.cancelBtn}
              disabled={isProcessing}
            >
              {config.buttons.cancel}
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isProcessing}
            >
              {isProcessing ? config.buttons.processing : config.buttons.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
