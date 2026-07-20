import { NextResponse } from "next/server";
import midtransClient from "midtrans-client";
import { createClient } from "@supabase/supabase-js";

// Inisialisasi Supabase
// Gunakan SUPABASE_SERVICE_ROLE_KEY (bukan ANON_KEY) agar punya akses write ke database
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export async function POST(req) {
  try {
    const body = await req.json();
    const { items, customerDetails } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ message: "Cart is empty" }, { status: 400 });
    }

    // 1. Setup Snap Midtrans
    const snap = new midtransClient.Snap({
      isProduction: false,
      serverKey: process.env.MIDTRANS_SERVER_KEY,
    });

    const orderId = `ORDER-${Date.now()}`;

    // Pastikan total adalah Number (Integer)
    const total = items.reduce(
      (acc, item) => acc + Number(item.price) * Number(item.quantity),
      0,
    );

    // 2. Simpan ke Supabase
    const { error: dbError } = await supabase.from("orders").insert([
      {
        order_id: orderId, // sesuaikan nama kolom dengan tabel di Supabase
        items: items,
        customer: customerDetails,
        total: total,
        status: "pending",
        created_at: new Date().toISOString(),
      },
    ]);

    if (dbError) {
      console.error("Supabase Error:", dbError);
      throw new Error("Gagal menyimpan data order");
    }

    // 3. Parameter Midtrans
    let parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(total),
      },
      item_details: items.map((item) => ({
        id: (item.id || "item").toString(),
        price: Math.round(Number(item.price)),
        quantity: Number(item.quantity),
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
    console.error("SERVER ERROR DETAIL:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan di server", error: error.message },
      { status: 500 },
    );
  }
}
