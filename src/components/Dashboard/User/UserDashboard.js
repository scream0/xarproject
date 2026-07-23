"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../../../lib/firebaseClient";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { useStore } from "@/context/StoreContext";
import styles from "./UserDashboard.module.css";

// Import Konfigurasi JSON
import userConfig from "@/data/ui/userDashboardConfig.json";

// Import Komponen Section
import OverviewSection from "@/components/Dashboard/User/Overview/OverviewSection";
import OrdersSection from "@/components/Dashboard/User/Order/OrdersSection";
import ProfileSection from "@/components/Dashboard/User/Profil/ProfileSection";
import ShopPage from "@/components/Dashboard/User/Shop/ShopSection";
import { CartSidebar } from "@/components/UI/Sidebar/CartSidebar";

const db = getFirestore();

export default function UserDashboard() {
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  // Default activeTab "shop" agar langsung terbuka ke katalog e-commerce
  const [activeTab, setActiveTab] = useState("shop");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Ambil state cart dan fungsi global dari StoreContext
  const { cartQuantity, isCartOpen, setIsCartOpen } = useStore();
  const [isMounted, setIsMounted] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (cartQuantity > 0) {
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 400);
      return () => clearTimeout(timer);
    }
  }, [cartQuantity]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        window.location.href = "/login";
      } else {
        setUser(currentUser);

        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            const resolvedName =
              data.full_name ||
              data.username ||
              currentUser.displayName ||
              currentUser.email?.split("@")[0] ||
              currentUser.phoneNumber ||
              "VALUED CUSTOMER";

            setUserName(resolvedName.toUpperCase());
          } else {
            const defaultName =
              currentUser.displayName ||
              currentUser.email?.split("@")[0] ||
              currentUser.phoneNumber ||
              "VALUED CUSTOMER";

            try {
              await setDoc(
                docRef,
                {
                  uid: currentUser.uid,
                  email: currentUser.email || "",
                  phone_number: currentUser.phoneNumber || "",
                  full_name: defaultName,
                  created_at: new Date().toISOString(),
                },
                { merge: true },
              );
            } catch (createErr) {
              console.error("Gagal inisialisasi dokumen user baru:", createErr);
            }

            setUserName(defaultName.toUpperCase());
          }
        } catch (err) {
          console.error("Gagal mengambil data profil dari database:", err);

          const fallbackName =
            currentUser.displayName ||
            currentUser.email?.split("@")[0] ||
            currentUser.phoneNumber ||
            "USER";

          setUserName(fallbackName.toUpperCase());
        } finally {
          setLoading(false);
        }
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
        <p className={styles.loadingText}>{userConfig.loading}</p>
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      {/* Mobile Top Navigation Bar */}
      <div className={styles.mobileTopBar}>
        <div className={styles.brandLogo}>
          {userConfig.brand.name} <span>{userConfig.brand.suffix}</span>
        </div>
        <div
          className={styles.mobileTopActions}
          style={{ display: "flex", gap: "10px", alignItems: "center" }}
        >
          {/* Tombol Keranjang SVG di Mobile Topbar */}
          <button
            className={styles.cartIconBtnMobile}
            onClick={() => setIsCartOpen(true)}
            aria-label="Buka Keranjang"
            style={{
              background: "#27272a",
              border: "none",
              color: "#fff",
              padding: "6px 10px",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              position: "relative",
            }}
          >
            <svg
              className={styles.feather}
              style={{ width: "18px", height: "18px" }}
            >
              <use href="/assets/icon/feather-sprite.svg#shopping-cart" />
            </svg>
            {isMounted && cartQuantity > 0 && (
              <span
                style={{
                  background: "#fbbf24",
                  color: "#000",
                  padding: "1px 5px",
                  borderRadius: "4px",
                  fontSize: "0.7rem",
                  fontWeight: "bold",
                }}
              >
                {cartQuantity}
              </span>
            )}
          </button>

          {/* Tombol Hamburger SVG */}
          <button
            className={styles.hamburgerBtn}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Menu Navigasi"
            style={{
              background: "#27272a",
              border: "none",
              color: "#fff",
              padding: "6px 10px",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              className={styles.feather}
              style={{ width: "20px", height: "20px" }}
            >
              <use
                href={`/assets/icon/feather-sprite.svg#${
                  isMobileMenuOpen ? "x" : "menu"
                }`}
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Sidebar Navigasi (Desktop & Mobile Drawer) */}
      <aside
        className={`${styles.sidebar} ${
          isMobileMenuOpen ? styles.sidebarOpen : ""
        }`}
      >
        <div className={styles.brandSection}>
          <div className={styles.brandLogo}>
            {userConfig.brand.name} <span>{userConfig.brand.suffix}</span>
          </div>
          <div className={styles.brandBadge}>{userConfig.brand.badge}</div>
        </div>

        <nav className={styles.navContainer}>
          <ul className={styles.navigationList}>
            {userConfig.nav.map((item) => (
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
            <span>{userConfig.logoutText}</span>
          </button>
        </div>
      </aside>

      {/* Konten Utama */}
      <main className={styles.mainContent}>
        <header className={styles.header}>
          <div className={styles.extraNavLeft}>
            <span className={styles.navIndicator}>
              {activeTab === "shop"
                ? "Katalog Toko"
                : activeTab === "overview"
                  ? "Ringkasan"
                  : activeTab === "orders"
                    ? "Riwayat Pesanan"
                    : "Profil Saya"}
            </span>
          </div>

          <div
            className={styles.extraNavRight}
            style={{ display: "flex", alignItems: "center", gap: "15px" }}
          >
            <h1 className={styles.welcomeTitle}>
              WELCOME, {userName || "USER"}
            </h1>
          </div>
        </header>

        <div className={styles.viewWrapper}>
          {activeTab === "shop" && <ShopPage />}
          {activeTab === "overview" && (
            <OverviewSection setActiveTab={setActiveTab} />
          )}
          {activeTab === "orders" && <OrdersSection />}
          {activeTab === "profile" && <ProfileSection />}
        </div>
      </main>

      {/* Cart Sidebar Global */}
      <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}
