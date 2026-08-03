// ─────────────────────────────────────────────────────────────
// Utilitas terpusat untuk data alamat.
// Dipakai bersama oleh: halaman checkout, profil user, modal
// alamat global, dan alur pembayaran (StoreContext).
// ─────────────────────────────────────────────────────────────

// Membuat ID alamat unik & bergaya konsisten.
export function buildAddressId(prefix = "ADDR") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

const CITY_ID_FALLBACKS = {
  jakarta: "114",
  "jakarta pusat": "114",
  "jakarta selatan": "114",
  "jakarta barat": "114",
  "jakarta timur": "114",
  "jakarta utara": "114",
  bandung: "23",
  "kota bandung": "23",
  "kab. bandung": "23",
  bogor: "110",
  depok: "152",
  bekasi: "55",
  "kota bekasi": "55",
  "kab. bekasi": "55",
  surabaya: "444",
  malang: "160",
  yogyakarta: "93",
  "kota yogyakarta": "93",
  semarang: "152",
  medan: "90",
  palembang: "179",
  makassar: "174",
  denpasar: "50",
  cirebon: "121",
};

const POSTAL_CODE_FALLBACKS = [
  { cityId: "114", province: "DKI Jakarta", city: "Jakarta", cityType: "Kota", prefixes: ["10", "11", "12", "13", "14", "15"], ranges: [[10110, 12999]] },
  { cityId: "23", province: "Jawa Barat", city: "Bandung", cityType: "Kota", prefixes: ["40"], ranges: [[40100, 40399]] },
  { cityId: "55", province: "Jawa Barat", city: "Bekasi", cityType: "Kota", prefixes: ["17"], ranges: [[17100, 17999]] },
  { cityId: "110", province: "Jawa Barat", city: "Bogor", cityType: "Kota", prefixes: ["16"], ranges: [[16100, 16699]] },
  { cityId: "152", province: "Jawa Barat", city: "Depok", cityType: "Kota", prefixes: ["16"], ranges: [[16400, 16999]] },
  { cityId: "444", province: "Jawa Timur", city: "Surabaya", cityType: "Kota", prefixes: ["60"], ranges: [[60100, 60299]] },
  { cityId: "160", province: "Jawa Timur", city: "Malang", cityType: "Kota", prefixes: ["65"], ranges: [[65100, 65999]] },
  { cityId: "93", province: "DI Yogyakarta", city: "Yogyakarta", cityType: "Kota", prefixes: ["55"], ranges: [[55100, 55299]] },
  { cityId: "152", province: "Jawa Tengah", city: "Semarang", cityType: "Kota", prefixes: ["50"], ranges: [[50100, 50299]] },
  { cityId: "90", province: "Sumatera Utara", city: "Medan", cityType: "Kota", prefixes: ["20"], ranges: [[20100, 20999]] },
  { cityId: "179", province: "Sumatera Selatan", city: "Palembang", cityType: "Kota", prefixes: ["30"], ranges: [[30100, 30999]] },
  { cityId: "174", province: "Sulawesi Selatan", city: "Makassar", cityType: "Kota", prefixes: ["90"], ranges: [[90100, 90999]] },
  { cityId: "50", province: "Bali", city: "Denpasar", cityType: "Kota", prefixes: ["80"], ranges: [[80100, 80999]] },
  { cityId: "121", province: "Jawa Barat", city: "Cirebon", cityType: "Kota", prefixes: ["45"], ranges: [[45100, 45999]] },
];

export function resolveCityId(city = "", province = "", postalCode = "") {
  const postalDigits = String(postalCode || "").replace(/\D/g, "");
  if (postalDigits.length >= 4) {
    const postalNumber = Number(postalDigits);
    const postalPrefix = postalDigits.slice(0, 2);
    for (const fallback of POSTAL_CODE_FALLBACKS) {
      const prefixMatch = fallback.prefixes?.some((prefix) => postalPrefix === prefix || postalDigits.startsWith(prefix));
      if (prefixMatch) {
        return fallback.cityId;
      }
      for (const [min, max] of fallback.ranges) {
        if (postalNumber >= min && postalNumber <= max) {
          return fallback.cityId;
        }
      }
    }
  }

  const source = [city, province, postalCode].filter(Boolean).join(" ");
  if (!source) return "";

  const normalized = String(source).toLowerCase().trim();
  for (const [name, cityId] of Object.entries(CITY_ID_FALLBACKS)) {
    if (normalized.includes(name)) return cityId;
  }

  return "";
}

export function resolveAddressRegion(city = "", province = "", postalCode = "") {
  const postalDigits = String(postalCode || "").replace(/\D/g, "");
  if (postalDigits.length >= 4) {
    const postalNumber = Number(postalDigits);
    const postalPrefix = postalDigits.slice(0, 2);
    for (const fallback of POSTAL_CODE_FALLBACKS) {
      const prefixMatch = fallback.prefixes?.some((prefix) => postalPrefix === prefix || postalDigits.startsWith(prefix));
      if (prefixMatch) {
        return {
          cityId: fallback.cityId,
          province: fallback.province,
          city: fallback.city,
          cityType: fallback.cityType,
        };
      }
      for (const [min, max] of fallback.ranges) {
        if (postalNumber >= min && postalNumber <= max) {
          return {
            cityId: fallback.cityId,
            province: fallback.province,
            city: fallback.city,
            cityType: fallback.cityType,
          };
        }
      }
    }
  }

  const source = [city, province].filter(Boolean).join(" ");
  if (!source) return { cityId: "", province: "", city: "", cityType: "" };

  const normalized = String(source).toLowerCase().trim();
  for (const [name, cityId] of Object.entries(CITY_ID_FALLBACKS)) {
    if (normalized.includes(name)) {
      return {
        cityId,
        province: province || "",
        city: city || "",
        cityType: "",
      };
    }
  }

  return { cityId: "", province: province || "", city: city || "", cityType: "" };
}

// Menormalkan objek alamat agar semua field yang dibutuhkan UI selalu ada.
// Aman dipakai baik untuk data baru maupun data lama (tanpa cityId).
export function normalizeAddress(addr) {
  const region = resolveAddressRegion(addr?.city, addr?.province, addr?.postalCode);

  return {
    id: addr?.id || buildAddressId(),
    label: addr?.label || "Rumah",
    recipientName: addr?.recipientName || "",
    recipientPhone: addr?.recipientPhone || "",
    street: addr?.street || "",
    province: region.province || addr?.province || "",
    city: region.city || addr?.city || "",
    cityId: addr?.cityId || region.cityId || resolveCityId(addr?.city, addr?.province, addr?.postalCode) || "",
    cityType: region.cityType || addr?.cityType || "",
    postalCode: addr?.postalCode || "",
    isPrimary: Boolean(addr?.isPrimary),
  };
}

// Format alamat untuk ditampilkan di ringkasan / detail pesanan.
export function formatAddressDisplay(addr) {
  if (!addr) return "Belum diatur";
  if (typeof addr === "string") return addr;

  const locationName = [addr.city, addr.province].filter(Boolean).join(", ");
  const addressParts = [
    addr.street,
    locationName,
    addr.postalCode ? `(${addr.postalCode})` : "",
  ].filter(Boolean);
  const core = addressParts.join(", ") || "Alamat tidak lengkap";

  const name = addr.recipientName
    ? `${addr.recipientName}${addr.recipientPhone ? ` (${addr.recipientPhone})` : ""}: `
    : "";

  return `${name}${core}`;
}

// Memilih alamat utama dari daftar (fallback ke alamat pertama).
export function pickPrimaryAddress(addresses = []) {
  return (
    addresses.find((a) => a.isPrimary) || addresses[0] || null
  );
}
