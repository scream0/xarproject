"use client";
import { useState } from "react";
import { db } from "@/lib/firebaseClient";
import { doc, updateDoc } from "firebase/firestore";

export default function EditProductModal({ product, onClose, onUpdate }) {
  const [formData, setFormData] = useState({
    name: product.name || "",
    description: product.description || "",
  });

  // Inisialisasi state varian dengan memastikan ada field 'stock'
  const [variants, setVariants] = useState(
    product.variants?.map((v) => ({
      size: v.size || "",
      price: v.price || "",
      stock: v.stock ?? 0, // Default ke 0 jika field stock belum ada
    })) || [{ size: "10ml", price: "", stock: 0 }]
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

    let imageUrl = product.imageUrl || "";

    try {
      if (file) {
        const data = new FormData();
        data.append("file", file);
        data.append("upload_preset", UPLOAD_PRESET);

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
          { method: "POST", body: data }
        );
        const fileData = await res.json();
        if (fileData.secure_url) {
          imageUrl = fileData.secure_url;
        } else {
          throw new Error("Gagal mendapatkan URL dari Cloudinary");
        }
      }

      // Update Firestore
      const docRef = doc(db, "products", product.id);
      await updateDoc(docRef, {
        name: formData.name,
        description: formData.description,
        imageUrl: imageUrl,
        // Pastikan price dan stock dikonversi ke Number agar perhitungan di sistem akurat
        variants: variants.map((v) => ({ 
            ...v, 
            price: Number(v.price), 
            stock: Number(v.stock) 
        })),
      });

      alert("Produk berhasil diupdate!");
      onUpdate();
      onClose();
    } catch (e) {
      console.error("Gagal update:", e);
      alert("Gagal memperbarui produk: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <form onSubmit={handleUpdate} style={modalStyle}>
        <h3>Edit Produk</h3>

        <div style={{ marginBottom: "10px" }}>
          <label style={{ fontSize: "0.8rem", color: "#aaa" }}>Current Image</label>
          <br />
          <img src={product.imageUrl} alt="preview" width="80" style={{ borderRadius: "4px", marginTop: "5px" }} />
        </div>

        <label style={{ fontSize: "0.8rem", color: "#aaa" }}>Change Image (Optional)</label>
        <input type="file" onChange={(e) => setFile(e.target.files[0])} style={inputStyle} />

        <input
          placeholder="Product Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          style={inputStyle}
        />

        <div style={{ margin: "10px 0" }}>
          <label style={{ fontSize: "0.8rem", color: "#aaa" }}>Variants (Size, Price, Stock)</label>
          {variants.map((v, i) => (
            <div key={i} style={{ display: "flex", gap: "5px", marginBottom: "5px" }}>
              <input
                placeholder="Size"
                value={v.size}
                onChange={(e) => handleVariantChange(i, "size", e.target.value)}
                style={{ ...inputStyle, margin: 0 }}
              />
              <input
                type="number"
                placeholder="Price"
                value={v.price}
                onChange={(e) => handleVariantChange(i, "price", e.target.value)}
                style={{ ...inputStyle, margin: 0 }}
              />
              <input
                type="number"
                placeholder="Stock"
                value={v.stock}
                onChange={(e) => handleVariantChange(i, "stock", e.target.value)}
                style={{ ...inputStyle, margin: 0 }}
              />
            </div>
          ))}
          <button type="button" onClick={addVariantField} style={addBtnStyle}>
            + Add Size
          </button>
        </div>

        <textarea
          placeholder="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          style={{ ...inputStyle, minHeight: "80px" }}
        />

        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button type="submit" disabled={uploading} style={saveBtnStyle}>
            {uploading ? "SAVING..." : "SAVE CHANGES"}
          </button>
          <button type="button" onClick={onClose} style={cancelBtnStyle}>
            CANCEL
          </button>
        </div>
      </form>
    </div>
  );
}

// Styling tetap sama
const overlayStyle = { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const modalStyle = { background: "#1a1a1a", padding: "20px", borderRadius: "8px", width: "450px", color: "#fff" }; // Lebar sedikit ditambah untuk menampung input stock
const inputStyle = { width: "100%", margin: "10px 0", padding: "8px", background: "#333", color: "#fff", border: "none", borderRadius: "4px" };
const addBtnStyle = { background: "#333", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "0.7rem" };
const saveBtnStyle = { background: "#fff", padding: "10px", flex: 1, cursor: "pointer", fontWeight: "bold", border: "none", borderRadius: "4px" };
const cancelBtnStyle = { background: "#333", color: "#fff", padding: "10px", flex: 1, cursor: "pointer", border: "none", borderRadius: "4px" };