import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { data: vouchers, error } = await supabaseAdmin
      .from("vouchers")
      .select("*")
      .eq("is_active", true)
      .eq("publicly_visible", true)
      .or(`valid_until.is.null,valid_until.gt.${new Date().toISOString()}`)
      .order("valid_until", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching public vouchers:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, vouchers });
  } catch (error: any) {
    console.error("Unhandled error fetching public vouchers:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
