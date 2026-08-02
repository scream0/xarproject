import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";

export const dynamic = "force-dynamic";

async function identity(request) {
  const header = request.headers.get("Authorization");
  const token = header?.split("Bearer ")[1];
  if (!token) throw new Error("Authentication required.");
  const user = await getAuth().verifyIdToken(token);
  const profile = await db.collection("users").doc(user.uid).get();
  return { uid: user.uid, admin: user.role === "admin" || user.admin === true || profile.data()?.role === "admin" };
}

export async function GET(request) {
  try {
    const user = await identity(request);
    const snapshot = user.admin ? await db.collection("return_requests").get() : await db.collection("return_requests").where("userId", "==", user.uid).get();
    const requests = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate?.().toISOString() || doc.data().createdAt })).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return NextResponse.json({ requests });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 401 }); }
}

export async function POST(request) {
  try {
    const user = await identity(request);
    const { orderId, reason, notes } = await request.json();
    if (!orderId || !reason) return NextResponse.json({ error: "Order and reason are required." }, { status: 400 });
    const order = await db.collection("orders").doc(orderId).get();
    if (!order.exists || order.data().userId !== user.uid) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if ((order.data().status || "").toLowerCase() !== "completed") return NextResponse.json({ error: "Returns can be requested after an order is completed." }, { status: 400 });
    const ticket = await db.collection("return_requests").add({ orderId, userId: user.uid, reason, notes: notes || "", status: "requested", createdAt: new Date(), updatedAt: new Date() });
    return NextResponse.json({ id: ticket.id, message: "Return request submitted." }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error.message || "Could not submit return request." }, { status: 500 }); }
}

export async function PUT(request) {
  try {
    const user = await identity(request);
    if (!user.admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    const { requestId, status, adminNote = "" } = await request.json();
    if (!requestId || !["approved", "rejected", "refunded"].includes(status)) return NextResponse.json({ error: "Invalid return update." }, { status: 400 });
    await db.collection("return_requests").doc(requestId).set({ status, adminNote, updatedAt: new Date(), resolvedBy: user.uid }, { merge: true });
    return NextResponse.json({ message: "Return request updated." });
  } catch (error) { return NextResponse.json({ error: error.message || "Could not update return request." }, { status: 500 }); }
}
