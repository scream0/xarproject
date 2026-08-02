"use client";
import { useState, useEffect, useCallback } from "react";
import styles from "./ProvinceCitySelect.module.css";

/**
 * Pilih Provinsi → Kota/Kabupaten bergaya e-commerce profesional.
 *
 * - Data kota dimuat sekali dari /api/ongkir/cities.
 * - Provinsi diturunkan dari data kota (Plan Starter RajaOngkir).
 * - Jika API gagal/tidak tersedia, fallback ke input manual
 *   agar alamat tetap bisa disimpan.
 *
 * Props:
 *  - value        { province, city, cityId, cityType } objek nilai saat ini
 *  - onChange     (next) => void
 */
export function ProvinceCitySelect({ value = {}, onChange }) {
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
      const res = await fetch("/api/ongkir/cities", { cache: "no-store" });
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
    loadCities();
  }, [loadCities]);

  // Jika data kota tidak punya provinsi yang dipilih (mis. alamat lama),
  // alihkan ke mode manual agar form tetap terisi.
  useEffect(() => {
    if (province && cities.length > 0 && !provinces.includes(province)) {
      setManualMode(true);
    }
  }, [province, cities, provinces]);

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
  if (manualMode) {
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
