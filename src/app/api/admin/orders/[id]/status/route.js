import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Helper for admin verification
async function verifyAdmin(request) {
  const token = request.headers.get("authorization")?.split(" ")[1];
  if (!token) {
    throw new Error("Unauthorized: No token provided");
  }
  const { data: user, error } = await supabaseAdmin.auth.api.getUser(token);
  if (error) {
    console.error("Auth error:", error.message);
    throw new Error("Unauthorized: Invalid token");
  }
  const { data: adminUser, error: dbError } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (dbError || !adminUser || adminUser.role !== "admin") {
    console.error("DB error or role mismatch:", dbError?.message);
    throw new Error("Forbidden: User is not an admin");
  }
  return user.id;
}

async function handleStatusUpdate(request, { params }) {
  try {
    await verifyAdmin(request);

    const orderId = params?.id;
    const body = await request.json().catch(() => ({}));
    const { status, newStatus, notes, changedBy } = body;
    const targetStatus = (newStatus || status || "").toLowerCase();

    if (!orderId || !targetStatus) {
      return NextResponse.json(
        { success: false, error: "orderId and status are required" },
        { status: 400 },
      );
    }

    // 1. Fetch the current order to get existing status history
    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("status_history")
      .eq("id", orderId)
      .single();

    if (fetchError) {
      console.error(`Error fetching order ${orderId}:`, fetchError.message);
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 },
      );
    }

    // 2. Create the new history entry
    const historyEntry = {
      status: targetStatus,
      notes: notes || "",
      actor: changedBy || "admin",
      timestamp: new Date().toISOString(),
    };

    // 3. Prepare the update payload
    const updatePayload = {
      status: targetStatus,
      status_history: [...(order.status_history || []), historyEntry],
    };

    // 4. Execute the update
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from("orders")
      .update(updatePayload)
      .eq("id", orderId)
      .select()
      .single();

    if (updateError) {
      console.error(`Error updating order ${orderId}:`, updateError.message);
      // This might happen if `targetStatus` is not a valid enum value
      if (updateError.message.includes("invalid input value for enum order_status")) {
         return NextResponse.json(
          { success: false, error: `Invalid order status: "${targetStatus}"` },
          { status: 400 },
        );
      }
      throw new Error(updateError.message);
    }

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error("Failed to update order status:", error);
    const isAuthError = error.message.includes("Unauthorized") || error.message.includes("Forbidden");
    const statusCode = isAuthError ? 403 : 500;
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: statusCode },
    );
  }
}

export async function POST(request, context) {
  return handleStatusUpdate(request, context);
}

export async function PUT(request, context) {
  return handleStatusUpdate(request, context);
}
