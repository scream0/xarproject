"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams, useParams } from "next/navigation";
import { auth } from "@/lib/supabaseClient";
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

function getStatusInfo(rawStatus) {
  const key = (rawStatus || "pending").toLowerCase();
  return STATUS_INFO[key] || { label: (rawStatus || "PENDING").toUpperCase(), badgeClass: "statusProcessing", icon: "package" };
}

function resolveHistoryEvent(event, index) {
  const statusValue = event?.status_to || event?.status || event?.statusTo || "pending";
  const info = getStatusInfo(statusValue);
  const changedAt = event?.created_at || event?.createdAt || event?.timestamp || event?.updated_at;

  return {
    key: `${event?.id || index}-${index}`,
    label: info.label,
    icon: info.icon,
    note: event?.notes || "Pembaruan status pesanan.",
    timestamp: changedAt ? new Date(changedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "Baru saja",
  };
}

export default function OrderDetailPage({ orderId: propOrderId }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeParams = useParams();

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
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copiedResi, setCopiedResi] = useState(false);

  // Review Modal States
  const [reviewModalOrder, setReviewModalOrder] = useState(null);
  const [reviewTargetItem, setReviewTargetItem] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewPhotoFile, setReviewPhotoFile] = useState(null);
  const [reviewPhotoPreview, setReviewPhotoPreview] = useState(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Load Midtrans Snap Script
  useEffect(() => {
    const snapScriptUrl = process.env.NODE_ENV === "production"
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;

    if (!document.getElementById("midtrans-snap-script")) {
      const script = document.createElement("script");
      script.id = "midtrans-snap-script";
      script.src = snapScriptUrl;
      script.setAttribute("data-client-key", clientKey || "");
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    let subscription = null;

    const initAuth = async () => {
      const { data: { session } } = await auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      setUser(session.user);

      const { data: authListener } = auth.onAuthStateChange((_event, session) => {
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

        const res = await fetch(`/api/user/orders/${resolvedOrderId}?userId=${user.id || user.uid}`, {
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

        if (Object.keys(detailOrder).length === 0) {
          throw new Error("Detail pesanan yang Anda cari tidak tersedia atau sudah dihapus.");
        }

        setOrder(detailOrder);
        setItems(detailItems);
        setShipping(detailShipping);
        setHistory(detailHistory);
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

  const totalAmount = useMemo(() => {
    const raw = Number(order?.total_amount || order?.amount || order?.rawPrice || 0);
    return Number.isFinite(raw) ? raw : 0;
  }, [order]);

  const shippingCost = useMemo(() => {
    const raw = Number(order?.shipping_cost || order?.shippingCost || 0);
    return Number.isFinite(raw) ? raw : 0;
  }, [order]);

  const discountAmount = useMemo(() => {
    const raw = Number(order?.discount_amount || order?.discountAmount || 0);
    return Number.isFinite(raw) ? raw : 0;
  }, [order]);

  const subtotalAmount = useMemo(() => {
    if (items && items.length > 0) {
      return items.reduce((acc, item) => acc + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
    }
    return Math.max(0, totalAmount - shippingCost + discountAmount);
  }, [items, totalAmount, shippingCost, discountAmount]);

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

  const handleCopyId = async () => {
    const idToCopy = order?.order_number || resolvedOrderId;
    if (!idToCopy) return;
    await navigator.clipboard.writeText(idToCopy);
    setCopied(true);
    toast.success("Nomor pesanan berhasil disalin!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyResi = async () => {
    const resi = shipping?.tracking_number;
    if (!resi) return;
    await navigator.clipboard.writeText(resi);
    setCopiedResi(true);
    toast.success("Nomor resi berhasil disalin!");
    setTimeout(() => setCopiedResi(false), 2000);
  };

  const handleDownloadInvoice = () => {
    if (!order) return;

    const invoiceContent = `=====================================================
               INVOICE TRANSAKSI XAR
=====================================================
ID Transaksi     : ${order.id}
Nomor Pesanan    : ${order.order_number || order.id}
Tanggal Pesanan  : ${new Date(order.created_at || order.createdAt || Date.now()).toLocaleString("id-ID")}
Status Transaksi : ${getStatusInfo(order.status).label}
Metode Bayar     : ${order.payment_type || "Online Payment"}
-----------------------------------------------------
RINCIAN PRODUK:
${items.map((item, i) => `${i + 1}. ${item.name || item.product_name || "Produk XAR"} (${item.size || item.variant_name || "Standard"})
   Qty: ${item.quantity || 1} x Rp ${Number(item.price || 0).toLocaleString("id-ID")} = Rp ${(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString("id-ID")}`).join("\n")}
-----------------------------------------------------
RINCIAN BIAYA:
Subtotal Produk  : Rp ${subtotalAmount.toLocaleString("id-ID")}
Ongkos Kirim     : Rp ${shippingCost.toLocaleString("id-ID")}
Diskon Voucher   : - Rp ${discountAmount.toLocaleString("id-ID")}
-----------------------------------------------------
TOTAL DIBAYAR    : Rp ${totalAmount.toLocaleString("id-ID")}
-----------------------------------------------------
INFORMASI PENGIRIMAN:
Penerima         : ${order.customer_name || "Pelanggan XAR"} (${order.customer_phone || "-"})
Kurir & Layanan  : ${shipping?.courier_name || "-"} - ${shipping?.service_type || "-"}
Nomor Resi       : ${shipping?.tracking_number || "Belum tersedia"}
Alamat Tujuan    : ${shippingAddressText}
=====================================================
Terima kasih telah berbelanja di XAR Perfumery.`;

    const blob = new Blob([invoiceContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Invoice-${order.order_number || resolvedOrderId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Invoice transaksi berhasil diunduh.");
  };

  const handleTrackOrder = () => {
    const resi = shipping?.tracking_number;
    if (!resi) {
      toast.error("Nomor resi belum tersedia untuk pesanan ini.");
      return;
    }
    window.open(`https://jet.co.id/track?hal=1&track_id=${resi}`, "_blank", "noopener,noreferrer");
  };

  const syncPaymentStatus = async (result) => {
    try {
      const { data: { session } } = await auth.getSession();
      const token = session?.access_token;

      await fetch(`/api/user/orders/${resolvedOrderId}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          transaction_status: result.transaction_status,
          status_code: result.status_code,
          order_id: result.order_id,
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

        const res = await fetch(`/api/user/orders/${resolvedOrderId}/pay`, {
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
      onSuccess: function (result) {
        toast.success("Pembayaran Berhasil!");
        syncPaymentStatus(result);
      },
      onPending: function (result) {
        toast("Menunggu pembayaran Anda diselesaikan.", { icon: "⏳" });
        syncPaymentStatus(result);
      },
      onClose: function () {
        toast("Popup pembayaran ditutup.", { icon: "ℹ️" });
      },
    });
  };

  const handleBackToOrders = () => {
    if (pathname?.startsWith("/account/orders")) {
      router.push("/account/orders");
    } else {
      router.push("/dashboard?tab=orders");
    }
  };

  const openReviewModal = (orderToReview, item) => {
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

  const handleReviewPhotoChange = (e) => {
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

  const handleReviewSubmit = async (e) => {
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
        toast.loading("Mengunggah foto produk ke Cloudinary...", { id: toastId });
        const uploadData = new FormData();
        uploadData.append("file", reviewPhotoFile);
        uploadData.append("userId", userId);
        uploadData.append("folder", "reviews");
        
        const uploadRes = await fetch("/api/cloudinary", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: uploadData,
        });
        const uploadResult = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadResult.error || "Gagal mengunggah foto ulasan.");
        }
        reviewPhoto = uploadResult.secure_url;
      }

      toast.loading("Menyimpan ulasan...", { id: toastId });
      const res = await fetch("/api/reviews", {
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

  const isItemReviewed = (ord, item) => {
    const itemId = String(item.product_id || item.productId || item.id || "");
    if (ord.reviewedItemIds && ord.reviewedItemIds.length > 0) {
      return ord.reviewedItemIds.includes(itemId);
    }
    return ord.hasBeenReviewed;
  };

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

  const statusInfo = getStatusInfo(order.status);
  const isPendingStatus = ["pending", "unpaid"].includes((order.status || "").toLowerCase());

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
              Pemesan: <strong>{order.customer_name || "Pelanggan XAR"}</strong>
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
          {isPendingStatus && (
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
                <strong>{shipping?.courier_name || order.courier_name || "-"}</strong>
                <span className={styles.courierServiceTag}>
                  {shipping?.service_type || order.courier_service || "-"} {shipping?.etd ? `(${shipping.etd} hari)` : ""}
                </span>
              </div>
            </div>

            <div className={styles.infoBlock}>
              <p className={styles.infoLabel}>Nomor Resi Pengiriman</p>
              {shipping?.tracking_number ? (
                <div className={styles.resiRow}>
                  <strong className={styles.resiCode}>{shipping.tracking_number}</strong>
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

            {shipping?.tracking_number && (
              <button onClick={handleTrackOrder} className={styles.trackBtn}>
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
                      <h4 className={styles.itemName}>{item.name || item.product_name || "Parfum XAR"}</h4>
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
            {history.length > 0 ? (
              history.slice().reverse().map((event, index) => {
                const resolved = resolveHistoryEvent(event, index);
                return (
                  <div key={resolved.key} className={styles.timelineItem}>
                    <div className={styles.timelineMarker}>
                      <span className={styles.timelineDot} />
                    </div>
                    <div className={styles.timelineContent}>
                      <div className={styles.timelineTitleRow}>
                        <h4 className={styles.timelineStatusTitle}>{resolved.label}</h4>
                        <span className={styles.timelineTime}>{resolved.timestamp}</span>
                      </div>
                      <p className={styles.timelineNote}>{resolved.note}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={styles.timelineItem}>
                <div className={styles.timelineMarker}>
                  <span className={styles.timelineDot} />
                </div>
                <div className={styles.timelineContent}>
                  <h4 className={styles.timelineStatusTitle}>{statusInfo.label}</h4>
                  <p className={styles.timelineNote}>Pesanan tercatat di dalam sistem XAR.</p>
                  <span className={styles.timelineTime}>
                    {orderTimeText}
                  </span>
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