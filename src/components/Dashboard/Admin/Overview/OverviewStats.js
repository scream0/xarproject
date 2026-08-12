"use client";
import { useState, useEffect } from "react";
import styles from "./OverviewStats.module.css";
import toast from "react-hot-toast";
import overviewConfig from "@/data/ui/overviewConfig.json";
import { StatsSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";
import { calculateDashboardStats } from "@/utils/dashboardSummary";

export default function OverviewStats() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    activeProducts: 0,
    lowStockCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/products?limit=200");
      const productsResult = await res.json();
      const products = (productsResult.data || productsResult.products || []).filter(Boolean);

      const ordersRes = await fetch("/api/orders?limit=200");
      const ordersResult = await ordersRes.json();
      const orders = (ordersResult.data || ordersResult.orders || []).filter(Boolean);

      const summary = calculateDashboardStats({ products, orders });
      setStats(summary);
    } catch (error) {
      console.error("Gagal mengambil data dashboard:", error);
      toast.error("Gagal memuat data dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDashboardData();
  }, []);

  const formatRupiah = (number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(number);

  if (loading) {
    return (
      <div className={styles.statsContainer}>
        <StatsSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className={styles.statsContainer}>
      {/* Stat Cards Grid */}
      <div className={styles.cardsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} aria-hidden="true">
            ↗
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>
              {overviewConfig.cards.revenue}
            </span>
            <span className={styles.statValue}>
              {loading ? "..." : formatRupiah(stats.totalRevenue)}
            </span>
            <span className={styles.statDesc}>
              {overviewConfig.cardDescriptions.revenue}
            </span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} aria-hidden="true">
            ⌁
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>
              {overviewConfig.cards.orders}
            </span>
            <span className={styles.statValue}>
              {loading ? "..." : stats.totalOrders}
            </span>
            <span className={styles.statDesc}>
              {overviewConfig.cardDescriptions.orders}
            </span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} aria-hidden="true">
            ◌
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>
              {overviewConfig.cards.products}
            </span>
            <span className={styles.statValue}>
              {loading ? "..." : stats.activeProducts}
            </span>
            <span className={styles.statDesc}>
              {overviewConfig.cardDescriptions.products}
            </span>
          </div>
        </div>
        <div className={`${styles.statCard} ${stats.lowStockCount > 0 ? styles.statCardWarning : ""}`}>
          <div className={styles.statIcon} aria-hidden="true">
            !
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>
              {overviewConfig.cards.lowStock}
            </span>
            <span
              className={`${styles.statValue} ${stats.lowStockCount > 0 ? styles.warningValue : ""}`}
            >
              {loading ? "..." : stats.lowStockCount}
            </span>
            <span
              className={`${styles.statDesc} ${stats.lowStockCount > 0 ? styles.warningDesc : ""}`}
            >
              {stats.lowStockCount > 0
                ? overviewConfig.cardDescriptions.lowStockWarning
                : overviewConfig.cardDescriptions.lowStockOk}
            </span>
          </div>
        </div>
      </div>

      {/* Tabel "Kelola & Konfirmasi Pesanan" sudah ditangani oleh
          komponen TransactionTable (lebih lengkap: ada modal nomor resi
          & alur status pending -> success -> processing -> shipping -> completed),
          jadi tidak dirender dobel di sini. */}
    </div>
  );
}
