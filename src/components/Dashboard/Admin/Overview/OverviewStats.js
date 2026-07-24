"use client";
import { useState, useEffect } from "react";
import styles from "./OverviewStats.module.css";
import toast from "react-hot-toast";
import overviewConfig from "@/data/ui/overviewConfig.json";

export default function OverviewStats() {
  // State for data and loading
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    activeProducts: 0,
    lowStockCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [productsRes, ordersRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/orders"),
      ]);
      const productsResult = await productsRes.json();
      const ordersResult = await ordersRes.json();

      const products = productsResult.data || productsResult.products || [];
      const transactions = ordersResult.data || ordersResult.orders || [];

      const activeProductsCount = products.length;
      const lowStockCount = products.reduce((count, product) => {
        return (
          count +
          (product.variants?.filter((v) => Number(v.stock) <= 5).length || 0)
        );
      }, 0);
      const totalRevenue = transactions.reduce((total, curr) => {
        if (
          ["success", "processing", "shipping", "completed"].includes(
            curr.status,
          )
        ) {
          return total + Number(curr.amount || curr.price || 0);
        }
        return total;
      }, 0);

      setStats({
        totalRevenue,
        totalOrders: transactions.length,
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

  const formatRupiah = (number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(number);

  return (
    <div className={styles.statsContainer}>
      <div className={styles.cardsGrid}>
        {/* Stat Cards */}
        <div className={styles.statCard}>
          <span className={styles.statLabel}>{overviewConfig.cards.revenue}</span>
          <span className={styles.statValue}>
            {loading ? "..." : formatRupiah(stats.totalRevenue)}
          </span>
          <span className={styles.statDesc}>{overviewConfig.cardDescriptions.revenue}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>{overviewConfig.cards.orders}</span>
          <span className={styles.statValue}>
            {loading ? "..." : stats.totalOrders}
          </span>
          <span className={styles.statDesc}>{overviewConfig.cardDescriptions.orders}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>{overviewConfig.cards.products}</span>
          <span className={styles.statValue}>
            {loading ? "..." : stats.activeProducts}
          </span>
          <span className={styles.statDesc}>{overviewConfig.cardDescriptions.products}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>{overviewConfig.cards.lowStock}</span>
          <span className={`${styles.statValue} ${stats.lowStockCount > 0 ? styles.warningValue : ""}`}>
            {loading ? "..." : stats.lowStockCount}
          </span>
          <span className={`${styles.statDesc} ${stats.lowStockCount > 0 ? styles.warningDesc : ""}`}>
            {stats.lowStockCount > 0
              ? overviewConfig.cardDescriptions.lowStockWarning
              : overviewConfig.cardDescriptions.lowStockOk}
          </span>
        </div>
      </div>
    </div>
  );
}
