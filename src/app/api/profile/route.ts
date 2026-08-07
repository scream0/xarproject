import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Helper untuk verifikasi user dari token
async function verifyUser(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) throw new Error("Unauthorized: No token provided");
  const token = authHeader.split("Bearer ")[1];
  if (!token) throw new Error("Unauthorized: Invalid token format");

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized: Invalid token");
  return user;
}

// 1. READ: Mengambil profil user yang sedang login
export async function GET(request: Request) {
  try {
    const user = await verifyUser(request);

    let { data: profile, error: dbError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // Jika profil belum ada di database, buatkan secara otomatis (Self-healing)
    if (dbError && dbError.code === 'PGRST116') { // PGRST116 is code for 'No rows found'
      const defaultProfile = {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
        username: user.email?.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "") || `user_${user.id.substring(0, 5)}`,
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

    // --- Fetch claimed vouchers ---
    const { data: claimedVouchers, error: claimedVouchersError } = await supabaseAdmin
      .from("claimed_vouchers")
      .select(`
        *, // Select all from claimed_vouchers
        vouchers ( // Select all from joined vouchers table
          id, code, title, description, discount_type, discount_value, max_discount_amount, min_purchase_amount, valid_from, valid_until
        )
      `)
      .eq("user_id", user.id)
      .order("claimed_at", { ascending: false });

    if (claimedVouchersError) {
      console.error("Error fetching claimed vouchers:", claimedVouchersError);
      // Log the error but don't block the profile response
    }

    // Add claimed vouchers to the profile object
    const responseProfile = {
      ...profile,
      claimed_vouchers: claimedVouchers || [],
    };

    return NextResponse.json({ success: true, profile: responseProfile });
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
      profile: updatedProfile 
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

    // Hapus data dari tabel profiles
    const { error: deleteProfileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", user.id);

    if (deleteProfileError) throw new Error(deleteProfileError.message);

    // Hapus user dari Supabase Auth agar benar-benar terhapus total
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