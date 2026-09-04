"use client";

import React, { useState } from "react";
import styles from "./VoucherCard.module.css";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import toast from "react-hot-toast";

const formatDiscount = (voucher: any) => {
  if (!voucher) return "";
  const value = voucher.discount_amount || 0;
  switch (voucher.type) {
    case "percentage":
      return `${value}%`;
    case "fixed":
      return `Rp${new Intl.NumberFormat("id-ID").format(value)}`;
    case "shipping":
      return "Gratis Ongkir";
    default:
      return `${value}`;
  }
};

const getVoucherIcon = (type: string) => {
  switch (type) {
    case "shipping":
      return "truck";
    case "percentage":
      return "percent";
    case "fixed":
      return "dollar-sign";
    default:
      return "tag";
  }
};

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

const getDaysUntilExpiry = (dateString: string | null | undefined) => {
  if (!dateString) return null;
  const expiry = new Date(dateString);
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

interface VoucherCardProps {
  voucher: any;
  onActionClick?: (voucher: any) => void;
  buttonText?: string;
  statusText?: string;
  disabled?: boolean;
}

export default function VoucherCard({ voucher, onActionClick, buttonText, statusText, disabled }: VoucherCardProps) {
  const [copied, setCopied] = useState(false);
  if (!voucher) return null;

  const v = voucher.vouchers || voucher;
  const daysLeft = getDaysUntilExpiry(v.valid_until);
  const isUrgent = daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;
  const isExpired = statusText === "Kadaluarsa" || (daysLeft !== null && daysLeft < 0);
  const isUsed = statusText === "Digunakan";
  const isInactive = isExpired || isUsed;

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!v.code) return;
    navigator.clipboard.writeText(v.code);
    setCopied(true);
    toast.success("Kode disalin!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`${styles.ticket} ${isInactive ? styles.ticketInactive : ""}`}>
      {/* Notch kiri-kanan biar bentuk tiket */}
      <div className={styles.notchLeft} />
      <div className={styles.notchRight} />

      <div className={styles.ticketLeft}>
        <div className={styles.iconCircle}>
          <AppIcon name={getVoucherIcon(v.type)} className={styles.voucherIcon} />
        </div>
        <div className={styles.discountValue}>{formatDiscount(v)}</div>
        {v.type !== "shipping" && <div className={styles.discountLabel}>DISKON</div>}
      </div>

      <div className={styles.dashedDivider} />

      <div className={styles.ticketRight}>
        <div className={styles.ticketHeader}>
          <h3 className={styles.title}>{v.title}</h3>
          {isUrgent && !isInactive && (
            <span className={styles.urgentBadge}>
              {daysLeft === 0 ? "Berakhir hari ini" : `${daysLeft} hari lagi`}
            </span>
          )}
        </div>

        {v.min_purchase > 0 && (
          <p className={styles.minPurchase}>
            Min. belanja Rp{new Intl.NumberFormat("id-ID").format(v.min_purchase)}
          </p>
        )}

        {formatDate(v.valid_until) && (
          <p className={styles.expiry}>
            <AppIcon name="clock" size={12} /> Berlaku hingga {formatDate(v.valid_until)}
          </p>
        )}

        {voucher.claimed_percentage !== null && voucher.claimed_percentage !== undefined && (
          <div className={styles.progressWrap}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${Math.min(voucher.claimed_percentage, 100)}%` }}
              />
            </div>
            <span className={styles.progressText}>{voucher.claimed_percentage}% terklaim</span>
          </div>
        )}

        <div className={styles.ticketFooter}>
          {v.code && (
            <button className={styles.codeChip} onClick={handleCopyCode} type="button">
              <span>{v.code}</span>
              <AppIcon name={copied ? "check" : "copy"} size={12} />
            </button>
          )}

          {statusText && <span className={styles.statusTag}>{statusText}</span>}

          {onActionClick && (
            <button
              className={`${styles.actionButton} ${disabled ? styles.claimed : ""}`}
              onClick={() => onActionClick(voucher)}
              disabled={disabled}
              type="button"
            >
              {buttonText || (disabled ? "Diklaim" : "Klaim")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}