import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin"; // Pastikan path ini sesuai dengan inisialisasi Firebase Admin Anda

// Cegah Next.js meng-cache response (penyebab umum data "tidak update")
export const dynamic = "force-dynamic";

// Helper: ubah Firestore Timestamp (dan nested object) jadi format yang aman di-JSON-kan
function serializeData(data) {
  if (data === null || data === undefined) return data;

  // Firestore Timestamp punya method toDate()
  if (typeof data?.toDate === "function") {
    return data.toDate().toISOString();
  }

  if (Array.isArray(data)) {
    return data.map(serializeData);
  }

  if (typeof data === "object") {
    const result = {};
    for (const key in data) {
      result[key] = serializeData(data[key]);
    }
    return result;
  }

  return data;
}

// ==========================================
// 1. READ (GET) -> Mengambil profil & alamat user
// ==========================================
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

    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json({ exists: false, data: null }, { status: 200 });
    }

    const rawData = userDoc.data();
    const safeData = serializeData(rawData);

    return NextResponse.json({ exists: true, data: safeData }, { status: 200 });
  } catch (error) {
    console.error("Gagal mengambil data user:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan pada server" },
      { status: 500 },
    );
  }
}

// ==========================================
// 2. CREATE / SYNC (POST) -> Daftarkan user baru saat login/register
// ==========================================
export async function POST(request) {
  try {
    const body = await request.json();
    const { uid, email, name, phone, role } = body;

    if (!uid) {
      return NextResponse.json({ error: "uid is required" }, { status: 400 });
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      const newUserData = {
        uid: uid,
        email: email || "",
        full_name: name || "Valued Customer",
        phone_number: phone || "",
        role: role || "user", // Default role
        created_at: new Date(),
      };

      await userRef.set(newUserData);

      return NextResponse.json({
        success: true,
        message: "User baru berhasil didaftarkan ke database",
        data: serializeData(newUserData),
      });
    } else {
      await userRef.set(
        {
          last_login: new Date(),
        },
        { merge: true },
      );

      const updatedSnap = await userRef.get();
      return NextResponse.json({
        success: true,
        message: "Data user sudah ada, sinkronisasi berhasil",
        data: serializeData(updatedSnap.data()),
      });
    }
  } catch (error) {
    console.error("Gagal menyinkronkan user ke Firestore:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan pada server" },
      { status: 500 },
    );
  }
}

// ==========================================
// 3. UPDATE (PUT) -> Memperbarui profil atau alamat user
// ==========================================
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
        { error: "type is required (profile | addresses)" },
        { status: 400 },
      );
    }

    const userRef = db.collection("users").doc(userId);

    // Update Profil (dengan validasi username unik)
    if (type === "profile") {
      const cleanUsername = updateData.username?.trim();

      if (!cleanUsername) {
        return NextResponse.json(
          { error: "Username tidak boleh kosong." },
          { status: 400 },
        );
      }

      const usernameQuery = await db
        .collection("users")
        .where("username", "==", cleanUsername)
        .get();

      let isTaken = false;
      usernameQuery.forEach((doc) => {
        if (doc.id !== userId) {
          isTaken = true;
        }
      });

      if (isTaken) {
        return NextResponse.json(
          { error: `Username @${cleanUsername} sudah digunakan orang lain.` },
          { status: 400 },
        );
      }

      const profilePayload = {
        username: cleanUsername,
        full_name: updateData.fullName || "",
        gender: updateData.gender || "",
        birth_date: updateData.birthDate || "",
        phone: updateData.phone || "",
        photo_url: updateData.photoURL || "",
        photo_public_id: updateData.photoPublicId || "",
        updated_at: new Date(),
      };

      await userRef.set(profilePayload, { merge: true });

      const updatedDoc = await userRef.get();

      return NextResponse.json({
        success: true,
        message: "Profil berhasil diperbarui",
        data: serializeData(updatedDoc.data()),
      });
    }

    // Update Daftar Alamat
    if (type === "addresses") {
      const { addresses } = updateData;

      if (!Array.isArray(addresses)) {
        return NextResponse.json(
          { error: "addresses harus berupa array" },
          { status: 400 },
        );
      }

      await userRef.set(
        {
          addresses,
          updated_at: new Date(),
        },
        { merge: true },
      );

      const updatedDoc = await userRef.get();

      return NextResponse.json({
        success: true,
        message: "Alamat berhasil diperbarui",
        data: serializeData(updatedDoc.data()),
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

// ==========================================
// 4. DELETE (DELETE) -> Menghapus akun pengguna
// ==========================================
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    let userId = searchParams.get("userId");

    // Jika userId tidak ada di query, coba ambil dari body JSON
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

    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "Data pengguna tidak ditemukan di database" },
        { status: 404 },
      );
    }

    // Hapus dokumen user dari Firestore
    await userRef.delete();

    // Catatan: Jika ingin menghapus user dari Firebase Authentication secara server-side juga,
    // Anda bisa menambahkan baris ini jika package 'firebase-admin/auth' aktif:
    // await admin.auth().deleteUser(userId);

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
