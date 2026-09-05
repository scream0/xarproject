// @ts-nocheck
"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter, usePathname, useSearchParams, useParams } from "next/navigation";
import { auth, db } from "@/lib/supabaseClient";
import { shouldSkipAuthEvent } from "@/utils/authHelpers";
import toast from "react-hot-toast";
import { formatAddressDisplay } from "@/utils/address";
import styles from "./OrderDetailPage.module.css";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import ordersConfig from "@/data/ui/ordersConfig.json";

const STATUS_INFO = {
  pending: { label: "Menunggu Pembayaran", badgeClass: "statusPending", icon: "clock" },
  unpaid: { label: "Menunggu Pembayaran", badgeClass: "statusPending", icon: "clock" },
  success: { label: "Sedang Dikemas", badgeClass: "statusProcessing", icon: "package" },
  paid: { label: "Sedang Dikemas", badgeClass: "statusProcessing", icon: "package" },
  settlement: { label: "Sedang Dikemas", badgeClass: "statusProcessing", icon: "package" },
  capture: { label: "Sedang Dikemas", badgeClass: "statusProcessing", icon: "package" },
  processing: { label: "Sedang Dikemas", badgeClass: "statusProcessing", icon: "package" },
  shipping: { label: "Dalam Pengiriman", badgeClass: "statusShipping", icon: "truck" },
  shipped: { label: "Dalam Pengiriman", badgeClass: "statusShipping", icon: "truck" },
  delivered: { label: "Pesanan Selesai", badgeClass: "statusCompleted", icon: "shield-check" },
  completed: { label: "Pesanan Selesai", badgeClass: "statusCompleted", icon: "shield-check" },
  cancelled: { label: "Dibatalkan", badgeClass: "statusCancelled", icon: "x" },
  canceled: { label: "Dibatalkan", badgeClass: "statusCancelled", icon: "x" },
  return_requested: { label: "Pengajuan Return", badgeClass: "statusWarning", icon: "rotate-ccw" },
  returning: { label: "Barang Dikirim Balik", badgeClass: "statusShipping", icon: "truck" },
  returned: { label: "Return Selesai", badgeClass: "statusCompleted", icon: "shield-check" },
};

const RETURN_STATUS_INFO = {
  pending: { label: "⏳ Return Diproses", badgeClass: "statusReturn", icon: "rotate-ccw" },
  approved: { label: "✅ Return Disetujui", badgeClass: "statusCompleted", icon: "shield-check" },
  rejected: { label: "❌ Return Ditolak", badgeClass: "statusCancelled", icon: "x" },
};

function getStatusInfo(rawStatus: any) {
  const key = (rawStatus || "pending").toLowerCase();
  return STATUS_INFO[key] || { label: (rawStatus || "PENDING").toUpperCase(), badgeClass: "statusProcessing", icon: "package" };
}

function resolveHistoryEvent(event: any, index, order: any) {
  const statusValue = (event?.status_to || event?.status || event?.statusTo || "pending").toLowerCase();
  const info = getStatusInfo(statusValue);
  const changedAt = event?.created_at || event?.createdAt || event?.timestamp || event?.updated_at;

  let customLabel = info.label;
  const actor = String(event?.actor || "").toLowerCase();
  const actorLabel = event?.actor_label;

  if (statusValue === "cancelled" || statusValue === "canceled") {
    if (actorLabel) {
      customLabel = `Dibatalkan oleh ${actorLabel}`;
    } else if (actor === "user") {
      customLabel = "Dibatalkan oleh Pengguna";
    } else if (actor === "admin") {
      customLabel = "Dibatalkan oleh Admin";
    } else if (actor === "system" || actor === "system_auto_cancel" || actor === "webhook") {
      customLabel = "Dibatalkan Otomatis oleh Sistem";
    } else {
      customLabel = "Pesanan Dibatalkan";
    }
  } else if (statusValue === "completed") {
    if (actor === "user") {
      customLabel = "Dikonfirmasi Selesai oleh Pembeli";
    } else if (actor === "system") {
      customLabel = "Selesai Otomatis oleh Sistem";
    } else if (actor === "admin") {
      customLabel = "Diselesaikan oleh Admin";
    }
  } else if (statusValue === "paid") {
    if (actor === "webhook" || actor === "system") {
      customLabel = "Pembayaran Terverifikasi (Midtrans)";
    } else if (actor === "admin") {
      customLabel = "Pembayaran Dikonfirmasi oleh Admin";
    }
  } else if (statusValue === "returned") {
    customLabel = "Return Selesai (Disetujui)";
  } else if (statusValue === "return_requested") {
    customLabel = "Pengajuan Return Diproses";
  } else if (statusValue === "delivered" && order?.return_status === "rejected") {
    customLabel = "Return Ditolak (Pesanan Selesai)";
  }

  return {
    key: `${event?.id || index}-${index}`,
    label: customLabel,
    icon: info.icon,
    note: event?.notes || (statusValue === "cancelled" ? "Pesanan telah dibatalkan." : "Pembaruan status pesanan."),
    timestamp: changedAt ? new Date(changedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "Baru saja",
  };
}

export default function OrderDetailPage({ orderId: propOrderId }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeParams = useParams();
  const lastUserIdRef = useRef(null);

  // Menangkap orderId dari prop, useParams, searchParams (?order_id=...), atau URL path
  const resolvedOrderId = useMemo(() => {
    if (propOrderId) return propOrderId;
    if (routeParams?.id) return routeParams.id;
    if (routeParams?.orderId) return routeParams.orderId;

    const qOrderId = searchParams?.get("order_id") || searchParams?.get("id");
    if (qOrderId) return qOrderId;

    if (pathname) {
      const segments = pathname.split("/").filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      if (lastSegment && !["orders", "dashboard", "account"].includes(lastSegment.toLowerCase())) {
        return lastSegment;
      }
    }
    return null;
  }, [propOrderId, routeParams, searchParams, pathname]);

  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [shipping, setShipping] = useState(null);
  const [history, setHistory] = useState([]);
  const [trackingHistory, setTrackingHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copiedResi, setCopiedResi] = useState(false);

  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);

  // Review Modal States
  const [reviewModalOrder, setReviewModalOrder] = useState(null);
  const [reviewTargetItem, setReviewTargetItem] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewPhotoFile, setReviewPhotoFile] = useState(null);
  const [reviewPhotoPreview, setReviewPhotoPreview] = useState(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const [storeSettings, setStoreSettings] = useState(null);

  // Load Settings & Midtrans Snap Script
  useEffect(() => {
    const loadMidtrans = async () => {
      try {
        const { getPublicSettings } = await import('@/services/settingsService');
        const settings = await getPublicSettings();
        setStoreSettings(settings);
        if (!settings || settings.enableMidtrans === false) return;

        const isProduction = settings.midtransIsProduction === true;
        const snapScriptUrl = isProduction
          ? "https://app.midtrans.com/snap/snap.js"
          : "https://app.sandbox.midtrans.com/snap/snap.js";

        const clientKey = isProduction
          ? process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY_PRODUCTION
          : process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY_SANDBOX;

        if (!document.getElementById("midtrans-snap-script") && clientKey) {
          const script = document.createElement("script");
          script.id = "midtrans-snap-script";
          script.src = snapScriptUrl;
          script.setAttribute("data-client-key", clientKey);
          script.async = true;
          document.body.appendChild(script);
        }
      } catch (err) {
        console.error("Failed to load midtrans settings", err);
      }
    };
    loadMidtrans();
  }, []);

  useEffect(() => {
    let subscription = null;

    const initAuth = async () => {
      const { data: { session } } = await auth.getSession();
      lastUserIdRef.current = session?.user?.id || null;
      if (!session) {
        router.replace("/login");
        return;
      }
      setUser(session.user);

      const { data: authListener } = auth.onAuthStateChange((_event, session) => {
        if (shouldSkipAuthEvent(_event, session, lastUserIdRef.current)) return;
        lastUserIdRef.current = session?.user?.id || null;

        if (!session) {
          router.replace("/login");
        } else {
          setUser(session.user);
        }
      });
      subscription = authListener?.subscription;
    };

    initAuth();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [router]);

  // Tangkap parameter redirect dari Midtrans (settlement / sukses)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id") || params.get("id");
    const transactionStatus =
      params.get("transaction_status") || params.get("status_code");

    if (
      orderId &&
      (transactionStatus === "settlement" ||
        transactionStatus === "200" ||
        transactionStatus === "success")
    ) {
      toast.success(`Pembayaran untuk pesanan #${orderId} berhasil!`);

      fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/user/orders/${orderId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_status: transactionStatus === "200" ? "success" : transactionStatus }),
      }).catch((err) =>
        console.error("Gagal sinkronisasi status otomatis:", err),
      );

      const cleanUrl = `/dashboard/order-detail?id=${orderId}`;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  useEffect(() => {
    if (!resolvedOrderId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("ID Pesanan tidak ditemukan di URL.");
      setLoading(false);
      return;
    }
    if (!user) return;

    let isActive = true;
    setLoading(true);
    setError(null);

    const loadOrder = async () => {
      try {
        const { data: { session } } = await auth.getSession();
        const token = session?.access_token;

        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/user/orders/${resolvedOrderId}?userId=${user.id || user.uid}`, {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const contentType = res.headers.get("content-type");
        let result = {};

        if (contentType && contentType.includes("application/json")) {
          const text = await res.text();
          result = text ? JSON.parse(text) : {};
        } else {
          await res.text();
          if (!res.ok) {
            throw new Error(
              res.status === 404
                ? `Pesanan "${resolvedOrderId}" tidak ditemukan (404).`
                : `Gagal memuat detail pesanan (Status HTTP: ${res.status}).`
            );
          }
        }

        if (!res.ok) {
          throw new Error(result.error || `Gagal memuat detail pesanan (Status ${res.status}).`);
        }

        if (!isActive) return;

        const detailOrder = result.order || {};
        const detailShipping = result.shipping || null;
        const detailItems = Array.isArray(result.items) && result.items.length > 0 ? result.items : [];
        const detailHistory = Array.isArray(result.statusHistory) ? result.statusHistory : [];
        const detailTrackingHistory = Array.isArray(result.trackingHistory) ? result.trackingHistory : [];

        if (Object.keys(detailOrder).length === 0) {
          throw new Error("Detail pesanan yang Anda cari tidak tersedia atau sudah dihapus.");
        }

        setOrder(detailOrder);
        setItems(detailItems);
        setShipping(detailShipping);
        setHistory(detailHistory);
        setTrackingHistory(detailTrackingHistory);
      } catch (err) {
        console.error("Failed to load order detail page", err);
        setError(err.message || "Gagal memuat detail pesanan.");
        toast.error(err.message || "Gagal memuat detail pesanan.");
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadOrder();
    return () => {
      isActive = false;
    };
  }, [resolvedOrderId, user]);

  useEffect(() => {
    if (!resolvedOrderId) return;
    
    // Subscribe to realtime updates for this specific order
    const channel = db.channel(`order-updates-${resolvedOrderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${resolvedOrderId}`
        },
        (payload) => {
          console.log('[Supabase Realtime] Perubahan terdeteksi:', payload);
          if (payload.new) {
            const updated = payload.new;
            // Update state lokal (Anti-DDOS) tanpa perlu melakukan fetch ulang
            if (updated.status) {
              setOrder(prev => ({ ...prev, status: updated.status }));
            }
            if (updated.status_history) {
              setHistory(updated.status_history);
            }
            if (updated.tracking_history) {
              setTrackingHistory(updated.tracking_history);
            }
            
            // Tampilkan notifikasi toast untuk UX layaknya pesan masuk
            toast.success("Terdapat pembaruan status pesanan!", { id: `rt-${resolvedOrderId}` });
          }
        }
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [resolvedOrderId]);

  const combinedHistory = useMemo(() => {
    let combined = [];

    // Format trackingHistory (from Webhook)
    if (trackingHistory && trackingHistory.length > 0) {
      trackingHistory.forEach((trackEvent, index) => {
        combined.push({
          isWebhook: true,
          key: `track-${index}`,
          label: trackEvent.status || trackEvent.event,
          timestampStr: new Date(trackEvent.timestamp).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }),
          timestampDate: new Date(trackEvent.timestamp).getTime(),
          note: trackEvent.note || trackEvent.details?.history?.[0]?.note || "Status pengiriman diperbarui kurir."
        });
      });
    }

    // Format history (from DB order status changes)
    if (history && history.length > 0) {
      history.forEach((event, index) => {
        const resolved = resolveHistoryEvent(event, index, order);
        const changedAt = event?.created_at || event?.createdAt || event?.timestamp || event?.updated_at;
        const dateObj = changedAt ? new Date(changedAt) : new Date();
        
        combined.push({
          isWebhook: false,
          key: resolved.key,
          label: resolved.label,
          timestampStr: resolved.timestamp,
          timestampDate: dateObj.getTime(),
          note: resolved.note
        });
      });
    }

    const currentStatus = String(order?.status || "").toLowerCase();

    // Fallback: Jika pesanan dibatalkan tapi belum ada entri pembatalan di status_history
    const hasCancelledEvent = combined.some(
      (h) => String(h.label || "").toLowerCase().includes("batal") || String(h.note || "").toLowerCase().includes("batal")
    );
    if ((currentStatus === "cancelled" || currentStatus === "canceled") && !hasCancelledEvent) {
      const cancelTime = order?.updated_at || order?.updatedAt || order?.created_at || new Date().toISOString();
      combined.push({
        isWebhook: false,
        key: "fallback-cancel",
        label: "Dibatalkan oleh Pengguna",
        icon: "x",
        timestampStr: new Date(cancelTime).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }),
        timestampDate: new Date(cancelTime).getTime(),
        note: "Pesanan ini telah dibatalkan."
      });
    }

    // Fallback: Jika pesanan dibuat tapi belum ada entri dibuat di status_history
    const hasCreationEvent = combined.some(
      (h) => String(h.label || "").toLowerCase().includes("dibuat") || String(h.label || "").toLowerCase().includes("menunggu") || String(h.label || "").toLowerCase().includes("pending")
    );
    if (order?.created_at && !hasCreationEvent) {
      const createTime = order.created_at;
      combined.push({
        isWebhook: false,
        key: "fallback-creation",
        label: "Pesanan Dibuat",
        icon: "package",
        timestampStr: new Date(createTime).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }),
        timestampDate: new Date(createTime).getTime(),
        note: "Pesanan berhasil dibuat dan menunggu pembayaran."
      });
    }

    // Sort descending (newest first)
    combined.sort((a, b) => b.timestampDate - a.timestampDate);

    return combined;
  }, [trackingHistory, history, order]);

  const totalAmount = useMemo(() => {
    const raw = Number(order?.gross_amount || order?.total_amount || order?.amount || order?.rawPrice || 0);
    return Number.isFinite(raw) ? raw : 0;
  }, [order]);

  const discountAmount = useMemo(() => {
    const raw = Number(order?.discount_amount || order?.discountAmount || 0);
    return Number.isFinite(raw) ? raw : 0;
  }, [order]);

  const subtotalFromItems = useMemo(() => {
    if (items && items.length > 0) {
      return items.reduce((acc, item) => acc + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
    }
    return 0;
  }, [items]);

  const shippingCost = useMemo(() => {
    let raw = Number(order?.shipping_cost || order?.shippingCost || 0);
    if (raw === 0 && totalAmount > 0 && subtotalFromItems > 0) {
      raw = Math.max(0, totalAmount - subtotalFromItems + discountAmount);
    }
    return Number.isFinite(raw) ? raw : 0;
  }, [order, totalAmount, subtotalFromItems, discountAmount]);

  const subtotalAmount = useMemo(() => {
    if (subtotalFromItems > 0) return subtotalFromItems;
    return Math.max(0, totalAmount - shippingCost + discountAmount);
  }, [subtotalFromItems, totalAmount, shippingCost, discountAmount]);

  const shippingAddressText = useMemo(() => {
    const addr = shipping?.shipping_address || order?.shipping_address;
    if (!addr) return "Alamat belum tersedia";
    if (typeof addr === "object") {
      const recipient = addr.recipientName || addr.recipient_name;
      const phone = addr.recipientPhone || addr.recipient_phone;
      const street = addr.street || addr.address || "";
      const city = addr.city || "";
      const province = addr.province || "";
      const postal = addr.postalCode || addr.postal_code || "";
      return `${recipient ? `${recipient} (${phone || ""}) - ` : ""}${street}, ${city}, ${province} ${postal}`.trim();
    }
    return formatAddressDisplay ? formatAddressDisplay(addr) : String(addr);
  }, [shipping, order]);

  const orderDateText = useMemo(() => {
    const rawDate = order?.created_at || order?.createdAt;
    if (!rawDate) return "Hari ini";
    try {
      return new Date(rawDate).toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "Hari ini";
    }
  }, [order]);

  const orderTimeText = useMemo(() => {
    const rawDate = order?.created_at || order?.createdAt;
    if (!rawDate) return "Baru saja";
    try {
      return new Date(rawDate).toLocaleString("id-ID");
    } catch {
      return "Baru saja";
    }
  }, [order]);

  const effectiveResi = useMemo(() => {
    return (
      order?.waybill_id ||
      order?.shipping_receipt_number ||
      shipping?.tracking_number ||
      shipping?.trackingNumber ||
      shipping?.waybill_id ||
      shipping?.waybillId ||
      order?.waybillId ||
      order?.shippingReceiptNumber ||
      ""
    );
  }, [order, shipping]);

  const effectiveCourier = useMemo(() => {
    return (
      shipping?.courier_name ||
      shipping?.courierName ||
      order?.courier_name ||
      order?.courier ||
      "-"
    );
  }, [order, shipping]);

  const effectiveService = useMemo(() => {
    return (
      shipping?.service_type ||
      shipping?.serviceType ||
      order?.courier_service ||
      "-"
    );
  }, [order, shipping]);

  const effectiveTrackingLink = useMemo(() => {
    return (
      order?.courier_tracking_link ||
      shipping?.courier_tracking_link ||
      shipping?.tracking_link ||
      shipping?.trackingLink ||
      (effectiveResi ? `https://cekresi.com/?noresi=${effectiveResi}` : "")
    );
  }, [order, shipping, effectiveResi]);

  const handleCopyId = async () => {
    const idToCopy = order?.order_number || resolvedOrderId;
    if (!idToCopy) return;
    await navigator.clipboard.writeText(idToCopy);
    setCopied(true);
    toast.success("Nomor pesanan berhasil disalin!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyResi = async () => {
    if (!effectiveResi) return;
    await navigator.clipboard.writeText(effectiveResi);
    setCopiedResi(true);
    toast.success("Nomor resi berhasil disalin!");
    setTimeout(() => setCopiedResi(false), 2000);
  };

  const handleDownloadInvoice = async () => {
    if (!order) return;

    try {
      const toastId = toast.loading("Menyiapkan Invoice PDF...");
      // Dynamically import html2pdf to prevent SSR issues
      const html2pdf = (await import("html2pdf.js")).default;

      const invoiceElement = document.createElement("div");
      invoiceElement.innerHTML = `
        <div style="padding: 40px; font-family: 'Inter', sans-serif; color: #111;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #eaeaea; padding-bottom: 20px; margin-bottom: 20px;">
            <div style="display: flex; align-items: center;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 458.47 321.05" style="width: 45px; height: 45px; color: #000; margin-right: 15px;" fill="currentColor">
                <polygon points="256.99 0 0 321.05 64.03 321.05 321.03 0 256.99 0" />
                <polygon points="394.44 321.05 458.47 321.05 329.96 160.5 458.44 0 394.41 0 297.94 120.51 265.93 160.5 137.41 321.05 160.51 321.05 201.44 321.05 295.46 321.05 330.28 278.26 235.69 278.26 297.94 200.5 394.44 321.05" />
              </svg>
              <div>
                <h1 style="margin: 0; font-size: 24px; color: #000; letter-spacing: 2px;">MAKE ME KOOL</h1>
                <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">INVOICE TRANSAKSI</p>
              </div>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-weight: bold; color: #333;">Order ID: ${order.order_number || order.id}</p>
              <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Tanggal: ${new Date(order.created_at || order.createdAt || Date.now()).toLocaleDateString("id-ID")}</p>
            </div>
          </div>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
            <div>
              <p style="margin: 0; font-weight: bold; font-size: 14px; color: #888; text-transform: uppercase;">Ditagihkan Kepada</p>
              <p style="margin: 5px 0 0 0; font-weight: 600;">${order.customer_name || "Pelanggan"}</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #444;">${order.customer_phone || "-"}</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #444; max-width: 250px; line-height: 1.4;">${shippingAddressText}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-weight: bold; font-size: 14px; color: #888; text-transform: uppercase;">Informasi Pengiriman</p>
              <p style="margin: 5px 0 0 0; font-weight: 600;">${effectiveCourier} - ${effectiveService}</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #444;">Resi: ${effectiveResi || "Belum tersedia"}</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #444;">Status: ${getStatusInfo(order.status).label}</p>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
              <tr style="background-color: #f9f9f9; border-bottom: 1px solid #ddd;">
                <th style="padding: 12px; text-align: left; font-size: 13px; color: #666; text-transform: uppercase;">Produk</th>
                <th style="padding: 12px; text-align: center; font-size: 13px; color: #666; text-transform: uppercase;">Qty</th>
                <th style="padding: 12px; text-align: right; font-size: 13px; color: #666; text-transform: uppercase;">Harga Satuan</th>
                <th style="padding: 12px; text-align: right; font-size: 13px; color: #666; text-transform: uppercase;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item) => `
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 12px;">
                    <p style="margin: 0; font-weight: 600; font-size: 14px;">${item.name || item.product_name || "Produk MAMEKO"}</p>
                    <p style="margin: 3px 0 0 0; font-size: 12px; color: #888;">Varian: ${item.size || item.variant_name || "Standard"}</p>
                  </td>
                  <td style="padding: 12px; text-align: center; font-size: 14px;">${item.quantity || 1}</td>
                  <td style="padding: 12px; text-align: right; font-size: 14px;">Rp ${Number(item.price || 0).toLocaleString("id-ID")}</td>
                  <td style="padding: 12px; text-align: right; font-size: 14px; font-weight: 600;">Rp ${(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString("id-ID")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div style="display: flex; justify-content: flex-end;">
            <div style="width: 300px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                <span style="color: #666;">Subtotal Produk:</span>
                <span>Rp ${subtotalAmount.toLocaleString("id-ID")}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                <span style="color: #666;">Ongkos Kirim:</span>
                <span>Rp ${shippingCost.toLocaleString("id-ID")}</span>
              </div>
              ${discountAmount > 0 ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; color: #dc2626;">
                <span>Diskon Voucher:</span>
                <span>- Rp ${discountAmount.toLocaleString("id-ID")}</span>
              </div>
              ` : ""}
              <div style="display: flex; justify-content: space-between; padding-top: 15px; margin-top: 10px; border-top: 2px solid #eee; font-weight: bold; font-size: 18px;">
                <span>Total Pembayaran:</span>
                <span>Rp ${totalAmount.toLocaleString("id-ID")}</span>
              </div>
            </div>
          </div>

          <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #888; font-size: 12px;">
            <p style="margin: 0;">Terima kasih telah berbelanja di MAKE ME KOOL.</p>
            <p style="margin: 5px 0 0 0;">Jika ada pertanyaan mengenai pesanan Anda, silakan hubungi customer service kami.</p>
          </div>
        </div>
      `;

      const opt = {
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: `Invoice-MAMEKO-${order.order_number || resolvedOrderId}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" }
      };

      html2pdf().from(invoiceElement).set(opt).save().then(() => {
        toast.dismiss(toastId);
        toast.success("Invoice PDF berhasil diunduh.");
      }).catch((err) => {
        console.error(err);
        toast.dismiss(toastId);
        toast.error("Terjadi kesalahan saat membuat PDF.");
      });
    } catch (error) {
      console.error(error);
      toast.error("Gagal memuat modul PDF.");
    }
  };

  const handleTrackOrder = () => {
    const resi = shipping?.tracking_number;
    if (!resi) {
      toast.error("Nomor resi belum tersedia untuk pesanan ini.");
      return;
    }
    window.open(`https://jet.co.id/track?hal=1&track_id=${resi}`, "_blank", "noopener,noreferrer");
  };

  const syncPaymentStatus = async (result = {}) => {
    try {
      const { data: { session } } = await auth.getSession();
      const token = session?.access_token;

      await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/user/orders/${resolvedOrderId}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          transaction_status: result?.transaction_status,
          status_code: result?.status_code,
          order_id: result?.order_id,
        }),
      });
    } catch (err) {
      console.error("Gagal sinkronisasi status pembayaran:", err);
    } finally {
      window.location.reload();
    }
  };

  const handleContinuePayment = async () => {
    let snapToken = order?.snap_token;

    if (!snapToken) {
      try {
        toast.loading("Menghubungkan sistem pembayaran...", { id: "snap-token-loader" });
        const { data: { session } } = await auth.getSession();
        const token = session?.access_token;

        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/user/orders/${resolvedOrderId}/pay`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ userId: user?.id }),
        });

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error(`Server merespons error (Status ${res.status}).`);
        }

        const data = await res.json();
        toast.dismiss("snap-token-loader");

        if (!res.ok) {
          throw new Error(data.error || "Gagal menghasilkan token pembayaran.");
        }

        snapToken = data.snap_token;
        setOrder((prev) => ({ ...prev, snap_token: snapToken }));
      } catch (err) {
        toast.dismiss("snap-token-loader");
        toast.error(err.message || "Gagal memuat sistem pembayaran.");
        return;
      }
    }

    if (!snapToken) {
      toast.error("Token pembayaran tidak ditemukan. Silakan hubungi admin.");
      return;
    }

    if (typeof window.snap === "undefined") {
      toast.error("Modul pembayaran sedang dimuat, coba sesaat lagi.");
      return;
    }

    window.snap.pay(snapToken, {
      onSuccess: function (result: any) {
        toast.success("Pembayaran Berhasil!");
        syncPaymentStatus(result);
      },
      onPending: function (result: any) {
        toast("Menunggu pembayaran Anda diselesaikan.", { icon: "⏳" });
        syncPaymentStatus(result);
      },
      onClose: function () {
        toast("Popup pembayaran ditutup.", { icon: "ℹ️" });
      },
    });
  };

  const handleBackToOrders = () => {
    router.push("/dashboard?tab=orders");
  };

  const openReviewModal = (orderToReview, item: any) => {
    setReviewModalOrder(orderToReview);
    setReviewTargetItem(item);
    setRating(5);
    setComment("");
    setReviewPhotoFile(null);
    setReviewPhotoPreview(null);
  };

  const closeReviewModal = () => {
    if (reviewPhotoPreview) {
      URL.revokeObjectURL(reviewPhotoPreview);
    }
    setReviewModalOrder(null);
    setReviewTargetItem(null);
    setRating(5);
    setComment("");
    setReviewPhotoFile(null);
    setReviewPhotoPreview(null);
  };

  const handleReviewPhotoChange = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Format foto harus JPG, PNG, atau WebP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 5 MB.");
      return;
    }

    setReviewPhotoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setReviewPhotoPreview(previewUrl);
  };

  const handleRemoveReviewPhoto = () => {
    if (reviewPhotoPreview) {
      URL.revokeObjectURL(reviewPhotoPreview);
    }
    setReviewPhotoFile(null);
    setReviewPhotoPreview(null);
  };

  const handleReviewSubmit = async (e: any) => {
    e.preventDefault();
    if (!reviewModalOrder || !reviewTargetItem || !user || isSubmittingReview) {
      return;
    }

    setIsSubmittingReview(true);
    const toastId = toast.loading("Mengirim ulasan Anda...");

    try {
      const { data: { session } } = await auth.getSession();
      const token = session?.access_token;
      const userId = user.id || user.uid;

      let reviewPhoto = null;
      if (reviewPhotoFile) {
        toast.loading("Mengunggah foto ulasan...", { id: toastId });
        const uploadData = new FormData();
        uploadData.append("file", reviewPhotoFile);
        uploadData.append("userId", userId);
        uploadData.append("folder", "reviews");

        const uploadRes = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/cloudinary", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: uploadData,
        });
        const uploadResult = await uploadRes.json();
        if (!uploadRes.ok) {
          let errorMsg = uploadResult.error || "Gagal mengunggah foto ulasan.";
          if (errorMsg.toLowerCase().includes("cloudinary")) {
            errorMsg = "Gagal mengunggah foto. Silakan coba lagi nanti.";
          }
          throw new Error(errorMsg);
        }
        reviewPhoto = uploadResult.secure_url;
      }

      toast.loading("Menyimpan ulasan...", { id: toastId });
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          userId,
          orderId: reviewModalOrder.id,
          productId: reviewTargetItem.product_id || reviewTargetItem.productId || reviewTargetItem.id || reviewModalOrder.id,
          productName: reviewTargetItem.product_name || reviewTargetItem.name || reviewModalOrder.name,
          rating,
          comment,
          reviewPhoto,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Gagal mengirim ulasan.");
      }

      toast.success("Terima kasih! Ulasan Anda berhasil dikirim.", { id: toastId });

      const targetItemId = String(reviewTargetItem.product_id || reviewTargetItem.productId || reviewTargetItem.id || "");

      setOrder((prev) => {
        const updatedReviewedIds = [...(prev.reviewedItemIds || []), targetItemId];
        return {
          ...prev,
          reviewedItemIds: updatedReviewedIds,
          hasBeenReviewed: true,
        };
      });

      closeReviewModal();
    } catch (err) {
      console.error("Gagal mengirim ulasan:", err);
      toast.error(err.message, { id: toastId });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const isItemReviewed = (ord, item: any) => {
    const itemId = String(item.product_id || item.productId || item.id || "");
    if (ord.reviewedItemIds && ord.reviewedItemIds.length > 0) {
      return ord.reviewedItemIds.includes(itemId);
    }
    return ord.hasBeenReviewed;
  };

  const handleProofChange = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Format foto harus JPG, PNG, atau WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 5 MB.");
      return;
    }
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  };

  const handleRemoveProof = () => {
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofFile(null);
    setProofPreview(null);
  };

  const handleUploadProof = async () => {
    if (!proofFile || !user) return;
    setIsSubmittingProof(true);
    const toastId = toast.loading("Mengunggah bukti pembayaran...");

    try {
      const { data: { session } } = await auth.getSession();
      const token = session?.access_token;

      const uploadData = new FormData();
      uploadData.append("file", proofFile);
      uploadData.append("userId", user.id || user.uid);
      uploadData.append("folder", "payments");
      uploadData.append("publicIdName", `proof_${order.order_number || order.id}`);

      const existingProofUrl = order?.shipping_detail?.payment_proof_url || order?.shippingDetail?.payment_proof_url;
      if (existingProofUrl) {
        uploadData.append("oldUrl", existingProofUrl);
      }

      const uploadRes = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/cloudinary", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: uploadData,
      });
      const uploadResult = await uploadRes.json();
      if (!uploadRes.ok) {
        let errorMsg = uploadResult.error || "Gagal upload gambar.";
        if (errorMsg.toLowerCase().includes("cloudinary")) {
          errorMsg = "Gagal mengunggah foto. Silakan coba lagi nanti.";
        }
        throw new Error(errorMsg);
      }

      const proofUrl = uploadResult.secure_url;

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/user/orders/${order.id}/pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ receiptUrl: proofUrl, userId: user.id || user.uid }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal menyimpan bukti pembayaran.");

      toast.success("Bukti pembayaran berhasil diunggah!", { id: toastId });

      // Update local state to reflect changes
      setOrder(prev => ({
        ...prev,
        status: "verifying",
        shipping_detail: { ...(prev.shipping_detail || {}), payment_proof_url: proofUrl }
      }));

    } catch (err) {
      console.error(err);
      toast.error(err.message, { id: toastId });
    } finally {
      setIsSubmittingProof(false);
    }
  };

  const isPendingStatus = ["pending", "unpaid"].includes((order?.status || "").toLowerCase());

  const isManualPayment = useMemo(() => {
    const raw = (
      order?.payment_type ||
      order?.payment_method ||
      order?.paymentMethod ||
      order?.paymentType ||
      ""
    ).toLowerCase();
    return raw.includes("manual");
  }, [order]);

  // ── 24-Hour Countdown Timer for Pending Orders ──
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!isPendingStatus || !order?.created_at) return;

    const calculateTimeLeft = () => {
      const createdDate = new Date(order.created_at).getTime();
      const expireDate = createdDate + 24 * 60 * 60 * 1000;
      const difference = expireDate - Date.now();

      if (difference <= 0) {
        setTimeLeft({ expired: true, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({ expired: false, hours, minutes, seconds });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [isPendingStatus, order?.created_at]);

  if (loading) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.pageShell}>
          <div className={styles.loadingCard}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>Memuat rincian pesanan...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.pageShell}>
          <div className={styles.emptyCard}>
            <div className={styles.emptyIconWrap}>
              <AppIcon name="alert-triangle" size={36} />
            </div>
            <h3 className={styles.emptyTitle}>{error ? "Gagal Memuat Pesanan" : "Pesanan Tidak Ditemukan"}</h3>
            <p className={styles.emptySubtitle}>
              {error || "Detail pesanan yang Anda cari tidak tersedia, memiliki format ID yang tidak sesuai, atau sudah dihapus."}
            </p>
            <button onClick={handleBackToOrders} className={styles.primaryBtn}>
              <AppIcon name="arrow-left" size={16} />
              Kembali ke Daftar Pesanan
            </button>
          </div>
        </div>
      </div>
    );
  }

  let statusInfo = getStatusInfo(order.status);
  if (order.return_status) {
    const rs = order.return_status.toLowerCase();
    statusInfo = RETURN_STATUS_INFO[rs] || statusInfo;
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageShell}>
        {/* Top Header Card */}
        <div className={styles.heroCard}>
          <div className={styles.heroHeader}>
            <div className={styles.heroTitleGroup}>
              <button onClick={handleBackToOrders} className={styles.backBtnLink}>
                <AppIcon name="arrow-left" size={16} />
                <span>Daftar Pesanan</span>
              </button>
              <div className={styles.orderIdRow}>
                <h1 className={styles.orderNumberTitle}>{order.order_number || order.id}</h1>
                <button onClick={handleCopyId} className={styles.copyPillBtn} title="Salin Nomor Pesanan">
                  <AppIcon name={copied ? "check" : "copy"} size={13} />
                  <span>{copied ? "Tersalin" : "Salin"}</span>
                </button>
              </div>
              <p className={styles.customerMeta}>
                Pemesan: <strong>{order.customer_name || "Pelanggan MAMEKO"}</strong>
              </p>
            </div>

            <div className={styles.statusBadgeWrap}>
              <span className={`${styles.statusBadge} ${styles[statusInfo.badgeClass]}`}>
                <span className={styles.badgePulse} />
                <AppIcon name={statusInfo.icon} size={14} />
                {statusInfo.label}
              </span>
            </div>
          </div>

          <div className={styles.heroActions}>
            {isPendingStatus && !isManualPayment && (
              <button onClick={handleContinuePayment} className={styles.payBtn}>
                <AppIcon name="creditcard" size={16} />
                <span>Bayar Sekarang</span>
              </button>
            )}

            <button onClick={handleDownloadInvoice} className={styles.primaryBtn}>
              <AppIcon name="download" size={16} />
              <span>Unduh Invoice</span>
            </button>
          </div>
        </div>

        {/* ─── RETURN STATUS ADMIN NOTE BANNER ─── */}
        {order.return_status && order.return_admin_note && (
          <div style={{
            background: order.return_status === 'approved' ? 'rgba(16, 185, 129, 0.08)' : order.return_status === 'rejected' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
            borderLeft: `4px solid ${order.return_status === 'approved' ? '#10b981' : order.return_status === 'rejected' ? '#ef4444' : '#f59e0b'}`,
            borderRadius: "0 8px 8px 0",
            padding: "12px 16px",
            marginBottom: "1.5rem",
            color: "var(--text-primary)",
            fontSize: "0.9rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
          }}>
            <strong style={{ display: "block", marginBottom: "4px" }}>
              {order.return_status === 'approved' ? 'Catatan Retur (Disetujui):' : order.return_status === 'rejected' ? 'Catatan Retur (Ditolak):' : 'Catatan Retur (Pending):'}
            </strong>
            {order.return_admin_note}
          </div>
        )}

        {/* ─── 24-HOUR PAYMENT COUNTDOWN BANNER (PENDING) ─── */}
        {isPendingStatus && (
          <div style={{
            background: timeLeft?.expired ? "rgba(239, 68, 68, 0.08)" : "rgba(245, 158, 11, 0.08)",
            border: `1.5px solid ${timeLeft?.expired ? "#ef4444" : "#f59e0b"}`,
            borderRadius: "10px",
            padding: "14px 18px",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "1.6rem" }}>{timeLeft?.expired ? "⚠️" : "⏱️"}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: timeLeft?.expired ? "#ef4444" : "#d97706" }}>
                  {timeLeft?.expired ? "Batas Waktu Pembayaran Telah Habis" : "Batas Waktu Pembayaran: 24 Jam"}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                  {timeLeft?.expired
                    ? "Pesanan ini otomatis dibatalkan oleh sistem karena melebihi batas waktu 24 jam."
                    : "Selesaikan pembayaran sebelum batas waktu berakhir agar pesanan tidak dibatalkan otomatis."}
                </div>
              </div>
            </div>
            {!timeLeft?.expired && timeLeft && (
              <div style={{
                background: "var(--surface-primary)",
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
                fontWeight: 800,
                fontSize: "1.15rem",
                color: "var(--primary-accent)",
                letterSpacing: "1px",
                fontFamily: "monospace"
              }}>
                {String(timeLeft.hours).padStart(2, "0")}:{String(timeLeft.minutes).padStart(2, "0")}:{String(timeLeft.seconds).padStart(2, "0")}
              </div>
            )}
          </div>
        )}

        {/* ─── CANCELLATION NOTICE BANNER ─── */}
        {["cancelled", "canceled"].includes((order.status || "").toLowerCase()) && (
          <div style={{
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "10px",
            padding: "14px 18px",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "12px"
          }}>
            <span style={{ fontSize: "1.6rem" }}>❌</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--danger-color, #ef4444)" }}>
                {combinedHistory.find(h => String(h.label || "").toLowerCase().includes("batal"))?.label || "Pesanan Dibatalkan"}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                {combinedHistory.find(h => String(h.label || "").toLowerCase().includes("batal"))?.note || "Pesanan ini telah dibatalkan dan tidak dapat diproses lebih lanjut."}
              </div>
            </div>
          </div>
        )}

        {/* ─── 14-DAY AUTO COMPLETE NOTICE (SHIPPED) ─── */}
        {["shipped", "delivered"].includes((order.status || "").toLowerCase()) && (
          <div style={{
            background: "rgba(59, 130, 246, 0.08)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            borderRadius: "10px",
            padding: "14px 18px",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "12px"
          }}>
            <span style={{ fontSize: "1.6rem" }}>🚚</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#2563eb" }}>
                Pesanan Sedang Dikirim
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                Pesanan akan otomatis selesai dalam 14 hari sejak pengiriman jika Anda tidak melakukan konfirmasi penerimaan manual atau mengajukan pengembalian.
              </div>
            </div>
          </div>
        )}

        {/* ─── MANUAL TRANSFER INFO ─── */}
        {isManualPayment && (isPendingStatus || (order.status || "").toLowerCase() === "verifying") && (
          <div className={styles.panel} style={{ marginBottom: "1.5rem", border: "1px solid var(--primary-accent)", background: "rgba(var(--primary-accent-rgb), 0.03)" }}>
            <div className={styles.panelHeader}>
              <div className={styles.panelIconCircle} style={{ background: "var(--primary-accent)", color: "var(--primary-accent-text)" }}>
                <AppIcon name="banknote" size={18} />
              </div>
              <h2 className={styles.panelTitle}>Instruksi Transfer Manual</h2>
            </div>

            <div style={{ padding: "0 1.5rem 1.5rem" }}>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1rem" }}>
                Silakan transfer tepat sebesar <strong>Rp {totalAmount.toLocaleString("id-ID")}</strong> ke salah satu rekening berikut:
              </p>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
                {storeSettings?.contact?.bankAccounts && storeSettings.contact.bankAccounts.length > 0 ? (
                  storeSettings.contact.bankAccounts.map((account, idx: any) => (
                    <div key={idx} style={{ background: "var(--surface-primary)", border: "1px solid var(--border-color)", padding: "1rem", borderRadius: "8px", flex: 1, minWidth: "200px" }}>
                      <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{account.bankName}</div>
                      <div style={{ fontSize: "1.2rem", margin: "0.5rem 0", letterSpacing: "1px", display: "flex", alignItems: "center", gap: "10px" }}>
                        <span>{account.accountNumber}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(account.accountNumber);
                            toast.success("Nomor rekening berhasil disalin!");
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary-accent)", display: "flex", alignItems: "center", padding: "4px", borderRadius: "4px" }}
                          title="Salin Nomor Rekening"
                        >
                          <AppIcon name="copy" size={16} />
                        </button>
                      </div>
                      <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>a.n. {account.accountName}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem", fontStyle: "italic" }}>
                    (Belum ada rekening yang diatur. Silakan hubungi admin.)
                  </div>
                )}
              </div>

              {isPendingStatus ? (
                <div style={{ background: "var(--surface-primary)", padding: "1.2rem", borderRadius: "8px", border: "1px dashed var(--border-color)" }}>
                  <h4 style={{ marginBottom: "0.5rem", fontSize: "0.95rem" }}>Upload Bukti Pembayaran</h4>
                  {proofPreview ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "1rem" }}>
                      <img src={proofPreview} alt="Bukti Transfer" style={{ maxWidth: "200px", borderRadius: "8px", border: "1px solid var(--border-color)" }} />
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button onClick={handleRemoveProof} className={styles.secondaryBtn} disabled={isSubmittingProof}>Ganti Foto</button>
                        <button onClick={handleUploadProof} className={styles.primaryBtn} disabled={isSubmittingProof}>
                          {isSubmittingProof ? "Mengunggah..." : "Kirim Bukti Pembayaran"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label style={{ display: "inline-block", cursor: "pointer", background: "rgba(var(--primary-accent-rgb), 0.08)", color: "var(--primary-accent)", padding: "10px 16px", borderRadius: "6px", fontWeight: 600, fontSize: "0.9rem" }}>
                      Pilih Foto Struk / Screenshot
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleProofChange} style={{ display: "none" }} />
                    </label>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem", background: "var(--surface-primary)", padding: "1.2rem", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)" }}>
                    <AppIcon name="check-circle" size={16} style={{ color: "var(--success-color)" }} />
                    <span>Bukti pembayaran sudah diunggah dan sedang diverifikasi admin.</span>
                  </div>

                  {/* ── TOMBOL WHATSAPP (HYBRID NOTIF) ── */}
                  {(() => {
                    let waNumber = storeSettings?.contact?.whatsappNumber?.replace(/\D/g, "") || "6281234567890";
                    if (waNumber.startsWith("0")) waNumber = "62" + waNumber.slice(1);
                    return (
                      <a
                        href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Halo Admin, saya sudah mentransfer dan meng-upload bukti pembayaran untuk pesanan ${order.order_number || order.id}. Tolong diverifikasi ya!`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#25D366", color: "#fff", padding: "10px 16px", borderRadius: "6px", fontWeight: 600, fontSize: "0.9rem", textDecoration: "none", width: "fit-content" }}
                      >
                        <AppIcon name="message-circle" size={18} />
                        Kabari Admin via WhatsApp
                      </a>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Grid: Ringkasan & Pengiriman */}
        <div className={styles.grid}>
          {/* Ringkasan Pembayaran */}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelIconCircle}>
                <AppIcon name="receipt" size={18} />
              </div>
              <h2 className={styles.panelTitle}>Ringkasan Transaksi</h2>
            </div>

            <div className={styles.summaryList}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Tanggal Pemesanan</span>
                <span className={styles.summaryValue}>
                  {orderDateText}
                </span>
              </div>

              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Metode Pembayaran</span>
                <span className={styles.summaryValueHighlight}>{order.payment_type || "Midtrans Payment"}</span>
              </div>

              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Subtotal Item ({items.length} produk)</span>
                <span className={styles.summaryValue}>Rp {subtotalAmount.toLocaleString("id-ID")}</span>
              </div>

              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Biaya Pengiriman</span>
                <span className={styles.summaryValue}>Rp {shippingCost.toLocaleString("id-ID")}</span>
              </div>

              {discountAmount > 0 && (
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>Diskon Voucher</span>
                  <span className={styles.summaryDiscount}>- Rp {discountAmount.toLocaleString("id-ID")}</span>
                </div>
              )}

              <div className={styles.totalRow}>
                <span className={styles.totalLabel}>Total Pembayaran</span>
                <span className={styles.totalValue}>Rp {totalAmount.toLocaleString("id-ID")}</span>
              </div>
            </div>
          </section>

          {/* Informasi Pengiriman */}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelIconCircle}>
                <AppIcon name="truck" size={18} />
              </div>
              <h2 className={styles.panelTitle}>Informasi Pengiriman</h2>
            </div>

            <div className={styles.infoCardStack}>
              <div className={styles.infoBlock}>
                <p className={styles.infoLabel}>Kurir & Layanan</p>
                <div className={styles.courierInfo}>
                  <strong>{effectiveCourier}</strong>
                  <span className={styles.courierServiceTag}>
                    {effectiveService} {shipping?.etd ? `(${shipping.etd} hari)` : ""}
                  </span>
                </div>
              </div>

              <div className={styles.infoBlock}>
                <p className={styles.infoLabel}>Nomor Resi Pengiriman</p>
                {effectiveResi ? (
                  <div className={styles.resiRow}>
                    <strong className={styles.resiCode}>{effectiveResi}</strong>
                    <button onClick={handleCopyResi} className={styles.copyMiniBtn}>
                      <AppIcon name={copiedResi ? "check" : "copy"} size={12} />
                      <span>{copiedResi ? "Disalin" : "Salin Resi"}</span>
                    </button>
                  </div>
                ) : (
                  <span className={styles.textMuted}>Resi akan diperbarui setelah kurir menjemput paket.</span>
                )}
              </div>

              <div className={styles.infoBlock}>
                <p className={styles.infoLabel}>Alamat Tujuan</p>
                <p className={styles.addressText}>{shippingAddressText}</p>
              </div>

              {effectiveResi && (
                <button onClick={() => {
                  let linkToOpen = effectiveTrackingLink;
                  if (!linkToOpen || linkToOpen.includes('biteship.com/track/')) {
                    linkToOpen = `https://cekresi.com/?noresi=${effectiveResi}`;
                  }
                  window.open(linkToOpen, '_blank');
                }} className={styles.trackBtn}>
                  <AppIcon name="external-link" size={15} />
                  <span>Lacak Paket Pengiriman</span>
                </button>
              )}
            </div>
          </section>
        </div>

        {/* Grid: Rincian Item & Status Timeline */}
        <div className={styles.grid}>
          {/* Item yang Dibeli */}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelIconCircle}>
                <AppIcon name="shopping-bag" size={18} />
              </div>
              <h2 className={styles.panelTitle}>Item Pesanan ({items.length})</h2>
            </div>

            <div className={styles.itemList}>
              {items.length > 0 ? (
                items.map((item, index) => {
                  const itemPrice = Number(item.price || item.subtotal || 0);
                  const itemQty = Number(item.quantity || item.qty || 1);
                  const itemTotal = itemPrice * itemQty;

                  return (
                    <div key={item.id || index} className={styles.itemRow}>
                      <div className={styles.itemIconBadge}>
                        <AppIcon name="package" size={20} />
                      </div>

                      <div className={styles.itemInfo}>
                        <h4 className={styles.itemName}>{item.name || item.product_name || "Parfum MAMEKO"}</h4>
                        <div className={styles.itemVariantBadge}>
                          <span>Varian: {item.size || item.variant_name || item.variant || "Standard"}</span>
                        </div>
                        <p className={styles.itemUnitPrice}>
                          Rp {itemPrice.toLocaleString("id-ID")} <span className={styles.itemQtyMultiplier}>× {itemQty}</span>
                        </p>
                      </div>

                      <div className={styles.itemPriceCol}>
                        <strong className={styles.itemTotalPrice}>Rp {itemTotal.toLocaleString("id-ID")}</strong>

                        {["delivered", "completed"].includes((order.status || "").toLowerCase()) && (
                          <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "flex-end" }}>
                            <button
                              onClick={() => !isItemReviewed(order, item) && openReviewModal(order, item)}
                              disabled={isItemReviewed(order, item)}
                              className={isItemReviewed(order, item) ? styles.reviewBtnDisabled : styles.reviewBtn}
                            >
                              <AppIcon name={isItemReviewed(order, item) ? "check-circle" : "star"} size={14} />
                              {isItemReviewed(order, item) ? `Diulas` : `Ulas Produk`}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className={styles.emptyItemsBox}>
                  <p className={styles.textMuted}>Tidak ada rincian item tambahan.</p>
                  <strong>Total: Rp {totalAmount.toLocaleString("id-ID")}</strong>
                </div>
              )}
            </div>
          </section>

          {/* Riwayat Status Pesanan */}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelIconCircle}>
                <AppIcon name="clock-3" size={18} />
              </div>
              <h2 className={styles.panelTitle}>Riwayat Status</h2>
            </div>
            <div className={styles.timeline}>
              {combinedHistory.length > 0 ? (
                combinedHistory.map((item) => (
                  <div key={item.key} className={styles.timelineItem}>
                    <div className={styles.timelineMarker}>
                      <span 
                        className={styles.timelineDot} 
                        style={item.isWebhook ? { background: '#3b82f6', borderColor: '#bfdbfe' } : undefined} 
                      />
                    </div>
                    <div className={styles.timelineContent}>
                      <div className={styles.timelineTitleRow}>
                        <h4 className={styles.timelineStatusTitle} style={item.isWebhook ? { textTransform: "capitalize" } : undefined}>
                          {item.label}
                        </h4>
                        <span className={styles.timelineTime}>{item.timestampStr}</span>
                      </div>
                      <p className={styles.timelineNote}>{item.note}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.timelineItem}>
                  <div className={styles.timelineMarker}>
                    <span className={styles.timelineDot} />
                  </div>
                  <div className={styles.timelineContent}>
                    <h4 className={styles.timelineStatusTitle}>{statusInfo.label}</h4>
                    <p className={styles.timelineNote}>Pesanan tercatat di dalam sistem MAMEKO.</p>
                    <span className={styles.timelineTime}>{orderTimeText}</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* --- MODAL ULASAN PRODUK DENGAN UPLOAD GAMBAR CLOUDINARY --- */}
        {reviewModalOrder && reviewTargetItem && (
          <div
            className={styles.modalOverlay}
            onClick={closeReviewModal}
          >
            <div
              className={styles.modalContent}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  {ordersConfig.labels.reviewTitle}
                </h3>
                <button
                  onClick={closeReviewModal}
                  className={styles.modalCloseBtn}
                  type="button"
                >
                  <AppIcon name="x" size={18} strokeWidth={2} />
                </button>
              </div>

              <form onSubmit={handleReviewSubmit} className={styles.modalBody}>
                <div className={styles.modalProductCard}>
                  <div className={styles.modalProductIconWrap}>
                    <AppIcon name="package" size={20} />
                  </div>
                  <div>
                    <span className={styles.modalFieldLabel}>
                      {ordersConfig.labels.product}
                    </span>
                    <strong className={styles.modalProductName}>{reviewTargetItem.product_name || reviewTargetItem.name || reviewModalOrder.name}</strong>
                  </div>
                </div>

                <div>
                  <label className={styles.modalFieldLabel}>
                    {ordersConfig.labels.ratingLabel}
                  </label>
                  <div className={styles.starRatingGroup}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`${styles.starBtn} ${rating >= star ? styles.starBtnActive : ""}`}
                        title={`${star} Bintang`}
                      >
                        <AppIcon name="star" size={24} strokeWidth={rating >= star ? 2.5 : 1.5} />
                      </button>
                    ))}
                    <span className={styles.ratingTextLabel}>
                      {ordersConfig.ratingOptions.find((o) => o.value === rating)?.label || `${rating} / 5`}
                    </span>
                  </div>
                </div>

                <div>
                  <label className={styles.modalFieldLabel}>
                    {ordersConfig.labels.commentLabel}
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder={ordersConfig.labels.commentPlaceholder}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className={styles.formTextarea}
                  />
                </div>

                <div>
                  <label className={styles.modalFieldLabel}>
                    {ordersConfig.labels.uploadPhoto}
                  </label>

                  {reviewPhotoPreview ? (
                    <div className={styles.photoPreviewWrapper}>
                      <div className={styles.photoPreviewThumb}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={reviewPhotoPreview}
                          alt="Preview foto ulasan"
                          className={styles.previewImg}
                        />
                      </div>
                      <div className={styles.photoPreviewMeta}>
                        <span className={styles.photoFileName}>{reviewPhotoFile?.name || "foto-ulasan.jpg"}</span>
                        <span className={styles.photoFileSize}>
                          {reviewPhotoFile ? `${(reviewPhotoFile.size / 1024).toFixed(1)} KB` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={handleRemoveReviewPhoto}
                          className={styles.removePhotoBtn}
                        >
                          <AppIcon name="trash" size={13} />
                          <span>Hapus Foto</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className={styles.photoUploadDropzone}>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleReviewPhotoChange}
                        className={styles.fileInputHidden}
                      />
                      <div className={styles.dropzoneIconCircle}>
                        <AppIcon name="camera" size={22} />
                      </div>
                      <div className={styles.dropzoneTextGroup}>
                        <span className={styles.dropzoneMainText}>
                          Pilih foto produk atau seret ke sini
                        </span>
                        <span className={styles.dropzoneSubText}>
                          Format JPG, PNG, WebP (Maksimal 5 MB)
                        </span>
                      </div>
                    </label>
                  )}
                </div>

                <div className={styles.modalActionGroup}>
                  <button
                    type="button"
                    onClick={closeReviewModal}
                    className={styles.modalCancelActionBtn}
                    disabled={isSubmittingReview}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className={styles.modalCloseActionBtn}
                    disabled={isSubmittingReview}
                  >
                    {isSubmittingReview ? (
                      <>
                        <span className={styles.btnSpinner} />
                        <span>{ordersConfig.labels.submittingReview}</span>
                      </>
                    ) : (
                      <>
                        <AppIcon name="send" size={15} />
                        <span>{ordersConfig.labels.submitReview}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}