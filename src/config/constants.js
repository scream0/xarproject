/**
 * Konstanta Terpusat Aplikasi (MAMEKO)
 */
export const APP_CONFIG = {
  name: "MAMEKO Perfume",
  tagline: "Artisanal Craftsmanship",
  currency: "IDR",
  defaultLocale: "id-ID",
  supportEmail: "support@mameko.my.id",
  whatsappContact: "6285171723607",
  operatingHours: "Setiap Hari (18:00 - 21:00 WIB)",
  location: "Sleman, Yogyakarta, Indonesia",
  instagramUrl: "https://www.instagram.com/mameko.id/",
};

export const API_ROUTES = {
  AUTH_LOGIN: "/api/auth/login",
  AUTH_LOGOUT: "/api/auth/logout",
  SETTINGS: "/api/settings",
  PRODUCTS: "/api/products",
  CART: "/api/user/cart",
  ORDERS: "/api/user/orders",
  ONGKIR: "/api/ongkir",
  BITESHIP_AREAS: "/api/biteship/areas",
  BITESHIP_COURIERS: "/api/biteship/couriers",
  VOUCHERS_PUBLIC: "/api/vouchers/public",
  VOUCHERS_AVAILABLE: "/api/user/vouchers/available",
  VOUCHERS_CLAIM: "/api/user/vouchers/claim",
  MIDTRANS: "/api/midtrans",
};
