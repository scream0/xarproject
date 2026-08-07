import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyUser } from "@/lib/apiAuth"; // Menggunakan verifikasi user biasa

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // 1. Verifikasi bahwa yang meminta adalah user yang login
    const user = await verifyUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // 2. Ambil semua voucher yang aktif
    const { data: vouchers, error } = await supabaseAdmin
      .from("vouchers")
      .select("*")
      .eq("is_active", true)
      .order("id", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, vouchers });
  } catch (error: any) {
    console.error("Get Available Vouchers Error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}