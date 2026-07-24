"use client";

import styles from "./ConfirmationModal.module.css";

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>{title || "Konfirmasi"}</h3>
        <p className={styles.message}>
          {message || "Apakah Anda yakin ingin melanjutkan tindakan ini?"}
        </p>
        <div className={styles.buttonGroup}>
          <button onClick={onClose} className={styles.cancelBtn}>
            Batal
          </button>
          <button onClick={onConfirm} className={styles.confirmBtn}>
            Konfirmasi
          </button>
        </div>
      </div>
    </div>
  );
}
