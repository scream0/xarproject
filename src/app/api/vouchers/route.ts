import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAdmin(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) throw new Error("Unauthorized: No token provided");
  const token = authHeader.split("Bearer ")[1];
  if (!token) throw new Error("Unauthorized: Invalid token format");

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) throw new Error("Unauthorized: Invalid token");

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError)
    throw new Error("Server Error: Could not retrieve user profile");

  const normalizedRole = String(profile?.role || "").toLowerCase();
  if (!profile || !["admin", "superadmin"].includes(normalizedRole))
    throw new Error("Forbidden: User is not an admin");

  return user;
}

// ── 1. READ (GET): Mengambil daftar semua voucher atau detail voucher berdasarkan ID ──
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    const query = supabaseAdmin.from("vouchers").select("*");

    if (id) {
      const { data, error } = await query.eq("id", id).single();
      if (error) throw error;
      return NextResponse.json({ success: true, voucher: data });
    } else {
      await verifyAdmin(req); // Reading all vouchers should be admin-only
      const { data, error } = await query.order("id", { ascending: false });
      if (error) throw error;
      return NextResponse.json({ success: true, vouchers: data });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("GET Voucher Error:", message);
    if (
      message.includes("Unauthorized") ||
      message.includes("Forbidden")
    ) {
      return NextResponse.json(
        { success: false, error: message },
        { status: message.includes("Unauthorized") ? 401 : 403 },
      );
    }
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

// ── 2. CREATE (POST): Membuat voucher baru ──
export async function POST(req: Request) {
  try {
    await verifyAdmin(req);
    const body = await req.json();
    const { 
      code, 
      title, 
      type, 
      discount_amount, 
      min_purchase, 
      valid_until, 
      usage_limit, 
      total_usage_limit, 
      is_active 
    } = body;

    if (!code || discount_amount === undefined || !valid_until) {
      return NextResponse.json({ error: "Kode, nominal diskon, dan masa berlaku wajib diisi" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("vouchers")
      .insert({
        code: code.toUpperCase(),
        title: title || "",
        type: type || "shipping", // 'shipping', 'percentage', atau 'fixed'
        discount_amount: Number(discount_amount),
        min_purchase: Number(min_purchase || 0),
        valid_until,
        usage_limit: Number(usage_limit || 1),
        total_usage_limit: total_usage_limit ? Number(total_usage_limit) : null,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Voucher berhasil dibuat", voucher: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : (error && typeof error === "object" && (error as any).message) ? (error as any).message : "Unknown error";
    console.error("POST Voucher Error:", message, error);
    if (
      message.includes("Unauthorized") ||
      message.includes("Forbidden")
    ) {
      return NextResponse.json(
        { success: false, error: message },
        { status: message.includes("Unauthorized") ? 401 : 403 },
      );
    }
    return NextResponse.json({ success: false, error: message, details: error }, { status: 500 });
  }
}

// ── 3. UPDATE (PUT): Memperbarui data voucher yang sudah ada ──
export async function PUT(req: Request) {
  try {
    await verifyAdmin(req);
    const body = await req.json();
    const { 
      id, 
      code, 
      title, 
      type, 
      discount_amount, 
      min_purchase, 
      valid_until, 
      usage_limit, 
      total_usage_limit, 
      is_active 
    } = body;

    if (!id) {
      return NextResponse.json({ error: "ID voucher diperlukan untuk pembaruan" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (code) updateData.code = code.toUpperCase();
    if (title !== undefined) updateData.title = title;
    if (type) updateData.type = type;
    if (discount_amount !== undefined) updateData.discount_amount = Number(discount_amount);
    if (min_purchase !== undefined) updateData.min_purchase = Number(min_purchase);
    if (valid_until) updateData.valid_until = valid_until;
    if (usage_limit !== undefined) updateData.usage_limit = Number(usage_limit);
    if (total_usage_limit !== undefined) updateData.total_usage_limit = total_usage_limit ? Number(total_usage_limit) : null;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabaseAdmin
      .from("vouchers")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Voucher berhasil diperbarui", voucher: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("UPDATE Voucher Error:", message);
    if (
      message.includes("Unauthorized") ||
      message.includes("Forbidden")
    ) {
      return NextResponse.json(
        { success: false, error: message },
        { status: message.includes("Unauthorized") ? 401 : 403 },
      );
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── 4. DELETE (DELETE): Menghapus voucher berdasarkan ID ──
export async function DELETE(req: Request) {
  try {
    await verifyAdmin(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID voucher diperlukan" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("vouchers")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Voucher berhasil dihapus" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("DELETE Voucher Error:", message);
    if (
      message.includes("Unauthorized") ||
      message.includes("Forbidden")
    ) {
      return NextResponse.json(
        { success: false, error: message },
        { status: message.includes("Unauthorized") ? 401 : 403 },
      );
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}