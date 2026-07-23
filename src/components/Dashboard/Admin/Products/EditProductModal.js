"use client";
import { useState } from "react";
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
      imagePublicId: v.imagePublicId || "",
      imageFile: null,
    })) || [
      {
        size: "10ml",
        price: "",
        stock: 0,
        imageUrl: "",
        imagePublicId: "",
        imageFile: null,
      },
    ],
  );

  const [file, setFile] = useState(null);

  // State khusus untuk mengatur URL pratinjau gambar utama secara reaktif
  const [previewUrl, setPreviewUrl] = useState(
    product.image_url || product.imageUrl || "",
  );
  const [mainPhotoPublicId, setMainPhotoPublicId] = useState(
    product.image_public_id || product.imagePublicId || "",
  );

  const [imageRemoved, setImageRemoved] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    newVariants[index].imagePublicId = "";
    newVariants[index].imageFile = null;
    setVariants(newVariants);
  };

  // Handler saat memilih file gambar utama dari PC
  const handleMainFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setImageRemoved(false);
    }
  };

  // Handler menghapus gambar utama
  const removeMainImage = () => {
    setFile(null);
    setPreviewUrl("");
    setMainPhotoPublicId("");
    setImageRemoved(true);
  };

  // Handler membatalkan penghapusan
  const cancelRemoveMainImage = () => {
    setImageRemoved(false);
    setPreviewUrl(product.image_url || product.imageUrl || "");
    setMainPhotoPublicId(
      product.image_public_id || product.imagePublicId || "",
    );
  };

  const addVariantField = () => {
    setVariants([
      ...variants,
      {
        size: "",
        price: "",
        stock: 0,
        imageUrl: "",
        imagePublicId: "",
        imageFile: null,
      },
    ]);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const toastId = toast.loading(editConfig.buttons.saving);
    setUploading(true);

    let imageUrl = imageRemoved
      ? ""
      : product.imageUrl || product.image_url || "";
    let imagePublicId = imageRemoved
      ? ""
      : product.image_public_id || product.imagePublicId || "";

    try {
      // 1. Upload Gambar Utama via API Route /api/cloudinary jika ada file baru
      if (file) {
        const data = new FormData();
        data.append("file", file);
        data.append("userId", `product_${product.id}`);
        if (mainPhotoPublicId) {
          data.append("oldPublicId", mainPhotoPublicId);
        } else if (imageUrl) {
          data.append("oldUrl", imageUrl);
        }

        const res = await fetch("/api/cloudinary", {
          method: "POST",
          body: data,
        });

        const responseText = await res.text();
        let fileData;
        try {
          fileData = JSON.parse(responseText);
        } catch {
          throw new Error(responseText || editConfig.alerts.failedCloudinary);
        }

        if (res.ok && fileData.secure_url) {
          imageUrl = fileData.secure_url;
          imagePublicId = fileData.public_id;
        } else {
          throw new Error(fileData.error || editConfig.alerts.failedCloudinary);
        }
      } else if (imageRemoved) {
        // Jika user menghapus gambar utama, hapus dari Cloudinary via endpoint DELETE
        if (mainPhotoPublicId || imageUrl) {
          await fetch("/api/cloudinary", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              publicId: mainPhotoPublicId || undefined,
            }),
          });
        }
      }

    // 2. Proses Varian Produk (Upload gambar varian jika ada file baru)
      const processedVariants = await Promise.all(
        variants.map(async (v, index) => {
          let currentVariantImageUrl = v.imageUrl;
          let currentVariantPublicId = v.imagePublicId;

          if (v.imageFile) {
            const variantData = new FormData();
            variantData.append("file", v.imageFile);
            variantData.append("userId", `product_${product.id}_var_${index}`);
            if (v.imagePublicId) {
              variantData.append("oldPublicId", v.imagePublicId);
            } else if (v.imageUrl) {
              variantData.append("oldUrl", v.imageUrl);
            }

            const variantRes = await fetch("/api/cloudinary", {
              method: "POST",
              body: variantData,
            });

            const variantResponseText = await variantRes.text();
            let variantFileData;
            try {
              variantFileData = JSON.parse(variantResponseText);
            } catch {
              throw new Error(
                variantResponseText || "Gagal upload gambar varian.",
              );
            }

            if (variantRes.ok && variantFileData.secure_url) {
              currentVariantImageUrl = variantFileData.secure_url;
              currentVariantPublicId = variantFileData.public_id;
            }
          }

          const parsedStock = Number(v.stock) || 0;

          return {
            size: v.size,
            price: Number(v.price) || 0,
            stock: parsedStock,   // Format Inggris
            stok: parsedStock,    // Format Indonesia (cadangan agar tidak undefined)
            imageUrl: currentVariantImageUrl,
            image_url: currentVariantImageUrl,
            imagePublicId: currentVariantPublicId,
          };
        }),
      );

      // 3. Simpan perubahan ke API Route `/api/products` (Supabase backend)
      const res = await fetch("/api/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          name: formData.name,
          description: formData.description,
          imageUrl: imageUrl,
          imagePublicId: imagePublicId,
          variants: processedVariants,
        }),
      });

      const result = await res.json();
      if (!res.ok)
        throw new Error(result.error || editConfig.alerts.failedUpdate);

      toast.success(editConfig.alerts.success, { id: toastId });
      onUpdate?.();
      onClose?.();
    } catch (e) {
      console.error("Gagal update produk:", e);
      toast.error(editConfig.alerts.failedUpdate + (e.message || ""), {
        id: toastId,
      });
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
          <div className={styles.imagePreviewRow}>
            {previewUrl && !imageRemoved ? (
              <img
                src={previewUrl}
                alt="preview"
                className={styles.previewImage}
                onError={(e) => {
                  e.target.src = "/assets/placeholder.jpg";
                }}
              />
            ) : (
              <div className={styles.noImageBox}>
                {editConfig.labels.noImage}
              </div>
            )}

            {(file ||
              (!imageRemoved && (product.image_url || product.imageUrl))) && (
              <button
                type="button"
                onClick={removeMainImage}
                className={styles.cancelImageBtn}
              >
                {editConfig.buttons.removeMainImage}
              </button>
            )}

            {imageRemoved && !file && (
              <button
                type="button"
                onClick={cancelRemoveMainImage}
                className={styles.cancelImageBtn}
              >
                {editConfig.buttons.cancelRemoveMain}
              </button>
            )}
          </div>
        </div>

        <span className={styles.sectionLabel}>
          {editConfig.labels.changeImage}
        </span>
        <div className={styles.customFileWrapper}>
          <input
            type="file"
            accept="image/*"
            onChange={handleMainFileChange}
            className={styles.fileInputHidden}
          />
          <div className={styles.fileUploadCustomBtn}>
            <span>{editConfig.buttons.chooseFileMain}</span>
            <span className={styles.fileChosenText}>
              {file ? file.name : editConfig.buttons.noFile}
            </span>
          </div>
        </div>

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
              <div className={styles.variantFileWrapper}>
                {(v.imageUrl || v.imageFile) && (
                  <div className={styles.variantFileInner}>
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
                      className={styles.removeVariantImgBtn}
                      title="Hapus gambar varian"
                    >
                      {editConfig.buttons.removeVariantImage}
                    </button>
                  </div>
                )}
                <div className={styles.variantCustomFileWrapper}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      handleVariantFileChange(i, e.target.files[0])
                    }
                    className={styles.variantFileInputHidden}
                    title="Replace gambar varian"
                  />
                  <div className={styles.variantFileCustomBtn}>
                    <span>{editConfig.buttons.chooseFileVariant}</span>
                    <span className={styles.variantFileChosen}>
                      {v.imageFile
                        ? v.imageFile.name
                        : editConfig.buttons.chooseShort}
                    </span>
                  </div>
                </div>
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
