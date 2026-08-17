import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase server environment variables are missing.");
  }
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request, { params }) {
  try {
    const supabase = getSupabaseClient();
    const productId = params.id?.trim();

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

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Gagal mengambil produk:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}