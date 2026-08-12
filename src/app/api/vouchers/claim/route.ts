import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyUser } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // 1. Verifikasi user secara ringkas menggunakan helper terpusat
    const user = await verifyUser(req);

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
      const errorMessage = error.message;

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("API Claim Voucher Unhandled Error:", message);

    // Otomatis tangkap error Unauthorized dari helper verifyUser
    const status = message.includes("Unauthorized") ? 401 : 500;

    return NextResponse.json(
      { success: false, error: message || "Internal Server Error" },
      { status }
    );
  }
}