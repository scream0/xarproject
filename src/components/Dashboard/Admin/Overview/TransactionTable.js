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
        (a, b) =>
          new Date(b.created_at || 0) - new Date(a.created_at || 0),
      );

      setAllOrders(transactions);
    } catch (error) {
      console.error("Gagal mengambil data pesanan:", error);
      toast.error("Gagal memuat data pesanan");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrder = async (orderId, newStatus, receiptNumber = null) => {
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
        })
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
      handleUpdateOrder(orderId, "shipping", shippingReceipt);
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
      shipping: styles.badgeShipping,
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
        return order.status === statusFilter;
      })
      .filter((order) => {
        const searchTermLower = searchTerm.toLowerCase();
        const customerName =
          order.customerName ||
          order.shipping_address?.recipientName ||
          "";
        return (
          (order.orderId || order.id)?.toLowerCase().includes(searchTermLower) ||
          customerName.toLowerCase().includes(searchTermLower)
        );
      });
  }, [allOrders, statusFilter, searchTerm]);

  const totalPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ORDERS_PER_PAGE,
    currentPage * ORDERS_PER_PAGE,
  );

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <>
      <div className={styles.ordersSection}>
        <h3 className={styles.sectionTitle}>{overviewConfig.ordersSection.title}</h3>
        
        <div className={styles.controlsContainer}>
          <input
            type="text"
            placeholder={overviewConfig.ordersSection.searchPlaceholder}
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {Object.entries(overviewConfig.ordersSection.filter).map(([key, value]) => (
              <option key={key} value={key}>{value}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className={styles.loadingText}>{overviewConfig.ordersSection.loading}</p>
        ) : paginatedOrders.length === 0 ? (
          <p className={styles.emptyText}>{overviewConfig.ordersSection.empty}</p>
        ) : (
          <>
            <div className={styles.tableResponsive}>
              <table className={styles.ordersTable}>
                <thead>
                  <tr>
                    {overviewConfig.tableHeaders.map(header => <th key={header}>{header}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order) => {
                    const currentId = order.orderId || order.id;
                    const customerName = order.customerName || order.shipping_address?.recipientName || "Customer";
                    const orderTotal = Number(order.amount || order.price || 0);

                    return (
                      <tr key={currentId}>
                        <td className={styles.orderId}>{currentId}</td>
                        <td>{customerName}</td>
                        <td>{formatRupiah(orderTotal)}</td>
                        <td>
                          <span className={`${styles.badge} ${getBadgeClass(order.status)}`}>
                            {order.status || "pending"}
                          </span>
                        </td>
                        <td>
                          {order.status === "pending" && (
                            <button className={styles.actionBtnConfirm} onClick={() => handleUpdateOrder(currentId, "success")} disabled={updatingId === currentId}>
                              {updatingId === currentId ? overviewConfig.actions.confirming : overviewConfig.actions.confirmPayment}
                            </button>
                          )}
                          {order.status === "success" && (
                            <button className={styles.actionBtn} onClick={() => handleUpdateOrder(currentId, "processing")} disabled={updatingId === currentId}>
                              {updatingId === currentId ? overviewConfig.actions.processing : overviewConfig.actions.processOrder}
                            </button>
                          )}
                          {order.status === "processing" && (
                            <button className={styles.actionBtn} onClick={() => handleShipOrderClick(order)} disabled={updatingId === currentId}>
                              {updatingId === currentId ? overviewConfig.actions.shipping : overviewConfig.actions.shipItem}
                            </button>
                          )}
                          {order.status === "shipping" && (
                            <button className={styles.actionBtn} onClick={() => handleUpdateOrder(currentId, "completed")} disabled={updatingId === currentId}>
                              {updatingId === currentId ? overviewConfig.actions.completing : overviewConfig.actions.completeOrder}
                            </button>
                          )}
                          {order.status === "completed" && (
                            <span className={styles.statusCompletedText}>{overviewConfig.actions.completed}</span>
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
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
                  Previous
                </button>
                <span>Page {currentPage} of {totalPages}</span>
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {shippingModalOrder && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Masukkan Nomor Resi</h3>
            <p className={styles.modalSubtitle}>
              Untuk pesanan: <strong>{shippingModalOrder.orderId || shippingModalOrder.id}</strong>
            </p>
            <form onSubmit={handleShippingSubmit}>
              <input
                type="text"
                className={styles.modalInput}
                value={shippingReceipt}
                onChange={(e) => setShippingReceipt(e.target.value)}
                placeholder="Contoh: JNE00123456789"
                required
              />
              <div className={styles.modalActions}>
                <button type="button" className={styles.modalBtnCancel} onClick={() => setShippingModalOrder(null)}>
                  Batal
                </button>
                <button type="submit" className={styles.modalBtnConfirm} disabled={updatingId === (shippingModalOrder.orderId || shippingModalOrder.id)}>
                  {updatingId ? "Menyimpan..." : "Simpan & Kirim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
