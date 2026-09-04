"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { shouldSkipAuthEvent } from "@/utils/authHelpers";
import { useStore } from "@/context/StoreContext";
import toast from "react-hot-toast";
import { normalizeAddress } from "@/utils/address";
import MyVouchers from "@/components/Dashboard/User/Vouchers/MyVouchers";
import { AddressFormModal, OTPModal } from "@/components/Dashboard/User/Profil/ProfileModals";
import profileConfig from "@/data/ui/userProfilConfig.json";
import { DEFAULT_ACTIVE_COURIERS, DEFAULT_ORIGIN_AREA_ID } from "@/config/shipping";
import styles from "./checkout.module.css";

// ID area Biteship untuk kota asal toko (di-resolve via nama kota di admin).
const ORIGIN_AREA_FALLBACK = DEFAULT_ORIGIN_AREA_ID;
const MAX_APPLIED_VOUCHERS = 2;

const emptyAddressForm = (displayName = "") => ({
  label: "Rumah",
  recipientName: displayName || "",
  recipientPhone: "",
  street: "",
  district: "",
  province: "",
  city: "",
  postalCode: "",
  biteshipAreaId: "",
  notes: "",
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

const COURIER_PROFILES = {
  jne: { name: "JNE", service: "REG", desc: "Layanan Reguler", offset: 0, etd: "1-3" },
  jnt: { name: "J&T Express", service: "EZ", desc: "Express Service", offset: 2000, etd: "1-2" },
  sicepat: { name: "SiCepat", service: "SIUNT", desc: "SiUntung", offset: 1000, etd: "1-2" },
  anteraja: { name: "AnterAja", service: "REG", desc: "Regular Service", offset: 1500, etd: "1-2" },
  ninja: { name: "Ninja Xpress", service: "STANDARD", desc: "Standard Service", offset: 2500, etd: "1-3" },
  pos: { name: "POS Indonesia", service: "POSREG", desc: "Pos Reguler", offset: -1000, etd: "2-4" },
  tiki: { name: "TIKI", service: "REG", desc: "Regular Service", offset: 500, etd: "1-3" },
  wahana: { name: "Wahana", service: "DES", desc: "Domestik Ekspres", offset: -3000, etd: "2-5" },
  lion: { name: "Lion Parcel", service: "REGPACK", desc: "Regular Package", offset: 1000, etd: "1-3" },
  ide: { name: "ID Express", service: "STD", desc: "Standard Service", offset: 1000, etd: "1-2" },
  sap: { name: "SAP Express", service: "UDR", desc: "UDR Reguler", offset: 1500, etd: "1-3" },
  rpx: { name: "RPX", service: "RGP", desc: "Regular Package", offset: 2000, etd: "1-3" },
};

const buildLocalCourierOptions = (courierList = [], weight = 0) => {
  const kg = Math.max(1, Math.ceil((Number(weight) || 0) / 1000));
  const base = Math.max(12000, 8000 + kg * 3500);

  const targets = (courierList && courierList.length > 0)
    ? courierList
    : ["jne", "jnt", "sicepat", "anteraja"];

  return targets.map((c) => {
    const code = String(c || "").toLowerCase();
    const profile = COURIER_PROFILES[code] || {
      name: code.toUpperCase(),
      service: "REG",
      desc: "Layanan Reguler",
      offset: 0,
      etd: "1-3",
    };
    return {
      courier: code,
      courierName: profile.name,
      service: profile.service,
      description: profile.desc,
      cost: Math.max(8000, base + (profile.offset || 0)),
      etd: profile.etd,
      key: `${code}-${profile.service}`,
      estimated: true,
    };
  });
};

// ─── CHECKOUT PAGE ──────────────────────────────────────────
export default function CheckoutPage() {
  const router = useRouter();
  const { cart, products, processPayment, isProcessing: isStoreProcessing, activePromo, discountedCartTotal, cartTotal } =
    useStore();

  // ── Auth ──
  const [currentUser, setCurrentUser] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const lastUserIdRef = useRef(null);

  // ── Voucher State ──
  const [claimedVouchers, setClaimedVouchers] = useState([]);
  const [appliedVouchers, setAppliedVouchers] = useState([]);
  const [showVoucherModal, setShowVoucherModal] = useState(false);

  // ── Store Settings ──
  const [activeCouriers, setActiveCouriers] = useState(["jne", "jnt", "sicepat"]);
  const [storeSettings, setStoreSettings] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("midtrans");
  const [originAreaId, setOriginAreaId] = useState(ORIGIN_AREA_FALLBACK);

  const fetchUserClaimedVouchers = async (userId, token) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [profileRes, vouchersRes] = await Promise.all([
        token
          ? fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/profile", { headers, cache: "no-store" })
          : Promise.resolve(null),
        fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/vouchers/public", { cache: "no-store" }),
      ]);

      let publicVouchers = [];
      if (vouchersRes && vouchersRes.ok) {
        const vData = await vouchersRes.json();
        const rawList = vData.data || vData.vouchers || [];
        publicVouchers = rawList.map((v) => ({
          ...v,
          id: String(v.id),
          status: "active",
          vouchers: v,
        }));
      }

      let userVouchers = [];
      if (profileRes && profileRes.ok) {
        const pData = await profileRes.json();
        if (pData.exists && pData.data?.user_vouchers) {
          userVouchers = pData.data.user_vouchers;
        }
      }

      const combined = [...userVouchers];
      for (const pv of publicVouchers) {
        const alreadyExists = combined.some(
          (cv) => String(cv.voucher_id || cv.vouchers?.id || cv.id) === String(pv.id),
        );
        if (!alreadyExists) {
          combined.push(pv);
        }
      }

      setClaimedVouchers(combined);
    } catch (err) {
      console.error("Gagal memuat voucher checkout:", err);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      lastUserIdRef.current = session?.user?.id || null;
      const user = session?.user || null;
      setCurrentUser(user);
      setPageLoading(false);

      if (!user) {
        router.push("/login?callbackUrl=/checkout");
      } else {
        fetchUserClaimedVouchers(user.id, session.access_token);
      }
    };

    initAuth();

    // Fetch store settings for couriers and payment methods
    fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/settings?public=true")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setStoreSettings(data);
          if (data.activeCouriers) {
            setActiveCouriers(data.activeCouriers);
          }
          // Resolve origin area dari nama kota toko
          if (data.storeCityName) {
            fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/biteship/areas?q=${encodeURIComponent(data.storeCityName)}`)
              .then((r) => r.json())
              .then((d) => { if (d.areas?.[0]?.id) setOriginAreaId(d.areas[0].id); })
              .catch(() => { });
          }
          // Default payment method logic
          if (data.enableMidtrans && !data.enableManualTransfer) {
            setPaymentMethod("midtrans");
          } else if (!data.enableMidtrans && data.enableManualTransfer) {
            setPaymentMethod("manual");
          } else {
            setPaymentMethod("midtrans"); // default if both active
          }
        }
      })
      .catch((err) => console.error("Failed to load settings:", err));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (shouldSkipAuthEvent(event, session, lastUserIdRef.current)) return;
      lastUserIdRef.current = session?.user?.id || null;

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

  // ── Address OTP ──
  const [verifiedPhones, setVerifiedPhones] = useState([]);
  const [isAddressOtpModalOpen, setIsAddressOtpModalOpen] = useState(false);
  const [addressOtpPhone, setAddressOtpPhone] = useState("");

  useEffect(() => {
    if (!currentUser) return;

    const loadAddresses = async () => {
      setAddressLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const r = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/addresses", {
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
          cache: "no-store",
        });
        const result = await r.json();

        if (r.ok) {
          const addrs = (result.data || result || []).map((addr) => normalizeAddress(addr));
          setAddresses(addrs);
          // Pre-verify phones that already exist in addresses
          setVerifiedPhones((prev) => {
            const existing = new Set(prev);
            addrs.forEach((a) => { if (a.recipientPhone) existing.add(a.recipientPhone); });
            return [...existing];
          });
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

  // ── Send OTP for address phone verification ──
  const handleSendAddressOtp = async (phone) => {
    const toastId = toast.loading("Mengirim kode verifikasi WhatsApp...");
    try {
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/auth/send-whatsapp-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal mengirim OTP");
      toast.dismiss(toastId);
      setAddressOtpPhone(phone);
      setIsAddressOtpModalOpen(true);
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  // ── Verify OTP for address phone ──
  const handleVerifyAddressOtp = async (otp) => {
    const toastId = toast.loading("Memverifikasi OTP...");
    try {
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/auth/verify-whatsapp-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: addressOtpPhone, code: otp }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "OTP tidak valid");
      toast.success("Nomor telepon diverifikasi!", { id: toastId });
      setIsAddressOtpModalOpen(false);
      setVerifiedPhones((prev) => [...prev, addressOtpPhone]);
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!addressForm.province || !addressForm.city || !addressForm.street || !addressForm.recipientName || !addressForm.postalCode) {
      toast.error("Harap lengkapi semua kolom: nama, telepon, alamat, provinsi, kota, dan kode pos.");
      return;
    }

    const isEditing = !!addressForm.id && addresses.some((a) => a.id === addressForm.id);
    if (!isEditing && addresses.length >= 3) {
      toast.error("Maksimal hanya dapat menyimpan 3 alamat. Hapus salah satu alamat di halaman profil jika ingin menambahkan yang baru.");
      return;
    }

    // Require OTP for new phone numbers
    if (addressForm.recipientPhone && !verifiedPhones.includes(addressForm.recipientPhone)) {
      toast.error("Harap verifikasi nomor telepon penerima terlebih dahulu.");
      return;
    }

    setSavingAddress(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const isPrimary = addressForm.isPrimary || addresses.length === 0;
      const payload = {
        recipientName: addressForm.recipientName,
        recipientPhone: addressForm.recipientPhone,
        street: addressForm.street,
        city: addressForm.city,
        cityId: addressForm.cityId || addressForm.biteshipAreaId || "",
        province: addressForm.province,
        postalCode: addressForm.postalCode,
        label: addressForm.label || "Rumah",
        isPrimary,
      };

      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const headers = {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      };

      let res;
      if (isEditing) {
        res = await fetch(`${apiBase}/api/user/addresses/${addressForm.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${apiBase}/api/user/addresses`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
      }

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal simpan alamat");

      // Reload from server to get canonical data
      const reloadRes = await fetch(`${apiBase}/api/user/addresses`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        cache: "no-store",
      });
      if (reloadRes.ok) {
        const reloadResult = await reloadRes.json();
        const addrs = (reloadResult.data || reloadResult || []).map((addr) => normalizeAddress(addr));
        setAddresses(addrs);
        const saved = result.data || result;
        if (saved?.id) setSelectedAddressId(saved.id);
        else if (addrs.length) setSelectedAddressId(addrs[addrs.length - 1].id);
      }

      setShowAddressModal(false);
      setAddressForm(emptyAddressForm());
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


  const shippingReadiness = useMemo(() => {
    if (!selectedAddress) {
      return {
        tone: "warning",
        title: "Pilih alamat pengiriman",
        detail: "Alamat yang lengkap akan membantu sistem menentukan ongkir secara akurat.",
      };
    }

    if (selectedAddress.city && (selectedAddress.district || selectedAddress.postalCode)) {
      const areaDesc = [selectedAddress.district ? `Kec. ${selectedAddress.district}` : "", selectedAddress.city].filter(Boolean).join(", ");
      return {
        tone: "success",
        title: "Area terlayani",
        detail: `${areaDesc} siap menerima pengiriman kurir.`,
      };
    }

    if (selectedAddress.city || selectedAddress.postalCode) {
      return {
        tone: "info",
        title: "Mendeteksi wilayah",
        detail: "Sistem mendeteksi wilayah tujuan untuk menghitung tarif pengiriman.",
      };
    }

    return {
      tone: "warning",
      title: "Alamat belum lengkap",
      detail: "Lengkapi kota dan kode pos agar sistem bisa menghitung ongkos kirim.",
    };
  }, [selectedAddress]);

  const fetchCourierCosts = useCallback(async () => {
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

    const safeFallbackOptions = buildLocalCourierOptions(activeCouriers, totalWeight);

    try {
      // Resolve destination area ID via Ongkir
      const searchTarget = [selectedAddress?.district, selectedAddress?.city].filter(Boolean).join(" ") || selectedAddress?.province || "";
      const postalCodeParam = selectedAddress?.postalCode || "";
      let destinationAreaId = "";
      const usingFallbackDestination = !searchTarget;

      if (searchTarget) {
        try {
          const areaUrl = `/api/biteship/areas?q=${encodeURIComponent(searchTarget)}&postalCode=${encodeURIComponent(postalCodeParam)}`;
          const areaRes = await fetch(areaUrl);
          const areaData = await areaRes.json();
          destinationAreaId = areaData.areas?.[0]?.id || "";
        } catch {
          destinationAreaId = "";
        }
      }

      if (!destinationAreaId) {
        // Tidak bisa resolve area → langsung fallback
        setCourierOptions(safeFallbackOptions);
        setSelectedCourierKey(safeFallbackOptions[0]?.key || null);
        setShippingCost(safeFallbackOptions[0]?.cost || 0);
        setShippingMeta({
          kind: "estimated",
          message: usingFallbackDestination
            ? "Lengkapi alamat untuk kalkulasi ongkir otomatis."
            : "Wilayah tujuan belum terdeteksi penuh di Ongkir. Menggunakan estimasi lokal.",
        });
        return;
      }

      // Satu request ke Ongkir dengan semua kurir aktif dari database/admin
      const couriersParam = (activeCouriers && activeCouriers.length > 0 ? activeCouriers : DEFAULT_ACTIVE_COURIERS).join(",");
      const ongkirUrl = `/api/ongkir?originAreaId=${encodeURIComponent(originAreaId || "")}&destinationAreaId=${encodeURIComponent(destinationAreaId)}&weight=${totalWeight}&couriers=${encodeURIComponent(couriersParam)}`;
      const ongkirRes = await fetch(ongkirUrl);
      const ongkirData = await ongkirRes.json();

      let fallbackMessage = ongkirData.fallback ? (ongkirData.warning || "") : "";
      const allCosts = [];

      const lowerActiveCouriers = (activeCouriers || []).map((c) => String(c).toLowerCase());
      for (const courier of ongkirData.costs || []) {
        const courierCode = String(courier.courier || "").toLowerCase();
        if (lowerActiveCouriers.length > 0 && !lowerActiveCouriers.includes(courierCode)) continue;
        for (const svc of courier.services || []) {
          allCosts.push({
            courier: courier.courier,
            courierName: courier.courierName,
            service: svc.service,
            description: svc.description,
            cost: svc.cost,
            etd: svc.etd,
            key: `${courier.courier}-${svc.service}`,
            estimated: Boolean(ongkirData.fallback),
          });
        }
      }

      const uniqueCosts = Array.from(
        new Map(allCosts.map((option) => [option.key, option])).values(),
      );

      if (uniqueCosts.length === 0) {
        setCourierOptions(safeFallbackOptions);
        setSelectedCourierKey(safeFallbackOptions[0]?.key || null);
        setShippingCost(safeFallbackOptions[0]?.cost || 0);
        setShippingMeta({
          kind: "estimated",
          message: fallbackMessage || "Tarif real-time belum tersedia. Menampilkan opsi estimasi lokal.",
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

      if (fallbackMessage) {
        setShippingMeta({ kind: "estimated", message: fallbackMessage });
      }

      const preferredKey =
        uniqueCosts.find((option) => option.key === selectedCourierKeyRef.current)?.key
        || uniqueCosts[0].key;
      const preferredOption = uniqueCosts.find((option) => option.key === preferredKey) || uniqueCosts[0];

      setSelectedCourierKey(preferredOption.key);
      setShippingCost(preferredOption.cost);
    } catch (err) {
      console.error("Gagal ambil ongkir:", err);
      setCourierOptions(safeFallbackOptions);
      const fallbackOption = safeFallbackOptions[0];
      setSelectedCourierKey(fallbackOption?.key || null);
      setShippingCost(fallbackOption?.cost || 0);
      setShippingMeta({
        kind: "estimated",
        message: "Kami menampilkan opsi pengiriman estimasi lokal karena layanan tarif sedang tidak tersedia.",
      });
    } finally {
      setCourierLoading(false);
    }
  }, [selectedAddress, totalWeight, activeCouriers, originAreaId]);

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

  const [voucherCodeInput, setVoucherCodeInput] = useState("");

  const handleApplyVoucherCode = (inputCode) => {
    const codeToFind = (inputCode || voucherCodeInput).trim().toUpperCase();
    if (!codeToFind) {
      toast.error("Masukkan kode voucher terlebih dahulu");
      return;
    }

    const matched = claimedVouchers.find((cv) => {
      const v = cv.vouchers || cv;
      return (v.code || "").trim().toUpperCase() === codeToFind;
    });

    if (!matched) {
      toast.error("Kode voucher tidak ditemukan atau sudah tidak berlaku");
      return;
    }

    handleSelectVoucherFromModal(matched);
    setVoucherCodeInput("");
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
      amount: subtotal,
      discountAmount: finalSubtotalDiscount,
      shippingCost: finalShippingCost,
      shippingAddress: selectedAddress,
      shippingDetail: {
        courierName: selectedCourierInfo?.courierName || "",
        courierService: selectedCourierInfo?.service || "",
        courierEtd: selectedCourierInfo?.etd || "",
      },
      shippingVoucherId: shippingVoucher?.id || null,
      shippingVoucherClaimId: shippingVoucher?.claimId || null,
      discountVoucherId: discountVoucher?.id || null,
      discountVoucherClaimId: discountVoucher?.claimId || null,
      paymentMethod,
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
                <div className={styles.addressList}>
                  {addresses.map((addr) => {
                    const hasFullArea = Boolean(addr.city && (addr.district || addr.postalCode));
                    const statusTone = hasFullArea ? styles.addressPillSuccess : addr.city || addr.postalCode ? styles.addressPillInfo : styles.addressPillNeutral;

                    return (
                      <div
                        key={addr.id}
                        className={`${styles.addressCard} ${selectedAddressId === addr.id ? styles.addressCardSelected : ""
                          }`}
                        onClick={() => setSelectedAddressId(addr.id)}
                      >
                        <div className={styles.addressContent}>
                          <span className={styles.addressLabel} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                            <span>
                              {addr.label || "Alamat"}
                              {addr.isPrimary && <span className={styles.primaryBadge}>Utama</span>}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddressForm(addr);
                                setShowAddressModal(true);
                              }}
                              style={{ background: "transparent", border: "1px solid var(--border-color)", color: "var(--text-primary)", fontSize: "0.7rem", padding: "3px 8px", borderRadius: "4px", cursor: "pointer" }}
                            >
                              Edit
                            </button>
                          </span>
                          <p className={styles.addressName}>{addr.recipientName}</p>
                          <p className={styles.addressPhone}>{addr.recipientPhone}</p>
                          <p className={styles.addressFull}>
                            {addr.street}, {addr.district ? `Kec. ${addr.district}, ` : ""}{addr.city}, {addr.province} {addr.postalCode ? ` - ${addr.postalCode}` : ""}
                          </p>
                          {addr.notes && (
                            <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "2px", marginBottom: "6px", fontStyle: "italic" }}>
                              📌 Patokan: {addr.notes}
                            </p>
                          )}
                          {!hasFullArea && (
                            <span className={`${styles.addressPill} ${styles.addressPillNeutral}`}>
                              ⚠️ Lengkapi kota & kode pos
                            </span>
                          )}
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
                {(shippingReadiness.tone !== "success" || shippingMeta.kind === "estimated") && (
                  <div className={`${styles.shippingStatus} ${styles[`shippingStatus${shippingMeta.kind === "estimated" ? "Warning" : shippingReadiness.tone === "info" ? "Info" : "Warning"}`]}`}>
                    <div>
                      <p className={styles.shippingStatusTitle}>
                        {shippingMeta.kind === "estimated" ? "Perhatian" : shippingReadiness.title}
                      </p>
                      <p className={styles.shippingStatusDetail}>
                        {shippingMeta.message || shippingReadiness.detail}
                      </p>
                    </div>
                    <div className={styles.shippingStatusActions}>
                      {shippingMeta.kind === "estimated" && (
                        <span className={styles.shippingStatusBadge}>Estimasi</span>
                      )}
                    </div>
                  </div>
                )}

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
                        className={`${styles.courierCard} ${selectedCourierKey === option.key ? styles.courierCardSelected : ""
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

          {/* ====== 3. VOUCHER & PROMO ====== */}
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

            {/* Input Kode Promo Manual */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <input
                type="text"
                placeholder="Punya kode promo? (Cth: MERDEKA99)"
                value={voucherCodeInput}
                onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyVoucherCode();
                  }
                }}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  background: "var(--surface-secondary)",
                  color: "var(--text-primary)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                }}
              />
              <button
                type="button"
                onClick={() => handleApplyVoucherCode()}
                className={styles.promoApplyBtn}
                aria-label="Terapkan Kode Voucher"
              >
                Terapkan
              </button>
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
                className={styles.voucherPickerBtn}
                aria-label="Pilih Voucher Belanja atau Ongkir"
              >
                <div className={styles.voucherPickerLabel}>
                  <span className={styles.voucherPickerIcon}>🎟️</span>
                  <span>
                    {appliedVouchers.length === 0
                      ? "Pilih / Masukkan Voucher Toko"
                      : "Tambah 1 Voucher Lagi (Diskon / Ongkir)"}
                  </span>
                </div>
                <span className={styles.voucherPickerBadge}>
                  {claimedVouchers.filter(v => v.status === "active").length} voucher tersedia &gt;
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

          {/* ─── PAYMENT METHOD SECTION ─── */}
          {(!storeSettings || storeSettings.enableMidtrans !== false || storeSettings.enableManualTransfer !== false) && (
            <section className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionStep}>4</span>
                  Metode Pembayaran
                </h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "1rem" }}>
                {(!storeSettings || storeSettings.enableMidtrans !== false) && (
                  <label style={{
                    display: "flex", alignItems: "center", gap: "12px", padding: "14px",
                    border: `1.5px solid ${paymentMethod === "midtrans" ? "var(--primary-accent)" : "var(--border-color)"}`,
                    borderRadius: "10px", cursor: "pointer",
                    background: paymentMethod === "midtrans" ? "rgba(var(--primary-accent-rgb), 0.05)" : "var(--surface-primary)",
                    transition: "all 0.2s ease"
                  }}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="midtrans"
                      checked={paymentMethod === "midtrans"}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      style={{ width: "18px", height: "18px", accentColor: "var(--primary-accent)" }}
                    />
                    <div>
                      <div style={{ fontWeight: "700", fontSize: "0.95rem" }}>⚡ Otomatis (Midtrans)</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "2px" }}>QRIS, Virtual Account (BCA, BRI, Mandiri, BNI), e-Wallet</div>
                    </div>
                  </label>
                )}

                {(!storeSettings || storeSettings.enableManualTransfer !== false) && (
                  <label style={{
                    display: "flex", alignItems: "center", gap: "12px", padding: "14px",
                    border: `1.5px solid ${paymentMethod === "manual" ? "var(--primary-accent)" : "var(--border-color)"}`,
                    borderRadius: "10px", cursor: "pointer",
                    background: paymentMethod === "manual" ? "rgba(var(--primary-accent-rgb), 0.05)" : "var(--surface-primary)",
                    transition: "all 0.2s ease"
                  }}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="manual"
                      checked={paymentMethod === "manual"}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      style={{ width: "18px", height: "18px", accentColor: "var(--primary-accent)" }}
                    />
                    <div>
                      <div style={{ fontWeight: "700", fontSize: "0.95rem" }}>🏦 Transfer Bank Manual</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "2px" }}>Transfer ke rekening bank toko & upload bukti transfer</div>
                    </div>
                  </label>
                )}
              </div>
            </section>
          )}

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
            disabled={isStoreProcessing || !selectedAddress || !selectedCourierKey}
          >
            <span className={styles.payButtonMain}>
              {isStoreProcessing ? "Memproses Pembayaran..." : `Bayar Sekarang • ${rupiah(grandTotal)}`}
            </span>
            {(!selectedAddress || !selectedCourierKey) && (
              <span className={styles.payButtonSub}>
                {!selectedAddress
                  ? "Pilih alamat terlebih dahulu"
                  : "Pilih kurir terlebih dahulu"}
              </span>
            )}
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

      {/* ─── MODAL TAMBAH ALAMAT ─── */}
      <AddressFormModal
        isOpen={showAddressModal}
        onClose={() => { setShowAddressModal(false); setAddressForm(emptyAddressForm()); }}
        currentAddress={addressForm}
        setCurrentAddress={setAddressForm}
        handleSaveAddress={handleSaveAddress}
        profileConfig={profileConfig}
        loading={savingAddress}
        verifiedPhones={verifiedPhones}
        onSendOtp={handleSendAddressOtp}
      />

      {/* ─── OTP MODAL (verifikasi nomor HP penerima) ─── */}
      <OTPModal
        isOpen={isAddressOtpModalOpen}
        onClose={() => setIsAddressOtpModalOpen(false)}
        onSubmit={handleVerifyAddressOtp}
        onResend={handleSendAddressOtp}
        phone={addressOtpPhone}
        loading={false}
      />
    </div>
  );
}