"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";

// Import hooks
import { useUserDashboardData } from "@/hooks/useUserDashboardData";

// Import dua dashboard
import AdminDashboard from "@/components/Dashboard/Admin/AdminDashboard";
import UserDashboard from "@/components/Dashboard/User/UserDashboard";

// Import Skeleton
import { DashboardSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";

export default function DashboardView({ initialProducts }) {
  const { user, role, loading } = useUserDashboardData();

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

  if (loading || !role) {
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
