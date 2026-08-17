import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js"; // Atau sesuaikan dengan client supabase server Anda

// Inisialisasi Supabase Server Client (gunakan Service Role jika perlu bypass RLS, atau client standar)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request, context) {
  try {
    const { orderId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const userId = body.userId;

    if (!orderId) {
      return NextResponse.json({ error: "ID Pesanan tidak valid." }, { status: 400 });
    }

    // 1. Ambil data pesanan dari database (misal: tabel orders)
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan di database." }, { status: 404 });
    }

    // Jika sudah ada snap_token yang valid, bisa langsung dikembalikan
    if (order.snap_token) {
      return NextResponse.json({ snap_token: order.snap_token }, { status: 200 });
    }

    // 2. Siapkan parameter untuk Midtrans Snap API
    const isProduction = process.env.NODE_ENV === "production";
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    
    if (!serverKey) {
      return NextResponse.json({ error: "Midtrans Server Key belum dikonfigurasi di environment." }, { status: 500 });
    }

    const authString = Buffer.from(serverKey + ":").toString("base64");
    const snapUrl = isProduction
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    const grossAmount = Number(order.amount || order.total_amount || 0);

    const payload = {
      transaction_details: {
        order_id: order.id,
        gross_amount: grossAmount,
      },
      customer_details: {
        first_name: order.customer_name || "Pelanggan XAR",
        email: order.customer_email || "customer@xar.com",
      },
    };

    // 3. Request Snap Token ke Midtrans
    const midtransRes = await fetch(snapUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Basic ${authString}`,
      },
      body: JSON.stringify(payload),
    });

    const midtransData = await midtransRes.json();

    if (!midtransRes.ok || !midtransData.token) {
      return NextResponse.json({ 
        error: midtransData.error_messages?.[0] || "Gagal membuat transaksi dengan Midtrans." 
      }, { status: 400 });
    }

    const newSnapToken = midtransData.token;

    // 4. Simpan kembali snap_token ke database
    await supabase
      .from("orders")
      .update({ snap_token: newSnapToken })
      .eq("id", orderId);

    return NextResponse.json({ snap_token: newSnapToken }, { status: 200 });

  } catch (err) {
    console.error("Error in /api/user/orders/[orderId]/pay:", err);
    return NextResponse.json({ error: err.message || "Terjadi kesalahan internal server." }, { status: 500 });
  }
}