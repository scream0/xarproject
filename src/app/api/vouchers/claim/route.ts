import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyUser } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await verifyUser(req); // Authenticate user
    const { code } = await req.json(); // Get voucher code from body

    if (!code) {
      return NextResponse.json(
        { success: false, error: "Voucher code is required" },
        { status: 400 },
      );
    }

    // Panggil function PostgreSQL untuk klaim voucher (atomic, anti race-condition)
    const { data, error } = await supabaseAdmin.rpc("claim_voucher", {
      p_user_id: user.id,
      p_voucher_code: code,
    });

    if (error) {
      // Mapping error code dari SQL function ke HTTP status yang sesuai
      let status = 500;
      let errorMessage = error.message;

      if (error.code === "P0001") {
        status = 404;
        errorMessage = "Voucher tidak ditemukan.";
      } else if (error.code === "P0002") {
        status = 400;
        errorMessage = "Voucher tidak aktif.";
      } else if (error.code === "P0003") {
        status = 400;
        errorMessage = "Voucher belum berlaku.";
      } else if (error.code === "P0004") {
        status = 400;
        errorMessage = "Voucher sudah kedaluwarsa.";
      } else if (error.code === "P0005") {
        status = 409;
        errorMessage = "Kuota voucher sudah habis.";
      } else if (error.code === "P0006") {
        status = 409;
        errorMessage = "Anda sudah mengklaim voucher ini.";
      } else if (error.message.includes("Unauthorized")) {
        status = 401;
      }

      console.error("Error claiming voucher:", errorMessage);
      return NextResponse.json({ success: false, error: errorMessage }, { status });
    }

    // data = row claimed_vouchers yang baru dibuat (belum ter-join detail voucher).
    // Frontend cukup panggil refreshProfile() setelah ini agar daftar voucher
    // ter-update lengkap dengan detail (lihat /api/profile yang sudah include join).
    return NextResponse.json({
      success: true,
      message: "Voucher berhasil diklaim!",
      claimedVoucher: data,
    });
  } catch (error: any) {
    console.error("Unhandled error claiming voucher:", error);
    const status = error.message?.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}