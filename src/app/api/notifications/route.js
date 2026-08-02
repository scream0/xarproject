import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";

export const dynamic = "force-dynamic";

// Helper: verifikasi identitas user dan tentukan apakah admin
async function identity(request) {
  const header = request.headers.get("Authorization");
  const token = header?.split("Bearer ")[1];
  if (!token) throw new Error("Authentication required.");
  const user = await getAuth().verifyIdToken(token);
  const profile = await db.collection("users").doc(user.uid).get();
  const isAdmin =
    user.role === "admin" ||
    user.admin === true ||
    profile.data()?.role === "admin";
  return { uid: user.uid, admin: isAdmin };
}

// Helper: bersihkan nilai undefined agar aman untuk Firestore
function sanitizeData(obj) {
  const cleanObj = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      if (
        typeof obj[key] === "object" &&
        obj[key] !== null &&
        !Array.isArray(obj[key]) &&
        !(obj[key] instanceof Date)
      ) {
        cleanObj[key] = sanitizeData(obj[key]);
      } else {
        cleanObj[key] = obj[key];
      }
    }
  }
  return cleanObj;
}

// Helper: serialize dokumen Firestore ke JSON-safe object
function serializeNotification(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || new Date().toISOString(),
  };
}

// GET -> Ambil notifikasi
// - User biasa: hanya notifikasi miliknya
// - Admin: bisa filter ?scope=system (semua) / ?scope=user (dari user)
export async function GET(request) {
  try {
    const user = await identity(request);
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "mine";

    // Helper: urutkan notifikasi dari terbaru & batasi jumlahnya secara in-memory.
    // NOTE: sengaja TIDAK pakai .orderBy("createdAt") di query Firestore agar tidak
    // membutuhkan composite index (userId+createdAt / audience+createdAt) yang harus
    // dibuat manual di Firebase Console. Volume notifikasi kecil, jadi sort di sini aman.
    const sortAndLimit = (notifications) =>
      notifications
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 100);

    if (user.admin && scope !== "mine") {
      // Admin melihat notifikasi sistem + notifikasi yang ditujukan ke admin
      const snapshot = await db
        .collection("notifications")
        .where("audience", "in", ["all", "admin"])
        .get();
      const notifications = sortAndLimit(
        snapshot.docs.map(serializeNotification),
      );
      return NextResponse.json({ notifications });
    }

    // Mode user: notifikasi milik user ini
    const snapshot = await db
      .collection("notifications")
      .where("userId", "==", user.uid)
      .get();
    const notifications = sortAndLimit(
      snapshot.docs.map(serializeNotification),
    );
    return NextResponse.json({ notifications });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}

// POST -> Buat notifikasi
// - User: membuat notifikasi untuk dirinya sendiri (misal reminder)
// - Admin: membuat notifikasi untuk user tertentu / semua user / admin
export async function POST(request) {
  try {
    const actor = await identity(request);
    const body = await request.json().catch(() => ({}));
    const { userId, title, message, type, link, audience } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: "title and message are required" },
        { status: 400 },
      );
    }

    // Non-admin hanya boleh membuat notifikasi untuk dirinya sendiri
    const targetUserId = actor.admin && userId ? userId : actor.uid;
    const targetAudience = actor.admin ? audience || "user" : "user";

    const payload = {
      userId: targetUserId,
      audience: targetAudience,
      title,
      message,
      type: type || "info", // promo | order | payment | system
      link: link || null,
      isRead: false,
      createdAt: new Date(),
    };

    const docRef = await db.collection("notifications").add(sanitizeData(payload));

    return NextResponse.json(
      { id: docRef.id, message: "Notification created." },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT -> Tandai sudah dibaca / update notifikasi
export async function PUT(request) {
  try {
    const user = await identity(request);
    const body = await request.json().catch(() => ({}));
    const { notificationId, isRead } = body;

    if (!notificationId) {
      return NextResponse.json(
        { error: "notificationId is required" },
        { status: 400 },
      );
    }

    const docRef = db.collection("notifications").doc(notificationId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Notification not found." },
        { status: 404 },
      );
    }

    const data = doc.data();

    // Validasi kepemilikan: user biasa hanya boleh mengubah notifikasinya sendiri
    if (!user.admin && data.userId !== user.uid) {
      return NextResponse.json(
        { error: "You can only update your own notifications." },
        { status: 403 },
      );
    }

    await docRef.set(
      sanitizeData({
        isRead: isRead ?? true,
        readAt: isRead ? new Date() : null,
        updatedAt: new Date(),
      }),
      { merge: true },
    );

    return NextResponse.json({ message: "Notification updated." });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE -> Hapus notifikasi (user hanya boleh hapus miliknya, admin boleh hapus semua)
export async function DELETE(request) {
  try {
    const user = await identity(request);
    const { searchParams } = new URL(request.url);
    let notificationId = searchParams.get("id");

    if (!notificationId) {
      const body = await request.json().catch(() => ({}));
      notificationId = body?.notificationId;
    }

    if (!notificationId) {
      return NextResponse.json(
        { error: "notificationId is required" },
        { status: 400 },
      );
    }

    const docRef = db.collection("notifications").doc(notificationId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Notification not found." },
        { status: 404 },
      );
    }

    const data = doc.data();
    if (!user.admin && data.userId !== user.uid) {
      return NextResponse.json(
        { error: "You can only delete your own notifications." },
        { status: 403 },
      );
    }

    await docRef.delete();
    return NextResponse.json({ message: "Notification deleted." });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

