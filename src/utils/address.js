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

// Menormalkan objek alamat agar semua field yang dibutuhkan UI selalu ada.
// Aman dipakai baik untuk data baru maupun data lama (tanpa cityId).
export function normalizeAddress(addr) {
  return {
    id: addr?.id || buildAddressId(),
    label: addr?.label || "Rumah",
    recipientName: addr?.recipientName || "",
    recipientPhone: addr?.recipientPhone || "",
    street: addr?.street || "",
    city: addr?.city || "",
    cityId: addr?.cityId || "",
    postalCode: addr?.postalCode || "",
    isPrimary: Boolean(addr?.isPrimary),
  };
}

// Format alamat untuk ditampilkan di ringkasan / detail pesanan.
export function formatAddressDisplay(addr) {
  if (!addr) return "Belum diatur";
  if (typeof addr === "string") return addr;

  const parts = [
    addr.street,
    addr.city,
    addr.postalCode ? `(${addr.postalCode})` : "",
  ].filter(Boolean);

  const name = addr.recipientName
    ? `${addr.recipientName}${addr.recipientPhone ? ` (${addr.recipientPhone})` : ""}: `
    : "";

  return `${name}${parts.join(", ") || "Alamat tidak lengkap"}`;
}

// Memilih alamat utama dari daftar (fallback ke alamat pertama).
export function pickPrimaryAddress(addresses = []) {
  return (
    addresses.find((a) => a.isPrimary) || addresses[0] || null
  );
}
