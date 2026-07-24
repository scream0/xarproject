"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebaseClient";
import styles from "./Dashboard.module.css";
import toast from "react-hot-toast";

// Import Konfigurasi JSON
import dashboardConfig from "@/data/ui/dashboardPageConfig.json";

// Import dua dashboard
import AdminDashboard from "@/components/Dashboard/Admin/AdminDashboard";
import UserDashboard from "@/components/Dashboard/User/UserDashboard";

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Tangkap parameter redirect dari Midtrans (settlement / sukses)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id");
    const transactionStatus =
      params.get("transaction_status") || params.get("status_code");

    if (
      orderId &&
      (transactionStatus === "settlement" ||
        transactionStatus === "200" ||
        transactionStatus === "success")
    ) {
      toast.success(`Pembayaran untuk pesanan #${orderId} berhasil!`);

      // Panggil API update-status secara otomatis untuk memastikan status database & stok terpotong
      fetch("/api/orders/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: "success" }),
      }).catch((err) =>
        console.error("Gagal sinkronisasi status otomatis:", err),
      );

      // Bersihkan URL dari parameter Midtrans yang panjang agar kembali bersih
      const currentTab = params.get("tab");
      const cleanUrl = currentTab
        ? `/dashboard?tab=${currentTab}`
        : "/dashboard";
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        window.location.href = "/login";
        return;
      }

      setUser(currentUser);

      try {
        // Mengambil data user dari API Route backend
        const res = await fetch(`/api/users?userId=${currentUser.uid}`);
        const result = await res.json();

        if (res.ok && result.exists && result.data) {
          const userRole = result.data.role || dashboardConfig.defaultRole;
          setRole(userRole);
        } else {
          setRole(dashboardConfig.defaultRole);
        }
      } catch (error) {
        console.error("Gagal ambil data role via API:", error);
        setRole(dashboardConfig.defaultRole);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.pulseScanner}></div>
        <p className={styles.loadingText}>{dashboardConfig.loadingText}</p>
      </div>
    );
  }

  return (
    <>
      {role === "admin" ? (
        <AdminDashboard user={user} />
      ) : (
        <UserDashboard user={user} />
      )}
    </>
  );
}
