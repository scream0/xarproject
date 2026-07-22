"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
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

  useEffect(() => {
    fetchAdvancedData();
  }, []);

  const fetchAdvancedData = async () => {
    try {
      const { data: orders, error: txError } = await supabase
        .from("orders")
        .select("*");

      const { data: products, error: prodError } = await supabase
        .from("products")
        .select("*");

      if (txError) throw txError;
      if (prodError) throw prodError;

      if (orders) {
        processMoMGrowth(orders);
        processOrderStatus(orders);
        processTopVariants(orders);
      }

      if (products) {
        processInventoryTurnover(products);
      }
    } catch (error) {
      console.error("Gagal mengambil analitik lanjutan dari Supabase:", error);
    } finally {
      setLoading(false);
    }
  };

  const processMoMGrowth = (orders) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let currentRev = 0;
    let lastRev = 0;

    orders.forEach((order) => {
      const dateField = order.created_at;
      if (dateField) {
        const d = new Date(dateField);
        const amount = Number(order.total || order.gross_amount || 0);

        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          currentRev += amount;
        } else if (
          d.getMonth() === (currentMonth === 0 ? 11 : currentMonth - 1) &&
          d.getFullYear() ===
            (currentMonth === 0 ? currentYear - 1 : currentYear)
        ) {
          lastRev += amount;
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
  };

  const processOrderStatus = (orders) => {
    const statusMap = { paid: 0, pending: 0, failed: 0 };

    orders.forEach((order) => {
      const status = (order.status || "pending").toLowerCase();
      if (statusMap[status] !== undefined) {
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
  };

  const processTopVariants = (orders) => {
    const variantMap = {};

    orders.forEach((order) => {
      const items = order.items || [];
      if (Array.isArray(items)) {
        items.forEach((item) => {
          const name = `${item.name || "Product"} (${item.size || item.variant || "Standard"})`;
          const qty = Number(item.quantity || item.qty || 1);

          if (!variantMap[name]) variantMap[name] = 0;
          variantMap[name] += qty;
        });
      }
    });

    const formatted =
      Object.keys(variantMap).length > 0
        ? Object.keys(variantMap).map((k) => ({ name: k, sold: variantMap[k] }))
        : [
            { name: "Extrait Noir (50ml)", sold: 34 },
            { name: "Flowrawr Sweet (30ml)", sold: 28 },
            { name: "AWRG Citrus (10ml)", sold: 19 },
          ];

    setVariantData(formatted.sort((a, b) => b.sold - a.sold).slice(0, 5));
  };

  const processInventoryTurnover = (products) => {
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
  };

  if (loading) return null;

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
              metrics.momGrowth >= 0
                ? styles.trendPositive
                : styles.trendNegative
            }`}
          >
            {metrics.momGrowth >= 0
              ? "▲ Meningkat dari bulan lalu"
              : "▼ Menurun dari bulan lalu"}
          </span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Pendapatan Bulan Ini</span>
          <span className={styles.metricValue}>
            Rp {metrics.currentMonthRev.toLocaleString("id-ID")}
          </span>
          <span className={styles.metricTrend} style={{ color: "#888" }}>
            Bulan lalu: Rp {metrics.lastMonthRev.toLocaleString("id-ID")}
          </span>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h4 className={styles.cardTitle}>{config.sections.topVariants}</h4>
          <div className={styles.chartBox}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={variantData} layout="vertical">
                <XAxis type="number" stroke="#525252" fontSize={11} hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="#ccc"
                  fontSize={11}
                  width={120}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0a0a0a",
                    border: "1px solid #333",
                    borderRadius: "8px",
                  }}
                  formatter={(value) => [`${value} unit`, "Terjual"]}
                />
                <Bar dataKey="sold" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.chartCard}>
          <h4 className={styles.cardTitle}>{config.sections.orderStatus}</h4>
          <div className={styles.chartBox}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={
                    statusData.length > 0
                      ? statusData
                      : [{ name: "Selesai", value: 100 }]
                  }
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {(statusData.length > 0
                    ? statusData
                    : [{ name: "Selesai", value: 100 }]
                  ).map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0a0a0a",
                    border: "1px solid #333",
                    borderRadius: "8px",
                  }}
                  formatter={(value) => [`${value} pesanan`, "Jumlah"]}
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
                    <td style={{ fontWeight: 600, color: "#fff" }}>
                      {item.name}
                    </td>
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
                  <td
                    colSpan="4"
                    style={{ textAlign: "center", color: "#666" }}
                  >
                    Belum ada data inventaris untuk dianalisis
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
