"use client";
import { useState, useEffect, useCallback } from "react";
import { resolveAddressRegion } from "@/utils/address";
import styles from "./ProvinceCitySelect.module.css";

/**
 * Pilih Provinsi → Kota/Kabupaten bergaya e-commerce profesional.
 *
 * - Data wilayah dimuat otomatis via Biteship.
 * - Jika API gagal/tidak tersedia, fallback ke input manual
 *   agar alamat tetap bisa disimpan.
 *
 * Props:
 *  - value        { province, city, cityId, cityType } objek nilai saat ini
 *  - onChange     (next) => void
 */
export function ProvinceCitySelect({ value = {}, onChange, postalCode = "" }) {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  const province = value.province || "";
  const city = value.city || "";
  const cityId = value.cityId || "";
  const cityType = value.cityType || "";

  const provinces = [
    ...new Set(cities.map((c) => c.province).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  const citiesInProvince = province
    ? cities
        .filter((c) => c.province === province)
        .sort((a, b) =>
          `${a.type} ${a.city_name}`.localeCompare(`${b.type} ${b.city_name}`),
        )
    : [];

  const loadCities = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/ongkir/cities", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Gagal memuat kota");
      setCities(data.cities || []);
      setManualMode(false);
    } catch {
      setCities([]);
      setLoadError(true);
      setManualMode(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCities();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadCities]);

  useEffect(() => {
    if (!postalCode || city || cityId) return;

    const region = resolveAddressRegion("", "", postalCode);
    if (region.cityId) {
      const next = {
        province: region.province || province,
        city: region.city || "",
        cityId: region.cityId,
        cityType: region.cityType || "",
      };

      window.setTimeout(() => {
        onChange(next);
      }, 0);
    }
  }, [postalCode, city, cityId, onChange, province]);

  const shouldManualMode = Boolean(
    manualMode || loadError || (!loading && cities.length === 0) || (province && cities.length > 0 && !provinces.includes(province)),
  );

  const handleProvinceChange = (e) => {
    const prov = e.target.value;
    onChange({ province: prov, city: "", cityId: "", cityType: "" });
  };

  const handleCityChange = (e) => {
    const c = citiesInProvince.find(
      (x) => `${x.type} ${x.city_name}` === e.target.value,
    );
    if (c) {
      onChange({
        province,
        city: `${c.type} ${c.city_name}`,
        cityId: String(c.city_id),
        cityType: c.type,
      });
    } else {
      onChange({ province, city: "", cityId: "", cityType: "" });
    }
  };

  const handleRetry = () => {
    setManualMode(false);
    loadCities();
  };

  // ── Mode manual (API tidak tersedia) ──
  if (shouldManualMode) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Provinsi *</label>
            <input
              type="text"
              className={styles.input}
              value={province}
              onChange={(e) => onChange({ ...value, province: e.target.value })}
              placeholder="Contoh: Jawa Barat"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Kota / Kabupaten *</label>
            <input
              type="text"
              className={styles.input}
              value={city}
              onChange={(e) =>
                onChange({ ...value, city: e.target.value, cityId: "" })
              }
              placeholder="Contoh: Kab. Bandung"
            />
          </div>
        </div>
        {loadError && (
          <button type="button" className={styles.retryBtn} onClick={handleRetry}>
            Coba muat daftar kota otomatis
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>Provinsi *</label>
          <select
            className={styles.select}
            value={province}
            onChange={handleProvinceChange}
            disabled={loading || cities.length === 0}
          >
            <option value="">
              {loading ? "Memuat data..." : "Pilih Provinsi"}
            </option>
            {provinces.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Kota / Kabupaten *</label>
          <select
            className={styles.select}
            value={city ? `${cityType} ${city}`.trim() || city : ""}
            onChange={handleCityChange}
            disabled={!province || loading || citiesInProvince.length === 0}
          >
            <option value="">
              {!province
                ? "Pilih provinsi dulu"
                : loading
                  ? "Memuat data..."
                  : "Pilih Kota / Kabupaten"}
            </option>
            {citiesInProvince.map((c) => (
              <option key={c.city_id} value={`${c.type} ${c.city_name}`}>
                {c.type} {c.city_name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {loadError && (
        <button type="button" className={styles.retryBtn} onClick={handleRetry}>
          Muat ulang daftar kota
        </button>
      )}
    </div>
  );
}
