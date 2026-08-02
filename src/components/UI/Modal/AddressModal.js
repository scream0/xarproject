"use client";
import { useState } from "react";
import { useStore } from "@/context/StoreContext";
import { CitySearchInput } from "@/components/UI/CitySearchInput/CitySearchInput";
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
    label: "Rumah",
    recipientName: "",
    recipientPhone: "",
    street: "",
    city: "",
    cityId: "",
    postalCode: "",
  });

  if (!isAddressModalOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (
      !formData.recipientName ||
      !formData.street ||
      !formData.cityId ||
      !formData.city
    ) {
      return alert(config.validationAlert);
    }
    saveAddressAndPay(formData);
  };

  return (
    <div
      className={styles.modalOverlay}
      onClick={() => !isProcessing && setIsAddressModalOpen(false)}
    >
      <div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={styles.modalTitle}>{config.title}</h3>
        <p className={styles.modalDescription}>{config.description}</p>

        <form onSubmit={handleSubmit} className={styles.formGroup}>
          <select
            name="label"
            value={formData.label}
            onChange={handleChange}
            className={styles.inputField}
          >
            <option value="Rumah">Rumah</option>
            <option value="Kantor">Kantor</option>
            <option value="Lainnya">Lainnya</option>
          </select>

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
          <CitySearchInput
            value={formData.city}
            cityId={formData.cityId}
            onSelect={(city) =>
              setFormData((prev) => ({
                ...prev,
                city: `${city.type} ${city.city_name}`,
                cityId: String(city.city_id),
              }))
            }
            placeholder={config.placeholders.city}
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
