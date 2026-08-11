"use client";
import React, { useState, useEffect, useMemo } from "react";
import styles from "./OrdersSection.module.css";
import ordersConfig from "@/data/ui/ordersConfig.json";
import { auth, supabase } from "@/lib/supabaseClient";
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
  success: {
    label: "Pembayaran Diterima",
    badgeClass: "statusSuccess",
  },
  processing: {
    label: "Sedang Diracik / Dikemas",
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
  completed: {
    label: "Pesanan Selesai",
    badgeClass: "statusCompleted",
  },
  cancelled: {
    label: "Dibatalkan",
    badgeClass: "statusPending",
  },
  settlement: {
    label: "Pembayaran Diterima",
    badgeClass: "statusSuccess",
  },
  capture: {
    label: "Pembayaran Diterima",
    badgeClass: "statusSuccess",
  },
  return_requested: {
    label: "Pengajuan Return",
    badgeClass: "statusPending",
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
    displayName = `${firstItem.name} (${firstItem.size})`;
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
      (item.items?.[0] ? `Varian: ${item.items[0].size}` : "30% Bibit (50 ml)"),
    notes: item.notes || "-",
    price: `Rp ${rawAmount.toLocaleString("id-ID")}`,
    rawPrice: rawAmount,
    status: rawStatus,
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
  const [userPrimaryAddress, setUserPrimaryAddress] = useState("Belum diatur");
  const { addToCart } = useStore();
  const router = useRouter();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  
  const [isCancelling, setIsCancelling] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const [reviewModalOrder, setReviewModalOrder] = useState(null);
  const [reviewTargetItem, setReviewTargetItem] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewPhotoFile, setReviewPhotoFile] = useState(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const [returnModalOrder, setReturnModalOrder] = useState(null);
  const [returnReason, setReturnReason] = useState("");
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  useEffect(() => {
    let subscription = null;

    const initAuth = async () => {
      const { data: { session } } = await auth.getSession();
      setCurrentSession(session);
      setCurrentUser(session?.user || null);

      if (!session) {
        setLoading(false);
        setOrders([]);
      }

      const { data: authListener } = auth.onAuthStateChange((_event, session) => {
        setCurrentSession(session);
        setCurrentUser(session?.user || null);
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
    const snapScriptUrl = "https://app.sandbox.midtrans.com/snap/snap.js";
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
        setUserPrimaryAddress(primaryAddress);

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
          setUserPrimaryAddress("Belum diatur");
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
        result = result.filter((o) => o.status === "pending");
      } else if (filter === "processing") {
        result = result.filter((o) => ["success", "processing", "settlement", "capture"].includes(o.status));
      } else if (filter === "shipping") {
        result = result.filter((o) => ["shipping", "shipped"].includes(o.status));
      } else if (filter === "history") {
        result = result.filter((o) => ["completed", "cancelled"].includes(o.status));
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
    const pending = orders.filter((o) => o.status === "pending").length;
    const processing = orders.filter((o) => ["success", "processing", "settlement", "capture"].includes(o.status)).length;
    const shipping = orders.filter((o) => ["shipping", "shipped"].includes(o.status)).length;
    const history = orders.filter((o) => ["completed", "cancelled"].includes(o.status)).length;
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
        prev.map((o) => (o.id === order.id ? { ...o, status: "completed" } : o))
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
        const uploadData = new FormData();
        uploadData.append("file", reviewPhotoFile);
        uploadData.append("userId", userId);
        uploadData.append("folder", "reviews");
        const { data: { session } } = await auth.getSession();
        const uploadRes = await fetch("/api/cloudinary", { method: "POST", headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}, body: uploadData });
        const uploadResult = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadResult.error || "Gagal mengunggah foto ulasan.");
        reviewPhoto = uploadResult.secure_url;
      }

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
            reviewTargetItem.id ||
            reviewTargetItem.productId ||
            reviewModalOrder.id,
          productName: reviewTargetItem.name || reviewModalOrder.name,
          rating,
          comment,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Gagal mengirim ulasan.");
      }

      toast.success("Terima kasih! Ulasan Anda berhasil dikirim.", {
        id: toastId,
      });

      const targetItemId = String(reviewTargetItem.id || reviewTargetItem.productId || "");

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

      setReviewModalOrder(null);
      setReviewTargetItem(null);
      setComment("");
      setRating(5);
    } catch (error) {
      console.error("Gagal mengirim ulasan:", error);
      toast.error(error.message, { id: toastId });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const isItemReviewed = (order, item) => {
    const itemId = String(item.id || item.productId || "");
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
                                ? `✓ ${item.name} sudah diulas`
                                : `Ulas ${item.name}`}
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
                        <button
                          onClick={() => handleCancelOrder(order)}
                          disabled={isCancelling}
                          className={styles.cancelBtn}
                        >
                          Batalkan
                        </button>
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

      {/* --- MODAL ULASAN PRODUK --- */}
      {reviewModalOrder && reviewTargetItem && (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            setReviewModalOrder(null);
            setReviewTargetItem(null);
          }}
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
                onClick={() => {
                  setReviewModalOrder(null);
                  setReviewTargetItem(null);
                }}
                className={styles.modalCloseBtn}
              >
                <AppIcon name="x" size={18} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className={styles.modalBody}>
              <div>
                <span className={styles.modalFieldLabel}>
                  {ordersConfig.labels.product}
                </span>
                <strong>{reviewTargetItem.name}</strong>
              </div>
              <div>
                <span className={styles.modalFieldLabel}>
                  {ordersConfig.labels.ratingLabel}
                </span>
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className={styles.formInput}
                >
                  {ordersConfig.ratingOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className={styles.modalFieldLabel}>
                  {ordersConfig.labels.commentLabel}
                </span>
                <textarea
                  rows={3}
                  required
                  placeholder={ordersConfig.labels.commentPlaceholder}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className={styles.formTextarea}
                />
              </div>
              <button
                type="submit"
                className={styles.modalCloseActionBtn}
                disabled={isSubmittingReview}
              >
                {isSubmittingReview
                  ? ordersConfig.labels.submittingReview
                  : ordersConfig.labels.submitReview}
              </button>
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
