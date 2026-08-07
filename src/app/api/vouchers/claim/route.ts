import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyUser } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await verifyUser(req); // Authenticate user
    const { voucher_id } = await req.json(); // Ambil voucher_id dari body request frontend

    if (!voucher_id) {
      return NextResponse.json(
        { success: false, error: "Voucher ID is required" },
        { status: 400 }
      );
    }

    // Panggil function PostgreSQL untuk klaim voucher berdasarkan voucher_id
    const { data, error } = await supabaseAdmin.rpc("claim_voucher", {
      p_user_id: user.id,
      p_voucher_id: voucher_id,
      p_order_id: null, // Default null karena diklaim manual dari card
    });

    if (error) {
      let status = 500;
      let errorMessage = error.message;

      // Mapping error code dari SQL function (sesuaikan dengan logika PL/pgSQL Anda)
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