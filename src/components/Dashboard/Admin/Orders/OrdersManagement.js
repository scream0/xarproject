"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { auth } from "@/lib/supabaseClient";
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrders(1, statusFilter, searchTerm);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleSearch = (event) => {
    event.preventDefault();
    loadOrders(1, statusFilter, searchTerm);
    setPage(1);
  };

  const openOrderDetails = async (order) => {
    try {
      const orderId = order.id || order.orderId;
      const token = await getSupabaseToken();
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();

      const activeData = (res.ok && data.order) ? data.order : order;
      setActiveOrder(activeData);

      const shippingInfo = activeData.shipping_detail || activeData.shippingDetail || activeData.shipping_details?.[0] || {};
      setShippingDraft({
        courierName: shippingInfo.courier_name || shippingInfo.courierName || activeData.courier_name || activeData.courier || "",
        serviceType: shippingInfo.service_type || shippingInfo.serviceType || activeData.courier_service || "",
        trackingNumber: shippingInfo.tracking_number || shippingInfo.trackingNumber || activeData.shipping_receipt_number || "",
      });
    } catch (e) {
      setActiveOrder(order);
    }
  };

  const saveShipping = async (order) => {
    const orderId = order.id || order.orderId;
    try {
      setUpdatingId(orderId);
      const token = await getSupabaseToken();
      const res = await fetch(`/api/admin/orders/${orderId}/shipping`, {
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
          recipientName: order.customerName || null,
          phoneNumber: order.phone || null,
          status: "shipped",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan informasi pengiriman");
      setOrders((items) => items.map((item) => (item.id === orderId || item.orderId === orderId ? { ...item, status: "shipped", shipping_detail: { ...(item.shipping_detail || item.shippingDetail || {}), courier_name: shippingDraft.courierName || null, service_type: shippingDraft.serviceType || null, tracking_number: shippingDraft.trackingNumber || null } } : item)));
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
      const token = await getSupabaseToken();
      const promises = selectedOrders.map(async (orderId) => {
        const res = await fetch(`/api/admin/orders/${orderId}/status`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
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
      const token = await getSupabaseToken();
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
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
          <p className={styles.eyebrow}>Manajemen Pesanan</p>
          <h2 className={styles.title}>Lacak setiap pesanan, status, dan pengiriman di satu tempat.</h2>
        </div>
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
        <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)} className={styles.filterSelect}>
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
        <button className={styles.secondaryButton} onClick={openPrintView} disabled={!selectedOrders.length}>Cetak slip pengiriman</button>
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
                          <strong>{order.orderId || order.order_number || orderId}</strong>
                        </button>
                        <small>{order.id || order.orderId}</small>
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
                        onChange={(event) => updateStatus(orderId, event.target.value)}
                        disabled={updatingId === orderId || bulkUpdating}
                      >
                        <option value="pending">Menunggu</option>
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
                        <small>{shippingInfo.tracking_number || shippingInfo.trackingNumber || order.shipping_receipt_number || "Belum ada resi"}</small>
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
                <h3>Slip pengiriman & faktur</h3>
              </div>
              <button className={styles.closeButton} onClick={() => setPrintOrders([])}>Tutup</button>
            </div>
            <div className={styles.printPreview}>
              {printOrders.map((order) => {
                const orderId = order.id || order.orderId;
                const shippingInfo = order.shipping_detail || order.shippingDetail || order.shipping_details?.[0] || {};
                return (
                  <div key={orderId} className={styles.printCard}>
                    <div className={styles.printHeader}>
                      <div>
                        <strong>{order.orderId || order.order_number || orderId}</strong>
                        <p>{order.customer_name || "Pelanggan"}</p>
                      </div>
                      <div className={styles.printMeta}>
                        <span>{money(orderValue(order))}</span>
                        <span>{order.status || "pending"}</span>
                      </div>
                    </div>
                    <div className={styles.printBody}>
                      <p><b>Penerima:</b> {order.customer_name || order.shipping_address?.recipientName || "Pelanggan"}</p>
                      <p><b>Kurir:</b> {shippingInfo.courier_name || shippingInfo.courierName || order.courier_name || order.courier || "—"}</p>
                      <p><b>Resi:</b> {shippingInfo.tracking_number || shippingInfo.trackingNumber || order.shipping_receipt_number || "Belum ada resi"}</p>
                      <p><b>Alamat:</b> {order.shipping_address?.address || order.shippingAddress?.address || "Alamat tidak tersedia"}</p>
                    </div>
                    <div className={styles.printItems}>
                      {(order.items || []).map((item, index) => (
                        <div key={`${item.name}-${index}`} className={styles.itemRow}>
                          <span>{item.name || item.product_name || "Produk"}</span>
                          <strong>{item.quantity || item.qty || 1} × {money(item.price || 0)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={styles.drawerActions}>
              <button className={styles.refreshButton} onClick={() => window.print()}>Cetak</button>
            </div>
          </div>
        </div>
      )}

      {activeOrder && (
        <div className={styles.drawerBackdrop} onClick={() => setActiveOrder(null)}>
          <div className={styles.drawer} onClick={(event) => event.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div>
                <p className={styles.eyebrow}>Detail pesanan</p>
                <h3>{activeOrder.orderId || activeOrder.order_number || activeOrder.id}</h3>
              </div>
              <button className={styles.closeButton} onClick={() => setActiveOrder(null)}>Tutup</button>
            </div>
            <div className={styles.drawerGrid}>
              <div className={styles.drawerCard}>
                <h4>Pelanggan</h4>
                <p>{activeOrder.customer_name || "Pelanggan"}</p>
                <p>{activeOrder.customer_email || "Tidak ada email"}</p>
                {activeOrder.shipping_address?.address && (
                  <p style={{ marginTop: '8px', fontSize: '0.875rem' }}>{activeOrder.shipping_address.address}</p>
                )}
              </div>
              <div className={styles.drawerCard}>
                <h4>Jumlah</h4>
                <p>{money(orderValue(activeOrder))}</p>
                <p>Status: {activeOrder.status || "pending"}</p>
              </div>
            </div>
            <div className={styles.drawerCard}>
              <h4>Info pengiriman</h4>
              <div className={styles.shippingFields}>
                <input value={shippingDraft.courierName} onChange={(event) => setShippingDraft((draft) => ({ ...draft, courierName: event.target.value }))} placeholder="Kurir" />
                <input value={shippingDraft.serviceType} onChange={(event) => setShippingDraft((draft) => ({ ...draft, serviceType: event.target.value }))} placeholder="Layanan" />
                <input value={shippingDraft.trackingNumber} onChange={(event) => setShippingDraft((draft) => ({ ...draft, trackingNumber: event.target.value }))} placeholder="Nomor resi" />
              </div>
              <div className={styles.drawerActions}>
                <button
                  className={styles.refreshButton}
                  onClick={() => saveShipping(activeOrder)}
                  disabled={updatingId === (activeOrder.id || activeOrder.orderId) || (shippingDraft.trackingNumber && shippingDraft.trackingNumber === (activeOrder.shipping_detail?.tracking_number || activeOrder.shippingDetail?.trackingNumber || activeOrder.shipping_receipt_number))}
                  style={{ opacity: updatingId === (activeOrder.id || activeOrder.orderId) || (shippingDraft.trackingNumber && shippingDraft.trackingNumber === (activeOrder.shipping_detail?.tracking_number || activeOrder.shippingDetail?.trackingNumber || activeOrder.shipping_receipt_number)) ? 0.6 : 1, cursor: updatingId === (activeOrder.id || activeOrder.orderId) || (shippingDraft.trackingNumber && shippingDraft.trackingNumber === (activeOrder.shipping_detail?.tracking_number || activeOrder.shippingDetail?.trackingNumber || activeOrder.shipping_receipt_number)) ? 'not-allowed' : 'pointer' }}
                >
                  {updatingId === (activeOrder.id || activeOrder.orderId) ? "Menyimpan..." : "Simpan pengiriman"}
                </button>
                <button className={styles.secondaryButton} onClick={() => updateStatus(activeOrder.id || activeOrder.orderId, "shipped")}>Tandai dikirim</button>
              </div>
            </div>
            {activeOrder.items && activeOrder.items.length > 0 && (
              <div className={styles.drawerCard}>
                <h4>Barang</h4>
                {activeOrder.items.map((item, index) => (
                  <div key={`${item.name}-${index}`} className={styles.itemRow}>
                    <span>{item.name || item.product_name || "Produk"}</span>
                    <strong>{item.quantity || item.qty || 1} × {money(item.price || 0)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}