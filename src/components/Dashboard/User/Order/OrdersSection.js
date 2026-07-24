"use client";
import React, { useState, useEffect, useMemo } from "react";
import styles from "./OrdersSection.module.css";
import ordersConfig from "@/data/ui/ordersConfig.json";
import { auth } from "@/lib/firebaseClient";
import toast from "react-hot-toast";
import { useStore } from "@/context/StoreContext";

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

  // State untuk modal ulasan produk
  const [reviewModalOrder, setReviewModalOrder] = useState(null);
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

  // 3. Ambil data alamat & pesanan via API Route `/api/orders`
  const fetchUserOrders = async (user) => {
    if (!user) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/orders?userId=${user.uid}`);
      const result = await res.json();

      if (!res.ok)
        throw new Error(result.error || "Gagal memuat data pesanan.");

      setUserPrimaryAddress(result.primaryAddress || "Belum diatur");

      if (result.orders && result.orders.length > 0) {
        const formattedOrders = result.orders.map((item) => {
          const rawStatus = (item.status || "pending").toLowerCase();

          let mappedStatus = "processing";
          if (
            [
              "success",
              "completed",
              "settlement",
              "capture",
              "shipping",
            ].includes(rawStatus)
          ) {
            mappedStatus =
              rawStatus === "completed" ? "completed" : "processing";
          } else {
            mappedStatus = "processing";
          }

          let displayName =
            item.product_name || item.name || "Extrait de Parfum";
          if (
            item.items &&
            Array.isArray(item.items) &&
            item.items.length > 0
          ) {
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
            formattedAddress = result.primaryAddress;
          }

          const rawAmount = Number(
            item.amount || item.gross_amount || item.price || 0,
          );

          return {
            id: item.orderId || item.order_id || item.id,
            name: displayName,
            items: item.items || [],
            hasBeenReviewed: item.hasBeenReviewed || false,
            shippingReceiptNumber: item.shippingReceiptNumber || null,
            concentration:
              item.concentration ||
              (item.items?.[0]
                ? `Varian: ${item.items[0].size}`
                : "30% Bibit (50 ml)"),
            notes: item.notes || "-",
            price: `Rp ${rawAmount.toLocaleString("id-ID")}`,
            rawPrice: rawAmount,
            status: item.status || "pending",
            mappedStatus: mappedStatus,
            date:
              item.createdAt || item.created_at
                ? new Date(
                    item.createdAt || item.created_at,
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
        });
        setOrders(formattedOrders);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error("Gagal mengambil data pesanan:", err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchUserOrders(currentUser);
    }
  }, [currentUser]);

  // 4. Filter & Search Logic
  const filteredOrders = useMemo(() => {
    let result = orders;

    if (filter !== "all") {
      if (filter === "completed") {
        result = result.filter(
          (o) =>
            o.status === "completed" ||
            o.status === "success" ||
            o.status === "shipping",
        );
      } else {
        result = result.filter((o) => o.status === filter);
      }
    }

    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (o) =>
          o.id.toLowerCase().includes(query) ||
          o.name.toLowerCase().includes(query) ||
          o.concentration.toLowerCase().includes(query),
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
        // Opsional: Buka modal keranjang jika fungsi setIsCartOpen tersedia
        // setIsCartOpen(true);
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
  // fungsi menyimpan pesanan ke server
  const saveOrderToServer = async (
    orderId,
    order,
    address,
    status,
    paymentType,
  ) => {
    try {
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.uid,
          orderId,
          order: {
            name: order.name,
            rawPrice: order.rawPrice,
            concentration: order.concentration,
            notes: order.notes,
          },
          address,
          status,
          paymentType,
        }),
      });
    } catch (dbErr) {
      console.error("Gagal menyimpan ke database:", dbErr);
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
Status Pesanan   : ${order.status.toUpperCase()}
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

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewModalOrder || !currentUser || isSubmittingReview) {
      return;
    }

    setIsSubmittingReview(true);
    const toastId = toast.loading("Mengirim ulasan Anda...");

    try {
      const token = await currentUser.getIdToken();
      const firstItem = reviewModalOrder.items[0];

      if (!firstItem) {
        throw new Error("Produk dalam pesanan tidak ditemukan.");
      }

      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: currentUser.uid,
          orderId: reviewModalOrder.id,
          productId: firstItem.id || reviewModalOrder.id,
          productName: firstItem.name || reviewModalOrder.name,
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
      setComment("");
      setRating(5);
      fetchUserOrders(currentUser);
    } catch (error) {
      console.error("Gagal mengirim ulasan:", error);
      toast.error(error.message, { id: toastId });
    } finally {
      setIsSubmittingReview(false);
    }
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
            <svg
              style={{
                width: "16px",
                height: "16px",
                stroke: "currentColor",
                strokeWidth: 2,
                fill: "none",
                strokeLinecap: "round",
                strokeLinejoin: "round",
                color: "#71717a",
              }}
            >
              <use href="/assets/icon/feather-sprite.svg#search" />
            </svg>
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
          <div className={`card ${styles.centerStateCard}`}>
            <p className={styles.loadingText}>{ordersConfig.loadingText}</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className={`card ${styles.centerStateCard}`}>
            <svg
              style={{
                width: "36px",
                height: "36px",
                stroke: "currentColor",
                strokeWidth: 1.5,
                fill: "none",
                strokeLinecap: "round",
                strokeLinejoin: "round",
                color: "#71717a",
                marginBottom: "0.5rem",
              }}
            >
              <use href="/assets/icon/feather-sprite.svg#package" />
            </svg>
            <p className={styles.emptyText}>{ordersConfig.emptyText}</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const isFinished = ["completed", "success", "shipping"].includes(
              order.status,
            );
            return (
              <div key={order.id} className={`card ${styles.orderCard}`}>
                <div className={styles.orderInfoCol}>
                  <div className={styles.orderIdRow}>
                    <span className={styles.orderIdText}>{order.id}</span>
                    <span
                      className={`${styles.statusBadge} ${isFinished ? styles.statusCompleted : styles.statusProcessing}`}
                    >
                      {order.status.toUpperCase()}
                    </span>
                  </div>
                  <h4 className={styles.orderName}>{order.name}</h4>
                  <p className={styles.orderSpec}>
                    Spesifikasi: {order.concentration}
                  </p>
                  <p className={styles.orderNotes}>Catatan: {order.notes}</p>
                  <p className={styles.orderDate}>Tanggal: {order.date}</p>
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
                    {isFinished && !order.hasBeenReviewed && (
                      <button
                        onClick={() => setReviewModalOrder(order)}
                        className={styles.reviewBtn}
                      >
                        {ordersConfig.buttons.review}
                      </button>
                    )}
                    {isFinished && order.hasBeenReviewed && (
                      <button className={styles.reviewBtnDisabled} disabled>
                        {ordersConfig.buttons.reviewSent}
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
                <svg
                  style={{
                    width: "18px",
                    height: "18px",
                    stroke: "currentColor",
                    strokeWidth: 2,
                    fill: "none",
                  }}
                >
                  <use href="/assets/icon/feather-sprite.svg#x" />
                </svg>
              </button>
            </div>

            {/* Stepper Status Pelacakan Dinamis */}
            <div className={styles.trackingStepper}>
              <div className={styles.stepItemActive}>
                <div className={styles.stepDot}></div>
                <span>Dibuat</span>
              </div>
              <div
                className={
                  ["processing", "success", "shipping", "completed"].includes(
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
                  ["shipping", "completed"].includes(selectedOrder.status)
                    ? styles.stepItemActive
                    : styles.stepItem
                }
              >
                <div className={styles.stepDot}></div>
                <span>Dikirim / Selesai</span>
              </div>
            </div>

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

      {/* --- MODAL ULASAN PRODUK --- */}
      {reviewModalOrder && (
        <div
          className={styles.modalOverlay}
          onClick={() => setReviewModalOrder(null)}
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
                onClick={() => setReviewModalOrder(null)}
                className={styles.modalCloseBtn}
              >
                <svg
                  style={{
                    width: "18px",
                    height: "18px",
                    stroke: "currentColor",
                    strokeWidth: 2,
                    fill: "none",
                  }}
                >
                  <use href="/assets/icon/feather-sprite.svg#x" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className={styles.modalBody}>
              <div>
                <span className={styles.modalFieldLabel}>
                  {ordersConfig.labels.product}
                </span>
                <strong>{reviewModalOrder.name}</strong>
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
