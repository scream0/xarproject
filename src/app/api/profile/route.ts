import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyUser } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

/**
 * Ambil daftar voucher yang sudah diklaim user dari tabel user_vouchers,
 * lengkap dengan detail voucher-nya via join ke tabel vouchers.
 */
async function getClaimedVouchersForUser(userId: string) {
  const { data: claims, error: claimError } = await supabaseAdmin
    .from("user_vouchers")
    .select("id, voucher_id, used_at, order_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (claimError) {
    console.error("Gagal memuat user_vouchers:", claimError.message);
    return [];
  }

  if (!claims || claims.length === 0) return [];

  const voucherIds = claims.map((c) => c.voucher_id).filter(Boolean);

const { data: vouchers, error: voucherError } = await supabaseAdmin
  .from("vouchers")
  .select("id, code, title, type, discount_amount, min_purchase, valid_until, is_active")
  .in("id", voucherIds);

  if (voucherError) {
    console.error("Gagal memuat detail vouchers:", voucherError.message);
  }

  const voucherMap = new Map((vouchers || []).map((v) => [v.id, v]));

  return claims.map((cv) => {
    const voucherDetail = voucherMap.get(cv.voucher_id) || null;
    const now = new Date();
    const isExpired = voucherDetail?.valid_until ? new Date(voucherDetail.valid_until) < now : false;

    let status = "active";
    if (cv.used_at) status = "used";
    else if (isExpired) status = "expired";

    return {
      id: cv.id,
      voucher_id: cv.voucher_id,
      claimed_at: cv.created_at,
      used_at: cv.used_at,
      status,
      order_id: cv.order_id,
      vouchers: voucherDetail,
    };
  });
}
// 1. READ: Mengambil profil user yang sedang login (+ claimed_vouchers)
export async function GET(request: Request) {
  try {
    const user = await verifyUser(request);

    let { data: profile, error: dbError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // Jika profil belum ada di database, buatkan secara otomatis (Self-healing)
    if (dbError && dbError.code === "PGRST116") {
      const defaultProfile = {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
        username:
          user.email?.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "") ||
          `user_${user.id.substring(0, 5)}`,
        role: "customer",
      };

      const { data: newProfile, error: insertError } = await supabaseAdmin
        .from("profiles")
        .insert(defaultProfile)
        .select()
        .single();

      if (!insertError) profile = newProfile;
    } else if (dbError) {
      throw new Error(dbError.message);
    }

    // Ambil daftar voucher yang sudah diklaim user dari tabel user_vouchers
    const claimedVouchers = await getClaimedVouchersForUser(user.id);

    return NextResponse.json({
      success: true,
      profile: {
        ...profile,
        user_vouchers: claimedVouchers,
      },
    });
  } catch (error: any) {
    const status = error.message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

// 2. CREATE: Membuat profil baru secara eksplisit
export async function POST(request: Request) {
  try {
    const user = await verifyUser(request);
    const body = await request.json();

    const insertPayload = {
      id: user.id,
      email: user.email,
      username: body.username,
      full_name: body.full_name,
      phone: body.phone,
      gender: body.gender,
      birth_date: body.birth_date,
      photo_url: body.photo_url,
      photo_public_id: body.photo_public_id,
      newsletter_subscribed: body.newsletter_subscribed ?? true,
      addresses: body.addresses || [],
      role: "customer",
    };

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .upsert(insertPayload, { onConflict: "id" })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, message: "Profil berhasil dibuat", profile });
  } catch (error: any) {
    const status = error.message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

// 3. UPDATE: Memperbarui profil atau alamat user
export async function PUT(request: Request) {
  try {
    const user = await verifyUser(request);
    const body = await request.json();
    const updatePayload: any = {};

    if (body.username !== undefined) updatePayload.username = body.username;
    if (body.full_name !== undefined) updatePayload.full_name = body.full_name;
    if (body.phone !== undefined) updatePayload.phone = body.phone;
    if (body.gender !== undefined) updatePayload.gender = body.gender;
    if (body.birth_date !== undefined) updatePayload.birth_date = body.birth_date;
    if (body.photo_url !== undefined) updatePayload.photo_url = body.photo_url;
    if (body.photo_public_id !== undefined) updatePayload.photo_public_id = body.photo_public_id;
    if (body.newsletter_subscribed !== undefined) updatePayload.newsletter_subscribed = body.newsletter_subscribed;
    if (body.addresses !== undefined) updatePayload.addresses = body.addresses;

    updatePayload.updated_at = new Date().toISOString();

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id)
      .select()
      .single();

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({
      success: true,
      message: "Data berhasil diperbarui",
      profile: updatedProfile,
    });
  } catch (error: any) {
    const status = error.message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

// 4. DELETE: Menghapus profil dan akun user
export async function DELETE(request: Request) {
  try {
    const user = await verifyUser(request);

    const { error: deleteProfileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", user.id);

    if (deleteProfileError) throw new Error(deleteProfileError.message);

    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteAuthError) {
      console.warn("Gagal menghapus user dari Auth:", deleteAuthError.message);
    }

    return NextResponse.json({ success: true, message: "Akun dan profil berhasil dihapus" });
  } catch (error: any) {
    const status = error.message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}