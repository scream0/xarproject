// @ts-nocheck
"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./BiteshipAreaSelect.module.css";

/**
 * Komponen pencarian wilayah Biteship (Kecamatan, Kota, Provinsi, Kode Pos).
 * Menggantikan selector RajaOngkir lama dengan autocomplete dinamis Biteship.
 *
 * Props:
 *  - value: { province, city, district, postalCode, biteshipAreaId }
 *  - onChange: (updatedFields) => void
 *  - placeholder: string
 */
export function BiteshipAreaSelect({
  value = {},
  onChange,
  placeholder = "Ketik nama Kecamatan, Kota, atau Kode Pos...",
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // Jika sudah ada data wilayah tersimpan dan user tidak sedang mengetik/edit
  const hasSelectedArea = Boolean(value.city && (value.district || value.province));

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    const handleOutside = (e: any) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const searchAreas = useCallback(async (keyword: any) => {
    const trimmed = keyword.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/biteship/areas?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (data.areas && Array.isArray(data.areas)) {
        setResults(data.areas);
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

  const handleInputChange = (e: any) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void searchAreas(val);
    }, 300);
  };

  const handleSelectArea = (area: any) => {
    // Ekstrak info wilayah dari payload Biteship
    const province =
      area.administrative_division_level_1_name ||
      area.administrative_division_level_1 ||
      "";
    const city =
      area.administrative_division_level_2_name ||
      area.administrative_division_level_2 ||
      "";
    const district =
      area.administrative_division_level_3_name ||
      area.administrative_division_level_3 ||
      "";
    const postalCode = area.postal_code ? String(area.postal_code) : "";
    const biteshipAreaId = area.id || "";

    onChange?.({
      province,
      city,
      district,
      postalCode: postalCode || value.postalCode || "",
      biteshipAreaId,
      // Hapus sisa legacy cityId/cityType
      cityId: "",
      cityType: "",
    });

    setQuery("");
    setResults([]);
    setOpen(false);
    setIsEditing(false);
  };

  const locationSummary = [
    value.district ? `Kec. ${value.district}` : "",
    value.city,
    value.province,
  ].filter(Boolean).join(", ");

  return (
    <div className={styles.container} ref={wrapperRef}>
      {hasSelectedArea && !isEditing ? (
        <div className={styles.selectedCard}>
          <div className={styles.selectedInfo}>
            <span className={styles.selectedTitle}>📍 {locationSummary}</span>
            <span className={styles.selectedDesc}>
              {value.postalCode ? `Kode Pos: ${value.postalCode}` : "Wilayah terverifikasi Biteship"}
            </span>
          </div>
          <button
            type="button"
            className={styles.changeBtn}
            onClick={() => {
              setIsEditing(true);
              setQuery(value.district || value.city || "");
            }}
          >
            Ubah Wilayah
          </button>
        </div>
      ) : (
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            className={styles.searchInput}
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              if (results.length > 0) setOpen(true);
            }}
            placeholder={placeholder}
            autoComplete="off"
          />
          {loading && <span className={styles.loadingSpinner}>Mencari...</span>}

          {open && results.length > 0 && (
            <div className={styles.dropdown}>
              {results.map((area) => {
                const prov =
                  area.administrative_division_level_1_name || "";
                const city =
                  area.administrative_division_level_2_name || "";
                const district =
                  area.administrative_division_level_3_name || "";
                const post = area.postal_code || "";

                return (
                  <div
                    key={area.id || `${city}-${district}-${post}`}
                    className={styles.optionItem}
                    onClick={() => handleSelectArea(area)}
                  >
                    <div className={styles.optionMain}>
                      <span>{district ? `Kec. ${district}` : city}</span>
                      {post && <span className={styles.postalBadge}>{post}</span>}
                    </div>
                    <div className={styles.optionSub}>
                      {[city, prov].filter(Boolean).join(", ")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className={styles.hintText}>
            Contoh pencarian: <em>"Depok Sleman"</em>, <em>"Gambir Jakarta"</em>, atau <em>"55281"</em>
          </p>
        </div>
      )}
    </div>
  );
}
