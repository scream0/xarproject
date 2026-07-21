"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import styles from "./AddProductForm.module.css";

// Import Konfigurasi JSON
import addConfig from "@/data/ui/addProductConfig.json";

export default function AddProductForm({ onProductAdded }) {
  const [formData, setFormData] = useState({
    name: "",
    category: "Parfum",
    description: "",
  });

  // Varian sekarang menyertakan imageFile untuk menampung file gambar per ukuran
  const [variants, setVariants] = useState([
    { size: "10ml", price: "", stock: 0, imageFile: null },
  ]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const CLOUD_NAME = "qs59fb4k";
  const UPLOAD_PRESET = "xarProject";

  const addVariantField = () => {
    setVariants([
      ...variants,
      { size: "", price: "", stock: 0, imageFile: null },
    ]);
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error(addConfig.toast.selectImage);
      return;
    }

    const toastId = toast.loading(addConfig.toast.uploading);

    try {
      setUploading(true);

      // 1. Upload Gambar Utama ke Cloudinary
      const mainData = new FormData();
      mainData.append("file", file);
      mainData.append("upload_preset", UPLOAD_PRESET);

      const mainRes = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: "POST", body: mainData },
      );
      const mainFileData = await mainRes.json();
      const imageUrl = mainFileData.secure_url;

      if (!imageUrl) throw new Error("Cloudinary main upload failed");

      // 2. Upload Gambar Varian (Jika ada yang diunggah di setiap baris varian)
      const processedVariants = await Promise.all(
        variants.map(async (v) => {
          let variantImageUrl = "";

          if (v.imageFile) {
            const variantData = new FormData();
            variantData.append("file", v.imageFile);
            variantData.append("upload_preset", UPLOAD_PRESET);

            const variantRes = await fetch(
              `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
              { method: "POST", body: variantData },
            );
            const variantFileData = await variantRes.json();
            variantImageUrl = variantFileData.secure_url || "";
          }

          return {
            size: v.size,
            price: Number(v.price),
            stock: Number(v.stock),
            imageUrl: variantImageUrl, // Disimpan langsung di dalam JSON varian
          };
        }),
      );

      // 3. Simpan data ke Supabase Database
      const { error } = await supabase.from("products").insert([
        {
          name: formData.name,
          category: formData.category,
          description: formData.description,
          image_url: imageUrl,
          variants: processedVariants,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      toast.success(addConfig.toast.success, { id: toastId });

      // Reset form
      setFormData({ name: "", category: "Parfum", description: "" });
      setVariants([{ size: "10ml", price: "", stock: 0, imageFile: null }]);
      setFile(null);
      onProductAdded?.();
    } catch (e) {
      console.error("Error adding product to Supabase: ", e);
      toast.error(addConfig.toast.error, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.formContainer}>
      <h3 className={styles.formTitle}>{addConfig.title}</h3>

      <div className={styles.gridGroup}>
        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{addConfig.labels.image}</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files[0])}
            className={styles.fileInput}
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>{addConfig.labels.name}</label>
          <input
            placeholder={addConfig.placeholders.name}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className={styles.inputField}
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>
            {addConfig.labels.category}
          </label>
          <select
            value={formData.category}
            onChange={(e) =>
              setFormData({ ...formData, category: e.target.value })
            }
            className={styles.selectField}
          >
            {addConfig.categories.map((cat, idx) => (
              <option key={idx} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Varian Section dengan Gambar Per Varian */}
        <div className={styles.variantsBox}>
          <label className={styles.fieldLabel}>
            {addConfig.labels.variants}
          </label>
          {variants.map((v, index) => (
            <div key={index} className={styles.variantRow}>
              <input
                placeholder={addConfig.placeholders.size}
                value={v.size}
                onChange={(e) =>
                  handleVariantChange(index, "size", e.target.value)
                }
                className={styles.variantInput}
                required
              />
              <input
                type="number"
                placeholder={addConfig.placeholders.price}
                value={v.price}
                onChange={(e) =>
                  handleVariantChange(index, "price", e.target.value)
                }
                className={styles.variantInput}
                required
              />
              <input
                type="number"
                placeholder={addConfig.placeholders.stock}
                value={v.stock}
                onChange={(e) =>
                  handleVariantChange(index, "stock", e.target.value)
                }
                className={styles.variantInput}
                required
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  handleVariantFileChange(index, e.target.files[0])
                }
                className={styles.variantFileInput}
                title="Visual khusus varian ini"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addVariantField}
            className={styles.addSizeBtn}
          >
            {addConfig.buttons.addSize}
          </button>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.fieldLabel}>
            {addConfig.labels.description}
          </label>
          <textarea
            placeholder={addConfig.placeholders.description}
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            className={styles.textareaField}
          />
        </div>

        <button type="submit" disabled={uploading} className={styles.submitBtn}>
          {uploading ? addConfig.buttons.uploading : addConfig.buttons.submit}
        </button>
      </div>
    </form>
  );
}
