import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function verifyAdmin(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized: No Authorization header");
    const token = authHeader.split("Bearer ")[1];
    if (!token) throw new Error("Unauthorized: Invalid token format");
    
    const { data: user, error } = await supabaseAdmin.auth.api.getUser(token);
    if (error) throw new Error(`Authentication failed: ${error.message}`);

    const { data: profile, error: dbError } = await supabaseAdmin
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();
    if (dbError || profile?.role !== "admin") {
        throw new Error("Forbidden: Admin access required");
    }
    return user;
}

// GET: Fetches all suppliers and purchase orders.
export async function GET(request) {
  try {
    await verifyAdmin(request);

    const [suppliersRes, ordersRes] = await Promise.all([
      supabaseAdmin.from("suppliers").select("*"),
      supabaseAdmin.from("purchase_orders").select("*").order("created_at", { ascending: false })
    ]);

    if (suppliersRes.error) throw suppliersRes.error;
    if (ordersRes.error) throw ordersRes.error;

    return NextResponse.json({
      suppliers: suppliersRes.data,
      orders: ordersRes.data,
    });
  } catch (error) {
    console.error("GET /procurement error:", error.message);
    const isAuthError = error.message.includes("Unauthorized") || error.message.includes("Forbidden");
    return NextResponse.json({ error: error.message }, { status: isAuthError ? 403 : 500 });
  }
}

// POST: Creates a new supplier or a new purchase order.
export async function POST(request) {
  try {
    const user = await verifyAdmin(request);
    const body = await request.json();

    // Create a new Supplier
    if (body.type === "supplier") {
      if (!body.name) {
        return NextResponse.json({ error: "Supplier name is required." }, { status: 400 });
      }
      const { data, error } = await supabaseAdmin
        .from("suppliers")
        .insert({
          name: body.name,
          contact: body.contact || {},
          lead_time_days: body.leadTime || null,
        })
        .select("id")
        .single();
      
      if (error) throw error;
      return NextResponse.json({ id: data.id }, { status: 201 });
    }
    
    // Create a new Purchase Order
    if (!body.supplierId || !body.item) {
      return NextResponse.json({ error: "Supplier ID and item description are required." }, { status: 400 });
    }
    
    const { data, error } = await supabaseAdmin
      .from("purchase_orders")
      .insert({
        supplier_id: body.supplierId,
        item: body.item,
        quantity: Number(body.quantity || 0),
        status: "draft",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id }, { status: 201 });

  } catch (error) {
    console.error("POST /procurement error:", error.message);
    const isAuthError = error.message.includes("Unauthorized") || error.message.includes("Forbidden");
    return NextResponse.json({ error: error.message }, { status: isAuthError ? 403 : 500 });
  }
}

// PUT: Updates the status of a purchase order.
export async function PUT(request) {
  try {
    await verifyAdmin(request);
    const { id, status } = await request.json();

    if (!id || !["ordered", "received", "cancelled"].includes(status)) {
      return NextResponse.json({ error: "Valid 'id' and 'status' are required." }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("purchase_orders")
      .update({ status: status })
      .eq("id", id);
    
    if (error) throw error;

    return NextResponse.json({ message: "Purchase order updated successfully." });
  } catch (error) {
    console.error("PUT /procurement error:", error.message);
    const isAuthError = error.message.includes("Unauthorized") || error.message.includes("Forbidden");
    return NextResponse.json({ error: error.message }, { status: isAuthError ? 403 : 500 });
  }
}
