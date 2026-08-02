
"use client";

import { useState, useEffect } from "react";
import styles from "./AddressForm.module.css";
import { ProvinceCitySelect } from "@/components/UI/ProvinceCitySelect/ProvinceCitySelect";

const emptyAddress = {
  label: "Rumah",
  recipientName: "",
  recipientPhone: "",
  street: "",
  province: "",
  city: "",
  cityId: "",
  cityType: "",
  postalCode: "",
  isPrimary: false,
};

export function AddressForm({ address, onSave, onClose }) {
  const [form, setForm] = useState(emptyAddress);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (address) {
      setForm(address);
    } else {
      setForm(emptyAddress);
    }
  }, [address]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleProvinceCityChange = (value) => {
    setForm({
        ...form,
        ...value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>{address ? "Ubah Alamat" : "Tambah Alamat Baru"}</h3>
          <button onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>Label Alamat</label>
            <select name="label" value={form.label} onChange={handleChange}>
              <option value="Rumah">Rumah</option>
              <option value="Kantor">Kantor</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>Nama Penerima</label>
            <input
              type="text"
              name="recipientName"
              value={form.recipientName}
              onChange={handleChange}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label>Nomor Telepon</label>
            <input
              type="tel"
              name="recipientPhone"
              value={form.recipientPhone}
              onChange={handleChange}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label>Provinsi & Kota</label>
            <ProvinceCitySelect 
                value={{province: form.province, city: form.city, cityId: form.cityId, cityType: form.cityType}}
                onChange={handleProvinceCityChange}
            />
          </div>
          <div className={styles.formGroup}>
            <label>Alamat Lengkap</label>
            <textarea
              name="street"
              value={form.street}
              onChange={handleChange}
              required
            ></textarea>
          </div>
          <div className={styles.formGroup}>
            <label>Kode Pos</label>
            <input
              type="text"
              name="postalCode"
              value={form.postalCode}
              onChange={handleChange}
            />
          </div>
          <div className={styles.formGroup}>
            <label>
              <input
                type="checkbox"
                name="isPrimary"
                checked={form.isPrimary}
                onChange={handleChange}
              />
              Jadikan Alamat Utama
            </label>
          </div>
          <div className={styles.modalFooter}>
            <button type="button" onClick={onClose} disabled={saving}>
              Batal
            </button>
            <button type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
