"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import styles from "./OverviewUser.module.css";
import { auth } from "@/lib/supabaseClient";
import { useStore } from "@/context/StoreContext";
import { getDiscountedPrice } from "@/utils/promo";
import { shouldSkipAuthEvent } from "@/utils/authHelpers";
import toast from "react-hot-toast";
import overviewConfig from "@/data/ui/overviewUserConfig.json";
import { OverviewUserSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";

// Mapping status agar kelas warna badge sinkron dengan OrdersSection
const STATUS_INFO = {
  pending: { label: "Menunggu Pembayaran", badgeClass: "statusPending" },
  success: { label: "Pembayaran Diterima", badgeClass: "statusSuccess" },
  processing: { label: "Sedang Diracik", badgeClass: "statusProcessing" },
  shipping: { label: "Dalam Pengiriman", badgeClass: "statusShipping" },
  completed: { label: "Pesanan Selesai", badgeClass: "statusCompleted" },
  settlement: { label: "Pembayaran Diterima", badgeClass: "statusSuccess" },
  capture: { label: "Pembayaran Diterima", badgeClass: "statusSuccess" },
};

function getStatusInfo(rawStatus) {
  const key = (rawStatus || "pending").toLowerCase();
  return (
    STATUS_INFO[key] || {
      label: (rawStatus || "PENDING").toUpperCase(),
      badgeClass: "statusPending",
    }
  );
}

export default function OverviewUser({ setActiveTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const { products, addToCart, activePromo } = useStore();

  const [stats, setStats] = useState({
    totalOrders: 0,
    totalSpent: 0,
    processingOrders: 0,
    balance: 0,
  });
  const [userProfile, setUserProfile] = useState({
    fullName: "",
    username: "",
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const lastUserIdRef = useRef(null);

  // State untuk sesi & user Supabase
  const [currentSession, setCurrentSession] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    let subscription = null;

    const initAuth = async () => {
      const { data: { session } } = await auth.getSession();
      lastUserIdRef.current = session?.user?.id || null;
      setCurrentSession(session);
      setCurrentUser(session?.user || null);

      if (!session) {
        setLoading(false);
      }

      const { data: authListener } = auth.onAuthStateChange((_event, session) => {
        if (shouldSkipAuthEvent(_event, session, lastUserIdRef.current)) return;
        lastUserIdRef.current = session?.user?.id || null;
        setCurrentSession(session);
        setCurrentUser(session?.user || null);
        if (!session) {
          setLoading(false);
        }
      });
      subscription = authListener?.subscription;
    };

    initAuth();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!currentUser || !currentSession) return;

      try {
        const userId = currentUser.id || currentUser.uid;
        const token = currentSession.access_token;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // Ambil data pesanan dan profil secara paralel
        const orderPromise = fetch(`/api/orders?userId=${userId}`, { headers }).catch(e => {
          console.error("Gagal mengambil orders:", e);
          return null;
        });
        
        const userPromise = fetch(`/api/users?userId=${userId}`, { headers }).catch(e => {
          console.error("Gagal mengambil user profile:", e);
          return null;
        });

        const [orderRes, userRes] = await Promise.all([orderPromise, userPromise]);

        let orderData = [];
        let orderResult = {};
        if (orderRes && orderRes.ok) {
          orderResult = await orderRes.json();
          orderData = Array.isArray(orderResult)
            ? orderResult
            : orderResult.data || orderResult.orders || [];
        } else if (!orderRes?.ok) {
          console.error(overviewConfig.toasts.fetchOrdersError);
        }

        let userBalance = 0;
        let fetchedFullName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || "";

        if (userRes && userRes.ok) {
          const userResult = await userRes.json();
          if (userResult.exists && userResult.data) {
            userBalance = Number(userResult.data.balance || 0);
            if (!fetchedFullName) {
              fetchedFullName =
                userResult.data.full_name ||
                userResult.data.username ||
                fetchedFullName;
            }
          }
        }

        // Fallback nama profil dari alamat pengiriman
        try {
          if (
            !fetchedFullName &&
            orderResult.primaryAddress &&
            orderResult.primaryAddress !== "Belum diatur"
          ) {
            fetchedFullName = orderResult.primaryAddress
              .split(" - ")[0]
              ?.split(" (")[0];
          }
        } catch (e) {
          console.error("Gagal parse nama dari alamat:", e);
        }

        setUserProfile({
          fullName:
            fetchedFullName || overviewConfig.welcomeBanner.defaultGuest,
          username: currentUser.email || "",
        });

        // Kalkulasi Statistik dari Database
        const total = orderData.length;
        const completedOrders = orderData.filter((o) =>
          [
            "completed",
            "success",
            "shipping",
            "shipped",
            "settlement",
            "capture",
            "paid",
          ].includes((o.status || "").toLowerCase()),
        );

        const totalSpent = completedOrders.reduce(
          (sum, o) => sum + Number(o.amount || o.price || o.rawPrice || 0),
          0,
        );

        // Pesanan aktif/proses adalah pesanan yang sudah dibayar dan sedang dikemas
        const processing = orderData.filter((o) =>
          [
            "paid",
            "success",
            "processing",
            "settlement",
            "capture"
          ].includes((o.status || "").toLowerCase()),
        ).length;

        setStats({
          totalOrders: total,
          totalSpent: totalSpent,
          processingOrders: processing,
          balance: userBalance,
        });

        // Urutkan aktivitas pesanan dari yang terbaru secara presisi
        const sortedOrders = [...orderData].sort((a, b) => {
          const dateA = new Date(a.createdAt || a.created_at || a.updated_at || 0);
          const dateB = new Date(b.createdAt || b.created_at || b.updated_at || 0);
          return dateB - dateA;
        });

        setRecentOrders(sortedOrders.slice(0, 3));
      } catch (err) {
        console.error("Gagal memuat ringkasan dashboard:", err);
        toast.error(overviewConfig.toasts.fetchSummaryError);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [currentUser, currentSession]);

  // Rekomendasi Produk Berbasis Database Produk
  const recommendedProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    return products.slice(0, 3);
  }, [products]);

  const handleNavigation = (tab) => {
    if (typeof setActiveTab === "function") {
      setActiveTab(tab);
    } else {
      const basePath = pathname.split("?")[0];
      router.push(`${basePath}?tab=${tab}`);
    }
  };

  const formatRupiah = (number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(number);

  if (loading) {
    return (
      <div className={styles.overviewWorkspace}>
        <OverviewUserSkeleton />
      </div>
    );
  }

  return (
    <div className={styles.overviewWorkspace}>
      {/* 1. Metric Cards Grid (Tanpa Poin) */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <p className={styles.metricTitle}>
            {overviewConfig.metrics.totalSpent.title}
          </p>
          <h3 className={styles.metricValue}>
            {loading ? "..." : formatRupiah(stats.totalSpent)}
          </h3>
          <p className={styles.metricDesc}>
            {overviewConfig.metrics.totalSpent.desc}
          </p>
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricTitle}>
            {overviewConfig.metrics.totalOrders.title}
          </p>
          <h3 className={styles.metricValue}>
            {loading ? "..." : stats.totalOrders}
          </h3>
          <p className={styles.metricDesc}>
            {overviewConfig.metrics.totalOrders.desc}
          </p>
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricTitle}>
            {overviewConfig.metrics.processingOrders.title}
          </p>
          <h3 className={styles.metricValue}>
            {loading ? "..." : stats.processingOrders}
          </h3>
          <p className={styles.metricDesc}>
            {overviewConfig.metrics.processingOrders.desc}
          </p>
        </div>
        <div className={`${styles.metricCard} ${styles.metricCardWallet}`}>
          <p className={styles.metricTitle}>
            {overviewConfig.metrics.balance.title}
          </p>
          <h3 className={styles.metricValue}>
            {loading ? "..." : formatRupiah(stats.balance)}
          </h3>
          <p className={styles.metricDesc}>
            {overviewConfig.metrics.balance.desc}
          </p>
        </div>
      </div>

      {/* 2. Recent Orders Section */}
      <div className={styles.overviewGridTwo} style={{ gridTemplateColumns: "1fr" }}>
        <div className={styles.sectionCard}>
          <h3 className={styles.cardTitle}>
            {overviewConfig.recentOrders.title}
          </h3>
          <div className={styles.recentOrdersList}>
            {loading ? (
              <p className={styles.smallLoadingText}>
                {overviewConfig.recentOrders.loading}
              </p>
            ) : recentOrders.length > 0 ? (
              recentOrders.map((order) => {
                const displayId = order.orderId || order.id || "";

                let itemName = order.product_name || order.name || "";
                if (
                  !itemName &&
                  order.items &&
                  Array.isArray(order.items) &&
                  order.items.length > 0
                ) {
                  const firstItem = order.items[0];
                  const productName = firstItem.product_name || firstItem.name || "Produk";
                  const variantName = firstItem.variant_name || firstItem.size || "Standard";
                  itemName = `${productName} (${variantName})`;
                  if (order.items.length > 1) {
                    itemName += ` +${order.items.length - 1} lainnya`;
                  }
                }
                if (!itemName) itemName = "Extrait de Parfum";

                const statusInfo = getStatusInfo(order.status);

                return (
                  <div
                    key={order.id || order.orderId}
                    className={styles.recentOrderItem}
                  >
                    <div className={styles.orderItemInfo}>
                      <span className={styles.orderId}>
                        #{displayId.substring(0, 12)}...
                      </span>
                      <p className={styles.orderItemName}>{itemName}</p>
                    </div>
                    <div className={styles.orderItemStatus}>
                      <span
                        className={`${styles.statusBadge} ${styles[statusInfo.badgeClass]}`}
                      >
                        {statusInfo.label}
                      </span>
                      <button
                        onClick={() => {
                          const orderId = order.id || order.orderId;
                          if (orderId) {
                            router.push(`/account/orders/${orderId}`);
                          } else {
                            router.push("/account/orders");
                          }
                        }}
                        className={styles.detailsLink}
                      >
                        {overviewConfig.recentOrders.detailBtn}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className={styles.smallLoadingText}>
                {overviewConfig.recentOrders.empty}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 3. Personalized Recommendations */}
      <div className={`${styles.sectionCard} ${styles.fullWidthCard}`}>
        <div className={styles.curatedHeaderRow}>
          <h3 className={styles.cardTitle}>
            {overviewConfig.recommendations.title}
          </h3>
          <button
            onClick={() => handleNavigation("shop")}
            className={styles.seeAllLink}
          >
            {overviewConfig.recommendations.seeAll}
          </button>
        </div>
        <div className={styles.curatedList}>
          {loading ? (
            <p className={styles.smallLoadingText}>
              {overviewConfig.recommendations.loading}
            </p>
          ) : recommendedProducts.length > 0 ? (
            recommendedProducts.map((prod) => {
              const firstVariant = prod.variants?.[0] || {};
              const rawPrice = Number(
                firstVariant.price || prod.price || 0,
              );
              const discounted = getDiscountedPrice(rawPrice, activePromo);
              const priceDisplay = discounted.hasDiscount
                ? Number(discounted.price).toLocaleString("id-ID")
                : rawPrice.toLocaleString("id-ID");
              return (
                <div key={prod.id || prod._id} className={styles.curatedItem}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      prod.image_url ||
                      prod.imageUrl ||
                      "/assets/placeholder.jpg"
                    }
                    alt={prod.name}
                    className={styles.curatedThumb}
                  />
                  <div className={styles.curatedInfo}>
                    <p className={styles.curatedName}>{prod.name}</p>
                    <p className={styles.curatedSub}>
                      {firstVariant.size ? `${firstVariant.size} • ` : ""}
                      {discounted.hasDiscount && (
                        <span className={styles.curatedOriginalPrice}>
                          Rp {rawPrice.toLocaleString("id-ID")}
                        </span>
                      )}{" "}
                      <span
                        className={
                          discounted.hasDiscount
                            ? styles.curatedDiscountedPrice
                            : ""
                        }
                      >
                        Rp {priceDisplay}
                      </span>
                    </p>
                  </div>
                  <button
                    className={styles.curatedQuickAddBtn}
                    onClick={() => addToCart(prod, firstVariant, 1)}
                    title={overviewConfig.recommendations.quickAddTitle}
                  >
                    +
                  </button>
                </div>
              );
            })
          ) : (
            <p className={styles.smallLoadingText}>
              Produk rekomendasi tidak ditemukan.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}