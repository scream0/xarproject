"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import styles from "./CitySearchInput.module.css";

/**
 * Input pencarian kota/kabupaten (RajaOngkir) yang reusable.
 *
 * Props:
 *  - value        (string) Teks kota yang sedang dipilih (mis. "Kab. Bandung")
 *  - cityId       (string) ID kota yang sedang dipilih
 *  - onSelect     ({ city_id, city_name, province, type, postal_code }) => void
 *  - placeholder  (string, opsional)
 */
export function CitySearchInput({
  value = "",
  cityId = "",
  onSelect,
  placeholder = "Cari kota/kabupaten...",
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // Sinkron jika nilai dari luar berubah (mis. reset form).
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Tutup dropdown saat klik di luar komponen.
  useEffect(() => {
    const handleOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const search = useCallback(async (q) => {
    const trimmed = q.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/ongkir/cities?query=${encodeURIComponent(trimmed)}`,
      );
      const data = await res.json();
      if (data.success) {
        setResults(data.cities || []);
        setOpen(true);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (val) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (city) => {
    setQuery(`${city.type} ${city.city_name}`);
    setResults([]);
    setOpen(false);
    onSelect?.(city);
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <input
        type="text"
        className={styles.input}
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {loading && (
        <p className={styles.loadingText}>Mencari kota...</p>
      )}
      {open && results.length > 0 && (
        <div className={styles.dropdown}>
          {results.map((city) => {
            const isSelected = String(city.city_id) === String(cityId);
            return (
              <div
                key={city.city_id}
                className={`${styles.option} ${isSelected ? styles.optionSelected : ""}`}
                onClick={() => handleSelect(city)}
              >
                {city.type} {city.city_name}, {city.province}
              </div>
            );
          })}
        </div>
      )}
      {query && cityId && (
        <p className={styles.selectedHint}>
          ✓ Kota tersimpan ({query})
        </p>
      )}
    </div>
  );
}
