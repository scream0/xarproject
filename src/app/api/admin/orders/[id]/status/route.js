import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { applyOrderStatusUpdate } from "@/lib/orderStatusHelper";

export const dynamic = "force-dynamic";

// Helper for admin verification
async function verifyAdmin(request) {
  const token = request.headers.get("authorization")?.split(" ")[1];
  if (!token) {
    throw new Error("Unauthorized: No token provided");
  }
  
  // Diperbarui menggunakan auth.getUser(token) modern
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    console.error("Auth error:", error?.message || "Invalid token");
    throw new Error("Unauthorized: Invalid token");
  }

  // Diperbarui dari tabel "users" ke tabel "profiles"
  const { data: adminUser, error: dbError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const normalizedRole = String(adminUser?.role || "").toLowerCase();
  if (dbError || !adminUser || !["admin", "superadmin"].includes(normalizedRole)) {
    console.error("DB error or role mismatch:", dbError?.message);
    throw new Error("Forbidden: User is not an admin");
  }
  return user.id;
}

async function handleStatusUpdate(request, context) {
  try {
    await verifyAdmin(request);

    const params = await context.params;
    const orderId = params?.id;
    const body = await request.json().catch(() => ({}));
    const { status, newStatus, notes, changedBy } = body;
    const targetStatus = (newStatus || status || "").toLowerCase();

    const updatedOrder = await applyOrderStatusUpdate(supabaseAdmin, {
      orderId,
      targetStatus,
      notes,
      changedBy: changedBy || "admin",
    });

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error("Failed to update order status:", error);
    const isAuthError = error.message.includes("Unauthorized") || error.message.includes("Forbidden");
    const statusCode = error.status || (isAuthError ? 403 : 500);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: statusCode },
    );
  }
}

export async function POST(request, context) {
  return handleStatusUpdate(request, context);
}

export async function PUT(request, context) {
  return handleStatusUpdate(request, context);
}