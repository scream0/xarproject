"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import styles from "./OrdersSection.module.css";
import ordersConfig from "@/data/ui/ordersConfig.json";
import { auth } from "@/lib/supabaseClient";
import { shouldSkipAuthEvent } from "@/utils/authHelpers";
import toast from "react-hot-toast";
import { useStore } from "@/context/StoreContext";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { OrdersSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";
import { formatAddressDisplay } from "@/utils/address";
import { sortOrdersByNewestFirst } from "./orderSorting";
import { useRouter } from "next/navigation";
import ReturnsCenter from "@/components/Dashboard/User/Returns/ReturnsCenter"; // Sesuaikan path jika berbeda

// Mapping status mentah dari database/Admin -> label & tahap yang ditampilkan
const STATUS_INFO = {
  pending: {
    label: "Menunggu Pembayaran",
    badgeClass: "statusPending",
  },
  unpaid: {
    label: "Menunggu Pembayaran",
    badgeClass: "statusPending",
  },
  paid: {
    label: "Sedang Dikemas",
    badgeClass: "statusProcessing",
  },
  success: {
    label: "Sedang Dikemas",
    badgeClass: "statusProcessing",
  },
  settlement: {
    label: "Sedang Dikemas",
    badgeClass: "statusProcessing",
  },
  capture: {
    label: "Sedang Dikemas",
    badgeClass: "statusProcessing",
  },
  processing: {
    label: "Sedang Dikemas",
    badgeClass: "statusProcessing",
  },
  shipping: {
    label: "Dalam Pengiriman",
    badgeClass: "statusShipping",
  },
  shipped: {
    label: "Dalam Pengiriman",
    badgeClass: "statusShipping",
  },
  delivered: {
    label: "Pesanan Selesai",
    badgeClass: "statusCompleted",
  },
  completed: {
    label: "Pesanan Selesai",
    badgeClass: "statusCompleted",
  },
  cancelled: {
    label: "Dibatalkan",
    badgeClass: "statusCancelled",
  },
  canceled: {
    label: "Dibatalkan",
    badgeClass: "statusCancelled",
  },
  return_requested: {
    label: "Pengajuan Return",
    badgeClass: "statusReturn",
  },
  returning: {
    label: "Barang Dikirim Balik",
    badgeClass: "statusShipping",
  },
  returned: {
    label: "Return Selesai",
    badgeClass: "statusCompleted",
  },
};

function getStatusInfo(rawStatus) {
  const key = (rawStatus || "pending").toLowerCase();
  return (
    STATUS_INFO[key] || {
      label: (rawStatus || "PENDING").toUpperCase(),
      badgeClass: "statusProcessing",
    }
  );
}

function formatOrderDoc(item, primaryAddress) {
  const rawStatus = (item.status || "pending").toLowerCase();

  let displayName = item.product_name || item.name || "Extrait de Parfum";
  if (item.items && Array.isArray(item.items) && item.items.length > 0) {
    const firstItem = item.items[0];
    displayName = `${firstItem.product_name || firstItem.name || "Produk"} (${firstItem.variant_name || firstItem.size || "Standard"})`;
    if (item.items.length > 1) {
      displayName += ` +${item.items.length - 1} produk lainnya`;
    }
  }

  const orderAddressObj =
    item.shippingAddress || item.shipping_address || item.address;
  const formattedAddress = orderAddressObj
    ? formatAddressDisplay(orderAddressObj)
    : primaryAddress || "Belum diatur";

  const rawAmount = Number(item.amount || item.gross_amount || item.price || 0);

  const reviewedItemIds = Array.isArray(item.reviewedItemIds)
    ? item.reviewedItemIds
    : [];

  return {
    id: item.orderId || item.order_id || item.id,
    name: displayName,
    items: item.items || [],
    hasBeenReviewed: item.hasBeenReviewed || false,
    reviewedItemIds,
    shippingReceiptNumber: item.shippingReceiptNumber || null,
    statusHistory: Array.isArray(item.statusHistory) ? item.statusHistory : [],
    concentration:
      item.concentration ||
      (item.items?.[0] ? `Varian: ${item.items[0].variant_name || item.items[0].size || "Standard"}` : "30% Bibit (50 ml)"),
    notes: item.notes || "-",
    price: `Rp ${rawAmount.toLocaleString("id-ID")}`,
    rawPrice: rawAmount,
    status: rawStatus,
    snap_token: item.snap_token || item.snapToken || null,
    date:
      item.createdAt || item.created_at
        ? new Date(
            item.createdAt.seconds
              ? item.createdAt.seconds * 1000
              : item.createdAt || item.created_at,
          ).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "Hari ini",
    paymentMethod:
      item.payment_type ||
      item.paymentType ||
      "Midtrans QRIS / Virtual Account",
    shippingAddress: formattedAddress,
  };
}

export default function OrdersSection() {
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useStore();
  const router = useRouter();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  
  const [isCancelling, setIsCancelling] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPayingId, setIsPayingId] = useState(null);

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedOrderToCancel, setSelectedOrderToCancel] = useState(null);
  const lastUserIdRef = useRef(null);

  const [reviewModalOrder, setReviewModalOrder] = useState(null);
  const [reviewTargetItem, setReviewTargetItem] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewPhotoFile, setReviewPhotoFile] = useState(null);
  const [reviewPhotoPreview, setReviewPhotoPreview] = useState(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const [returnModalOrder, setReturnModalOrder] = useState(null);
  const [returnReason, setReturnReason] = useState("");
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  useEffect(() => {
    let subscription = null;

    const initAuth = async () => {
      const { data: { session } } = await auth.getSession();
      lastUserIdRef.current = session?.user?.id || null;
      if (session) {
        setCurrentSession(session);
        setCurrentUser(session?.user || null);
      }

      if (!session) {
        setLoading(false);
        setOrders([]);
      }

      const { data: authListener } = auth.onAuthStateChange((_event, session) => {
        if (shouldSkipAuthEvent(_event, session, lastUserIdRef.current)) return;
        lastUserIdRef.current = session?.user?.id || null;

        if (session) {
          setCurrentSession(session);
          setCurrentUser(session?.user || null);
        }
        if (!session) {
          setLoading(false);
          setOrders([]);
        }
      });
      subscription = authListener?.subscription;
    };

    initAuth();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const snapScriptUrl = process.env.NODE_ENV === "production"
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "";

    if (!document.getElementById("midtrans-snap-script")) {
      const script = document.createElement("script");
      script.id = "midtrans-snap-script";
      script.src = snapScriptUrl;
      script.setAttribute("data-client-key", clientKey);
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (!currentUser || !currentSession) return;

    let isActive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    const loadOrders = async () => {
      try {
        const userId = currentUser.id || currentUser.uid;
        const token = currentSession.access_token;

        const response = await fetch(`/api/user/orders?userId=${userId}`, {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) {
          throw new Error("Gagal mengambil data pesanan");
        }

        const result = await response.json();
        if (!isActive) return;

        const primaryAddress = result.primaryAddress || "Belum diatur";

        const formatted = (result.orders || []).map((order) =>
          formatOrderDoc(order, primaryAddress),
        );

        const sorted = sortOrdersByNewestFirst(formatted);

        setOrders(sorted);
      } catch (error) {
        console.error("Gagal memuat pesanan dari API:", error);
        if (isActive) {
          toast.error("Gagal memuat data pesanan.");
          setOrders([]);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadOrders();

    return () => {
      isActive = false;
    };
  }, [currentUser, currentSession]);

  const filteredOrders = useMemo(() => {
    let result = orders;

    if (filter !== "all" && filter !== "return") {
      if (filter === "pending") {
        result = result.filter((o) => ["pending", "unpaid"].includes(o.status));
      } else if (filter === "processing") {
        result = result.filter((o) => ["paid", "success", "processing", "settlement", "capture"].includes(o.status));
      } else if (filter === "shipping") {
        result = result.filter((o) => ["shipping", "shipped"].includes(o.status));
      } else if (filter === "history") {
        result = result.filter((o) => ["completed", "delivered", "cancelled", "canceled"].includes(o.status));
      }
    }

    if (searchQuery.trim() !== "") {
      const query_ = searchQuery.toLowerCase();
      result = result.filter(
        (o) =>
          o.id.toLowerCase().includes(query_) ||
          o.name.toLowerCase().includes(query_) ||
          o.concentration.toLowerCase().includes(query_),
      );
    }

    return result;
  }, [orders, filter, searchQuery]);

  const orderStats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter((o) => ["pending", "unpaid"].includes(o.status)).length;
    const processing = orders.filter((o) => ["paid", "success", "processing", "settlement", "capture"].includes(o.status)).length;
    const shipping = orders.filter((o) => ["shipping", "shipped"].includes(o.status)).length;
    const history = orders.filter((o) => ["completed", "delivered", "cancelled", "canceled"].includes(o.status)).length;
    const returnCount = orders.filter((o) => ["return_requested", "returning", "returned"].includes(o.status)).length;

    return { total, pending, processing, shipping, history, return: returnCount };
  }, [orders]);

  const filterTabs = useMemo(
    () => [
      { key: "all", label: "Semua", icon: "grid", count: orderStats.total },
      { key: "pending", label: "Belum Bayar", icon: "wallet", count: orderStats.pending },
      { key: "processing", label: "Sedang Dikemas", icon: "package", count: orderStats.processing },
      { key: "shipping", label: "Dikirim", icon: "truck", count: orderStats.shipping },
      { key: "history", label: "Riwayat Pesanan", icon: "clock", count: orderStats.history },
      { key: "return", label: "Return Center", icon: "rotate-ccw", count: orderStats.return },
    ],
    [orderStats],
  );

  const handlePayOrder = async (order) => {
    if (isPayingId) return;
    setIsPayingId(order.id);
    let snapToken = order.snap_token;

    if (!snapToken) {
      toast.loading("Menghubungkan sistem pembayaran...", { id: "snap-pay-loader" });
      try {
        const { data: { session } } = await auth.getSession();
        const token = session?.access_token;
        const userId = currentUser?.id || currentUser?.uid;

        const res = await fetch(`/api/user/orders/${order.id}/pay`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ userId }),
        });

        const data = await res.json();
        toast.dismiss("snap-pay-loader");

        if (!res.ok) {
          throw new Error(data.error || "Gagal menghasilkan token pembayaran.");
        }

        snapToken = data.snap_token;
      } catch (err) {
        toast.dismiss("snap-pay-loader");
        toast.error(err.message || "Gagal memuat sistem pembayaran.");
        setIsPayingId(null);
        return;
      }
    }

    setIsPayingId(null);

    if (!snapToken) {
      toast.error("Token pembayaran tidak ditemukan. Silakan buka detail pesanan.");
      return;
    }

    if (typeof window.snap === "undefined") {
      toast.error("Modul pembayaran sedang dimuat, coba sesaat lagi.");
      return;
    }

    window.snap.pay(snapToken, {
      onSuccess: async function (result) {
        toast.success("Pembayaran Berhasil! Pesanan sekarang sedang dikemas.");
        try {
          const { data: { session } } = await auth.getSession();
          const token = session?.access_token;
          await fetch(`/api/user/orders/${order.id}/sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              transaction_status: result.transaction_status || "settlement",
              status_code: result.status_code,
              order_id: result.order_id,
            }),
          });
        } catch (e) {
          console.error("Sync payment error:", e);
        }
        
        // Mutasi status lokal agar badge dan daftar langsung berpindah ke Sedang Dikemas
        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id ? { ...o, status: "paid" } : o
          )
        );
        setFilter("processing");
      },
      onPending: function () {
        toast("Menunggu pembayaran Anda diselesaikan.", { icon: "⏳" });
      },
      onClose: function () {
        toast("Popup pembayaran ditutup.", { icon: "ℹ️" });
      },
    });
  };

  const handleReOrder = async (order) => {
    const toastId = toast.loading("Memeriksa ketersediaan stok produk...");
    try {
      if (!currentUser) throw new Error("Pengguna tidak terautentikasi.");

      const productsRes = await fetch("/api/products", { cache: "no-store" });
      const productsResult = await productsRes.json();
      if (!productsRes.ok) throw new Error("Gagal memeriksa stok produk.");

      const latestProducts =
        productsResult.data || productsResult.products || [];
      const orderItems =
        order.items && order.items.length > 0
          ? order.items
          : [
              {
                id: order.id,
                name: order.name,
                quantity: 1,
                size: order.concentration,
                price: order.rawPrice,
              },
            ];

      let addedCount = 0;

      for (const item of orderItems) {
        const pId = String(item.id || item.productId || item.product_id || "");
        const orderedSize = String(item.size || "").trim();
        const orderedQty = Number(item.quantity || item.qty || 1);

        const foundProduct = latestProducts.find(
          (p) =>
            String(p.id || p._id) === pId ||
            p.name?.toLowerCase() === item.name?.toLowerCase(),
        );

        if (!foundProduct) {
          toast.error(`Produk "${item.name}" sudah tidak tersedia.`);
          continue;
        }

        let targetVariant = null;
        let currentStock = 0;

        if (
          Array.isArray(foundProduct.variants) &&
          foundProduct.variants.length > 0
        ) {
          targetVariant = foundProduct.variants.find(
            (v) =>
              String(v.size || "")
                .trim()
                .toLowerCase() === orderedSize.toLowerCase(),
          );
          currentStock = Number(
            targetVariant?.stock ?? targetVariant?.stok ?? 0,
          );
        } else {
          currentStock = Number(foundProduct.stock ?? foundProduct.stok ?? 0);
        }

        if (currentStock <= 0) {
          toast.error(
            `Stok "${item.name} (${orderedSize || "Standard"})" sudah habis.`,
          );
          continue;
        }

        const finalQty = Math.min(orderedQty, currentStock);
        if (finalQty < orderedQty) {
          toast(
            `Stok terbatas! Jumlah "${item.name}" disesuaikan jadi ${finalQty}.`,
          );
        }

        const variantData = targetVariant || {
          size: orderedSize || "Standard",
          price: Number(item.price || foundProduct.price || 0),
          stock: currentStock,
        };

        addToCart(foundProduct, variantData, finalQty);
        addedCount++;
      }

      toast.dismiss(toastId);

      if (addedCount > 0) {
        toast.success("Produk berhasil dimasukkan ke keranjang!");
      } else {
        toast.error("Gagal menambahkan produk ke keranjang karena stok habis.");
      }
    } catch (err) {
      console.error("Re-Order Error:", err);
      toast.error(err.message || "Gagal memproses pesanan ulang.", {
        id: toastId,
      });
    }
  };

  const handleOpenOrderDetail = async (order) => {
    if (!currentUser) return;
    router.push(`/account/orders/${order.id}`);
  };

  const handleCancelOrder = async (order) => {
    if (isCancelling) return;
    const confirmCancel = window.confirm(
      `Batalkan pesanan ${order.id}? Tindakan ini tidak bisa dibatalkan.`,
    );
    if (!confirmCancel) return;

    setIsCancelling(true);
    const toastId = toast.loading("Membatalkan pesanan...");
    try {
      const { data: { session } } = await auth.getSession();
      const token = session?.access_token;
      const userId = currentUser?.id || currentUser?.uid;

      if (!userId) throw new Error("Pengguna tidak terautentikasi.");

      const res = await fetch(`/api/user/orders/${order.id}/cancel?userId=${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ orderId: order.id, userId }),
      });

      const result = await res.json();
      if (!res.ok)
        throw new Error(result.error || "Gagal membatalkan pesanan.");

      toast.success("Pesanan berhasil dibatalkan.", { id: toastId });
      
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: "cancelled" } : o))
      );
    } catch (err) {
      console.error("Cancel Order Error:", err);
      toast.error(err.message || "Gagal membatalkan pesanan.", { id: toastId });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConfirmReceived = async (order) => {
    if (isConfirming) return;

    const confirmAction = window.confirm(
      `Konfirmasi bahwa pesanan ${order.id} sudah diterima?`,
    );
    if (!confirmAction) return;

    setIsConfirming(true);
    const toastId = toast.loading("Mengonfirmasi penerimaan pesanan...");

    try {
      const { data: { session } } = await auth.getSession();
      const token = session?.access_token;
      const userId = currentUser?.id || currentUser?.uid;

      if (!userId) throw new Error("Pengguna tidak terautentikasi.");

      const res = await fetch(`/api/user/orders/${order.id}/confirm?userId=${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Gagal mengonfirmasi pesanan.");
      }

      toast.success("Pesanan berhasil dikonfirmasi diterima.", { id: toastId });
      
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: "delivered" } : o))
      );
    } catch (err) {
      console.error("Confirm Order Error:", err);
      toast.error(err.message || "Gagal mengonfirmasi pesanan.", { id: toastId });
    } finally {
      setIsConfirming(false);
    }
  };

  const openReviewModal = (order, item) => {
    setReviewModalOrder(order);
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
    if (
      !reviewModalOrder ||
      !reviewTargetItem ||
      !currentUser ||
      isSubmittingReview
    ) {
      return;
    }

    setIsSubmittingReview(true);
    const toastId = toast.loading("Mengirim ulasan Anda...");

    try {
      const { data: { session } } = await auth.getSession();
      const token = session?.access_token;
      const userId = currentUser.id || currentUser.uid;

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
          productId:
            reviewTargetItem.product_id ||
            reviewTargetItem.productId ||
            reviewTargetItem.id ||
            reviewModalOrder.id,
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

      toast.success("Terima kasih! Ulasan Anda berhasil dikirim.", {
        id: toastId,
      });

      const targetItemId = String(reviewTargetItem.product_id || reviewTargetItem.productId || reviewTargetItem.id || "");

      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === reviewModalOrder.id) {
            const updatedReviewedIds = [...(o.reviewedItemIds || []), targetItemId];
            return {
              ...o,
              reviewedItemIds: updatedReviewedIds,
              hasBeenReviewed: true,
            };
          }
          return o;
        })
      );

      closeReviewModal();
    } catch (error) {
      console.error("Gagal mengirim ulasan:", error);
      toast.error(error.message, { id: toastId });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const isItemReviewed = (order, item) => {
    const itemId = String(item.product_id || item.productId || item.id || "");
    if (order.reviewedItemIds && order.reviewedItemIds.length > 0) {
      return order.reviewedItemIds.includes(itemId);
    }
    return order.hasBeenReviewed;
  };

  const openReturnModal = (order) => {
    setReturnModalOrder(order);
    setReturnReason("");
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!returnModalOrder || !currentUser || isSubmittingReturn) return;

    setIsSubmittingReturn(true);
    const toastId = toast.loading("Mengajukan return pesanan...");

    try {
      const { data: { session } } = await auth.getSession();
      const token = session?.access_token;
      const userId = currentUser.id || currentUser.uid;

      const res = await fetch(`/api/user/orders/${returnModalOrder.id}/return`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ userId, reason: returnReason }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Gagal mengajukan return pesanan.");
      }

      toast.success("Pengajuan return berhasil dikirim.", { id: toastId });

      setOrders((prev) =>
        prev.map((o) =>
          o.id === returnModalOrder.id ? { ...o, status: "return_requested" } : o
        )
      );

      setReturnModalOrder(null);
      setReturnReason("");
    } catch (error) {
      console.error("Gagal mengajukan return:", error);
      toast.error(error.message || "Gagal mengajukan return.", { id: toastId });
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  return (
    <div className={styles.workspaceInner}>
      {/* Header & Search */}
      <div className={`card ${styles.cardHeader}`}>
        <div className={styles.headerTopRow}>
          <div>
            <h3 className={styles.headerTitle}>{ordersConfig.header.title}</h3>
            <p className={styles.headerSubtitle}>
              {ordersConfig.header.subtitle}
            </p>
          </div>
          <div className={styles.searchBox}>
            <AppIcon
              name="search"
              size={16}
              strokeWidth={2}
              style={{ color: "#71717a" }}
            />
            <input
              type="text"
              placeholder={ordersConfig.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>

       {/* Tab Navigasi Kategori Pesanan */}
        <div className={styles.filterGroup}>
          {filterTabs.map((tab) => {
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`${styles.filterBtn} ${isActive ? styles.filterBtnActive : ""}`}
              >
                <div className={styles.filterIconWrapper}>
                  <AppIcon name={tab.icon} size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                  {tab.count > 0 && (
                    <span className={styles.filterCount}>{tab.count}</span>
                  )}
                </div>
                <span className={styles.filterLabel}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tampilan Kondisional: Jika tab "return" diklik, tampilkan ReturnsCenter */}
      {filter === "return" ? (
        <ReturnsCenter />
      ) : (
        /* Orders List Container */
        <div className={styles.ordersListContainer}>
          {loading ? (
            <OrdersSkeleton count={3} />
          ) : filteredOrders.length === 0 ? (
            <div className={`card ${styles.centerStateCard}`}>
              <AppIcon
                name="package"
                size={36}
                strokeWidth={1.5}
                style={{ color: "#71717a", marginBottom: "0.5rem" }}
              />
              <p className={styles.emptyText}>{ordersConfig.emptyText}</p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isFinished = order.status === "completed";
              const isPending = order.status === "pending";
              const isDelivered = ["shipping", "shipped", "delivered", "completed"].includes(order.status);
              const canReturn = ["shipping", "shipped", "delivered", "completed"].includes(order.status) && !["return_requested", "returning", "returned"].includes(order.status);
              const statusInfo = getStatusInfo(order.status);
              const reviewableItems =
                order.items && order.items.length > 0
                  ? order.items
                  : [{ id: order.id, name: order.name }];

              return (
                <div key={order.id} className={`card ${styles.orderCard}`}>
                  <div className={styles.orderInfoCol}>
                    <div className={styles.orderIdRow}>
                      <span className={styles.orderIdText}>{order.id}</span>
                      <span
                        className={`${styles.statusBadge} ${styles[statusInfo.badgeClass]}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    <h4 className={styles.orderName}>{order.name}</h4>
                    <p className={styles.orderSpec}>
                      Spesifikasi: {order.concentration}
                    </p>
                    <p className={styles.orderNotes}>Catatan: {order.notes}</p>
                    <p className={styles.orderDate}>Tanggal: {order.date}</p>

                    {isFinished && (
                      <div className={styles.perItemReviewRow}>
                        {reviewableItems.map((item, idx) => {
                          const reviewed = isItemReviewed(order, item);
                          return (
                            <button
                              key={idx}
                              onClick={() =>
                                !reviewed && openReviewModal(order, item)
                              }
                              disabled={reviewed}
                              className={
                                reviewed
                                  ? styles.reviewBtnDisabled
                                  : styles.reviewBtn
                              }
                            >
                              {reviewed
                                ? `✓ ${item.product_name || item.name} sudah diulas`
                                : `Ulas ${item.product_name || item.name}`}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className={styles.orderActionCol}>
                    <span className={styles.orderPrice}>{order.price}</span>
                    <div className={styles.buttonGroup}>
                      <button
                        onClick={() => handleOpenOrderDetail(order)}
                        className={styles.detailBtn}
                      >
                        {ordersConfig.buttons.details}
                      </button>
                      {isPending && (
                        <>
                          <button
                            onClick={() => handlePayOrder(order)}
                            disabled={isPayingId === order.id}
                            className={styles.payBtn}
                          >
                            <AppIcon name="creditcard" size={14} />
                            <span>{isPayingId === order.id ? "Memuat..." : "Bayar Sekarang"}</span>
                          </button>
                          <button
                            onClick={() => handleCancelOrder(order)}
                            disabled={isCancelling}
                            className={styles.cancelBtn}
                          >
                            Batalkan
                          </button>
                        </>
                      )}
                      {isDelivered && !isFinished && (
                        <button
                          onClick={() => handleConfirmReceived(order)}
                          disabled={isConfirming}
                          className={styles.confirmBtn}
                        >
                          {isConfirming ? "Memproses..." : "Konfirmasi Diterima"}
                        </button>
                      )}
                      {canReturn && (
                        <button
                          onClick={() => openReturnModal(order)}
                          className={styles.returnBtn}
                        >
                          Ajukan Return
                        </button>
                      )}
                      <button
                        onClick={() => handleReOrder(order)}
                        className={styles.reorderBtn}
                      >
                        {ordersConfig.buttons.reorder}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

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
                  <strong className={styles.modalProductName}>{reviewTargetItem.product_name || reviewTargetItem.name}</strong>
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

      {/* --- MODAL RETURN / RETURN CENTER --- */}
      {returnModalOrder && (
        <div
          className={styles.modalOverlay}
          onClick={() => setReturnModalOrder(null)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Pengajuan Return Pesanan</h3>
              <button
                onClick={() => setReturnModalOrder(null)}
                className={styles.modalCloseBtn}
              >
                <AppIcon name="x" size={18} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className={styles.modalBody}>
              <div>
                <span className={styles.modalFieldLabel}>ID Pesanan</span>
                <strong>{returnModalOrder.id}</strong>
              </div>
              <div>
                <span className={styles.modalFieldLabel}>Produk / Detail</span>
                <strong>{returnModalOrder.name}</strong>
              </div>
              <div>
                <span className={styles.modalFieldLabel}>Alasan Return</span>
                <textarea
                  rows={3}
                  required
                  placeholder="Tuliskan alasan pengembalian/return produk secara detail..."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className={styles.formTextarea}
                />
              </div>
              <button
                type="submit"
                className={styles.modalCloseActionBtn}
                disabled={isSubmittingReturn}
              >
                {isSubmittingReturn ? "Mengirim Pengajuan..." : "Kirim Pengajuan Return"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}