import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function verifyAdmin(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized: No Authorization header");
    const token = authHeader.split("Bearer ")[1];
    if (!token) throw new Error("Unauthorized: Invalid token format");
    
    const { data: user, error } = await supabaseAdmin.auth.api.getUser(token);
    if (error) throw new Error(`Authentication failed: ${error.message}`);

    const { data: profile, error: dbError } = await supabaseAdmin
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();
    if (dbError || profile?.role !== "admin") {
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

    if (isSuccessStatus && !wasAlreadySuccess) {
      const items = orderData.items || [];
      for (const item of items) {
        const { data: product, error } = await supabaseAdmin
          .from("products")
          .select("id, variants")
          .eq("id", item.product_id)
          .single();

        if (error || !product) continue;

        let variantUpdated = false;
        const updatedVariants = product.variants.map((v) => {
          // Assuming variant is matched by name/size
          if (v.size === item.variant_name) {
            const currentStock = v.stock || 0;
            v.stock = Math.max(0, currentStock - item.quantity);
            variantUpdated = true;
          }
          return v;
        });

        if (variantUpdated) {
          await supabaseAdmin
            .from("products")
            .update({ variants: updatedVariants })
            .eq("id", product.id);
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
