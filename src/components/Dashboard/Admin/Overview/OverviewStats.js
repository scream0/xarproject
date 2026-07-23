"use client";
import { useState, useEffect } from "react";
import styles from "./OverviewStats.module.css";
import toast from "react-hot-toast";

// Import Konfigurasi JSON
import overviewConfig from "@/data/ui/overviewConfig.json";

export default function OverviewStats() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    activeProducts: 0,
    lowStockCount: 0,
  });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Panggil produk dan seluruh pesanan secara paralel (tanpa userId agar mengambil semua data admin)
      const [productsRes, ordersRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/orders"),
      ]);

      const productsResult = await productsRes.json();
      const ordersResult = await ordersRes.json();

      const products = Array.isArray(productsResult)
        ? productsResult
        : productsResult.data || productsResult.products || [];

      const transactions = Array.isArray(ordersResult)
        ? ordersResult
        : ordersResult.data || ordersResult.orders || [];

      setOrders(transactions);

      let activeProductsCount = products.length;
      let lowStockCount = 0;

      products.forEach((product) => {
        if (product.variants && Array.isArray(product.variants)) {
          product.variants.forEach((v) => {
            if (Number(v.stock) <= 5) {
              lowStockCount++;
            }
          });
        }
      });

      let totalRevenue = 0;
      let totalOrders = transactions.length;

      transactions.forEach((curr) => {
        // Hitung pendapatan hanya dari pesanan yang sukses/dibayar
        if (
          curr.status === "success" ||
          curr.status === "processing" ||
          curr.status === "shipping" ||
          curr.status === "completed"
        ) {
          totalRevenue += Number(curr.amount || curr.price || 0);
        }
      });

      setStats({
        totalRevenue,
        totalOrders,
        activeProducts: activeProductsCount,
        lowStockCount,
      });
    } catch (error) {
      console.error("Gagal mengambil data dashboard:", error);
      toast.error("Gagal memuat data dashboard");
    } finally {
      setLoading(false);
    }
  };

  // Fungsi bagi Seller untuk Mengonfirmasi / Mengubah Status Pesanan
  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      setUpdatingId(orderId);
      const res = await fetch("/api/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: newStatus }),
      });

      const result = await res.json();
      if (!res.ok)
        throw new Error(result.error || "Gagal memperbarui status pesanan");

      toast.success(`Pesanan ${orderId} berhasil diubah ke: ${newStatus}`);

      // Perbarui data lokal secara instan tanpa reload halaman
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId || o.orderId === orderId
            ? { ...o, status: newStatus }
            : o,
        ),
      );
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const formatRupiah = (number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(number);
  };

  const getBadgeClass = (status) => {
    switch (status) {
      case "success":
        return styles.badgeSuccess;
      case "processing":
        return styles.badgeProcessing;
      case "shipping":
        return styles.badgeShipping;
      case "completed":
        return styles.badgeCompleted;
      default:
        return styles.badgePending;
    }
  };

  return (
    <div className={styles.statsContainer}>
      {/* 4 Kartu Metrik Statistik Utama */}
      <div className={styles.cardsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>
            {overviewConfig.cards.revenue}
          </span>
          <span className={styles.statValue}>
            {loading ? "..." : formatRupiah(stats.totalRevenue)}
          </span>
          <span className={styles.statDesc}>Akumulasi transaksi sukses</span>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>
            {overviewConfig.cards.orders}
          </span>
          <span className={styles.statValue}>
            {loading ? "..." : stats.totalOrders}
          </span>
          <span className={styles.statDesc}>Total pesanan masuk</span>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>
            {overviewConfig.cards.products}
          </span>
          <span className={styles.statValue}>
            {loading ? "..." : stats.activeProducts}
          </span>
          <span className={styles.statDesc}>Koleksi item di arsip</span>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>
            {overviewConfig.cards.lowStock}
          </span>
          <span
            className={styles.statValue}
            style={{ color: stats.lowStockCount > 0 ? "#ef4444" : "#fff" }}
          >
            {loading ? "..." : stats.lowStockCount}
          </span>
          <span
            className={`${styles.statDesc} ${stats.lowStockCount > 0 ? styles.warningDesc : ""}`}
          >
            {stats.lowStockCount > 0
              ? "Varian perlu restock segera"
              : "Stok aman terkendali"}
          </span>
        </div>
      </div>

      {/* Bagian Tabel Daftar & Konfirmasi Pesanan untuk Seller */}
      <div className={styles.ordersSection}>
        <h3 className={styles.sectionTitle}>
          Kelola & Konfirmasi Pesanan Masuk
        </h3>
        {loading ? (
          <p style={{ color: "#888", fontSize: "14px" }}>
            Memuat daftar pesanan...
          </p>
        ) : orders.length === 0 ? (
          <p style={{ color: "#888", fontSize: "14px" }}>
            Belum ada pesanan masuk.
          </p>
        ) : (
          <div className={styles.tableResponsive}>
            <table className={styles.ordersTable}>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Pemesan</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Aksi Seller</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const currentId = order.orderId || order.id;
                  const customerName =
                    order.customerName ||
                    order.shipping_address?.recipientName ||
                    "Customer";
                  const orderTotal = Number(order.amount || order.price || 0);

                  return (
                    <tr key={currentId}>
                      <td style={{ fontWeight: 600 }}>{currentId}</td>
                      <td>{customerName}</td>
                      <td>{formatRupiah(orderTotal)}</td>
                      <td>
                        <span
                          className={`${styles.badge} ${getBadgeClass(order.status)}`}
                        >
                          {order.status || "pending"}
                        </span>
                      </td>
                      <td>
                        {order.status === "success" && (
                          <button
                            className={styles.actionBtn}
                            onClick={() =>
                              handleUpdateStatus(currentId, "processing")
                            }
                            disabled={updatingId === currentId}
                          >
                            {updatingId === currentId
                              ? "Memproses..."
                              : "Proses Pesanan"}
                          </button>
                        )}
                        {order.status === "processing" && (
                          <button
                            className={styles.actionBtn}
                            onClick={() =>
                              handleUpdateStatus(currentId, "shipping")
                            }
                            disabled={updatingId === currentId}
                          >
                            {updatingId === currentId
                              ? "Mengirim..."
                              : "Kirim Barang"}
                          </button>
                        )}
                        {order.status === "shipping" && (
                          <button
                            className={styles.actionBtn}
                            onClick={() =>
                              handleUpdateStatus(currentId, "completed")
                            }
                            disabled={updatingId === currentId}
                          >
                            {updatingId === currentId
                              ? "Menyelesaikan..."
                              : "Selesaikan"}
                          </button>
                        )}
                        {order.status === "completed" && (
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#4ade80",
                              fontWeight: 500,
                            }}
                          >
                            Selesai
                          </span>
                        )}
                        {order.status === "pending" && (
                          <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                            Belum Bayar
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
