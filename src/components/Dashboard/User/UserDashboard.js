"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/context/StoreContext";
import styles from "./UserDashboard.module.css";
import { logoutUser } from "@/utils/authHelpers";
import { useUserDashboardData } from "@/hooks/useUserDashboardData";
import toast from "react-hot-toast";

import userConfig from "@/data/ui/userDashboardConfig.json";

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
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DEFAULT_TAB = "shop";
const VALID_TABS = userConfig.nav.map((item) => item.id);

function getGreetingName(userName) {
  return userName || userConfig.defaultCustomer;
}

export default function UserDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, userName, loading, error, retry } = useUserDashboardData();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isTopBarElevated, setIsTopBarElevated] = useState(false);

  const { cartQuantity, isCartOpen, setIsCartOpen } = useStore();
  const mainContentRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);

  const currentTabParam = searchParams.get("tab");
  const activeTab = VALID_TABS.includes(currentTabParam)
    ? currentTabParam
    : DEFAULT_TAB;

  useEffect(() => {
    if (VALID_TABS.includes(currentTabParam)) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", DEFAULT_TAB);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }, [currentTabParam, pathname, router, searchParams]);

  useEffect(() => {
    const syncWishlistCount = (nextItems) => {
      if (Array.isArray(nextItems)) {
        setWishlistCount(nextItems.length);
        return;
      }

      try {
        const savedWishlist = localStorage.getItem("shop_wishlist");
        const parsedWishlist = savedWishlist ? JSON.parse(savedWishlist) : [];
        setWishlistCount(Array.isArray(parsedWishlist) ? parsedWishlist.length : 0);
      } catch {
        setWishlistCount(0);
      }
    };

    syncWishlistCount();

    const handleWishlistUpdated = (event) => {
      syncWishlistCount(event.detail?.items);
    };

    window.addEventListener("storage", syncWishlistCount);
    window.addEventListener("wishlist-updated", handleWishlistUpdated);

    return () => {
      window.removeEventListener("storage", syncWishlistCount);
      window.removeEventListener("wishlist-updated", handleWishlistUpdated);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    let isDisposed = false;

    const loadNotificationCount = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/notifications", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await res.json();

        if (!res.ok) {
          throw new Error(result.error || "Gagal memuat notifikasi.");
        }

        if (!isDisposed) {
          const unreadCount = (result.notifications || []).filter(
            (notification) => !notification.isRead,
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

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };

    const handlePointerDown = (event) => {
      if (mobileMenuRef.current?.contains(event.target)) {
        return;
      }

      if (mobileMenuButtonRef.current?.contains(event.target)) {
        return;
      }

      setIsMobileMenuOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const mainContentNode = mainContentRef.current;

    if (!mainContentNode) {
      return undefined;
    }

    const handleScroll = () => {
      setIsTopBarElevated(mainContentNode.scrollTop > 10);
    };

    handleScroll();
    mainContentNode.addEventListener("scroll", handleScroll);

    return () => {
      mainContentNode.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleTabChange = (tabId) => {
    if (!VALID_TABS.includes(tabId)) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", tabId);
    router.push(`${pathname}?${nextParams.toString()}`, { scroll: false });
    setIsMobileMenuOpen(false);
  };

  const handleLogoutRequest = () => {
    setIsMobileMenuOpen(false);
    setIsLogoutDialogOpen(true);
  };

  const handleLogoutConfirm = async () => {
    try {
      setIsLoggingOut(true);
      await logoutUser();
    } catch (logoutError) {
      console.error(userConfig.toasts.logoutError, logoutError);
      toast.error(userConfig.toasts.logoutError);
      setIsLoggingOut(false);
      setIsLogoutDialogOpen(false);
    }
  };

  const activeTabLabel = userConfig.nav.find(
    (item) => item.id === activeTab,
  )?.label;

  if (loading) {
    return <UserDashboardSkeleton />;
  }

  return (
    <div className={styles.dashboardContainer}>
      {isMobileMenuOpen && (
        <button
          type="button"
          className={styles.mobileBackdrop}
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label={userConfig.aria.menuExpanded}
        />
      )}

      <div
        className={`${styles.mobileTopBar} ${isTopBarElevated ? styles.mobileTopBarElevated : ""}`}
      >
        <div className={styles.brandLogo}>
          {userConfig.brand.name} <span>{userConfig.brand.suffix}</span>
        </div>
        <div className={styles.mobileTopActions}>
          <button
            className={styles.cartIconBtnMobile}
            onClick={() => setIsCartOpen(true)}
            aria-label={userConfig.aria.cart}
          >
            <AppIcon name="shopping-cart" className={styles.svgIcon} />
            {cartQuantity > 0 && (
              <span
                key={`cart-mobile-${cartQuantity}`}
                className={`${styles.cartQuantityBadge} ${styles.pop}`}
              >
                {cartQuantity}
              </span>
            )}
          </button>

          <button
            ref={mobileMenuButtonRef}
            className={styles.hamburgerBtn}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? userConfig.aria.menuExpanded : userConfig.aria.menu}
            aria-expanded={isMobileMenuOpen}
            aria-haspopup="dialog"
            aria-controls="user-dashboard-navigation"
          >
            <AppIcon
              name={isMobileMenuOpen ? "x" : "menu"}
              className={styles.svgIcon}
            />
          </button>
        </div>
      </div>

      <aside
        id="user-dashboard-navigation"
        ref={mobileMenuRef}
        className={`${styles.sidebar} ${
          isMobileMenuOpen ? styles.sidebarOpen : ""
        }`}
        aria-label={userConfig.aria.menuPanel}
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
                  onClick={() => handleTabChange(item.id)}
                  className={`${styles.navItem} ${
                    activeTab === item.id ? styles.navItemActive : ""
                  }`}
                  aria-current={activeTab === item.id ? "page" : undefined}
                >
                  <span className={styles.navLabel}>{item.label}</span>
                  {(item.id === "wishlist" && wishlistCount > 0) ||
                  (item.id === "notifications" && notificationCount > 0) ? (
                    <span className={styles.navBadge}>
                      {item.id === "wishlist" ? wishlistCount : notificationCount}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.sidebarFooter}>
          <button onClick={handleLogoutRequest} className={styles.logoutBtn}>
            <span>{userConfig.logoutText}</span>
          </button>
        </div>
      </aside>

      <main ref={mainContentRef} className={styles.mainContent}>
        <header className={styles.header}>
          <div className={styles.extraNavLeft}>
            <span className={styles.navIndicator}>{activeTabLabel}</span>
          </div>

          <div className={styles.extraNavRight}>
            <div className={styles.greetingBlock}>
              <p className={styles.greetingEyebrow}>{userConfig.greeting.eyebrow}</p>
              <h1 className={styles.welcomeTitle}>
                {userConfig.greeting.prefix}, {getGreetingName(userName)} <span className={styles.greetingWave}>👋</span>
              </h1>
              <p className={styles.greetingSubtitle}>{userConfig.greeting.suffix}</p>
            </div>
            <button
              className={styles.cartIconBtnDesktop}
              onClick={() => setIsCartOpen(true)}
              aria-label={userConfig.aria.cart}
            >
              <AppIcon name="shopping-cart" className={styles.svgIcon} />
              {cartQuantity > 0 && (
                <span
                  key={`cart-desktop-${cartQuantity}`}
                  className={`${styles.cartQuantityBadge} ${styles.pop}`}
                >
                  {cartQuantity}
                </span>
              )}
            </button>
          </div>
        </header>

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

        <div key={activeTab} className={`${styles.viewWrapper} ${styles.viewWrapperAnimated}`}>
          {activeTab === "shop" && <ShopPage />}
          {activeTab === "overview" && (
            <OverviewSection setActiveTab={handleTabChange} />
          )}
          {activeTab === "orders" && <OrdersSection />}
          {activeTab === "returns" && <ReturnsCenter />}
          {activeTab === "notifications" && (
            <NotificationsSection onUnreadCountChange={setNotificationCount} />
          )}
          {activeTab === "wishlist" && <WishlistSection />}
          {activeTab === "support" && <SupportCenter />}
          {activeTab === "profile" && <ProfileSection />}
        </div>
      </main>

      <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {isLogoutDialogOpen && (
        <div className={styles.dialogOverlay} role="presentation">
          <div
            className={styles.logoutDialog}
            role="dialog"
            aria-modal="true"
            aria-label={userConfig.aria.logoutDialog}
          >
            <h2 className={styles.dialogTitle}>{userConfig.logoutDialog.title}</h2>
            <p className={styles.dialogDescription}>
              {userConfig.logoutDialog.description}
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.dialogSecondaryBtn}
                onClick={() => setIsLogoutDialogOpen(false)}
                disabled={isLoggingOut}
              >
                {userConfig.logoutDialog.cancel}
              </button>
              <button
                type="button"
                className={styles.dialogPrimaryBtn}
                onClick={handleLogoutConfirm}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? "Memproses..." : userConfig.logoutDialog.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}