"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import styles from "./Dashboard.module.css";
import toast from "react-hot-toast";

// Import Konfigurasi JSON
import dashboardConfig from "@/data/ui/dashboardPageConfig.json";

// Import dua dashboard
import AdminDashboard from "@/components/Dashboard/Admin/AdminDashboard";
import UserDashboard from "@/components/Dashboard/User/UserDashboard";

// Import Skeleton
import { DashboardSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";

export default function DashboardView({ initialProducts }) {
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

      fetch("/api/orders/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: "success" }),
      }).catch((err) =>
        console.error("Gagal sinkronisasi status otomatis:", err),
      );

      const currentTab = params.get("tab");
      const cleanUrl = currentTab
        ? `/dashboard?tab=${currentTab}`
        : "/dashboard";
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);
  
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user;

      if (!currentUser) {
        window.location.replace("/login");
        return;
      }

      setUser(currentUser);

      try {
        // Ambil role user dari API /api/users
        const res = await fetch(`/api/users?userId=${currentUser.id}`);
        const result = await res.json();

        if (res.ok && result.exists && result.data && result.data.role) {
          const userRole = result.data.role;
          setRole(userRole);
          localStorage.setItem("userRole", userRole);
        } else {
          setRole(dashboardConfig.defaultRole);
        }
      } catch (error) {
        console.error("Gagal ambil data role via API:", error);
        setRole(dashboardConfig.defaultRole);
      } finally {
        setLoading(false);
      }
    };

    checkUser();
    // Set up listener untuk perubahan status autentikasi
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        window.location.replace("/login");
      } else if (session) {
        setUser(session.user);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  if (loading || role === null) {
    return <DashboardSkeleton />;
  }

  return (
    <>
      {role === "admin" ? (
        <AdminDashboard user={user} />
      ) : (
        <UserDashboard user={user} initialProducts={initialProducts} />
      )}
    </>
  );
}
