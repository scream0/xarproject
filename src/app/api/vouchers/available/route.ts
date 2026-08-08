import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyUser } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await verifyUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: vouchers, error } = await supabaseAdmin
      .from("vouchers")
      .select("*")
      .eq("is_active", true)
      .order("id", { ascending: false });

    if (error) throw error;

    // Ambil statistik klaim (progress bar) untuk voucher yang punya total_usage_limit
    const { data: stats } = await supabaseAdmin
      .from("voucher_claim_stats")
      .select("voucher_id, claimed_count, claimed_percentage");

    const statsMap = new Map((stats || []).map((s) => [s.voucher_id, s]));

    const vouchersWithStats = (vouchers || []).map((v) => ({
      ...v,
      claimed_count: statsMap.get(v.id)?.claimed_count || 0,
      claimed_percentage: statsMap.get(v.id)?.claimed_percentage ?? null,
    }));

    return NextResponse.json({ success: true, vouchers: vouchersWithStats });
  } catch (error: any) {
    console.error("Get Available Vouchers Error:", error.message);
    const status = error.message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}