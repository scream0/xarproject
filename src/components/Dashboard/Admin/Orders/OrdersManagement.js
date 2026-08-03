"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { auth } from "@/lib/firebaseClient";
import styles from "./OrdersManagement.module.css";

const money = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const orderValue = (order) => Number(order.amount || order.total_amount || order.total || 0);

export default function OrdersManagement() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalOrders: 0 });
  const [updatingId, setUpdatingId] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [shippingDraft, setShippingDraft] = useState({ courierName: "", serviceType: "", trackingNumber: "" });
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("processing");
  const [printOrders, setPrintOrders] = useState([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const loadOrders = async (targetPage = page, targetStatus = statusFilter, targetSearch = searchTerm) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(targetPage), limit: "10" });
      if (targetStatus && targetStatus !== "all") params.set("status", targetStatus);
      if (targetSearch.trim()) params.set("search", targetSearch.trim());

      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/orders?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();
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
    loadOrders(1, statusFilter, searchTerm);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleSearch = (event) => {
    event.preventDefault();
    loadOrders(1, statusFilter, searchTerm);
    setPage(1);
  };

  const openOrderDetails = (order) => {
    setActiveOrder(order);
    const shippingInfo = order.shippingDetail || order.shipping_details?.[0] || {};
    setShippingDraft({
      courierName: shippingInfo.courier_name || shippingInfo.courierName || "",
      serviceType: shippingInfo.service_type || shippingInfo.serviceType || "",
      trackingNumber: shippingInfo.tracking_number || shippingInfo.trackingNumber || "",
    });
  };

  const saveShipping = async (order) => {
    const orderId = order.id || order.orderId;
    try {
      setUpdatingId(orderId);
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/orders/${orderId}/shipping`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          courierName: shippingDraft.courierName,
          serviceType: shippingDraft.serviceType,
          trackingNumber: shippingDraft.trackingNumber,
          shippingAddress: order.shipping_address || order.shippingAddress || null,
          recipientName: order.customerName || null,
          phoneNumber: order.phone || null,
          status: "shipped",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan informasi pengiriman");
      setOrders((items) => items.map((item) => (item.id === orderId || item.orderId === orderId ? { ...item, status: "shipped", shippingDetail: { ...(item.shippingDetail || {}), courier_name: shippingDraft.courierName || null, service_type: shippingDraft.serviceType || null, tracking_number: shippingDraft.trackingNumber || null } } : item)));
      toast.success("Informasi pengiriman berhasil disimpan.");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to save shipping info.");
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleOrderSelection = (orderId) => {
    setSelectedOrders((items) => (items.includes(orderId) ? items.filter((item) => item !== orderId) : [...items, orderId]));
  };

  const openPrintView = () => {
    if (!selectedOrders.length) {
      toast.error("Pilih setidaknya satu pesanan untuk mencetak.");
      return;
    }

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
      const token = await auth.currentUser?.getIdToken();
      const promises = selectedOrders.map(async (orderId) => {
        const res = await fetch(`/api/admin/orders/${orderId}/status`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: bulkStatus, changedBy: "admin" }),
        });
        const data = await res.json();
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
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus, changedBy: "admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status pesanan");
      setOrders((items) => items.map((item) => (item.id === orderId || item.orderId === orderId ? { ...item, status: nextStatus } : item)));
      toast.success("Status pesanan berhasil diperbarui.");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to update order status.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Order management</p>
          <h2 className={styles.title}>Track every order, status, and shipment in one place.</h2>
        </div>
        <div className={styles.controls}>
          <form onSubmit={handleSearch} className={styles.searchForm}>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search order ID or customer"
              aria-label="Search orders"
            />
            <button type="submit">Search</button>
          </form>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={styles.filterSelect}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button className={styles.refreshButton} onClick={() => loadOrders(page, statusFilter, searchTerm)}>
            Refresh
          </button>
        </div>
      </div>

      <div className={styles.summaryBar}>
        <span>{pagination.totalOrders} orders</span>
        <span>Page {pagination.currentPage} of {pagination.totalPages}</span>
      </div>

      <div className={styles.bulkBar}>
        <label className={styles.bulkLabel}>
          <input type="checkbox" checked={selectedOrders.length > 0 && selectedOrders.length === orders.length} onChange={() => setSelectedOrders(selectedOrders.length === orders.length ? [] : orders.map((order) => order.id || order.orderId))} />
          Select all
        </label>
        <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)} className={styles.filterSelect}>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className={styles.refreshButton} onClick={applyBulkStatus} disabled={!selectedOrders.length || bulkUpdating}>
          {bulkUpdating ? "Updating..." : "Apply bulk status"}
        </button>
        <button className={styles.secondaryButton} onClick={openPrintView} disabled={!selectedOrders.length}>Print packing slip</button>
      </div>

      {loading ? (
        <p className={styles.empty}>Loading orders…</p>
      ) : orders.length === 0 ? (
        <p className={styles.empty}>No orders match the current filter.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th><input type="checkbox" checked={selectedOrders.length > 0 && selectedOrders.length === orders.length} onChange={() => setSelectedOrders(selectedOrders.length === orders.length ? [] : orders.map((order) => order.id || order.orderId))} /></th>
                <th>Order</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Shipping</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const orderId = order.id || order.orderId;
                const shippingInfo = order.shippingDetail || order.shipping_details?.[0] || {};
                return (
                  <tr key={orderId}>
                    <td>
                      <input type="checkbox" checked={selectedOrders.includes(orderId)} onChange={() => toggleOrderSelection(orderId)} />
                    </td>
                    <td>
                      <div className={styles.orderCell}>
                        <button className={styles.linkButton} onClick={() => openOrderDetails(order)}>
                          <strong>{order.orderId || order.order_number || orderId}</strong>
                        </button>
                        <small>{order.id || order.orderId}</small>
                      </div>
                    </td>
                    <td>
                      <div className={styles.orderCell}>
                        <strong>{order.customerName || order.shipping_address?.recipientName || "Customer"}</strong>
                        <small>{order.customerEmail || "No email recorded"}</small>
                      </div>
                    </td>
                    <td>{money(orderValue(order))}</td>
                    <td>
                      <select
                        className={styles.statusSelect}
                        value={order.status || "pending"}
                        onChange={(event) => updateStatus(orderId, event.target.value)}
                        disabled={updatingId === orderId || bulkUpdating}
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td>
                      <div className={styles.orderCell}>
                        <strong>{shippingInfo.courier_name || shippingInfo.courierName || "—"}</strong>
                        <small>{shippingInfo.tracking_number || shippingInfo.trackingNumber || "No tracking yet"}</small>
                      </div>
                    </td>
                    <td>{new Date(order.createdAt || order.created_at || Date.now()).toLocaleDateString("id-ID")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.pagination}>
        <button disabled={page <= 1} onClick={() => { const nextPage = page - 1; setPage(nextPage); loadOrders(nextPage, statusFilter, searchTerm); }}>
          Previous
        </button>
        <span>Page {page}</span>
        <button disabled={page >= pagination.totalPages} onClick={() => { const nextPage = page + 1; setPage(nextPage); loadOrders(nextPage, statusFilter, searchTerm); }}>
          Next
        </button>
      </div>

      {printOrders.length > 0 && (
        <div className={styles.drawerBackdrop} onClick={() => setPrintOrders([])}>
          <div className={styles.drawer} onClick={(event) => event.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div>
                <p className={styles.eyebrow}>Print preview</p>
                <h3>Packing slip & invoice</h3>
              </div>
              <button className={styles.closeButton} onClick={() => setPrintOrders([])}>Close</button>
            </div>
            <div className={styles.printPreview}>
              {printOrders.map((order) => {
                const orderId = order.id || order.orderId;
                const shippingInfo = order.shippingDetail || order.shipping_details?.[0] || {};
                return (
                  <div key={orderId} className={styles.printCard}>
                    <div className={styles.printHeader}>
                      <div>
                        <strong>{order.orderId || order.order_number || orderId}</strong>
                        <p>{order.customerName || "Customer"}</p>
                      </div>
                      <div className={styles.printMeta}>
                        <span>{money(orderValue(order))}</span>
                        <span>{order.status || "pending"}</span>
                      </div>
                    </div>
                    <div className={styles.printBody}>
                      <p><b>Recipient:</b> {order.customerName || "Customer"}</p>
                      <p><b>Courier:</b> {shippingInfo.courier_name || shippingInfo.courierName || "—"}</p>
                      <p><b>Tracking:</b> {shippingInfo.tracking_number || shippingInfo.trackingNumber || "No tracking yet"}</p>
                      <p><b>Address:</b> {order.shipping_address?.address || order.shippingAddress?.address || "Address not provided"}</p>
                    </div>
                    <div className={styles.printItems}>
                      {(order.items || []).map((item, index) => (
                        <div key={`${item.name}-${index}`} className={styles.itemRow}>
                          <span>{item.name || item.product_name || "Product"}</span>
                          <strong>{item.quantity || item.qty || 1} × {money(item.price || 0)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={styles.drawerActions}>
              <button className={styles.refreshButton} onClick={() => window.print()}>Print</button>
            </div>
          </div>
        </div>
      )}

      {activeOrder && (
        <div className={styles.drawerBackdrop} onClick={() => setActiveOrder(null)}>
          <div className={styles.drawer} onClick={(event) => event.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div>
                <p className={styles.eyebrow}>Order details</p>
                <h3>{activeOrder.orderId || activeOrder.order_number || activeOrder.id}</h3>
              </div>
              <button className={styles.closeButton} onClick={() => setActiveOrder(null)}>Close</button>
            </div>
            <div className={styles.drawerGrid}>
              <div className={styles.drawerCard}>
                <h4>Customer</h4>
                <p>{activeOrder.customerName || "Customer"}</p>
                <p>{activeOrder.customerEmail || "No email recorded"}</p>
              </div>
              <div className={styles.drawerCard}>
                <h4>Amount</h4>
                <p>{money(orderValue(activeOrder))}</p>
                <p>Status: {activeOrder.status || "pending"}</p>
              </div>
            </div>
            <div className={styles.drawerCard}>
              <h4>Shipping info</h4>
              <div className={styles.shippingFields}>
                <input value={shippingDraft.courierName} onChange={(event) => setShippingDraft((draft) => ({ ...draft, courierName: event.target.value }))} placeholder="Courier" />
                <input value={shippingDraft.serviceType} onChange={(event) => setShippingDraft((draft) => ({ ...draft, serviceType: event.target.value }))} placeholder="Service" />
                <input value={shippingDraft.trackingNumber} onChange={(event) => setShippingDraft((draft) => ({ ...draft, trackingNumber: event.target.value }))} placeholder="Tracking number" />
              </div>
              <div className={styles.drawerActions}>
                <button className={styles.refreshButton} onClick={() => saveShipping(activeOrder)}>Save shipping</button>
                <button className={styles.secondaryButton} onClick={() => updateStatus(activeOrder.id || activeOrder.orderId, "shipped")}>Mark shipped</button>
              </div>
            </div>
            <div className={styles.drawerCard}>
              <h4>Items</h4>
              {(activeOrder.items || []).map((item, index) => (
                <div key={`${item.name}-${index}`} className={styles.itemRow}>
                  <span>{item.name || item.product_name || "Product"}</span>
                  <strong>{item.quantity || item.qty || 1} × {money(item.price || 0)}</strong>
                </div>
              ))}
              {!activeOrder.items?.length && <p>No item list available.</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
