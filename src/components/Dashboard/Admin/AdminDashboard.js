"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../../../lib/firebaseClient";
import styles from "./AdminDashboard.module.css";

// Import Komponen Dashboard
import AnalyticsChart from "@/app/api/analytics/AnalyticsChart";
import TransactionTable from "@/components/Dashboard/Admin/TransactionTable";
import ProductManager from "@/components/Dashboard/Admin/ProductManager"; // Pastikan path ini benar

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

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
        <p className={styles.loadingText}>LOADING EXECUTIVE SYSTEM...</p>
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      <aside className={styles.sidebar}>
        <div className={styles.brandSection}>
          <div className={styles.brandLogo}>
            XAR<span>.HQ</span>
          </div>
          <div className={styles.brandBadge}>OWNER PANEL</div>
        </div>

        <nav className={styles.navContainer}>
          <ul className={styles.navigationList}>
            {/* Nav Item: Overview */}
            <li>
              <button
                onClick={() => setActiveTab("overview")}
                className={`${styles.navItem} ${activeTab === "overview" ? styles.navItemActive : ""}`}
              >
                <span>Overview</span>
              </button>
            </li>
            {/* Nav Item: Inventory (Produk) */}
            <li>
              <button
                onClick={() => setActiveTab("products")}
                className={`${styles.navItem} ${activeTab === "products" ? styles.navItemActive : ""}`}
              >
                <span>Inventory</span>
              </button>
            </li>
            {/* Nav Item: Analytics */}
            <li>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`${styles.navItem} ${activeTab === "analytics" ? styles.navItemActive : ""}`}
              >
                <span>Analytics</span>
              </button>
            </li>
            {/* Nav Item: Settings */}
            <li>
              <button
                onClick={() => setActiveTab("settings")}
                className={`${styles.navItem} ${activeTab === "settings" ? styles.navItemActive : ""}`}
              >
                <span>Settings</span>
              </button>
            </li>
          </ul>
        </nav>

        <div className={styles.sidebarFooter}>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            <span>Sign Out Control</span>
          </button>
        </div>
      </aside>

      <main className={styles.mainContent}>
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <h1 className={styles.welcomeTitle}>
              SYSTEM ACCESS:{" "}
              {user?.displayName || user?.email?.split("@")[0].toUpperCase()}
            </h1>
          </div>
        </header>

        {/* Dashboard Dynamic View Matrix */}
        <div className={styles.viewWrapper}>
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <>
              <section className={styles.statsGrid}>
                <div className={styles.card}>BRAND MATRICES</div>
                <div className={styles.card}>SECURITY NODE</div>
                <div className={styles.card}>CORE VAULT</div>
              </section>
              <section className={styles.workspaceArea}>
                <AnalyticsChart />
                <div className={styles.tableContainer}>
                  <TransactionTable />
                </div>
              </section>
            </>
          )}

          {/* TAB 2: INVENTORY (Produk & Update) */}
          {activeTab === "products" && (
            <section className={styles.workspaceArea}>
              <div className={styles.workspaceInner}>
                <ProductManager /> {/* Komponen yang tadi kita buat */}
              </div>
            </section>
          )}

          {/* TAB 3: ANALYTICS */}
          {activeTab === "analytics" && (
            <section className={styles.workspaceArea}>
              <div className={styles.workspaceInner}>
                <p className={styles.placeholderText}>
                  [ ANALYTICS CORE DATASTREAM ]
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
                  [ SYSTEM CONFIGURATION ]
                </p>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
