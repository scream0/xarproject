"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import styles from "./OverviewSection.module.css";
import { auth } from "@/lib/firebaseClient";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { useStore } from "@/context/StoreContext";

const db = getFirestore();

export default function OverviewSection({ setActiveTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const { products, setIsCartOpen, addToCart } = useStore();

  const [stats, setStats] = useState({
    totalOrders: 0,
    completedOrders: 0,
    processingOrders: 0,
  });
  const [userProfile, setUserProfile] = useState({
    fullName: "",
    username: "",
  });
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

        // 2. Ambil total pesanan dari endpoint API terpusat (/api/orders)
        const orderRes = await fetch(`/api/orders?userId=${currentUser.uid}`);
        const orderResult = await orderRes.json();
        const orderData = Array.isArray(orderResult)
          ? orderResult
          : orderResult.orders || orderResult.data || [];

        if (orderRes.ok && orderData.length > 0) {
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
      } catch (err) {
        console.error("Gagal memuat ringkasan dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [currentUser]);

  // Handler Tombol "Jelajahi Katalog"
  const handleExploreCatalog = () => {
    if (typeof setActiveTab === "function") {
      setActiveTab("shop");
    } else {
      const basePath = pathname.split("?")[0];
      router.push(`${basePath}?tab=shop`);
    }
  };

  // Handler Tombol "Cek Status Pesanan"
  const handleCheckOrders = () => {
    if (typeof setActiveTab === "function") {
      setActiveTab("orders");
    } else {
      const basePath = pathname.split("?")[0];
      router.push(`${basePath}?tab=orders`);
    }
  };

  // Ambil 3 produk pertama untuk showcase eksklusif
  const curatedProducts = products.slice(0, 3);

  return (
    <div className={styles.overviewWorkspace}>
      {/* 1. Metric Cards Grid dengan Desain E-Commerce Modern & SVG Lokal */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricHeaderRow}>
            <p className={styles.metricTitle}>Total Pesanan</p>
            <span className={styles.metricIconBox}>
              <svg
                style={{
                  width: "20px",
                  height: "20px",
                  stroke: "currentColor",
                  strokeWidth: 2,
                  fill: "none",
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                }}
              >
                <use href="/assets/icon/feather-sprite.svg#package" />
              </svg>
            </span>
          </div>
          <h3 className={styles.metricValue}>
            {loading ? "..." : stats.totalOrders}{" "}
            <span className={styles.unitText}>Botol</span>
          </h3>
          <p className={styles.metricDesc}>Akumulasi seluruh transaksi</p>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeaderRow}>
            <p className={styles.metricTitle}>Pesanan Selesai</p>
            <span className={styles.metricIconBox} style={{ color: "#10b981" }}>
              <svg
                style={{
                  width: "20px",
                  height: "20px",
                  stroke: "currentColor",
                  strokeWidth: 2,
                  fill: "none",
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                }}
              >
                <use href="/assets/icon/feather-sprite.svg#check-circle" />
              </svg>
            </span>
          </div>
          <h3 className={styles.metricValue}>
            {loading ? "..." : stats.completedOrders}
          </h3>
          <p className={styles.metricDesc}>Telah diterima & dinikmati</p>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeaderRow}>
            <p className={styles.metricTitle}>Dalam Proses</p>
            <span className={styles.metricIconBox} style={{ color: "#fbbf24" }}>
              <svg
                style={{
                  width: "20px",
                  height: "20px",
                  stroke: "currentColor",
                  strokeWidth: 2,
                  fill: "none",
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                }}
              >
                <use href="/assets/icon/feather-sprite.svg#clock" />
              </svg>
            </span>
          </div>
          <h3 className={styles.metricValue}>
            {loading ? "..." : stats.processingOrders}
          </h3>
          <p className={styles.metricDesc}>Kurasi / proses pengiriman</p>
        </div>
      </div>

      {/* 2. Welcome Banner & Curated Exclusives */}
      <div className={styles.overviewGridTwo}>
        <div className={styles.sectionCard}>
          <div className={styles.welcomeBadge}>AREA ANGGOTA VIP</div>
          <h3 className={styles.cardTitle}>
            SELAMAT DATANG,{" "}
            <span>{userProfile.fullName.toUpperCase() || "VALUED GUEST"}</span>
          </h3>
          <p className={styles.cardDesc}>
            Nikmati kemudahan berbelanja koleksi Extrait de Parfum eksklusif
            kami. Pantau status pengiriman atau akses keranjang belanja Anda
            langsung dari panel kontrol ini.
          </p>
          <div className={styles.actionButtonGroup}>
            <button
              className={styles.btnPrimary}
              onClick={handleExploreCatalog}
            >
              Jelajahi Katalog
            </button>
            <button className={styles.btnOutline} onClick={handleCheckOrders}>
              Riwayat Pesanan
            </button>
            <button
              className={styles.btnOutline}
              onClick={() => setIsCartOpen(true)}
              style={{
                borderColor: "rgba(251, 191, 36, 0.4)",
                color: "#fbbf24",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                justifyContent: "center",
              }}
            >
              <svg
                style={{
                  width: "16px",
                  height: "16px",
                  stroke: "currentColor",
                  strokeWidth: 2,
                  fill: "none",
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                }}
              >
                <use href="/assets/icon/feather-sprite.svg#shopping-cart" />
              </svg>
              <span>Buka Keranjang</span>
            </button>
          </div>
        </div>

        {/* Curated Exclusives with Direct Add to Cart Feature */}
        <div className={styles.sectionCard}>
          <div className={styles.curatedHeaderRow}>
            <h3 className={styles.cardTitle} style={{ margin: 0 }}>
              REKOMENDASI UNGGULAN
            </h3>
            <button
              onClick={handleExploreCatalog}
              className={styles.seeAllLink}
            >
              Lihat Semua →
            </button>
          </div>

          <div className={styles.curatedList}>
            {curatedProducts.length > 0 ? (
              curatedProducts.map((prod) => {
                const firstVariant = prod.variants?.[0] || {};
                const price = firstVariant.price
                  ? Number(firstVariant.price).toLocaleString("id-ID")
                  : prod.price
                    ? Number(prod.price).toLocaleString("id-ID")
                    : "0";

                return (
                  <div key={prod.id || prod._id} className={styles.curatedItem}>
                    <div className={styles.curatedImgWrap}>
                      <img
                        src={
                          prod.image_url ||
                          prod.imageUrl ||
                          "/assets/placeholder.jpg"
                        }
                        alt={prod.name}
                        className={styles.curatedThumb}
                      />
                    </div>
                    <div className={styles.curatedInfo}>
                      <p className={styles.curatedName}>{prod.name}</p>
                      <p className={styles.curatedSub}>
                        {firstVariant.size ? `${firstVariant.size} • ` : ""}
                        Rp {price}
                      </p>
                    </div>
                    <button
                      className={styles.curatedQuickAddBtn}
                      onClick={() => addToCart(prod, firstVariant, 1)}
                      title="Tambah ke Keranjang"
                    >
                      <svg
                        style={{
                          width: "16px",
                          height: "16px",
                          stroke: "currentColor",
                          strokeWidth: 2,
                          fill: "none",
                          strokeLinecap: "round",
                          strokeLinejoin: "round",
                        }}
                      >
                        <use href="/assets/icon/feather-sprite.svg#shopping-cart" />
                      </svg>
                    </button>
                  </div>
                );
              })
            ) : (
              <p style={{ fontSize: "0.85rem", color: "#71717a", margin: 0 }}>
                Memuat rekomendasi produk terbaik...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
