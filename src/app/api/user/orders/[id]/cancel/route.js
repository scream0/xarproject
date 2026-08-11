import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyUser } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  try {
    const orderId = params?.id;
    const { searchParams } = new URL(request.url);
    const user = await verifyUser(request);
    const userId = user.id;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Order id is required" },
        { status: 400 },
      );
    }

    const { data: orderData, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (fetchErr || !orderData) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 },
      );
    }

    if (String(orderData.user_id || "") !== userId) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    if ((orderData.status || "").toLowerCase() !== "pending") {
      return NextResponse.json(
        { success: false, error: "Only pending orders can be cancelled" },
        { status: 409 },
      );
    }

    const historyEntry = {
      status: "cancelled",
      notes: "Pembatalan oleh pelanggan",
      actor: "customer",
      timestamp: new Date().toISOString(),
    };

    const { data: updatedOrder, error: updateErr } = await supabaseAdmin
      .from("orders")
      .update({
        status: "cancelled",
        status_history: [...(orderData.status_history || []), historyEntry],
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error("Failed to cancel order:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}

