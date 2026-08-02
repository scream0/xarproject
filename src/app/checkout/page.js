"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { useStore } from "@/context/StoreContext";
import toast from "react-hot-toast";
import styles from "./checkout.module.css";

// ─── HELPERS ────────────────────────────────────────────────
const rupiah = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);

// ─── CHECKOUT PAGE ──────────────────────────────────────────
export default function CheckoutPage() {
  const router = useRouter();
  const {
    cart,
    products,
    user,
    processPayment,
    isProcessing,
    promoSettings,
    activePromo,
    promoSavings,
    discountedCartTotal,
    cartTotal,
    rupiah: ctxRupiah,
  } = useStore();

  // ── Auth ──
  const [currentUser, setCurrentUser] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
      setPageLoading(false);
      if (!u) {
        router.push("/login?callbackUrl=/checkout");
      }
    });
    return () => unsub();
  }, [router]);

  // ── Address ──
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [addressLoading, setAddressLoading] = useState(true);

  // ── Address Modal ──
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressForm, setAddressForm] = useState({
    label: "Rumah",
    recipientName: "",
    recipientPhone: "",
    street: "",
    city: "",
    cityId: "",
    postalCode: "",
  });
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  // ── Courier ──
  const [courierOptions, setCourierOptions] = useState([]);
  const [selectedCourier, setSelectedCourier] = useState(null);
  const [courierLoading, setCourierLoading] = useState(false);
  const [shippingCost, setShippingCost] = useState(0);

  // ── Promo ──
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);

  // ── Fetch user addresses ──
  useEffect(() => {
    if (!currentUser) return;
    setAddressLoading(true);
    fetch(`/api/users?userId=${currentUser.uid}`)
      .then((r) => r.json())
      .then((result) => {
        if (result.exists && result.data?.addresses) {
          const addrs = result.data.addresses;
          setAddresses(addrs);
          const primary = addrs.find((a) => a.isPrimary) || addrs[0];
          if (primary) setSelectedAddressId(primary.id);
        }
      })
      .catch(() => toast.error("Gagal memuat alamat"))
      .finally(() => setAddressLoading(false));
  }, [currentUser]);

  // ── Compute total weight from cart items ──
  const totalWeight = useMemo(() => {
    let w = 0;
    for (const item of cart.items || []) {
      const prod = (products || []).find((p) => String(p.id) === String(item.id));
      const itemWeight = Number(prod?.weight) || 250;
      w += itemWeight * (Number(item.quantity) || 1);
    }
    return w;
  }, [cart.items, products]);

  // ── Fetch courier costs when address changes ──
  const selectedAddress = useMemo(
    () => addresses.find((a) => a.id === selectedAddressId),
    [addresses, selectedAddressId],
  );

  const fetchCourierCosts = useCallback(async () => {
    if (!selectedAddress?.cityId || !totalWeight) {
      setCourierOptions([]);
      setSelectedCourier(null);
      setShippingCost(0);
      return;
    }

    setCourierLoading(true);
    setCourierOptions([]);
    setSelectedCourier(null);
    setShippingCost(0);

    try {
      // Fetch costs for multiple couriers
      const couriers = ["jne", "tiki", "pos", "jnt"];
      const results = await Promise.allSettled(
        couriers.map((c) =>
          fetch(
            `/api/ongkir?origin=114&destination=${selectedAddress.cityId}&weight=${totalWeight}&courier=${c}`,
          ).then((r) => r.json()),
        ),
      );

      const allCosts = [];
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.success) {
          for (const courier of result.value.costs) {
            for (const svc of courier.services) {
              allCosts.push({
                courier: courier.courier,
                courierName: courier.courierName,
                service: svc.service,
                description: svc.description,
                cost: svc.cost,
                etd: svc.etd,
                key: `${courier.courier}-${svc.service}`,
              });
            }
          }
        }
      }

      // Sort by price ascending
      allCosts.sort((a, b) => a.cost - b.cost);
      setCourierOptions(allCosts);

      // Auto-select cheapest
      if (allCosts.length > 0) {
        setSelectedCourier(allCosts[0].key);
        setShippingCost(allCosts[0].cost);
      }
    } catch (err) {
      console.error("Gagal ambil ongkir:", err);
    } finally {
      setCourierLoading(false);
    }
  }, [selectedAddress, totalWeight]);

  useEffect(() => {
    fetchCourierCosts();
  }, [fetchCourierCosts]);

  // ── Handle courier selection ──
  const handleSelectCourier = (key, cost) => {
    setSelectedCourier(key);
    setShippingCost(cost);
  };

  // ── City search ──
  const searchCities = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setCityResults([]);
      return;
    }
    setCityLoading(true);
    try {
      const res = await fetch(`/api/ongkir/cities?query=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success) setCityResults(data.cities || []);
    } catch {
      // ignore
    } finally {
      setCityLoading(false);
    }
  }, []);

  let debounceTimer;
  const handleCityInput = (val) => {
    setCityQuery(val);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => searchCities(val), 300);
  };

  const selectCity = (city) => {
    setAddressForm((prev) => ({
      ...prev,
      city: `${city.type} ${city.city_name}`,
      cityId: city.city_id,
    }));
    setCityQuery(`${city.type} ${city.city_name}`);
    setCityResults([]);
  };

  // ── Save new address ──
  const handleSaveAddress = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!addressForm.cityId || !addressForm.street || !addressForm.recipientName) {
      toast.error("Harap isi semua bidang wajib");
      return;
    }

    setSavingAddress(true);
    try {
      const newAddr = {
        id: `ADDR-${Date.now()}`,
        label: addressForm.label,
        recipientName: addressForm.recipientName,
        recipientPhone: addressForm.recipientPhone,
        street: addressForm.street,
        city: addressForm.city,
        cityId: addressForm.cityId,
        postalCode: addressForm.postalCode,
        isPrimary: addresses.length === 0,
      };

      const updated = [...addresses, newAddr];
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.uid,
          type: "addresses",
          addresses: updated,
        }),
      });

      if (!res.ok) throw new Error("Gagal simpan alamat");

      setAddresses(updated);
      setSelectedAddressId(newAddr.id);
      setShowAddressModal(false);
      toast.success("Alamat berhasil disimpan!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingAddress(false);
    }
  };

  // ── Apply promo ──
  const handleApplyPromo = () => {
    if (!promoCode.trim()) {
      toast.error("Masukkan kode promo");
      return;
    }
    // Simulasi validasi — di real app, call API /api/settings?code=xxx
    if (promoCode.toUpperCase() === "XAR10" || promoCode.toUpperCase() === "WELCOME") {
      setPromoApplied(true);
      toast.success("Kode promo berhasil diterapkan!");
    } else {
      toast.error("Kode promo tidak valid");
    }
  };

  const handleRemovePromo = () => {
    setPromoApplied(false);
    setPromoCode("");
  };

  // ── Handle payment ──
  const handlePay = async () => {
    if (!selectedAddress) {
      toast.error("Pilih alamat pengiriman");
      return;
    }
    if (!selectedCourier) {
      toast.error("Pilih kurir pengiriman");
      return;
    }

    // Store shipping info in localStorage for processPayment to read
    localStorage.setItem(
      "checkout_shipping",
      JSON.stringify({
        addressId: selectedAddress.id,
        courier: selectedCourier,
        shippingCost,
      }),
    );

    await processPayment();
  };

  // ── Total ──
  const subtotal = activePromo ? discountedCartTotal : cartTotal;
  const grandTotal = subtotal + shippingCost;

  // ── Derive selected courier info ──
  const selectedCourierInfo = useMemo(
    () => courierOptions.find((c) => c.key === selectedCourier),
    [courierOptions, selectedCourier],
  );

  // ── Redirect if cart empty ──
  if (!pageLoading && (!cart.items || cart.items.length === 0)) {
    return (
      <div className={styles.checkoutPage}>
        <div className={styles.emptyCart}>
          <div className={styles.emptyCartIcon}>🛒</div>
          <h2 className={styles.emptyCartTitle}>Keranjang Belanja Kosong</h2>
          <p className={styles.emptyCartDesc}>
            Tambahkan produk terlebih dahulu sebelum checkout
          </p>
          <a href="/dashboard?tab=shop" className={styles.emptyCartBtn}>
            Belanja Sekarang
          </a>
        </div>
      </div>
    );
  }

  if (pageLoading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.loadingSpinner}></div>
        <p className={styles.loadingText}>Memuat halaman checkout...</p>
      </div>
    );
  }

  return (
    <div className={styles.checkoutPage}>
      {/* ─── HEADER ─── */}
      <header className={styles.checkoutHeader}>
        <a href="/dashboard?tab=shop" className={styles.checkoutBackLink}>
          ← Kembali ke Belanja
        </a>
        <h1 className={styles.checkoutTitle}>Checkout</h1>
        <div className={styles.checkoutSteps}>
          <span className={styles.stepDotActive}></span>
          <span>Alamat</span>
          <span className={styles.stepDot}></span>
          <span>Pembayaran</span>
        </div>
      </header>

      {/* ─── MAIN LAYOUT ─── */}
      <div className={styles.checkoutLayout}>
        {/* ─── LEFT COLUMN ─── */}
        <div className={styles.leftColumn}>
          {/* ====== 1. ALAMAT PENGIRIMAN ====== */}
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionStep}>1</span>
                Alamat Pengiriman
              </h2>
              <button
                className={styles.sectionAction}
                onClick={() => {
                  setAddressForm({
                    label: "Rumah",
                    recipientName: currentUser?.displayName || "",
                    recipientPhone: "",
                    street: "",
                    city: "",
                    cityId: "",
                    postalCode: "",
                  });
                  setCityQuery("");
                  setCityResults([]);
                  setShowAddressModal(true);
                }}
              >
                + Tambah Baru
              </button>
            </div>

            {addressLoading ? (
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                Memuat alamat...
              </p>
            ) : addresses.length === 0 ? (
              <div style={{ textAlign: "center", padding: "1rem" }}>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
                  Belum ada alamat pengiriman
                </p>
                <button
                  className={styles.addAddressBtn}
                  onClick={() => {
                    setAddressForm({
                      label: "Rumah",
                      recipientName: currentUser?.displayName || "",
                      recipientPhone: "",
                      street: "",
                      city: "",
                      cityId: "",
                      postalCode: "",
                    });
                    setCityQuery("");
                    setCityResults([]);
                    setShowAddressModal(true);
                  }}
                >
                  + Tambah Alamat Baru
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className={`${styles.addressCard} ${
                      selectedAddressId === addr.id ? styles.addressCardSelected : ""
                    }`}
                    onClick={() => setSelectedAddressId(addr.id)}
                  >
                    <input
                      type="radio"
                      className={styles.addressRadio}
                      checked={selectedAddressId === addr.id}
                      onChange={() => setSelectedAddressId(addr.id)}
                    />
                    <div className={styles.addressContent}>
                      <span className={styles.addressLabel}>
                        {addr.label || "Alamat"}
                        {addr.isPrimary && (
                          <span className={styles.primaryBadge}>Utama</span>
                        )}
                      </span>
                      <p className={styles.addressName}>{addr.recipientName}</p>
                      <p className={styles.addressPhone}>{addr.recipientPhone}</p>
                      <p className={styles.addressFull}>
                        {addr.street}, {addr.city}
                        {addr.postalCode ? ` (${addr.postalCode})` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ====== 2. KURIR PENGIRIMAN ====== */}
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionStep}>2</span>
                Pilih Kurir
              </h2>
            </div>

            {!selectedAddress ? (
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                Pilih alamat pengiriman terlebih dahulu
              </p>
            ) : courierLoading ? (
              <div className={styles.courierLoading}>
                <div className={styles.loadingSpinner} style={{ width: 24, height: 24, margin: "0 auto 0.5rem" }}></div>
                Menghitung tarif pengiriman...
              </div>
            ) : courierOptions.length === 0 ? (
              <div className={styles.courierEmpty}>
                <p>Tidak ada layanan kurir tersedia untuk tujuan ini</p>
                <p style={{ fontSize: "0.75rem", marginTop: "0.3rem" }}>
                  Berat: {(totalWeight / 1000).toFixed(1)} kg
                </p>
              </div>
            ) : (
              <div className={styles.courierGrid}>
                {courierOptions.map((option) => (
                  <div
                    key={option.key}
                    className={`${styles.courierCard} ${
                      selectedCourier === option.key ? styles.courierCardSelected : ""
                    }`}
                    onClick={() => handleSelectCourier(option.key, option.cost)}
                  >
                    <input
                      type="radio"
                      className={styles.courierRadio}
                      checked={selectedCourier === option.key}
                      onChange={() => handleSelectCourier(option.key, option.cost)}
                    />
                    <div className={styles.courierInfo}>
                      <p className={styles.courierName}>
                        {option.courierName.toUpperCase()} — {option.service}
                      </p>
                      <p className={styles.courierService}>{option.description}</p>
                      {option.etd && option.etd !== "-" && (
                        <p className={styles.courierEtd}>Estimasi: {option.etd} hari</p>
                      )}
                    </div>
                    <span className={styles.courierCost}>{rupiah(option.cost)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ====== 3. KODE PROMO ====== */}
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionStep}>3</span>
                Kode Promo
              </h2>
            </div>

            {promoApplied ? (
              <div className={styles.promoApplied}>
                <span>
                  ✅ Kode <strong>{promoCode.toUpperCase()}</strong> diterapkan
                  {promoSavings > 0 && ` — Hemat ${rupiah(promoSavings)}`}
                </span>
                <button className={styles.promoRemoveBtn} onClick={handleRemovePromo}>
                  Hapus
                </button>
              </div>
            ) : (
              <div className={styles.promoRow}>
                <input
                  type="text"
                  className={styles.promoInput}
                  placeholder="Masukkan kode promo"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                />
                <button className={styles.promoApplyBtn} onClick={handleApplyPromo}>
                  Pakai
                </button>
              </div>
            )}
          </section>
        </div>

        {/* ─── RIGHT COLUMN — RINGKASAN ─── */}
        <div className={styles.summaryCard}>
          <h3 className={styles.summaryTitle}>Ringkasan Belanja</h3>

          <div className={styles.summaryItems}>
            {(cart.items || []).map((item) => {
              const prod = (products || []).find(
                (p) => String(p.id) === String(item.id),
              );
              const imgSrc =
                item.image || prod?.image_url || prod?.imageUrl || "/assets/placeholder.jpg";
              return (
                <div key={item.cartId} className={styles.summaryItem}>
                  <div className={styles.summaryItemImg}>
                    <img src={imgSrc} alt={item.name} />
                  </div>
                  <div className={styles.summaryItemInfo}>
                    <p className={styles.summaryItemName}>{item.name}</p>
                    <p className={styles.summaryItemVariant}>{item.size}</p>
                    <p className={styles.summaryItemQty}>x{item.quantity}</p>
                  </div>
                  <span className={styles.summaryItemPrice}>
                    {rupiah(Number(item.price) * Number(item.quantity))}
                  </span>
                </div>
              );
            })}
          </div>

          <div className={styles.summaryLine}>
            <span>Subtotal</span>
            <span>{rupiah(subtotal)}</span>
          </div>

          {activePromo && promoSavings > 0 && (
            <div className={`${styles.summaryLine} ${styles.summaryLineDiscount}`}>
              <span>Diskon Promo</span>
              <span>-{rupiah(promoSavings)}</span>
            </div>
          )}

          <div className={styles.summaryLine}>
            <span>Ongkos Kirim</span>
            <span className={styles.summaryLineShipping}>
              {selectedCourierInfo
                ? rupiah(shippingCost)
                : "—"}
            </span>
          </div>

          {selectedCourierInfo && (
            <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "-0.25rem", marginBottom: "0.5rem" }}>
              {selectedCourierInfo.courierName.toUpperCase()} — {selectedCourierInfo.service}
              {selectedCourierInfo.etd !== "-" && ` · ${selectedCourierInfo.etd} hari`}
            </div>
          )}

          <div className={`${styles.summaryLine} ${styles.summaryLineTotal}`}>
            <span>Total Pembayaran</span>
            <span>{rupiah(grandTotal)}</span>
          </div>

          <button
            className={styles.payButton}
            onClick={handlePay}
            disabled={isProcessing || !selectedAddress || !selectedCourier}
          >
            {isProcessing
              ? "Memproses Pembayaran..."
              : `Bayar ${rupiah(grandTotal)}`}
            <span className={styles.payButtonSub}>
              {!selectedAddress
                ? "Pilih alamat terlebih dahulu"
                : !selectedCourier
                  ? "Pilih kurir terlebih dahulu"
                  : "Pembayaran via Midtrans (QRIS / VA / Convenience Store)"}
            </span>
          </button>
        </div>
      </div>

      {/* ─── MODAL TAMBAH ALAMAT ─── */}
      {showAddressModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowAddressModal(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Tambah Alamat Baru</h3>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setShowAddressModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAddress}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Label Alamat</label>
                <select
                  className={styles.formSelect}
                  value={addressForm.label}
                  onChange={(e) =>
                    setAddressForm({ ...addressForm, label: e.target.value })
                  }
                >
                  <option value="Rumah">Rumah</option>
                  <option value="Kantor">Kantor</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Nama Penerima *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={addressForm.recipientName}
                    onChange={(e) =>
                      setAddressForm({ ...addressForm, recipientName: e.target.value })
                    }
                    required
                    placeholder="Nama lengkap"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>No. Telepon *</label>
                  <input
                    type="tel"
                    className={styles.formInput}
                    value={addressForm.recipientPhone}
                    onChange={(e) =>
                      setAddressForm({ ...addressForm, recipientPhone: e.target.value })
                    }
                    required
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Kota/Kabupaten *</label>
                <div className={styles.citySearchWrapper}>
                  <input
                    type="text"
                    className={styles.citySearchInput}
                    value={cityQuery}
                    onChange={(e) => handleCityInput(e.target.value)}
                    placeholder="Cari kota... (min. 2 karakter)"
                  />
                  {cityResults.length > 0 && (
                    <div className={styles.cityDropdown}>
                      {cityResults.map((city) => (
                        <div
                          key={city.city_id}
                          className={`${styles.cityOption} ${
                            addressForm.cityId === city.city_id
                              ? styles.cityOptionSelected
                              : ""
                          }`}
                          onClick={() => selectCity(city)}
                        >
                          {city.type} {city.city_name}, {city.province}
                        </div>
                      ))}
                    </div>
                  )}
                  {cityLoading && (
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                      Mencari kota...
                    </p>
                  )}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Alamat Lengkap *</label>
                <textarea
                  className={styles.formTextarea}
                  value={addressForm.street}
                  onChange={(e) =>
                    setAddressForm({ ...addressForm, street: e.target.value })
                  }
                  required
                  placeholder="Nama jalan, nomor rumah, RT/RW, gedung, dll."
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Kode Pos</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={addressForm.postalCode}
                    onChange={(e) =>
                      setAddressForm({ ...addressForm, postalCode: e.target.value })
                    }
                    placeholder="Contoh: 40123"
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.modalBtnCancel}
                  onClick={() => setShowAddressModal(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={styles.modalBtnSave}
                  disabled={savingAddress}
                >
                  {savingAddress ? "Menyimpan..." : "Simpan Alamat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
