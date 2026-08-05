import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function identity(request) {
  const token = request.headers.get("Authorization")?.split("Bearer ")[1];
  if (!token) throw new Error("Authentication required.");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw new Error("Authentication required.");

  let isAdmin = user.user_metadata?.role === "admin";
  if (!isAdmin) {
    const { data: profile } = await supabaseAdmin.from("users").select("role").eq("id", user.id).single();
    if (profile?.role === "admin") isAdmin = true;
  }
  return { uid: user.id, admin: isAdmin };
}

export async function GET(request) {
  try {
    const user = await identity(request);
    let query = supabaseAdmin.from("support_tickets").select("*");
    if (!user.admin) {
      query = query.eq("user_id", user.uid);
    }
    const { data, error } = await query.order("updated_at", { ascending: false });
    if (error) throw error;

    const tickets = (data || []).map((t) => ({
      id: t.id,
      userId: t.user_id,
      subject: t.subject,
      orderId: t.order_id,
      status: t.status,
      messages: t.messages || [],
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));
    return NextResponse.json({ tickets });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}

export async function POST(request) {
  try {
    const user = await identity(request);
    const { subject, message, orderId = "" } = await request.json();
    if (!subject || !message) return NextResponse.json({ error: "Subject and message are required." }, { status: 400 });

    const newTicket = {
      user_id: user.uid,
      subject,
      order_id: orderId,
      status: "open",
      messages: [{ sender: "customer", body: message, createdAt: new Date().toISOString() }],
    };

    const { data, error } = await supabaseAdmin.from("support_tickets").insert(newTicket).select("id").single();
    if (error) throw error;

    return NextResponse.json({ id: data.id, message: "Support ticket created." }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not create ticket." }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await identity(request);
    const { ticketId, message, status } = await request.json();
    if (!ticketId) return NextResponse.json({ error: "Ticket is required." }, { status: 400 });

    const { data: ticket, error: fetchErr } = await supabaseAdmin.from("support_tickets").select("*").eq("id", ticketId).single();
    if (fetchErr || !ticket || (!user.admin && ticket.user_id !== user.uid)) {
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    }

    const updates = {};
    if (status && (user.admin || status === "closed")) updates.status = status;
    if (message) {
      const existingMessages = Array.isArray(ticket.messages) ? ticket.messages : [];
      updates.messages = [...existingMessages, { sender: user.admin ? "admin" : "customer", body: message, createdAt: new Date().toISOString() }];
    }

    const { error: updateErr } = await supabaseAdmin.from("support_tickets").update(updates).eq("id", ticketId);
    if (updateErr) throw updateErr;

    return NextResponse.json({ message: "Ticket updated." });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not update ticket." }, { status: 500 });
  }
}

