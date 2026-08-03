"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../lib/firebaseClient";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { useStore } from "@/context/StoreContext";
import styles from "./UserDashboard.module.css";
import { logoutUser } from "@/utils/authHelpers"; // <-- 1. Import helper logout server-side

// Import Konfigurasi JSON
import userConfig from "@/data/ui/userDashboardConfig.json";

// Import Komponen Section
import OverviewSection from "@/components/Dashboard/User/Overview/OverviewUser";
import OrdersSection from "@/components/Dashboard/User/Order/OrdersSection";
import ReturnsCenter from "@/components/Dashboard/User/Returns/ReturnsCenter";
import SupportCenter from "@/components/Dashboard/User/Support/SupportCenter";
import ProfileSection from "@/components/Dashboard/User/Profil/UserProfil";
import ShopPage from "@/components/Dashboard/User/Shop/Shop";
import NotificationsSection from "@/components/Dashboard/User/Notifications/NotificationsSection";
import WishlistSection from "@/components/Dashboard/User/Wishlist/WishlistSection";
import { CartSidebar } from "@/components/UI/Sidebar/CartSidebar";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { UserDashboardSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
  const pathname = usePathname();

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
        window.location.replace("/login");
      } else {
        setUser(currentUser);

        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();

            // Ambil Nama Asli secara dinamis dari database Firestore (full_name atau username)
            const resolvedName =
              data.full_name?.trim() ||
              data.username?.trim() ||
              currentUser.displayName?.trim() ||
              currentUser.phoneNumber ||
              currentUser.email?.split("@")[0] ||
              userConfig.defaultCustomer;

            setUserName(resolvedName);
          } else {
            const defaultName =
              currentUser.displayName?.trim() ||
              currentUser.phoneNumber ||
              currentUser.email?.split("@")[0] ||
              userConfig.defaultCustomer;

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
              console.error(userConfig.toasts.initError, createErr);
            }

            setUserName(defaultName);
          }
        } catch (err) {
          console.error(userConfig.toasts.fetchError, err);

          const fallbackName =
            currentUser.displayName?.trim() ||
            currentUser.phoneNumber ||
            currentUser.email?.split("@")[0] ||
            userConfig.defaultUser;

          setUserName(fallbackName);
        } finally {
          setLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    // 2. Gunakan logoutUser helper agar cookie server & firebase client terhapus bersih
    await logoutUser();
  };

  const activeTabLabel = userConfig.nav.find(
    (item) => item.id === activeTab,
  )?.label;

  useEffect(() => {
    if (pathname?.startsWith("/account/orders")) {
      setActiveTab("orders");
    }
  }, [pathname]);

  if (loading) {
    return <UserDashboardSkeleton />;
  }

  return (
    <div className={styles.dashboardContainer}>
      {/* Mobile Top Navigation Bar */}
      <div className={styles.mobileTopBar}>
        <div className={styles.brandLogo}>
          {userConfig.brand.name} <span>{userConfig.brand.suffix}</span>
        </div>
        <div className={styles.mobileTopActions}>
          {/* Tombol Keranjang SVG di Mobile Topbar */}
          <button
            className={styles.cartIconBtnMobile}
            onClick={() => setIsCartOpen(true)}
            aria-label={userConfig.aria.cart}
          >
            <AppIcon name="shopping-cart" className={styles.svgIcon} />
            {isMounted && cartQuantity > 0 && (
              <span
                className={`${styles.cartQuantityBadge} ${animate ? styles.pop : ""}`}
              >
                {cartQuantity}
              </span>
            )}
          </button>

          {/* Tombol Hamburger SVG */}
          <button
            className={styles.hamburgerBtn}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={userConfig.aria.menu}
          >
            <AppIcon
              name={isMobileMenuOpen ? "x" : "menu"}
              className={styles.svgIcon}
            />
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
                {item.id === "orders" ? (
                  <Link
                    href="/account/orders"
                    className={`${styles.navItem} ${
                      activeTab === item.id ? styles.navItemActive : ""
                    }`}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <span>{item.label}</span>
                  </Link>
                ) : (
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
                )}
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
            <span className={styles.navIndicator}>{activeTabLabel}</span>
          </div>

          <div className={styles.extraNavRight}>
            <h1 className={styles.welcomeTitle}>
              WELCOME, {userName || userConfig.defaultUser}
            </h1>
            {/* Tombol Keranjang untuk Desktop/Tab (Top bar mobile disembunyikan >= 1024px) */}
            <button
              className={styles.cartIconBtnDesktop}
              onClick={() => setIsCartOpen(true)}
              aria-label={userConfig.aria.cart}
            >
              <AppIcon name="shopping-cart" className={styles.svgIcon} />
              {isMounted && cartQuantity > 0 && (
                <span
                  className={`${styles.cartQuantityBadge} ${animate ? styles.pop : ""}`}
                >
                  {cartQuantity}
                </span>
              )}
            </button>
          </div>
        </header>

        <div className={styles.viewWrapper}>
          {activeTab === "shop" && <ShopPage />}
          {activeTab === "overview" && (
            <OverviewSection setActiveTab={setActiveTab} />
          )}
          {activeTab === "orders" && <OrdersSection />}
          {activeTab === "returns" && <ReturnsCenter />}
          {activeTab === "notifications" && <NotificationsSection />}
          {activeTab === "wishlist" && <WishlistSection />}
          {activeTab === "support" && <SupportCenter />}
          {activeTab === "profile" && <ProfileSection />}
        </div>
      </main>

      {/* Cart Sidebar Global */}
      <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}