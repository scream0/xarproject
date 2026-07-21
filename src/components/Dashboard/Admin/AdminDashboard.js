"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../../../lib/firebaseClient";
import styles from "./AdminDashboard.module.css";

// Import UI Config JSON
import adminConfig from "@/data/ui/adminConfig.json";

// Import Komponen Dashboard
import AnalyticsChart from "@/app/api/analytics/AnalyticsChart";
import TransactionTable from "@/components/Dashboard/Admin/TransactionTable";
import ProductManager from "@/components/Dashboard/Admin/ProductManager";

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        window.location.href = "/login";
      } else {
        setUser(currentUser);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = "/login";
    } catch (error) {
      console.error("Gagal logout:", error);
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
                    setIsMobileMenuOpen(false); // Tutup menu otomatis di mobile saat diklik
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
              {user?.displayName || user?.email?.split("@")[0].toUpperCase()}
            </h1>
          </div>
        </header>

        <div className={styles.viewWrapper}>
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <>
              <section className={styles.statsGrid}>
                {adminConfig.stats.map((stat, idx) => (
                  <div key={idx} className={styles.card}>
                    {stat}
                  </div>
                ))}
              </section>
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
              </div>
            </section>
          )}

          {/* TAB 4: SETTINGS */}
          {activeTab === "settings" && (
            <section className={styles.workspaceArea}>
              <div className={styles.workspaceInner}>
                <p className={styles.placeholderText}>
                  {adminConfig.placeholders.settings}
                </p>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
