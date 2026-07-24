"use client";
import { useState, useEffect, useMemo } from "react";
import styles from "./OverviewStats.module.css";
import toast from "react-hot-toast";
import overviewConfig from "@/data/ui/overviewConfig.json";

const ITEMS_PER_PAGE = 5;

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

  // State pencarian, filter status, dan pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

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

      const products = (
        productsResult.data ||
        productsResult.products ||
        []
      ).filter(Boolean);

      // filter(Boolean) membuang elemen null/undefined agar .map() di tabel
      // tidak pernah crash walau ada data yang rusak/kosong dari API
      const transactions = (
        ordersResult.data ||
        ordersResult.orders ||
        []
      ).filter(Boolean);

      setOrders(transactions);

      const activeProductsCount = products.length;
      const lowStockCount = products.reduce((count, product) => {
        return (
          count +
          (product.variants?.filter((v) => Number(v.stock ?? v.stok ?? 0) <= 5)
            .length || 0)
        );
      }, 0);

      const totalRevenue = transactions.reduce((total, curr) => {
        const status = (curr.status || "").toLowerCase();
        if (
          [
            "success",
            "processing",
            "shipping",
            "completed",
            "settlement",
          ].includes(status)
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

  // Fungsi untuk konfirmasi dan memperbarui status pesanan masuk
  const handleUpdateStatus = async (orderId, newStatus) => {
    const toastId = toast.loading(`Mengubah status ke ${newStatus}...`);
    setUpdatingId(orderId);
    try {
      const res = await fetch("/api/orders/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: newStatus }),
      });

      const result = await res.json();
      if (!res.ok)
        throw new Error(result.error || "Gagal memperbarui status pesanan");

      toast.success(
        `Pesanan #${String(orderId).substring(0, 8)} berhasil diubah menjadi ${newStatus}!`,
        {
          id: toastId,
        },
      );

      fetchDashboardData();
    } catch (error) {
      console.error("Error update status:", error);
      toast.error(error.message || "Gagal memperbarui status", { id: toastId });
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter & Pencarian Pesanan
  const filteredOrders = useMemo(() => {
    let result = [...orders].filter(Boolean);

    if (statusFilter !== "all") {
      result = result.filter(
        (o) =>
          (o.status || "pending").toLowerCase() === statusFilter.toLowerCase(),
      );
    }

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (o) =>
          String(o.orderId || o.id)
            .toLowerCase()
            .includes(q) ||
          String(o.customerName || o.customerEmail || "")
            .toLowerCase()
            .includes(q),
      );
    }

    return result;
  }, [orders, searchQuery, statusFilter]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE).filter(Boolean);
  }, [filteredOrders, currentPage]);

  const formatRupiah = (number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(number);

  const getBadgeClass = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "success" || s === "completed" || s === "settlement")
      return styles.badgeSuccess;
    if (s === "processing") return styles.badgeProcessing;
    if (s === "shipping") return styles.badgeShipping;
    return styles.badgePending;
  };

  return (
    <div className={styles.statsContainer}>
      {/* 1. Stat Cards Grid */}
      <div className={styles.cardsGrid}>
        <div className={styles.statCard}>
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
        <div className={styles.statCard}>
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
        <div className={styles.statCard}>
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
        <div className={styles.statCard}>
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

      {/* 2. Order Management Section */}
      <div className={styles.ordersSection}>
        <h3 className={styles.sectionTitle}>
          {overviewConfig.ordersSection.title}
        </h3>

        {/* Search & Filter Toolbar */}
        <div className={styles.controlsContainer}>
          <input
            type="text"
            placeholder={overviewConfig.ordersSection.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className={styles.searchInput}
          />

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className={styles.filterSelect}
          >
            <option value="all">
              {overviewConfig.ordersSection.filterAll}
            </option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipping">Shipping</option>
            <option value="success">Success / Completed</option>
          </select>
        </div>

        {/* Tabel Data Pesanan */}
        <div className={styles.tableResponsive}>
          {loading ? (
            <p className={styles.loadingText}>
              {overviewConfig.ordersSection.loading}
            </p>
          ) : paginatedOrders.length === 0 ? (
            <p className={styles.emptyText}>
              {overviewConfig.ordersSection.empty}
            </p>
          ) : (
            <table className={styles.ordersTable}>
              <thead>
                <tr>
                  <th>{overviewConfig.ordersSection.table.orderId}</th>
                  <th>{overviewConfig.ordersSection.table.customer}</th>
                  <th>{overviewConfig.ordersSection.table.total}</th>
                  <th>{overviewConfig.ordersSection.table.status}</th>
                  <th style={{ textAlign: "center" }}>
                    {overviewConfig.ordersSection.table.action}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((order, idx) => {
                  // Guard tambahan: kalau entri ini ternyata masih undefined/null,
                  // lewati saja render-nya alih-alih crash seluruh halaman.
                  if (!order) return null;

                  const orderId = order.orderId || order.id;
                  const status = (order.status || "pending").toLowerCase();
                  const isBusy = updatingId === orderId;

                  return (
                    <tr key={orderId || idx}>
                      <td className={styles.orderId}>
                        #{String(orderId).substring(0, 12)}...
                      </td>
                      <td>
                        {order.customerName || order.customerEmail || "Guest"}
                      </td>
                      <td style={{ fontWeight: "600" }}>
                        {formatRupiah(order.amount || 0)}
                      </td>
                      <td>
                        <span
                          className={`${styles.badge} ${getBadgeClass(status)}`}
                        >
                          {status}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div className={styles.actionGroup}>
                          <button
                            disabled={isBusy || status === "processing"}
                            onClick={() =>
                              handleUpdateStatus(orderId, "processing")
                            }
                            className={styles.actionBtn}
                          >
                            {overviewConfig.ordersSection.buttons.process}
                          </button>
                          <button
                            disabled={isBusy || status === "shipping"}
                            onClick={() =>
                              handleUpdateStatus(orderId, "shipping")
                            }
                            className={styles.actionBtn}
                          >
                            {overviewConfig.ordersSection.buttons.ship}
                          </button>
                          <button
                            disabled={
                              isBusy ||
                              status === "success" ||
                              status === "completed"
                            }
                            onClick={() =>
                              handleUpdateStatus(orderId, "success")
                            }
                            className={styles.actionBtnConfirm}
                          >
                            {overviewConfig.ordersSection.buttons.success}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        {!loading && filteredOrders.length > ITEMS_PER_PAGE && (
          <div className={styles.pagination}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            >
              {overviewConfig.ordersSection.buttons.prev}
            </button>
            <span>
              Hal. {currentPage} dari {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
            >
              {overviewConfig.ordersSection.buttons.next}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}