"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/context/StoreContext";
import styles from "./UserDashboard.module.css";
import { useUserDashboardData } from "@/hooks/useUserDashboardData";
import { auth } from "@/lib/supabaseClient";
import { logoutUser } from "@/utils/authHelpers";
import toast from "react-hot-toast";

import userConfig from "@/data/ui/userDashboardConfig.json";

import OverviewSection from "@/components/Dashboard/User/Overview/OverviewUser";
import ProfileSection from "@/components/Dashboard/User/Profil/UserProfil";
import ShopPage from "@/components/Dashboard/User/Shop/Shop";
import NotificationsSection from "@/components/Dashboard/User/Notifications/NotificationsSection";
import OrdersSection from "@/components/Dashboard/User/Order/OrdersSection";
import { CartSidebar } from "@/components/UI/Sidebar/CartSidebar";
import { Modal as ProductModal } from "@/components/UI/Modal/ProductModal";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { UserDashboardSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import UserChatModal from "@/components/Dashboard/User/Chat/UserChatModal";

const DEFAULT_TAB = "shop";
const ALLOWED_TABS = ["shop", "overview", "orders", "notifications", "profile"];
const filteredNav = userConfig.nav.filter((item) => ALLOWED_TABS.includes(item.id));
const VALID_TABS = filteredNav.map((item) => item.id);

function getGreetingName(userName) {
  return userName || userConfig.defaultCustomer;
}

export default function UserDashboard({ user }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { userName, loading, error, retry } = useUserDashboardData();
  const [notificationCount, setNotificationCount] = useState(0);

  const { isCartOpen, setIsCartOpen, cartQuantity, addToCart, rupiah } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const currentTabParam = searchParams.get("tab");
  
  // Tentukan active tab secara aman tanpa memicu redirect paksa di awal
  const activeTab = VALID_TABS.includes(currentTabParam)
    ? currentTabParam
    : DEFAULT_TAB;

  // Hapus useEffect router.replace yang memicu loop/refresh tidak perlu di awal load.
  // Cukup tangani perubahan tab lewat interaksi klik menu.

  useEffect(() => {
    if (!user) {
      return;
    }

    let isDisposed = false;

    const loadNotificationCount = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/notifications", {
          headers: { Authorization: `Bearer ${token}` },
        });
        let result = {};
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const text = await res.text();
          try {
            result = text ? JSON.parse(text) : {};
          } catch (e) {
            console.error("Gagal parse JSON notifikasi:", e);
          }
        }

        if (!res.ok) {
          throw new Error(result.error || "Gagal memuat notifikasi.");
        }

        if (!isDisposed) {
          const unreadCount = (result.notifications || []).filter(
            (notification) => !notification.is_read
          ).length;
          setNotificationCount(unreadCount);
        }
      } catch {
        if (!isDisposed) {
          setNotificationCount(0);
        }
      }
    };

    loadNotificationCount();

    return () => {
      isDisposed = true;
    };
  }, [user]);

  const handleTabChange = (tabId) => {
    if (!VALID_TABS.includes(tabId)) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", tabId);
    router.push(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };

  const handleBukaDetail = (product) => {
    if (!product || !product.id) {
      toast.error("Produk tidak valid.");
      return;
    }
    setSelectedProduct(product);
    setIsProductModalOpen(true);
  };

  const handleLogout = async () => {
    toast.loading("Keluar dari sesi...", { id: "user-logout" });
    await logoutUser();
  };

  if (loading) {
    return <UserDashboardSkeleton />;
  }

  return (
    <div className={styles.dashboardContainer}>
      {/* Desktop Sidebar */}
      <aside
        id="user-dashboard-navigation"
        className={styles.sidebar}
        aria-label={userConfig.aria.menuPanel}
      >
        <div className={styles.brandSection}>
          <div className={styles.brandLogo}>
            {userConfig.brand.name} <span>{userConfig.brand.suffix}</span>
          </div>

          {/* User Greeting & Name inside Sidebar Header */}
          <div className={styles.sidebarUserGreeting}>
            <p className={styles.greetingEyebrow}>{userConfig.greeting.eyebrow}</p>
            <h2 className={styles.welcomeTitle}>
              {userConfig.greeting.prefix}, {getGreetingName(userName)} <span className={styles.greetingWave}>👋</span>
            </h2>
          </div>
        </div>

        <nav className={styles.navContainer}>
          <ul className={styles.navigationList}>
            {filteredNav.map((item) => {
              const isActive = activeTab === item.id;
              const badgeCount =
                item.id === "notifications" ? notificationCount : 0;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleTabChange(item.id)}
                    className={`${styles.navItem} ${
                      isActive ? styles.navItemActive : ""
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <AppIcon name={item.icon || "circle"} className={styles.navIcon} />
                    <span className={styles.navLabel}>{item.label}</span>
                    {badgeCount > 0 && (
                      <span className={styles.navBadge}>{badgeCount}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={styles.sidebarFooter}>
          <button onClick={handleLogout} className={styles.logoutBtn} aria-label="Keluar dari akun">
            <AppIcon name="log-out" size={18} />
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={styles.mainContent}>
        {/* Navbar Atas Melayang */}
        <div className={styles.shopNavbar}>
          <div className={styles.navbarSearchWrapper}>
            <AppIcon name="search" className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Cari parfum..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInputNavbar}
            />
          </div>
          <div className={styles.navbarActions}>
            <button
              className={styles.chatIconBtnNavbar}
              onClick={() => setIsChatOpen(true)}
              aria-label="Chat"
            >
              <AppIcon name="message-circle" className={styles.svgIcon} />
            </button>
            <button
              className={styles.cartIconBtnNavbar}
              onClick={() => setIsCartOpen(true)}
              aria-label="Keranjang"
            >
              <AppIcon name="shopping-cart" className={styles.svgIcon} />
              {cartQuantity > 0 && (
                <span className={styles.cartQuantityBadge}>
                  {cartQuantity}
                </span>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className={styles.errorBanner} role="alert">
            <div>
              <strong>{userConfig.messages.loadUserError}</strong>
            </div>
            <button className={styles.errorRetryBtn} onClick={retry}>
              {userConfig.messages.retry}
            </button>
          </div>
        )}

        {/* Hapus key={activeTab} agar konten tidak ter-unmount ulang yang menyebabkan kedipan/refresh */}
        <div className={`${styles.viewWrapper} ${styles.viewWrapperAnimated}`}>
          {activeTab === "shop" && <ShopPage searchQuery={searchQuery} onBukaDetail={handleBukaDetail} />}
          {activeTab === "overview" && (
            <OverviewSection setActiveTab={handleTabChange} />
          )}
          {activeTab === "orders" && <OrdersSection />}
          <div style={{ display: activeTab === "notifications" ? "block" : "none" }}>
            <NotificationsSection onUnreadCountChange={setNotificationCount} />
          </div>
          {activeTab === "profile" && <ProfileSection />}
        </div>
      </main>

      {/* Mobile Floating Bottom Navigation (Android Style) */}
      <nav className={styles.mobileBottomNav} aria-label="Mobile Bottom Navigation">
        {filteredNav.map((item) => {
          const isActive = activeTab === item.id;
          const badgeCount =
            item.id === "notifications" ? notificationCount : 0;

          return (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`${styles.mobileBottomNavItem} ${
                isActive ? styles.mobileBottomNavItemActive : ""
              }`}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <div className={styles.mobileNavIconWrapper}>
                <AppIcon name={item.icon || "circle"} className={styles.mobileNavSvg} />
                {badgeCount > 0 && (
                  <span className={styles.mobileNavBadge}>{badgeCount}</span>
                )}
              </div>
              <span className={styles.mobileNavLabel}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modals & Overlays */}
      <UserChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        user={user}
      />
      
      <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Modal Detail Produk */}
      {isProductModalOpen && selectedProduct && (
        <ProductModal
          isOpen={isProductModalOpen}
          item={selectedProduct}
          onClose={() => {
            setIsProductModalOpen(false);
            setSelectedProduct(null);
          }}
          onAddToCart={addToCart}
          rupiah={rupiah}
        />
      )}
    </div>
  );
}