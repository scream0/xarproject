import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Inisialisasi Supabase Server Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// GET -> Mengambil semua produk atau satu produk berdasarkan ID (?id=...)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("id");

    if (productId) {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    } else {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return NextResponse.json({ success: true, data: data || [] });
    }
  } catch (error) {
    console.error("Gagal mengambil data produk dari Supabase:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST -> Menambahkan produk baru ke tabel products
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, category, description, imageUrl, imagePublicId, variants } =
      body;

    if (!name || !imageUrl) {
      return NextResponse.json(
        { error: "Name and main image are required" },
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT -> Memperbarui data produk dan variannya di tabel products
export async function PUT(request) {
  try {
    const body = await request.json();
    const { productId, name, description, imageUrl, imagePublicId, variants } =
      body;

    if (!productId) {
      return NextResponse.json(
        { error: "productId is required" },
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
      })
      .eq("id", productId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Produk berhasil diperbarui",
    });
  } catch (error) {
    console.error("Gagal memperbarui produk di Supabase:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE -> Menghapus produk dari tabel products berdasarkan ID
export async function DELETE(request) {
  try {
    let productId;

    // Coba ambil productId dari body JSON (jika dikirim via body)
    try {
      const body = await request.json();
      productId = body.productId;
    } catch {
      // Jika body kosong, coba ambil dari query parameter (?id=...)
      const { searchParams } = new URL(request.url);
      productId = searchParams.get("id");
    }

    if (!productId) {
      return NextResponse.json(
        { error: "productId is required" },
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
