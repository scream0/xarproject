import { useEffect, useState, useCallback } from "react";
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

  // Standarisasi pengambilan amount & date
  const getTransactionAmount = (tx) => {
    return Number(tx.price || tx.total || tx.total_price || tx.amount || 0);
  };

  const getTransactionDate = (tx) => {
    const dateField = tx.createdAt || tx.created_at || tx.date;
    return dateField ? new Date(dateField) : null;
  };

  const processChartData = useCallback((transactions, currentFrame) => {
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
        const date = getTransactionDate(tx);
        if (date && !isNaN(date)) {
          const dayName = date.toLocaleDateString("en-US", {
            weekday: "short",
          });
          if (daysMap[dayName] !== undefined) {
            daysMap[dayName] += getTransactionAmount(tx);
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
        const date = getTransactionDate(tx);
        if (date && !isNaN(date)) {
          const monthName = date.toLocaleDateString("en-US", {
            month: "short",
          });
          if (monthsMap[monthName] !== undefined) {
            monthsMap[monthName] += getTransactionAmount(tx);
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
        const date = getTransactionDate(tx);
        if (date && !isNaN(date)) {
          const dStr = date.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
          });
          if (dateMap[dStr] !== undefined) {
            dateMap[dStr] += getTransactionAmount(tx);
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
  }, []);

  const processYearlySummary = useCallback((transactions) => {
    const yearsMap = {};

    transactions.forEach((tx) => {
      const date = getTransactionDate(tx);
      if (date && !isNaN(date)) {
        const year = date.getFullYear().toString();
        const month = date.toLocaleString("en-US", { month: "long" });
        const amount = getTransactionAmount(tx);

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
      .sort((a, b) => b - a)
      .map((year) => {
        const dataYear = yearsMap[year];
        const avgOrder =
          dataYear.totalTransactions > 0
            ? Math.round(dataYear.totalRevenue / dataYear.totalTransactions)
            : 0;

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
  }, []);

  useEffect(() => {
    const fetchTransactionData = async () => {
      try {
        const res = await fetch("/api/orders");
        const result = await res.json();

        const transactions = Array.isArray(result)
          ? result
          : result.data || result.orders || [];

        if (transactions && transactions.length > 0) {
          setRawTransactions(transactions);
          processChartData(transactions, timeframe);
          processYearlySummary(transactions);
        } else {
          setChartData([]);
          setYearlySummary([]);
        }
      } catch (error) {
        console.error("Gagal mengambil data analitik dari API:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactionData();
  }, [processChartData, processYearlySummary, timeframe]);

  useEffect(() => {
    if (rawTransactions.length > 0) {
      processChartData(rawTransactions, timeframe);
    }
  }, [timeframe, rawTransactions, processChartData]);

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <div className={styles.chartContainer}>
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

      <div className={styles.chartWrapper}>
        {loading ? (
          <div className={styles.loadingState}>
            {analyticsConfig.loadingText}
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary-accent, #fbbf24)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--primary-accent, #fbbf24)" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-color)"
                opacity={0.4}
              />
              <XAxis
                dataKey="name"
                stroke="var(--text-secondary)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                dy={8}
              />
              <YAxis
                stroke="var(--text-secondary)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) =>
                  `${analyticsConfig.currencyPrefix}${value >= 1000 ? value / 1000 + "k" : value}`
                }
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
                  `${analyticsConfig.currencyPrefix}${value.toLocaleString("id-ID")}`,
                  analyticsConfig.tooltipLabel,
                ]}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="var(--primary-accent, #fbbf24)"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorSales)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className={styles.emptyState}>
            Belum ada data transaksi dari database
          </div>
        )}
      </div>

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
                    <td className={styles.yearCell}>
                      {row.year}
                    </td>
                    <td>{row.totalTransactions} pesanan</td>
                    <td className={styles.revenueCell}>
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
                  <td colSpan="5" className={styles.emptyTableCell}>
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