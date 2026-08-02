import { db } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";

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

    const result = await db.runTransaction(async (transaction) => {
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists) {
        throw new Error("Pesanan tidak ditemukan.");
      }

      const orderData = orderDoc.data();

      if (orderData.userId !== decodedToken.uid) {
        throw new Error("Anda tidak berhak membatalkan pesanan ini.");
      }

      const currentStatus = (orderData.status || "").toLowerCase();
      if (currentStatus !== "pending") {
        throw new Error(
          "Pesanan hanya bisa dibatalkan selama masih menunggu pembayaran.",
        );
      }

      transaction.update(orderRef, {
        status: "cancelled",
        cancelledAt: new Date(),
        updated_at: new Date(),
        statusHistory: [
          ...(Array.isArray(orderData.statusHistory) ? orderData.statusHistory : []),
          { status: "cancelled", changedAt: new Date().toISOString(), source: "customer" },
        ].slice(-50),
      });

      return { orderId };
    });

    return Response.json(
      { message: `Pesanan ${result.orderId} berhasil dibatalkan.` },
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
