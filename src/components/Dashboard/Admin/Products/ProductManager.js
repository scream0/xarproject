"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import AddProductForm from "./AddProductForm";
import EditProductModal from "./EditProductModal";
import styles from "./ProductManager.module.css";

// Import Konfigurasi JSON
import pmConfig from "@/data/ui/productManagerConfig.json";

export default function ProductManager() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedData = data.map((item) => ({
        ...item,
        imageUrl: item.image_url || item.imageUrl,
        imagePublicId: item.image_public_id || item.imagePublicId,
      }));

      setProducts(formattedData);
    } catch (error) {
      console.error("Gagal memuat produk dari Supabase:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDelete = async (item) => {
    if (confirm(pmConfig.confirmDelete)) {
      try {
        // 1. Hapus gambar utama dari Cloudinary jika ada publicId-nya
        if (item.imagePublicId) {
          await fetch("/api/cloudinary", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicId: item.imagePublicId }),
          });
        }

        // 2. Hapus gambar varian dari Cloudinary jika ada publicId-nya
        if (item.variants && Array.isArray(item.variants)) {
          for (const v of item.variants) {
            if (v.imagePublicId) {
              await fetch("/api/cloudinary", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ publicId: v.imagePublicId }),
              });
            }
          }
        }

        // 3. Hapus data produk dari Supabase
        const { error } = await supabase
          .from("products")
          .delete()
          .eq("id", item.id);
        if (error) throw error;

        fetchProducts();
      } catch (error) {
        console.error("Gagal menghapus produk:", error);
        alert("Gagal menghapus produk.");
      }
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className={styles.container}>
      {/* BAGIAN ATAS: DAFTAR PRODUK (INVENTORY) DENGAN MIN-HEIGHT & SCROLL */}
      <div className={styles.headerRow}>
        <h2 className={styles.title}>{pmConfig.title}</h2>
        <input
          type="text"
          placeholder={pmConfig.searchPlaceholder}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      <div className={styles.inventorySection}>
        {loading ? (
          <div className={styles.loadingState}>{pmConfig.loadingText}</div>
        ) : filteredProducts.length === 0 ? (
          <div className={styles.emptyState}>{pmConfig.emptyText}</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{pmConfig.tableHeaders.image}</th>
                <th>{pmConfig.tableHeaders.name}</th>
                <th>{pmConfig.tableHeaders.variants}</th>
                <th>{pmConfig.tableHeaders.status}</th>
                <th>{pmConfig.tableHeaders.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((item) => {
                const isReady = item.variants?.some((v) => (v.stock ?? 0) > 0);

                return (
                  <tr key={item.id}>
                    <td>
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          width="45"
                          height="45"
                          className={styles.productImage}
                        />
                      )}
                    </td>
                    <td style={{ fontWeight: 500 }}>{item.name}</td>
                    <td>
                      {item.variants?.map((v, i) => (
                        <div key={i} className={styles.variantItem}>
                          {v.size} : Rp{" "}
                          {Number(v.price).toLocaleString("id-ID")}
                          <span className={styles.stockInfo}>
                            {" "}
                            (Stok: {v.stock ?? 0})
                          </span>
                        </div>
                      ))}
                    </td>
                    <td>
                      <span
                        className={
                          isReady ? styles.statusReady : styles.statusSoldOut
                        }
                      >
                        {isReady
                          ? pmConfig.statusReady
                          : pmConfig.statusSoldOut}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => setEditingProduct(item)}
                        className={styles.editBtn}
                      >
                        {pmConfig.actions.edit}
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className={styles.deleteBtn}
                      >
                        {pmConfig.actions.delete}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onUpdate={() => {
            setEditingProduct(null);
            fetchProducts();
          }}
        />
      )}

      {/* BAGIAN BAWAH: FORM TAMBAH PRODUK */}
      <div className={styles.formSection}>
        <AddProductForm onProductAdded={fetchProducts} />
      </div>
    </div>
  );
}
