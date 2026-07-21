"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient"; // Sesuaikan jalur file client Supabase Anda

export default function AddProductForm({ onProductAdded }) {
  const [formData, setFormData] = useState({
    name: "",
    category: "Parfum",
    description: "",
  });

  // State awal varian menyertakan stock
  const [variants, setVariants] = useState([
    { size: "10ml", price: "", stock: 0 },
  ]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const CLOUD_NAME = "qs59fb4k";
  const UPLOAD_PRESET = "xarProject";

  const addVariantField = () => {
    setVariants([...variants, { size: "", price: "", stock: 0 }]);
  };

  const handleVariantChange = (index, field, value) => {
    const newVariants = [...variants];
    newVariants[index][field] = value;
    setVariants(newVariants);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      alert("Tolong pilih gambar produk terlebih dahulu!");
      return;
    }

    try {
      setUploading(true);

      // 1. Upload ke Cloudinary
      const data = new FormData();
      data.append("file", file);
      data.append("upload_preset", UPLOAD_PRESET);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: "POST", body: data },
      );
      const fileData = await res.json();
      const imageUrl = fileData.secure_url;

      // 2. Simpan data ke Supabase Database
      // Pastikan nama tabel di Supabase Anda adalah "products"
      // dan kolom variants bertipe json/jsonb
      const { error } = await supabase.from("products").insert([
        {
          name: formData.name,
          category: formData.category,
          description: formData.description,
          image_url: imageUrl, // Sesuaikan dengan nama kolom di Supabase (imageUrl atau image_url)
          variants: variants.map((v) => ({
            ...v,
            price: Number(v.price),
            stock: Number(v.stock),
          })),
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      alert("Produk berhasil ditambahkan ke Supabase!");

      // Reset form
      setFormData({ name: "", category: "Parfum", description: "" });
      setVariants([{ size: "10ml", price: "", stock: 0 }]);
      setFile(null);
      setUploading(false);
      onProductAdded?.();
    } catch (e) {
      console.error("Error adding product to Supabase: ", e);
      setUploading(false);
      alert("Gagal menambahkan produk.");
    }
  };

  return (
    <form onSubmit={handleSubmit} style={formContainerStyle}>
      <h3 style={{ color: "#fff" }}>Add New Product (Supabase)</h3>

      <div style={{ display: "grid", gap: "15px" }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files[0])}
          style={{
            color: "#fff",
            padding: "10px",
            border: "1px dashed #444",
            borderRadius: "4px",
          }}
        />

        <input
          placeholder="Product Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          style={inputStyle}
        />

        <select
          value={formData.category}
          onChange={(e) =>
            setFormData({ ...formData, category: e.target.value })
          }
          style={inputStyle}
        >
          <option value="Parfum">Parfum</option>
          <option value="Kopi">Kopi</option>
        </select>

        {/* Varian Section */}
        <div
          style={{
            border: "1px solid #333",
            padding: "10px",
            borderRadius: "4px",
          }}
        >
          <label
            style={{
              color: "#aaa",
              fontSize: "0.8rem",
              marginBottom: "5px",
              display: "block",
            }}
          >
            Variants (Size, Price, Stock)
          </label>
          {variants.map((v, index) => (
            <div
              key={index}
              style={{ display: "flex", gap: "5px", marginBottom: "5px" }}
            >
              <input
                placeholder="Size (e.g. 10ml)"
                value={v.size}
                onChange={(e) =>
                  handleVariantChange(index, "size", e.target.value)
                }
                style={inputStyle}
              />
              <input
                type="number"
                placeholder="Price"
                value={v.price}
                onChange={(e) =>
                  handleVariantChange(index, "price", e.target.value)
                }
                style={inputStyle}
              />
              <input
                type="number"
                placeholder="Stock"
                value={v.stock}
                onChange={
                  (e) => handleVariantChange(index, "stock", e.target.value) // Fixed typo here if any, standard handler:
                }
                // Jika handler lama menggunakan string langsung:
                // onChange={(e) => handleVariantChange(index, "stock", e.target.value)}
                style={inputStyle}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addVariantField}
            style={{
              background: "#333",
              color: "#fff",
              border: "none",
              padding: "5px 10px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.7rem",
            }}
          >
            + Add Size
          </button>
        </div>

        <textarea
          placeholder="Description"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          style={inputStyle}
        />

        <button
          type="submit"
          disabled={uploading}
          style={{ ...btnStyle, opacity: uploading ? 0.5 : 1 }}
        >
          {uploading ? "UPLOADING..." : "ADD TO ARCHIVE"}
        </button>
      </div>
    </form>
  );
}

// Styles
const inputStyle = {
  background: "#1a1a1a",
  border: "1px solid #333",
  padding: "10px",
  color: "#fff",
  borderRadius: "4px",
  width: "100%",
};
const btnStyle = {
  padding: "12px",
  background: "#fff",
  color: "#000",
  border: "none",
  cursor: "pointer",
  fontWeight: "bold",
  textTransform: "uppercase",
};
const formContainerStyle = {
  background: "#111",
  padding: "20px",
  borderRadius: "8px",
  marginBottom: "30px",
};
