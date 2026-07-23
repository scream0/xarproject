"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebaseClient";
import styles from "./Dashboard.module.css";

// Import Konfigurasi JSON
import dashboardConfig from "@/data/ui/dashboardPageConfig.json";

// Import dua dashboard
import AdminDashboard from "@/components/Dashboard/Admin/AdminDashboard";
import UserDashboard from "@/components/Dashboard/User/UserDashboard";

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

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

        // FIX: Periksa result.exists dan ambil role dari dalam result.data.role
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
