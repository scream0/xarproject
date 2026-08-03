import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { updateOrderStatus } from "@/app/api/orders/orderService";

export const dynamic = "force-dynamic";

async function handleShippingUpdate(request, { params }) {
  try {
    const orderId = params?.id;
    const body = await request.json().catch(() => ({}));

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId is required" },
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

    const shippingData = {
      orderId,
      courier_name: body.courierName || body.courier_name || null,
      service_type: body.serviceType || body.service_type || null,
      tracking_number: body.trackingNumber || body.tracking_number || null,
      shipping_address: body.shippingAddress || body.shipping_address || null,
      recipient_name: body.recipientName || body.recipient_name || null,
      phone_number: body.phoneNumber || body.phone_number || null,
    };

    await orderRef.set(
      {
        shippingDetail: shippingData,
        shippingAddress: shippingData.shipping_address || null,
        shippingCost: Number(body.shippingCost || body.shipping_cost || 0),
        updated_at: new Date(),
      },
      { merge: true },
    );

    await orderRef.collection("shipping_details").doc("primary").set(shippingData, { merge: true });

    const currentStatus = (orderSnap.data().status || "").toLowerCase();
    if (
      body.updateStatus !== false &&
      body.status &&
      currentStatus !== body.status.toLowerCase()
    ) {
      await updateOrderStatus(db, orderId, body.status, "admin", body.notes || "Informasi pengiriman diperbarui");
    } else if (
      body.updateStatus !== false &&
      (body.status || shippingData.tracking_number) &&
      !["cancelled", "delivered"].includes(currentStatus)
    ) {
      await updateOrderStatus(db, orderId, "shipped", "admin", "Resi dan kurir telah ditambahkan");
    }

    return NextResponse.json({ success: true, shipping: shippingData });
  } catch (error) {
    console.error("Failed to update order shipping:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(request, context) {
  return handleShippingUpdate(request, context);
}

export async function PUT(request, context) {
  return handleShippingUpdate(request, context);
}
