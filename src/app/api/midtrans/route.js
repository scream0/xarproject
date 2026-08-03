import { NextResponse } from "next/server";
import midtransClient from "midtrans-client";
import { db } from "@/lib/firebaseAdmin";
import { createOrderRecord } from "../orders/orderService";

// Inisialisasi Midtrans Snap Client
let snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
});

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      userId,
      orderId,
      amount,
      items,
      shippingAddress,
      shippingCost,
      shippingDetail,
      discountAmount,
    } = body;

    if (!orderId || !amount) {
      return NextResponse.json(
        { success: false, error: "orderId and amount are required" },
        { status: 400 },
      );
    }

    let customerName = "Customer XAR Store";
    let customerEmail = "customer@xarstore.com";
    let customerPhone = "08123456789";

    // Ambil data user dari Firestore jika userId tersedia
    if (userId) {
      try {
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          customerName =
            userData.full_name || userData.username || customerName;
          customerEmail = userData.email || customerEmail;
          customerPhone = userData.phone || customerPhone;
        }
      } catch (err) {
        console.warn(
          "Gagal mengambil data user dari Firestore untuk Midtrans:",
          err.message,
        );
      }
    }

    // Format item details dari cart items
    let formattedItems = [];
    const itemSubtotal = (items || []).reduce(
      (sum, item) => sum + Math.round(Number(item.price) || 0) * Math.max(1, Number(item.quantity) || 1),
      0,
    );

    if (items && Array.isArray(items) && items.length > 0) {
      formattedItems = items.map((item) => ({
        id: String(item.id || item.cartId || "XAR-ITEM").substring(0, 50),
        price: Math.round(Number(item.price) || 0),
        quantity: Math.max(1, Number(item.quantity) || 1),
        name: `${item.name} (${item.size || "Standard"})`.substring(0, 50),
      }));
    } else {
      formattedItems = [
        {
          id: orderId,
          price: Math.round(Number(itemSubtotal) || Math.round(Number(amount) || 0)),
          quantity: 1,
          name: "XAR Store Order",
        },
      ];
    }

    const promoDiscount = Math.max(0, Math.round(Number(discountAmount) || 0));
    if (promoDiscount > 0) {
      formattedItems.push({
        id: "PROMO-DISCOUNT",
        price: -promoDiscount,
        quantity: 1,
        name: "Diskon Promo",
      });
    }

    // Jika ada ongkir, tambahkan sebagai item detail "Ongkos Kirim".
    // Ini memastikan jumlah gross_amount sama dengan penjumlahan item_details
    // sehingga transaksi Midtrans tidak ditolak karena mismatch harga.
    const shippingCostNumber = Math.max(0, Math.round(Number(shippingCost) || 0));
    if (shippingCostNumber > 0) {
      formattedItems.push({
        id: "SHIPPING-COST",
        price: shippingCostNumber,
        quantity: 1,
        name: "Ongkos Kirim",
      });
    }

    const computedGrossAmount = formattedItems.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0,
    );
    const normalizedGrossAmount = Math.max(0, Math.round(computedGrossAmount || Number(amount) || 0));

    // Format alamat pengiriman untuk Midtrans customer_details
    let midtransShippingDetail = {};
    if (shippingAddress) {
      midtransShippingDetail = {
        first_name: shippingAddress.recipientName || customerName,
        phone: shippingAddress.recipientPhone || customerPhone,
        address: shippingAddress.street || "",
        city: shippingAddress.city || "",
        postal_code: shippingAddress.postalCode || "",
        country_code: "IDN",
      };
    }

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: normalizedGrossAmount,
      },
      item_details: formattedItems,
      customer_details: {
        first_name: customerName,
        email: customerEmail,
        phone: customerPhone,
        shipping_address: shippingAddress ? midtransShippingDetail : undefined,
      },
    };

    // 1. Buat Snap Token dari Midtrans dengan pengaman timeout jaringan (15 detik)
    const transactionPromise = snap.createTransaction(parameter);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Koneksi ke Midtrans Timeout (ETIMEDOUT). Periksa jaringan Anda.",
            ),
          ),
        15000,
      ),
    );

    const transaction = await Promise.race([
      transactionPromise,
      timeoutPromise,
    ]);

    // 2. Simpan data pesanan ke Firestore (Collection: orders)
    await createOrderRecord(db, {
      userId: userId || "guest",
      orderId,
      items: items || [],
      address: shippingAddress || null,
      shippingDetail: shippingDetail || null,
      shippingCost: shippingCostNumber,
      amount: normalizedGrossAmount,
      customerName,
      customerEmail,
      customerPhone,
      status: "pending",
      paymentType: "Midtrans",
    });

    return NextResponse.json({
      success: true,
      token: transaction.token,
      redirect_url: transaction.redirect_url,
    });
  } catch (error) {
    console.error("Midtrans API Error:", error.message || error);

    // Berikan pesan error yang deskriptif jika terjadi timeout/koneksi terputus
    const errorMessage =
      error.message.includes("ETIMEDOUT") || error.message.includes("Timeout")
        ? "Koneksi ke server Midtrans terhalang (Timeout). Pastikan jaringan atau firewall lokal mengizinkan akses ke port 443."
        : error.message || "Gagal membuat transaksi Midtrans";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
