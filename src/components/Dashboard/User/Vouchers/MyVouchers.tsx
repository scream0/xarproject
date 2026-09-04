// @ts-nocheck
"use client";
import React, { useState, useMemo } from "react";
import styles from "./MyVouchers.module.css";
import VoucherCard from "@/components/Voucher/VoucherCard";
import toast from "react-hot-toast";
import { auth } from "@/lib/supabaseClient";

const TABS = [
  { key: "all", label: "Semua" },
  { key: "active", label: "Aktif" },
  { key: "used", label: "Terpakai" },
  { key: "expired", label: "Kadaluarsa" },
];

const statusTextMap = {
  active: "Aktif",
  used: "Digunakan",
  expired: "Kadaluarsa",
};

const MyVouchers = ({
  availableVouchers = [],
  claimedVouchers = [],
  refreshProfile,
  isCheckoutMode = false,
  onSelectVoucher,
  appliedClaimIds = [], // <-- Diterima dari CheckoutPage
}) => {
  const [claimingId, setClaimingId] = useState(null);
  const [optimisticClaimed, setOptimisticClaimed] = useState(new Set());
  const [activeTab, setActiveTab] = useState("all");

  const claimedVoucherIds = useMemo(() => {
    const ids = claimedVouchers.map((cv) => String(cv.voucher_id || cv.vouchers?.id || cv.id));
    return new Set([...ids, ...optimisticClaimed]);
  }, [claimedVouchers, optimisticClaimed]);

  const sortedClaimedVouchers = useMemo(() => {
    return [...claimedVouchers].sort((a, b) => {
      const aExpiry = a.vouchers?.valid_until ? new Date(a.vouchers.valid_until) : null;
      const bExpiry = b.vouchers?.valid_until ? new Date(b.vouchers.valid_until) : null;

      if (a.status === "active" && b.status !== "active") return -1;
      if (b.status === "active" && a.status !== "active") return 1;

      if (aExpiry && bExpiry) return aExpiry - bExpiry;
      return 0;
    });
  }, [claimedVouchers]);

  const filteredClaimedVouchers = useMemo(() => {
    if (activeTab === "all") return sortedClaimedVouchers;
    return sortedClaimedVouchers.filter((cv) => {
      const status = cv.status || "active";
      return status === activeTab;
    });
  }, [sortedClaimedVouchers, activeTab]);

  const tabCounts = useMemo(() => {
    return {
      all: claimedVouchers.length,
      active: claimedVouchers.filter((cv) => (cv.status || "active") === "active").length,
      used: claimedVouchers.filter((cv) => cv.status === "used").length,
      expired: claimedVouchers.filter((cv) => cv.status === "expired").length,
    };
  }, [claimedVouchers]);

  // Mode checkout hanya boleh nampilin voucher aktif — gak bisa pilih yang sudah dipakai/kadaluarsa
  const displayVouchers = isCheckoutMode
    ? sortedClaimedVouchers.filter((cv) => {
        const v = cv.vouchers || cv;
        const isNotExpired = !v.valid_until || new Date(v.valid_until) >= new Date();
        const isActive = cv.status ? cv.status === "active" : (v.is_active !== false);
        return isActive && isNotExpired;
      })
    : filteredClaimedVouchers;

  const handleClaimVoucher = async (voucherId: any) => {
    setClaimingId(voucherId);
    const toastId = toast.loading("Mengklaim voucher...");

    try {
      const { data: { session } } = await auth.getSession();
      if (!session) {
        toast.error("Anda harus login.", { id: toastId });
        setClaimingId(null);
        return;
      }

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/vouchers/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ voucher_id: String(voucherId) }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(data.message || "Berhasil!", { id: toastId });
        setOptimisticClaimed((prev) => new Set(prev).add(String(voucherId)));
        if (refreshProfile) refreshProfile();
      } else {
        throw new Error(data.error || "Gagal mengklaim.");
      }
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className={styles.myVouchersSection}>
      {!isCheckoutMode && (
        <div className={styles.sectionGroup}>
          <h2 className={styles.sectionTitle}>Voucher Tersedia</h2>
          <div className={styles.availableVouchersList}>
            {availableVouchers.length > 0 ? (
              availableVouchers.map((voucher) => {
                const isClaimed = claimedVoucherIds.has(String(voucher.id));
                const isClaiming = claimingId === voucher.id;

                return (
                  <VoucherCard
                    key={voucher.id}
                    voucher={voucher}
                    disabled={isClaimed || isClaiming}
                    buttonText={isClaiming ? "Mengklaim..." : isClaimed ? "Sudah Diklaim" : "Klaim"}
                    onActionClick={() => !isClaimed && handleClaimVoucher(voucher.id)}
                  />
                );
              })
            ) : (
              <p className={styles.emptyState}>Tidak ada voucher tersedia saat ini.</p>
            )}
          </div>
        </div>
      )}

      <div className={styles.sectionGroup} style={{ marginTop: "32px" }}>
        <h2 className={styles.sectionTitle}>Voucher Saya</h2>

        {!isCheckoutMode && (
          <div className={styles.tabBar}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`${styles.tabButton} ${activeTab === tab.key ? styles.tabButtonActive : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {tabCounts[tab.key] > 0 && <span className={styles.tabCount}>{tabCounts[tab.key]}</span>}
              </button>
            ))}
          </div>
        )}

        <div className={styles.claimedVouchersList}>
          {displayVouchers.length > 0 ? (
            displayVouchers.map((cv) => {
              const claimId = cv.id; // ID baris user_vouchers
              const isApplied = appliedClaimIds.includes(claimId);

              return (
                <VoucherCard
                  key={claimId || cv.voucher_id}
                  voucher={cv}
                  statusText={statusTextMap[cv.status] || "Diklaim"}
                  disabled={isCheckoutMode && isApplied}
                  onActionClick={isCheckoutMode && !isApplied ? () => onSelectVoucher(cv) : undefined}
                  buttonText={isCheckoutMode && isApplied ? "Terpakai" : "Pakai Voucher"}
                />
              );
            })
          ) : (
            <p className={styles.emptyState}>
              {isCheckoutMode
                ? "Tidak ada voucher aktif yang bisa digunakan."
                : activeTab === "all"
                  ? "Belum ada voucher diklaim."
                  : `Tidak ada voucher ${TABS.find((t) => t.key === activeTab)?.label.toLowerCase()}.`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyVouchers;