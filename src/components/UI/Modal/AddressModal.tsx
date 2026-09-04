"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/context/StoreContext";
import { BiteshipAreaSelect } from "@/components/UI/BiteshipAreaSelect/BiteshipAreaSelect";
import toast from "react-hot-toast";
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
    district: "",
    province: "",
    city: "",
    biteshipAreaId: "",
    postalCode: "",
  });

  useEffect(() => {
    const handleKeyDown = (event: any) => {
      if (event.key === "Escape" && !isProcessing) {
        setIsAddressModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isProcessing, setIsAddressModalOpen]);

  if (!isAddressModalOpen) return null;

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (
      !formData.recipientName ||
      !formData.street ||
      !formData.city
    ) {
      return toast.error(config.validationAlert);
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

          <BiteshipAreaSelect
            value={{
              province: formData.province,
              city: formData.city,
              district: formData.district,
              postalCode: formData.postalCode,
              biteshipAreaId: formData.biteshipAreaId,
            }}
            onChange={(next: any) =>
              setFormData((prev) => ({
                ...prev,
                ...next,
              }))
            }
          />

          <input
            type="text"
            name="postalCode"
            placeholder={config.placeholders.postalCode}
            value={formData.postalCode || ""}
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
