"use client";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import styles from "./SettingsView.module.css";
import { auth } from "@/lib/firebaseClient";

import settingsConfig from "@/data/ui/settingsConfig.json";

export default function SettingsView() {
  const [settings, setSettings] = useState({
    storeName: "",
    storeEmail: "",
    currency: "IDR",
    lowStockThreshold: 10,
    midtransServerKey: "",
    midtransClientKey: "",
  });
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  // Fetch settings from the secure API endpoint
  useEffect(() => {
    const fetchSettings = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast.error("Authentication required.");
        setIsFetching(false);
        return;
      }
      
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch("/api/settings", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Gagal memuat pengaturan dari server.");
        
        const data = await res.json();
        setSettings(data);
      } catch (error) {
        console.error("Fetch Settings Error:", error);
        toast.error(error.message);
      } finally {
        setIsFetching(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const toastId = toast.loading(settingsConfig.buttons.saving);
    setLoading(true);

    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error("Sesi Anda berakhir. Silakan login kembali.", { id: toastId });
      setLoading(false);
      return;
    }

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Gagal menyimpan pengaturan.");
      }

      // To visually confirm, refetch the masked data from server
      const updatedSettingsRes = await fetch("/api/settings", { headers: { Authorization: `Bearer ${token}` } });
      const updatedData = await updatedSettingsRes.json();
      setSettings(updatedData);

      toast.success(settingsConfig.toast.success, { id: toastId });
    } catch (error) {
      console.error("Save Settings Error:", error);
      toast.error(error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };
  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
    }));
  }

  if (isFetching) {
    return <p className={styles.loadingText}>Memuat Pengaturan...</p>;
  }

  return (
    <div className={styles.settingsContainer}>
      <h3 className={styles.settingsTitle}>{settingsConfig.title}</h3>

      <form onSubmit={handleSave}>
        <div className={styles.formSection}>
          <h4 className={styles.sectionTitle}>Informasi Toko</h4>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>{settingsConfig.labels.storeName}</label>
            <input type="text" name="storeName" value={settings.storeName} onChange={handleInputChange} className={styles.inputField} required />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>{settingsConfig.labels.storeEmail}</label>
            <input type="email" name="storeEmail" value={settings.storeEmail} onChange={handleInputChange} className={styles.inputField} required />
          </div>
        </div>

        <div className={styles.formSection}>
          <h4 className={styles.sectionTitle}>Konfigurasi Produk & Mata Uang</h4>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>{settingsConfig.labels.currency}</label>
            <select name="currency" value={settings.currency} onChange={handleInputChange} className={styles.selectField}>
              <option value="IDR">IDR (Indonesian Rupiah)</option>
              <option value="USD">USD (US Dollar)</option>
            </select>
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>{settingsConfig.labels.lowStockThreshold}</label>
            <input type="number" name="lowStockThreshold" value={settings.lowStockThreshold} onChange={handleInputChange} className={styles.inputField} min="0" required />
          </div>
        </div>
        
        <div className={styles.formSection}>
          <h4 className={styles.sectionTitle}>Kunci API Gateway Pembayaran</h4>
           <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>{settingsConfig.labels.midtransServerKey}</label>
            <input type="password" name="midtransServerKey" value={settings.midtransServerKey} onChange={handleInputChange} className={styles.inputField} placeholder="Isi untuk memperbarui..." />
            <small className={styles.fieldDesc}>Kunci ini bersifat rahasia dan tidak akan pernah ditampilkan lagi setelah disimpan.</small>
          </div>
           <div className={styles.inputGroup}>
            <label className={styles.fieldLabel}>{settingsConfig.labels.midtransClientKey}</label>
            <input type="password" name="midtransClientKey" value={settings.midtransClientKey} onChange={handleInputChange} className={styles.inputField} placeholder="Isi untuk memperbarui..." />
          </div>
        </div>

        <button type="submit" disabled={loading} className={styles.saveBtn}>
          {loading ? settingsConfig.buttons.saving : settingsConfig.buttons.save}
        </button>
      </form>
    </div>
  );
}
