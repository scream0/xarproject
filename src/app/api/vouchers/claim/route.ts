import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // 1. Verifikasi user langsung melalui Header Authorization & Supabase Admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Token tidak ditemukan" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Token tidak valid atau kedaluwarsa" },
        { status: 401 }
      );
    }

    // 2. Ambil voucher_id dari body request frontend
    const body = await req.json();
    const { voucher_id } = body;

    if (!voucher_id) {
      return NextResponse.json(
        { success: false, error: "Voucher ID is required" },
        { status: 400 }
      );
    }

    // 3. Panggil fungsi database Supabase RPC untuk klaim voucher
    const { data, error } = await supabaseAdmin.rpc("claim_voucher", {
      p_user_id: user.id,
      p_voucher_id: Number(voucher_id),
      p_order_id: null,
    });

    if (error) {
      console.error("Supabase RPC Error detail:", error);
      let status = 400;
      let errorMessage = error.message;

      if (error.code === "P0001") status = 404; // Voucher tidak ditemukan
      if (error.code === "P0002") status = 400; // Voucher tidak aktif
      if (error.code === "P0004") status = 400; // Voucher kedaluwarsa
      if (error.code === "P0006") status = 409; // Sudah diklaim (Conflict)

      return NextResponse.json({ success: false, error: errorMessage }, { status });
    }

    return NextResponse.json({
      success: true,
      message: "Voucher berhasil diklaim!",
      claimedVoucher: data,
    });
  } catch (error: any) {
    console.error("API Claim Voucher Unhandled Error:", error.message || error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}