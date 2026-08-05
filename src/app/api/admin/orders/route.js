import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Helper for admin verification
async function verifyAdmin(request) {
  const token = request.headers.get("authorization")?.split(" ")[1];
  if (!token) {
    throw new Error("Unauthorized: No token provided");
  }
  const { data: user, error } = await supabaseAdmin.auth.api.getUser(token);
  if (error) {
    throw new Error("Unauthorized: Invalid token");
  }
  const { data: adminUser, error: dbError } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (dbError || !adminUser || adminUser.role !== "admin") {
    throw new Error("Forbidden: User is not an admin");
  }
}

export async function GET(request) {
  try {
    await verifyAdmin(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim().toLowerCase();
    const search = searchParams.get("search")?.trim().toLowerCase();
    // sortBy logic for 'webhook' is deprecated as its implementation details are not available.
    // const sortBy = searchParams.get("sortBy")?.trim().toLowerCase();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || 20)));
    const offset = (page - 1) * limit;

    // Base query with count for pagination
    let query = supabaseAdmin
      .from("orders")
      .select("*", { count: "exact" });

    // Apply filtering by status
    if (status) {
      query = query.eq("status", status);
    }

    // Apply search filter across multiple relevant fields
    if (search) {
      // Check if search term could be a UUID for id or user_id
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
