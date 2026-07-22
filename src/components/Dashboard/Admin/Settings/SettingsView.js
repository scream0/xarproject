"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import styles from "./SettingsView.module.css";

// Import Konfigurasi JSON
import settingsConfig from "@/data/ui/settingsConfig.json";

export default function SettingsView() {
  const [settings, setSettings] = useState({
    storeName: "AWRG & Flowrawr",
    storeEmail: "admin@xarproject.com",
    currency: "IDR",
    lowStockThreshold: 5,
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    const toastId = toast.loading(settingsConfig.buttons.saving);
    setLoading(true);

    try {
      // Simulasi penyimpanan (bisa dihubungkan ke localStorage atau tabel database settings)
      await new Promise((resolve) => setTimeout(resolve, 800));
      localStorage.setItem("app_settings", JSON.stringify(settings));

      toast.success(settingsConfig.toast.success, { id: toastId });
    } catch (error) {
      console.error("Gagal menyimpan:", error);
      toast.error(settingsConfig.toast.error, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.settingsContainer}>
      <h3 className={styles.settingsTitle}>{settingsConfig.title}</h3>

      <form onSubmit={handleSave}>
        <div className={styles.formGroup}>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>
              {settingsConfig.labels.storeName}
            </label>
            <input
              type="text"
              value={settings.storeName}
              onChange={(e) =>
                setSettings({ ...settings, storeName: e.target.value })
              }
              className={styles.inputField}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>
              {settingsConfig.labels.storeEmail}
            </label>
            <input
              type="email"
              value={settings.storeEmail}
              onChange={(e) =>
                setSettings({ ...settings, storeEmail: e.target.value })
              }
              className={styles.inputField}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>
              {settingsConfig.labels.currency}
            </label>
            <select
              value={settings.currency}
              onChange={(e) =>
                setSettings({ ...settings, currency: e.target.value })
              }
              className={styles.selectField}
            >
              <option value="IDR">IDR (Indonesian Rupiah)</option>
              <option value="USD">USD (US Dollar)</option>
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>
              {settingsConfig.labels.lowStockThreshold}
            </label>
            <input
              type="number"
              value={settings.lowStockThreshold}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  lowStockThreshold: Number(e.target.value),
                })
              }
              className={styles.inputField}
              min="1"
              required
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className={styles.saveBtn}>
          {loading
            ? settingsConfig.buttons.saving
            : settingsConfig.buttons.save}
        </button>
      </form>
    </div>
  );
}
