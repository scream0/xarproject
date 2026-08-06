import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

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
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { uid, email, name, phone, role } = body;

    if (!uid) {
      return NextResponse.json({ error: "uid is required" }, { status: 400 });
    }

    const { data: existingUser } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();

    if (!existingUser) {
      const newUserData = {
        id: uid,
        role: role || "customer",
        created_at: new Date().toISOString(),
      };

      const { error: insertErr } = await supabaseAdmin.from("profiles").insert(newUserData);
      if (insertErr) {
        console.warn("Gagal insert profiles row:", insertErr.message);
      }

      await supabaseAdmin.auth.admin.updateUserById(uid, {
        user_metadata: { full_name: name || "Valued Customer", phone: phone || "" },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: "User baru berhasil didaftarkan ke database",
        data: newUserData,
      });
    } else {
      const { error: updateErr } = await supabaseAdmin
        .from("profiles")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", uid);

      if (updateErr) {
        console.warn("Gagal update profiles row:", updateErr.message);
      }

      return NextResponse.json({
        success: true,
        message: "Data user sudah ada, sinkronisasi berhasil",
        data: existingUser,
      });
    }
  } catch (error) {
    console.error("Gagal menyinkronkan user ke Supabase:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan pada server" },
      { status: 500 },
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

    if (!type) {
      return NextResponse.json(
        { error: "type is required (profile | addresses | points)" },
        { status: 400 },
      );
    }

    if (type === "profile") {
      const cleanUsername = updateData.username?.trim();

      if (!cleanUsername) {
        return NextResponse.json(
          { error: "Username tidak boleh kosong." },
          { status: 400 },
        );
      }

      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          username: cleanUsername,
          full_name: updateData.fullName || "",
          gender: updateData.gender || "",
          birth_date: updateData.birthDate || "",
          phone: updateData.phone || "",
          photo_url: updateData.photoURL || "",
        },
      });

      const { data: updatedRecord } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      return NextResponse.json({
        success: true,
        message: "Profil berhasil diperbarui",
        data: updatedRecord || { id: userId },
      });
    }

    if (type === "points") {
      const { points, balance } = updateData;
      const pointsPayload = { updated_at: new Date().toISOString() };
      if (typeof points === "number") pointsPayload.points = points;
      if (typeof balance === "number") pointsPayload.balance = balance;

      await supabaseAdmin.from("profiles").update(pointsPayload).eq("id", userId);

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
      { status: 500 },
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
      { status: 500 },
    );
  }
}