import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "@/lib/apiAuth";

// Helper untuk inisialisasi Supabase secara aman (mencegah crash di tingkat modul)
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase environment variables are missing or not loaded.",
    );
  }
  return createClient(supabaseUrl, supabaseKey);
}

// GET -> Mengambil semua produk atau satu produk berdasarkan ID (?id=...)
export async function GET(request) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("id");
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "created_at";
    let sortOrder = searchParams.get("sortOrder") || "desc"; // Default to desc for created_at
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "12", 10);

    let query = supabase.from("products").select("id, name, description, category, image_url, variants, created_at", { count: "exact" });

    // Filter by product ID if provided, otherwise apply general filters
    if (productId) {
      query = query.eq("id", productId).single();
    } else {
      // Apply search filter
      if (search) {
        query = query.or(
          `name.ilike.%${search}%,description.ilike.%${search}%`,
        );
      }

      // Apply sort order
      let orderColumn = sortBy;
      let ascending = sortOrder === "asc";

      if (sortBy === "price-low") {
        orderColumn = "variants->0->price"; // Assumes price is in the first variant
        ascending = true;
      } else if (sortBy === "price-high") {
        orderColumn = "variants->0->price";
        ascending = false;
      } else if (sortBy === "name") {
        ascending = true; // Default name sort to ascending
      } else {
        // Default sort for 'default' or unknown sortBy
        orderColumn = "created_at";
        ascending = false;
      }

      query = query.order(orderColumn, { ascending: ascending });

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);
    }

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
