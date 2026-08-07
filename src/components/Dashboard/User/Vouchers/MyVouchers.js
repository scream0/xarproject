"use client";

import React, { useState, useMemo } from "react";
import styles from "./MyVouchers.module.css";
import VoucherCard from "@/components/Voucher/VoucherCard";
import toast from "react-hot-toast";
import { auth } from "@/lib/supabaseClient";

const MyVouchers = ({ 
  availableVouchers = [], 
  claimedVouchers = [], 
  refreshProfile, 
  isCheckoutMode = false,
  onSelectVoucher 
}) => {
  const [claimingId, setClaimingId] = useState(null);

  // Fleksibel menangkap key ID dari database (bisa cv.voucher_id atau cv.id)
  const claimedVoucherIds = useMemo(() => {
    return new Set(
      claimedVouchers.map((cv) => String(cv.voucher_id || cv.id))
    );
  }, [claimedVouchers]);

  const handleClaimVoucher = async (voucherId) => {
    setClaimingId(voucherId);
    const toastId = toast.loading("Mengklaim voucher...");

    try {
      const { data: { session } } = await auth.getSession();
      if (!session) {
        toast.error("Anda harus login.", { id: toastId });
        setClaimingId(null);
        return;
      }

      const res = await fetch("/api/vouchers/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ voucher_id: voucherId }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(data.message || "Berhasil!", { id: toastId });
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
                  <div key={voucher.id} className={styles.voucherCardWrapper}>
                    <VoucherCard voucher={voucher} />
                    <button
                      onClick={() => handleClaimVoucher(voucher.id)}
                      disabled={isClaimed || isClaiming}
                      className={`${styles.claimButton} ${isClaimed ? styles.claimedButton : ""}`}
                    >
                      {isClaiming ? "Mengklaim..." : isClaimed ? "Sudah Diklaim" : "Klaim"}
                    </button>
                  </div>
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
        <div className={styles.claimedVouchersList}>
          {claimedVouchers.length > 0 ? (
            claimedVouchers.map((cv) => (
              <div key={cv.id || cv.voucher_id} className={styles.voucherCardWrapper}>
                <VoucherCard voucher={cv} statusText={cv.status === "used" ? "Digunakan" : "Diklaim"} />
                {isCheckoutMode && (
                  <button className={styles.claimButton} onClick={() => onSelectVoucher(cv)}>
                    Pakai Voucher
                  </button>
                )}
              </div>
            ))
          ) : (
            <p className={styles.emptyState}>Belum ada voucher diklaim.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyVouchers;