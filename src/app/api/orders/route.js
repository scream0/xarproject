import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin"; // Firebase Admin SDK untuk backend (Orders & User)
import { createClient } from "@supabase/supabase-js"; // Supabase Client untuk Produk
import { createOrderRecord, mapOrderDoc, updateOrderStatus } from "./orderService";
import {
  buildRequestedItems,
  createCheckoutReservationService,
} from "./checkoutReservationService";

export const dynamic = "force-dynamic";

// Inisialisasi Supabase Server Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

// Helper untuk membersihkan nilai undefined agar tidak error di Firestore
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

const checkoutReservationService = createCheckoutReservationService({
  db,
  supabase,
});

// GET -> Mengambil Alamat Utama User & Daftar Pesanan dari Firestore
// - Jika userId DIKIRIM  -> mode USER: alamat + pesanan milik user tsb (untuk halaman akun user)
// - Jika userId TIDAK DIKIRIM -> mode ADMIN: SEMUA pesanan (untuk dashboard admin / OverviewStats)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    // ================= MODE ADMIN (tanpa userId) =================
    if (!userId) {
      const page = parseInt(searchParams.get("page")) || 1;
      const limit = parseInt(searchParams.get("limit")) || 10;
      const offset = (page - 1) * limit;

      // Get total count for pagination
      const countSnapshot = await db.collection("orders").count().get();
      const totalOrders = countSnapshot.data().count;
      const totalPages = Math.ceil(totalOrders / limit);
      
      const ordersQuery = db.collection("orders")
                            .orderBy("createdAt", "desc")
                            .limit(limit)
                            .offset(offset);
      const ordersSnapshot = await ordersQuery.get();
      
      let ordersData = [];
      ordersSnapshot.forEach((doc) => {
        ordersData.push(mapOrderDoc(doc));
      });

      return NextResponse.json({
        success: true,
        orders: ordersData,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalOrders: totalOrders
        }
      });
    }

    // ================= MODE USER (dengan userId) =================

    // 1. Ambil Alamat User dari Firestore
    let userPrimaryAddress = "Belum diatur";
    try {
      const userDoc = await db.collection("users").doc(userId).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        if (
          data.addresses &&
          Array.isArray(data.addresses) &&
          data.addresses.length > 0
        ) {
          const primary =
            data.addresses.find((a) => a.isPrimary) || data.addresses[0];
          userPrimaryAddress = `${primary.label || "Alamat"} - ${primary.recipientName} (${primary.recipientPhone}): ${primary.street}, ${primary.city} (${primary.postalCode})`;
        } else if (data.shipping_address) {
          userPrimaryAddress = data.shipping_address;
        } else if (data.shippingAddress) {
          const sa = data.shippingAddress;
          userPrimaryAddress = `${sa.label || "Alamat"} - ${sa.recipientName} (${sa.recipientPhone}): ${sa.street}, ${sa.city} (${sa.postalCode})`;
        }
      }
    } catch (err) {
      console.error("Gagal mengambil alamat dari Firestore:", err);
    }

    // 2. Ambil Daftar Pesanan milik user dari Firestore (Collection: orders)
    const ordersSnapshot = await db
      .collection("orders")
      .where("userId", "==", userId)
      .get();

    let ordersData = [];
    ordersSnapshot.forEach((doc) => {
      ordersData.push(mapOrderDoc(doc));
    });

    // Urutkan pesanan dari yang terbaru
    ordersData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return NextResponse.json({
      success: true,
      primaryAddress: userPrimaryAddress,
      orders: ordersData,
    });
  } catch (error) {
    console.error("Gagal mengambil data orders dari Firestore:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}

// POST -> Menyimpan pesanan baru (Termasuk array items keranjang) ke Firestore
export async function POST(request) {
  const stockLockOwner = `checkout-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const acquiredLocks = [];
  let reservations = [];

  try {
    const body = await request.json().catch(() => ({}));
    const {
      userId,
      orderId,
      order,
      items,
      address,
      status,
      paymentType,
      shippingDetail,
      shippingCost,
      discountAmount,
      taxAmount,
      amount,
      customerName,
      customerEmail,
      customerPhone,
      notes,
    } = body;

    if (!userId || !orderId) {
      return NextResponse.json(
        { error: "userId and orderId are required" },
        { status: 400 },
      );
    }

    const orderItems = Array.isArray(items) ? items : [];
    if (orderItems.length === 0) {
      return NextResponse.json(
        { error: "items wajib ada untuk membuat pesanan" },
        { status: 400 },
      );
    }

    const requestedItems = buildRequestedItems(orderItems);
    const lockKeys = requestedItems
      .map((item) => `product:${item.productId}:variant:${item.variantNormalized}`)
      .sort((a, b) => a.localeCompare(b));

    for (const lockKey of lockKeys) {
      const lockRef = await checkoutReservationService.acquireInventoryLock(
        lockKey,
        stockLockOwner,
      );
      acquiredLocks.push(lockRef);
    }

    reservations = await checkoutReservationService.reserveStockInSupabase(
      requestedItems,
    );
    const stockReservedAt = new Date().toISOString();

    const payload = await createOrderRecord(db, {
      userId,
      orderId,
      items: orderItems,
      address,
      shippingDetail,
      shippingCost,
      discountAmount,
      taxAmount,
      paymentType,
      notes: notes || order?.notes || "",
      status: status || "pending",
      amount: amount || Number(order?.rawPrice || order?.price || 0),
      customerName: customerName || order?.customerName || "",
      customerEmail: customerEmail || order?.customerEmail || "",
      customerPhone: customerPhone || order?.customerPhone || "",
      productName: order?.name || "Katalog Belanja",
      concentration: order?.concentration || "",
      stockReservedAt,
    });

    return NextResponse.json({
      success: true,
      message: "Pesanan berhasil dibuat dan stok sudah direservasi",
      order: payload,
    });
  } catch (error) {
    if (reservations.length > 0) {
      await checkoutReservationService.rollbackReservations(reservations);
    }

    console.error("Gagal menyimpan pesanan ke Firestore:", error);

    const statusCode = Number(error?.status) || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: statusCode },
    );
  } finally {
    await checkoutReservationService.releaseInventoryLocks(
      acquiredLocks,
      stockLockOwner,
    );
  }
}

// PUT -> Memperbarui status pesanan (Pembayaran sukses / Konfirmasi Seller) & Mengurangi Stok di Supabase
export async function PUT(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { orderId, status, newStatus, shippingReceiptNumber } = body;
    const targetStatus = newStatus || status;

    if (!orderId || !targetStatus) {
      return NextResponse.json(
        { error: "orderId and status are required" },
        { status: 400 },
      );
    }

    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return NextResponse.json(
        { error: "Pesanan tidak ditemukan" },
        { status: 404 },
      );
    }

    const orderData = orderDoc.data();
    const normalizedTargetStatus = String(targetStatus).toLowerCase();

    if (normalizedTargetStatus === "cancelled") {
      const updatedOrder = await updateOrderStatus(
        db,
        orderId,
        "cancelled",
        "admin",
        "Pesanan dibatalkan melalui endpoint /api/orders",
      );

      return NextResponse.json({
        success: true,
        message: "Pesanan dibatalkan dan stok yang direservasi telah dipulihkan",
        order: updatedOrder,
      });
    }

    // JIKA STATUS BERUBAH MENJADI "success" atau "settlement" (Pembayaran Berhasil):
    // Kurangi stok produk yang ada di Supabase berdasarkan item yang dibeli
    const isSuccessStatus =
      targetStatus.toLowerCase() === "success" ||
      targetStatus.toLowerCase() === "settlement" ||
      targetStatus.toLowerCase() === "processing";

    const wasAlreadySuccess =
      orderData.status?.toLowerCase() === "success" ||
      orderData.status?.toLowerCase() === "settlement" ||
      orderData.status?.toLowerCase() === "processing";

    const stockWasReserved = Boolean(
      orderData.stockReservedAt || orderData.stock_reserved_at,
    );

    if (isSuccessStatus && !wasAlreadySuccess && !stockWasReserved && supabase) {
      const items = orderData.items || [];

      for (const item of items) {
        const productId = String(
          item.id || item.productId || item.product_id || "",
        );
        const orderedSize = String(item.size);
        const orderedQty = Number(item.quantity || item.qty) || 1;

        if (productId) {
          const { data: product, error: fetchError } = await supabase
            .from("products")
            .select("variants")
            .eq("id", productId)
            .single();

          if (!fetchError && product && product.variants) {
            let variants = product.variants;

            variants = variants.map((v) => {
              if (String(v.size).trim() === orderedSize.trim()) {
                const currentStock = Number(v.stock ?? v.stok ?? 0);
                const newStock = Math.max(0, currentStock - orderedQty);
                return {
                  ...v,
                  stock: newStock,
                  stok: newStock,
                };
              }
              return v;
            });

            await supabase
              .from("products")
              .update({ variants: variants })
              .eq("id", productId);
          }
        }
      }
    }

    // Siapkan data untuk diupdate di Firestore
    const updateData = {
      status: targetStatus,
      updated_at: new Date(),
      statusHistory: [
        ...(Array.isArray(orderData.statusHistory) ? orderData.statusHistory : []),
        { status: targetStatus, changedAt: new Date().toISOString(), source: "admin" },
      ].slice(-50),
    };

    if (shippingReceiptNumber) {
      updateData.shippingReceiptNumber = shippingReceiptNumber;
    }

    await orderRef.set(sanitizeData(updateData), { merge: true });

    return NextResponse.json({
      success: true,
      message: `Status pesanan berhasil diperbarui menjadi ${targetStatus} dan stok Supabase diperbarui`,
    });
  } catch (error) {
    console.error("Gagal memperbarui status pesanan & stok:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
