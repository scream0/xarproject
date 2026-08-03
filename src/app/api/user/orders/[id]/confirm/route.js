import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { updateOrderStatus } from "@/app/api/orders/orderService";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  try {
    const orderId = params?.id;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || (await request.json().catch(() => ({}))).userId;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Order id is required" },
        { status: 400 },
      );
    }

    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 },
      );
    }

    const orderData = orderSnap.data();
    if (userId && orderData.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const currentStatus = (orderData.status || "").toLowerCase();
    if (currentStatus === "cancelled") {
      return NextResponse.json(
        { success: false, error: "Cancelled orders cannot be confirmed" },
        { status: 409 },
      );
    }

    const updatedOrder = await updateOrderStatus(
      db,
      orderId,
      "delivered",
      "customer",
      "Pembeli mengonfirmasi pesanan diterima",
    );

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error("Failed to confirm order:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
