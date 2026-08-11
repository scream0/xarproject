import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function getRequestUser(request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Unauthorized");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  return user;
}

async function canManageUser(request, userId) {
  const actor = await getRequestUser(request);
  if (actor.id === userId) return actor;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", actor.id)
    .maybeSingle();
  if (!["admin", "superadmin"].includes(String(profile?.role).toLowerCase())) {
    throw new Error("Forbidden");
  }
  return actor;
}

function getErrorStatus(error) {
  if (error?.message === "Unauthorized") return 401;
  if (error?.message === "Forbidden") return 403;
  return 500;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    await canManageUser(request, userId);

    const { data: userRecord, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !userRecord) {
      return NextResponse.json({ exists: false, data: null }, { status: 200 });
    }

    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId).catch(() => ({ data: null }));

    const responseData = {
      ...userRecord,
      email: authData?.user?.email || userRecord.email,
      user_metadata: authData?.user?.user_metadata || {},
    };

    return NextResponse.json({ exists: true, data: responseData }, { status: 200 });
  } catch (error) {
    console.error("Gagal mengambil data user:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan pada server" },
      { status: getErrorStatus(error) },
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { uid, name, phone, role } = body;

    if (!uid) {
      return NextResponse.json({ error: "uid is required" }, { status: 400 });
    }

    const actor = await canManageUser(request, uid);
    const isAdmin = actor.id !== uid;
    const newUserData = {
      id: uid,
      full_name: name || null,
      phone: phone || null,
      ...(isAdmin && role ? { role } : {}),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .upsert(newUserData, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, message: "Profil tersinkronisasi", data });
  } catch (error) {
    console.error("Gagal menyinkronkan user ke Supabase:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan pada server" },
      { status: getErrorStatus(error) },
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { userId, type, ...updateData } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }
    const actor = await canManageUser(request, userId);
    const isAdmin = actor.id !== userId;

    if (!type) {
      return NextResponse.json(
        { error: "type is required (profile | addresses | points)" },
        { status: 400 },
      );
    }

    // ==========================================
    // 1. UPDATE PROFILE
    // ==========================================
    if (type === "profile") {
      const cleanUsername = updateData.username?.trim() || null;

      // Sinkron ke Auth Metadata Supabase
      if (isAdmin || actor.id === userId) await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          username: cleanUsername,
          full_name: updateData.fullName || "",
          gender: updateData.gender || "",
          birth_date: updateData.birthDate || "",
          phone: updateData.phone || "",
          photo_url: updateData.photoURL || "",
        },
      }).catch(() => {});

      // Payload ke tabel profiles database
      const profilePayload = {
        ...(cleanUsername ? { username: cleanUsername } : {}),
        full_name: updateData.fullName || null,
        gender: updateData.gender || null,
        birth_date: updateData.birthDate || null,
        phone: updateData.phone || null,
        photo_url: updateData.photoURL || null,
        photo_public_id: updateData.photoPublicId || null,
        newsletter_opt_in: updateData.newsletterSubscribed ?? true,
        updated_at: new Date().toISOString(),
      };

      const { error: updateProfileErr } = await supabaseAdmin
        .from("profiles")
        .update(profilePayload)
        .eq("id", userId);

      if (updateProfileErr) {
        throw new Error(updateProfileErr.message);
      }

      const { data: updatedRecord } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      return NextResponse.json({
        success: true,
        message: "Profil berhasil diperbarui",
        data: updatedRecord || { id: userId, ...profilePayload },
      });
    }

    // ==========================================
    // 2. UPDATE ADDRESSES (Buku Alamat)
    // ==========================================
    if (type === "addresses") {
      const { addresses } = updateData;

      const addressPayload = {
        addresses: addresses || [],
        updated_at: new Date().toISOString(),
      };

      const { error: updateAddressErr } = await supabaseAdmin
        .from("profiles")
        .update(addressPayload)
        .eq("id", userId);

      if (updateAddressErr) {
        throw new Error(updateAddressErr.message);
      }

      const { data: updatedRecord } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      return NextResponse.json({
        success: true,
        message: "Alamat berhasil diperbarui",
        data: updatedRecord,
      });
    }

    // ==========================================
    // 3. UPDATE POINTS & SALDO
    // ==========================================
    if (type === "points") {
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { points, balance } = updateData;
      const pointsPayload = { updated_at: new Date().toISOString() };
      if (typeof points === "number") pointsPayload.points = points;
      if (typeof balance === "number") pointsPayload.balance = balance;

      const { error: updatePointsErr } = await supabaseAdmin
        .from("profiles")
        .update(pointsPayload)
        .eq("id", userId);

      if (updatePointsErr) {
        throw new Error(updatePointsErr.message);
      }

      const { data: updatedRecord } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      return NextResponse.json({
        success: true,
        message: "Poin & saldo berhasil diperbarui",
        data: updatedRecord,
      });
    }

    return NextResponse.json({ error: "Invalid update type" }, { status: 400 });
  } catch (error) {
    console.error("Gagal memperbarui data user:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan pada server" },
      { status: getErrorStatus(error) },
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    let userId = searchParams.get("userId");

    if (!userId) {
      try {
        const body = await request.json();
        userId = body.userId;
      } catch {}
    }

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    await canManageUser(request, userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);
    await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Akun pengguna berhasil dihapus",
    });
  } catch (error) {
    console.error("Gagal menghapus akun pengguna:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan pada server" },
      { status: getErrorStatus(error) },
    );
  }
}
