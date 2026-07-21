"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient"; // Sesuaikan path client Supabase Anda
import styles from "./TransactionTable.module.css";

export default function TransactionTable() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Gagal memuat transaksi:", error);
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
            {transactions.map((trx) => (
              <tr key={trx.id} className={styles.row}>
                <td className={styles.orderId}>{trx.order_id || trx.id}</td>
                <td>{trx.customer}</td>
                <td>Rp {Number(trx.amount).toLocaleString("id-ID")}</td>
                <td>
                  <span
                    className={`${styles.statusBadge} ${styles[`status${trx.status}`]}`}
                  >
                    {trx.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
