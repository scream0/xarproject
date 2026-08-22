import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function verifyOwner(request, userId) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Unauthorized");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  if (user.id !== userId) throw new Error("Forbidden");
}

function mapOrderRecord(order, reviewsByOrder = {}) {
  const reviewedItemIds = reviewsByOrder[order.id] || [];
  return {
    id: order.id,
    orderId: order.id,
    order_number: order.order_number || order.id,
    userId: order.user_id,
    status: order.status,
    amount: Number(order.amount || 0),
    shippingCost: Number(order.shipping_cost || 0),
    discountAmount: Number(order.discount_amount || 0),
    taxAmount: Number(order.tax_amount || 0),
    paymentType: order.payment_type,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    shippingAddress: order.shipping_address,
    shippingDetail: order.shipping_detail,
    shippingReceiptNumber: order.shipping_receipt_number,
    notes: order.notes,
    statusHistory: Array.isArray(order.status_history) ? order.status_history : [],
    items: order.items || [],
    hasBeenReviewed: reviewedItemIds.length > 0,
    reviewedItemIds,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const status = searchParams.get("status")?.trim().toLowerCase();
    const search = searchParams.get("search")?.trim().toLowerCase();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.max(1, Math.min(1000, Number(searchParams.get("limit") || 50)));

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 },
      );
    }
    await verifyOwner(request, userId);

    let query = supabaseAdmin.from("orders").select("*, items:order_items(*)").eq("user_id", userId);
    if (status) {
      query = query.eq("status", status);
    }

    const { data: rawOrders, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;

    const { data: userReviews } = await supabaseAdmin
      .from("reviews")
      .select("order_id, product_id")
      .eq("user_id", userId);

    const reviewsByOrder = (userReviews || []).reduce((acc, rev) => {
      if (!acc[rev.order_id]) acc[rev.order_id] = [];
      acc[rev.order_id].push(rev.product_id);
      return acc;
    }, {});

    let orders = (rawOrders || []).map(order => mapOrderRecord(order, reviewsByOrder));

    if (search) {
      orders = orders.filter((order) => {
        const haystack = [
          order.orderId,
          order.order_number,
          order.customerName,
          order.customerEmail,
          order.id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    const totalOrders = orders.length;
    const totalPages = Math.max(1, Math.ceil(totalOrders / limit));
    const pagedOrders = orders.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      success: true,
      orders: pagedOrders,
      pagination: {
        currentPage: page,
        totalPages,
        totalOrders,
      },
    });
  } catch (error) {
    console.error("Failed to load user orders:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: ["Unauthorized", "Forbidden"].includes(error.message) ? 403 : 500 },
    );
  }
}
