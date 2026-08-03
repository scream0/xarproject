import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { updateOrderStatus } from "@/app/api/orders/orderService";

export const dynamic = "force-dynamic";

async function handleStatusUpdate(request, { params }) {
  try {
    const orderId = params?.id;
    const body = await request.json().catch(() => ({}));
    const { status, newStatus, notes, changedBy } = body;
    const targetStatus = newStatus || status;

    if (!orderId || !targetStatus) {
      return NextResponse.json(
        { success: false, error: "orderId and status are required" },
        { status: 400 },
      );
    }

    const updatedOrder = await updateOrderStatus(
      db,
      orderId,
      targetStatus,
      changedBy || "admin",
      notes || "",
    );

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error("Failed to update order status:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(request, context) {
  return handleStatusUpdate(request, context);
}

export async function PUT(request, context) {
  return handleStatusUpdate(request, context);
}
