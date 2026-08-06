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

  if (roleError || userRole?.role !== "admin") {
    throw new Error("Admin access required.");
  }
}

export async function GET(request) {
  try {
    await verifyAdmin(request);

    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("*");

    if (error) throw error;

    const pending = orders
      .filter(o => ["pending", "challenge"].includes(o.status?.toLowerCase()))
      .map(o => ({
        id: o.id,
        customer: o.customer_name || "Customer",
        amount: Number(o.amount || 0),
        paymentType: o.payment_type || "Midtrans",
        createdAt: o.created_at,
      }));

    const paidCount = orders.filter(o =>
      ["success", "settlement", "processing", "completed"].includes(o.status?.toLowerCase())
    ).length;

    return NextResponse.json({
      pending,
      summary: {
        pendingCount: pending.length,
        pendingValue: pending.reduce((s, o) => s + o.amount, 0),
        paidCount: paidCount,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }
}