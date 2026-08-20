import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(request, context) {
  try {
    const params = context?.params ? await context.params : {};
    const orderId = params?.id || params?.orderId;
    const body = await request.json().catch(() => ({}));
    const { transaction_status, status_code } = body;

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
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
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    let nextStatus = order.status;
    const txStatus = String(transaction_status || "").toLowerCase();

    if (["settlement", "capture", "success", "paid"].includes(txStatus)) {
      nextStatus = "paid";
    } else if (txStatus === "pending") {
      nextStatus = "pending";
    } else if (["deny", "cancel", "expire", "failure"].includes(txStatus)) {
      nextStatus = "cancelled";
    }

    if (nextStatus !== order.status) {
      const historyEntry = {
        id: `${Date.now()}-client-sync`,
        status_to: nextStatus,
        notes: `Pembayaran disinkronisasi melalui UI (status: ${txStatus})`,
        changed_by: "client_sync",
        created_at: new Date().toISOString(),
      };

      const existingHistory = Array.isArray(order.status_history) ? order.status_history : [];

      await supabaseAdmin
        .from("orders")
        .update({
          status: nextStatus,
          status_history: [...existingHistory, historyEntry],
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
    }

    return NextResponse.json({ success: true, status: nextStatus }, { status: 200 });
  } catch (err) {
    console.error("Error in /api/user/orders/[id]/sync:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
