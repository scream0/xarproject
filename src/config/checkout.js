/**
 * Konfigurasi Terpusat Checkout & Pembayaran
 */
export const PAYMENT_METHODS = {
  MIDTRANS: "Midtrans",
  MANUAL_TRANSFER: "Manual Transfer",
};

export const ORDER_STATUSES = {
  PENDING: "Pending",
  PAID: "Paid",
  PROCESSING: "Diproses",
  SHIPPED: "Dikirim",
  DELIVERED: "Selesai",
  CANCELLED: "Dibatalkan",
};

export const PAYMENT_STATUSES = {
  UNPAID: "unpaid",
  PAID: "paid",
  FAILED: "failed",
  EXPIRED: "expired",
};

export const CHECKOUT_EXPIRY_HOURS = 24;

export const DEFAULT_CURRENCY = "IDR";
