"use client";
import React, { useState, useEffect, useMemo } from "react";
import styles from "./OrdersSection.module.css";
import ordersConfig from "@/data/ui/ordersConfig.json";
import { auth } from "@/lib/firebaseClient";
import toast from "react-hot-toast";

export default function OrdersSection() {
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [userPrimaryAddress, setUserPrimaryAddress] = useState("Belum diatur");

  // State untuk modal ulasan produk
  const [reviewModalOrder, setReviewModalOrder] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const currentUser = auth.currentUser;

  // 1. Muat Script Midtrans Snap secara dinamis
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

  // 2. Ambil data alamat & pesanan via API Route `/api/orders`
  const fetchUserOrders = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/orders?userId=${currentUser.uid}`);
      const result = await res.json();

      if (!res.ok)
        throw new Error(result.error || "Gagal memuat data pesanan.");

      setUserPrimaryAddress(result.primaryAddress || "Belum diatur");

      if (result.orders && result.orders.length > 0) {
        const formattedOrders = result.orders.map((item) => {
          const rawStatus = (item.status || "pending").toLowerCase();

          // Petakan status backend ke status UI
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

          // Ambil ringkasan nama produk dari array items jika ada, atau fallback ke properti tunggal
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
            status: item.status || "pending", // status asli dari database untuk stepper & badge
            mappedStatus: mappedStatus, // untuk tab filter
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
      fetchUserOrders();
    }
  }, [currentUser]);

  // 3. Filter & Search Logic
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

  // 4. Fungsi Re-Order Terintegrasi Midtrans Snap via API Route
  const handleReOrder = async (order) => {
    const toastId = toast.loading("Menyiapkan transaksi Midtrans...");
    try {
      if (!currentUser) throw new Error("Pengguna tidak terautentikasi.");

      const newOrderId =
        "XAR-RO-" + Math.floor(100000 + Math.random() * 900000);
      const targetAddress = order.shippingAddress || userPrimaryAddress;

      const res = await fetch("/api/midtrans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.uid,
          orderId: newOrderId,
          amount: Number(order.rawPrice),
          items:
            order.items.length > 0
              ? order.items
              : [
                  {
                    id: newOrderId,
                    price: Number(order.rawPrice),
                    quantity: 1,
                    name: order.name,
                  },
                ],
        }),
      });

      const result = await res.json();
      if (!res.ok)
        throw new Error(
          result.error || "Gagal membuat sesi pembayaran Midtrans",
        );

      toast.dismiss(toastId);

      if (window.snap) {
        window.snap.pay(result.token, {
          onSuccess: async function (resultData) {
            toast.success("Pembayaran berhasil! Pesanan sedang diproses.");
            await saveOrderToServer(
              newOrderId,
              order,
              targetAddress,
              "success",
              resultData.payment_type,
            );
            fetchUserOrders();
          },
          onPending: async function (resultData) {
            toast("Menunggu pembayaran Anda...", { icon: "⏳" });
            await saveOrderToServer(
              newOrderId,
              order,
              targetAddress,
              "pending",
              resultData.payment_type || "Midtrans",
            );
            fetchUserOrders();
          },
          onError: function () {
            toast.error("Pembayaran gagal!");
          },
          onClose: function () {
            toast("Popup pembayaran ditutup.");
            fetchUserOrders();
          },
        });
      } else {
        throw new Error("Sistem pembayaran Midtrans belum siap.");
      }
    } catch (err) {
      console.error("Midtrans Error:", err);
      toast.error(err.message || "Gagal memproses pembayaran.", {
        id: toastId,
      });
    }
  };

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
      const firstItem = reviewModalOrder.items[0]; // Asumsi ulasan untuk item pertama

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
          productId: firstItem.id || reviewModalOrder.id, // Fallback ke order ID jika item ID tidak ada
          productName: firstItem.name || reviewModalOrder.name, // Fallback
          rating,
          comment,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Gagal mengirim ulasan.");
      }

      toast.success("Terima kasih! Ulasan Anda berhasil dikirim.", { id: toastId });
      setReviewModalOrder(null);
      setComment("");
      setRating(5);
      fetchUserOrders(); // Muat ulang data untuk update status tombol
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
              placeholder="Cari ID pesanan / nama parfum..."
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
                        Beri Ulasan
                      </button>
                    )}
                    {isFinished && order.hasBeenReviewed && (
                       <button className={styles.reviewBtnDisabled} disabled>
                         Ulasan Dikirim
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
                      onClick={() => window.open(`https://jet.co.id/track?hal=1&track_id=${selectedOrder.shippingReceiptNumber}`, '_blank')}
                      className={styles.trackButton}
                    >
                      Lacak Kiriman
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
                {ordersConfig.buttons.copyId}
              </button>
              <button
                onClick={() => handleDownloadInvoice(selectedOrder)}
                className={styles.modalActionBtn}
              >
                {ordersConfig.buttons.downloadInvoice}
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
              <h3 className={styles.modalTitle}>Beri Ulasan Produk</h3>
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
                <span className={styles.modalFieldLabel}>Produk</span>
                <strong>{reviewModalOrder.name}</strong>
              </div>
              <div>
                <span className={styles.modalFieldLabel}>Rating (Bintang)</span>
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  style={{
                    width: "100%",
                    background: "#18181b",
                    border: "1px solid #27272a",
                    color: "#fff",
                    padding: "8px",
                    borderRadius: "6px",
                  }}
                >
                  <option value={5}>⭐⭐⭐⭐⭐ (Sempurna - 5 Bintang)</option>
                  <option value={4}>⭐⭐⭐⭐ (Puas - 4 Bintang)</option>
                  <option value={3}>⭐⭐⭐ (Cukup - 3 Bintang)</option>
                  <option value={2}>⭐⭐ (Kurang - 2 Bintang)</option>
                  <option value={1}>⭐ (Buruk - 1 Bintang)</option>
                </select>
              </div>
              <div>
                <span className={styles.modalFieldLabel}>Komentar Ulasan</span>
                <textarea
                  rows={3}
                  required
                  placeholder="Bagaimana aroma dan ketahanan parfum pilihan Anda?"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#18181b",
                    border: "1px solid #27272a",
                    color: "#fff",
                    padding: "8px",
                    borderRadius: "6px",
                    resize: "none",
                  }}
                />
              </div>
              <button type="submit" className={styles.modalCloseActionBtn} disabled={isSubmittingReview}>
                {isSubmittingReview ? "Mengirim..." : "Kirim Ulasan"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
