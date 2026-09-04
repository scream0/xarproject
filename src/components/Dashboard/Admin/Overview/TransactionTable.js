"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import styles from "./TransactionTable.module.css";
import toast from "react-hot-toast";
import overviewConfig from "@/data/ui/overviewConfig.json";
import { auth, supabase } from "@/lib/supabaseClient";

const ORDERS_PER_PAGE = 15;

export default function TransactionTable() {
  // State for data and loading
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  // State for controls
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(ORDERS_PER_PAGE);
  const [savedViews, setSavedViews] = useState([]);

  const observer = useRef();

  const getAuthHeaders = async () => { const { data: { session } } = await auth.getSession(); return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}; };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const ordersRes = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/orders?limit=1000", { headers: await getAuthHeaders() });
      const ordersResult = (ordersRes.headers?.get("content-type")?.includes("application/json") ? await ordersRes.json() : {});

      const transactions = (
        ordersResult.data ||
        ordersResult.orders ||
        []
      ).sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
      );

      setAllOrders(transactions);
    } catch (error) {
      console.error("Gagal mengambil data pesanan:", error);
      toast.error("Gagal memuat data pesanan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrders();
    const storedViews = window.localStorage.getItem("mameko-order-views");
    if (storedViews) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSavedViews(JSON.parse(storedViews));
    }
  }, []);

  const formatRupiah = (number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(number);

  const getBadgeClass = (status) => {
    const statusMap = {
      success: styles.badgeSuccess,
      processing: styles.badgeProcessing,
      verifying: styles.badgeProcessing,
      shipped: styles.badgeShipping,
      shipping: styles.badgeShipping,
      cancelled: styles.badgeCancelled,
      completed: styles.badgeCompleted,
      pending: styles.badgePending,
    };
    return statusMap[status] || styles.badgePending;
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleCount(ORDERS_PER_PAGE);
  }, [statusFilter, searchTerm]);

  // Memoized filtered orders
  const filteredOrders = useMemo(() => {
    return allOrders
      .filter((order) => {
        if (statusFilter === "all") return true;
        const normalized = order.status === "success" ? "processing" : order.status === "shipping" ? "shipped" : order.status;
        return normalized === statusFilter;
      })
      .filter((order) => {
        const searchTermLower = searchTerm.toLowerCase();
        const customerName =
          order.customerName || order.shipping_address?.recipientName || "";
        return (
          (order.orderId || order.id)
            ?.toLowerCase()
            .includes(searchTermLower) ||
          customerName.toLowerCase().includes(searchTermLower)
        );
      });
  }, [allOrders, statusFilter, searchTerm]);

  const visibleOrders = filteredOrders.slice(0, visibleCount);

  const hasMore = visibleCount < filteredOrders.length;

  const saveCurrentView = () => { const label = searchTerm ? `${statusFilter}: ${searchTerm}` : statusFilter; const next = [...savedViews.filter((view) => view.label !== label), { label, status: statusFilter, search: searchTerm }].slice(-5); setSavedViews(next); window.localStorage.setItem("mameko-order-views", JSON.stringify(next)); toast.success("Filter view saved."); };
  const toggleOrder = (id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  const toggleVisible = () => { const ids = visibleOrders.map((order) => order.orderId || order.id); setSelectedIds((current) => ids.every((id) => current.includes(id)) ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])]); };
  const runBulkAction = async (from, to) => { const targets = allOrders.filter((order) => selectedIds.includes(order.orderId || order.id) && (order.status === from || (from === "processing" && order.status === "success"))); if (!targets.length) return toast.error(`Pilih pesanan berstatus ${from}.`); await Promise.all(targets.map((order) => handleUpdateOrder(order.orderId || order.id, to))); setSelectedIds([]); };

  const exportOrders = () => {
    const rows = filteredOrders.map((order) => [order.order_number || order.orderId || order.id, order.customerName || order.shipping_address?.recipientName || "Customer", Number(order.total_amount || order.amount || order.price || 0), order.status || "pending", order.createdAt || order.created_at || ""]);
    const csv = [["Order ID", "Customer", "Total", "Status", "Date"], ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a"); link.href = url; link.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className={styles.ordersSection}>
        <div className={styles.titleRow}>
          <h3 className={styles.sectionTitle}>{overviewConfig.ordersSection.title}</h3>
          <button className={styles.exportBtn} onClick={exportOrders}>Export CSV</button>
        </div>

        <div className={styles.controlsContainer}>
          <input
            type="text"
            placeholder={overviewConfig.ordersSection.searchPlaceholder}
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className={styles.saveViewBtn} onClick={saveCurrentView}>Save view</button>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {Object.entries(overviewConfig.ordersSection.filter).map(
              ([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ),
            )}
          </select>
        </div>

        {savedViews.length > 0 && <div className={styles.savedViews}>{savedViews.map((view) => <button key={view.label} onClick={() => { setStatusFilter(view.status); setSearchTerm(view.search); }}>{view.label}</button>)}</div>}

        {loading ? (
          <p className={styles.loadingText}>
            {overviewConfig.ordersSection.loading}
          </p>
        ) : visibleOrders.length === 0 ? (
          <p className={styles.emptyText}>
            {overviewConfig.ordersSection.empty}
          </p>
        ) : (
          <>
            <div className={styles.tableResponsive}>
              <table className={styles.ordersTable}>
                <thead>
                  <tr>
                    {overviewConfig.tableHeaders.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((order, index) => {
                    const isLastElement = index === visibleOrders.length - 1;
                    const currentId = order.order_number || order.orderId || order.id;
                    const customerName =
                      order.customerName ||
                      order.shipping_address?.recipientName ||
                      "Customer";
                    const orderTotal = Number(order.total_amount || order.amount || order.price || 0);
                    const displayStatus = order.status === "success" ? "processing" : order.status === "shipping" ? "shipped" : order.status || "pending";

                    return (
                      <tr key={currentId}>
                        <td className={styles.orderId} data-label="ID Pesanan">{currentId}</td>
                        <td data-label="Pelanggan">{customerName}</td>
                        <td data-label="Total">{formatRupiah(orderTotal)}</td>
                        <td data-label="Kurir">
                          {(() => {
                            const shippingInfo = order.shipping_detail || order.shippingDetail || order.shipping_details?.[0] || {};
                            const courier = shippingInfo.courier_name || shippingInfo.courierName || order.courier_name || order.courier;
                            const service = shippingInfo.service_type || shippingInfo.serviceType || order.courier_service;
                            return courier ? `${courier} - ${service || "-"}` : "N/A";
                          })()}
                        </td>
                        <td data-label="Status">
                          <span
                            className={`${styles.badge} ${getBadgeClass(displayStatus)}`}
                          >
                            {displayStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {hasMore && visibleOrders.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                <button 
                  className={styles.saveViewBtn} 
                  style={{ padding: '0.75rem 2rem' }}
                  onClick={() => setVisibleCount((prev) => prev + ORDERS_PER_PAGE)}
                >
                  Muat Lebih Banyak
                </button>
              </div>
            )}
            {!hasMore && visibleOrders.length > 0 && <p className={styles.emptyText}>Semua pesanan telah dimuat.</p>}
          </>
        )}
      </div>
    </>
  );
}
