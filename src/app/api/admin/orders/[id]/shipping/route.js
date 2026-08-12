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

// Helper for admin verification, adapted from the refactored settings route
async function verifyAdmin(request) {
  const token = request.headers.get("authorization")?.split(" ")[1];
  if (!token) {
    throw new Error("Unauthorized: No token provided");
  }
  
  // Diperbarui menggunakan auth.getUser(token) modern
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    console.error("Auth error:", error?.message || "Invalid token");
    throw new Error("Unauthorized: Invalid token");
  }

  // Diperbarui dari tabel "users" ke tabel "profiles"
  const { data: adminUser, error: dbError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const normalizedRole = String(adminUser?.role || "").toLowerCase();
  if (dbError || !adminUser || !["admin", "superadmin"].includes(normalizedRole)) {
    console.error("DB error or role mismatch:", dbError?.message);
    throw new Error("Forbidden: User is not an admin");
  }
  return user.id;
}


async function handleShippingUpdate(request, { params }) {
  try {
    await verifyAdmin(request);

    const orderId = params?.id;
    const body = await request.json().catch(() => ({}));

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId is required" },
        { status: 400 },
      );
    }

    // 1. Fetch order data first
    const { data: orderData, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("status, status_history, shipping_address")
      .eq("id", orderId)
      .single();

    if (fetchError) {
      console.error("Error fetching order:", fetchError.message);
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 },
      );
    }

    const trackingNumber = body.trackingNumber || body.tracking_number || null;
    const requestedStatus = (body.status || body.newStatus || "").toLowerCase();
    if (requestedStatus && !ALLOWED_ORDER_STATUSES.has(requestedStatus)) {
      return NextResponse.json(
        { success: false, error: "Invalid order status" },
        { status: 400 },
      );
    }
    
    // Merge address details into a single JSONB object
    const shippingAddress = body.shippingAddress || body.shipping_address || orderData.shipping_address || {};
    if (body.recipientName || body.recipient_name) {
        shippingAddress.recipient_name = body.recipientName || body.recipient_name;
    }
    if (body.phoneNumber || body.phone_number) {
        shippingAddress.recipient_phone = body.phoneNumber || body.phone_number;
    }

    // 2. Prepare the main update payload for Supabase
    const updatePayload = {
      shipping_detail: {
        courier_name: body.courierName || body.courier_name || null,
        service_type: body.serviceType || body.service_type || null,
      },
      shipping_address: shippingAddress,
      shipping_receipt_number: trackingNumber,
      shipping_cost: Number(body.shippingCost || body.shipping_cost || 0),
    };

    // 3. Conditionally add status update to the payload
    const currentStatus = orderData.status?.toLowerCase();
    const newStatus = body.status?.toLowerCase();
    let notes = "";
    let statusToUpdate = null;

    // Replicate status update logic from original file
    if (body.updateStatus !== false && newStatus && currentStatus !== newStatus) {
        statusToUpdate = newStatus;
        notes = body.notes || "Informasi pengiriman diperbarui";
    } else if (body.updateStatus !== false && trackingNumber && !["cancelled", "completed", "success", "processing"].includes(currentStatus)) {
        statusToUpdate = "processing"; // 'shipped' from original code becomes 'processing'
        notes = "Resi dan kurir telah ditambahkan";
    }

    if (statusToUpdate) {
        const historyEntry = {
            status: statusToUpdate,
            notes: notes,
            actor: "admin",
            timestamp: new Date().toISOString(),
        };
        updatePayload.status = statusToUpdate;
        updatePayload.status_history = [...(orderData.status_history || []), historyEntry];
    }
    
    // 4. Execute the update query
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from("orders")
      .update(updatePayload)
      .eq("id", orderId)
      .select()
      .single();

    if (updateError) {
        console.error("Failed to update order shipping:", updateError);
        throw new Error(updateError.message);
    }

    return NextResponse.json({ success: true, shipping: updatedOrder });
  } catch (error) {
    console.error("Error in handleShippingUpdate:", error.message);
    const isAuthError = error.message.includes("Unauthorized") || error.message.includes("Forbidden");
    const statusCode = isAuthError ? 403 : 500;
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: statusCode },
    );
  }
}

export async function POST(request, context) {
  return handleShippingUpdate(request, context);
}

export async function PUT(request, context) {
  return handleShippingUpdate(request, context);
}