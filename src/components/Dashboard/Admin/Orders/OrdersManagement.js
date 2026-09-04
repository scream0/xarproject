"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { auth, db } from "@/lib/supabaseClient";
import styles from "./OrdersManagement.module.css";
import { Logo } from "@/components/UI/Logo/logo";
import AdminReturns from "./AdminReturns";
import AdminWithdrawals from "./AdminWithdrawals";

const money = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const orderValue = (order) => Number(order.amount || order.total_amount || order.total || 0);

export default function OrdersManagement({ onOrderUpdate }) {
  const [orders, setOrders] = useState([]);
  const [storeSettings, setStoreSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalOrders: 0 });
  const [updatingId, setUpdatingId] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [adminTab, setAdminTab] = useState('orders'); // 'orders', 'returns', 'withdrawals'
  const [shippingDraft, setShippingDraft] = useState({ courierName: "", serviceType: "", trackingNumber: "" });
  const [shippingMode, setShippingMode] = useState("auto"); // "auto" | "manual"
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("processing");
  const [printOrders, setPrintOrders] = useState([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [printType, setPrintType] = useState("slip");
  const [pendingReturnsCount, setPendingReturnsCount] = useState(0);

  const fetchReturnsCount = async () => {
    try {
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/returns", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (data.returns) {
        const count = data.returns.filter(r => r.status === 'return_requested' || r.status === 'pending').length;
        setPendingReturnsCount(count);
      }
    } catch (error) {
      console.error("Failed to fetch returns count", error);
    }
  };

  useEffect(() => {
    fetchReturnsCount();
  }, []);

  const getAddressStr = (addr) => {
    if (!addr) return "Alamat tidak tersedia";
    if (typeof addr === "string") return addr;
    if (addr.address) return addr.address;
    const parts = [];
    if (addr.street) parts.push(addr.street);
    if (addr.city) parts.push(addr.city);
    if (addr.province) parts.push(addr.province);
    if (addr.postalCode) parts.push(addr.postalCode);
    return parts.join(", ") || "Alamat tidak tersedia";
  };

  // Helper untuk mendapatkan token Supabase yang sedang aktif
  const getSupabaseToken = async () => {
    const { data: { session } } = await auth.getSession();
    return session?.access_token || null;
  };

  const loadOrders = async (targetPage = page, targetStatus = statusFilter, targetSearch = searchTerm) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(targetPage), limit: "10" });
      if (targetStatus && targetStatus !== "all") params.set("status", targetStatus);
      if (targetSearch.trim()) params.set("search", targetSearch.trim());

      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/orders?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(data.error || "Unable to load orders");
      setOrders(data.orders || []);
      setPagination(data.pagination || { currentPage: 1, totalPages: 1, totalOrders: 0 });
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrders(1, statusFilter, searchTerm);

    const loadSettings = async () => {
      try {
        const { getPublicSettings } = await import("@/services/settingsService");
        const settings = await getPublicSettings();
        setStoreSettings(settings);
      } catch (e) {
        console.error("Failed to load settings in OrdersManagement", e);
      }
    };
    loadSettings();

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    // Subscribe to realtime updates for ALL orders (Admin Dashboard)
    const channel = db.channel('admin-orders-updates')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          console.log('[Supabase Realtime Admin] Tabel orders berubah:', payload);
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updated = payload.new;
            
            // Update orders list in-place (Anti-DDOS)
            setOrders(prevOrders => prevOrders.map(o => 
              (o.id === updated.id || o.orderId === updated.id) 
                ? { 
                    ...o, 
                    status: updated.status, 
                    tracking_history: updated.tracking_history, 
                    status_history: updated.status_history,
                    waybill_id: updated.waybill_id || o.waybill_id,
                    shipping_receipt_number: updated.shipping_receipt_number || o.shipping_receipt_number,
                    courier_tracking_link: updated.courier_tracking_link || o.courier_tracking_link,
                    shipping_detail: updated.shipping_detail || o.shipping_detail
                  } 
                : o
            ));
            
            // Auto update drawer if activeOrder is the one changed
            setActiveOrder(prevActive => {
              if (prevActive && (prevActive.id === updated.id || prevActive.orderId === updated.id)) {
                const merged = { 
                  ...prevActive, 
                  ...updated,
                  tracking_history: updated.tracking_history || prevActive.tracking_history,
                  status_history: updated.status_history || prevActive.status_history,
                };
                
                // Also update shipping draft trackingNumber if empty or updated
                if (updated.waybill_id || updated.shipping_receipt_number) {
                  setShippingDraft(draft => ({
                    ...draft,
                    trackingNumber: updated.waybill_id || updated.shipping_receipt_number || draft.trackingNumber
                  }));
                }
                
                return merged;
              }
              return prevActive;
            });

            const orderLabel = updated.order_number || (updated.id ? updated.id.substring(0,8) : "");
            toast.success(`Riwayat pengiriman pesanan ${orderLabel} diperbarui secara realtime!`, { id: `rt-admin-track-${updated.id}` });
          } else {
            // For new order inserts, refresh current view
            loadOrders(page, statusFilter, searchTerm);
            fetchReturnsCount();
          }
          // Always refresh returns count on any order change (in case status changed to/from return_requested)
          if (payload.eventType === 'UPDATE') {
            fetchReturnsCount();
          }
        }

      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [page, statusFilter, searchTerm]);

  useEffect(() => {
    const currentOrderId = activeOrder?.id || activeOrder?.orderId;
    if (!currentOrderId) return;

    // Dedicated realtime subscription for the currently open order drawer
    const activeOrderChannel = db.channel(`admin-active-order-${currentOrderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${currentOrderId}`
        },
        (payload) => {
          console.log('[Supabase Realtime Admin Active Order] Perubahan:', payload);
          if (payload.new) {
            const updated = payload.new;
            setActiveOrder(prev => ({
              ...prev,
              ...updated,
              tracking_history: updated.tracking_history || prev?.tracking_history || [],
              status_history: updated.status_history || prev?.status_history || [],
              waybill_id: updated.waybill_id || prev?.waybill_id,
              shipping_receipt_number: updated.shipping_receipt_number || prev?.shipping_receipt_number,
              courier_tracking_link: updated.courier_tracking_link || prev?.courier_tracking_link,
              shipping_detail: updated.shipping_detail || prev?.shipping_detail,
            }));

            if (updated.waybill_id || updated.shipping_receipt_number) {
              setShippingDraft(draft => ({
                ...draft,
                trackingNumber: updated.waybill_id || updated.shipping_receipt_number || draft.trackingNumber
              }));
            }

            toast.success("Riwayat pengiriman pesanan aktif diperbarui realtime!", { id: `rt-active-${currentOrderId}` });
          }
        }
      )
      .subscribe();

    return () => {
      db.removeChannel(activeOrderChannel);
    };
  }, [activeOrder?.id, activeOrder?.orderId]);

  const handleSearch = (event) => {
    event.preventDefault();
    loadOrders(1, statusFilter, searchTerm);
    setPage(1);
  };

  const openOrderDetails = async (order) => {
    try {
      const orderId = order.id || order.orderId;
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/orders/${orderId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});

      const activeData = (res.ok && data.order) ? data.order : order;
      setActiveOrder(activeData);

      const shippingInfo = data.shipping || activeData.shipping_detail || activeData.shippingDetail || activeData.shipping_details?.[0] || {};
      
      const resiValue =
        activeData.waybill_id ||
        activeData.shipping_receipt_number ||
        shippingInfo.tracking_number ||
        shippingInfo.trackingNumber ||
        shippingInfo.waybill_id ||
        activeData.waybillId ||
        activeData.shippingReceiptNumber ||
        "";

      const courierVal =
        shippingInfo.courier_name ||
        shippingInfo.courierName ||
        activeData.courier_name ||
        activeData.courier ||
        "";

      const serviceVal =
        shippingInfo.service_type ||
        shippingInfo.serviceType ||
        activeData.courier_service ||
        "";

      setShippingDraft({
        courierName: courierVal,
        serviceType: serviceVal,
        trackingNumber: resiValue,
      });

      if (activeData.biteship_order_id || (activeData.waybill_id && !activeData.shipping_receipt_number)) {
        setShippingMode("auto");
      } else if (activeData.shipping_receipt_number) {
        setShippingMode("manual");
      } else {
        setShippingMode(storeSettings?.biteshipAutoOrder ? "auto" : "manual");
      }
    } catch (e) {
      setActiveOrder(order);
      const shippingInfo = order.shipping_detail || order.shippingDetail || {};
      const resiValue = order.waybill_id || order.shipping_receipt_number || shippingInfo.tracking_number || shippingInfo.trackingNumber || "";
      setShippingDraft({
        courierName: shippingInfo.courier_name || order.courier_name || "",
        serviceType: shippingInfo.service_type || order.courier_service || "",
        trackingNumber: resiValue,
      });
    }
  };

  const updateOrderStatusAdmin = async (orderId, targetStatus, note) => {
    try {
      setUpdatingId(orderId);
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          status: targetStatus,
          notes: note || `Status diubah menjadi ${targetStatus} oleh admin`,
        }),
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status pesanan");

      toast.success(`Status pesanan berhasil diubah menjadi ${targetStatus}.`);
      
      setOrders((items) => items.map((item) => {
        if (item.id === orderId || item.orderId === orderId) {
          return { ...item, status: targetStatus };
        }
        return item;
      }));

      if (activeOrder && (activeOrder.id === orderId || activeOrder.orderId === orderId)) {
        setActiveOrder((prev) => ({ ...prev, status: targetStatus }));
      }

      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Gagal mengubah status pesanan.");
    } finally {
      setUpdatingId(null);
    }
  };

  const saveShipping = async (order) => {
    const orderId = order.id || order.orderId;
    try {
      setUpdatingId(orderId);
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/orders/${orderId}/shipping`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          courierName: shippingDraft.courierName,
          serviceType: shippingDraft.serviceType,
          trackingNumber: shippingDraft.trackingNumber,
          shippingAddress: order.shipping_address || order.shippingAddress || null,
          recipientName: order.customerName || order.customer_name || null,
          phoneNumber: order.customerPhone || order.customer_phone || order.phone || null,
          status: "shipped",
        }),
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan informasi pengiriman");
      const updatedOrderData = { 
        ...order, 
        status: "shipped", 
        waybill_id: shippingDraft.trackingNumber || order.waybill_id || null,
        shipping_receipt_number: shippingDraft.trackingNumber || order.shipping_receipt_number || null,
        courier_name: shippingDraft.courierName || order.courier_name || null,
        courier_service: shippingDraft.serviceType || order.courier_service || null,
        shipping_detail: { 
          ...(order.shipping_detail || order.shippingDetail || {}), 
          courier_name: shippingDraft.courierName || null, 
          service_type: shippingDraft.serviceType || null, 
          tracking_number: shippingDraft.trackingNumber || null 
        } 
      };
      setOrders((items) => items.map((item) => (item.id === orderId || item.orderId === orderId ? updatedOrderData : item)));
      setActiveOrder(updatedOrderData);
      toast.success("Informasi pengiriman berhasil disimpan.");
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to save shipping info.");
    } finally {
      setUpdatingId(null);
    }
  };

  const requestBiteshipPickup = async (orderId) => {
    try {
      setUpdatingId(orderId);
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/biteship/order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ orderId }),
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(data.error || "Gagal request pickup Biteship");
      
      toast.success(data.message || "Pickup berhasil di-request dan resi telah keluar.");
      
      // Update local state
      const bID = data.data?.biteshipOrderId || data.id || data.biteship_order_id || "";
      const waybill = data.data?.waybillId || data.waybill_id || data.tracking_number || "";
      const trackLink = data.data?.trackingLink || data.courier_tracking_link || "";

      const updatedOrderData = {
        ...activeOrder,
        status: "shipped",
        biteship_order_id: bID,
        waybill_id: waybill,
        courier_tracking_link: trackLink,
        shipping_detail: {
          ...(activeOrder.shipping_detail || {}),
          tracking_number: waybill,
        }
      };
      
      setShippingDraft((prev) => ({
        ...prev,
        trackingNumber: waybill
      }));

      setOrders((items) => items.map((item) => (item.id === orderId || item.orderId === orderId ? updatedOrderData : item)));
      setActiveOrder(updatedOrderData);
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to request pickup.");
    } finally {
      setUpdatingId(null);
    }
  };

  const syncMidtransStatus = async (orderId) => {
    try {
      setUpdatingId(orderId);
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/orders/${orderId}/sync`, {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(data.error || "Gagal sinkronisasi status pembayaran");
      
      toast.success(data.message || "Status Midtrans berhasil di-sinkron.");
      
      // Update local state by forcing a reload to get fresh data
      loadOrders(page, statusFilter, searchTerm);
      
      // Attempt to immediately update modal
      if (data.status && activeOrder) {
        const updatedOrderData = {
          ...activeOrder,
          status: data.status
        };
        setActiveOrder(updatedOrderData);
      }
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to sync payment status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const syncBiteshipStatus = async (orderId) => {
    try {
      setUpdatingId(orderId);
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/orders/${orderId}/tracking/sync`, {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(data.error || "Gagal sinkronisasi status");
      
      toast.success(data.message || "Status berhasil disinkronkan.");
      
      const newStatus = data.data?.status || data.status || activeOrder?.status || "shipped";
      const newTrackingHistory = data.data?.trackingHistory || data.data?.tracking_history || activeOrder?.tracking_history || [];
      const newStatusHistory = data.data?.statusHistory || data.data?.status_history || activeOrder?.status_history || [];
      const newWaybill = data.data?.waybillId || activeOrder?.waybill_id || "";

      // Update local state
      const updatedOrderData = {
        ...activeOrder,
        status: newStatus,
        tracking_history: newTrackingHistory,
        status_history: newStatusHistory,
        waybill_id: newWaybill || activeOrder?.waybill_id,
        shipping_detail: {
          ...(activeOrder?.shipping_detail || {}),
          tracking_number: newWaybill || activeOrder?.shipping_detail?.tracking_number,
        }
      };
      
      setOrders((items) => items.map((item) => (item.id === orderId || item.orderId === orderId ? updatedOrderData : item)));
      setActiveOrder(updatedOrderData);
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to sync status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleOrderSelection = (orderId) => {
    setSelectedOrders((items) => (items.includes(orderId) ? items.filter((item) => item !== orderId) : [...items, orderId]));
  };

  const openPrintView = (type) => {
    if (!selectedOrders.length) {
      toast.error("Pilih setidaknya satu pesanan untuk mencetak.");
      return;
    }

    setPrintType(type);
    const printItems = orders.filter((order) => selectedOrders.includes(order.id || order.orderId));
    setPrintOrders(printItems);
  };

  const applyBulkStatus = async () => {
    if (!selectedOrders.length) {
      toast.error("Pilih setidaknya satu pesanan terlebih dahulu.");
      return;
    }

    setBulkUpdating(true);
    const toastId = toast.loading("Memperbarui status pesanan terpilih...");

    try {
      const token = await getSupabaseToken();
      const promises = selectedOrders.map(async (orderId) => {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/orders/${orderId}/status`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({ status: bulkStatus, changedBy: "admin" }),
        });
        const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
        if (!res.ok) throw new Error(data.error || "Gagal mengubah status pesanan");
        return orderId;
      });

      await Promise.all(promises);
      setOrders((items) => items.map((item) => {
        const orderId = item.id || item.orderId;
        return selectedOrders.includes(orderId) ? { ...item, status: bulkStatus } : item;
      }));
      setSelectedOrders([]);
      toast.success("Status pesanan massal berhasil diperbarui.", { id: toastId });
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to update selected orders.", { id: toastId });
    } finally {
      setBulkUpdating(false);
    }
  };

  const updateStatus = async (orderId, nextStatus) => {
    try {
      setUpdatingId(orderId);
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ status: nextStatus, changedBy: "admin" }),
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status pesanan");
      setOrders((items) => items.map((item) => (item.id === orderId || item.orderId === orderId ? { ...item, status: nextStatus } : item)));
      toast.success("Status pesanan berhasil diperbarui.");
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to update order status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const [runningAutomation, setRunningAutomation] = useState(false);

  const handleRunAutomation = async () => {
    try {
      setRunningAutomation(true);
      const token = await getSupabaseToken();
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiBase}/api/admin/orders/run-automation`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Otomasi pesanan berhasil dijalankan!");
        loadOrders();
      } else {
        toast.error(data.error || "Gagal menjalankan otomasi pesanan.");
      }
    } catch (err) {
      toast.error(err.message || "Terjadi kesalahan.");
    } finally {
      setRunningAutomation(false);
    }
  };

  return (
    <section className={styles.wrapper}>
      <div className={styles.header} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <p className={styles.eyebrow}>Manajemen Pesanan</p>
          <h2 className={styles.title}>Lacak setiap pesanan, status, dan pengiriman di satu tempat.</h2>
        </div>
        <button
          onClick={handleRunAutomation}
          disabled={runningAutomation}
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-color)",
            color: "var(--text-primary)",
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: runningAutomation ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s"
          }}
          title="Batalkan otomatis pesanan belum bayar >24 jam dan selesaikan pesanan terkirim >14 hari"
        >
          <span>{runningAutomation ? "⏳ Memproses..." : "⚡ Jalankan Otomasi Pesanan"}</span>
        </button>
      </div>
      
      <div className={styles.adminTabs}>
        <button 
          className={`${styles.tabBtn} ${adminTab === 'orders' ? styles.activeTab : ''}`}
          onClick={() => setAdminTab('orders')}
        >
          Daftar Pesanan
        </button>
        <button 
          className={`${styles.tabBtn} ${adminTab === 'returns' ? styles.activeTab : ''}`}
          onClick={() => setAdminTab('returns')}
          style={{ position: 'relative' }}
        >
          Pengembalian Dana (Refund)
          {pendingReturnsCount > 0 && (
            <span className={styles.tabBadge}>{pendingReturnsCount}</span>
          )}
        </button>
        <button 
          className={`${styles.tabBtn} ${adminTab === 'withdrawals' ? styles.activeTab : ''}`}
          onClick={() => setAdminTab('withdrawals')}
        >
          Penarikan (Withdrawals)
        </button>
      </div>

      {adminTab === 'orders' && (
        <>
          <div className={styles.controls}>
            <form onSubmit={handleSearch} className={styles.searchForm}>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Cari ID pesanan atau pelanggan"
                aria-label="Search orders"
              />
              <button className={styles.searchButton} type="submit">Cari</button>
            </form>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={styles.filterSelect}>
            <option value="all">Semua status</option>
            <option value="pending">Menunggu</option>
            <option value="verifying">Menunggu Verifikasi</option>
            <option value="paid">Dibayar</option>
            <option value="processing">Diproses</option>
            <option value="shipped">Dikirim</option>
            <option value="delivered">Selesai</option>
            <option value="return_requested">Pengajuan Return</option>
            <option value="returning">Return Dikirim</option>
            <option value="returned">Return Selesai</option>
            <option value="cancelled">Dibatalkan</option>
          </select>
          <button className={styles.refreshButton} onClick={() => loadOrders(page, statusFilter, searchTerm)}>
            Segarkan
          </button>
        </div>

      <div className={styles.summaryBar}>
        <span>{pagination.totalOrders} pesanan</span>
        <span>Halaman {pagination.currentPage} dari {pagination.totalPages}</span>
      </div>

      <div className={styles.bulkBar}>
        <label className={styles.bulkLabel}>
          <input type="checkbox" checked={selectedOrders.length > 0 && selectedOrders.length === orders.length} onChange={() => setSelectedOrders(selectedOrders.length === orders.length ? [] : orders.map((order) => order.id || order.orderId))} />
          Pilih semua
        </label>
        <select className={styles.statusSelect} value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
          <option value="pending">Menunggu</option>
          <option value="verifying">Menunggu Verifikasi</option>
          <option value="paid">Dibayar</option>
          <option value="processing">Diproses</option>
          <option value="shipped">Dikirim</option>
          <option value="delivered">Selesai</option>
          <option value="return_requested">Pengajuan Return</option>
          <option value="returning">Return Dikirim</option>
          <option value="returned">Return Selesai</option>
          <option value="cancelled">Dibatalkan</option>
        </select>
        <button className={styles.refreshButton} onClick={applyBulkStatus} disabled={!selectedOrders.length || bulkUpdating}>
          {bulkUpdating ? "Memperbarui..." : "Terapkan status massal"}
        </button>
        <button className={styles.secondaryButton} onClick={() => openPrintView("slip")} disabled={!selectedOrders.length}>Cetak Slip Pengiriman</button>
        <button className={styles.secondaryButton} onClick={() => openPrintView("invoice")} disabled={!selectedOrders.length}>Cetak Faktur</button>
      </div>

      {loading ? (
        <p className={styles.empty}>Memuat pesanan…</p>
      ) : orders.length === 0 ? (
        <p className={styles.empty}>Tidak ada pesanan yang sesuai filter.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th><input type="checkbox" checked={selectedOrders.length > 0 && selectedOrders.length === orders.length} onChange={() => setSelectedOrders(selectedOrders.length === orders.length ? [] : orders.map((order) => order.id || order.orderId))} /></th>
                <th>Pesanan</th>
                <th>Pelanggan</th>
                <th>Total</th>
                <th>Status</th>
                <th>Pengiriman</th>
                <th>Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const orderId = order.id || order.orderId;
                const shippingInfo = order.shipping_detail || order.shippingDetail || order.shipping_details?.[0] || {};
                return (
                  <tr key={orderId}>
                    <td>
                      <input type="checkbox" checked={selectedOrders.includes(orderId)} onChange={() => toggleOrderSelection(orderId)} />
                    </td>
                    <td>
                      <div className={styles.orderCell}>
                        <button className={styles.linkButton} onClick={() => openOrderDetails(order)}>
                          <strong>
                            {order.order_number || order.orderId || orderId}
                            {["verifying", "pending", "paid"].includes(order.status) && <span className={styles.actionDot} title="Menunggu Proses / Konfirmasi"></span>}
                          </strong>
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className={styles.orderCell}>
                        <strong>{order.customer_name || order.shipping_address?.recipientName || "Pelanggan"}</strong>
                        <small>{order.customer_email || "Tidak ada email"}</small>
                      </div>
                    </td>
                    <td>{money(orderValue(order))}</td>
                    <td>
                      <select
                        className={styles.statusSelect}
                        value={order.status || "pending"}
                        onChange={(event) => updateOrderStatusAdmin(orderId, event.target.value)}
                        disabled={updatingId === orderId || bulkUpdating}
                      >
                        <option value="pending">Menunggu</option>
                        <option value="verifying">Menunggu Verifikasi</option>
                        <option value="paid">Dibayar</option>
                        <option value="processing">Diproses</option>
                        <option value="shipped">Dikirim</option>
                        <option value="delivered">Selesai</option>
                        <option value="return_requested">Pengajuan Return</option>
                        <option value="returning">Return Dikirim</option>
                        <option value="returned">Return Selesai</option>
                        <option value="cancelled">Dibatalkan</option>
                      </select>
                    </td>
                    <td>
                      <div className={styles.orderCell}>
                        <strong>{shippingInfo.courier_name || shippingInfo.courierName || order.courier_name || order.courier || "—"}</strong>
                        <small>{order.waybill_id || shippingInfo.tracking_number || shippingInfo.trackingNumber || order.shipping_receipt_number || "Belum ada resi"}</small>
                      </div>
                    </td>
                    <td>{new Date(order.createdAt || order.created_at || "1970-01-01").toLocaleDateString("id-ID")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.pagination}>
        <button disabled={page <= 1} onClick={() => { const nextPage = page - 1; setPage(nextPage); loadOrders(nextPage, statusFilter, searchTerm); }}>
          Sebelumnya
        </button>
        <span>Halaman {page}</span>
        <button disabled={page >= pagination.totalPages} onClick={() => { const nextPage = page + 1; setPage(nextPage); loadOrders(nextPage, statusFilter, searchTerm); }}>
          Selanjutnya
        </button>
      </div>

      {printOrders.length > 0 && (
        <div className={styles.drawerBackdrop} onClick={() => setPrintOrders([])}>
          <div className={styles.drawer} onClick={(event) => event.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div>
                <p className={styles.eyebrow}>Pratinjau cetak</p>
                <h3>{printType === "slip" ? "Slip Pengiriman" : "Faktur Belanja"}</h3>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className={styles.refreshButton} onClick={() => window.print()}>Cetak</button>
                <button className={styles.closeButton} onClick={() => setPrintOrders([])}>Tutup</button>
              </div>
            </div>
            <div className={styles.printPreview}>
              {printOrders.map((order) => {
                const orderId = order.id || order.orderId;
                const shippingInfo = order.shipping_detail || order.shippingDetail || order.shipping_details?.[0] || {};
                const alamat = order.shipping_address || order.shippingAddress;
                
                return (
                  <div key={orderId} className={styles.printCard}>
                    <div className={styles.printBrand}>
                      <div className={styles.printBrandLogo}>
                        <Logo />
                      </div>
                      <h1 className={styles.printBrandTitle}>make me kool</h1>
                    </div>
                    {printType === "invoice" ? (
                      <div style={{ position: "relative" }}>
                        {["paid", "processing", "shipped", "delivered"].includes(order.status) && (
                          <div style={{
                            position: "absolute",
                            top: "20px",
                            right: "35%",
                            transform: "rotate(-15deg)",
                            color: "#28a745",
                            border: "4px solid #28a745",
                            borderRadius: "8px",
                            padding: "0.5rem 1.5rem",
                            fontSize: "2.5rem",
                            fontWeight: "bold",
                            textTransform: "uppercase",
                            letterSpacing: "6px",
                            opacity: 0.5,
                            pointerEvents: "none",
                            zIndex: 10
                          }}>
                            LUNAS
                          </div>
                        )}
                        <div className={styles.printHeader}>
                          <div>
                            <strong>FAKTUR PENJUALAN</strong>
                            <p style={{ marginTop: "4px" }}>No. Pesanan: {order.order_number || order.orderId || orderId}</p>
                            <p>Tanggal: {new Date(order.createdAt || order.created_at || "1970-01-01").toLocaleDateString("id-ID")}</p>
                          </div>
                          <div className={styles.printMeta} style={{ textAlign: "right" }}>
                            <strong>Tagihan Kepada:</strong>
                            <p>{order.customer_name || alamat?.recipientName || "Pelanggan"}</p>
                            <p>{order.customer_email || "-"}</p>
                            <p>{alamat?.phone || order.customerPhone || order.customer_phone || order.phone || "-"}</p>
                          </div>
                        </div>
                        <div className={styles.printBody} style={{ marginBottom: "1rem" }}>
                          <p><b>Alamat Pengiriman:</b> {getAddressStr(alamat)}</p>
                          <p><b>Metode Pembayaran:</b> {order.payment_method || order.paymentMethod || "Transfer / VA"}</p>
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", marginBottom: "1rem" }}>
                          <thead>
                            <tr style={{ borderBottom: "2px solid #000" }}>
                              <th style={{ textAlign: "left", padding: "0.5rem 0" }}>Produk</th>
                              <th style={{ textAlign: "center", padding: "0.5rem 0" }}>Qty</th>
                              <th style={{ textAlign: "right", padding: "0.5rem 0" }}>Harga Satuan</th>
                              <th style={{ textAlign: "right", padding: "0.5rem 0" }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(order.items || []).map((item, index) => {
                              const itemPrice = Number(item.price_at_purchase || item.price) || 0;
                              const itemQty = Number(item.quantity || item.qty) || 1;
                              return (
                                <tr key={`${item.name}-${index}`} style={{ borderBottom: "1px solid #ddd" }}>
                                  <td style={{ padding: "0.5rem 0" }}>{item.name || item.product_name || "Produk"} {item.variant_name || item.size ? `(${item.variant_name || item.size})` : ""}</td>
                                  <td style={{ textAlign: "center", padding: "0.5rem 0" }}>{itemQty}</td>
                                  <td style={{ textAlign: "right", padding: "0.5rem 0" }}>{money(itemPrice)}</td>
                                  <td style={{ textAlign: "right", padding: "0.5rem 0" }}>{money(itemPrice * itemQty)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <div style={{ display: "flex", justifyContent: "flex-end", fontSize: "0.9rem" }}>
                          <div style={{ width: "250px" }}>
                            {(() => {
                              const subtotal = (order.items || []).reduce((sum, item) => sum + (Number(item.price_at_purchase || item.price) || 0) * (Number(item.quantity || item.qty) || 1), 0) || orderValue(order);
                              const grandTotal = orderValue(order);
                              const discount = Number(order.discount_amount || 0);
                              let shipping = Number(order.shipping_cost || order.shipping_fee || order.shippingFee || 0);
                              
                              // Jika ongkir di DB 0 tapi total tidak sama dengan subtotal, kemungkinan ongkir tidak tersimpan dengan baik
                              if (shipping === 0 && grandTotal > (subtotal - discount)) {
                                shipping = grandTotal - subtotal + discount;
                              }

                              return (
                                <>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                                    <span>Subtotal Produk:</span>
                                    <strong>{money(subtotal)}</strong>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                                    <span>Ongkos Kirim:</span>
                                    <strong>{money(shipping)}</strong>
                                  </div>
                                  {discount > 0 && (
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem", color: "#e11d48" }}>
                                      <span>Diskon:</span>
                                      <strong>-{money(discount)}</strong>
                                    </div>
                                  )}
                                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #000", paddingTop: "0.4rem", marginTop: "0.2rem" }}>
                                    <strong>Total Tagihan:</strong>
                                    <strong>{money(grandTotal)}</strong>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={styles.printHeader}>
                          <div>
                            <strong>{order.order_number || order.orderId || orderId}</strong>
                            <p>{order.customer_name || alamat?.recipientName || "Pelanggan"}</p>
                          </div>
                          <div className={styles.printMeta}>
                            <span>{new Date(order.createdAt || order.created_at || "1970-01-01").toLocaleDateString("id-ID")}</span>
                          </div>
                        </div>
                        <div className={styles.printBody}>
                          <p><b>Penerima:</b> {alamat?.recipientName || order.customer_name || "Pelanggan"}</p>
                          <p><b>No. HP:</b> {alamat?.phone || order.customerPhone || order.customer_phone || order.phone || "-"}</p>
                          <p><b>Alamat:</b> {getAddressStr(alamat)}</p>
                          <p><b>Kurir:</b> {shippingInfo.courier_name || shippingInfo.courierName || order.courier_name || order.courier || "—"} ({shippingInfo.service_type || shippingInfo.serviceType || order.courier_service || "-"})</p>
                          <p><b>Resi:</b> {order.waybill_id || shippingInfo.tracking_number || shippingInfo.trackingNumber || order.shipping_receipt_number || "Belum ada resi"}</p>
                        </div>
                        <div className={styles.printItems}>
                          {(order.items || []).map((item, index) => (
                            <div key={`${item.name}-${index}`} className={styles.itemRow}>
                              <span>{item.name || item.product_name || "Produk"} {item.variant_name || item.size ? `(${item.variant_name || item.size})` : ""}</span>
                              <strong>{item.quantity || item.qty || 1} pcs</strong>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeOrder && (() => {
        const orderStatus = String(activeOrder.status || "pending").toLowerCase();
        const isPaidOrProcessing = ["paid", "capture", "settlement", "processing", "shipped", "delivered", "completed"].includes(orderStatus);
        const isPending = ["pending", "unpaid"].includes(orderStatus);
        const isVerifying = orderStatus === "verifying";
        const isCancelled = ["cancelled", "canceled"].includes(orderStatus);
        
        const rawMethod = String(
          activeOrder.payment_method ||
          activeOrder.payment_type ||
          activeOrder.paymentMethod ||
          activeOrder.paymentType ||
          activeOrder.shipping_detail?.payment_method ||
          activeOrder.shippingDetail?.paymentMethod ||
          ""
        ).toLowerCase().trim();

        const hasPaymentProof = Boolean(
          activeOrder.shipping_detail?.payment_proof_url ||
          activeOrder.shippingDetail?.payment_proof_url ||
          activeOrder.payment_proof_url
        );

        // Deteksi dinamis: Transfer Manual hanya jika payment method secara spesifik adalah 'manual'
        const isManualPayment = rawMethod === "manual";

        const isMidtransGateway = !isManualPayment;

        const chosenCourier =
          activeOrder.courier_name ||
          activeOrder.courier ||
          activeOrder.shipping_detail?.courier_name ||
          activeOrder.shippingDetail?.courierName ||
          "";
        const chosenService =
          activeOrder.courier_service ||
          activeOrder.shipping_detail?.service_type ||
          activeOrder.shippingDetail?.serviceType ||
          "";
        const shippingCost =
          activeOrder.shipping_cost ||
          activeOrder.shippingCost ||
          activeOrder.shipping_detail?.shipping_cost ||
          activeOrder.shippingDetail?.shippingCost ||
          0;

        return (
        <div className={styles.drawerBackdrop} onClick={() => setActiveOrder(null)}>
          <div className={styles.drawer} onClick={(event) => event.stopPropagation()} style={{ maxWidth: "560px" }}>
            {/* 1. DRAWER HEADER */}
            <div className={styles.drawerHeader} style={{ paddingBottom: "0.85rem", borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <p className={styles.eyebrow} style={{ margin: 0 }}>
                  Detail Pesanan
                </p>
                <h3 style={{ margin: "4px 0 0", fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {activeOrder.order_number || activeOrder.orderId || activeOrder.id}
                </h3>
                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  {new Date(activeOrder.createdAt || activeOrder.created_at || Date.now()).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <button className={styles.closeButton} onClick={() => setActiveOrder(null)}>✕</button>
            </div>

            {/* 2. PROMINENT STATUS BAR */}
            <div className={styles.statusBanner}>
              <div>
                <span className={styles.statusBannerLabel}>Status Pesanan</span>
                <strong className={styles.statusBannerValue} style={{
                  color: isCancelled ? "var(--danger-color)" : (orderStatus === "delivered" ? "#059669" : (orderStatus === "shipped" ? "#7c3aed" : (isPaidOrProcessing ? "#059669" : "var(--text-secondary)")))
                }}>
                  {isCancelled && "⛔ Dibatalkan"}
                  {isVerifying && "🔍 Menunggu Verifikasi Struk"}
                  {isPending && "⏳ Belum Dibayar"}
                  {["paid", "processing"].includes(orderStatus) && "📦 Perlu Dikirim (Lunas)"}
                  {orderStatus === "shipped" && "🚚 Sedang Dikirim"}
                  {orderStatus === "delivered" && "✅ Pesanan Selesai"}
                  {!["cancelled", "verifying", "pending", "paid", "processing", "shipped", "delivered"].includes(orderStatus) && activeOrder.status}
                </strong>
              </div>

            </div>

            {/* 3. CONTEXTUAL E-COMMERCE ACTION BOX */}
            <div className={styles.actionBox}>
              <h4 className={styles.actionBoxHeader}>
                <span>⚡</span> Tindakan Operasional
              </h4>

              {/* TAHAP A: BELUM BAYAR / VERIFIKASI */}
              {(isPending || isVerifying) && (
                <div>
                  {isManualPayment ? (
                    <>
                      <p className={styles.actionBoxDesc}>
                        Pembeli memilih transfer manual ke rekening toko. Periksa struk lalu konfirmasi lunas untuk memproses.
                      </p>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => updateOrderStatusAdmin(activeOrder.id || activeOrder.orderId, "paid", "Pembayaran dikonfirmasi lunas oleh admin")}
                          disabled={updatingId === (activeOrder.id || activeOrder.orderId) || isPending}
                          className={styles.btnActionSuccess}
                          style={isPending ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                          title={isPending ? "Menunggu pembeli mengunggah bukti transfer" : ""}
                        >
                          ✅ Konfirmasi Pembayaran Lunas
                        </button>
                        <button
                          type="button"
                          onClick={() => updateOrderStatusAdmin(activeOrder.id || activeOrder.orderId, "cancelled", "Pesanan dibatalkan oleh admin")}
                          disabled={updatingId === (activeOrder.id || activeOrder.orderId)}
                          className={styles.btnActionDanger}
                        >
                          ❌ Batalkan Pesanan
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className={styles.actionBoxDesc}>
                        Pembayaran diproses otomatis oleh gerbang Midtrans. Tidak perlu konfirmasi manual.
                      </p>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => syncMidtransStatus(activeOrder.id || activeOrder.orderId)}
                          disabled={updatingId === (activeOrder.id || activeOrder.orderId)}
                          className={styles.btnActionOutline}
                          style={{ backgroundColor: "#eff6ff", color: "#2563eb", borderColor: "#bfdbfe" }}
                        >
                          {updatingId === (activeOrder.id || activeOrder.orderId) ? "Loading..." : "🔄 Cek Status Midtrans"}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateOrderStatusAdmin(activeOrder.id || activeOrder.orderId, "cancelled", "Pesanan dibatalkan oleh admin")}
                          disabled={updatingId === (activeOrder.id || activeOrder.orderId)}
                          className={styles.btnActionDanger}
                        >
                          ❌ Batalkan Pesanan
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAHAP B: PERLU DIKIRIM (LUNAS / PROCESSING) */}
              {["paid", "processing"].includes(orderStatus) && (
                <div>
                  <p className={styles.actionBoxDesc}>
                    Pembayaran lunas. Pilih metode pengiriman pesanan:
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px" }}>
                    {/* Opsi 1: Biteship Auto Pickup */}
                    {storeSettings?.biteshipAutoOrder && (
                      <div className={styles.actionOptionCard} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong style={{ fontSize: "0.85rem", display: "block", color: "var(--text-primary)" }}>🚚 Opsi 1: Pickup Otomatis (Biteship)</strong>
                          <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>Kurir menjemput ke alamat toko & resi terbit otomatis.</span>
                        </div>
                        <button
                          type="button"
                          className={styles.btnActionPrimary}
                          onClick={() => requestBiteshipPickup(activeOrder.id || activeOrder.orderId)}
                          disabled={updatingId === (activeOrder.id || activeOrder.orderId) || Boolean(activeOrder.biteship_order_id)}
                        >
                          {updatingId === (activeOrder.id || activeOrder.orderId) ? "Memproses..." : "Request Pickup"}
                        </button>
                      </div>
                    )}

                    {/* Opsi 2: Drop Outlet / Resi Manual */}
                    <div className={styles.actionOptionCard}>
                      <strong style={{ fontSize: "0.85rem", display: "block", marginBottom: "4px", color: "var(--text-primary)" }}>
                        {storeSettings?.biteshipAutoOrder ? "📦 Opsi 2: Antar ke Konter / Drop Outlet" : "📦 Antar ke Konter / Drop Outlet (Input Resi)"}
                      </strong>
                      <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "block", marginBottom: "8px" }}>
                        {storeSettings?.biteshipAutoOrder 
                          ? "Gunakan ini saat mengantar ke counter agen atau saldo Biteship kosong." 
                          : "Masukkan nomor resi fisik setelah menyerahkan paket ke kurir."}
                      </span>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <input
                          value={shippingDraft.trackingNumber}
                          onChange={(e) => setShippingDraft(prev => ({ ...prev, trackingNumber: e.target.value }))}
                          placeholder="Ketik nomor resi fisik dari struk counter..."
                          className={styles.drawerInput}
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          className={styles.btnActionSuccess}
                          onClick={() => saveShipping(activeOrder)}
                          disabled={updatingId === (activeOrder.id || activeOrder.orderId) || !shippingDraft.trackingNumber?.trim()}
                        >
                          {updatingId === (activeOrder.id || activeOrder.orderId) ? "Menyimpan..." : "Kirim Pesanan"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAHAP C: SEDANG DIKIRIM (SHIPPED) */}
              {orderStatus === "shipped" && (
                <div>
                  <div className={styles.actionOptionCard} style={{ marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block" }}>Nomor Resi Pengiriman:</span>
                      <strong style={{ fontSize: "0.95rem", color: "var(--text-primary)" }}>{activeOrder.waybill_id || activeOrder.shipping_receipt_number || shippingDraft.trackingNumber || "Belum ada resi"}</strong>
                    </div>
                    {activeOrder.courier_tracking_link && (
                      <a
                        href={activeOrder.courier_tracking_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: "0.8rem", color: "var(--text-primary)", fontWeight: 600, textDecoration: "underline" }}
                      >
                        📍 Lacak Paket ↗
                      </a>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {activeOrder.biteship_order_id && (
                      <button
                        type="button"
                        className={styles.btnActionOutline}
                        onClick={() => syncBiteshipStatus(activeOrder.id || activeOrder.orderId)}
                        disabled={updatingId === (activeOrder.id || activeOrder.orderId)}
                      >
                        {updatingId === (activeOrder.id || activeOrder.orderId) ? "Menyinkronkan..." : "🔄 Sinkron Status Kurir"}
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.btnActionSuccess}
                      onClick={() => updateOrderStatusAdmin(activeOrder.id || activeOrder.orderId, "delivered", "Pesanan ditandai selesai oleh admin")}
                      disabled={updatingId === (activeOrder.id || activeOrder.orderId)}
                    >
                      ✅ Tandai Selesai (Delivered)
                    </button>
                  </div>
                </div>
              )}

              {/* TAHAP D: FINAL (DELIVERED / CANCELLED) */}
              {["delivered", "cancelled", "returned"].includes(orderStatus) && (
                <p className={styles.actionBoxDesc} style={{ margin: 0, fontStyle: "italic" }}>
                  Pesanan telah berada pada status final ({orderStatus === "delivered" ? "Selesai" : "Dibatalkan"}). Tidak diperlukan tindakan operasional lebih lanjut.
                </p>
              )}
            </div>

            {/* 4. INFORMASI PENGIRIMAN & ALAMAT */}
            <div className={styles.drawerCard} style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h4 style={{ margin: 0 }}>Penerima & Alamat Pengiriman</h4>
                <span style={{ fontSize: "0.75rem", padding: "3px 8px", borderRadius: "8px", background: "var(--surface-secondary)", border: "1px solid var(--border-color)", fontWeight: 600, color: "var(--text-secondary)" }}>
                  {(chosenCourier || "Kurir").toUpperCase()} {chosenService ? `(${chosenService})` : ""}
                </span>
              </div>
              <p style={{ margin: "0 0 2px 0", fontWeight: 600, fontSize: "0.88rem", color: "var(--text-primary)" }}>{activeOrder.customer_name || "Pelanggan"}</p>
              <p style={{ margin: "0 0 6px 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                {activeOrder.customer_phone ? `📞 ${activeOrder.customer_phone} • ` : ""}{activeOrder.customer_email || "Tidak ada email"}
              </p>
              {(activeOrder.shipping_address || activeOrder.shippingAddress) && (
                <div className={styles.addressBox}>
                  📍 {getAddressStr(activeOrder.shipping_address || activeOrder.shippingAddress)}
                </div>
              )}
            </div>

            {/* 5. RINCIAN PRODUK & PEMBAYARAN */}
            <div className={styles.drawerCard}>
              <h4 style={{ margin: "0 0 10px 0" }}>Rincian Barang & Pembayaran</h4>
              
              {/* Item List */}
              {activeOrder.items && activeOrder.items.length > 0 && (
                <div style={{ marginBottom: "10px", borderBottom: "1px dashed var(--border-color)", paddingBottom: "8px" }}>
                  {activeOrder.items.map((item, index) => (
                    <div key={`${item.name}-${index}`} className={styles.itemRow} style={{ padding: "6px 0", fontSize: "0.85rem" }}>
                      <span style={{ color: "var(--text-primary)" }}>{item.name || item.product_name || "Produk"} {item.variant_name ? `(${item.variant_name})` : ""}</span>
                      <strong style={{ color: "var(--text-primary)" }}>{item.quantity || item.qty || 1} × {money(item.price || item.price_at_purchase || 0)}</strong>
                    </div>
                  ))}
                </div>
              )}

              {/* Rincian Biaya */}
              <div style={{ fontSize: "0.82rem", display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)" }}>
                  <span>Ongkos Kirim:</span>
                  <span style={{ color: "var(--text-primary)" }}>{shippingCost > 0 ? money(shippingCost) : "Gratis"}</span>
                </div>
                {activeOrder.discount_amount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#059669" }}>
                    <span>Diskon:</span>
                    <span>- {money(activeOrder.discount_amount)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "0.95rem", marginTop: "4px", paddingTop: "6px", borderTop: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                  <span>Total Pembayaran:</span>
                  <span style={{ color: "var(--text-primary)" }}>{money(orderValue(activeOrder))}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  <span>Metode: <strong style={{ color: "var(--text-primary)" }}>{isManualPayment ? "Transfer Manual (Rekening Toko)" : (activeOrder.payment_method || activeOrder.payment_type || "Midtrans Otomatis")}</strong></span>
                  {hasPaymentProof && (
                    <a
                      href={activeOrder.shipping_detail?.payment_proof_url || activeOrder.shippingDetail?.payment_proof_url || activeOrder.payment_proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.btnActionOutline}
                      style={{ padding: "4px 8px", fontSize: "0.75rem", textDecoration: "none" }}
                    >
                      📄 Lihat Struk ↗
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* 6. RIWAYAT LOG STATUS / TRACKING */}
            {(() => {
              if (!activeOrder) return null;
              const history = [];

              if (activeOrder.status_history && Array.isArray(activeOrder.status_history)) {
                activeOrder.status_history.forEach((sh, index) => {
                  const changedAt = sh.created_at || sh.createdAt || sh.timestamp || sh.updated_at || new Date().toISOString();
                  history.push({
                    key: `status-${changedAt}-${index}`,
                    timestamp: new Date(changedAt).getTime(),
                    timestampStr: new Date(changedAt).toLocaleString("id-ID"),
                    label: sh.status,
                    note: sh.note || sh.notes || "Diperbarui oleh sistem",
                    isWebhook: false
                  });
                });
              }

              if (activeOrder.tracking_history && Array.isArray(activeOrder.tracking_history)) {
                activeOrder.tracking_history.forEach((th, index) => {
                  const changedAt = th.timestamp || th.updated_at || th.created_at || new Date().toISOString();
                  history.push({
                    key: `track-${changedAt}-${index}`,
                    timestamp: new Date(changedAt).getTime(),
                    timestampStr: new Date(changedAt).toLocaleString("id-ID"),
                    label: th.status || th.event || "Update Kurir",
                    note: th.note || th.details?.history?.[0]?.note || "Lokasi/Status diperbarui kurir",
                    isWebhook: true
                  });
                });
              }

              history.sort((a, b) => b.timestamp - a.timestamp);

              if (history.length === 0) return null;

              return (
                <div className={styles.drawerCard} style={{ marginTop: '0.75rem' }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "0.85rem" }}>Riwayat Status & Pengiriman</h4>
                  <div className={styles.timeline}>
                    {history.map((item) => (
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
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      );
    })()}
        </>
      )}

      {adminTab === 'returns' && (
        <AdminReturns />
      )}

      {adminTab === 'withdrawals' && (
        <AdminWithdrawals />
      )}
    </section>
  );
}