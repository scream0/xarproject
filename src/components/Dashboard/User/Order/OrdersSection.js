"use client";
import React, { useState, useEffect, useMemo } from "react";
import styles from "./OrdersSection.module.css";
import ordersConfig from "@/data/ui/ordersConfig.json";
import { auth, db } from "@/lib/firebaseClient";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import toast from "react-hot-toast";
import { useStore } from "@/context/StoreContext";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { OrdersSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";

// Mapping status mentah dari Firestore/Admin -> label & tahap yang ditampilkan
// ke customer. Ini HARUS selalu sinkron dengan alur status di TransactionTable.js
// (admin): pending -> success -> processing -> shipping -> completed
const STATUS_INFO = {
  pending: {
    label: "Menunggu Pembayaran",
    badgeClass: "statusProcessing",
  },
  success: {
    label: "Pembayaran Diterima",
    badgeClass: "statusProcessing",
  },
  processing: {
    label: "Sedang Diracik",
    badgeClass: "statusProcessing",
  },
  shipping: {
    label: "Dalam Pengiriman",
    badgeClass: "statusProcessing",
  },
  shipped: {
    label: "Dalam Pengiriman",
    badgeClass: "statusProcessing",
  },
  completed: {
    label: "Pesanan Selesai",
    badgeClass: "statusCompleted",
  },
  cancelled: {
    label: "Dibatalkan",
    badgeClass: "statusCancelled",
  },
  // fallback untuk status dari Midtrans yang belum sempat di-mapping admin
  settlement: {
    label: "Pembayaran Diterima",
    badgeClass: "statusProcessing",
  },
  capture: {
    label: "Pembayaran Diterima",
    badgeClass: "statusProcessing",
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

// Helper untuk memformat 1 dokumen order mentah dari Firestore menjadi
// struktur yang dipakai UI. Dipakai baik oleh listener real-time maupun
// (jika diperlukan) fetch manual, supaya format selalu konsisten.
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

  const orderAddressObj = item.shipping_address || item.address;
  let formattedAddress = "Belum diatur";
  if (typeof orderAddressObj === "string") {
    formattedAddress = orderAddressObj;
  } else if (orderAddressObj) {
    formattedAddress = `${orderAddressObj.recipientName || ""} (${orderAddressObj.recipientPhone || ""}) - ${orderAddressObj.street || ""}, ${orderAddressObj.city || ""} (${orderAddressObj.postalCode || ""})`;
  } else {
    formattedAddress = primaryAddress || "Belum diatur";
  }

  const rawAmount = Number(item.amount || item.gross_amount || item.price || 0);

  // reviewedItemIds: array id produk yang sudah direview di order ini.
  // Fallback ke hasBeenReviewed (boolean lama) supaya data lama tetap kompatibel.
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
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [userPrimaryAddress, setUserPrimaryAddress] = useState("Belum diatur");
  const { addToCart } = useStore();
  // State untuk currentUser yang mendengarkan status Auth Firebase secara real-time
  const [currentUser, setCurrentUser] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // State untuk modal ulasan produk
  const [reviewModalOrder, setReviewModalOrder] = useState(null);
  const [reviewTargetItem, setReviewTargetItem] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // 1. Pantau status Auth Firebase secara dinamis
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (!user) {
        setLoading(false);
        setOrders([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Muat Script Midtrans Snap secara dinamis
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

  // 3. LISTENER REAL-TIME: dengarkan perubahan koleksi "orders" milik user ini.
  // Begitu admin ubah status pesanan di dashboard, UI customer otomatis
  // ter-update tanpa perlu refresh manual.
  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);

    // Ambil alamat utama sekali lewat endpoint yang sudah ada (bukan real-time,
    // karena alamat jarang berubah dan tidak butuh listener terpisah)
    fetch(`/api/orders?userId=${currentUser.uid}`)
      .then((res) => res.json())
      .then((result) => {
        setUserPrimaryAddress(result.primaryAddress || "Belum diatur");
      })
      .catch(() => {});

    const ordersQuery = query(
      collection(db, "orders"),
      where("userId", "==", currentUser.uid),
    );

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const formatted = snapshot.docs.map((doc) =>
          formatOrderDoc({ id: doc.id, ...doc.data() }, userPrimaryAddress),
        );
        // Urutkan terbaru dulu
        formatted.sort((a, b) => {
          const da = new Date(a.date).getTime() || 0;
          const db_ = new Date(b.date).getTime() || 0;
          return db_ - da;
        });
        setOrders(formatted);
        setLoading(false);
      },
      (err) => {
        console.error("Gagal mendengarkan perubahan pesanan:", err);
        toast.error("Gagal memuat data pesanan secara real-time.");
        setLoading(false);
      },
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // 4. Filter & Search Logic
  // Tab "completed" HANYA menampilkan pesanan yang benar-benar sudah selesai
  // (barang sudah diterima), bukan sekadar "sudah dibayar" atau "sedang dikirim".
  // Status lain (pending/success/processing/shipping) tetap dianggap "berjalan".
  const filteredOrders = useMemo(() => {
    let result = orders;

    if (filter !== "all") {
      if (filter === "completed") {
        result = result.filter((o) => o.status === "completed");
      } else if (filter === "processing") {
        // "Berjalan" mencakup semua tahap sebelum selesai
        result = result.filter((o) =>
          ["pending", "success", "processing", "shipping", "shipped"].includes(o.status),
        );
      } else {
        result = result.filter((o) => o.status === filter);
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

  // Fungsi Pesanan Lagi: Validasi stok & masukkan ke keranjang belanja
  const handleReOrder = async (order) => {
    const toastId = toast.loading("Memeriksa ketersediaan stok produk...");
    try {
      if (!currentUser) throw new Error("Pengguna tidak terautentikasi.");

      // Ambil data produk terbaru dari database untuk cek stok
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

        // Cari varian atau produk utama
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

        // Sesuaikan jumlah dengan sisa stok
        const finalQty = Math.min(orderedQty, currentStock);
        if (finalQty < orderedQty) {
          toast(
            `Stok terbatas! Jumlah "${item.name}" disesuaikan jadi ${finalQty}.`,
          );
        }

        // Masukkan ke keranjang menggunakan Store Context
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

  // Batalkan pesanan yang masih berstatus "pending" (belum dibayar)
  const handleCancelOrder = async (order) => {
    if (isCancelling) return;
    const confirmCancel = window.confirm(
      `Batalkan pesanan ${order.id}? Tindakan ini tidak bisa dibatalkan.`,
    );
    if (!confirmCancel) return;

    setIsCancelling(true);
    const toastId = toast.loading("Membatalkan pesanan...");
    try {
      if (!currentUser) throw new Error("Pengguna tidak terautentikasi.");
      const token = await currentUser.getIdToken();

      const res = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId: order.id }),
      });

      const result = await res.json();
      if (!res.ok)
        throw new Error(result.error || "Gagal membatalkan pesanan.");

      toast.success("Pesanan berhasil dibatalkan.", { id: toastId });
      // Tidak perlu refetch manual — listener onSnapshot akan otomatis update
    } catch (err) {
      console.error("Cancel Order Error:", err);
      toast.error(err.message || "Gagal membatalkan pesanan.", { id: toastId });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCopyId = (orderId) => {
    navigator.clipboard.writeText(orderId);
    toast.success(`ID Transaksi ${orderId} disalin!`);
  };

  const handleDownloadInvoice = (order) => {
    const invoiceContent = `=====================================
          INVOICE TRANSAKSI XAR
=====================================
ID Transaksi     : ${order.id}
Tanggal          : ${order.date}
Status Pesanan   : ${getStatusInfo(order.status).label}
-------------------------------------
PRODUK
Nama Produk      : ${order.name}
Spesifikasi      : ${order.concentration}
Catatan          : ${order.notes}
-------------------------------------
PEMBAYARAN & PENGIRIMAN
Metode Pembayaran: ${order.paymentMethod}
Alamat Pengiriman: ${order.shippingAddress}
Total Pembayaran : ${order.price}
=====================================
Terima kasih telah berbelanja di XAR!`;

    const blob = new Blob([invoiceContent], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Invoice-${order.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Invoice berhasil diunduh!");
  };

  // Buka modal review untuk item TERTENTU dalam order (bukan selalu item pertama)
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
      const token = await currentUser.getIdToken();

      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: currentUser.uid,
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
      setReviewModalOrder(null);
      setReviewTargetItem(null);
      setComment("");
      setRating(5);
      // Tidak perlu refetch manual — listener onSnapshot akan otomatis update
    } catch (error) {
      console.error("Gagal mengirim ulasan:", error);
      toast.error(error.message, { id: toastId });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Cek apakah item tertentu dalam order sudah direview
  const isItemReviewed = (order, item) => {
    const itemId = String(item.id || item.productId || "");
    if (order.reviewedItemIds && order.reviewedItemIds.length > 0) {
      return order.reviewedItemIds.includes(itemId);
    }
    // Fallback untuk order lama yang cuma punya flag boolean di level order
    return order.hasBeenReviewed;
  };

  return (
    <div className={styles.workspaceInner}>
      {/* Header, Search & Filter Tabs */}
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

        <div className={styles.filterGroup}>
          {ordersConfig.tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`${styles.filterBtn} ${filter === tab ? styles.filterBtnActive : ""}`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List Container */}
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

                  {/* Tombol review per-item, hanya tampil jika order sudah selesai */}
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
                      onClick={() => setSelectedOrder(order)}
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

      {/* --- MODAL DETAIL PESANAN TERHUBUNG DATABASE --- */}
      {selectedOrder && (
        <div
          className={styles.modalOverlay}
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{ordersConfig.modal.title}</h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className={styles.modalCloseBtn}
              >
                <AppIcon name="x" size={18} strokeWidth={2} />
              </button>
            </div>

            {selectedOrder.status === "cancelled" ? (
              <div className={styles.cancelledNotice}>
                Pesanan ini telah dibatalkan.
              </div>
            ) : (
              <div className={styles.trackingStepper}>
                <div className={styles.stepItemActive}>
                  <div className={styles.stepDot}></div>
                  <span>Pesanan Dibuat</span>
                </div>
                <div
                  className={
                    ["success", "processing", "shipping", "shipped", "completed"].includes(
                      selectedOrder.status,
                    )
                      ? styles.stepItemActive
                      : styles.stepItem
                  }
                >
                  <div className={styles.stepDot}></div>
                  <span>Pembayaran Dikonfirmasi</span>
                </div>
                <div
                  className={
                    ["processing", "shipping", "shipped", "completed"].includes(
                      selectedOrder.status,
                    )
                      ? styles.stepItemActive
                      : styles.stepItem
                  }
                >
                  <div className={styles.stepDot}></div>
                  <span>Peracikan / Diproses</span>
                </div>
                <div
                  className={
                    ["shipping", "shipped", "completed"].includes(selectedOrder.status)
                      ? styles.stepItemActive
                      : styles.stepItem
                  }
                >
                  <div className={styles.stepDot}></div>
                  <span>Dikirim / Selesai</span>
                </div>
              </div>
            )}

            {selectedOrder.statusHistory?.length > 0 && (
              <div className={styles.statusHistory}>
                <strong>Riwayat status</strong>
                {selectedOrder.statusHistory.slice().reverse().map((event, index) => (
                  <p key={`${event.changedAt || event.status}-${index}`}>
                    <span>{getStatusInfo(event.status).label}</span>
                    <small>{event.changedAt ? new Date(event.changedAt).toLocaleString("id-ID") : "Baru saja"}</small>
                  </p>
                ))}
              </div>
            )}
            <div className={styles.modalBody}>
              <div>
                <span className={styles.modalFieldLabel}>
                  {ordersConfig.labels.orderId}
                </span>
                <strong className={styles.modalFieldValueAccent}>
                  {selectedOrder.id}
                </strong>
              </div>
              <div>
                <span className={styles.modalFieldLabel}>
                  {ordersConfig.labels.product}
                </span>
                <span>{selectedOrder.name}</span>
              </div>
              <div>
                <span className={styles.modalFieldLabel}>
                  {ordersConfig.labels.specsAndNotes}
                </span>
                <span>
                  {selectedOrder.concentration} | Catatan: {selectedOrder.notes}
                </span>
              </div>
              <div>
                <span className={styles.modalFieldLabel}>
                  {ordersConfig.labels.paymentMethod}
                </span>
                <span>{selectedOrder.paymentMethod}</span>
              </div>
              <div>
                <span className={styles.modalFieldLabel}>
                  {ordersConfig.labels.shippingAddress}
                </span>
                <span>{selectedOrder.shippingAddress}</span>
              </div>
              {selectedOrder.shippingReceiptNumber && (
                <div className={styles.receiptContainer}>
                  <span className={styles.modalFieldLabel}>
                    {ordersConfig.labels.shippingReceipt}
                  </span>
                  <div className={styles.receiptInfo}>
                    <span>{selectedOrder.shippingReceiptNumber}</span>
                    <button
                      onClick={() =>
                        window.open(
                          `https://jet.co.id/track?hal=1&track_id=${selectedOrder.shippingReceiptNumber}`,
                          "_blank",
                        )
                      }
                      className={styles.trackButton}
                    >
                      {ordersConfig.labels.trackShipping}
                    </button>
                  </div>
                </div>
              )}
              <div className={styles.modalPriceRow}>
                <span className={styles.modalPriceLabel}>
                  {ordersConfig.labels.totalPaid}
                </span>
                <span className={styles.modalPriceValue}>
                  {selectedOrder.price}
                </span>
              </div>
            </div>

            <div className={styles.modalActionRow}>
              <button
                onClick={() => handleCopyId(selectedOrder.id)}
                className={styles.modalActionBtn}
              >
                {ordersConfig.buttons.copyId || "Salin ID"}
              </button>
              <button
                onClick={() => handleDownloadInvoice(selectedOrder)}
                className={styles.modalActionBtn}
              >
                {ordersConfig.buttons.downloadInvoice || "Unduh Invoice"}
              </button>
            </div>

            <button
              onClick={() => setSelectedOrder(null)}
              className={styles.modalCloseActionBtn}
            >
              {ordersConfig.modal.closeBtn}
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL ULASAN PRODUK (per-item) --- */}
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
    </div>
  );
}
