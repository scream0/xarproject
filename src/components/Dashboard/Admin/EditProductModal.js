"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import styles from "./EditProductModal.module.css";

// Import Konfigurasi JSON
import editConfig from "@/data/ui/editProductConfig.json";

export default function EditProductModal({ product, onClose, onUpdate }) {
  const [formData, setFormData] = useState({
    name: product.name || "",
    description: product.description || "",
  });

  const [variants, setVariants] = useState(
    product.variants?.map((v) => ({
      size: v.size || "",
      price: v.price || "",
      stock: v.stock ?? 0,
    })) || [{ size: "10ml", price: "", stock: 0 }],
  );

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // --- CONFIG CLOUDINARY ---
  const CLOUD_NAME = "qs59fb4k";
  const UPLOAD_PRESET = "xarProject";

  const handleVariantChange = (index, field, value) => {
    const newVariants = [...variants];
    newVariants[index][field] = value;
    setVariants(newVariants);
  };

  const addVariantField = () => {
    setVariants([...variants, { size: "", price: "", stock: 0 }]);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setUploading(true);

    let imageUrl = product.imageUrl || product.image_url || "";

    try {
      if (file) {
        const data = new FormData();
        data.append("file", file);
        data.append("upload_preset", UPLOAD_PRESET);

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
          { method: "POST", body: data },
        );
        const fileData = await res.json();
        if (fileData.secure_url) {
          imageUrl = fileData.secure_url;
        } else {
          throw new Error(editConfig.alerts.failedCloudinary);
        }
      }

      const { error } = await supabase
        .from("products")
        .update({
          name: formData.name,
          description: formData.description,
          image_url: imageUrl,
          variants: variants.map((v) => ({
            ...v,
            price: Number(v.price),
            stock: Number(v.stock),
          })),
        })
        .eq("id", product.id);

      if (error) throw error;

      alert(editConfig.alerts.success);
      onUpdate?.();
      onClose?.();
    } catch (e) {
      console.error("Gagal update ke Supabase:", e);
      alert(editConfig.alerts.failedUpdate + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <form onSubmit={handleUpdate} className={styles.modal}>
        <h3 className={styles.modalTitle}>{editConfig.title}</h3>

        <div className={styles.imageSection}>
          <span className={styles.sectionLabel}>
            {editConfig.labels.currentImage}
          </span>
          <img
            src={product.imageUrl || product.image_url}
            alt="preview"
            className={styles.previewImage}
          />
        </div>

        <span className={styles.sectionLabel}>
          {editConfig.labels.changeImage}
        </span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files[0])}
          className={styles.fileInput}
        />

        <input
          placeholder={editConfig.labels.productName}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className={styles.inputField}
          required
        />

        <div className={styles.variantsContainer}>
          <span className={styles.sectionLabel}>
            {editConfig.labels.variants}
          </span>
          {variants.map((v, i) => (
            <div key={i} className={styles.variantRow}>
              <input
                placeholder="Size (e.g. 10ml)"
                value={v.size}
                onChange={(e) => handleVariantChange(i, "size", e.target.value)}
                className={styles.variantInput}
                required
              />
              <input
                type="number"
                placeholder="Price"
                value={v.price}
                onChange={(e) =>
                  handleVariantChange(i, "price", e.target.value)
                }
                className={styles.variantInput}
                required
              />
              <input
                type="number"
                placeholder="Stock"
                value={v.stock}
                onChange={(e) =>
                  handleVariantChange(i, "stock", e.target.value)
                }
                className={styles.variantInput}
                required
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addVariantField}
            className={styles.addSizeBtn}
          >
            {editConfig.buttons.addSize}
          </button>
        </div>

        <textarea
          placeholder={editConfig.labels.description}
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          className={styles.textareaField}
        />

        <div className={styles.buttonGroup}>
          <button type="submit" disabled={uploading} className={styles.saveBtn}>
            {uploading ? editConfig.buttons.saving : editConfig.buttons.save}
          </button>
          <button type="button" onClick={onClose} className={styles.cancelBtn}>
            {editConfig.buttons.cancel}
          </button>
        </div>
      </form>
    </div>
  );
}
