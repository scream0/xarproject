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

export default function DashboardPage() {
  const [user, setUser] = useState(null);

  // PERUBAHAN 1: role diawali `null` ("belum tahu"), BUKAN dibaca dari localStorage.
  // localStorage bisa berisi role lama/salah (misal dari akun sebelumnya di device yang sama),
  // dan kalau dipakai untuk render duluan, begitu role asli datang dari server, React akan
  // unmount total AdminDashboard <-> UserDashboard -> itu yang menyebabkan "kedip" besar.
  const [role, setRole] = useState(null);

  // PERUBAHAN 2: loading selalu mulai true. Kita SELALU tunggu Firebase + role server
  // sebelum memutuskan apa pun. Tidak ada lagi shortcut "instan tanpa kedip" yang ternyata
  // malah jadi sumber kedip.
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
  }, []); // <-- Dependency array kosong [] agar tidak loop!

  // PERUBAHAN 5: "pengaman darurat" 1 detik DIHAPUS.
  // Timer itu memaksa `loading=false` walau fetch /api/users belum selesai. Efeknya:
  // - detik ke-1: loading dipaksa false, role masih null -> render dengan fallback/UserDashboard
  // - sesaat kemudian: fetch /api/users akhirnya selesai, role di-set ke nilai asli
  // - -> UNMOUNT + MOUNT ulang komponen dashboard yang berbeda -> KEDIP.
  // Kalau khawatir loading kelamaan karena network lambat, atasi di level UI loading
  // (kasih pesan "koneksi lambat..." setelah beberapa detik), BUKAN dengan memaksa lanjut
  // sebelum data siap.

  // PERUBAHAN 6: kondisi loading sekarang cek `role === null`, bukan `!user`.
  // Sebelumnya `loading && !user` bisa salah: begitu `user` ke-set (lebih awal dari role),
  // kondisi ini langsung false walau `role` belum tentu sudah benar -> dashboard sempat
  // render dengan role lama/default sebelum akhirnya "loncat" ke role asli. Sekarang kita
  // tunggu sampai role BENAR-BENAR diketahui sebelum render dashboard sama sekali.
  if (loading || role === null) {
    return <DashboardSkeleton />;
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
