"use client";
import { useState, useEffect, useMemo } from "react";
import styles from "./TransactionTable.module.css";
import toast from "react-hot-toast";
import overviewConfig from "@/data/ui/overviewConfig.json";

const ORDERS_PER_PAGE = 10;

export default function TransactionTable() {
  // State for data and loading
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  // State for controls
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [savedViews, setSavedViews] = useState([]);

  // State for shipping modal
  const [shippingModalOrder, setShippingModalOrder] = useState(null);
  const [shippingReceipt, setShippingReceipt] = useState("");

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const ordersRes = await fetch("/api/orders");
      const ordersResult = await ordersRes.json();

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

  const handleUpdateOrder = async (
    orderId,
    newStatus,
    receiptNumber = null,
  ) => {
    try {
      setUpdatingId(orderId);
      const payload = { orderId, status: newStatus };
      if (receiptNumber) {
        payload.shippingReceiptNumber = receiptNumber;
      }

      const res = await fetch("/api/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok)
        throw new Error(result.error || "Gagal memperbarui status pesanan");

      toast.success(`Pesanan ${orderId} berhasil diubah ke: ${newStatus}`);

      setAllOrders((prev) =>
        prev.map((o) => {
          if (o.id === orderId || o.orderId === orderId) {
            const updatedOrder = { ...o, status: newStatus };
            if (receiptNumber) {
              updatedOrder.shippingReceiptNumber = receiptNumber;
            }
            return updatedOrder;
          }
          return o;
        }),
      );
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setUpdatingId(null);
      setShippingModalOrder(null);
      setShippingReceipt("");
    }
  };

  const handleShipOrderClick = (order) => {
    setShippingModalOrder(order);
  };

  const handleShippingSubmit = (e) => {
    e.preventDefault();
    if (shippingModalOrder && shippingReceipt) {
      const orderId = shippingModalOrder.orderId || shippingModalOrder.id;
      handleUpdateOrder(orderId, "shipped", shippingReceipt);
    } else {
      toast.error("Nomor resi tidak boleh kosong.");
    }
  };

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
      shipped: styles.badgeShipping,
      shipping: styles.badgeShipping,
      cancelled: styles.badgeCancelled,
      completed: styles.badgeCompleted,
      pending: styles.badgePending,
    };
    return statusMap[status] || styles.badgePending;
  };

  // Memoized filtered and paginated orders
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

  const totalPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ORDERS_PER_PAGE,
    currentPage * ORDERS_PER_PAGE,
  );

  const saveCurrentView = () => { const label = searchTerm ? `${statusFilter}: ${searchTerm}` : statusFilter; const next = [...savedViews.filter((view) => view.label !== label), { label, status: statusFilter, search: searchTerm }].slice(-5); setSavedViews(next); window.localStorage.setItem("xar-order-views", JSON.stringify(next)); toast.success("Filter view saved."); };
  const toggleOrder = (id) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  const toggleVisible = () => { const ids = paginatedOrders.map((order) => order.orderId || order.id); setSelectedIds((current) => ids.every((id) => current.includes(id)) ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])]); };
  const runBulkAction = async (from, to) => { const targets = allOrders.filter((order) => selectedIds.includes(order.orderId || order.id) && (order.status === from || (from === "processing" && order.status === "success"))); if (!targets.length) return toast.error(`Pilih pesanan berstatus ${from}.`); await Promise.all(targets.map((order) => handleUpdateOrder(order.orderId || order.id, to))); setSelectedIds([]); };

  const exportOrders = () => {
    const rows = filteredOrders.map((order) => [order.orderId || order.id, order.customerName || order.shipping_address?.recipientName || "Customer", Number(order.amount || order.price || 0), order.status || "pending", order.createdAt || order.created_at || ""]);
    const csv = [["Order ID", "Customer", "Total", "Status", "Date"], ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a"); link.href = url; link.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <>
      <div className={styles.ordersSection}>
        <div className={styles.titleRow}>
          <h3 className={styles.sectionTitle}>{overviewConfig.ordersSection.title}</h3>
          <button className={styles.exportBtn} onClick={exportOrders}>Export CSV</button>
        </div>

        {selectedIds.length > 0 && <div className={styles.bulkBar}><span>{selectedIds.length} selected</span><div><button onClick={() => runBulkAction("pending", "processing")}>Confirm payment</button><button onClick={() => runBulkAction("shipped", "completed")}>Mark completed</button></div></div>}

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

        {savedViews.length > 0 && <div className={styles.savedViews}>{savedViews.map((view) => <button key={view.label} onClick={() => { setStatusFilter(view.status); setSearchTerm(view.search); setCurrentPage(1); }}>{view.label}</button>)}</div>}

        {loading ? (
          <p className={styles.loadingText}>
            {overviewConfig.ordersSection.loading}
          </p>
        ) : paginatedOrders.length === 0 ? (
          <p className={styles.emptyText}>
            {overviewConfig.ordersSection.empty}
          </p>
        ) : (
          <>
            <div className={styles.tableResponsive}>
              <table className={styles.ordersTable}>
                <thead>
                  <tr>
                    <th><input type="checkbox" aria-label="Select visible orders" checked={paginatedOrders.length > 0 && paginatedOrders.every((order) => selectedIds.includes(order.orderId || order.id))} onChange={toggleVisible} /></th>
                    {overviewConfig.tableHeaders.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order) => {
                    const currentId = order.orderId || order.id;
                    const customerName =
                      order.customerName ||
                      order.shipping_address?.recipientName ||
                      "Customer";
                    const orderTotal = Number(order.amount || order.price || 0);
                    const displayStatus = order.status === "success" ? "processing" : order.status === "shipping" ? "shipped" : order.status || "pending";

                    return (
                      <tr key={currentId}>
                        <td><input type="checkbox" aria-label={`Select ${currentId}`} checked={selectedIds.includes(currentId)} onChange={() => toggleOrder(currentId)} /></td>
                        <td className={styles.orderId}>{currentId}</td>
                        <td>{customerName}</td>
                        <td>{formatRupiah(orderTotal)}</td>
                        <td>
                          <span
                            className={`${styles.badge} ${getBadgeClass(displayStatus)}`}
                          >
                            {displayStatus}
                          </span>
                        </td>
                        <td>
                          {displayStatus === "pending" && (
                            <button
                              className={styles.actionBtnConfirm}
                              onClick={() =>
                                handleUpdateOrder(currentId, "processing")
                              }
                              disabled={updatingId === currentId}
                            >
                              {updatingId === currentId
                                ? overviewConfig.actions.confirming
                                : overviewConfig.actions.confirmPayment}
                            </button>
                          )}
{displayStatus === "processing" && (
                            <button
                              className={styles.actionBtn}
                              onClick={() => handleShipOrderClick(order)}
                              disabled={updatingId === currentId}
                            >
                              {updatingId === currentId
                                ? overviewConfig.actions.shipping
                                : overviewConfig.actions.shipItem}
                            </button>
                          )}
                          {displayStatus === "shipped" && (
                            <button
                              className={styles.actionBtn}
                              onClick={() =>
                                handleUpdateOrder(currentId, "completed")
                              }
                              disabled={updatingId === currentId}
                            >
                              {updatingId === currentId
                                ? overviewConfig.actions.completing
                                : overviewConfig.actions.completeOrder}
                            </button>
                          )}
                          {order.status === "completed" && (
                            <span className={styles.statusCompletedText}>
                              {overviewConfig.actions.completed}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  {overviewConfig.pagination.prev}
                </button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  {overviewConfig.pagination.next}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {shippingModalOrder && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>{overviewConfig.modal.title}</h3>
            <p className={styles.modalSubtitle}>
              {overviewConfig.modal.subtitle}{" "}
              <strong>
                {shippingModalOrder.orderId || shippingModalOrder.id}
              </strong>
            </p>
            <form onSubmit={handleShippingSubmit}>
              <input
                type="text"
                className={styles.modalInput}
                value={shippingReceipt}
                onChange={(e) => setShippingReceipt(e.target.value)}
                placeholder={overviewConfig.modal.placeholder}
                required
              />
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.modalBtnCancel}
                  onClick={() => setShippingModalOrder(null)}
                >
                  {overviewConfig.modal.cancel}
                </button>
                <button
                  type="submit"
                  className={styles.modalBtnConfirm}
                  disabled={
                    updatingId ===
                    (shippingModalOrder.orderId || shippingModalOrder.id)
                  }
                >
                  {updatingId
                    ? overviewConfig.modal.loading
                    : overviewConfig.modal.confirm}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
