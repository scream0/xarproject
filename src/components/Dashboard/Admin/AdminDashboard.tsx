// @ts-nocheck
"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Star,
  TrendingUp,
  Bell,
  Users,
  Activity,
  ShoppingCart,
  Settings,
  Menu,
  X,
  Sparkles,
  MessageSquare,
  LogOut
} from "lucide-react";
import styles from "./AdminDashboard.module.css";
import { logoutUser } from "@/utils/authHelpers";
import { useAdminAuth } from "@/hooks/useAdminAuth";

import dynamic from "next/dynamic";
import adminConfig from "@/data/ui/adminConfig.json";
import { supabase } from "@/lib/supabaseClient";
import { Logo } from "@/components/UI/Logo/logo";

const AnalyticsChart = dynamic(() => import("@/components/Dashboard/Admin/Analytics/AnalyticsChart"), {
  loading: () => <p>Loading chart...</p>,
  ssr: false
});
const AdvancedAnalytics = dynamic(() => import("@/components/Dashboard/Admin/Analytics/AdvancedAnalytics"), {
  loading: () => <p>Loading analytics...</p>,
  ssr: false
});
import OverviewStats from "@/components/Dashboard/Admin/Overview/OverviewStats";
import TransactionTable from "@/components/Dashboard/Admin/Overview/TransactionTable";
import ProductManager from "@/components/Dashboard/Admin/Products/ProductManager";
import ReviewManager from "@/components/Dashboard/Admin/Reviews/ReviewManager";
import SettingsView from "@/components/Dashboard/Admin/Settings/SettingsView";
import PromoManagement from "@/components/Dashboard/Admin/Promotions/PromoManagement";
import NotificationCenter from "@/components/Dashboard/Admin/Notifications/NotificationCenter";
import UserManagement from "@/components/Dashboard/Admin/Settings/UserManagement";
import OrdersManagement from "@/components/Dashboard/Admin/Orders/OrdersManagement";
import AdminChatView from "@/components/Dashboard/Admin/Chat/AdminChatView";
import { AdminDashboardSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";

const DEFAULT_TAB = "overview";
const VALID_TABS = adminConfig.nav.map((item) => item.id);

// Mapping ikon untuk setiap tab navigasi
const NAV_ICONS = {
  overview: LayoutDashboard,
  products: Package,
  reviews: Star,
  analytics: TrendingUp,
  notifications: Bell,
  customers: Users,
  vouchers: Activity,
  orders: ShoppingCart,
  settings: Settings,
  chat: MessageSquare,
};

function getGreetingName(currentUser: any) {
  return (
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    adminConfig?.greeting?.fallbackName ||
    "Admin"
  );
}

function getRoleLabel(role: any) {
  const normalizedRole = String(role || "").toLowerCase();
  if (normalizedRole === "superadmin") {
    return "Super Admin";
  }
  if (normalizedRole === "admin") {
    return "Admin";
  }
  return "User";
}

function formatTemplate(template, payload: any) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => {
    return Object.prototype.hasOwnProperty.call(payload, key)
      ? String(payload[key])
      : "";
  });
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
  const [overviewTab, setOverviewTab] = useState("stats");
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const unreadChatCountRef = useRef(0);
  const [isTopBarElevated, setIsTopBarElevated] = useState(false);
  const [adminLocale, setAdminLocale] = useState(() => {
    if (typeof window === "undefined") {
      return "id";
    }
    return window.localStorage.getItem("adminLocale") === "en" ? "en" : "id";
  });
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [storeStatus, setStoreStatus] = useState({
    latencyMs: null,
    newOrders: 0,
    hasError: false,
  });

  const navMeta = {
    overview: "Pertumbuhan & ikhtisar",
    products: "Katalog & stok",
    reviews: "Ulasan pelanggan",
    analytics: "Wawasan kinerja",
    notifications: "Peringatan & sistem",
    settings: "Kontrol toko",
    vouchers: "Diskon & voucher",
    orders: "Manajemen pesanan",
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

    const handleKeyDown = (event: any) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };

    const handlePointerDown = (event: any) => {
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

  const fetchStoreStatus = async (isDisposedObj: any) => {
    const startedAt = performance.now();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/orders?status=pending,paid,processing,verifying&page=1&limit=1", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});

      if (!res.ok) {
        throw new Error(data?.error || "Unable to refresh store status");
      }

      const elapsed = Math.round(performance.now() - startedAt);

      if (!isDisposedObj?.current) {
        setStoreStatus({
          latencyMs: elapsed,
          newOrders: Number(data?.pagination?.totalOrders ?? data?.total ?? 0),
          hasError: false,
        });
      }
    } catch {
      if (!isDisposedObj?.current) {
        setStoreStatus((previous) => ({
          ...previous,
          hasError: true,
        }));
      }
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const isDisposedObj = { current: false };

    fetchStoreStatus(isDisposedObj);
    const intervalId = window.setInterval(() => fetchStoreStatus(isDisposedObj), 30000);

    // Realtime badge updates for orders
    const ordersChannel = supabase
      .channel("admin-dashboard-orders-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchStoreStatus(isDisposedObj);
        },
      )
      .subscribe();

    return () => {
      isDisposedObj.current = true;
      window.clearInterval(intervalId);
      supabase.removeChannel(ordersChannel);
    };
  }, [isAdmin, user]);

  useEffect(() => {
    const handleLocaleEvent = (event: any) => {
      const nextLocale =
        event?.detail?.locale === "en" || event?.detail?.locale === "id"
          ? event.detail.locale
          : "id";
      setAdminLocale(nextLocale);
    };

    const handleStorage = (event: any) => {
      if (event.key !== "adminLocale") {
        return;
      }
      setAdminLocale(event.newValue === "en" ? "en" : "id");
    };

    window.addEventListener("admin-locale-change", handleLocaleEvent);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("admin-locale-change", handleLocaleEvent);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const copy =
    adminConfig?.copyLocales?.[adminLocale] ||
    adminConfig?.copyLocales?.id ||
    adminConfig?.copy ||
    {};

  // Fetch unread chat count on mount & subscribe realtime — badge muncul tanpa klik tab chat
  useEffect(() => {
    if (!isAdmin) return;

    const fetchUnreadCount = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/chats", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (res.ok && result.success) {
          const total = (result.data || []).reduce((sum, c: any) => sum + (c.unread_count || 0), 0);
          setUnreadChatCount(total);
        }
      } catch (err) {
        console.error("Error fetching unread chat count:", err);
      }
    };

    // Debounce: kalau ada burst pesan masuk, tunggu 500ms setelah event terakhir baru query
    let debounceTimer = null;
    const debouncedFetch = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fetchUnreadCount, 500);
    };

    fetchUnreadCount(); // initial fetch langsung tanpa debounce

    const channel = supabase
      .channel("admin_dashboard_chat_badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, debouncedFetch)
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  const handleTabChange = (tabId: any) => {
    if (!VALID_TABS.includes(tabId)) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", tabId);
    router.push(`${pathname}?${nextParams.toString()}`, { scroll: false });
    setIsMobileMenuOpen(false);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <>
            {/* Sub-tabs Ringkasan */}
            <div className={styles.overviewSubTabs}>
              <button
                className={`${styles.overviewSubTab} ${overviewTab === "stats" ? styles.overviewSubTabActive : ""}`}
                onClick={() => setOverviewTab("stats")}
              >
                📊 Statistik
              </button>
              <button
                className={`${styles.overviewSubTab} ${overviewTab === "reviews" ? styles.overviewSubTabActive : ""}`}
                onClick={() => setOverviewTab("reviews")}
              >
                ⭐ Ulasan
              </button>
              <button
                className={`${styles.overviewSubTab} ${overviewTab === "chat" ? styles.overviewSubTabActive : ""}`}
                onClick={() => setOverviewTab("chat")}
              >
                💬 Chat
                {unreadChatCount > 0 && (
                  <span className={styles.subTabBadge}>
                    {unreadChatCount > 99 ? "99+" : unreadChatCount}
                  </span>
                )}
              </button>
            </div>

            {overviewTab === "stats" && (
              <>
                <OverviewStats />
                <section className={styles.workspaceArea}>
                  <TransactionTable />
                </section>
              </>
            )}
            {overviewTab === "reviews" && (
              <section className={styles.workspaceArea}>
                <div className={styles.workspaceInner}>
                  <ReviewManager />
                </div>
              </section>
            )}
            {overviewTab === "chat" && (
              <section className={styles.workspaceArea}>
                <div className={styles.workspaceInner}>
                  <AdminChatView onUnreadCountChange={setUnreadChatCount} />
                </div>
              </section>
            )}
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
      case "analytics":
        return (
          <section className={styles.workspaceArea}>
            <div className={styles.workspaceInner} id="analytics-report-content">
              {/* Header khusus untuk Export PDF (disembunyikan secara default, ditampilkan saat export) */}
              <div id="analytics-pdf-header" style={{ display: "none", alignItems: "center", justifyContent: "space-between", paddingBottom: "20px", marginBottom: "20px", borderBottom: "2px solid #eaeaea", color: "#000" }}>
                <div style={{ display: "flex", alignItems: "center", transform: "scale(0.8)", transformOrigin: "left center" }}>
                  <Logo />
                </div>
                <div style={{ textAlign: "right" }}>
                  <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#000" }}>Laporan Analitik & Penjualan</h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#666" }}>Dicetak pada: {new Date().toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>

              <AnalyticsChart />
              <AdvancedAnalytics />
            </div>
          </section>
        );
      case "notifications":
        return null; // NotificationCenter is rendered outside the switch statement
      case "vouchers":
        return (
          <section className={styles.workspaceArea}>
            <div className={styles.workspaceInner}>
              <PromoManagement />
            </div>
          </section>
        );
      case "orders":
        return (
          <section className={styles.workspaceArea}>
            <div className={styles.workspaceInner}>
              <OrdersManagement onOrderUpdate={fetchStoreStatus} />
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
      case "chat":
        return (
          <section className={styles.workspaceArea}>
            <div className={styles.workspaceInner}>
              <AdminChatView onUnreadCountChange={setUnreadChatCount} />
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
    ? copy?.status?.offline || "Status monitor sedang offline sementara"
    : formatTemplate(
        copy?.status?.pendingTemplate || "{count} pesanan baru menunggu diproses",
        { count: storeStatus.newOrders }
      );
  const latencyText = storeStatus.latencyMs
    ? formatTemplate(copy?.status?.latencyTemplate || "Latensi {value}ms", {
        value: storeStatus.latencyMs,
      })
    : copy?.status?.checking || "Memeriksa latensi...";
  const activeTabItem = adminConfig.nav.find((item) => item.id === activeTab);
  const activeSectionTitle = activeTabItem?.label || "Overview";

  if (loading) {
    return <AdminDashboardSkeleton />;
  }

  if (!isAdmin) {
    return (
      <section className={styles.accessDeniedShell}>
        <div className={styles.accessDeniedCard} role="alert">
          <p className={styles.accessDeniedEyebrow}>
            {copy?.accessDenied?.eyebrow || "Akses terbatas"}
          </p>
          <h1 className={styles.accessDeniedTitle}>
            {copy?.accessDenied?.title || "Akses Ditolak"}
          </h1>
          <p className={styles.accessDeniedText}>
            {accessError ||
              copy?.accessDenied?.description ||
              "Anda bukan Administrator. Hubungi pemilik sistem jika Anda memerlukan akses."}
          </p>
          <div className={styles.accessDeniedActions}>
            <button
              type="button"
              className={styles.accessSecondaryBtn}
              onClick={() => router.push("/dashboard")}
            >
              {copy?.accessDenied?.backButton || "Kembali ke Dashboard"}
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
        className={`${styles.mobileTopBar} ${
          isTopBarElevated ? styles.mobileTopBarElevated : ""
        }`}
      >
        <div className={styles.brandLogo} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "22px", height: "22px", display: "flex", alignItems: "center", color: "var(--primary-accent)" }}>
            <Logo />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
            {adminConfig.brand.name}
            <span>{adminConfig.brand.suffix}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          <span className={styles.statusDot} style={storeStatus.hasError ? { background: 'var(--danger-color)', boxShadow: '0 0 0 3px rgba(220, 38, 38, 0.15)' } : {}} />
          {storeStatus.latencyMs ? `${storeStatus.latencyMs}ms` : '...'}
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
          {isMobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
          <span>{isMobileMenuOpen ? "Tutup" : "Menu"}</span>
        </button>
      </div>

      <aside
        id="admin-sidebar-drawer"
        ref={sidebarRef}
        className={`${styles.sidebar} ${
          isMobileMenuOpen ? styles.sidebarOpen : ""
        }`}
      >
        <div className={styles.brandSection}>
          <div className={styles.brandLogo} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "22px", height: "22px", display: "flex", alignItems: "center", color: "var(--primary-accent)" }}>
              <Logo />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
              {adminConfig.brand.name}
              <span>{adminConfig.brand.suffix}</span>
            </div>
          </div>
          <div className={styles.brandBadge}>{adminConfig.brand.badge}</div>
          <div className={styles.brandCaption}>
            Halo, {getGreetingName(user)} 👋
          </div>
        </div>

        <nav className={styles.navContainer}>
          <ul className={styles.navigationList}>
            {adminConfig.nav.map((item) => {
              const IconComponent = NAV_ICONS[item.id] || LayoutDashboard;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleTabChange(item.id)}
                    className={`${styles.navItem} ${
                      isActive ? styles.navItemActive : ""
                    }`}
                    aria-label={item.label}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <IconComponent className={styles.navIcon} />
                    <div className={styles.navItemContent}>
                      <span className={styles.navItemText}>
                        {item.label}
                        {item.id === "orders" && storeStatus.newOrders > 0 && (
                          <span className={styles.navBadge}>
                            {storeStatus.newOrders > 99 ? "99+" : storeStatus.newOrders}
                          </span>
                        )}
                        {item.id === "notifications" && unreadNotificationCount > 0 && (
                          <span className={styles.navBadge}>
                            {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                          </span>
                        )}
                      </span>
                      <span className={styles.navItemMeta}>
                        {navMeta[item.id]}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarStatusCard}>
            <span className={styles.statusDot} />
            <div>
              <p className={styles.statusTitle}>
                {copy?.status?.title || "Toko aktif"}
              </p>
              <p className={styles.statusText}>{statusText}</p>
              <p className={styles.statusMetric}>{latencyText}</p>
            </div>
          </div>
          <button onClick={logoutUser} className={styles.logoutBtn}>
            <LogOut size={16} />
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>

      <main ref={mainContentRef} className={styles.mainContent}>
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <h1 className={styles.welcomeTitle}>
              {activeSectionTitle}
            </h1>
            <p className={styles.headerSubtitle}>
              {navMeta[activeTab] || "Pusat kendali operasional toko"}
            </p>
          </div>
          <div className={styles.roleChip}>
            {copy?.header?.rolePrefix || "Peran"}: {getRoleLabel(role)}
          </div>
        </header>

        {activeTab !== "notifications" && (
          <div
            key={activeTab}
            className={`${styles.viewWrapper} ${styles.viewWrapperAnimated}`}
          >
            {renderTabContent()}
          </div>
        )}
        <div 
          style={{ display: activeTab === "notifications" ? "flex" : "none" }}
          className={activeTab === "notifications" ? `${styles.viewWrapper} ${styles.viewWrapperAnimated}` : styles.viewWrapper}
        >
          <NotificationCenter onUnreadCountChange={setUnreadNotificationCount} />
        </div>
      </main>
    </div>
  );
}