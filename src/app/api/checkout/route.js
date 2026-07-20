import { NextResponse } from "next/server";
import midtransClient from "midtrans-client";
import { db } from "@/lib/firebaseAdmin";

export async function POST(req) {
  try {
    const body = await req.json();
    const { items, customerDetails } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ message: "Cart is empty" }, { status: 400 });
    }

    // 1. Setup Snap
    const snap = new midtransClient.Snap({
      isProduction: false,
      // untuk production
      //isProduction: process.env.NODE_ENV === "production",
      serverKey: process.env.MIDTRANS_SERVER_KEY,
    });
    // Tambahkan ini sebelum bagian Snap setup
    console.log(
      "DEBUG: Mode Production?",
      process.env.NODE_ENV === "production",
    );
    console.log(
      "DEBUG: Panjang Kunci:",
      process.env.MIDTRANS_SERVER_KEY
        ? process.env.MIDTRANS_SERVER_KEY.length
        : "KOSONG",
    );
    console.log(
      "DEBUG: 5 Karakter Awal Kunci:",
      process.env.MIDTRANS_SERVER_KEY
        ? process.env.MIDTRANS_SERVER_KEY.substring(0, 5)
        : "TIDAK ADA",
    );
    const orderId = `ORDER-${Date.now()}`;

    // Pastikan total adalah Number (Integer)
    const total = items.reduce(
      (acc, item) => acc + Number(item.price) * Number(item.quantity),
      0,
    );

    // 2. Simpan ke Firebase
    await db.collection("orders").doc(orderId).set({
      orderId,
      items,
      customer: customerDetails,
      total,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    // 3. Parameter Midtrans
    let parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(total), // Harus Integer
      },
      item_details: items.map((item) => ({
        id: (item.id || "item").toString(), // Harus String
        price: Math.round(Number(item.price)), // Harus Integer
        quantity: Number(item.quantity), // Harus Integer
        name: (item.name || "Product").substring(0, 50),
      })),
      customer_details: {
        first_name: customerDetails?.name || "Guest",
        email: customerDetails?.email || "guest@example.com",
        phone: customerDetails?.phone || "0000000000",
      },
    };

    // 4. Minta Token
    const transaction = await snap.createTransaction(parameter);

    return NextResponse.json({
      token: transaction.token,
      orderId: orderId,
    });
  } catch (error) {
    // --- PENYESUAIAN PENTING: Menangkap detail error dari Midtrans ---
    let errorMessage = error.message;

    // Midtrans biasanya memberikan detail error di error.ApiResponse
    if (error.ApiResponse && error.ApiResponse.error_messages) {
      errorMessage = error.ApiResponse.error_messages.join(", ");
      console.error(
        "MIDTRANS VALIDATION ERROR:",
        error.ApiResponse.error_messages,
      );
    } else {
      console.error("SERVER ERROR DETAIL:", error);
    }

    return NextResponse.json(
      { message: "Terjadi kesalahan di server", error: errorMessage },
      { status: 500 },
    );
  }
}
