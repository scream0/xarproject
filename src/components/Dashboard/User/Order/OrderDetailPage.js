"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { auth } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { formatAddressDisplay } from "@/utils/address";
import styles from "./OrderDetailPage.module.css";
import { AppIcon } from "@/components/UI/Icon/AppIcon";

const STATUS_INFO = {
  pending: { label: "Menunggu Pembayaran", badgeClass: "statusProcessing" },
  success: { label: "Pembayaran Diterima", badgeClass: "statusProcessing" },
  paid: { label: "Pembayaran Diterima", badgeClass: "statusProcessing" },
  processing: { label: "Sedang Diracik", badgeClass: "statusProcessing" },
  shipping: { label: "Dalam Pengiriman", badgeClass: "statusProcessing" },
  shipped: { label: "Dalam Pengiriman", badgeClass: "statusProcessing" },
  delivered: { label: "Pesanan Selesai", badgeClass: "statusCompleted" },
  completed: { label: "Pesanan Selesai", badgeClass: "statusCompleted" },
  cancelled: { label: "Dibatalkan", badgeClass: "statusCancelled" },
  settlement: { label: "Pembayaran Diterima", badgeClass: "statusProcessing" },
  capture: { label: "Pembayaran Diterima", badgeClass: "statusProcessing" },
};

function getStatusInfo(rawStatus) {
  const key = (rawStatus || "pending").toLowerCase();
  return STATUS_INFO[key] || { label: (rawStatus || "PENDING").toUpperCase(), badgeClass: "statusProcessing" };
}

function resolveHistoryEvent(event, index) {
  const statusValue = event?.status_to || event?.status || event?.statusTo || "pending";
  const label = getStatusInfo(statusValue).label;
  const changedAt = event?.created_at || event?.createdAt || event?.timestamp || event?.updated_at;

  return {
    key: `${event?.id || index}-${index}`,
    label,
    note: event?.notes || "Update status pesanan Anda.",
    timestamp: changedAt ? new Date(changedAt).toLocaleString("id-ID") : "Baru saja",
  };
}

export default function OrderDetailPage({ orderId: propOrderId }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Fleksibel menangkap orderId dari: prop, query ?order_id=..., ?id=..., atau segment path terakhir
  const resolvedOrderId = useMemo(() => {
    if (propOrderId) return propOrderId;
    const qOrderId = searchParams.get("order_id") || searchParams.get("id");
    if (qOrderId) return qOrderId;
    
    const segments = pathname.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && lastSegment.startsWith("XAR-")) {
      return lastSegment;
    }
    return null;
  }, [propOrderId, searchParams, pathname]);

  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [shipping, setShipping] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  // Load Midtrans Snap Script untuk fitur "Bayar Sekarang"
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
        const result = await res.json();

        if (!res.ok) {
          throw new Error(result.error || "Gagal memuat detail pesanan.");
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
    const raw = Number(order?.amount || order?.total_amount || order?.rawPrice || 0);
    return Number.isFinite(raw) ? raw : 0;
  }, [order]);

  const shippingAddress = useMemo(() => {
    if (!shipping?.shipping_address) return "Alamat belum tersedia";
    return formatAddressDisplay(shipping.shipping_address);
  }, [shipping]);

  const handleCopyId = async () => {
    if (!resolvedOrderId) return;
    await navigator.clipboard.writeText(resolvedOrderId);
    toast.success("ID pesanan berhasil disalin.");
  };

  const handleDownloadInvoice = () => {
    if (!order) return;

    const invoiceContent = `=====================================
INVOICE TRANSAKSI XAR
=====================================
ID Transaksi     : ${order.id}
Nomor Pesanan    : ${order.order_number || "-"}
Tanggal          : ${new Date(order.createdAt || order.created_at || "1970-01-01").toLocaleString("id-ID")}
Status           : ${getStatusInfo(order.status).label}
-------------------------------------
DETAIL PRODUK
${items.map((item) => `- ${item.name || order.product_name || "Produk"} | Qty: ${item.quantity || item.qty || 1} | Harga: Rp ${Number(item.price || 0).toLocaleString("id-ID")}`).join("\n")}
-------------------------------------
PENGIRIMAN
Kurir           : ${shipping?.courier_name || "-"}
Layanan         : ${shipping?.service_type || "-"}
Tracking        : ${shipping?.tracking_number || "-"}
Alamat          : ${shippingAddress}
-------------------------------------
TOTAL           : Rp ${totalAmount.toLocaleString("id-ID")}
=====================================`;

    const blob = new Blob([invoiceContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Invoice-${resolvedOrderId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Invoice berhasil diunduh.");
  };

  const handleTrackOrder = () => {
    if (!shipping?.tracking_number) return;
    window.open(`https://jet.co.id/track?hal=1&track_id=${shipping.tracking_number}`, "_blank", "noopener,noreferrer");
  };

  // Sinkronisasi status pembayaran dengan database setelah aksi Midtrans
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

  // Fungsi melanjutkan pembayaran via Midtrans Snap (Dilengkapi pembuatan token dinamis jika belum ada)
 const handleContinuePayment = async () => {
    let snapToken = order?.snap_token;

    if (!snapToken) {
      try {
        toast.loading("Membuat token pembayaran...", { id: "snap-token-loader" });
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

        // Cek apakah server mengembalikan JSON atau HTML error
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const rawText = await res.text();
          throw new Error(`Server merespons error (Status ${res.status}). Pastikan file API sudah dibuat.`);
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
      toast.error("Modul pembayaran sedang dimuat, coba sebentar lagi.");
      return;
    }

    window.snap.pay(snapToken, {
      onSuccess: function (result) {
        toast.success("Pembayaran Berhasil!");
        syncPaymentStatus(result);
      },
      onPending: function (result) {
        toast("Menunggu pembayaran Anda", { icon: "⏳" });
        syncPaymentStatus(result);
      },
      onClose: function () {
        toast("Popup pembayaran ditutup.", { icon: "ℹ️" });
      },
    });
  };

  if (loading) {
    return (
      <div className={styles.pageShell}>
        <div className={`card ${styles.loadingCard}`}>
          <AppIcon name="package" size={30} />
          <p>Memuat detail pesanan Anda...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className={styles.pageShell}>
        <div className={`card ${styles.emptyCard}`}>
          <h3>{error ? "Terjadi Kesalahan" : "Pesanan tidak ditemukan"}</h3>
          <p>{error || "Detail pesanan yang Anda cari tidak tersedia atau sudah dihapus."}</p>
          <button onClick={() => router.push(pathname?.startsWith("/account/orders") ? "/account/orders" : "/dashboard")} className={styles.primaryBtn}>
            Kembali ke Daftar Pesanan
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(order.status);
  const isPendingStatus = ["pending", "unpaid"].includes((order.status || "").toLowerCase());

  return (
    <div className={styles.pageShell}>
      <div className={`card ${styles.heroCard}`}>
        <div className={styles.heroHeader}>
          <div>
            <p className={styles.eyebrow}>Detail Pesanan</p>
            <h2 className={styles.pageTitle}>{order.order_number || order.id}</h2>
            <p className={styles.pageSubtitle}>{order.product_name || order.name || "Pesanan XAR"}</p>
          </div>
          <span className={`${styles.statusBadge} ${styles[statusInfo.badgeClass]}`}>{statusInfo.label}</span>
        </div>

        <div className={styles.heroActions}>
          <button
            onClick={() => router.push(pathname?.startsWith("/account/orders") ? "/account/orders" : "/dashboard")}
            className={styles.secondaryBtn}
          >
            Kembali
          </button>
          
          {isPendingStatus && (
            <button
              onClick={handleContinuePayment}
              className={`${styles.primaryBtn} ${styles.payBtn}`}
            >
              Bayar Sekarang
            </button>
          )}

          <button onClick={handleCopyId} className={styles.secondaryBtn}>Salin ID</button>
          <button onClick={handleDownloadInvoice} className={styles.primaryBtn}>Unduh Invoice</button>
        </div>
      </div>

      <div className={styles.grid}>
        <section className={`card ${styles.panel}`}>
          <h3 className={styles.panelTitle}>Ringkasan Pesanan</h3>
          <div className={styles.summaryGrid}>
            <div>
              <p className={styles.label}>Tanggal</p>
              <strong>{new Date(order.createdAt || order.created_at || "1970-01-01").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</strong>
            </div>
            <div>
              <p className={styles.label}>Metode Pembayaran</p>
              <strong>{order.payment_type || order.paymentType || "Midtrans"}</strong>
            </div>
            <div>
              <p className={styles.label}>Total Bayar</p>
              <strong>Rp {totalAmount.toLocaleString("id-ID")}</strong>
            </div>
          </div>
        </section>

        <section className={`card ${styles.panel}`}>
          <h3 className={styles.panelTitle}>Informasi Pengiriman</h3>
          <div className={styles.infoStack}>
            <div>
              <p className={styles.label}>Kurir</p>
              <strong>{shipping?.courier_name || "-"}</strong>
            </div>
            <div>
              <p className={styles.label}>Layanan</p>
              <strong>{shipping?.service_type || "-"}</strong>
            </div>
            <div>
              <p className={styles.label}>Nomor Resi</p>
              <strong>{shipping?.tracking_number || "Belum tersedia"}</strong>
            </div>
            <div>
              <p className={styles.label}>Alamat</p>
              <strong>{shippingAddress}</strong>
            </div>
          </div>
          {shipping?.tracking_number && (
            <button onClick={handleTrackOrder} className={styles.trackBtn}>Lacak Pengiriman</button>
          )}
        </section>
      </div>

      <div className={styles.grid}>
        <section className={`card ${styles.panel}`}>
          <h3 className={styles.panelTitle}>Item yang Dibeli</h3>
          <div className={styles.itemList}>
            {items.length > 0 ? items.map((item, index) => (
              <div key={item.id || `${item.productId || index}-${index}`} className={styles.itemRow}>
                <div>
                  <strong>{item.name || order.product_name || "Produk"}</strong>
                  <p>{item.size || "Standard"}</p>
                </div>
                <div className={styles.itemMeta}>
                  <span>x{item.quantity || item.qty || 1}</span>
                  <strong>Rp {Number(item.subtotal || item.price || 0).toLocaleString("id-ID")}</strong>
                </div>
              </div>
            )) : <p>Belum ada data item pesanan.</p>}
          </div>
        </section>

        <section className={`card ${styles.panel}`}>
          <h3 className={styles.panelTitle}>Riwayat Status</h3>
          <div className={styles.timeline}>
            {history.length > 0 ? history.slice().reverse().map((event, index) => {
              const resolved = resolveHistoryEvent(event, index);
              return (
                <div key={resolved.key} className={styles.timelineItem}>
                  <div className={styles.timelineDot} />
                  <div>
                    <p className={styles.timelineTitle}>{resolved.label}</p>
                    <p className={styles.timelineMeta}>{resolved.note}</p>
                    <p className={styles.timelineTime}>{resolved.timestamp}</p>
                  </div>
                </div>
              );
            }) : <p>Belum ada riwayat status yang tersedia.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}