import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(request, context) {
  try {
    const params = context?.params ? await context.params : {};
    const orderId = params?.id || params?.orderId;
    const body = await request.json().catch(() => ({}));
    const userId = body.userId;

    if (!orderId) {
      return NextResponse.json({ error: "ID Pesanan tidak valid." }, { status: 400 });
    }

    // 1. Ambil data pesanan dari database (by id atau order_number)
    let order = null;
    const { data: byId } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (byId) {
      order = byId;
    } else {
      const { data: byNum } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("order_number", orderId)
        .maybeSingle();
      order = byNum;
    }

    if (!order) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan di database." }, { status: 404 });
    }

    // Jika sudah ada snap_token yang valid, langsung kembalikan
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

    const originHeader = request.headers.get("origin") || request.headers.get("referer");
    let baseUrl = "http://localhost:3000";
    if (originHeader) {
      try {
        const urlObj = new URL(originHeader);
        baseUrl = `${urlObj.protocol}//${urlObj.host}`;
      } catch {}
    }

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
      callbacks: {
        finish: `${baseUrl}/account/orders/${order.id}?order_id=${order.id}`,
        unfinish: `${baseUrl}/account/orders/${order.id}?order_id=${order.id}`,
        error: `${baseUrl}/account/orders/${order.id}?order_id=${order.id}`,
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
    await supabaseAdmin
      .from("orders")
      .update({ snap_token: newSnapToken })
      .eq("id", order.id);

    return NextResponse.json({ snap_token: newSnapToken }, { status: 200 });
  } catch (err) {
    console.error("Error in /api/user/orders/[id]/pay:", err);
    return NextResponse.json({ error: err.message || "Terjadi kesalahan internal server." }, { status: 500 });
  }
}
