"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
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
      imageUrl: v.imageUrl || "",
      imageFile: null,
    })) || [
      { size: "10ml", price: "", stock: 0, imageUrl: "", imageFile: null },
    ],
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

  const handleVariantFileChange = (index, fileObj) => {
    const newVariants = [...variants];
    newVariants[index].imageFile = fileObj;
    setVariants(newVariants);
  };

  const removeVariantImage = (index) => {
    const newVariants = [...variants];
    newVariants[index].imageUrl = "";
    newVariants[index].imageFile = null;
    setVariants(newVariants);
  };

  const addVariantField = () => {
    setVariants([
      ...variants,
      { size: "", price: "", stock: 0, imageUrl: "", imageFile: null },
    ]);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const toastId = toast.loading(editConfig.buttons.saving);
    setUploading(true);

    let imageUrl = product.imageUrl || product.image_url || "";

    try {
      // Jika file utama baru dipilih, replace gambar utama
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

      // Proses replace gambar varian satu per satu jika ada file baru
      const processedVariants = await Promise.all(
        variants.map(async (v) => {
          let currentVariantImageUrl = v.imageUrl;

          if (v.imageFile) {
            const variantData = new FormData();
            variantData.append("file", v.imageFile);
            variantData.append("upload_preset", UPLOAD_PRESET);

            const variantRes = await fetch(
              `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
              { method: "POST", body: variantData },
            );
            const variantFileData = await variantRes.json();
            if (variantFileData.secure_url) {
              currentVariantImageUrl = variantFileData.secure_url;
            }
          }

          return {
            size: v.size,
            price: Number(v.price),
            stock: Number(v.stock),
            imageUrl: currentVariantImageUrl,
          };
        }),
      );

      const { error } = await supabase
        .from("products")
        .update({
          name: formData.name,
          description: formData.description,
          image_url: imageUrl,
          variants: processedVariants,
        })
        .eq("id", product.id);

      if (error) throw error;

      toast.success(editConfig.alerts.success, { id: toastId });
      onUpdate?.();
      onClose?.();
    } catch (e) {
      console.error("Gagal update ke Supabase:", e);
      toast.error(editConfig.alerts.failedUpdate + e.message, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <form onSubmit={handleUpdate} className={styles.modal}>
        <h3 className={styles.modalTitle}>{editConfig.title}</h3>

        {/* Bagian Gambar Utama & Fitur Replace */}
        <div className={styles.imageSection}>
          <span className={styles.sectionLabel}>
            {editConfig.labels.currentImage}
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "15px",
              marginBottom: "10px",
            }}
          >
            <img
              src={
                file
                  ? URL.createObjectURL(file)
                  : product.imageUrl || product.image_url
              }
              alt="preview"
              className={styles.previewImage}
            />
            {file && (
              <button
                type="button"
                onClick={() => setFile(null)}
                style={{
                  background: "#333",
                  color: "#ff5555",
                  border: "none",
                  padding: "5px 10px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                }}
              >
                Batalkan Ganti Gambar
              </button>
            )}
          </div>
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

        {/* Bagian Varian dengan Fitur Replace Gambar Per Varian */}
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
              <div
                style={{ display: "flex", flexDirection: "column", gap: "5px" }}
              >
                {(v.imageUrl || v.imageFile) && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <img
                      src={
                        v.imageFile
                          ? URL.createObjectURL(v.imageFile)
                          : v.imageUrl
                      }
                      alt="thumb"
                      className={styles.variantThumb}
                    />
                    <button
                      type="button"
                      onClick={() => removeVariantImage(i)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ff5555",
                        cursor: "pointer",
                        fontSize: "0.7rem",
                      }}
                      title="Hapus gambar varian"
                    >
                      ✕ Hapus
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleVariantFileChange(i, e.target.files[0])
                  }
                  className={styles.variantFileInput}
                  title="Replace gambar varian"
                />
              </div>
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
