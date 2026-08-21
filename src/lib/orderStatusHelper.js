// Helper bersama untuk update status pesanan.
// Dipakai oleh:
//   - /api/admin/orders/[id]/status (Orders tab di admin dashboard)
//   - /api/admin/orders/[id]/shipping (update info pengiriman)
//   - /api/orders/update-status (redirect callback dari Midtrans)
//
// Sebelumnya logic ini ter-copy-paste di 3 tempat dengan daftar status yang
// tidak konsisten satu sama lain. Sekarang satu sumber kebenaran di sini.

const ALLOWED_ORDER_STATUSES = new Set([
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "completed", // alias lama untuk "delivered", dipertahankan untuk kompatibilitas data lama
  "return_requested",
  "returning",
  "returned",
  "cancelled",
  "settlement", // alias status Midtrans untuk "paid"
  "success", // alias status Midtrans untuk "paid"
]);

// Status yang menandakan pembayaran sudah masuk -> stok harus dikurangi
// begitu order PERTAMA KALI mencapai salah satu status ini.
const STOCK_DECREMENT_STATUSES = new Set([
  "paid",
  "processing",
  "success",
  "settlement",
]);

function isStockDecrementStatus(status) {
  return STOCK_DECREMENT_STATUSES.has(String(status || "").toLowerCase());
}

/**
 * Mengurangi stok produk secara atomik untuk item-item dalam sebuah order,
 * tapi hanya jika order baru PERTAMA KALI masuk ke status yang mengindikasikan
 * pembayaran diterima (mencegah stok dikurangi dua kali untuk order yang sama).
 */
async function decrementStockIfNeeded(supabaseAdmin, { orderId, items, currentStatus, nextStatus }) {
  const alreadyDecremented = isStockDecrementStatus(currentStatus);
  const shouldDecrement = isStockDecrementStatus(nextStatus);

  if (!shouldDecrement || alreadyDecremented) {
    return { decremented: false };
  }

  const itemsToDecrement = (items || []).map((item) => ({
    product_id: item.product_id,
    variant_name: item.variant_name,
    quantity: item.quantity,
  }));

  if (itemsToDecrement.length === 0) {
    return { decremented: false };
  }

  const { error: decrementError } = await supabaseAdmin.rpc("decrement_stock", {
    items_to_decrement: itemsToDecrement,
  });

  if (decrementError) {
    // Jangan gagalkan seluruh update status hanya karena stok gagal dikurangi;
    // catat errornya supaya bisa direkonsiliasi manual.
    console.error(`Atomic stock decrement failed for order ${orderId}:`, decrementError);
    return { decremented: false, error: decrementError };
  }

  return { decremented: true };
}

/**
 * Update status sebuah order: validasi status, catat history, kurangi stok
 * bila perlu, dan (opsional) simpan nomor resi sekaligus.
 * Melempar Error dengan properti `.status` (kode HTTP) bila gagal validasi.
 */
async function applyOrderStatusUpdate(supabaseAdmin, {
  orderId,
  targetStatus,
  changedBy = "admin",
  notes = "",
  shippingReceiptNumber = null,
  extraPayload = {},
}) {
  const normalizedStatus = String(targetStatus || "").toLowerCase();

  if (!orderId || !normalizedStatus) {
    const error = new Error("orderId and status are required");
    error.status = 400;
    throw error;
  }

  if (!ALLOWED_ORDER_STATUSES.has(normalizedStatus)) {
    const error = new Error("Invalid order status");
    error.status = 400;
    throw error;
  }

  const { data: orderData, error: fetchError } = await supabaseAdmin
    .from("orders")
    .select("status, status_history, items:order_items(*)")
    .eq("id", orderId)
    .single();

  if (fetchError || !orderData) {
    const error = new Error("Order not found");
    error.status = 404;
    throw error;
  }

  const currentStatus = (orderData.status || "").toLowerCase();

  await decrementStockIfNeeded(supabaseAdmin, {
    orderId,
    items: orderData.items,
    currentStatus,
    nextStatus: normalizedStatus,
  });

  const historyEntry = {
    status: normalizedStatus,
    notes: notes || `Status diperbarui menjadi ${normalizedStatus}`,
    actor: changedBy,
    timestamp: new Date().toISOString(),
  };

  const updatePayload = {
    ...extraPayload,
    status: normalizedStatus,
    status_history: [...(orderData.status_history || []), historyEntry],
  };

  if (shippingReceiptNumber) {
    updatePayload.shipping_receipt_number = shippingReceiptNumber;
  }

  const { data: updatedOrder, error: updateError } = await supabaseAdmin
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId)
    .select()
    .single();

  if (updateError) throw updateError;

  return updatedOrder;
}

export {
  ALLOWED_ORDER_STATUSES,
  STOCK_DECREMENT_STATUSES,
  isStockDecrementStatus,
  decrementStockIfNeeded,
  applyOrderStatusUpdate,
};
