"use client";

import React, { useState } from "react";
import styles from "./MyVouchers.module.css"; // Assume this will be created
import VoucherCard from "@/components/Voucher/VoucherCard";
import toast from "react-hot-toast";
import { auth } from "@/lib/supabaseClient"; // Assuming supabase auth client

const MyVouchers = ({ claimedVouchers = [], refreshProfile }) => {
  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [claiming, setClaiming] = useState(false);

  const handleClaimVoucher = async () => {
    if (!voucherCodeInput.trim()) {
      toast.error("Kode voucher tidak boleh kosong.");
      return;
    }

    setClaiming(true);
    const toastId = toast.loading("Mengklaim voucher...");

    try {
      const { data: { session } } = await auth.getSession();
      if (!session) {
        toast.error("Anda harus login untuk mengklaim voucher.", { id: toastId });
        setClaiming(false);
        return;
      }

      const token = session.access_token;

      const res = await fetch("/api/vouchers/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: voucherCodeInput.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(data.message || "Voucher berhasil diklaim!", { id: toastId });
        setVoucherCodeInput("");
        if (refreshProfile) {
          refreshProfile(); // Refresh parent component's data
        }
      } else {
        throw new Error(data.error || "Gagal mengklaim voucher.");
      }
    } catch (error) {
      console.error("Error claiming voucher:", error);
      toast.error(error.message || "Terjadi kesalahan saat mengklaim voucher.", { id: toastId });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className={styles.myVouchersSection}>
      <h2 className={styles.sectionTitle}>Voucher Saya</h2>

      <div className={styles.claimVoucherInput}>
        <input
          type="text"
          placeholder="Masukkan kode voucher di sini..."
          value={voucherCodeInput}
          onChange={(e) => setVoucherCodeInput(e.target.value)}
          disabled={claiming}
          className={styles.voucherInput}
        />
        <button
          onClick={handleClaimVoucher}
          disabled={claiming}
          className={styles.claimButton}
        >
          {claiming ? "Mengklaim..." : "Klaim Voucher"}
        </button>
      </div>

      <div className={styles.claimedVouchersList}>
        {claimedVouchers.length > 0 ? (
          claimedVouchers.map((claimedVoucher) => (
            <VoucherCard
              key={claimedVoucher.id}
              voucher={claimedVoucher}
              statusText={claimedVoucher.status === 'claimed' ? 'Diklaim' : (claimedVoucher.status === 'used' ? 'Digunakan' : 'Kadaluarsa')}
            />
          ))
        ) : (
          <p className={styles.emptyState}>Anda belum memiliki voucher yang diklaim.</p>
        )}
      </div>
    </div>
  );
};

export default MyVouchers;
