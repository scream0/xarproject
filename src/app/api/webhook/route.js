import { db } from "@/lib/firebaseClient";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req) {
  const body = await req.json();
  const { order_id, transaction_status, signature_key } = body;

  // 1. Verifikasi Signature (Penting untuk keamanan!)
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const hash = crypto
    .createHash("sha512")
    .update(order_id + "200" + body.gross_amount + serverKey)
    .digest("hex");

  if (signature_key !== hash) {
    return NextResponse.json({ message: "Invalid Signature" }, { status: 403 });
  }

  // 2. Update status di Firestore
  if (transaction_status === "settlement" || transaction_status === "capture") {
    await db.collection("orders").doc(order_id).update({
      status: "paid",
      updatedAt: new Date().toISOString(),
    });
  } else if (
    transaction_status === "cancel" ||
    transaction_status === "expire"
  ) {
    await db.collection("orders").doc(order_id).update({
      status: "failed",
    });
  }

  return NextResponse.json({ status: "ok" });
}
