import { NextResponse } from "next/server";
import midtransClient from "midtrans-client";
import { db } from "@/lib/firebaseAdmin";

// Inisialisasi Midtrans Snap Client
let snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
});

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, orderId, amount, items, shippingAddress } = body;

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
    if (items && Array.isArray(items) && items.length > 0) {
      formattedItems = items.map((item) => ({
        id: String(item.id || item.cartId || "XAR-ITEM"),
        price: Number(item.price),
        quantity: Number(item.quantity),
        name: `${item.name} (${item.size || "Standard"})`.substring(0, 50),
      }));
    } else {
      formattedItems = [
        {
          id: orderId,
          price: Number(amount),
          quantity: 1,
          name: "XAR Store Order",
        },
      ];
    }

    // Format alamat pengiriman jika tersedia
    let shippingDetail = {};
    if (shippingAddress) {
      shippingDetail = {
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
        gross_amount: Number(amount),
      },
      item_details: formattedItems,
      customer_details: {
        first_name: customerName,
        email: customerEmail,
        phone: customerPhone,
        shipping_address: shippingAddress ? shippingDetail : undefined,
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
    await db
      .collection("orders")
      .doc(orderId)
      .set({
        orderId: orderId,
        userId: userId || "guest",
        customerName: customerName,
        customerEmail: customerEmail,
        items: items || [],
        amount: Number(amount),
        shippingAddress: shippingAddress || null,
        status: "pending",
        createdAt: new Date(),
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
