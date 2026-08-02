"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../lib/firebaseClient";
import styles from "./AdminDashboard.module.css";
import { logoutUser } from "@/utils/authHelpers"; // <-- 1. Import helper logout server-side

// Import UI Config JSON
import adminConfig from "@/data/ui/adminConfig.json";

// Import Komponen Dashboard
import AnalyticsChart from "@/components/Dashboard/Admin/Analytics/AnalyticsChart";
import AdvancedAnalytics from "@/components/Dashboard/Admin/Analytics/AdvancedAnalytics";
import TransactionTable from "@/components/Dashboard/Admin/Overview/TransactionTable";
import OverviewStats from "@/components/Dashboard/Admin/Overview/OverviewStats";
import ProductManager from "@/components/Dashboard/Admin/Products/ProductManager";
import ReviewManager from "@/components/Dashboard/Admin/Reviews/ReviewManager";
import SettingsView from "@/components/Dashboard/Admin/Settings/SettingsView";
import OperationsCenter from "@/components/Dashboard/Admin/Operations/OperationsCenter";
import NotificationCenter from "@/components/Dashboard/Admin/Notifications/NotificationCenter";
import UserManagement from "@/components/Dashboard/Admin/Operations/UserManagement";
import { AdminDashboardSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navMeta = {
    overview: "Orders & growth",
    products: "Catalog & stock",
    reviews: "Customer feedback",
    analytics: "Performance insights",
    notifications: "Alerts & system updates",
    customers: "Manage customers & roles",
    settings: "Storefront controls",
    operations: "Customers, promos & reports",
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        window.location.replace("/login");
        return;
      }

      try {
        // Validasi role ke API Route server backend
        await fetch(`/api/users?userId=${currentUser.uid}`);
      } catch (error) {
        console.error("Gagal memverifikasi hak akses admin:", error);
      }

      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    // 2. Gunakan logoutUser helper agar cookie server & firebase client terhapus bersih
    await logoutUser();
  };

  if (loading) {
    return <AdminDashboardSkeleton />;
  }

  return (
    <div className={styles.dashboardContainer}>
      {/* Mobile Top Navigation Bar */}
      <div className={styles.mobileTopBar}>
        <div className={styles.brandLogo}>
          {adminConfig.brand.name}
          <span>{adminConfig.brand.suffix}</span>
        </div>
        <button
          className={styles.hamburgerBtn}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? "✕ MENU" : "☰ MENU"}
        </button>
      </div>

      {/* Sidebar Navigasi (Desktop & Mobile Drawer) */}
      <aside
        className={`${styles.sidebar} ${
          isMobileMenuOpen ? styles.sidebarOpen : ""
        }`}
      >
        <div className={styles.brandSection}>
          <div className={styles.brandLogo}>
            {adminConfig.brand.name}
            <span>{adminConfig.brand.suffix}</span>
          </div>
          <div className={styles.brandBadge}>{adminConfig.brand.badge}</div>
          <div className={styles.brandCaption}>Commerce command center</div>
        </div>

        <nav className={styles.navContainer}>
          <ul className={styles.navigationList}>
            {adminConfig.nav.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`${styles.navItem} ${
                    activeTab === item.id ? styles.navItemActive : ""
                  }`}
                >
                  <span className={styles.navItemText}>{item.label}</span>
                  <span className={styles.navItemMeta}>{navMeta[item.id]}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarStatusCard}>
            <span className={styles.statusDot} />
            <div>
              <p className={styles.statusTitle}>Store is live</p>
              <p className={styles.statusText}>Orders and inventory are being monitored.</p>
            </div>
          </div>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            <span>{adminConfig.logoutText}</span>
          </button>
        </div>
      </aside>

      {/* Konten Utama */}
      <main className={styles.mainContent}>
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <h1 className={styles.welcomeTitle}>
              SYSTEM ACCESS:{" "}
              {user?.displayName || user?.email?.split("@")[0].toUpperCase()}
            </h1>
          </div>
        </header>

        <div className={styles.viewWrapper}>
          <div className={styles.summaryPanel}>
            <div>
              <p className={styles.summaryEyebrow}>Commerce control center</p>
              <h2 className={styles.summaryTitle}>Monitor performance, stock, and customer activity in one place.</h2>
            </div>
            <div className={styles.summaryPills}>
              <span className={styles.summaryPill}>Live operations</span>
              <span className={styles.summaryPill}>Fast decisions</span>
              <span className={styles.summaryPill}>Premium store</span>
            </div>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <>
              <OverviewStats />

              <section className={styles.workspaceArea}>
                <AnalyticsChart />
                <div className={styles.tableContainer}>
                  <TransactionTable />
                </div>
              </section>
            </>
          )}

          {/* TAB 2: INVENTORY */}
          {activeTab === "products" && (
            <section className={styles.workspaceArea}>
              <div className={styles.workspaceInner}>
                <ProductManager />
              </div>
            </section>
          )}

          {/* TAB 3: REVIEWS */}
          {activeTab === "reviews" && (
            <section className={styles.workspaceArea}>
              <div className={styles.workspaceInner}>
                <ReviewManager />
              </div>
            </section>
          )}

          {/* TAB 4: ANALYTICS */}
          {activeTab === "analytics" && (
            <section className={styles.workspaceArea}>
              <div className={styles.workspaceInner}>
                <p className={styles.placeholderText}>
                  {adminConfig.placeholders.analytics}
                </p>
                <AnalyticsChart />
                <AdvancedAnalytics />
              </div>
            </section>
          )}

          {/* TAB 5a: NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <section className={styles.workspaceArea}>
              <div className={styles.workspaceInner}>
                <NotificationCenter />
              </div>
            </section>
          )}

          {/* TAB 5b: CUSTOMERS */}
          {activeTab === "customers" && (
            <section className={styles.workspaceArea}>
              <div className={styles.workspaceInner}>
                <UserManagement />
              </div>
            </section>
          )}

          {/* TAB 6: OPERATIONS */}
          {activeTab === "operations" && (
            <section className={styles.workspaceArea}>
              <div className={styles.workspaceInner}><OperationsCenter /></div>
            </section>
          )}

          {/* TAB 5: SETTINGS */}
          {activeTab === "settings" && (
            <section className={styles.workspaceArea}>
              <div className={styles.workspaceInner}>
                <SettingsView />
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
