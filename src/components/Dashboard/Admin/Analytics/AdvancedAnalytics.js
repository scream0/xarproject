"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import styles from "./AdvancedAnalytics.module.css";

// Import Konfigurasi JSON
import config from "@/data/ui/advancedAnalyticsConfig.json";

const COLORS = ["#3b82f6", "#10b981", "#fbbf24", "#ef4444", "#8b5cf6"];

const FALLBACK_STATUS = [{ name: "Selesai", value: 100 }];

export default function AdvancedAnalytics() {
  const [metrics, setMetrics] = useState({
    momGrowth: 0,
    currentMonthRev: 0,
    lastMonthRev: 0,
  });
  const [variantData, setVariantData] = useState([]);
  const [statusData, setStatusData] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper aman untuk mengambil tanggal & harga dari berbagai struktur API
  const getOrderDate = (order) => {
    const dateField = order.createdAt || order.created_at || order.date;
    return dateField ? new Date(dateField) : null;
  };

  const getOrderAmount = (order) => {
    return Number(
      order.price || order.total || order.total_price || order.amount || 0,
    );
  };

  const processMoMGrowth = useCallback((orders) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let currentRev = 0;
    let lastRev = 0;

    orders.forEach((order) => {
      const d = getOrderDate(order);
      const amount = getOrderAmount(order);

      if (d && !isNaN(d.getTime())) {
        const status = (
          order.status ||
          order.transaction_status ||
          "completed"
        ).toLowerCase();
        const isValidStatus = [
          "paid",
          "settlement",
          "completed",
          "success",
          "pending",
          "processing",
          "",
        ].includes(status);

        if (isValidStatus) {
          if (
            d.getMonth() === currentMonth &&
            d.getFullYear() === currentYear
          ) {
            currentRev += amount;
          } else if (
            d.getMonth() === (currentMonth === 0 ? 11 : currentMonth - 1) &&
            d.getFullYear() ===
              (currentMonth === 0 ? currentYear - 1 : currentYear)
          ) {
            lastRev += amount;
          }
        }
      }
    });

    let growth = 0;
    if (lastRev > 0) {
      growth = Math.round(((currentRev - lastRev) / lastRev) * 100);
    } else if (currentRev > 0) {
      growth = 100;
    }

    setMetrics({
      momGrowth: growth,
      currentMonthRev: currentRev,
      lastMonthRev: lastRev,
    });
  }, []);

  const processOrderStatus = useCallback((orders) => {
    const statusMap = { paid: 0, pending: 0, failed: 0, settlement: 0 };

    orders.forEach((order) => {
      const status = (
        order.status ||
        order.transaction_status ||
        "pending"
      ).toLowerCase();

      if (
        status === "settlement" ||
        status === "completed" ||
        status === "success" ||
        status === "paid"
      ) {
        statusMap.paid += 1;
      } else if (statusMap[status] !== undefined) {
        statusMap[status] += 1;
      } else {
        statusMap.pending += 1;
      }
    });

    const formatted = Object.keys(statusMap)
      .filter((key) => statusMap[key] > 0)
      .map((key) => ({
        name: config.statusLabels[key] || key,
        value: statusMap[key],
      }));

    setStatusData(formatted);
  }, []);

  const processTopVariants = useCallback((orders) => {
    const variantMap = {};

    orders.forEach((order) => {
      const items = order.items || (order.order ? [order.order] : []);
      if (Array.isArray(items)) {
        items.forEach((item) => {
          const name = `${item.name || config.labels.defaultVariantName} (${item.size || item.concentration || item.variant || config.labels.defaultVariantSize})`;
          const qty = Number(item.quantity || item.qty || 1);

          if (!variantMap[name]) variantMap[name] = 0;
          variantMap[name] += qty;
        });
      }
    });

    const formatted =
      Object.keys(variantMap).length > 0
        ? Object.keys(variantMap).map((k) => ({ name: k, sold: variantMap[k] }))
        : FALLBACK_VARIANTS;

    setVariantData(formatted.sort((a, b) => b.sold - a.sold).slice(0, 5));
  }, []);

  const processInventoryTurnover = useCallback((products) => {
    const report = [];

    products.forEach((prod) => {
      if (prod.variants && Array.isArray(prod.variants)) {
        prod.variants.forEach((v) => {
          const totalStock = Number(v.stock || 0);
          const isFast = totalStock <= 10;
          report.push({
            name: `${prod.name} - ${v.size}`,
            stock: totalStock,
            turnover: isFast ? "Fast-Moving" : "Normal / Slow",
            recommendation: isFast ? "Segera Restock" : "Stok Aman",
          });
        });
      }
    });

    setInventoryList(report.slice(0, 5));
  }, []);

  useEffect(() => {
    const fetchAdvancedData = async () => {
      try {
        const [ordersRes, productsRes] = await Promise.all([
          fetch("/api/orders"),
          fetch("/api/products"),
        ]);

        const ordersResult = await ordersRes.json();
        const productsResult = await productsRes.json();

        const orders = Array.isArray(ordersResult)
          ? ordersResult
          : ordersResult.data || ordersResult.orders || [];

        const products = Array.isArray(productsResult)
          ? productsResult
          : productsResult.data || productsResult.products || [];

        if (orders.length > 0) {
          processMoMGrowth(orders);
          processOrderStatus(orders);
          processTopVariants(orders);
        }

        if (products.length > 0) {
          processInventoryTurnover(products);
        }
      } catch (error) {
        console.error("Gagal mengambil analitik lanjutan:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdvancedData();
  }, [
    processMoMGrowth,
    processOrderStatus,
    processTopVariants,
    processInventoryTurnover,
  ]);

  if (loading) return null;

  const activePieData = statusData.length > 0 ? statusData : FALLBACK_STATUS;

  return (
    <div className={styles.advancedContainer}>
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>
            {config.sections.growthRate}
          </span>
          <span className={styles.metricValue}>
            {metrics.momGrowth >= 0
              ? `+${metrics.momGrowth}%`
              : `${metrics.momGrowth}%`}
          </span>
          <span
            className={`${styles.metricTrend} ${
              metrics.momGrowth > 0
                ? styles.trendPositive
                : metrics.momGrowth < 0
                  ? styles.trendNegative
                  : styles.trendNeutral
            }`}
          >
            {metrics.momGrowth >= 0
              ? config.labels.trendUp
              : config.labels.trendDown}
          </span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>
            {config.labels.currentMonthLabel}
          </span>
          <span className={styles.metricValue}>
            Rp {metrics.currentMonthRev.toLocaleString("id-ID")}
          </span>
          <span className={`${styles.metricTrend} ${styles.trendNeutral}`}>
            {config.labels.lastMonthPrefix}
            {metrics.lastMonthRev.toLocaleString("id-ID")}
          </span>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h4 className={styles.cardTitle}>{config.sections.topVariants}</h4>
          <div className={styles.chartBox}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={variantData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="var(--text-secondary)"
                  fontSize={11}
                  width={130}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface-primary)",
                    borderColor: "var(--border-color)",
                    borderRadius: "12px",
                    color: "var(--text-primary)",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                    padding: "10px 14px",
                  }}
                  itemStyle={{ color: "var(--primary-accent, #fbbf24)", fontWeight: 600 }}
                  formatter={(value) => [
                    `${value} ${config.labels.unitsSold}`,
                    config.labels.soldTooltip,
                  ]}
                />
                <Bar dataKey="sold" fill="var(--primary-accent, #fbbf24)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.chartCard}>
          <h4 className={styles.cardTitle}>{config.sections.orderStatus}</h4>
          <div className={styles.chartBox}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <Pie
                  data={activePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={6}
                  dataKey="value"
                >
                  {activePieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      stroke="var(--surface-primary)"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface-primary)",
                    borderColor: "var(--border-color)",
                    borderRadius: "12px",
                    color: "var(--text-primary)",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                    padding: "10px 14px",
                  }}
                  itemStyle={{ color: "var(--primary-accent, #fbbf24)", fontWeight: 600 }}
                  formatter={(value) => [
                    `${value} ${config.labels.ordersCount}`,
                    config.labels.jumlahTooltip,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={styles.tableCard}>
        <h4 className={styles.cardTitle}>
          {config.sections.inventoryMovement}
        </h4>
        <div className={styles.tableWrapper}>
          <table className={styles.inventoryTable}>
            <thead>
              <tr>
                <th>{config.headers.productName}</th>
                <th>Sisa Stok</th>
                <th>{config.headers.status}</th>
                <th>{config.headers.action}</th>
              </tr>
            </thead>
            <tbody>
              {inventoryList.length > 0 ? (
                inventoryList.map((item, idx) => (
                  <tr key={idx}>
                    <td className={styles.tableItemName}>{item.name}</td>
                    <td>{item.stock} pcs</td>
                    <td>
                      <span
                        className={
                          item.turnover === "Fast-Moving"
                            ? styles.badgeFast
                            : styles.badgeSlow
                        }
                      >
                        {item.turnover}
                      </span>
                    </td>
                    <td>{item.recommendation}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className={styles.emptyTableText}>
                    {config.labels.emptyInventory}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}