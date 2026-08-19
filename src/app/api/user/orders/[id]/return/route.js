import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(request, context) {
  try {
    const params = context?.params ? await context.params : {};
    const orderId = params?.id || params?.orderId;
    const body = await request.json().catch(() => ({}));
    const { userId, reason, notes } = body;

    if (!orderId || !reason) {
      return NextResponse.json({ error: "Order ID dan alasan return wajib diisi." }, { status: 400 });
    }

    // 1. Fetch order
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
      return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
    }

    // 2. Insert into return_requests
    const { data: returnReq, error: returnErr } = await supabaseAdmin
      .from("return_requests")
      .insert({
        order_id: order.id,
        user_id: userId || order.user_id,
        reason,
        notes: notes || reason,
        status: "requested",
      })
      .select()
      .single();

    if (returnErr) {
      console.error("Error creating return request:", returnErr);
      return NextResponse.json({ error: returnErr.message }, { status: 500 });
    }

    // 3. Update order status history
    const historyEntry = {
      id: `${Date.now()}-return-request`,
      status_to: "return_requested",
      notes: `Pengajuan return: ${reason}`,
      changed_by: "customer",
      created_at: new Date().toISOString(),
    };

    const existingHistory = Array.isArray(order.status_history) ? order.status_history : [];

    await supabaseAdmin
      .from("orders")
      .update({
        status_history: [...existingHistory, historyEntry],
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    return NextResponse.json({ success: true, returnRequest: returnReq }, { status: 200 });
  } catch (err) {
    console.error("Error in /api/user/orders/[id]/return:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
