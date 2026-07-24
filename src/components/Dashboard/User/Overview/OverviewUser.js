"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import styles from "./OverviewUser.module.css";
import { auth } from "@/lib/firebaseClient";
import { useStore } from "@/context/StoreContext";
import toast from "react-hot-toast";
import overviewConfig from "@/data/ui/overviewUserConfig.json";

export default function OverviewSection({ setActiveTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const { products, setIsCartOpen, addToCart } = useStore();

  const [stats, setStats] = useState({
    totalOrders: 0,
    totalSpent: 0,
    processingOrders: 0,
  });
  const [userProfile, setUserProfile] = useState({
    fullName: "",
    username: "",
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentUser = auth.currentUser;

  useEffect(() => {
    async function fetchDashboardData() {
      if (!currentUser) return;

      try {
        const orderRes = await fetch(`/api/orders?userId=${currentUser.uid}`);
        if (!orderRes.ok)
          throw new Error(overviewConfig.toasts.fetchOrdersError);

        const orderResult = await orderRes.json();
        const orderData = orderResult.orders || [];

        setUserProfile({
          fullName:
            orderResult.primaryAddress?.split(" - ")[0]?.split(" (")[0] ||
            currentUser.displayName ||
            overviewConfig.welcomeBanner.defaultGuest,
          username: currentUser.email,
        });

        const total = orderData.length;
        const completedOrders = orderData.filter((o) =>
          ["completed", "success", "shipping"].includes(o.status),
        );
        const totalSpent = completedOrders.reduce(
          (sum, o) => sum + Number(o.price || o.rawPrice || 0),
          0,
        );
        const processing = total - completedOrders.length;

        setStats({
          totalOrders: total,
          totalSpent: totalSpent,
          processingOrders: processing,
        });

        setRecentOrders(orderData.slice(0, 3));

        if (products.length > 0) {
          const purchasedProductIds = new Set(
            orderData.flatMap((o) => o.items.map((i) => i.id)),
          );
          let recommendations = products.filter((p) =>
            purchasedProductIds.has(p.id),
          );

          if (recommendations.length < 3) {
            const additionalProducts = products.filter(
              (p) => !purchasedProductIds.has(p.id),
            );
            recommendations = [
              ...recommendations,
              ...additionalProducts.slice(0, 3 - recommendations.length),
            ];
          }
          setRecommendedProducts(recommendations.slice(0, 3));
        }
      } catch (err) {
        console.error("Gagal memuat ringkasan dashboard:", err);
        toast.error(overviewConfig.toasts.fetchSummaryError);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [currentUser, products]);

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

  return (
    <div className={styles.overviewWorkspace}>
      {/* 1. Metric Cards Grid */}
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
      </div>

      {/* 2. Welcome Banner & Recent Orders */}
      <div className={styles.overviewGridTwo}>
        <div className={styles.sectionCard}>
          <div className={styles.welcomeBadge}>
            {overviewConfig.welcomeBanner.badge}
          </div>
          <h3 className={styles.cardTitle}>
            {overviewConfig.welcomeBanner.titlePrefix}{" "}
            <span>
              {userProfile.fullName.toUpperCase() ||
                overviewConfig.welcomeBanner.defaultGuest}
            </span>
          </h3>
          <p className={styles.cardDesc}>{overviewConfig.welcomeBanner.desc}</p>
          <div className={styles.actionButtonGroup}>
            <button
              className={styles.btnPrimary}
              onClick={() => handleNavigation("shop")}
            >
              {overviewConfig.welcomeBanner.buttons.catalog}
            </button>
            <button
              className={styles.btnOutline}
              onClick={() => handleNavigation("orders")}
            >
              {overviewConfig.welcomeBanner.buttons.orders}
            </button>
            <button
              className={styles.btnOutline}
              onClick={() => setIsCartOpen(true)}
              style={{
                borderColor: "rgba(var(--primary-accent-rgb), 0.4)",
                color: "var(--primary-accent)",
              }}
            >
              {overviewConfig.welcomeBanner.buttons.cart}
            </button>
          </div>
        </div>

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
              recentOrders.map((order) => (
                <div key={order.id} className={styles.recentOrderItem}>
                  <div className={styles.orderItemInfo}>
                    <span className={styles.orderId}>
                      #{order.id.substring(0, 12)}...
                    </span>
                    <p className={styles.orderItemName}>{order.name}</p>
                  </div>
                  <div className={styles.orderItemStatus}>
                    <span
                      className={`${styles.statusBadge} ${styles[order.status]}`}
                    >
                      {order.status}
                    </span>
                    <button
                      onClick={() => handleNavigation("orders")}
                      className={styles.detailsLink}
                    >
                      {overviewConfig.recentOrders.detailBtn}
                    </button>
                  </div>
                </div>
              ))
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
          ) : (
            recommendedProducts.map((prod) => {
              const firstVariant = prod.variants?.[0] || {};
              const price = firstVariant.price
                ? Number(firstVariant.price).toLocaleString("id-ID")
                : prod.price
                  ? Number(prod.price).toLocaleString("id-ID")
                  : "0";
              return (
                <div key={prod.id || prod._id} className={styles.curatedItem}>
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
                      {firstVariant.size ? `${firstVariant.size} • ` : ""}Rp{" "}
                      {price}
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
          )}
        </div>
      </div>
    </div>
  );
}
