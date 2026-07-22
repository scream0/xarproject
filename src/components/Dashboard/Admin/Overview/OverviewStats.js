"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import styles from "./OverviewStats.module.css";

// Import Konfigurasi JSON
import overviewConfig from "@/data/ui/overviewConfig.json";

export default function OverviewStats() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    activeProducts: 0,
    lowStockCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // 1. Ambil data produk untuk menghitung jumlah produk & stok menipis pada varian
      const { data: products, error: productError } = await supabase
        .from("products")
        .select("*");

      if (productError) throw productError;

      let activeProductsCount = products?.length || 0;
      let lowStockCount = 0;

      products?.forEach((product) => {
        if (product.variants && Array.isArray(product.variants)) {
          product.variants.forEach((v) => {
            // Jika stok varian kurang dari atau sama dengan 5
            if (Number(v.stock) <= 5) {
              lowStockCount++;
            }
          });
        }
      });

      // 2. Ambil data transaksi untuk menghitung total pendapatan & jumlah pesanan
      let totalRevenue = 0;
      let totalOrders = 0;

      const { data: transactions, error: txError } = await supabase
        .from("transactions") // Sesuaikan jika nama tabel Anda berbeda (misal: "orders")
        .select("*");

      if (!txError && transactions) {
        totalOrders = transactions.length;
        totalRevenue = transactions.reduce((acc, curr) => {
          return acc + Number(curr.total_price || curr.amount || 0);
        }, 0);
      }

      setStats({
        totalRevenue,
        totalOrders,
        activeProducts: activeProductsCount,
        lowStockCount,
      });
    } catch (error) {
      console.error("Gagal mengambil data statistik overview:", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper format mata uang Rupiah
  const formatRupiah = (number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(number);
  };

  return (
    <div className={styles.statsContainer}>
      {/* Kartu 1: Total Pendapatan */}
      <div className={styles.statCard}>
        <span className={styles.statLabel}>{overviewConfig.cards.revenue}</span>
        <span className={styles.statValue}>
          {loading ? "..." : formatRupiah(stats.totalRevenue)}
        </span>
        <span className={styles.statDesc}>Akumulasi transaksi sukses</span>
      </div>

      {/* Kartu 2: Total Transaksi */}
      <div className={styles.statCard}>
        <span className={styles.statLabel}>{overviewConfig.cards.orders}</span>
        <span className={styles.statValue}>
          {loading ? "..." : stats.totalOrders}
        </span>
        <span className={styles.statDesc}>Total pesanan masuk</span>
      </div>

      {/* Kartu 3: Produk Aktif */}
      <div className={styles.statCard}>
        <span className={styles.statLabel}>
          {overviewConfig.cards.products}
        </span>
        <span className={styles.statValue}>
          {loading ? "..." : stats.activeProducts}
        </span>
        <span className={styles.statDesc}>Koleksi item di arsip</span>
      </div>

      {/* Kartu 4: Stok Menipis */}
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
          className={`${styles.statDesc} ${
            stats.lowStockCount > 0 ? styles.warningDesc : ""
          }`}
        >
          {stats.lowStockCount > 0
            ? "Varian perlu restock segera"
            : "Stok aman terkendali"}
        </span>
      </div>
    </div>
  );
}
