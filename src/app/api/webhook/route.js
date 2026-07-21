import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function POST(req) {
  try {
    const body = await req.json();
    const { order_id, transaction_status, signature_key, gross_amount } = body;

    // 1. Verifikasi Signature (Penting untuk keamanan!)
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const hash = crypto
      .createHash("sha512")
      .update(order_id + "200" + gross_amount + serverKey)
      .digest("hex");

    if (signature_key !== hash) {
      return NextResponse.json(
        { message: "Invalid Signature" },
        { status: 403 },
      );
    }

    // Inisialisasi Supabase dengan Service Role Key untuk akses backend yang aman
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Konfigurasi Supabase tidak ditemukan di server.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Update status di tabel "orders" Supabase
    if (
      transaction_status === "settlement" ||
      transaction_status === "capture"
    ) {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("order_id", order_id);

      if (error) {
        console.error("Supabase Update Error:", error);
        throw error;
      }
    } else if (
      transaction_status === "cancel" ||
      transaction_status === "expire" ||
      transaction_status === "deny"
    ) {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("order_id", order_id);

      if (error) {
        console.error("Supabase Update Error:", error);
        throw error;
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json(
      { message: "Internal Server Error", error: error.message },
      { status: 500 },
    );
  }
}
