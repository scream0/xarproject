"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./AdminDashboard.module.css";
import { logoutUser } from "@/utils/authHelpers";
import { useAdminAuth } from "@/hooks/useAdminAuth";

import adminConfig from "@/data/ui/adminConfig.json";

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
import OrdersManagement from "@/components/Dashboard/Admin/Orders/OrdersManagement";
import { AdminDashboardSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";

const DEFAULT_TAB = "overview";
const VALID_TABS = adminConfig.nav.map((item) => item.id);

function getGreetingName(currentUser) {
  return (
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    adminConfig?.greeting?.fallbackName ||
    "Admin"
  );
}

function getRoleLabel(role) {
  const normalizedRole = String(role || "").toLowerCase();
  if (normalizedRole === "superadmin") {
    return "Super Admin";
  }
  if (normalizedRole === "admin") {
    return "Admin";
  }
  return "User";
}

export default function AdminDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading, isAdmin, role, accessError } = useAdminAuth();

  const sidebarRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);
  const mainContentRef = useRef(null);

  const currentTabParam = searchParams.get("tab");
  const activeTab = VALID_TABS.includes(currentTabParam)
    ? currentTabParam
    : DEFAULT_TAB;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTopBarElevated, setIsTopBarElevated] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [storeStatus, setStoreStatus] = useState({
    latencyMs: null,
    newOrders: 0,
    hasError: false,
  });

  const navMeta = {
    overview: "Orders & growth",
    products: "Catalog & stock",
    reviews: "Customer feedback",
    analytics: "Performance insights",
    notifications: "Alerts & system updates",
    customers: "Manage customers & roles",
    settings: "Storefront controls",
    operations: "Customers, promos & reports",
    orders: "Order pipeline & fulfillment",
  };

  useEffect(() => {
    if (currentTabParam && VALID_TABS.includes(currentTabParam)) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", DEFAULT_TAB);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }, [currentTabParam, pathname, router, searchParams]);

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
      if (sidebarRef.current?.contains(event.target)) {
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
      setIsTopBarElevated(mainContentNode.scrollTop > 8);
    };

    handleScroll();
    mainContentNode.addEventListener("scroll", handleScroll);

    return () => {
      mainContentNode.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    let isDisposed = false;

    const fetchStoreStatus = async () => {
      const startedAt = performance.now();

      try {
        const token = await user?.getIdToken?.();
        const res = await fetch("/api/admin/orders?status=pending&page=1&limit=1", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Unable to refresh store status");
        }

        const elapsed = Math.round(performance.now() - startedAt);

        if (!isDisposed) {
          setStoreStatus({
            latencyMs: elapsed,
            newOrders: Number(data?.pagination?.totalOrders || 0),
            hasError: false,
          });
        }
      } catch {
        if (!isDisposed) {
          setStoreStatus((previous) => ({
            ...previous,
            hasError: true,
          }));
        }
      }
    };

    fetchStoreStatus();
    const intervalId = window.setInterval(fetchStoreStatus, 60000);

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
    };
  }, [isAdmin, user]);

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
    } catch (error) {
      console.error("Gagal logout admin:", error);
      setIsLoggingOut(false);
      setIsLogoutDialogOpen(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <>
            <OverviewStats />

            <section className={styles.workspaceArea}>
              <AnalyticsChart />
              <div className={styles.tableContainer}>
                <TransactionTable />
              </div>
            </section>
          </>
        );
      case "products":
        return (
          <section className={styles.workspaceArea}>
            <div className={styles.workspaceInner}>
              <ProductManager />
            </div>
          </section>
        );
      case "reviews":
        return (
          <section className={styles.workspaceArea}>
            <div className={styles.workspaceInner}>
              <ReviewManager />
            </div>
          </section>
        );
      case "analytics":
        return (
          <section className={styles.workspaceArea}>
            <div className={styles.workspaceInner}>
              <p className={styles.placeholderText}>
                {adminConfig.placeholders.analytics}
              </p>
              <AnalyticsChart />
              <AdvancedAnalytics />
            </div>
          </section>
        );
      case "notifications":
        return (
          <section className={styles.workspaceArea}>
            <div className={styles.workspaceInner}>
              <NotificationCenter />
            </div>
          </section>
        );
      case "customers":
        return (
          <section className={styles.workspaceArea}>
            <div className={styles.workspaceInner}>
              <UserManagement />
            </div>
          </section>
        );
      case "operations":
        return (
          <section className={styles.workspaceArea}>
            <div className={styles.workspaceInner}>
              <OperationsCenter />
            </div>
          </section>
        );
      case "orders":
        return (
          <section className={styles.workspaceArea}>
            <div className={styles.workspaceInner}>
              <OrdersManagement />
            </div>
          </section>
        );
      case "settings":
        return (
          <section className={styles.workspaceArea}>
            <div className={styles.workspaceInner}>
              <SettingsView />
            </div>
          </section>
        );
      default:
        return (
          <section className={styles.workspaceArea}>
            <div className={styles.workspaceInner}>
              <OverviewStats />
            </div>
          </section>
        );
    }
  };

  const statusText = storeStatus.hasError
    ? "Status monitor sedang offline sementara"
    : `${storeStatus.newOrders} pesanan baru menunggu diproses`;
  const latencyText = storeStatus.latencyMs
    ? `${storeStatus.latencyMs}ms latency`
    : "Checking latency...";

  if (loading) {
    return <AdminDashboardSkeleton />;
  }

  if (!isAdmin) {
    return (
      <section className={styles.accessDeniedShell}>
        <div className={styles.accessDeniedCard} role="alert">
          <p className={styles.accessDeniedEyebrow}>Restricted area</p>
          <h1 className={styles.accessDeniedTitle}>Akses Ditolak</h1>
          <p className={styles.accessDeniedText}>
            {accessError ||
              "Anda bukan Administrator. Hubungi pemilik sistem jika Anda memerlukan akses."}
          </p>
          <div className={styles.accessDeniedActions}>
            <button
              type="button"
              className={styles.accessSecondaryBtn}
              onClick={() => router.push("/dashboard")}
            >
              Kembali ke Dashboard
            </button>
            <button
              type="button"
              className={styles.accessPrimaryBtn}
              onClick={logoutUser}
            >
              Keluar Akun
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      {isMobileMenuOpen && (
        <button
          type="button"
          className={styles.mobileBackdrop}
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label={adminConfig?.aria?.menuExpanded || "Tutup menu navigasi admin"}
        />
      )}

      <div
        className={`${styles.mobileTopBar} ${isTopBarElevated ? styles.mobileTopBarElevated : ""}`}
      >
        <div className={styles.brandLogo}>
          {adminConfig.brand.name}
          <span>{adminConfig.brand.suffix}</span>
        </div>
        <button
          ref={mobileMenuButtonRef}
          type="button"
          className={styles.hamburgerBtn}
          aria-expanded={isMobileMenuOpen}
          aria-controls="admin-sidebar-drawer"
          aria-label={
            isMobileMenuOpen
              ? adminConfig?.aria?.menuExpanded || "Tutup menu navigasi admin"
              : adminConfig?.aria?.menu || "Buka menu navigasi admin"
          }
          onClick={() => setIsMobileMenuOpen((previous) => !previous)}
        >
          {isMobileMenuOpen ? "Close" : "Menu"}
        </button>
      </div>

      <aside
        id="admin-sidebar-drawer"
        ref={sidebarRef}
        className={`${styles.sidebar} ${isMobileMenuOpen ? styles.sidebarOpen : ""}`}
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
                  type="button"
                  onClick={() => handleTabChange(item.id)}
                  className={`${styles.navItem} ${
                    activeTab === item.id ? styles.navItemActive : ""
                  }`}
                  aria-current={activeTab === item.id ? "page" : undefined}
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
              <p className={styles.statusText}>{statusText}</p>
              <p className={styles.statusMetric}>{latencyText}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogoutRequest}
            className={styles.logoutBtn}
          >
            <span>{adminConfig.logoutText}</span>
          </button>
        </div>
      </aside>

      <main ref={mainContentRef} className={styles.mainContent}>
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <h1 className={styles.welcomeTitle}>
              Command Center - Halo, {getGreetingName(user)} <span className={styles.wave}>👋</span>
            </h1>
            <p className={styles.headerSubtitle}>Kelola operasional, pesanan, dan performa toko dari satu panel eksekutif.</p>
          </div>
          <div className={styles.roleChip}>
            Role: {getRoleLabel(role)}
          </div>
        </header>

        <div key={activeTab} className={`${styles.viewWrapper} ${styles.viewWrapperAnimated}`}>
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

          {renderTabContent()}
        </div>
      </main>

      {isLogoutDialogOpen && (
        <div className={styles.dialogOverlay} role="presentation">
          <div
            className={styles.logoutDialog}
            role="dialog"
            aria-modal="true"
            aria-label={adminConfig?.aria?.logoutDialog || "Dialog konfirmasi logout admin"}
          >
            <h2 className={styles.dialogTitle}>
              {adminConfig?.logoutDialog?.title || "Keluar dari panel admin?"}
            </h2>
            <p className={styles.dialogDescription}>
              {adminConfig?.logoutDialog?.description ||
                "Sesi admin akan diakhiri di perangkat ini. Pastikan proses penting sudah selesai."}
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.dialogSecondaryBtn}
                onClick={() => setIsLogoutDialogOpen(false)}
                disabled={isLoggingOut}
              >
                {adminConfig?.logoutDialog?.cancel || "Batal"}
              </button>
              <button
                type="button"
                className={styles.dialogPrimaryBtn}
                onClick={handleLogoutConfirm}
                disabled={isLoggingOut}
              >
                {isLoggingOut
                  ? "Memproses..."
                  : adminConfig?.logoutDialog?.confirm || "Ya, keluar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
