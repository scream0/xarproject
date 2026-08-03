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

    if ((orderData.status || "").toLowerCase() !== "pending") {
      return NextResponse.json(
        { success: false, error: "Only pending orders can be cancelled" },
        { status: 409 },
      );
    }

    const updatedOrder = await updateOrderStatus(
      db,
      orderId,
      "cancelled",
      "customer",
      "Pembatalan oleh pelanggan",
    );

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error("Failed to cancel order:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
