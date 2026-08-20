import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function verifyAdmin(request) {
  let token = request.headers.get("authorization")?.split(" ")[1];

  if (!token) {
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/session=([^;]+)/);
    if (match) {
      token = match[1];
    }
  }

  if (!token) {
    throw new Error("Unauthorized: No token provided");
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    throw new Error("Unauthorized: Invalid token");
  }

  const { data: adminUser, error: dbError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const normalizedRole = String(adminUser?.role || "").toLowerCase();
  if (dbError || !adminUser || !["admin", "superadmin"].includes(normalizedRole)) {
    throw new Error("Forbidden: User is not an admin");
  }
}

export async function GET(request, context) {
  try {
    await verifyAdmin(request);

    const params = context?.params ? await context.params : {};
    const orderId = params?.id || params?.orderId;

    if (!orderId) {
      return NextResponse.json({ success: false, error: "Order ID is required" }, { status: 400 });
    }

    // 1. Ambil data order
    let orderData = null;
    const { data: orderById, error: errById } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (orderById) {
      orderData = orderById;
    } else {
      const { data: orderByNum } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("order_number", orderId)
        .maybeSingle();
      orderData = orderByNum;
    }

    if (!orderData) {
      return NextResponse.json({ success: false, error: "Pesanan tidak ditemukan" }, { status: 404 });
    }

    const targetOrderId = orderData.id;

    // 2. Ambil items
    const { data: dbItems } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .eq("order_id", targetOrderId);

    const items = (dbItems && dbItems.length > 0)
      ? dbItems.map((item) => ({
          id: item.id,
          productId: item.product_id,
          product_id: item.product_id,
          name: item.product_name || item.name || "Produk XAR",
          product_name: item.product_name || item.name || "Produk XAR",
          size: item.variant_name || item.size || "Standard",
          variant_name: item.variant_name || item.size || "Standard",
          price: Number(item.price || 0),
          quantity: Number(item.quantity || 1),
          image: item.image_url || item.image || null,
        }))
      : (Array.isArray(orderData.items) ? orderData.items : []);

    // 3. Ambil shipping details
    const { data: dbShipping } = await supabaseAdmin
      .from("shipping_details")
      .select("*")
      .eq("order_id", targetOrderId)
      .maybeSingle();

    let shippingDetail = dbShipping || orderData.shipping_detail || orderData.shippingDetail || {};
    if (typeof shippingDetail === "string") {
      try { shippingDetail = JSON.parse(shippingDetail); } catch { shippingDetail = {}; }
    }

    let shippingAddress = orderData.shipping_address || orderData.shippingAddress || null;
    if (typeof shippingAddress === "string") {
      try { shippingAddress = JSON.parse(shippingAddress); } catch { shippingAddress = orderData.shipping_address; }
    }

    return NextResponse.json({
      success: true,
      order: orderData,
      items,
      shipping: {
        ...shippingDetail,
        courier_name: shippingDetail.courier_name || orderData.courier || null,
        service_type: shippingDetail.service_type || orderData.shipping_service || null,
        tracking_number: shippingDetail.tracking_number || orderData.shipping_receipt_number || null,
        shipping_address: shippingAddress,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/admin/orders/[id]:", error.message);
    const isAuthError = error.message.includes("Unauthorized") || error.message.includes("Forbidden");
    const statusCode = isAuthError ? 403 : 500;
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: statusCode },
    );
  }
}
