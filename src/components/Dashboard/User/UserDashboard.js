"use client";
import { useState } from "react";
import styles from "./UserDashboard.module.css";
import { signOut } from "firebase/auth";
import { auth } from "../../../lib/firebaseClient";

export default function UserDashboard({ user }) {
  const [activeTab, setActiveTab] = useState("overview");
  // handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = "/login";
    } catch (error) {
      console.error("Gagal logout:", error);
    }
  };

  return (
    <div className={styles.dashboardContainer}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>MAKE ME KOOL PARFUM</div>
        <nav className={styles.nav}>
          <button
            onClick={() => setActiveTab("overview")}
            className={activeTab === "overview" ? styles.active : ""}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={activeTab === "orders" ? styles.active : ""}
          >
            Orders
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={activeTab === "profile" ? styles.active : ""}
          >
            Profile
          </button>
        </nav>
        {/* 4. Tombol Logout di paling bawah sidebar */}
        <div className={styles.sidebarFooter}>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            Sign Out
          </button>
        </div>
      </aside>

      <main className={styles.mainContent}>
        <header className={styles.header}>
          <h1>Welcome, {user?.displayName || "CLIENT"}</h1>
          <p>Accessing your personal scent archive.</p>
        </header>

        <section className={styles.contentArea}>
          {activeTab === "overview" && (
            <div className={styles.card}>
              <h3>LATEST ACTIVITY</h3>
              <p>No recent shipments found.</p>
            </div>
          )}
          {activeTab === "orders" && (
            <div className={styles.card}>
              <h3>ORDER HISTORY</h3>
              <p>Your history is empty.</p>
            </div>
          )}
          {activeTab === "profile" && (
            <div className={styles.card}>
              <h3>ACCOUNT SETTINGS</h3>
              <p>Edit your personal details here.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
