"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebaseClient";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import AddProductForm from "./AddProductForm";
import EditProductModal from "./EditProductModal";

export default function ProductManager() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, "products"));
      setProducts(
        querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      );
    } catch (error) {
      console.error("Gagal memuat produk:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDelete = async (id) => {
    if (confirm("Hapus produk ini?")) {
      await deleteDoc(doc(db, "products", id));
      fetchProducts();
    }
  };

  return (
    <div style={{ color: "#fff", padding: "20px" }}>
      <h2>Inventory Management</h2>
      <input
        type="text"
        placeholder="Cari parfum/produk..."
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          background: "#222",
          color: "#fff",
          padding: "10px",
          marginBottom: "20px",
          width: "300px",
          border: "1px solid #444",
        }}
      />

      <AddProductForm onProductAdded={fetchProducts} />

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

      {loading ? (
        <p>Loading Inventory...</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "20px",
          }}
        >
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #333" }}>
              <th style={{ padding: "10px" }}>Gambar</th>
              <th style={{ padding: "10px" }}>Nama</th>
              <th style={{ padding: "10px" }}>Varian (Size | Price | Stock)</th>
              <th style={{ padding: "10px" }}>Status</th>
              <th style={{ padding: "10px" }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {products
              .filter((p) =>
                p.name.toLowerCase().includes(searchTerm.toLowerCase()),
              )
              .map((item) => {
                // LOGIKA: Produk Ready jika minimal 1 varian punya stok > 0
                const isReady = item.variants?.some((v) => (v.stock ?? 0) > 0);

                return (
                  <tr key={item.id} style={{ borderBottom: "1px solid #222" }}>
                    <td style={{ padding: "10px" }}>
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          width="50"
                          style={{ borderRadius: "4px" }}
                        />
                      )}
                    </td>
                    <td style={{ padding: "10px" }}>{item.name}</td>
                    <td style={{ padding: "10px" }}>
                      {item.variants?.map((v, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: "0.8rem",
                            marginBottom: "4px",
                            borderBottom: "1px solid #333",
                          }}
                        >
                          {v.size}: Rp {Number(v.price).toLocaleString()}
                          <span style={{ color: "#aaa" }}>
                            {" "}
                            (Stok: {v.stock ?? 0})
                          </span>
                        </div>
                      ))}
                    </td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ color: isReady ? "#4caf50" : "#f44336" }}>
                        {isReady ? "Ready" : "Sold Out"}
                      </span>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <button
                        onClick={() => setEditingProduct(item)}
                        style={{
                          cursor: "pointer",
                          marginRight: "10px",
                          color: "#ffa500",
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        style={{ cursor: "pointer", color: "#ff5555" }}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      )}
    </div>
  );
}
