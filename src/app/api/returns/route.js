import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function identity(request) {
  const header = request.headers.get("Authorization");
  const token = header?.split("Bearer ")[1];
  if (!token) throw new Error("Authentication required.");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw new Error("Authentication required.");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = ["admin", "superadmin"].includes(String(profile?.role || "").toLowerCase());
  return { uid: user.id, admin: isAdmin };
}

export async function GET(request) {
  try {
    const user = await identity(request);
    let query = supabaseAdmin.from("return_requests").select("*");
    if (!user.admin) {
      query = query.eq("user_id", user.uid);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;

    const requests = (data || []).map((req) => ({
      id: req.id,
      orderId: req.order_id,
      userId: req.user_id,
      reason: req.reason,
      notes: req.notes,
      status: req.status,
      adminNote: req.admin_note,
      resolvedBy: req.resolved_by,
      createdAt: req.created_at,
      updatedAt: req.updated_at,
    }));
    return NextResponse.json({ requests });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}

export async function POST(request) {
  try {
    const user = await identity(request);
    const { orderId, reason, notes } = await request.json();
    if (!orderId || !reason) return NextResponse.json({ error: "Order and reason are required." }, { status: 400 });

    const { data: order, error: orderErr } = await supabaseAdmin.from("orders").select("id, user_id, status").eq("id", orderId).single();
    if (orderErr || !order || order.user_id !== user.uid) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const orderStatus = (order.status || "").toLowerCase();
    if (!["completed", "success", "settlement"].includes(orderStatus)) {
      return NextResponse.json({ error: "Returns can be requested after an order is completed." }, { status: 400 });
    }

    const { data: ticket, error: insertErr } = await supabaseAdmin.from("return_requests").insert({
      order_id: orderId,
      user_id: user.uid,
      reason,
      notes: notes || "",
      status: "requested",
    }).select("id").single();

    if (insertErr) throw insertErr;
    return NextResponse.json({ id: ticket.id, message: "Return request submitted." }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not submit return request." }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await identity(request);
    if (!user.admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    const { requestId, status, adminNote = "" } = await request.json();
    if (!requestId || !["approved", "rejected", "refunded"].includes(status)) return NextResponse.json({ error: "Invalid return update." }, { status: 400 });

    const { error: updateErr } = await supabaseAdmin.from("return_requests").update({
      status,
      admin_note: adminNote,
      resolved_by: user.uid,
    }).eq("id", requestId);
    if (updateErr) throw updateErr;

    return NextResponse.json({ message: "Return request updated." });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not update return request." }, { status: 500 });
  }
}