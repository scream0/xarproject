import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { applyOrderStatusUpdate } from "@/lib/orderStatusHelper";

export const dynamic = "force-dynamic";

async function verifyAdmin(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized: No Authorization header");
    const token = authHeader.split("Bearer ")[1];
    if (!token) throw new Error("Unauthorized: Invalid token format");

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) throw new Error(`Authentication failed: ${error?.message || "Invalid token"}`);

    const { data: profile, error: dbError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const normalizedRole = String(profile?.role || "").toLowerCase();
    if (dbError || !profile || !["admin", "superadmin"].includes(normalizedRole)) {
        throw new Error("Forbidden: Admin access required");
    }
    return user;
}

async function handleUpdateStatus(request) {
  try {
    await verifyAdmin(request);

    const body = await request.json().catch(() => ({}));
    const { orderId, newStatus, status, shippingReceiptNumber } = body;
    const targetStatus = (newStatus || status || "").toLowerCase();

    const updatedOrder = await applyOrderStatusUpdate(supabaseAdmin, {
      orderId,
      targetStatus,
      shippingReceiptNumber,
      changedBy: "admin",
      notes: "Status diperbarui via callback pembayaran",
    });

    return NextResponse.json({
      success: true,
      message: `Order status updated to ${targetStatus}`,
      order: updatedOrder,
    });

  } catch (error) {
    console.error("PUT /api/orders/update-status error:", error);
    const isAuthError = error.message.includes("Unauthorized") || error.message.includes("Forbidden");
    const statusCode = error.status || (isAuthError ? 403 : 500);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: statusCode },
    );
  }
}

export async function PUT(request) {
  return handleUpdateStatus(request);
}

export async function POST(request) {
  return handleUpdateStatus(request);
}
