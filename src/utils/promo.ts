/**
 * promo.js — Promo & Diskon Utility
 *
 * Menyediakan helper untuk mengecek status promo aktif dan menghitung
 * harga diskon yang dipakai di seluruh aplikasi (landing page, shop,
 * cart sidebar, checkout Midtrans, dsb).
 */

/**
 * Cek apakah promo sedang aktif.
 * Syarat:
 *  - promoBannerEnabled === true
 *  - promoDiscountValue > 0
 *  - (opsional) promoStartDate <= hari ini <= promoEndDate
 *
 * @param {object|null} promo Settings promo (dari /api/settings?public=true)
 * @returns {boolean}
 */
export function isPromoActive(promo: any): boolean {
  if (!promo) return false;
  if (!promo.promoBannerEnabled) return false;

  const value = Number(promo.promoDiscountValue || 0);
  if (value <= 0) return false;

  const now = new Date();

  // Cek tanggal mulai
  if (promo.promoStartDate) {
    const start = new Date(`${promo.promoStartDate}T00:00:00`);
    if (!isNaN(start.getTime()) && now < start) return false;
  }

  // Cek tanggal berakhir
  if (promo.promoEndDate) {
    // Agar promo masih berlaku di hari terakhir, batas akhir di-set ke 23:59:59
    const end = new Date(`${promo.promoEndDate}T23:59:59`);
    if (!isNaN(end.getTime()) && now > end) return false;
  }

  return true;
}

/**
 * Hitung harga setelah diskon berdasarkan tipe & nilai diskon.
 *
 * @param {number} price Harga asli
 * @param {object|null} promo Settings promo
 * @returns {{ price: number, originalPrice: number, savings: number, hasDiscount: boolean }}
 */
export function getDiscountedPrice(price: number, promo: any) {
  const originalPrice = Number(price || 0);
  const base = { price: originalPrice, originalPrice, savings: 0, hasDiscount: false };

  if (!isPromoActive(promo) || originalPrice <= 0) return base;

  const type = promo.promoDiscountType || "percentage";
  const value = Number(promo.promoDiscountValue || 0);

  let discountAmount = 0;
  if (type === "fixed") {
    discountAmount = Math.min(value, originalPrice);
  } else {
    // percentage
    discountAmount = Math.round((originalPrice * value) / 100);
  }

  const finalPrice = Math.max(0, originalPrice - discountAmount);

  return {
    price: finalPrice,
    originalPrice,
    savings: discountAmount,
    hasDiscount: discountAmount > 0,
  };
}

/**
 * Format angka ke Rupiah (id-ID).
 * @param {number} number
 * @returns {string}
 */
export function formatRupiah(number: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(number || 0);
}

/**
 * Hitung total diskon promo untuk keranjang.
 * @param {Array} items Items keranjang ({price, quantity})
 * @param {object|null} promo
 * @returns {{ total: number, savings: number }}
 */
export function getCartPromoSummary(items: any[], promo: any) {
  if (!isPromoActive(promo) || !Array.isArray(items) || items.length === 0) {
    return { total: 0, savings: 0 };
  }

  let total = 0;
  let savings = 0;

  items.forEach((item) => {
    const price = Number(item.price || 0);
    const qty = Number(item.quantity || 1);
    const discounted = getDiscountedPrice(price, promo);
    total += discounted.price * qty;
    savings += discounted.savings * qty;
  });

  return { total, savings };
}

