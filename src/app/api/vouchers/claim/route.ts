import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyUser(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) throw new Error("Unauthorized: No token provided");
  const token = authHeader.split("Bearer ")[1];
  if (!token) throw new Error("Unauthorized: Invalid token format");

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) throw new Error("Unauthorized: Invalid token");

  return user;
}

export async function POST(req: Request) {
  try {
    const user = await verifyUser(req); // Authenticate user
    const { code } = await req.json(); // Get voucher code from body

    if (!code) {
      return NextResponse.json({ success: false, error: "Voucher code is required" }, { status: 400 });
    }

    // Call the PostgreSQL function to claim the voucher
    const { data, error } = await supabaseAdmin.rpc('claim_voucher', {
      p_user_id: user.id,
      p_voucher_code: code,
    });

    if (error) {
        // Map SQL function errors to appropriate HTTP status codes
        let status = 500;
        let errorMessage = error.message;
        if (error.code === 'P0001') { // Voucher not found
            status = 404;
            errorMessage = "Voucher tidak ditemukan.";
        } else if (error.code === 'P0002') { // Voucher inactive
            status = 400;
            errorMessage = "Voucher tidak aktif.";
        } else if (error.code === 'P0003') { // Voucher not yet valid
            status = 400;
            errorMessage = "Voucher belum berlaku.";
        } else if (error.code === 'P0004') { // Voucher expired
            status = 400;
            errorMessage = "Voucher sudah kedaluwarsa.";
        } else if (error.code === 'P0005') { // Claim limit reached
            status = 409; // Conflict
            errorMessage = "Kuota voucher sudah habis.";
        } else if (error.code === 'P0006') { // Already claimed by user
            status = 409; // Conflict
            errorMessage = "Anda sudah mengklaim voucher ini.";
        } else if (error.message.includes("Unauthorized")) {
            status = 401;
        }

        console.error("Error claiming voucher:", errorMessage);
        return NextResponse.json({ success: false, error: errorMessage }, { status });
    }

    // The SQL function returns the claimed_vouchers row
    return NextResponse.json({ success: true, message: "Voucher berhasil diklaim!", claimedVoucher: data });

  } catch (error: any) {
    console.error("Unhandled error claiming voucher:", error);
    let status = 500;
    if (error.message.includes("Unauthorized")) {
      status = 401;
    }
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
