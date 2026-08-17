import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "@/lib/apiAuth";

// Helper untuk inisialisasi Supabase secara aman (mencegah crash di tingkat modul)
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase server environment variables are missing. SUPABASE_SERVICE_ROLE_KEY is required.",
    );
  }
  return createClient(supabaseUrl, supabaseKey);
}

// GET -> Mengambil semua produk atau satu produk berdasarkan ID (?id=...)
export async function GET(request) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    
    // Bersihkan spasi atau karakter tersembunyi dengan .trim()
    const rawId = searchParams.get("id");
    const productId = rawId ? rawId.trim() : null;

    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "created_at";
    let sortOrder = searchParams.get("sortOrder") || "desc";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "12", 10);

    // 1. Jika ada parameter ID yang valid
    if (productId && productId !== "undefined" && productId !== "null") {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, category, image_url, variants, created_at")
        .eq("id", productId)
        .single();

      if (error) throw error;

      if (!data) {
        return NextResponse.json(
          { success: false, error: "Produk tidak ditemukan" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: data });
    }

    // 2. Jika mengambil daftar produk (list) secara umum
    let query = supabase.from("products").select("id, name, description, category, image_url, variants, created_at", { count: "exact" });

    if (search) {
      query = query.or(
        `name.ilike.%${search}\%,description.ilike.\%${search}%`,
      );
    }

    let orderColumn = sortBy;
    let ascending = sortOrder === "asc";

    if (sortBy === "price-low" || sortBy === "price-high") {
      orderColumn = "created_at"; 
    } else if (sortBy === "name") {
      ascending = true;
    } else {
      orderColumn = "created_at";
      ascending = false;
    }

    query = query.order(orderColumn, { ascending: ascending });

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;
    return NextResponse.json({ success: true, data: data || [], total: count });
  } catch (error) {
    console.error("Gagal mengambil data produk dari Supabase:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
// POST -> Menambahkan produk baru ke tabel products
export async function POST(request) {
  try {
    await verifyAdmin(request);
    const supabase = getSupabaseClient();

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const {
      name,
      category,
      description,
      imageUrl,
      imagePublicId,
      variants,
      weight,
      length,
      width,
      height,
      status,
      province,
      city,
      cityId,
      stockLocation,
    } = body || {};

    if (!name || !imageUrl) {
      return NextResponse.json(
        { success: false, error: "Name and main image are required" },
        { status: 400 },
      );
    }

    const { error } = await supabase.from("products").insert([
      {
        name: name,
        category: category || "Parfum",
        description: description,
        image_url: imageUrl,
        image_public_id: imagePublicId,
        variants: variants,
        weight: weight !== undefined ? Number(weight) || 0 : 250,
        length: length !== undefined ? Number(length) || 0 : undefined,
        width: width !== undefined ? Number(width) || 0 : undefined,
        height: height !== undefined ? Number(height) || 0 : undefined,
        status: status || "published",
        province: province,
        city: city,
        cityId: cityId,
        stockLocation: stockLocation,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Produk berhasil ditambahkan",
    });
  } catch (error) {
    console.error("Gagal menambahkan produk ke Supabase:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

// PUT -> Memperbarui data produk dan variannya di tabel products
export async function PUT(request) {
  try {
    await verifyAdmin(request);
    const supabase = getSupabaseClient();

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const {
      productId,
      name,
      description,
      imageUrl,
      imagePublicId,
      variants,
      weight,
      length,
      width,
      height,
      status,
      province,
      city,
      cityId,
      stockLocation,
    } = body || {};

    if (!productId) {
      return NextResponse.json(
        { success: false, error: "productId is required" },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("products")
      .update({
        name: name,
        description: description,
        image_url: imageUrl,
        image_public_id: imagePublicId,
        variants: variants,
        weight: weight !== undefined ? Number(weight) || 0 : undefined,
        length: length !== undefined ? Number(length) || 0 : undefined,
        width: width !== undefined ? Number(width) || 0 : undefined,
        height: height !== undefined ? Number(height) || 0 : undefined,
        status: status,
        province: province,
        city: city,
        cityId: cityId,
        stockLocation: stockLocation,
      })
      .eq("id", productId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Produk berhasil diperbarui",
    });
  } catch (error) {
    console.error("Gagal memperbarui produk di Supabase:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

// DELETE -> Menghapus produk dari tabel products berdasarkan ID
export async function DELETE(request) {
  try {
    await verifyAdmin(request);
    const supabase = getSupabaseClient();
    let productId;

    try {
      const body = await request.json();
      productId = body?.productId;
    } catch {
      const { searchParams } = new URL(request.url);
      productId = searchParams.get("id");
    }

    if (!productId) {
      return NextResponse.json(
        { success: false, error: "productId is required" },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Produk berhasil dihapus",
    });
  } catch (error) {
    console.error("Gagal menghapus produk di Supabase:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}