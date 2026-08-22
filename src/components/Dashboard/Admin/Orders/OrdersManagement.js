"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { auth } from "@/lib/supabaseClient";
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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalOrders: 0 });
  const [updatingId, setUpdatingId] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [adminTab, setAdminTab] = useState('orders'); // 'orders', 'returns', 'withdrawals'
  const [shippingDraft, setShippingDraft] = useState({ courierName: "", serviceType: "", trackingNumber: "" });
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("processing");
  const [printOrders, setPrintOrders] = useState([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [printType, setPrintType] = useState("slip");

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
          recipientName: order.customerName || order.customer_name || null,
          phoneNumber: order.customerPhone || order.customer_phone || order.phone || null,
          status: "shipped",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan informasi pengiriman");
      const updatedOrderData = { ...order, status: "shipped", shipping_detail: { ...(order.shipping_detail || order.shippingDetail || {}), courier_name: shippingDraft.courierName || null, service_type: shippingDraft.serviceType || null, tracking_number: shippingDraft.trackingNumber || null } };
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
      if (onOrderUpdate) onOrderUpdate();
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
        >
          Pengembalian Dana (Refund)
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
                            {order.orderId || order.order_number || orderId}
                            {order.status === "verifying" && <span className={styles.actionDot} title="Menunggu Konfirmasi Admin"></span>}
                          </strong>
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
                            <p style={{ marginTop: "4px" }}>No. Pesanan: {order.orderId || order.order_number || orderId}</p>
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
                            <strong>{order.orderId || order.order_number || orderId}</strong>
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
                          <p><b>Resi:</b> {shippingInfo.tracking_number || shippingInfo.trackingNumber || order.shipping_receipt_number || "Belum ada resi"}</p>
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
                {(activeOrder.shipping_address || activeOrder.shippingAddress) && (
                  <p style={{ marginTop: '8px', fontSize: '0.875rem' }}>{getAddressStr(activeOrder.shipping_address || activeOrder.shippingAddress)}</p>
                )}
              </div>
              <div className={styles.drawerCard}>
                <h4>Jumlah</h4>
                <p>{money(orderValue(activeOrder))}</p>
                <p>Status: <span style={{ textTransform: "capitalize", fontWeight: "bold" }}>{activeOrder.status === "verifying" ? "Menunggu Verifikasi" : activeOrder.status || "pending"}</span></p>
                <p style={{ marginTop: '8px', fontSize: '0.85rem', color: "var(--text-secondary)" }}>
                  Metode: {activeOrder.payment_method || activeOrder.paymentMethod || activeOrder.payment_type || activeOrder.paymentType || "Midtrans"}
                </p>
                {(activeOrder.shipping_detail?.payment_proof_url || activeOrder.shippingDetail?.payment_proof_url) && (
                  <a 
                    href={activeOrder.shipping_detail?.payment_proof_url || activeOrder.shippingDetail?.payment_proof_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={styles.refreshButton}
                    style={{ display: "inline-block", marginTop: "10px", padding: "6px 12px", borderRadius: "6px", fontSize: "0.85rem", textDecoration: "none", textAlign: "center" }}
                  >
                    Lihat Bukti Bayar
                  </a>
                )}
              </div>
            </div>
            <div className={styles.drawerCard}>
              <h4>Info pengiriman</h4>
              <div className={styles.shippingFields}>
                <input 
                  value={shippingDraft.courierName} 
                  onChange={(event) => setShippingDraft((draft) => ({ ...draft, courierName: event.target.value }))} 
                  placeholder="Kurir (contoh: JNE)" 
                  disabled={["delivered", "cancelled", "returned"].includes(activeOrder.status)}
                />
                <input 
                  value={shippingDraft.serviceType} 
                  onChange={(event) => setShippingDraft((draft) => ({ ...draft, serviceType: event.target.value }))} 
                  placeholder="Layanan (contoh: REG)" 
                  disabled={["delivered", "cancelled", "returned"].includes(activeOrder.status)}
                />
                <input 
                  value={shippingDraft.trackingNumber} 
                  onChange={(event) => setShippingDraft((draft) => ({ ...draft, trackingNumber: event.target.value }))} 
                  placeholder="Nomor resi pengiriman" 
                  disabled={["delivered", "cancelled", "returned"].includes(activeOrder.status)}
                />
              </div>
              <div className={styles.drawerActions}>
                {["delivered", "cancelled", "returned"].includes(activeOrder.status) ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>
                    Info pengiriman tidak dapat diubah karena status pesanan sudah final.
                  </p>
                ) : (
                  <>
                    <button
                      className={styles.refreshButton}
                      onClick={() => saveShipping(activeOrder)}
                      disabled={updatingId === (activeOrder.id || activeOrder.orderId) || (shippingDraft.trackingNumber && shippingDraft.trackingNumber === (activeOrder.shipping_detail?.tracking_number || activeOrder.shippingDetail?.trackingNumber || activeOrder.shipping_receipt_number))}
                      style={{ opacity: updatingId === (activeOrder.id || activeOrder.orderId) || (shippingDraft.trackingNumber && shippingDraft.trackingNumber === (activeOrder.shipping_detail?.tracking_number || activeOrder.shippingDetail?.trackingNumber || activeOrder.shipping_receipt_number)) ? 0.6 : 1, cursor: updatingId === (activeOrder.id || activeOrder.orderId) || (shippingDraft.trackingNumber && shippingDraft.trackingNumber === (activeOrder.shipping_detail?.tracking_number || activeOrder.shippingDetail?.trackingNumber || activeOrder.shipping_receipt_number)) ? 'not-allowed' : 'pointer' }}
                    >
                      {updatingId === (activeOrder.id || activeOrder.orderId) 
                        ? "Menyimpan..." 
                        : (activeOrder.status === "shipped" ? "Perbarui Resi" : "Simpan & Kirim")}
                    </button>
                    {!["shipped", "return_requested", "returning"].includes(activeOrder.status) && (
                      <button className={styles.secondaryButton} onClick={() => updateStatus(activeOrder.id || activeOrder.orderId, "shipped")}>
                        Tandai dikirim
                      </button>
                    )}
                  </>
                )}
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