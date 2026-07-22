"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import styles from "./OverviewSection.module.css";
import { auth } from "@/lib/firebaseClient";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { supabase } from "@/lib/supabaseClient";

const db = getFirestore();

export default function OverviewSection({ setActiveTab }) {
  const router = useRouter();
  const pathname = usePathname(); // Mendapatkan path URL saat ini (misal: /dashboard)

  const [stats, setStats] = useState({
    totalOrders: 0,
    completedOrders: 0,
    processingOrders: 0,
  });
  const [userProfile, setUserProfile] = useState({
    fullName: "",
    username: "",
  });
  const [curatedProducts, setCuratedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentUser = auth.currentUser;

  useEffect(() => {
    async function fetchDashboardData() {
      if (!currentUser) return;

      try {
        // 1. Ambil data profil user dari Firestore
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          setUserProfile({
            fullName:
              userData.full_name || currentUser.displayName || "Pelanggan",
            username: userData.username ? `@${userData.username}` : "",
          });
        }

        // 2. Ambil total pesanan dari Supabase Database
        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select("status, transaction_status")
          .eq("user_id", currentUser.uid);

        if (!orderError && orderData) {
          const total = orderData.length;
          const completed = orderData.filter((o) =>
            ["settlement", "capture", "completed", "success"].includes(
              (o.transaction_status || o.status || "").toLowerCase(),
            ),
          ).length;
          const processing = total - completed;

          setStats({
            totalOrders: total,
            completedOrders: completed,
            processingOrders: processing,
          });
        }

        // 3. Ambil produk eksklusif dari katalog Supabase
        const { data: productData, error: productError } = await supabase
          .from("products")
          .select("*")
          .limit(2);

        if (!productError && productData) {
          setCuratedProducts(productData);
        }
      } catch (err) {
        console.error("Gagal memuat ringkasan dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [currentUser]);

  // Handler Tombol "Jelajahi Katalog"
  // Sesuaikan path "/shop" atau "/products" dengan folder rute halaman katalog Anda yang sebenarnya
  const handleExploreCatalog = () => {
    router.push("/shop");
  };

  // Handler Tombol "Cek Status Pesanan"
  const handleCheckOrders = () => {
    if (typeof setActiveTab === "function") {
      // Jika komponen dikendalikan oleh parent dashboard (state tab)
      setActiveTab("orders");
    } else {
      // Jika menggunakan query parameter di URL
      const basePath = pathname.split("?")[0];
      router.push(`${basePath}?tab=orders`);
    }
  };

  return (
    <div className={styles.overviewWorkspace}>
      {/* 1. Metric Cards Grid */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <p className={styles.metricTitle}>Total Pesanan</p>
          <h3 className={styles.metricValue}>
            {stats.totalOrders} {stats.totalOrders === 1 ? "Botol" : "Botol"}
          </h3>
          <p className={styles.metricDesc}>Riwayat pembelian keseluruhan</p>
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricTitle}>Pesanan Selesai</p>
          <h3 className={styles.metricValue}>{stats.completedOrders}</h3>
          <p className={styles.metricDesc}>Telah terkirim & diterima</p>
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricTitle}>Dalam Proses</p>
          <h3 className={styles.metricValue}>{stats.processingOrders}</h3>
          <p className={styles.metricDesc}>Sedang disiapkan / maceration</p>
        </div>
      </div>

      {/* 2. Welcome & Account Summary */}
      <div className={styles.overviewGridTwo}>
        <div className={styles.sectionCard}>
          <h3 className={styles.cardTitle}>
            SELAMAT DATANG, {userProfile.fullName.toUpperCase()}
          </h3>
          <p className={styles.cardDesc}>
            Kelola pesanan Anda, pantau pengiriman, dan perbarui informasi
            pengiriman langsung dari dashboard eksklusif ini.
          </p>
          <div className={styles.actionButtonGroup}>
            <button
              className={styles.btnPrimary}
              onClick={handleExploreCatalog}
            >
              Jelajahi Katalog
            </button>
            <button className={styles.btnOutline} onClick={handleCheckOrders}>
              Cek Status Pesanan
            </button>
          </div>
        </div>

        {/* Curated Exclusives from Supabase Products */}
        <div className={styles.sectionCard}>
          <h3 className={styles.cardTitle}>KOLEKSI EKSKLUSIF</h3>
          <div className={styles.curatedList}>
            {curatedProducts.length > 0 ? (
              curatedProducts.map((prod) => {
                const firstVariant = prod.variants?.[0] || {};
                const price = firstVariant.price
                  ? Number(firstVariant.price).toLocaleString("id-ID")
                  : "0";

                return (
                  <div key={prod.id} className={styles.curatedItem}>
                    <div>
                      <p className={styles.curatedName}>{prod.name}</p>
                      <p className={styles.curatedSub}>
                        {firstVariant.size ? `${firstVariant.size} - ` : ""}
                        {prod.category || "Parfum"}
                      </p>
                    </div>
                    <span className={styles.curatedPrice}>Rp {price}</span>
                  </div>
                );
              })
            ) : (
              <p style={{ fontSize: "0.8rem", color: "#64748b", margin: 0 }}>
                Katalog produk eksklusif sedang diperbarui.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
