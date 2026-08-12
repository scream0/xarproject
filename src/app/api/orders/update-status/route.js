import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
const ALLOWED_ORDER_STATUSES = new Set([
  "pending",
  "processing",
  "completed",
  "cancelled",
  "settlement",
  "success",
]);

async function verifyAdmin(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized: No Authorization header");
    const token = authHeader.split("Bearer ")[1];
    if (!token) throw new Error("Unauthorized: Invalid token format");
    
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) throw new Error(`Authentication failed: ${error?.message || "Invalid token"}`);

    const { data: profile, error: dbError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const normalizedRole = String(profile?.role || "").toLowerCase();
    if (dbError || !profile || !["admin", "superadmin"].includes(normalizedRole)) {
        throw new Error("Forbidden: Admin access required");
    }
    return user;
}


async function handleUpdateStatus(request) {
  try {
    await verifyAdmin(request);

    const body = await request.json().catch(() => ({}));
    const { orderId, newStatus, status, shippingReceiptNumber } = body;
    const targetStatus = (newStatus || status || "").toLowerCase();

    if (!orderId || !targetStatus) {
      return NextResponse.json({ error: "orderId and status are required" }, { status: 400 });
    }
    if (!ALLOWED_ORDER_STATUSES.has(targetStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Fetch the order and its items to get the current status and item list
    const { data: orderData, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("status, status_history, items:order_items(*)")
      .eq("id", orderId)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const currentStatus = (orderData.status || "").toLowerCase();

    // --- Stock Update Logic ---
    // If status moves to a success state for the first time, decrement stock.
    const isSuccessStatus = ["success", "settlement", "processing"].includes(targetStatus);
    const wasAlreadySuccess = ["success", "settlement", "processing"].includes(currentStatus);

    // If status moves to a success state for the first time, decrement stock atomically.
    if (isSuccessStatus && !wasAlreadySuccess) {
      const itemsToDecrement = (orderData.items || []).map(item => ({
        product_id: item.product_id,
        variant_name: item.variant_name,
        quantity: item.quantity,
      }));

      if (itemsToDecrement.length > 0) {
        const { error: decrementError } = await supabaseAdmin.rpc('decrement_stock', {
          items_to_decrement: itemsToDecrement,
        });

        if (decrementError) {
          console.error(`Atomic stock decrement failed for order ${orderId}:`, decrementError);
        }
      }
    }
    
    // --- Status History Update ---
    const historyEntry = {
        status: targetStatus,
        notes: `Status updated via API`,
        actor: "admin",
        timestamp: new Date().toISOString()
    };
    
    const updatePayload = {
        status: targetStatus,
        status_history: [...(orderData.status_history || []), historyEntry]
    };

    if (shippingReceiptNumber) {
        updatePayload.shipping_receipt_number = shippingReceiptNumber;
    }

    // --- Final Order Update ---
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
        .from("orders")
        .update(updatePayload)
        .eq("id", orderId)
        .select()
        .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: `Order status updated to ${targetStatus}`,
      order: updatedOrder
    });

  } catch (error) {
    console.error("PUT /api/orders/update-status error:", error);
    const isAuthError = error.message.includes("Unauthorized") || error.message.includes("Forbidden");
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: isAuthError ? 403 : 500 },
    );
  }
}

export async function PUT(request) {
  return handleUpdateStatus(request);
}

export async function POST(request) {
  return handleUpdateStatus(request);
}
