import { NextResponse } from "next/server";
import midtransClient from "midtrans-client";
import { db } from "@/lib/firebaseAdmin";

let snap = new midtransClient.Snap({
  isProduction: process.env.NODE_ENV === "production",
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
});

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, orderId, amount, items, shippingAddress } = body;

    if (!orderId || !amount) {
      return NextResponse.json(
        { error: "orderId and amount are required" },
        { status: 400 },
      );
    }

    let customerName = "Customer MAMEKO";
    let customerEmail = "customer@mameko.my.id";
    let customerPhone = "08123456789";

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

    // Format item details dari cart items yang dikirim frontend
    let formattedItems = [];
    if (items && Array.isArray(items) && items.length > 0) {
      formattedItems = items.map((item) => ({
        id: String(item.id || item.cartId || "XAR-ITEM"),
        price: Number(item.price),
        quantity: Number(item.quantity),
        name: `${item.name} (${item.size})`.substring(0, 50), // Midtrans membatasi panjang nama item
      }));
    } else {
      // Fallback jika items kosong
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

    // 1. Buat Snap Token dari Midtrans
    const transaction = await snap.createTransaction(parameter);

    // 2. SIMPAN DATA PESANAN KE FIRESTORE (Collection: orders)
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
        status: "pending", // Status awal sebelum dibayar
        createdAt: new Date(),
      });

    return NextResponse.json({
      success: true,
      token: transaction.token,
      redirect_url: transaction.redirect_url,
    });
  } catch (error) {
    console.error("Midtrans Error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal membuat transaksi Midtrans" },
      { status: 500 },
    );
  }
}
