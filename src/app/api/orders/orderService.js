import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

function sanitizeData(obj) {
  const cleanObj = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      if (
        typeof obj[key] === "object" &&
        obj[key] !== null &&
        !Array.isArray(obj[key]) &&
        !(obj[key] instanceof Date)
      ) {
        cleanObj[key] = sanitizeData(obj[key]);
      } else {
        cleanObj[key] = obj[key];
      }
    }
  }
  return cleanObj;
}

function normalizeOrderStatus(status) {
  const normalized = String(status || "pending").toLowerCase();
  const allowed = [
    "pending",
    "paid",
    "processing",
    "shipped",
    "delivered",
    "completed",
    "cancelled",
    "success",
    "settlement",
  ];

  if (allowed.includes(normalized)) {
    if (normalized === "success" || normalized === "settlement") return "paid";
    if (normalized === "completed") return "delivered";
    return normalized;
  }

  return "pending";
}

function buildOrderNumber(createdAt = new Date()) {
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const random = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `ORD-${year}${month}${day}-${random}`;
}

function normalizeVariantSize(value) {
  return String(value || "default").trim().toLowerCase();
}

function aggregateOrderItems(items = []) {
  const grouped = new Map();

  for (const item of items || []) {
    const productId = String(
      item?.id || item?.productId || item?.product_id || "",
    ).trim();
    if (!productId) {
      continue;
    }

    const variantSize = String(
      item?.size || item?.variantId || item?.variant_id || "default",
    ).trim();
    const quantity = Number(item?.quantity || item?.qty || 1);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    const key = `${productId}::${normalizeVariantSize(variantSize)}`;
    const current = grouped.get(key);
    if (current) {
      current.quantity += quantity;
      continue;
    }

    grouped.set(key, {
      productId,
      variantSize,
      variantNormalized: normalizeVariantSize(variantSize),
      quantity,
    });
  }

  return Array.from(grouped.values());
}

async function restoreReservedStock(items = [], supabaseClient = supabase) {
  if (!supabaseClient) {
    throw new Error("Konfigurasi database produk belum siap untuk restock");
  }

  const aggregatedItems = aggregateOrderItems(items);
  for (const item of aggregatedItems) {
    const { data: product, error: fetchError } = await supabaseClient
      .from("products")
      .select("id,name,variants")
      .eq("id", item.productId)
      .single();

    if (fetchError || !product) {
      throw new Error(
        `Produk ${item.productId} tidak ditemukan saat mengembalikan stok`,
      );
    }

    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (variants.length === 0) {
      throw new Error(
        `Produk ${product.name || item.productId} tidak memiliki varian stok`,
      );
    }

    const variantIndex = variants.findIndex(
      (variant) => normalizeVariantSize(variant?.size) === item.variantNormalized,
    );

    if (variantIndex < 0) {
      throw new Error(
        `Varian ${item.variantSize || "default"} untuk produk ${product.name || item.productId} tidak ditemukan`,
      );
    }

    const targetVariant = variants[variantIndex] || {};
    const currentStock = Number(targetVariant.stock ?? targetVariant.stok ?? 0);
    const nextStock = (Number.isFinite(currentStock) ? currentStock : 0) + item.quantity;

    const nextVariants = variants.map((variant, index) => {
      if (index !== variantIndex) {
        return variant;
      }

      return {
        ...variant,
        stock: nextStock,
        stok: nextStock,
      };
    });

    const { error: updateError } = await supabaseClient
      .from("products")
      .update({ variants: nextVariants })
      .eq("id", item.productId);

    if (updateError) {
      throw new Error(
        `Gagal mengembalikan stok untuk produk ${product.name || item.productId}`,
      );
    }
  }
}

async function createOrderNotification(db, { userId, title, message, type = "order", link = null }) {
  if (!userId) return null;

  const payload = sanitizeData({
    userId,
    audience: "user",
    title,
    message,
    type,
    link,
    isRead: false,
    createdAt: new Date(),
  });

  const docRef = await db.collection("notifications").add(payload);
  return { id: docRef.id, ...payload };
}

function buildStatusHistoryEntry({ orderId, statusFrom, statusTo, changedBy, notes }) {
  return sanitizeData({
    id: `${Date.now()}-${crypto.randomBytes(2).toString("hex")}`,
    orderId,
    status_from: statusFrom || null,
    status_to: statusTo,
    changed_by: changedBy || "system",
    notes: notes || "",
    created_at: new Date().toISOString(),
  });
}

function sanitizeMetadataText(value, maxLength) {
  const cleaned = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "";
  }

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 3)}...`;
}

function buildStatusMetadata(statusMetadata = {}) {
  if (!statusMetadata || typeof statusMetadata !== "object") {
    return null;
  }

  const sourceFieldProvided = Object.prototype.hasOwnProperty.call(statusMetadata, "sourceField");
  const sourceField = sanitizeMetadataText(statusMetadata.sourceField || "unknown", 24);
  const gatewayStatusRaw = sanitizeMetadataText(statusMetadata.gatewayStatusRaw || "", 120);
  const gatewayStatusNormalized = sanitizeMetadataText(
    statusMetadata.gatewayStatusNormalized || "",
    64,
  );

  const hasMeaningfulValue = gatewayStatusRaw || gatewayStatusNormalized || sourceFieldProvided;
  if (!hasMeaningfulValue) {
    return null;
  }

  return sanitizeData({
    source_field: sourceField || "unknown",
    gateway_status_raw: gatewayStatusRaw,
    gateway_status_normalized: gatewayStatusNormalized,
  });
}

function buildOrderPayload({
  userId,
  orderId,
  items = [],
  address = null,
  shippingDetail = null,
  shippingCost = 0,
  discountAmount = 0,
  taxAmount = 0,
  paymentType = "Midtrans",
  notes = "",
  status = "pending",
  amount = 0,
  customerName = "",
  customerEmail = "",
  customerPhone = "",
  productName = "Katalog Belanja",
  concentration = "",
  stockReservedAt = null,
}) {
  const createdAt = new Date();
  const normalizedStatus = normalizeOrderStatus(status);
  const numericAmount = Math.max(0, Number(amount) || 0);
  const numericShippingCost = Math.max(0, Number(shippingCost) || 0);
  const numericDiscountAmount = Math.max(0, Number(discountAmount) || 0);
  const numericTaxAmount = Math.max(0, Number(taxAmount) || 0);
  const orderNumber = buildOrderNumber(createdAt);
  const initialHistory = [
    buildStatusHistoryEntry({
      orderId,
      statusFrom: null,
      statusTo: normalizedStatus,
      changedBy: "system",
      notes: "Pesanan dibuat",
    }),
  ];

  return sanitizeData({
    id: orderId,
    orderId,
    order_number: orderNumber,
    userId: userId || "guest",
    customerName,
    customerEmail,
    customerPhone,
    items: items || [],
    product_name: productName,
    concentration,
    notes,
    amount: numericAmount,
    total_amount: numericAmount,
    shipping_cost: numericShippingCost,
    tax_amount: numericTaxAmount,
    discount_amount: numericDiscountAmount,
    status: normalizedStatus,
    payment_type: paymentType || "Midtrans",
    shippingAddress: address || null,
    shipping_address: address || null,
    shippingDetail: shippingDetail || null,
    statusHistory: initialHistory,
    stockReservedAt: stockReservedAt || null,
    stock_reserved_at: stockReservedAt || null,
    createdAt,
    created_at: createdAt.toISOString(),
    updated_at: createdAt.toISOString(),
    cancelled_at: null,
    completed_at: null,
  });
}

async function createOrderRecord(
  db,
  {
    userId,
    orderId,
    items = [],
    address = null,
    shippingDetail = null,
    shippingCost = 0,
    discountAmount = 0,
    taxAmount = 0,
    paymentType = "Midtrans",
    notes = "",
    status = "pending",
    amount = 0,
    customerName = "",
    customerEmail = "",
    customerPhone = "",
    productName = "Katalog Belanja",
    concentration = "",
    stockReservedAt = null,
  },
) {
  const payload = buildOrderPayload({
    userId,
    orderId,
    items,
    address,
    shippingDetail,
    shippingCost,
    discountAmount,
    taxAmount,
    paymentType,
    notes,
    status,
    amount,
    customerName,
    customerEmail,
    customerPhone,
    productName,
    concentration,
    stockReservedAt,
  });

  const orderRef = db.collection("orders").doc(orderId);
  await orderRef.set(payload, { merge: true });

  const itemsCollection = orderRef.collection("order_items");
  for (const [index, item] of (items || []).entries()) {
    const itemId =
      item.id || item.productId || item.product_id || `${orderId}-${index + 1}`;
    await itemsCollection.doc(String(itemId)).set(
      sanitizeData({
        id: itemId,
        orderId,
        productId: item.id || item.productId || item.product_id || null,
        variantId: item.variantId || item.variant_id || null,
        quantity: Number(item.quantity || item.qty || 1),
        price: Number(item.price || 0),
        subtotal: Number(
          item.subtotal ||
            Number(item.price || 0) * Number(item.quantity || item.qty || 1) ||
            0,
        ),
        size: item.size || null,
        name: item.name || null,
      }),
      { merge: true },
    );
  }

  const shippingDoc = orderRef.collection("shipping_details").doc("primary");
  if (address || shippingDetail) {
    await shippingDoc.set(
      sanitizeData({
        orderId,
        courier_name:
          shippingDetail?.courierName || shippingDetail?.courier_name || null,
        service_type:
          shippingDetail?.serviceType || shippingDetail?.service_type || null,
        tracking_number:
          shippingDetail?.trackingNumber || shippingDetail?.tracking_number || null,
        shipping_address: address || null,
        recipient_name: address?.recipientName || address?.recipient_name || null,
        phone_number: address?.recipientPhone || address?.recipient_phone || null,
      }),
      { merge: true },
    );
  }

  const historyRef = orderRef.collection("order_status_history").doc("initial");
  await historyRef.set(sanitizeData(payload.statusHistory[0]), { merge: true });

  if (userId) {
    await createOrderNotification(db, {
      userId,
      title: "Pesanan dibuat",
      message: `Pesanan ${payload.order_number || payload.id} berhasil dibuat dan sedang menunggu pembayaran.`,
      type: "order",
      link: `/account/orders/${orderId}`,
    });
  }

  return payload;
}

async function updateOrderStatus(
  db,
  orderId,
  targetStatus,
  changedBy = "system",
  notes = "",
  options = {},
) {
  const orderRef = db.collection("orders").doc(orderId);
  const orderDoc = await orderRef.get();
  if (!orderDoc.exists) {
    throw new Error("Pesanan tidak ditemukan");
  }

  const current = orderDoc.data();
  const nextStatus = normalizeOrderStatus(targetStatus);
  const previousStatus = normalizeOrderStatus(current.status || "pending");
  const historyEntry = buildStatusHistoryEntry({
    orderId,
    statusFrom: current.status || null,
    statusTo: nextStatus,
    changedBy,
    notes,
  });
  const baseStatusMetadata = buildStatusMetadata(options.statusMetadata || null);
  const statusMetadataRecordedAt = baseStatusMetadata ? new Date().toISOString() : null;
  const statusMetadata = baseStatusMetadata
    ? {
      ...baseStatusMetadata,
      recorded_at: statusMetadataRecordedAt,
    }
    : null;

  if (statusMetadata) {
    historyEntry.status_metadata = statusMetadata;
  }
  const existingHistory = Array.isArray(current.statusHistory) ? current.statusHistory : [];
  const nextHistory = [...existingHistory, historyEntry].slice(-50);
  const stockWasReserved = Boolean(current.stockReservedAt || current.stock_reserved_at);
  const stockWasRestored = Boolean(current.stockRestoredAt || current.stock_restored_at);
  const shouldRestoreStock =
    nextStatus === "cancelled" &&
    previousStatus !== "cancelled" &&
    stockWasReserved &&
    !stockWasRestored &&
    ["pending", "paid", "processing"].includes(previousStatus);

  if (shouldRestoreStock) {
    await restoreReservedStock(current.items || [], options.supabaseClient || supabase);
  }

  const updateData = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
    statusHistory: nextHistory,
  };

  if (statusMetadata) {
    updateData.last_status_metadata = statusMetadata;
    updateData.last_status_metadata_recorded_at = statusMetadataRecordedAt;
  }

  if (shouldRestoreStock) {
    const restoredAt = new Date().toISOString();
    updateData.stockRestoredAt = restoredAt;
    updateData.stock_restored_at = restoredAt;
  }

  if (nextStatus === "delivered" || nextStatus === "completed") {
    updateData.completed_at = new Date().toISOString();
  }

  if (nextStatus === "cancelled") {
    updateData.cancelled_at = new Date().toISOString();
  }

  await orderRef.set(sanitizeData(updateData), { merge: true });

  const historyRef = orderRef.collection("order_status_history").doc(historyEntry.id);
  await historyRef.set(sanitizeData(historyEntry), { merge: true });

  if (previousStatus !== nextStatus && current.userId) {
    const templates = {
      paid: {
        title: "Pembayaran diterima",
        message: `Pembayaran untuk pesanan ${current.order_number || orderId} telah diterima.`,
        type: "payment",
      },
      processing: {
        title: "Pesanan diproses",
        message: `Pesanan ${current.order_number || orderId} sedang diproses oleh tim kami.`,
        type: "order",
      },
      shipped: {
        title: "Pesanan dikirim",
        message: `Pesanan ${current.order_number || orderId} sudah dikirim dan sedang dalam perjalanan.`,
        type: "order",
      },
      delivered: {
        title: "Pesanan selesai",
        message: `Pesanan ${current.order_number || orderId} telah selesai dan siap untuk ditinjau.`,
        type: "order",
      },
      cancelled: {
        title: "Pesanan dibatalkan",
        message: `Pesanan ${current.order_number || orderId} telah dibatalkan.`,
        type: "order",
      },
    };

    const template = templates[nextStatus];
    if (template) {
      await createOrderNotification(db, {
        userId: current.userId,
        title: template.title,
        message: template.message,
        type: template.type,
        link: `/account/orders/${orderId}`,
      });
    }
  }

  return { ...current, ...updateData, status: nextStatus };
}

function mapOrderDoc(doc) {
  const order = doc.data() || {};
  return {
    id: doc.id,
    ...order,
    createdAt: order.createdAt?.toDate
      ? order.createdAt.toDate().toISOString()
      : order.createdAt || order.created_at || new Date().toISOString(),
    statusHistory: Array.isArray(order.statusHistory) ? order.statusHistory : [],
  };
}

function normalizeDateToMs(value) {
  if (!value) {
    return 0;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate().getTime() || 0;
  }

  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getLastStatusMetadataRecordedAt(order = {}) {
  return (
    order.last_status_metadata_recorded_at ||
    order.last_status_metadata?.recorded_at ||
    null
  );
}

function hasWebhookStatusMetadata(order = {}) {
  return Boolean(getLastStatusMetadataRecordedAt(order));
}

function filterOrdersWithWebhookMetadata(orders = []) {
  return (orders || []).filter((order) => hasWebhookStatusMetadata(order));
}

function sortOrdersByWebhookLatest(orders = [], { fallbackToCreatedAt = true } = {}) {
  const cloned = Array.isArray(orders) ? [...orders] : [];

  cloned.sort((left, right) => {
    const rightWebhook = normalizeDateToMs(getLastStatusMetadataRecordedAt(right));
    const leftWebhook = normalizeDateToMs(getLastStatusMetadataRecordedAt(left));

    if (rightWebhook !== leftWebhook) {
      return rightWebhook - leftWebhook;
    }

    if (!fallbackToCreatedAt) {
      return 0;
    }

    const rightCreated = normalizeDateToMs(right?.createdAt || right?.created_at);
    const leftCreated = normalizeDateToMs(left?.createdAt || left?.created_at);
    return rightCreated - leftCreated;
  });

  return cloned;
}

export {
  sanitizeData,
  normalizeOrderStatus,
  buildOrderNumber,
  buildOrderPayload,
  createOrderRecord,
  updateOrderStatus,
  mapOrderDoc,
  getLastStatusMetadataRecordedAt,
  hasWebhookStatusMetadata,
  filterOrdersWithWebhookMetadata,
  sortOrdersByWebhookLatest,
};
export default {
  sanitizeData,
  normalizeOrderStatus,
  buildOrderNumber,
  buildOrderPayload,
  createOrderRecord,
  updateOrderStatus,
  mapOrderDoc,
  getLastStatusMetadataRecordedAt,
  hasWebhookStatusMetadata,
  filterOrdersWithWebhookMetadata,
  sortOrdersByWebhookLatest,
};
