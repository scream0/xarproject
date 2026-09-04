/**
 * Konfigurasi Terpusat Pengiriman & Kurir
 */
export const DEFAULT_ORIGIN_AREA_ID = "IDNP6IDNC419IDND3277IDZ55281"; // Sleman, D.I. Yogyakarta

export const DEFAULT_ACTIVE_COURIERS = [
  "jne",
  "jnt",
  "sicepat",
  "anteraja",
  "pos",
  "tiki",
];

export const DEFAULT_ITEM_WEIGHT_GRAMS = 250;

export const SHIPPING_FALLBACK_RATES = [
  {
    courier: "jne",
    courierName: "JNE",
    services: [
      {
        service: "REG",
        description: "Layanan Reguler",
        cost: 12000,
        etd: "1-2",
        note: "Estimasi lokal",
      },
      {
        service: "OKE",
        description: "Layanan Ekonomis",
        cost: 10000,
        etd: "2-3",
        note: "Estimasi lokal",
      },
    ],
  },
  {
    courier: "jnt",
    courierName: "J&T Express",
    services: [
      {
        service: "EZ",
        description: "Layanan Reguler Cepat",
        cost: 14000,
        etd: "1-2",
        note: "Estimasi lokal",
      },
    ],
  },
  {
    courier: "sicepat",
    courierName: "SiCepat",
    services: [
      {
        service: "SIUNT",
        description: "SiUntung Reguler",
        cost: 13000,
        etd: "1-2",
        note: "Estimasi lokal",
      },
    ],
  },
  {
    courier: "anteraja",
    courierName: "AnterAja",
    services: [
      {
        service: "REG",
        description: "Layanan Reguler",
        cost: 12000,
        etd: "1-2",
        note: "Estimasi lokal",
      },
    ],
  },
  {
    courier: "pos",
    courierName: "POS Indonesia",
    services: [
      {
        service: "POS",
        description: "Pos Reguler",
        cost: 11000,
        etd: "2-4",
        note: "Estimasi lokal",
      },
    ],
  },
];
