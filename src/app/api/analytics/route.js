import { NextResponse } from "next/server";
import midtransClient from "midtrans-client";

const snap = new midtransClient.Snap({
  isProduction: process.env.NODE_ENV === "production",
  serverKey: process.env.MIDTRANS_SERVER_KEY,
});

export async function POST(req) {
  try {
    const { items, customerDetails } = await req.json();

    // Validasi data
    if (!items || items.length === 0) {
      return NextResponse.json({ message: "Cart is empty" }, { status: 400 });
    }

    // 1. Generate Order ID di Server (Penting untuk keamanan)
    const orderId = `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // 2. Hitung Total di Server (Jangan percaya frontend untuk hitungan harga)
    const grossAmount = items.reduce((acc, item) => {
      return acc + item.price * item.quantity;
    }, 0);

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(grossAmount), // Harus Integer
      },
      item_details: items.map((item) => ({
        id: item.id.toString(),
        price: Math.round(item.price), // Harus Integer
        quantity: item.quantity,
        name: item.name.substring(0, 50), // Midtrans punya limit karakter
      })),
      customer_details: {
        first_name: customerDetails?.name || "Guest",
        email: customerDetails?.email || "guest@example.com",
      },
      credit_card: { secure: true },
    };

    const transaction = await snap.createTransaction(parameter);

    // Kirim token dan orderId kembali ke frontend
    return NextResponse.json({
      token: transaction.token,
      orderId: orderId,
    });
  } catch (error) {
    console.error("Midtrans Error:", error);
    return NextResponse.json(
      { message: "Internal Server Error", error: error.message },
      { status: 500 },
    );
  }
}
