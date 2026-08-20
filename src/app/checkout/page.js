"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useStore } from "@/context/StoreContext";
import toast from "react-hot-toast";
import { ProvinceCitySelect } from "@/components/UI/ProvinceCitySelect/ProvinceCitySelect";
import { buildAddressId, normalizeAddress, resolveAddressRegion, resolveCityId } from "@/utils/address";
import MyVouchers from "@/components/Dashboard/User/Vouchers/MyVouchers";
import styles from "./checkout.module.css";

const ORIGIN_CITY_ID = "114"; // Jakarta
const MAX_APPLIED_VOUCHERS = 2;

const emptyAddressForm = (displayName = "") => ({
  label: "Rumah",
  recipientName: displayName || "",
  recipientPhone: "",
  street: "",
  province: "",
  city: "",
  cityId: "",
  cityType: "",
  postalCode: "",
});

// ─── HELPERS ────────────────────────────────────────────────
const rupiah = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);

const getVoucherCategory = (voucher) =>
  voucher?.type === "shipping" ? "shipping" : "discount";

const buildLocalCourierOptions = (weight = 0) => {
  const kg = Math.max(1, Math.ceil((Number(weight) || 0) / 1000));
  const base = Math.max(12000, 8000 + kg * 3500);

  return [
    {
      courier: "jne",
      courierName: "JNE",
      service: "REG",
      description: "Layanan reguler",
      cost: base,
      etd: "1-2",
      key: "jne-REG",
      estimated: true,
    },
    {
      courier: "jnt",
      courierName: "J&T",
      service: "EZ",
      description: "Layanan cepat",
      cost: base + 3000,
      etd: "1-2",
      key: "jnt-EZ",
      estimated: true,
    },
    {
      courier: "pos",
      courierName: "POS Indonesia",
      service: "POS",
      description: "Layanan pos",
      cost: Math.max(9000, base - 1000),
      etd: "3-5",
      key: "pos-POS",
      estimated: true,
    },
  ];
};

// ─── CHECKOUT PAGE ──────────────────────────────────────────
export default function CheckoutPage() {
  const router = useRouter();
  const { cart, products, processPayment, isProcessing, activePromo, discountedCartTotal, cartTotal } =
    useStore();

  // ── Auth ──
  const [currentUser, setCurrentUser] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);

  // ── Voucher State ──
  const [claimedVouchers, setClaimedVouchers] = useState([]);
  const [appliedVouchers, setAppliedVouchers] = useState([]);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  
  // ── Store Settings ──
  const [activeCouriers, setActiveCouriers] = useState(["jne", "jnt", "pos"]);

  const fetchUserClaimedVouchers = async (userId, token) => {
    try {
      const res = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      if (res.ok && result.success && result.profile) {
        setClaimedVouchers(result.profile.user_vouchers || []);
      }
    } catch (err) {
      console.error("Gagal memuat voucher tersimpan:", err);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user || null;
      setCurrentUser(user);
      setPageLoading(false);
      if (!user) {
        router.push("/login?callbackUrl=/checkout");
      } else {
        fetchUserClaimedVouchers(user.id, session.access_token);
      }
    });

    // Fetch store settings for couriers
    fetch("/api/settings?public=true")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.activeCouriers) {
          setActiveCouriers(data.activeCouriers);
        }
      })
      .catch((err) => console.error("Failed to load settings:", err));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user || null;
      setCurrentUser(user);
      if (event === 'SIGNED_OUT' || !user) {
        router.push("/login?callbackUrl=/checkout");
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [router]);

  // ── Scroll Lock Fix ──
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverflowY = document.body.style.overflowY;
    const previousBodyTouchAction = document.body.style.touchAction;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlOverflowY = document.documentElement.style.overflowY;
    const previousHtmlTouchAction = document.documentElement.style.touchAction;
    const previousBodyOverscrollBehaviorY = document.body.style.overscrollBehaviorY;
    const previousHtmlOverscrollBehaviorY = document.documentElement.style.overscrollBehaviorY;

    document.body.style.overflow = "auto";
    document.body.style.overflowY = "auto";
    document.body.style.touchAction = "pan-y";
    document.body.style.overscrollBehaviorY = "auto";
    document.documentElement.style.overflow = "auto";
    document.documentElement.style.overflowY = "auto";
    document.documentElement.style.touchAction = "pan-y";
    document.documentElement.style.overscrollBehaviorY = "auto";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overflowY = previousBodyOverflowY;
      document.body.style.touchAction = previousBodyTouchAction;
      document.body.style.overscrollBehaviorY = previousBodyOverscrollBehaviorY;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.overflowY = previousHtmlOverflowY;
      document.documentElement.style.touchAction = previousHtmlTouchAction;
      document.documentElement.style.overscrollBehaviorY = previousHtmlOverscrollBehaviorY;
    };
  }, []);

  // ── Address ──
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [addressLoading, setAddressLoading] = useState(true);

  // ── Address Modal ──
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressForm, setAddressForm] = useState(emptyAddressForm());
  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const loadAddresses = async () => {
      setAddressLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const r = await fetch(`/api/users?userId=${currentUser.id}`, {
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        });
        const result = await r.json();

        if (result.exists && result.data?.addresses) {
          const addrs = (result.data.addresses || []).map((addr) => normalizeAddress(addr));
          setAddresses(addrs);
        }
      } catch {
        toast.error("Gagal memuat alamat");
      } finally {
        setAddressLoading(false);
      }
    };

    void loadAddresses();
  }, [currentUser]);

  // ── Courier ──
  const [courierOptions, setCourierOptions] = useState([]);
  const [selectedCourierKey, setSelectedCourierKey] = useState(null);
  const [courierLoading, setCourierLoading] = useState(false);
  const [shippingCost, setShippingCost] = useState(0);
  const [shippingMeta, setShippingMeta] = useState({ kind: "", message: "" });
  const selectedCourierKeyRef = useRef(null);

  useEffect(() => {
    selectedCourierKeyRef.current = selectedCourierKey;
  }, [selectedCourierKey]);

  useEffect(() => {
    if (!addresses.length) return;
    const existingSelection = addresses.find((addr) => addr.id === selectedAddressId);
    if (existingSelection) return;

    const bestAddress = addresses.find((addr) => addr.isPrimary)
      || addresses.find((addr) => addr.cityId || addr.postalCode)
      || addresses[0];

    if (bestAddress && selectedAddressId !== bestAddress.id) {
      setSelectedAddressId(bestAddress.id);
    }
  }, [addresses, selectedAddressId]);

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!addressForm.province || !addressForm.city || !addressForm.street || !addressForm.recipientName || !addressForm.postalCode) {
      toast.error("Harap lengkapi semua kolom: nama, telepon, alamat, provinsi, kota, dan kode pos.");
      return;
    }

    setSavingAddress(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const newAddr = normalizeAddress({
        ...addressForm,
        cityId: resolveCityId(
          addressForm.city,
          addressForm.province,
          addressForm.postalCode,
        ) || addressForm.cityId,
        id: buildAddressId(),
        isPrimary: addresses.length === 0,
      });

      const updated = [...addresses, newAddr];
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          userId: currentUser.id,
          type: "addresses",
          addresses: updated,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal simpan alamat");

      setAddresses(updated);
      setSelectedAddressId(newAddr.id);
      setShowAddressModal(false);
      toast.success("Alamat berhasil disimpan!");
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan alamat");
    } finally {
      setSavingAddress(false);
    }
  };

  const totalWeight = useMemo(() => {
    let w = 0;
    for (const item of cart.items || []) {
      const prod = (products || []).find((p) => String(p.id) === String(item.id));
      const itemWeight = Number(prod?.weight) || 250;
      w += itemWeight * (Number(item.quantity) || 1);
    }
    return w;
  }, [cart.items, products]);

  const selectedAddress = useMemo(
    () => addresses.find((a) => a.id === selectedAddressId),
    [addresses, selectedAddressId],
  );

  const selectedAddressRegion = useMemo(() => {
    if (!selectedAddress) return null;
    return resolveAddressRegion(
      selectedAddress.city,
      selectedAddress.province,
      selectedAddress.postalCode,
    );
  }, [selectedAddress]);

  const shippingReadiness = useMemo(() => {
    if (!selectedAddress) {
      return {
        tone: "warning",
        title: "Pilih alamat pengiriman",
        detail: "Alamat yang lengkap akan membantu sistem menentukan ongkir secara akurat.",
      };
    }

    if (selectedAddressRegion?.cityId) {
      return {
        tone: "success",
        title: "Area terlayani",
        detail: `${selectedAddressRegion.city}, ${selectedAddressRegion.province} siap menerima pengiriman.`,
      };
    }

    if (selectedAddress.postalCode) {
      return {
        tone: "info",
        title: "Mendeteksi wilayah",
        detail: "Kode pos sedang dipakai untuk memperkirakan tarif pengiriman.",
      };
    }

    return {
      tone: "warning",
      title: "Alamat belum lengkap",
      detail: "Lengkapi kode pos dan kota agar sistem bisa menghitung ongkos kirim.",
    };
  }, [selectedAddress, selectedAddressRegion]);

  const fetchCourierCosts = useCallback(async () => {
    const inferredCityId = selectedAddress?.cityId || resolveCityId(selectedAddress?.city, selectedAddress?.province, selectedAddress?.postalCode) || resolveAddressRegion(selectedAddress?.city, selectedAddress?.province, selectedAddress?.postalCode)?.cityId || "";
    const destinationCityId = inferredCityId || "114";
    const usingFallbackDestination = !inferredCityId;

    if (!totalWeight) {
      setCourierOptions([]);
      setSelectedCourierKey(null);
      setShippingCost(0);
      return;
    }

    setCourierLoading(true);
    setCourierOptions([]);
    setShippingCost(0);
    setShippingMeta({ kind: "", message: "" });

    const localFallbackOptions = buildLocalCourierOptions(totalWeight).filter(c => activeCouriers.includes(c.courier));

    try {
      const couriersToFetch = activeCouriers.length > 0 ? activeCouriers : ["jne", "jnt", "pos"];
      const results = await Promise.allSettled(
        couriersToFetch.map((c) =>
          fetch(
            `/api/ongkir?origin=${ORIGIN_CITY_ID}&destination=${destinationCityId}&weight=${totalWeight}&courier=${c}`,
          ).then((r) => r.json()),
        ),
      );

      const allCosts = [];
      let fallbackMessage = "";

      for (const result of results) {
        if (result.status === "fulfilled" && result.value.success) {
          if (result.value.fallback && result.value.warning) {
            fallbackMessage = result.value.warning;
          }

          const costs = result.value.costs || [];
          for (const courier of costs) {
            if (activeCouriers.length > 0 && !activeCouriers.includes(courier.courier)) continue;
            for (const svc of courier.services || []) {
              allCosts.push({
                courier: courier.courier,
                courierName: courier.courierName,
                service: svc.service,
                description: svc.description,
                cost: svc.cost,
                etd: svc.etd,
                key: `${courier.courier}-${svc.service}`,
                estimated: Boolean(result.value.fallback),
              });
            }
          }
        }
      }

      const uniqueCosts = Array.from(
        new Map(allCosts.map((option) => [option.key, option])).values(),
      );

      if (uniqueCosts.length === 0) {
        setCourierOptions(localFallbackOptions);
        setSelectedCourierKey(localFallbackOptions[0].key);
        setShippingCost(localFallbackOptions[0].cost);
        setShippingMeta({
          kind: "estimated",
          message: usingFallbackDestination
            ? "Wilayah tujuan belum terdeteksi penuh. Menampilkan opsi estimasi lokal."
            : fallbackMessage || "Tarif real-time belum tersedia. Menampilkan opsi estimasi lokal.",
        });
        return;
      }

      uniqueCosts.sort((a, b) => {
        if (a.estimated !== b.estimated) return a.estimated ? 1 : -1;
        if (a.cost !== b.cost) return a.cost - b.cost;
        const etdA = Number(String(a.etd || "0").split("-")[0]) || 999;
        const etdB = Number(String(b.etd || "0").split("-")[0]) || 999;
        return etdA !== etdB ? etdA - etdB : a.courierName.localeCompare(b.courierName);
      });

      setCourierOptions(uniqueCosts);

      if (fallbackMessage || usingFallbackDestination) {
        setShippingMeta({
          kind: "estimated",
          message: fallbackMessage.includes("RajaOngkir")
            ? fallbackMessage
            : usingFallbackDestination
              ? "Wilayah tujuan belum terdeteksi penuh. Menampilkan estimasi pengiriman."
              : "Tarif kurir disajikan dalam estimasi sementara.",
        });
      }

      const preferredKey =
        uniqueCosts.find((option) => option.key === selectedCourierKeyRef.current)?.key
        || uniqueCosts[0].key;
      const preferredOption = uniqueCosts.find((option) => option.key === preferredKey) || uniqueCosts[0];

      setSelectedCourierKey(preferredOption.key);
      setShippingCost(preferredOption.cost);
    } catch (err) {
      console.error("Gagal ambil ongkir:", err);
      setCourierOptions(localFallbackOptions);
      const fallbackOption = localFallbackOptions[0];
      setSelectedCourierKey(fallbackOption.key);
      setShippingCost(fallbackOption.cost);
      setShippingMeta({
        kind: "estimated",
        message: "Kami menampilkan opsi pengiriman estimasi lokal karena layanan tarif sedang tidak tersedia.",
      });
    } finally {
      setCourierLoading(false);
    }
  }, [selectedAddress, totalWeight, activeCouriers]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchCourierCosts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchCourierCosts]);

  const handleSelectCourier = (key, cost) => {
    setSelectedCourierKey(key);
    setShippingCost(cost);
  };

  // ── Pilihan Voucher ──
  const subtotal = activePromo ? discountedCartTotal : cartTotal;

  const shippingVoucher = useMemo(
    () => appliedVouchers.find((v) => getVoucherCategory(v) === "shipping") || null,
    [appliedVouchers],
  );
  const discountVoucher = useMemo(
    () => appliedVouchers.find((v) => getVoucherCategory(v) === "discount") || null,
    [appliedVouchers],
  );

  const handleSelectVoucherFromModal = (claimedVoucherEntry) => {
    const voucherDetail = claimedVoucherEntry.vouchers || claimedVoucherEntry;

    if (voucherDetail.min_purchase && subtotal < voucherDetail.min_purchase) {
      toast.error(`Minimum belanja untuk voucher ini adalah ${rupiah(voucherDetail.min_purchase)}`);
      return;
    }

    const category = getVoucherCategory(voucherDetail);
    const alreadyHasSameCategory = appliedVouchers.some(
      (v) => getVoucherCategory(v) === category,
    );

    if (alreadyHasSameCategory) {
      toast.error(
        category === "shipping"
          ? "Kamu sudah pakai 1 voucher gratis ongkir. Hapus dulu untuk menggantinya."
          : "Kamu sudah pakai 1 voucher diskon. Hapus dulu untuk menggantinya.",
      );
      return;
    }

    if (appliedVouchers.length >= MAX_APPLIED_VOUCHERS) {
      toast.error(`Maksimal ${MAX_APPLIED_VOUCHERS} voucher bisa dipakai sekaligus`);
      return;
    }

    setAppliedVouchers((prev) => [
      ...prev,
      {
        ...voucherDetail,
        claimId: claimedVoucherEntry.id,
      },
    ]);
    setShowVoucherModal(false);
    toast.success(`Voucher ${voucherDetail.code} berhasil diterapkan!`);
  };

  const handleRemoveVoucher = (claimId) => {
    setAppliedVouchers((prev) => prev.filter((v) => v.claimId !== claimId));
    toast.success("Voucher dibatalkan");
  };

  const shippingVoucherDiscount = useMemo(() => {
    if (!shippingVoucher) return 0;
    return Math.min(shippingCost, Number(shippingVoucher.discount_amount || 0));
  }, [shippingVoucher, shippingCost]);

  const subtotalVoucherDiscount = useMemo(() => {
    if (!discountVoucher) return 0;
    if (discountVoucher.type === "percentage") {
      return (subtotal * Number(discountVoucher.discount_amount || 0)) / 100;
    }
    return Number(discountVoucher.discount_amount || 0);
  }, [discountVoucher, subtotal]);

  const totalVoucherDiscount = shippingVoucherDiscount + subtotalVoucherDiscount;
  const finalShippingCost = Math.max(0, shippingCost - shippingVoucherDiscount);
  const finalSubtotalDiscount = subtotalVoucherDiscount;
  const grandTotal = Math.max(0, subtotal - finalSubtotalDiscount) + finalShippingCost;

  // ── Handle payment ──
  const handlePay = async () => {
    if (!selectedAddress) {
      toast.error("Pilih alamat pengiriman");
      return;
    }
    if (!selectedCourierKey) {
      toast.error("Pilih kurir pengiriman");
      return;
    }

    const selectedCourierInfo = courierOptions.find((c) => c.key === selectedCourierKey);

    localStorage.setItem(
      "checkout_shipping",
      JSON.stringify({
        addressId: selectedAddress.id,
        address: selectedAddress,
        courierKey: selectedCourierKey,
        courierName: selectedCourierInfo?.courierName || "",
        courierService: selectedCourierInfo?.service || "",
        courierEtd: selectedCourierInfo?.etd || "",
        shippingCost: finalShippingCost,
        appliedVoucherId: discountVoucher?.id || shippingVoucher?.id || null,
        voucherClaimId: discountVoucher?.claimId || shippingVoucher?.claimId || null,
        appliedVouchers: appliedVouchers.map((v) => ({
          voucherId: v.id,
          claimId: v.claimId,
          type: v.type,
          code: v.code,
        })),
        voucherDiscount: totalVoucherDiscount,
        shippingVoucherDiscount,
        subtotalVoucherDiscount,
      }),
    );

    await processPayment({
      shippingVoucherId: shippingVoucher?.id || null,
      shippingVoucherClaimId: shippingVoucher?.claimId || null,
      discountVoucherId: discountVoucher?.id || null,
      discountVoucherClaimId: discountVoucher?.claimId || null,
    });
  };

  const selectedCourierInfo = useMemo(
    () => courierOptions.find((c) => c.key === selectedCourierKey),
    [courierOptions, selectedCourierKey],
  );

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
          <div className={styles.stepItemActive}>
            <span className={styles.stepDotActive}></span>
            <span>Alamat</span>
          </div>
          <div className={styles.stepDivider}></div>
          <div className={styles.stepItem}> 
            <span className={styles.stepDot}></span>
            <span>Pembayaran</span>
          </div>
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
                  setAddressForm(emptyAddressForm(currentUser?.user_metadata?.name));
                  setShowAddressModal(true);
                }}
              >
                + Tambah Baru
              </button>
            </div>

            {addressLoading ? (
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>Memuat alamat...</p>
            ) : addresses.length === 0 ? (
              <div style={{ padding: "16px 0", textAlign: "center" }}>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "10px" }}>
                  Belum ada alamat tersimpan.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAddressForm(emptyAddressForm(currentUser?.user_metadata?.name));
                    setShowAddressModal(true);
                  }}
                  className={styles.sectionAction}
                  style={{ display: "inline-block" }}
                >
                  + Tambah Alamat Sekarang
                </button>
              </div>
            ) : (
              <div>
                {selectedAddressRegion?.cityId && (
                  <div className={styles.addressStatusBanner}>
                    <span className={styles.addressStatusDot}></span>
                    <span>
                      Wilayah terdeteksi: <strong>{selectedAddressRegion.city}</strong> · {selectedAddressRegion.province}
                    </span>
                  </div>
                )}
                <div className={styles.addressList}>
                  {addresses.map((addr) => {
                    const detectedRegion = resolveAddressRegion(addr.city, addr.province, addr.postalCode);
                    const statusTone = detectedRegion?.cityId ? styles.addressPillSuccess : addr.postalCode ? styles.addressPillInfo : styles.addressPillNeutral;

                    return (
                      <div
                        key={addr.id}
                        className={`${styles.addressCard} ${
                          selectedAddressId === addr.id ? styles.addressCardSelected : ""
                        }`}
                        onClick={() => setSelectedAddressId(addr.id)}
                      >
                        <div className={styles.addressContent}>
                          <span className={styles.addressLabel}>
                            {addr.label || "Alamat"}
                            {addr.isPrimary && <span className={styles.primaryBadge}>Utama</span>}
                          </span>
                          <p className={styles.addressName}>{addr.recipientName}</p>
                          <p className={styles.addressPhone}>{addr.recipientPhone}</p>
                          <p className={styles.addressFull}>
                            {addr.street}, {addr.city}, {addr.province} {addr.postalCode ? ` - ${addr.postalCode}` : ""}
                          </p>
                          <span className={`${styles.addressPill} ${statusTone}`}>
                            {detectedRegion?.cityId ? "Wilayah terdeteksi" : addr.postalCode ? "Kode pos terdaftar" : "Lengkapi detail alamat"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
            ) : (
              <>
                <div className={`${styles.shippingStatus} ${styles[`shippingStatus${shippingReadiness.tone === "success" ? "Success" : shippingReadiness.tone === "info" ? "Info" : "Warning"}`]}`}>
                  <div>
                    <p className={styles.shippingStatusTitle}>{shippingReadiness.title}</p>
                    <p className={styles.shippingStatusDetail}>
                      {shippingMeta.message
                        ? `${shippingReadiness.detail} ${shippingMeta.message}`
                        : shippingReadiness.detail}
                    </p>
                  </div>
                  <div className={styles.shippingStatusActions}>
                    {shippingMeta.kind === "estimated" && (
                      <span className={styles.shippingStatusBadge}>Estimasi</span>
                    )}
                    {shippingReadiness.tone === "success" && <span className={styles.shippingStatusBadge}>Tersedia</span>}
                  </div>
                </div>

                {courierLoading ? (
                  <div className={styles.courierLoading}>
                    <div className={styles.loadingSpinner} style={{ width: 24, height: 24, margin: "0 auto 0.5rem" }}></div>
                    Menghitung tarif pengiriman...
                  </div>
                ) : courierOptions.length === 0 ? (
                  <div className={styles.courierEmpty}>
                    <p>Belum ada opsi pengiriman yang bisa kami sarankan untuk alamat ini.</p>
                  </div>
                ) : (
                  <div className={styles.courierGrid}>
                    {courierOptions.map((option) => (
                      <div
                        key={option.key}
                        className={`${styles.courierCard} ${
                          selectedCourierKey === option.key ? styles.courierCardSelected : ""
                        }`}
                        onClick={() => handleSelectCourier(option.key, option.cost)}
                      >
                        <input
                          type="radio"
                          className={styles.courierRadio}
                          checked={selectedCourierKey === option.key}
                          onChange={() => handleSelectCourier(option.key, option.cost)}
                        />
                        <div className={styles.courierInfo}>
                          <div className={styles.courierHeaderRow}>
                            <p className={styles.courierName}>
                              {option.courierName.toUpperCase()} — {option.service}
                            </p>
                          </div>
                          <p className={styles.courierService}>{option.description}</p>
                          {option.etd && option.etd !== "-" && (
                            <p className={styles.courierEtd}>Estimasi tiba: {option.etd} hari</p>
                          )}
                        </div>
                        <div className={styles.courierPriceBox}>
                          <span className={styles.courierCost}>{rupiah(option.cost)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          {/* ====== 3. VOUCHER & PROMO (SIMPLIFIED & USER FRIENDLY) ====== */}
          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionStep}>3</span>
                Voucher Toko
              </h2>
              <span className={styles.voucherSlotCounter}>
                {appliedVouchers.length}/{MAX_APPLIED_VOUCHERS} Dipakai
              </span>
            </div>

            {/* List Voucher yang sedang diterapkan */}
            {appliedVouchers.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                {discountVoucher && (
                  <div className={styles.promoApplied}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--primary-accent)", fontWeight: 700 }}>
                        🏷️ Diskon Produk
                      </span>
                      <span>
                        <strong>{discountVoucher.code}</strong> ({discountVoucher.title})
                        {subtotalVoucherDiscount > 0 && ` • Hemat ${rupiah(subtotalVoucherDiscount)}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.promoRemoveBtn}
                      onClick={() => handleRemoveVoucher(discountVoucher.claimId)}
                    >
                      Hapus
                    </button>
                  </div>
                )}

                {shippingVoucher && (
                  <div className={styles.promoApplied}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--primary-accent)", fontWeight: 700 }}>
                        🚚 Gratis Ongkir
                      </span>
                      <span>
                        <strong>{shippingVoucher.code}</strong> ({shippingVoucher.title})
                        {shippingVoucherDiscount > 0 && ` • Hemat ${rupiah(shippingVoucherDiscount)}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.promoRemoveBtn}
                      onClick={() => handleRemoveVoucher(shippingVoucher.claimId)}
                    >
                      Hapus
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tombol Pemilih Voucher Terpadu */}
            {appliedVouchers.length < MAX_APPLIED_VOUCHERS ? (
              <button
                type="button"
                onClick={() => setShowVoucherModal(true)}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: "1px dashed var(--primary-accent)",
                  background: "rgba(var(--primary-accent-rgb), 0.04)",
                  color: "var(--primary-accent)",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🎟️</span>
                  <span>
                    {appliedVouchers.length === 0
                      ? "Pilih / Masukkan Voucher Toko"
                      : "Tambah 1 Voucher Lagi (Diskon / Ongkir)"}
                  </span>
                </div>
                <span style={{ fontSize: "0.75rem", background: "var(--surface-primary)", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                  {claimedVouchers.length} voucher tersedia &gt;
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowVoucherModal(true)}
                className={styles.sectionAction}
                style={{ marginTop: "4px", fontSize: "0.8rem" }}
              >
                Ubah Voucher yang Dipilih
              </button>
            )}
          </section>
        </div>

        {/* ─── RIGHT COLUMN — RINGKASAN ─── */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryHeader}>
            <h3 className={styles.summaryTitle}>Ringkasan Belanja</h3>
          </div>

          <div className={styles.summaryItems}>
            {(cart.items || []).map((item) => {
              const prod = (products || []).find((p) => String(p.id) === String(item.id));
              const imgSrc = item.image || prod?.image_url || prod?.imageUrl || "/assets/placeholder.jpg";
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
            <span>Subtotal Produk</span>
            <span>{rupiah(subtotal)}</span>
          </div>

          {discountVoucher && subtotalVoucherDiscount > 0 && (
            <div className={`${styles.summaryLine} ${styles.summaryLineDiscount}`}>
              <span>Diskon Voucher</span>
              <span>-{rupiah(subtotalVoucherDiscount)}</span>
            </div>
          )}

          <div className={styles.summaryLine}>
            <span>Ongkos Kirim</span>
            <span className={styles.summaryLineShipping}>
              {selectedCourierInfo ? (
                shippingVoucher && shippingVoucherDiscount > 0 ? (
                  <span>
                    <span style={{ textDecoration: "line-through", color: "var(--text-secondary)", marginRight: "6px" }}>
                      {rupiah(shippingCost)}
                    </span>
                    {rupiah(finalShippingCost)}
                  </span>
                ) : (
                  rupiah(shippingCost)
                )
              ) : "—"}
            </span>
          </div>

          <div className={`${styles.summaryLine} ${styles.summaryLineTotal}`}>
            <span>Total Pembayaran</span>
            <span>{rupiah(grandTotal)}</span>
          </div>

          <button
            className={styles.payButton}
            onClick={handlePay}
            disabled={isProcessing || !selectedAddress || !selectedCourierKey}
          >
            <span className={styles.payButtonMain}>
              {isProcessing ? "Memproses Pembayaran..." : `Bayar Sekarang • ${rupiah(grandTotal)}`}
            </span>
            <span className={styles.payButtonSub}>
              {!selectedAddress
                ? "Pilih alamat terlebih dahulu"
                : !selectedCourierKey
                  ? "Pilih kurir terlebih dahulu"
                  : "Pembayaran via Midtrans"}
            </span>
          </button>
        </div>
      </div>

      {/* ─── MODAL PILIH VOUCHER SAYA ─── */}
      {showVoucherModal && (
        <div className={styles.modalOverlay} onClick={() => setShowVoucherModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>Pilih Voucher Saya</h2>
                <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  Gunakan maks. 2 voucher (1 Diskon Belanja + 1 Gratis Ongkir).
                </p>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setShowVoucherModal(false)}>&times;</button>
            </div>
            
            <div style={{ maxHeight: "65vh", overflowY: "auto", padding: "10px 0" }}>
              <MyVouchers
                claimedVouchers={claimedVouchers}
                isCheckoutMode={true}
                onSelectVoucher={handleSelectVoucherFromModal}
                appliedClaimIds={appliedVouchers.map((v) => v.claimId)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL TAMBAH ALAMAT (DENGAN KODE POS & LABEL) ─── */}
      {showAddressModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddressModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>Tambah Alamat Baru</h2>
                <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  Isi data alamat dengan lengkap untuk mempermudah kurir.
                </p>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setShowAddressModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleSaveAddress} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "10px" }}>
              {/* Label Alamat */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Label Alamat</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Rumah / Kantor / Kos"
                  value={addressForm.label}
                  onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                  required
                />
              </div>

              {/* Nama Penerima & Telepon */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Nama Penerima</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="Nama Lengkap"
                    value={addressForm.recipientName}
                    onChange={(e) => setAddressForm({ ...addressForm, recipientName: e.target.value })}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Nomor Telepon</label>
                  <input
                    type="tel"
                    className={styles.formInput}
                    placeholder="08123456789"
                    value={addressForm.recipientPhone}
                    onChange={(e) => setAddressForm({ ...addressForm, recipientPhone: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Provinsi & Kota Select */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Provinsi & Kota / Kabupaten</label>
                <ProvinceCitySelect
                  value={{
                    province: addressForm.province,
                    city: addressForm.city,
                    cityId: addressForm.cityId,
                    cityType: addressForm.cityType,
                  }}
                  postalCode={addressForm.postalCode}
                  onChange={(value) => setAddressForm((prev) => ({ ...prev, ...value }))}
                />
              </div>

              {/* Kode Pos */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Kode Pos</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Contoh: 12345"
                  maxLength={5}
                  value={addressForm.postalCode}
                  onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value.replace(/\D/g, "") })}
                  required
                />
              </div>

              {/* Detail Alamat / Jalan */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Alamat Lengkap (Jalan, No. Rumah, RT/RW, Patokan)</label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="Jl. Mawar No. 12 RT 01/RW 02 (pagar hitam samping pos)"
                  value={addressForm.street}
                  onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                  rows={3}
                  required
                ></textarea>
              </div>

              <div className={styles.modalFooter} style={{ marginTop: "8px" }}>
                <button type="button" className={styles.modalBtnCancel} onClick={() => setShowAddressModal(false)} disabled={savingAddress}>
                  Batal
                </button>
                <button type="submit" className={styles.modalBtnSave} disabled={savingAddress}>
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