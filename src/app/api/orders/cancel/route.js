import { db } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { updateOrderStatus } from "@/app/api/orders/orderService";

export const dynamic = "force-dynamic";

async function verifyUser(authHeader) {
  if (!authHeader) {
    throw new Error("No authorization header provided.");
  }
  const token = authHeader.split("Bearer ")[1];
  if (!token) {
    throw new Error("Invalid authorization header format.");
  }
  return getAuth().verifyIdToken(token);
}

// POST -> Batalkan pesanan (hanya jika status masih "pending")
export async function POST(request) {
  try {
    let decodedToken;
    try {
      decodedToken = await verifyUser(request.headers.get("Authorization"));
    } catch (error) {
      return Response.json(
        { error: `Authentication failed: ${error.message}` },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { orderId } = body;

    if (!orderId) {
      return Response.json(
        { error: "Missing required field: orderId." },
        { status: 400 },
      );
    }

    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      return Response.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
    }

    const orderData = orderDoc.data() || {};
    if (orderData.userId !== decodedToken.uid) {
      return Response.json(
        { error: "Anda tidak berhak membatalkan pesanan ini." },
        { status: 403 },
      );
    }

    const currentStatus = (orderData.status || "").toLowerCase();
    if (currentStatus !== "pending") {
      return Response.json(
        {
          error:
            "Pesanan hanya bisa dibatalkan selama masih menunggu pembayaran.",
        },
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

    return Response.json(
      {
        message: `Pesanan ${orderId} berhasil dibatalkan.`,
        order: updatedOrder,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error cancelling order:", error);
    return Response.json(
      { error: error.message || "Gagal membatalkan pesanan." },
      { status: 500 },
    );
  }
}
