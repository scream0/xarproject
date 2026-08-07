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

    return NextResponse.json({ success: true, vouchers });
  } catch (error: any) {
    console.error("Get Available Vouchers Error:", error.message);
    const status = error.message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}