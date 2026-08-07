"use client";

import React from 'react';
import styles from './VoucherCard.module.css'; // Assume this file exists or will be created
import { AppIcon } from '@/components/UI/Icon/AppIcon'; // Assuming this is a reusable icon component

const formatDiscount = (voucher) => {
  if (!voucher) return '';
  const value = voucher.discount_value;
  switch (voucher.discount_type) {
    case 'percentage':
      return `${value}% Diskon`;
    case 'fixed':
      return `Rp ${new Intl.NumberFormat('id-ID').format(value)} Diskon`;
    case 'shipping':
      return `Gratis Ongkir`;
    default:
      return `${value} Diskon`;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return 'Tidak Berlaku';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Tidak Berlaku';
  return `Berlaku hingga ${date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
};

export default function VoucherCard({ voucher, onActionClick, buttonText, statusText }) {
  if (!voucher) return null;

  const isClaimed = statusText === 'Diklaim' || statusText === 'Digunakan'; // Example logic

  return (
    <div className={styles.voucherCard}>
      <div className={styles.iconContainer}>
        <AppIcon name="tag" className={styles.voucherIcon} />
      </div>
      <div className={styles.content}>
        <h3 className={styles.title}>{voucher.vouchers?.title || voucher.title}</h3>
        <p className={styles.description}>{voucher.vouchers?.description || voucher.description || 'Nikmati penawaran spesial ini!'}</p>
        <div className={styles.details}>
          <span className={styles.discount}>{formatDiscount(voucher.vouchers || voucher)}</span>
          <span className={styles.code}>Kode: {voucher.vouchers?.code || voucher.code}</span>
        </div>
        <p className={styles.expiry}>{formatDate(voucher.vouchers?.valid_until || voucher.valid_until)}</p>
      </div>
      <div className={styles.actions}>
        {statusText && <span className={styles.statusText}>{statusText}</span>}
        {onActionClick && (
          <button 
            className={`${styles.actionButton} ${isClaimed ? styles.claimed : ''}`} 
            onClick={() => onActionClick(voucher)} 
            disabled={isClaimed}
          >
            {buttonText || (isClaimed ? 'Diklaim' : 'Klaim Sekarang')}
          </button>
        )}
      </div>
    </div>
  );
}
