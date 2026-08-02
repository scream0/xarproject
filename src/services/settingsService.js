"use client";

/**
 * settingsService.js — Data-access layer untuk pengaturan toko & landing page.
 *
 * Semua komponen (landing publik maupun dashboard admin) HARUS memakai service ini
 * untuk membaca/menyimpan konfigurasi. Dengan begitu:
 *   1. Halaman landing publik memakai getPublicSettings() → TANPA token (bisa diakses siapa saja).
 *   2. Dashboard admin memakai getAdminSettings(token) → wajib bearer token admin.
 *   3. Penyimpanan memakai saveSettings(payload, token) → wajib bearer token admin.
 *
 * Service ini juga menangani cache sederhana (untuk menghindari request berulang
 * di komponen landing yang sama) dan fallback ke config JSON default.
 */

const CACHE_TTL = 5 * 60 * 1000; // 5 menit
let publicCache = { data: null, ts: 0 };

/**
 * GET public settings — aman untuk landing page publik.
 * Tidak mengirim token, server hanya mengembalikan data non-sensitif.
 */
export async function getPublicSettings({ force = false } = {}) {
  // Cache sederhana di sisi klien
  if (!force && publicCache.data && Date.now() - publicCache.ts < CACHE_TTL) {
    return publicCache.data;
  }

  const res = await fetch("/api/settings?public=true", {
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    console.error("settingsService.getPublicSettings error:", data?.error);
    return null;
  }

  publicCache = { data, ts: Date.now() };
  return data;
}

/**
 * GET admin settings — wajib auth admin. Memakai token ID Firebase.
 * @param {string|object} tokenOrUser - ID token atau Firebase user object
 */
export async function getAdminSettings(tokenOrUser) {
  const token = await resolveTokenAsync(tokenOrUser);
  if (!token) throw new Error("Admin token required.");

  const res = await fetch("/api/settings", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || "Gagal memuat pengaturan dari server.");
  }

  // Invalidate public cache karena config berubah
  publicCache = { data: null, ts: 0 };

  return data;
}

/**
 * PUT /api/settings — simpan pengaturan (store + landing + promo + payment).
 * @param {object} payload - object settings lengkap
 * @param {string|object} tokenOrUser - ID token atau Firebase user object
 */
export async function saveSettings(payload, tokenOrUser) {
  const token = await resolveTokenAsync(tokenOrUser);
  if (!token) throw new Error("Admin token required.");

  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || "Gagal menyimpan pengaturan.");
  }

  // Invalidate cache agar landing langsung memakai data terbaru
  publicCache = { data: null, ts: 0 };

  return data;
}

/**
 * Helper async untuk resolve token (mendukung user object langsung).
 */
export async function resolveTokenAsync(tokenOrUser) {
  if (!tokenOrUser) return "";
  if (typeof tokenOrUser === "string") return tokenOrUser;
  if (typeof tokenOrUser.getIdToken === "function") {
    try {
      return await tokenOrUser.getIdToken();
    } catch {
      return "";
    }
  }
  return tokenOrUser.token || "";
}

