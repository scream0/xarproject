import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function verifyAdmin(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) throw new Error("Authentication required.");
  const token = authHeader.split("Bearer ")[1];
  if (!token) throw new Error("Invalid token format.");

  // Diperbarui menggunakan auth.getUser(token) modern
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) throw new Error(`Invalid token: ${userError?.message || "User not found"}`);

  // Diperbarui dari tabel "users" ke tabel "profiles"
  const { data: userRole, error: roleError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const normalizedRole = String(userRole?.role || "").toLowerCase();
  if (roleError || !userRole || !["admin", "superadmin"].includes(normalizedRole)) {
    throw new Error("Admin access required.");
  }
}

export async function GET(request) {
  try {
    await verifyAdmin(request);

    // Fetch pending orders directly from the database
    const { data: pending, error: pendingError } = await supabaseAdmin
      .from("orders")
      .select("id, customer_name, amount, payment_type, created_at")
      .in("status", ["pending", "challenge"]);

    if (pendingError) throw pendingError;

    // Fetch count of paid orders directly from the database
    const { count: paidCount, error: paidError } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["success", "settlement", "processing", "completed"]);

    if (paidError) throw paidError;

    return NextResponse.json({
      pending: (pending || []).map(o => ({
        id: o.id,
        customer: o.customer_name || "Customer",
        amount: Number(o.amount || 0),
        paymentType: o.payment_type || "Midtrans",
        createdAt: o.created_at,
      })),
      summary: {
        pendingCount: pending?.length || 0,
        pendingValue: (pending || []).reduce((s, o) => s + Number(o.amount || 0), 0),
        paidCount: paidCount || 0,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }
}