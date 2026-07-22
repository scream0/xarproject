"use client";
import React, { useState, useEffect } from "react";
import styles from "./OrdersSection.module.css";
import ordersConfig from "@/data/ui/ordersConfig.json";
import { supabase } from "@/lib/supabaseClient";
import { auth } from "@/lib/firebaseClient";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import toast from "react-hot-toast";

const db = getFirestore();

export default function OrdersSection() {
  const [filter, setFilter] = useState("all");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [userPrimaryAddress, setUserPrimaryAddress] = useState("Belum diatur");

  const currentUser = auth.currentUser;

  // 1. Muat Script Midtrans Snap secara dinamis saat komponen dirender
  useEffect(() => {
    const snapScriptUrl = "https://app.sandbox.midtrans.com/snap/snap.js"; // Ubah ke production jika sudah live: https://app.midtrans.com/snap/snap.js
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ""; // Masukkan client key dari env

    if (!document.getElementById("midtrans-snap-script")) {
      const script = document.createElement("script");
      script.id = "midtrans-snap-script";
      script.src = snapScriptUrl;
      script.setAttribute("data-client-key", clientKey);
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // 2. Ambil data alamat utama user dari database
  useEffect(() => {
    async function fetchUserPrimaryAddress() {
      if (!currentUser) return;
      try {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (
            data.addresses &&
            Array.isArray(data.addresses) &&
            data.addresses.length > 0
          ) {
            const primary =
              data.addresses.find((a) => a.isPrimary) || data.addresses[0];
            const formattedAddress = `${primary.label} - ${primary.recipientName} (${primary.recipientPhone}): ${primary.street}, ${primary.city} (${primary.postalCode})`;
            setUserPrimaryAddress(formattedAddress);
          } else if (data.shipping_address) {
            setUserPrimaryAddress(data.shipping_address);
          }
        }
      } catch (err) {
        console.error("Gagal memuat alamat utama:", err);
      }
    }
    fetchUserPrimaryAddress();
  }, [currentUser]);

  // 3. Ambil data pesanan (Orders) dari Supabase Database
  const fetchUserOrders = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", currentUser.uid)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const formattedOrders = data.map((item) => {
          let mappedStatus = "processing";
          const rawStatus = item.transaction_status || item.status || "";

          if (
            ["settlement", "capture", "completed", "success"].includes(
              rawStatus.toLowerCase(),
            )
          ) {
            mappedStatus = "completed";
          } else if (["pending", "waiting"].includes(rawStatus.toLowerCase())) {
            mappedStatus = "processing";
          } else {
            mappedStatus = rawStatus.toLowerCase() || "processing";
          }

          const orderAddress =
            item.shipping_address || item.address || userPrimaryAddress;

          return {
            id: item.order_id || item.id_order || item.id,
            name:
              item.product_name ||
              item.name ||
              "Extrait de Parfum - Custom Blend",
            concentration: item.concentration || "30% Bibit (50 ml)",
            notes: item.notes || "-",
            price:
              item.gross_amount || item.price
                ? `Rp ${Number(item.gross_amount || item.price).toLocaleString("id-ID")}`
                : "Rp 0",
            rawPrice: item.gross_amount || item.price || 0,
            status: mappedStatus,
            date: item.created_at
              ? new Date(item.created_at).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Hari ini",
            paymentMethod:
              item.payment_type || "Midtrans QRIS / Virtual Account",
            shippingAddress: orderAddress,
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
  }, [currentUser, userPrimaryAddress]);

  // 4. Fungsi Re-Order Terintegrasi Midtrans Snap
  const handleReOrder = async (order) => {
    const toastId = toast.loading("Menyiapkan transaksi Midtrans...");
    try {
      if (!currentUser) throw new Error("Pengguna tidak terautentikasi.");

      const newOrderId =
        "MMK-RO-" + Math.floor(100000 + Math.random() * 900000);
      const targetAddress = order.shippingAddress || userPrimaryAddress;

      // Panggil API backend Next.js untuk mendapatkan Snap Token Midtrans
      const res = await fetch("/api/midtrans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: newOrderId,
          amount: order.rawPrice,
          productName: order.name,
          customerDetails: {
            first_name: currentUser.displayName || "Customer",
            email: currentUser.email,
            phone: currentUser.phoneNumber || "08123456789",
          },
        }),
      });

      const result = await res.json();
      if (!res.ok)
        throw new Error(
          result.error || "Gagal membuat sesi pembayaran Midtrans",
        );

      toast.dismiss(toastId);

      // Buka Pop-up Pembayaran Midtrans Snap
      if (window.snap) {
        window.snap.pay(result.token, {
          onSuccess: async function (resultData) {
            toast.success("Pembayaran berhasil! Pesanan sedang diproses.");
            // Simpan ke database Supabase dengan status sukses
            await saveOrderToSupabase(
              newOrderId,
              order,
              targetAddress,
              "settlement",
              resultData.payment_type,
            );
            fetchUserOrders();
          },
          onPending: async function (resultData) {
            toast("Menunggu pembayaran Anda...", { icon: "⏳" });
            await saveOrderToSupabase(
              newOrderId,
              order,
              targetAddress,
              "pending",
              resultData.payment_type || "Midtrans",
            );
            fetchUserOrders();
          },
          onError: function (resultData) {
            toast.error("Pembayaran gagal!");
          },
          onClose: function () {
            toast("Popup pembayaran ditutup.");
            fetchUserOrders();
          },
        });
      } else {
        throw new Error(
          "Sistem pembayaran Midtrans belum siap. Coba muat ulang halaman.",
        );
      }
    } catch (err) {
      console.error("Midtrans Error:", err);
      toast.error(err.message || "Gagal memproses pembayaran.", {
        id: toastId,
      });
    }
  };

  // Helper untuk menyimpan pesanan re-order ke Supabase setelah interaksi Midtrans
  const saveOrderToSupabase = async (
    orderId,
    order,
    address,
    status,
    paymentType,
  ) => {
    try {
      await supabase.from("orders").insert([
        {
          user_id: currentUser.uid,
          order_id: orderId,
          product_name: order.name,
          concentration: order.concentration,
          notes: order.notes,
          price: order.rawPrice,
          status: status,
          payment_type: paymentType,
          shipping_address: address,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (dbErr) {
      console.error("Gagal menyimpan ke database:", dbErr);
    }
  };

  const filteredOrders =
    filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className={styles.workspaceInner}>
      {/* Header & Filter Tabs */}
      <div className={`card ${styles.cardHeader}`}>
        <div>
          <h3 className={styles.headerTitle}>{ordersConfig.header.title}</h3>
          <p className={styles.headerSubtitle}>
            {ordersConfig.header.subtitle}
          </p>
        </div>
        <div className={styles.filterGroup}>
          {ordersConfig.tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`${styles.filterBtn} ${
                filter === tab ? styles.filterBtnActive : ""
              }`}
            >
              {tab}
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
            <p className={styles.emptyText}>{ordersConfig.emptyText}</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div key={order.id} className={`card ${styles.orderCard}`}>
              <div className={styles.orderInfoCol}>
                <div className={styles.orderIdRow}>
                  <span className={styles.orderIdText}>{order.id}</span>
                  <span
                    className={`${styles.statusBadge} ${
                      order.status === "completed"
                        ? styles.statusCompleted
                        : styles.statusProcessing
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
                <h4 className={styles.orderName}>{order.name}</h4>
                <p className={styles.orderSpec}>
                  Specification: {order.concentration}
                </p>
                <p className={styles.orderNotes}>Notes: {order.notes}</p>
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
                  <button
                    onClick={() => handleReOrder(order)}
                    className={styles.reorderBtn}
                  >
                    {ordersConfig.buttons.reorder}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* --- MODAL POPUP DETAIL PESANAN --- */}
      {selectedOrder && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{ordersConfig.modal.title}</h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className={styles.modalCloseBtn}
              >
                ✕
              </button>
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
                  {selectedOrder.concentration} | Notes: {selectedOrder.notes}
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
              <div className={styles.modalPriceRow}>
                <span className={styles.modalPriceLabel}>
                  {ordersConfig.labels.totalPaid}
                </span>
                <span className={styles.modalPriceValue}>
                  {selectedOrder.price}
                </span>
              </div>
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
    </div>
  );
}
