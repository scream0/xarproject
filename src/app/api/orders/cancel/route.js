import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Helper to verify a user's token and return their Supabase user object.
async function verifyUser(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Unauthorized: No Authorization header provided.");
  }
  const token = authHeader.split("Bearer ")[1];
  if (!token) {
    throw new Error("Unauthorized: Invalid Authorization header format.");
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
  return user;
}

// POST -> Cancels an order if its status is "pending".
export async function POST(request) {
  let user;
  try {
    user = await verifyUser(request);
  } catch (error) {
    console.error("Authentication error in /orders/cancel:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Missing required field: orderId." },
        { status: 400 },
      );
    }

    // 1. Fetch the order to validate ownership and status
    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("user_id, status, status_history")
      .eq("id", orderId)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 },
      );
    }

    // 2. Perform validation checks
    if (order.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "You are not authorized to cancel this order." },
        { status: 403 },
      );
    }

    if (order.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error: `Order cannot be cancelled. Status is already '${order.status}'.`,
        },
        { status: 409 }, // 409 Conflict is appropriate here
      );
    }

    // 3. Prepare and execute the status update
    const newStatus = "cancelled";
    const historyEntry = {
      status: newStatus,
      notes: "Cancelled by customer",
      actor: "customer",
      timestamp: new Date().toISOString(),
    };

    const updatePayload = {
      status: newStatus,
      status_history: [...(order.status_history || []), historyEntry],
    };

    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from("orders")
      .update(updatePayload)
      .eq("id", orderId)
      .select()
      .single();

    if (updateError) {
      console.error(`Error updating order ${orderId} to cancelled:`, updateError.message);
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      success: true,
      message: `Order ${orderId} has been successfully cancelled.`,
      order: updatedOrder,
    });

  } catch (error) {
    console.error("Error cancelling order:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to cancel order." },
      { status: 500 },
    );
  }
}
