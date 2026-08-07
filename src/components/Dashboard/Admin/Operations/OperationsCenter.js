"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { auth } from "@/lib/supabaseClient";
import styles from "./OperationsCenter.module.css";
import config from "@/data/ui/operationConfig.json";

const money = (value) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
const orderValue = (order) => Number(order.amount || order.price || order.total || 0);
const orderDate = (order) => new Date(order.createdAt || order.created_at || Date.now());

export default function OperationsCenter() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [returnRequests, setReturnRequests] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [rules, setRules] = useState([]);
  const [procurement, setProcurement] = useState({ suppliers: [], orders: [] });
  const [reconciliation, setReconciliation] = useState({ pending: [], summary: {} });
  const [team, setTeam] = useState([]);
  
  // State Voucher & Promo Database
  const [vouchers, setVouchers] = useState([]);
  const [voucherForm, setVoucherForm] = useState({
    code: "", 
    title: "", 
    type: "shipping", 
    discount_amount: 0, 
    min_purchase: 0, 
    valid_until: "", 
    usage_limit: 1
  });

  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [shippingEditingId, setShippingEditingId] = useState(null);
  const [shippingDraft, setShippingDraft] = useState({ courierName: "", serviceType: "", trackingNumber: "" });

  const getSupabaseToken = async () => {
    const { data: { session } } = await auth.getSession();
    return session?.access_token || null;
  };

  useEffect(() => {
    const loadAllData = async () => {
      try {
        const token = await getSupabaseToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const [
          ordersRes,
          productsRes,
          reviewsRes,
          teamRes,
          automationRes,
          procurementRes,
          reconciliationRes,
          returnsRes,
          supportRes,
          vouchersRes,
        ] = await Promise.all([
          fetch("/api/admin/orders", { headers }),
          fetch("/api/products", { headers }),
          fetch("/api/reviews", { headers }),
          fetch("/api/team", { headers }),
          fetch("/api/automation", { headers }),
          fetch("/api/procurement", { headers }),
          fetch("/api/reconciliation", { headers }),
          fetch("/api/returns", { headers }),
          fetch("/api/support", { headers }),
          fetch("/api/vouchers", { headers }),
        ]);

        const ordersData = await ordersRes.json();
        const productsData = await productsRes.json();
        const reviewsData = reviewsRes.ok ? await reviewsRes.json() : { reviews: [] };
        
        setOrders(ordersData.orders || ordersData.data || []);
        setProducts(productsData.data || productsData.products || []);
        setReviews(reviewsData.reviews || []);

        if (vouchersRes.ok) {
          const vData = await vouchersRes.json();
          setVouchers(vData.vouchers || []);
        }

        if (teamRes.ok) {
          const teamData = await teamRes.json();
          setTeam(teamData.users || []);
        }
        if (automationRes.ok) {
          const rulesData = await automationRes.json();
          setRules(rulesData.rules || []);
        }
        if (procurementRes.ok) {
          const procurementData = await procurementRes.json();
          setProcurement({
            suppliers: procurementData.suppliers || [],
            orders: procurementData.orders || [],
          });
        }
        if (reconciliationRes.ok) {
          const reconciliationData = await reconciliationRes.json();
          setReconciliation({
            pending: reconciliationData.pending || [],
            summary: reconciliationData.summary || {},
          });
        }
        if (returnsRes.ok) {
          const returnsData = await returnsRes.json();
          setReturnRequests(returnsData.requests || []);
        }
        if (supportRes.ok) {
          const supportData = await supportRes.json();
          setTickets(supportData.tickets || []);
        }
      } catch (error) {
        console.error("Error loading operational workspace:", error);
        toast.error("Sebagian data operasional belum dapat dimuat.");
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, []);

  const updateOrderStatus = async (orderId, nextStatus) => {
    try {
      setStatusUpdatingId(orderId);
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
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status pesanan.");
      setOrders((items) => items.map((item) => item.id === orderId || item.orderId === orderId ? { ...item, status: nextStatus } : item));
      toast.success("Status pesanan berhasil diperbarui.");
    } catch (error) {
      console.error("Gagal update status order:", error);
      toast.error(error.message || "Unable to update order status.");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleSaveVoucher = async () => {
    try {
      const token = await getSupabaseToken();
      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
        body: JSON.stringify(voucherForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan voucher");
      
      toast.success("Voucher berhasil disimpan");
      setVoucherForm({ code: "", title: "", type: "shipping", discount_amount: 0, min_purchase: 0, valid_until: "", usage_limit: 1 });
      
      const updated = await (await fetch("/api/vouchers", { headers: { Authorization: `Bearer ${token}` } })).json();
      setVouchers(updated.vouchers || []);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteVoucher = async (id) => {
    try {
      const token = await getSupabaseToken();
      const res = await fetch(`/api/vouchers?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus voucher");

      setVouchers(vouchers.filter(v => v.id !== id));
      toast.success("Voucher berhasil dihapus");
    } catch (err) {
      toast.error(err.message || "Gagal menghapus");
    }
  };

  const saveShipping = async (order) => {
    const orderId = order.id || order.orderId;
    try {
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
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan informasi pengiriman.");
      setOrders((items) => items.map((item) => (item.id === orderId || item.orderId === orderId ? { ...item, status: "shipped", shippingDetail: { ...(item.shippingDetail || {}), courier_name: shippingDraft.courierName || null, service_type: shippingDraft.serviceType || null, tracking_number: shippingDraft.trackingNumber || null } } : item)));
      setShippingEditingId(null);
      toast.success("Informasi pengiriman berhasil disimpan.");
    } catch (error) {
      console.error("Gagal update shipping:", error);
      toast.error(error.message || "Unable to save shipping info.");
    }
  };

  const updateReturn = async (requestId, status) => {
    try {
      const token = await getSupabaseToken();
      const res = await fetch("/api/returns", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
        body: JSON.stringify({ requestId, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReturnRequests((items) => items.map((item) => item.id === requestId ? { ...item, status } : item));
      toast.success("Return request updated.");
    } catch (error) {
      toast.error(error.message || "Unable to update request.");
    }
  };

  const updateRole = async (memberId, role) => {
    try {
      const token = await getSupabaseToken();
      const res = await fetch("/api/team", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
        body: JSON.stringify({ userId: memberId, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui peran.");
      setTeam((items) => items.map((item) => item.id === memberId ? { ...item, role } : item));
      toast.success("Role updated successfully.");
    } catch (error) {
      console.error("Gagal update role:", error);
      toast.error(error.message || "Unable to update role.");
    }
  };

  const saveRules = async (nextRules) => {
    try {
      const token = await getSupabaseToken();
      const res = await fetch("/api/automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
        body: JSON.stringify({ rules: nextRules }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan rules.");
      setRules(nextRules);
      toast.success("Automation rules saved.");
    } catch (error) {
      console.error("Gagal menyimpan rules:", error);
      toast.error(error.message || "Unable to save rules.");
    }
  };

  const inventory = useMemo(() => products.flatMap((product) => {
    const variants = product.variants?.length ? product.variants : [{ size: "Default", stock: product.stock || 0 }];
    return variants.map((variant) => ({ name: product.name, variant: variant.size || variant.name || "Default", stock: Number(variant.stock ?? variant.stok ?? 0) }));
  }), [products]);
  const lowStock = inventory.filter((item) => item.stock > 0 && item.stock <= 5);
  const soldOut = inventory.filter((item) => item.stock === 0);
  const customers = useMemo(() => Object.values(orders.reduce((all, order) => {
    const name = order.customerName || order.shipping_address?.recipientName || "Pelanggan tanpa nama";
    const item = all[name] || { name, orders: 0, spend: 0 };
    item.orders += 1; item.spend += orderValue(order); all[name] = item; return all;
  }, {})).sort((a, b) => b.spend - a.spend), [orders]);
  const repeatBuyers = customers.filter((customer) => customer.orders > 1);
  const pendingReviews = reviews.filter((review) => !review.approved);
  const analytics = useMemo(() => {
    const productsSold = {}; const categories = {}; const hours = {};
    orders.forEach((order) => {
      const hour = orderDate(order).getHours(); hours[hour] = (hours[hour] || 0) + 1;
      (order.items || []).forEach((item) => {
        const quantity = Number(item.quantity || item.qty || 1); const name = item.name || item.product_name || "Product"; const category = item.category || "Uncategorized";
        productsSold[name] = (productsSold[name] || 0) + quantity; categories[category] = (categories[category] || 0) + quantity;
      });
    });
    const topProduct = Object.entries(productsSold).sort((a, b) => b[1] - a[1])[0];
    const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
    const peakHour = Object.entries(hours).sort((a, b) => b[1] - a[1])[0];
    return { topProduct: topProduct ? `${topProduct[0]} · ${topProduct[1]} sold` : "No sales yet", topCategory: topCategory ? `${topCategory[0]} · ${topCategory[1]} sold` : "No category sales yet", peakHour: peakHour ? `${String(peakHour[0]).padStart(2, "0")}:00 · ${peakHour[1]} orders` : "No orders yet" };
  }, [orders]);
  const activity = useMemo(() => [
    { title: "Admin session", detail: "Current login recorded for this browser", kind: "Login" },
    ...orders.flatMap((order) => (order.statusHistory?.length ? order.statusHistory.map((event) => ({ title: `Order ${order.orderId || order.id}`, detail: `Status changed to ${event.status} · ${new Date(event.changedAt).toLocaleString("id-ID")}`, kind: "Order" })) : [{ title: `Order ${order.orderId || order.id}`, detail: `Current status: ${order.status || "pending"}`, kind: "Order" }])),
    ...products.slice(0, 3).map((product) => ({ title: product.name, detail: `Product updated or added · ${product.category || "Uncategorized"}`, kind: "Product" })),
  ].slice(0, 6), [orders, products]);

  const exportMonthlyReport = () => {
    const currentMonth = new Date().getMonth();
    const monthly = orders.filter((order) => orderDate(order).getMonth() === currentMonth);
    const total = monthly.reduce((sum, order) => sum + orderValue(order), 0);
    const csv = ["Monthly sales report", `Orders,${monthly.length}`, `Revenue,${total}`, "", "Order ID,Customer,Total,Status", ...monthly.map((o) => `${o.orderId || o.id},${o.customerName || o.shipping_address?.recipientName || "Customer"},${orderValue(o)},${o.status || "pending"}`)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const link = document.createElement("a"); link.href = url; link.download = `monthly-sales-${new Date().toISOString().slice(0, 7)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <p className={styles.state}>{config.status.loading}</p>;

  return (
    <div className={styles.center}>
      <section className={styles.hero}>
        <div>
          <p>{config.hero.subtitle}</p>
          <h2>{config.hero.description}</h2>
        </div>
        <button onClick={exportMonthlyReport}>{config.hero.buttonText}</button>
      </section>

      <section className={styles.notificationGrid}>
        <Notice count={orders.filter((o) => o.status === "pending").length} label={config.notifications.payment} />
        <Notice count={lowStock.length} label={config.notifications.lowStock} />
        <Notice count={pendingReviews.length} label={config.notifications.reviews} />
        <Notice count={soldOut.length} label={config.notifications.outOfStock} danger />
      </section>

      <section className={styles.grid}>
        <Panel title={config.panels.inventory.title} action={`${lowStock.length + soldOut.length} items need attention`}>
          <div className={styles.list}>
            {[...soldOut, ...lowStock].slice(0, 6).map((item) => (
              <div className={styles.row} key={`${item.name}-${item.variant}`}>
                <span><b>{item.name}</b><small>{item.variant} · reorder suggestion: {Math.max(10, 15 - item.stock)} units</small></span>
                <strong className={item.stock === 0 ? styles.danger : styles.warning}>{item.stock === 0 ? "Out of stock" : `${item.stock} left`}</strong>
              </div>
            ))}
            {!lowStock.length && !soldOut.length && <p className={styles.empty}>{config.panels.inventory.empty}</p>}
          </div>
        </Panel>

        <Panel title={config.panels.customers.title} action={`${repeatBuyers.length} repeat buyers`}>
          <div className={styles.list}>
            {customers.slice(0, 5).map((customer, index) => (
              <div className={styles.row} key={customer.name}>
                <span><b>#{index + 1} {customer.name}</b><small>{customer.orders} order{customer.orders > 1 ? "s" : ""}</small></span>
                <strong>{money(customer.spend)}</strong>
              </div>
            ))}
            {!customers.length && <p className={styles.empty}>{config.panels.customers.empty}</p>}
          </div>
        </Panel>

        <Panel title={config.panels.reviews.title} action={`${pendingReviews.length} need response`}>
          <div className={styles.list}>
            {reviews.slice(0, 4).map((review) => (
              <div className={styles.row} key={review.id}>
                <span><b>{review.userName || "Customer"} · {"★".repeat(review.rating || 0)}</b><small>{review.comment || "No written feedback"}</small></span>
                <strong className={review.approved ? styles.ok : styles.warning}>{review.approved ? "Published" : "Respond"}</strong>
              </div>
            ))}
            {!reviews.length && <p className={styles.empty}>{config.panels.reviews.empty}</p>}
          </div>
        </Panel>

        <Panel title={config.panels.activity.title} action={config.panels.activity.action}>
          <div className={styles.list}>
            {activity.map((entry, index) => (
              <div className={styles.row} key={`${entry.kind}-${index}`}>
                <span><b>{entry.title}</b><small>{entry.detail}</small></span>
                <strong className={styles.ok}>{entry.kind}</strong>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={config.panels.orders.title} action={`${orders.filter((item) => item.status === "pending").length} awaiting confirmation`}>
          <div className={styles.list}>
            {orders.slice(0, 5).map((order) => { 
              const orderId = order.id || order.orderId; 
              const isEditing = shippingEditingId === orderId; 
              return (
                <div className={styles.row} key={orderId}>
                  <span><b>{order.orderId || order.id}</b><small>{order.customerName || "Customer"} · {money(orderValue(order))}</small></span>
                  <div className={styles.orderActions}>
                    {isEditing ? (
                      <div className={styles.shippingEditor}>
                        <div className={styles.shippingInputs}>
                          <input className={styles.shippingInput} value={shippingDraft.courierName} onChange={(e) => setShippingDraft((draft) => ({ ...draft, courierName: e.target.value }))} placeholder="Kurir" />
                          <input className={styles.shippingInput} value={shippingDraft.serviceType} onChange={(e) => setShippingDraft((draft) => ({ ...draft, serviceType: e.target.value }))} placeholder="Layanan" />
                          <input className={`${styles.shippingInput} ${styles.shippingInputFull}`} value={shippingDraft.trackingNumber} onChange={(e) => setShippingDraft((draft) => ({ ...draft, trackingNumber: e.target.value }))} placeholder="Nomor resi" />
                        </div>
                        <div className={styles.inlineActions}>
                          <button onClick={() => saveShipping(order)}>Save</button>
                          <button onClick={() => setShippingEditingId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => { setShippingEditingId(orderId); setShippingDraft({ courierName: order.shippingDetail?.courier_name || "", serviceType: order.shippingDetail?.service_type || "", trackingNumber: order.shippingDetail?.tracking_number || "" }); }}>Set resi</button>
                        <select value={order.status || "pending"} onChange={(e) => updateOrderStatus(orderId, e.target.value)} disabled={statusUpdatingId === orderId}>
                          <option value="pending">Pending</option>
                          <option value="paid">Paid</option>
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        {statusUpdatingId === orderId && <span className={styles.warning}>Updating…</span>}
                      </>
                    )}
                  </div>
                </div>
              ); 
            })}
            {!orders.length && <p className={styles.empty}>{config.panels.orders.empty}</p>}
          </div>
        </Panel>

        <Panel title={config.panels.support.title} action={`${tickets.filter((item) => item.status === "open").length} open tickets`}>
          <div className={styles.list}>
            {tickets.slice(0, 4).map((ticket) => (
              <div className={styles.row} key={ticket.id}>
                <span><b>{ticket.subject}</b><small>{ticket.orderId || "No order"} · {ticket.messages?.at(-1)?.body || "No messages"}</small></span>
                <strong className={ticket.status === "open" ? styles.warning : styles.ok}>{ticket.status}</strong>
              </div>
            ))}
            {!tickets.length && <p className={styles.empty}>{config.panels.support.empty}</p>}
          </div>
        </Panel>

        <Panel title={config.panels.returns.title} action={`${returnRequests.filter((item) => item.status === "requested").length} awaiting decision`}>
          <div className={styles.list}>
            {returnRequests.slice(0, 5).map((item) => (
              <div className={styles.row} key={item.id}>
                <span><b>{item.orderId} · {item.reason}</b><small>{item.notes || "No additional note"}</small></span>
                {item.status === "requested" ? (
                  <span className={styles.inlineActions}>
                    <button onClick={() => updateReturn(item.id, "approved")}>Approve</button>
                    <button onClick={() => updateReturn(item.id, "rejected")}>Reject</button>
                  </span>
                ) : (
                  <strong className={styles.ok}>{item.status}</strong>
                )}
              </div>
            ))}
            {!returnRequests.length && <p className={styles.empty}>{config.panels.returns.empty}</p>}
          </div>
        </Panel>
      </section>

      <section className={styles.automationSection}>
        <Panel title={config.panels.team.title} action={`${team.filter((member) => member.role !== "customer").length} operational users`}>
          <div className={styles.list}>
            {team.filter((member) => member.role !== "customer").slice(0, 5).map((member) => (
              <div className={styles.row} key={member.id}>
                <span><b>{member.name}</b><small>{member.email}</small></span>
                <select value={member.role} onChange={(e) => updateRole(member.id, e.target.value)} className={styles.roleSelect}>
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                  <option value="customer">Customer</option>
                </select>
              </div>
            ))}
            {!team.length && <p className={styles.empty}>{config.panels.team.empty}</p>}
          </div>
        </Panel>
      </section>

      <section className={styles.automationSection}>
        <Panel title={config.panels.reconciliation.title} action={`${reconciliation.summary.pendingCount || 0} payments need review`}>
          <div className={styles.list}>
            {reconciliation.pending.slice(0, 4).map((payment) => (
              <div className={styles.row} key={payment.id}>
                <span><b>{payment.id}</b><small>{payment.customer} · {money(payment.amount)} · {payment.paymentType}</small></span>
                <strong className={styles.warning}>Pending</strong>
              </div>
            ))}
            {!reconciliation.pending.length && <p className={styles.empty}>{config.panels.reconciliation.empty}</p>}
          </div>
        </Panel>
      </section>

      <section className={styles.automationSection}>
        <Panel title={config.panels.procurement.title} action={`${procurement.orders.filter((order) => order.status !== "received").length} open POs`}>
          <div className={styles.list}>
            {procurement.orders.slice(0, 4).map((order) => (
              <div className={styles.row} key={order.id}>
                <span><b>{order.item}</b><small>{procurement.suppliers.find((supplier) => supplier.id === order.supplierId)?.name || "Supplier"} · {order.quantity} units</small></span>
                <strong className={order.status === "received" ? styles.ok : styles.warning}>{order.status}</strong>
              </div>
            ))}
            {!procurement.orders.length && <p className={styles.empty}>{config.panels.procurement.empty}</p>}
          </div>
        </Panel>
      </section>

      <section className={styles.automationSection}>
        <Panel title={config.panels.automation.title} action={config.panels.automation.action}>
          {rules.map((rule) => (
            <div className={styles.rule} key={rule.id}>
              <div><b>{rule.name}</b><small>{rule.description}</small></div>
              <label><input type="checkbox" checked={rule.enabled} onChange={(e) => saveRules(rules.map((item) => item.id === rule.id ? { ...item, enabled: e.target.checked } : item))} /> Active</label>
              <input aria-label={`${rule.name} setting`} value={rule.value} onChange={(e) => setRules(rules.map((item) => item.id === rule.id ? { ...item, value: e.target.value } : item))} onBlur={() => saveRules(rules)} />
            </div>
          ))}
          {!rules.length && <p className={styles.empty}>{config.panels.automation.loading}</p>}
        </Panel>
      </section>   

      <section className={styles.promoSection}>
        <Panel title={config.panels.promo.title} action={config.panels.promo.action}>
          <div className={styles.formGrid}>
            <input placeholder={config.forms.voucher.codePlaceholder} value={voucherForm.code} onChange={e => setVoucherForm({...voucherForm, code: e.target.value})} />
            <input placeholder={config.forms.voucher.titlePlaceholder} value={voucherForm.title} onChange={e => setVoucherForm({...voucherForm, title: e.target.value})} />
            <select value={voucherForm.type} onChange={e => setVoucherForm({...voucherForm, type: e.target.value})} className={styles.roleSelect}>
              <option value="shipping">Gratis Ongkir</option>
              <option value="percentage">Diskon %</option>
              <option value="fixed">Diskon Rupiah</option>
            </select>
            <input type="number" placeholder={config.forms.voucher.discountPlaceholder} value={voucherForm.discount_amount} onChange={e => setVoucherForm({...voucherForm, discount_amount: e.target.value})} />
            <input type="date" value={voucherForm.valid_until} onChange={e => setVoucherForm({...voucherForm, valid_until: e.target.value})} />
            <button className={styles.saveButton} onClick={handleSaveVoucher}>{config.panels.promo.buttonText}</button>
          </div>

          <div className={styles.list} style={{ marginTop: '20px' }}>
            {vouchers.map(v => (
              <div className={styles.row} key={v.id}>
                <span><b>{v.code}</b><small>{v.title} · Tipe: {v.type} · Diskon: {v.discount_amount}</small></span>
                <button onClick={() => handleDeleteVoucher(v.id)} style={{ color: 'var(--danger-color)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>{config.panels.promo.deleteText}</button>
              </div>
            ))}
            {!vouchers.length && <p className={styles.empty}>{config.panels.promo.empty}</p>}
          </div>
        </Panel>
        
        <Panel title={config.panels.checklist.title} action={config.panels.checklist.action}>
          <ul className={styles.checklist}>
            {config.panels.checklist.items.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </Panel>
      </section>

      <section className={styles.analytics}>
        <Panel title={config.panels.analytics.title} action={config.panels.analytics.action}>
          <div className={styles.metrics}>
            <Metric label="Traffic overview" value={`${orders.length} order sessions`} />
            <Metric label="Best seller" value={analytics.topProduct} />
            <Metric label="Sales by category" value={analytics.topCategory} />
            <Metric label="Peak sales hour" value={analytics.peakHour} />
          </div>
        </Panel>
      </section>
    </div>
  );
}

function Panel({ title, action, children }) { return <article className={styles.panel}><header><div><h3>{title}</h3><p>{action}</p></div></header>{children}</article>; }
function Notice({ count, label, danger }) { return <div className={`${styles.notice} ${danger ? styles.noticeDanger : ""}`}>{count > 0 && <span className={styles.notificationDot} />}<b>{count}</b><span>{label}</span></div>; }
function Metric({ label, value }) { return <div><small>{label}</small><b>{value}</b></div>; }