"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import styles from "./AnalyticsChart.module.css";

// Import Konfigurasi JSON
import analyticsConfig from "@/data/ui/analyticsConfig.json";

export default function AnalyticsChart() {
  const [rawTransactions, setRawTransactions] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [yearlySummary, setYearlySummary] = useState([]);
  const [timeframe, setTimeframe] = useState("weekly"); // "daily" | "weekly" | "yearly"
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactionData();
  }, []);

  useEffect(() => {
    if (rawTransactions.length > 0) {
      processChartData(rawTransactions, timeframe);
    }
  }, [timeframe, rawTransactions]);

  const fetchTransactionData = async () => {
    try {
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("*");

      if (error) throw error;

      if (transactions && transactions.length > 0) {
        setRawTransactions(transactions);
        processChartData(transactions, timeframe);
        processYearlySummary(transactions);
      } else {
        setChartData([
          { name: "Mon", sales: 0 },
          { name: "Tue", sales: 0 },
          { name: "Wed", sales: 0 },
          { name: "Thu", sales: 0 },
          { name: "Fri", sales: 0 },
          { name: "Sat", sales: 0 },
          { name: "Sun", sales: 0 },
        ]);
        setYearlySummary([]);
      }
    } catch (error) {
      console.error("Gagal mengambil data analitik dari Supabase:", error);
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (transactions, currentFrame) => {
    if (currentFrame === "weekly") {
      const daysMap = {
        Mon: 0,
        Tue: 0,
        Wed: 0,
        Thu: 0,
        Fri: 0,
        Sat: 0,
        Sun: 0,
      };
      transactions.forEach((tx) => {
        const dateField = tx.created_at || tx.date;
        if (dateField) {
          const dayName = new Date(dateField).toLocaleDateString("en-US", {
            weekday: "short",
          });
          if (daysMap[dayName] !== undefined) {
            daysMap[dayName] += Number(tx.total_price || tx.amount || 0);
          }
        }
      });
      setChartData(
        Object.keys(daysMap).map((day) => ({ name: day, sales: daysMap[day] })),
      );
    } else if (currentFrame === "yearly") {
      const monthsMap = {
        Jan: 0,
        Feb: 0,
        Mar: 0,
        Apr: 0,
        May: 0,
        Jun: 0,
        Jul: 0,
        Aug: 0,
        Sep: 0,
        Oct: 0,
        Nov: 0,
        Dec: 0,
      };
      transactions.forEach((tx) => {
        const dateField = tx.created_at || tx.date;
        if (dateField) {
          const monthName = new Date(dateField).toLocaleDateString("en-US", {
            month: "short",
          });
          if (monthsMap[monthName] !== undefined) {
            monthsMap[monthName] += Number(tx.total_price || tx.amount || 0);
          }
        }
      });
      setChartData(
        Object.keys(monthsMap).map((month) => ({
          name: month,
          sales: monthsMap[month],
        })),
      );
    } else if (currentFrame === "daily") {
      const dateMap = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
        });
        dateMap[key] = 0;
      }

      transactions.forEach((tx) => {
        const dateField = tx.created_at || tx.date;
        if (dateField) {
          const dStr = new Date(dateField).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
          });
          if (dateMap[dStr] !== undefined) {
            dateMap[dStr] += Number(tx.total_price || tx.amount || 0);
          }
        }
      });

      setChartData(
        Object.keys(dateMap).map((dateKey) => ({
          name: dateKey,
          sales: dateMap[dateKey],
        })),
      );
    }
  };

  // Proses rincian data per tahun untuk tabel laporan
  const processYearlySummary = (transactions) => {
    const yearsMap = {};

    transactions.forEach((tx) => {
      const dateField = tx.created_at || tx.date;
      if (dateField) {
        const year = new Date(dateField).getFullYear().toString();
        const month = new Date(dateField).toLocaleString("en-US", {
          month: "long",
        });
        const amount = Number(tx.total_price || tx.amount || 0);

        if (!yearsMap[year]) {
          yearsMap[year] = {
            totalRevenue: 0,
            totalTransactions: 0,
            months: {},
          };
        }

        yearsMap[year].totalRevenue += amount;
        yearsMap[year].totalTransactions += 1;

        if (!yearsMap[year].months[month]) {
          yearsMap[year].months[month] = 0;
        }
        yearsMap[year].months[month] += amount;
      }
    });

    const formattedSummary = Object.keys(yearsMap)
      .sort((a, b) => b - a) // Urutkan tahun terbaru di atas
      .map((year) => {
        const dataYear = yearsMap[year];
        const avgOrder =
          dataYear.totalTransactions > 0
            ? Math.round(dataYear.totalRevenue / dataYear.totalTransactions)
            : 0;

        // Cari bulan terbaik (pendapatan tertinggi)
        let bestMonth = "-";
        let maxRev = -1;
        Object.keys(dataYear.months).forEach((m) => {
          if (dataYear.months[m] > maxRev) {
            maxRev = dataYear.months[m];
            bestMonth = m;
          }
        });

        return {
          year,
          totalTransactions: dataYear.totalTransactions,
          totalRevenue: dataYear.totalRevenue,
          avgOrderValue: avgOrder,
          bestMonth,
        };
      });

    setYearlySummary(formattedSummary);
  };

  // Handler Export PDF menggunakan fitur cetak bawaan browser yang terformat bersih
  const handleExportPdf = () => {
    window.print();
  };

  return (
    <div className={styles.chartContainer}>
      {/* Header dengan Judul, Tab Filter, dan Tombol Export PDF */}
      <div className={styles.headerRow}>
        <h3 className={styles.chartTitle}>{analyticsConfig.title}</h3>
        <div className={styles.actionGroup}>
          <div className={styles.tabGroup}>
            <button
              onClick={() => setTimeframe("daily")}
              className={`${styles.tabBtn} ${timeframe === "daily" ? styles.tabBtnActive : ""}`}
            >
              {analyticsConfig.tabs.daily}
            </button>
            <button
              onClick={() => setTimeframe("weekly")}
              className={`${styles.tabBtn} ${timeframe === "weekly" ? styles.tabBtnActive : ""}`}
            >
              {analyticsConfig.tabs.weekly}
            </button>
            <button
              onClick={() => setTimeframe("yearly")}
              className={`${styles.tabBtn} ${timeframe === "yearly" ? styles.tabBtnActive : ""}`}
            >
              {analyticsConfig.tabs.yearly}
            </button>
          </div>
          <button onClick={handleExportPdf} className={styles.exportBtn}>
            {analyticsConfig.buttons.exportPdf}
          </button>
        </div>
      </div>

      {/* Konten Grafik */}
      <div className={styles.chartWrapper}>
        {loading ? (
          <div className={styles.loadingState}>
            {analyticsConfig.loadingText}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis
                dataKey="name"
                stroke="#525252"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                stroke="#525252"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) =>
                  `${analyticsConfig.currencyPrefix}${value >= 1000 ? value / 1000 + "k" : value}`
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0a0a0a",
                  border: "1px solid #333",
                  borderRadius: "8px",
                }}
                itemStyle={{ color: "#fbbf24" }}
                formatter={(value) => [
                  `${analyticsConfig.currencyPrefix}${value.toLocaleString("id-ID")}`,
                  analyticsConfig.tooltipLabel,
                ]}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#fbbf24"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorSales)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Tabel Rincian Tahunan */}
      <div className={styles.yearlySection}>
        <h4 className={styles.sectionSubtitle}>
          {analyticsConfig.yearlyTable.title}
        </h4>
        <div className={styles.tableWrapper}>
          <table className={styles.yearlyTable}>
            <thead>
              <tr>
                <th>{analyticsConfig.yearlyTable.headers.year}</th>
                <th>{analyticsConfig.yearlyTable.headers.totalTransactions}</th>
                <th>{analyticsConfig.yearlyTable.headers.totalRevenue}</th>
                <th>{analyticsConfig.yearlyTable.headers.avgOrderValue}</th>
                <th>{analyticsConfig.yearlyTable.headers.bestMonth}</th>
              </tr>
            </thead>
            <tbody>
              {yearlySummary.length > 0 ? (
                yearlySummary.map((row) => (
                  <tr key={row.year}>
                    <td style={{ fontWeight: 600, color: "#fff" }}>
                      {row.year}
                    </td>
                    <td>{row.totalTransactions} pesanan</td>
                    <td style={{ color: "#10b981", fontWeight: 600 }}>
                      {analyticsConfig.currencyPrefix}
                      {row.totalRevenue.toLocaleString("id-ID")}
                    </td>
                    <td>
                      {analyticsConfig.currencyPrefix}
                      {row.avgOrderValue.toLocaleString("id-ID")}
                    </td>
                    <td>{row.bestMonth}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="5"
                    style={{ textAlign: "center", color: "#666" }}
                  >
                    Belum ada data rincian tahunan
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
