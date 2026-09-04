"use client";

import React from "react";
import styles from "./Skeleton.module.css";
import {
  Skeleton,
  SkeletonText,
  SkeletonTitle,
  SkeletonCircle,
  SkeletonRect,
  SkeletonButton,
  SkeletonCard,
  SkeletonLines,
  ProductCardSkeletons,
} from "./Skeleton";

/**
 * Skeleton Layout Templates
 * — DashboardSkeleton (generic role detection screen)
 * — AdminDashboardSkeleton
 * — UserDashboardSkeleton
 * — ShopSkeleton
 * — OrdersSkeleton
 * — NotificationsSkeleton
 * — WishlistSkeleton (same grid as shop, fewer items)
 * — TableSkeleton
 * — StatsSkeleton
 * — OverviewUserSkeleton
 * — LoginSkeleton
 */

/* --- Generic dashboard while detecting role --- */
export function DashboardSkeleton() {
  return (
    <div className={styles.dashboardSkeleton}>
      <div className={styles.dashboardSkeletonSidebar}>
        <SkeletonTitle width="60%" height={24} />
        <div
          className={styles.flexCol}
          style={{ flex: 1, marginTop: "0.5rem", gap: "0.8rem" }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={`nav-${i}`} width="100%" height={38} radius={8} />
          ))}
        </div>
        <SkeletonButton width="100%" height={42} />
      </div>
      <div className={styles.dashboardSkeletonMain}>
        <Skeleton className={styles.dashboardSkeletonHeader} />
        <div className={styles.dashboardSkeletonGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={`stat-${i}`} className={styles.statCardSkeleton}>
              <SkeletonCircle size={34} />
              <SkeletonText width="65%" height={22} />
              <SkeletonText width="45%" height={12} />
            </SkeletonCard>
          ))}
        </div>
        <SkeletonRect
          className={styles.dashboardSkeletonChart}
          height={240}
        />
        <SkeletonCard>
          <SkeletonLines lines={4} widths={["100%", "94%", "88%", "60%"]} />
        </SkeletonCard>
      </div>
    </div>
  );
}

/* --- Admin dashboard skeleton --- */
export function AdminDashboardSkeleton() {
  return (
    <div className={styles.dashboardSkeleton}>
      <div className={styles.dashboardSkeletonSidebar}>
        <div className={`${styles.flexCol} ${styles.gapSm}`}>
          <SkeletonTitle width="50%" height={24} />
          <SkeletonText width="35%" height={11} />
        </div>
        <div className={`${styles.flexCol} ${styles.flex1} ${styles.mtSm}`}>
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={`adminnav-${i}`} width="100%" height={46} radius={999} />
          ))}
        </div>
        <SkeletonCard>
          <SkeletonText width="60%" height={12} />
          <SkeletonText width="90%" height={10} />
        </SkeletonCard>
        <SkeletonButton width="100%" height={42} radius={999} />
      </div>
      <div className={styles.dashboardSkeletonMain}>
        <SkeletonText width="30%" height={20} />
        <SkeletonCard>
          <div className={`${styles.flexRow} ${styles.spaceBetween}`}>
            <SkeletonLines lines={2} widths={["70%", "45%"]} />
            <SkeletonButton width={130} height={34} />
          </div>
        </SkeletonCard>
        <div className={styles.dashboardSkeletonGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={`adminstat-${i}`} className={styles.statCardSkeleton}>
              <SkeletonText width="55%" height={12} />
              <SkeletonTitle width="70%" height={26} />
            </SkeletonCard>
          ))}
        </div>
        <div className={`${styles.flexRow} ${styles.alignStretch} ${styles.flex1}`}>
          <SkeletonRect height={280} className={`${styles.flexRow} ${styles.flex1}`} />
          <SkeletonRect height={280} className={styles.flex1} />
        </div>
        <SkeletonCard>
          <SkeletonLines lines={4} widths={["100%", "96%", "92%", "70%"]} />
        </SkeletonCard>
      </div>
    </div>
  );
}

/* --- User dashboard skeleton --- */
export function UserDashboardSkeleton() {
  return (
    <div className={styles.dashboardSkeleton}>
      <div className={styles.dashboardSkeletonSidebar}>
        <SkeletonTitle width="60%" height={24} />
        <div className={`${styles.flexCol} ${styles.flex1} ${styles.mtSm}`}>
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={`usernav-${i}`} width="100%" height={38} radius={8} />
          ))}
        </div>
        <SkeletonButton width="100%" height={40} />
      </div>
      <div className={styles.dashboardSkeletonMain}>
        <div className={styles.flexRow} style={{ justifyContent: "space-between" }}>
          <SkeletonText width="35%" height={18} />
          <div className={styles.flexRow}>
            <SkeletonCircle size={30} />
            <SkeletonText width={90} height={18} />
          </div>
        </div>
        <SkeletonCard>
          <SkeletonLines lines={2} widths={["50%", "30%"]} />
        </SkeletonCard>
        <div className={styles.dashboardSkeletonGrid}>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={`userstat-${i}`} className={styles.statCardSkeleton}>
              <SkeletonText width="55%" height={12} />
              <SkeletonTitle width="70%" height={26} />
            </SkeletonCard>
          ))}
        </div>
        <SkeletonCard>
          <SkeletonTitle width="45%" height={18} />
          <div className={styles.flexCol} style={{ marginTop: "1rem", gap: "0.7rem" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={`order-${i}`} className={styles.flexRow} style={{ justifyContent: "space-between" }}>
                <div className={styles.flexCol} style={{ gap: "0.35rem", flex: 1 }}>
                  <SkeletonText width="55%" height={15} />
                  <SkeletonText width="35%" height={12} />
                </div>
                <SkeletonButton width={72} height={28} />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>
    </div>
  );
}

/* --- Shop catalog skeleton --- */
export function ShopSkeleton({ count = 8 }) {
  return (
    <div className={styles.workspaceInner} style={{ background: "transparent", border: "none", boxShadow: "none", padding: "0" }}>
      <div className={styles.flexCol} style={{ gap: "0.4rem", marginBottom: "1.25rem" }}>
        <SkeletonTitle width="35%" height={24} />
        <SkeletonText width="55%" height={13} />
      </div>

      {/* Category pills */}
      <div className={styles.flexRow} style={{ gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={`cat-${i}`} width={i === 0 ? 72 : 54} height={32} radius={999} />
        ))}
      </div>

      {/* Toolbar */}
      <div className={styles.shopSkeletonToolbar}>
        <Skeleton width="100%" height={42} radius={10} />
        <Skeleton width={150} height={42} radius={10} />
      </div>

      {/* Product grid */}
      <div className={styles.shopSkeletonGrid}>
        <ProductCardSkeletons count={count} />
      </div>
    </div>
  );
}

/* --- Orders list skeleton --- */
export function OrdersSkeleton({ count = 3 }) {
  return (
    <div className={styles.ordersListSkeleton}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={`order-${i}`} className={styles.orderCardSkeleton}>
          <div className={styles.flexRow} style={{ justifyContent: "space-between", marginBottom: "0.8rem" }}>
            <SkeletonText width="38%" height={16} />
            <SkeletonText width={90} height={22} />
          </div>
          <SkeletonLines lines={2} widths={["80%", "55%"]} />
          <div className={styles.flexRow} style={{ justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.9rem" }}>
            <SkeletonButton width={118} height={34} />
            <SkeletonButton width={86} height={34} />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

/* --- Notifications list skeleton --- */
export function NotificationsSkeleton({ count = 5 }) {
  return (
    <div className={styles.notificationListSkeleton}>
      <SkeletonCard style={{ marginBottom: "0.75rem" }}>
        <div className={styles.flexRow} style={{ justifyContent: "space-between" }}>
          <div className={styles.flexCol} style={{ gap: "0.35rem" }}>
            <SkeletonTitle width={180} height={20} />
            <SkeletonText width={120} height={12} />
          </div>
          <SkeletonButton width={110} height={32} />
        </div>
        <div className={styles.flexRow} style={{ gap: "0.5rem", marginTop: "0.9rem" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={`tab-${i}`} width={i === 0 ? 80 : 60} height={30} radius={999} />
          ))}
        </div>
      </SkeletonCard>

      {Array.from({ length: count }).map((_, i) => (
        <div key={`nitem-${i}`} className={styles.notificationItemSkeleton}>
          <SkeletonCircle size={38} />
          <div className={styles.flexCol} style={{ flex: 1, gap: "0.45rem" }}>
            <div className={styles.flexRow} style={{ justifyContent: "space-between" }}>
              <SkeletonText width="52%" height={15} />
              <SkeletonCircle size={9} />
            </div>
            <SkeletonText width="88%" height={13} />
            <SkeletonText width="40%" height={11} />
          </div>
          <SkeletonCircle size={18} />
        </div>
      ))}
    </div>
  );
}

/* --- Wishlist skeleton (grid) --- */
export function WishlistSkeleton({ count = 4 }) {
  return (
    <div className={styles.shopSkeletonGrid}>
      <ProductCardSkeletons count={count} />
    </div>
  );
}

/* --- Table skeleton (admin user mgmt / transactions) --- */
export function TableSkeleton({ headers = 6, rows = 5 }) {
  return (
    <div className={styles.tableSkeleton}>
      {/* Header row */}
      <div
        className={styles.tableRowSkeleton}
        style={{ gridTemplateColumns: `repeat(${headers}, 1fr)`, borderBottom: "1px solid var(--border-color)" }}
      >
        {Array.from({ length: headers }).map((_, i) => (
          <Skeleton key={`th-${i}`} width="100%" height={14} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={`tr-${r}`}
          className={styles.tableRowSkeleton}
          style={{ gridTemplateColumns: `repeat(${headers}, 1fr)`, alignItems: "center" }}
        >
          {Array.from({ length: headers }).map((_, c) => (
            <Skeleton
              key={`td-${r}-${c}`}
              width={c === 0 ? "72%" : "100%"}
              height={13}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* --- Stats / overview cards skeleton --- */
export function StatsSkeleton({ count = 4 }) {
  return (
    <div className={styles.statsGridSkeleton}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={`stat-${i}`} className={styles.statCardSkeleton}>
          <div className={styles.flexRow} style={{ justifyContent: "space-between" }}>
            <SkeletonText width="48%" height={12} />
            <SkeletonCircle size={26} />
          </div>
          <SkeletonTitle width="64%" height={26} />
          <SkeletonText width="42%" height={12} />
        </SkeletonCard>
      ))}
    </div>
  );
}

/* --- Overview (user) skeleton: metrics + welcome + recommendations --- */
export function OverviewUserSkeleton() {
  return (
    <div className={styles.flexCol} style={{ gap: "1.25rem" }}>
      <StatsSkeleton count={3} />

      <div className={styles.flexRow} style={{ alignItems: "stretch", gap: "1rem", flexWrap: "wrap" }}>
        <SkeletonCard style={{ flex: "1 1 320px" }}>
          <SkeletonText width={110} height={16} />
          <SkeletonTitle width="78%" height={22} />
          <SkeletonLines lines={2} widths={["86%", "60%"]} />
          <div className={styles.flexRow} style={{ marginTop: "1rem", gap: "0.5rem" }}>
            <SkeletonButton width={120} height={36} />
            <SkeletonButton width={100} height={36} />
            <SkeletonButton width={100} height={36} />
          </div>
        </SkeletonCard>

        <SkeletonCard style={{ flex: "1 1 320px" }}>
          <SkeletonTitle width="45%" height={18} />
          <div className={styles.flexCol} style={{ marginTop: "1rem", gap: "0.8rem" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={`rec-${i}`} className={styles.flexRow} style={{ justifyContent: "space-between" }}>
                <div className={styles.flexCol} style={{ gap: "0.35rem", flex: 1 }}>
                  <SkeletonText width="55%" height={15} />
                  <SkeletonText width="35%" height={12} />
                </div>
                <SkeletonButton width={70} height={28} />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>

      <SkeletonCard>
        <div className={styles.flexRow} style={{ justifyContent: "space-between" }}>
          <SkeletonTitle width="38%" height={18} />
          <SkeletonButton width={86} height={30} />
        </div>
        <div className={styles.shopSkeletonGrid} style={{ marginTop: "1rem" }}>
          <ProductCardSkeletons count={3} />
        </div>
      </SkeletonCard>
    </div>
  );
}

/* --- Login page skeleton (form fields) --- */
export function LoginSkeleton() {
  return (
    <div className={styles.loginSkeleton}>
      <div className={styles.loginSkeletonPanel} style={{ background: "var(--surface-primary)", borderRight: "1px solid var(--border-color)" }}>
        <SkeletonTitle width="60%" height={30} />
        <SkeletonText width="75%" height={13} />
        <SkeletonText width="50%" height={13} />
      </div>
      <div className={styles.loginSkeletonPanel}>
        <SkeletonTitle width="45%" height={24} />
        <SkeletonText width="65%" height={13} />
        <div className={styles.flexCol} style={{ gap: "0.75rem", marginTop: "0.75rem" }}>
          <div className={styles.flexCol} style={{ gap: "0.4rem" }}>
            <SkeletonText width="30%" height={12} />
            <SkeletonRect height={46} />
          </div>
          <div className={styles.flexCol} style={{ gap: "0.4rem" }}>
            <SkeletonText width="30%" height={12} />
            <SkeletonRect height={46} />
          </div>
          <SkeletonButton height={48} />
          <SkeletonButton height={42} />
          <SkeletonText width="55%" height={12} style={{ alignSelf: "center" }} />
        </div>
      </div>
    </div>
  );
}

