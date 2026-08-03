import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import {
  filterOrdersWithWebhookMetadata,
  mapOrderDoc,
  sortOrdersByWebhookLatest,
} from "@/app/api/orders/orderService";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim().toLowerCase();
    const search = searchParams.get("search")?.trim().toLowerCase();
    const sortBy = searchParams.get("sortBy")?.trim().toLowerCase();
    const webhookOnly = ["1", "true", "yes"].includes(
      String(searchParams.get("webhookOnly") || "").trim().toLowerCase(),
    );
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || 20)));

    const ordersSnapshot = await db.collection("orders").get();
    let orders = ordersSnapshot.docs.map(mapOrderDoc);

    if (status) {
      orders = orders.filter(
        (order) => (order.status || "").toLowerCase() === status,
      );
    }

    if (search) {
      orders = orders.filter((order) => {
        const haystack = [
          order.orderId,
          order.order_number,
          order.customerName,
          order.customerEmail,
          order.userId,
          order.id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    if (webhookOnly) {
      orders = filterOrdersWithWebhookMetadata(orders);
    }

    if (sortBy === "webhook" || sortBy === "webhook_latest") {
      orders = sortOrdersByWebhookLatest(orders);
    } else {
      orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
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
    console.error("Failed to load admin orders:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
