"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import styles from "./AdminDashboard.module.css";

// Import UI Config JSON
import adminConfig from "@/data/ui/adminConfig.json";

// Import Komponen Dashboard
import AnalyticsChart from "@/components/Dashboard/Analytics/AnalyticsChart";
import AdvancedAnalytics from "@/components/Dashboard/Analytics/AdvancedAnalytics";
import TransactionTable from "@/components/Dashboard/Overview/TransactionTable";
import OverviewStats from "@/components/Dashboard/Overview/OverviewStats";
import ProductManager from "@/components/Dashboard/Products/ProductManager";
import SettingsView from "@/components/Dashboard/Settings/SettingsView";

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Cek sesi aktif dari Supabase saat pertama kali dimuat
    const checkUserSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!session || error) {
        window.location.href = "/login";
        return;
      }

      setUser(session.user);
      setLoading(false);
    };

    checkUserSession();

    // Pantau perubahan status auth secara real-time via Supabase
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        window.location.href = "/login";
      } else {
        setUser(session.user);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (error) {
      console.error("Gagal logout dari Supabase:", error);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.pulseScanner}></div>
        <p className={styles.loadingText}>{adminConfig.loading}</p>
      </div>
    );
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
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.sidebarFooter}>
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
              {user?.email?.split("@")[0].toUpperCase() || "ADMIN"}
            </h1>
          </div>
        </header>

        <div className={styles.viewWrapper}>
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <>
              {/* Kartu Statistik Dinamis dari Supabase */}
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

          {/* TAB 3: ANALYTICS */}
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

          {/* TAB 4: SETTINGS */}
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
