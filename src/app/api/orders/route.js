import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// ========== AUTH HELPERS ==========

async function verifyUser(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) throw new Error("Unauthorized: No Authorization header");
  const token = authHeader.split("Bearer ")[1];
  if (!token) throw new Error("Unauthorized: Invalid token format");
  
  // Diperbarui menggunakan auth.getUser(token) modern
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    throw new Error(`Authentication failed: ${error?.message || "Invalid token"}`);
  }
  return user;
}

async function verifyAdmin(request) {
    const user = await verifyUser(request);
    
    // Diperbarui dari tabel "users" ke tabel "profiles"
    const { data: profile, error } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
        
    if (error || profile?.role !== "admin") {
        throw new Error("Forbidden: Admin access required");
    }
    return user;
}


// ========== GET HANDLER ==========
// Fetches user's primary address and orders, or all orders for an admin.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    // --- ADMIN MODE ---
    if (!userId) {
      await verifyAdmin(request);
      const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
      const limit = Math.max(1, parseInt(searchParams.get("limit") || "10"));
      const offset = (page - 1) * limit;

      const { data, error, count } = await supabaseAdmin
        .from("orders")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (error) throw error;

      return NextResponse.json({
        success: true,
        orders: data,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil((count || 0) / limit),
          totalOrders: count || 0,
        },
      });
    }

    // --- USER MODE ---
    const user = await verifyUser(request);
    if (user.id !== userId) {
        return NextResponse.json({ success: false, error: "Cannot fetch data for another user." }, { status: 403 });
    }
    
    // 1. Fetch User's Primary Address
    const { data: primaryAddressData, error: addressError } = await supabaseAdmin
      .from("addresses")
      .select("*")
      .eq("user_id", userId)
      .order("is_primary", { ascending: false }) // primary first
      .limit(1)
      .single();

    if (addressError && addressError.code !== 'PGRST116') { // Ignore 'no rows' error
        console.error("Failed to fetch user address:", addressError.message);
    }
    
    // 2. Fetch User's Orders
    const { data: ordersData, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (ordersError) throw ordersError;

    return NextResponse.json({
      success: true,
      primaryAddress: primaryAddressData || null,
      orders: ordersData || [],
    });

  } catch (error) {
    console.error("GET /api/orders error:", error.message);
    const isAuthError = error.message.includes("Unauthorized") || error.message.includes("Forbidden");
    return NextResponse.json(
      { success: false, error: error.message },
      { status: isAuthError ? 403 : 500 },
    );
  }
}


// ========== PUT HANDLER ==========
// Updates an order's status and decrements stock on payment success.
export async function PUT(request) {
  try {
    await verifyAdmin(request); // Updating orders is an admin action

    const body = await request.json().catch(() => ({}));
    const { orderId, status, newStatus, shippingReceiptNumber } = body;
    const targetStatus = (newStatus || status || "").toLowerCase();

    if (!orderId || !targetStatus) {
      return NextResponse.json({ error: "orderId and status are required" }, { status: 400 });
    }

    const { data: orderData, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("status, items:order_items(*)")
      .eq("id", orderId)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const normalizedTargetStatus = targetStatus;
    const currentStatus = (orderData.status || "").toLowerCase();

    const isSuccessStatus = ["success", "settlement", "processing"].includes(normalizedTargetStatus);
    const wasAlreadySuccess = ["success", "settlement", "processing"].includes(currentStatus);

    // If status is moving to a success state for the first time, decrement stock.
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
    
    // Update order status and history
    const { data: currentOrder, error: getOrderError } = await supabaseAdmin
        .from('orders')
        .select('status_history')
        .eq('id', orderId)
        .single();
    
    if (getOrderError) throw getOrderError;

    const historyEntry = {
        status: normalizedTargetStatus,
        notes: `Status updated by admin`,
        actor: "admin",
        timestamp: new Date().toISOString()
    };
    
    const updatePayload = {
        status: normalizedTargetStatus,
        status_history: [...(currentOrder.status_history || []), historyEntry]
    };

    if (shippingReceiptNumber) {
        updatePayload.shipping_receipt_number = shippingReceiptNumber;
    }

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
    console.error("PUT /api/orders error:", error);
    const isAuthError = error.message.includes("Unauthorized") || error.message.includes("Forbidden");
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: isAuthError ? 403 : 500 },
    );
  }
}