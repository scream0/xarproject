"use client";
import { useState, useEffect } from "react";
import styles from "./TransactionTable.module.css";

export default function TransactionTable() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/orders");
      const result = await res.json();

      // Menyesuaikan dengan format respons dari endpoint orders
      const data = Array.isArray(result)
        ? result
        : result.data || result.orders || [];

      // Urutkan berdasarkan waktu pembuatan terbaru (jika belum diurutkan dari API)
      const sortedData = data.sort((a, b) => {
        const dateA = new Date(a.created_at || a.date || 0);
        const dateB = new Date(b.created_at || b.date || 0);
        return dateB - dateA;
      });

      setTransactions(sortedData);
    } catch (error) {
      console.error("Gagal memuat transaksi dari API:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  return (
    <div className={styles.tableWrapper}>
      {loading ? (
        <p style={{ color: "#fff", padding: "10px" }}>
          Loading transactions...
        </p>
      ) : transactions.length === 0 ? (
        <p style={{ color: "#aaa", padding: "10px" }}>Belum ada transaksi.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ORDER ID</th>
              <th>CUSTOMER</th>
              <th>AMOUNT</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((trx) => {
              const orderId = trx.order_id || trx.id;
              const customerName = trx.customer || trx.name || "Pelanggan";
              const amountValue = Number(
                trx.total || trx.total_price || trx.rawPrice || trx.amount || 0,
              );
              const statusValue =
                trx.status || trx.transaction_status || "pending";

              return (
                <tr key={trx.id || orderId} className={styles.row}>
                  <td className={styles.orderId}>{orderId}</td>
                  <td>{customerName}</td>
                  <td>Rp {amountValue.toLocaleString("id-ID")}</td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${styles[`status${statusValue}`] || ""}`}
                    >
                      {statusValue}
                    </span>
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
