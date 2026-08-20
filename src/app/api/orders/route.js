import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// ========== AUTH HELPERS ==========

async function verifyUser(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) throw new Error("Unauthorized: No Authorization header");
  const token = authHeader.split("Bearer ")[1];
  if (!token) throw new Error("Unauthorized: Invalid token format");
  
  // Diperbarui menggunakan auth.getUser(token) modern
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    throw new Error(`Authentication failed: ${error?.message || "Invalid token"}`);
  }
  return user;
}

async function verifyAdmin(request) {
    const user = await verifyUser(request);
    
    // Diperbarui dari tabel "users" ke tabel "profiles"
    const { data: profile, error } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
        
    const normalizedRole = String(profile?.role || "").toLowerCase();
    if (error || !profile || !["admin", "superadmin"].includes(normalizedRole)) {
        throw new Error("Forbidden: Admin access required");
    }
    return user;
}


// ========== GET HANDLER ==========
// Fetches user's primary address and orders, or all orders for an admin.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    // --- ADMIN MODE ---
    if (!userId) {
      await verifyAdmin(request);
      const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
      const limit = Math.max(1, parseInt(searchParams.get("limit") || "10"));
      const offset = (page - 1) * limit;

      const { data, error, count } = await supabaseAdmin
        .from("orders")
        .select("id,user_id,status,amount,shipping_cost,discount_amount,tax_amount,payment_type,customer_name,customer_email,customer_phone,shipping_receipt_number,created_at,updated_at, items:order_items(*)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (error) throw error;

      return NextResponse.json({
        success: true,
        orders: data,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil((count || 0) / limit),
          totalOrders: count || 0,
        },
      });
    }

    // --- USER MODE ---
    const user = await verifyUser(request);
    if (user.id !== userId) {
        return NextResponse.json({ success: false, error: "Cannot fetch data for another user." }, { status: 403 });
    }
    
    // 1. Fetch User's Primary Address
    const { data: primaryAddressData, error: addressError } = await supabaseAdmin
      .from("addresses")
      .select("id,user_id,is_primary,label,recipient_name,recipient_phone,street,city,province,postal_code")
      .eq("user_id", userId)
      .order("is_primary", { ascending: false }) // primary first
      .limit(1)
      .single();

    if (addressError && addressError.code !== 'PGRST116') { // Ignore 'no rows' error
        console.error("Failed to fetch user address:", addressError.message);
    }
    
    // 2. Fetch User's Orders
    const { data: ordersData, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id,user_id,status,amount,shipping_cost,discount_amount,tax_amount,payment_type,customer_name,customer_email,customer_phone,shipping_receipt_number,notes,created_at,updated_at, items:order_items(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (ordersError) throw ordersError;

    return NextResponse.json({
      success: true,
      primaryAddress: primaryAddressData || null,
      orders: ordersData || [],
    });

  } catch (error) {
    console.error("GET /api/orders error:", error.message);
    const isAuthError = error.message.includes("Unauthorized") || error.message.includes("Forbidden");
    return NextResponse.json(
      { success: false, error: error.message },
      { status: isAuthError ? 403 : 500 },
    );
  }
}


// NOTE: PUT handler dihapus dari sini (2026-08-13).
// Sebelumnya endpoint ini dipakai oleh komponen TransactionTable (tab Overview)
// untuk update status pesanan, tapi komponen itu duplikat dari OrdersManagement
// (tab Orders) dan sudah dihapus. Semua update status sekarang lewat:
//   PUT /api/admin/orders/[id]/status
// yang memakai helper bersama di @/lib/orderStatusHelper (termasuk logic
// pengurangan stok yang sebelumnya cuma ada di endpoint ini).