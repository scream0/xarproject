import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Helper for admin verification (Mendukung Header Bearer & Cookie Session)
async function verifyAdmin(request) {
  let token = request.headers.get("authorization")?.split(" ")[1];
  
  // Fallback: Jika header tidak ada, cek dari cookie "session"
  if (!token) {
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/session=([^;]+)/);
    if (match) {
      token = match[1];
    }
  }

  if (!token) {
    throw new Error("Unauthorized: No token provided");
  }
  
  // Verifikasi token modern menggunakan auth.getUser(token)
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    throw new Error("Unauthorized: Invalid token");
  }

  // Periksa role admin dari tabel "profiles" menggunakan .eq("id", user.id).single()
  const { data: adminUser, error: dbError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const normalizedRole = String(adminUser?.role || "").toLowerCase();
  if (dbError || !adminUser || !["admin", "superadmin"].includes(normalizedRole)) {
    throw new Error("Forbidden: User is not an admin");
  }
}

export async function GET(request) {
  try {
    await verifyAdmin(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim().toLowerCase();
    const search = searchParams.get("search")?.trim().toLowerCase();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || 20)));
    const offset = (page - 1) * limit;
    const ORDER_LIST_SELECT =
      "id,user_id,status,amount,shipping_cost,discount_amount,tax_amount,payment_type,customer_name,customer_email,customer_phone,shipping_receipt_number,shipping_address,shipping_detail,created_at,updated_at";

    // Base query with count for pagination
    let query = supabaseAdmin
      .from("orders")
      .select(ORDER_LIST_SELECT, { count: "exact" });

    // Apply filtering by status
    if (status) {
      query = query.eq("status", status);
    }

    // Apply search filter across multiple relevant fields
    if (search) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(search);
      
      const orConditions = [
        `customer_name.ilike.%${search}%`,
        `customer_email.ilike.%${search}%`,
        `id.ilike.%${search}%`, // orderId
        `shipping_receipt_number.ilike.%${search}%`, // Tracking number
      ];

      if (isUUID) {
        orConditions.push(`user_id.eq.${search}`);
      }
      
      query = query.or(orConditions.join(","));
    }

    // Apply sorting - default to latest first
    query = query.order("created_at", { ascending: false });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Execute the query
    const { data: orders, error, count } = await query;

    if (error) {
      console.error("Failed to load admin orders from Supabase:", error);
      throw new Error(error.message);
    }

    const totalOrders = count || 0;
    const totalPages = Math.max(1, Math.ceil(totalOrders / limit));

    return NextResponse.json({
      success: true,
      orders: orders || [],
      pagination: {
        currentPage: page,
        totalPages,
        totalOrders,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/admin/orders:", error.message);
    const isAuthError = error.message.includes("Unauthorized") || error.message.includes("Forbidden");
    const statusCode = isAuthError ? 403 : 500;
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: statusCode },
    );
  }
}