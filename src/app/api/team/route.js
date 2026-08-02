import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";

export const dynamic = "force-dynamic";

async function admin(request) {
  const token = request.headers.get("Authorization")?.split("Bearer ")[1];
  if (!token) throw new Error("Authentication required.");
  const u = await getAuth().verifyIdToken(token);
  const profile = await db.collection("users").doc(u.uid).get();
  if (!(u.role === "admin" || u.admin || profile.data()?.role === "admin"))
    throw new Error("Admin access required.");
  return u;
}

// Helper: serialize Firestore data (Timestamp -> ISO string)
function serializeDoc(doc) {
  const data = doc.data();
  const serialized = {
    id: doc.id,
    email: data.email || "",
    name: data.full_name || data.username || "User",
    role: data.role || "customer",
    phone: data.phone || data.phone_number || "",
    createdAt: data.created_at?.toDate
      ? data.created_at.toDate().toISOString()
      : data.created_at || data.createdAt || "",
    lastLogin: data.last_login?.toDate
      ? data.last_login.toDate().toISOString()
      : data.last_login || "",
    status: data.status || "active",
    points: Number(data.points || 0),
    balance: Number(data.balance || 0),
    totalSpent: Number(data.total_spent || 0),
    accountStatusUpdatedAt: data.accountStatusUpdatedAt?.toDate
      ? data.accountStatusUpdatedAt.toDate().toISOString()
      : data.accountStatusUpdatedAt || "",
    accountStatusUpdatedBy: data.accountStatusUpdatedBy || "",
    roleUpdatedAt: data.roleUpdatedAt?.toDate
      ? data.roleUpdatedAt.toDate().toISOString()
      : data.roleUpdatedAt || "",
  };
  return serialized;
}

// Helper: hitung total belanja user dari koleksi orders (Firestore) — dibungkus try/catch
async function getUserTotalSpent(userId) {
  try {
    const snapshot = await db
      .collection("orders")
      .where("userId", "==", userId)
      .get();
    let total = 0;
    snapshot.forEach((doc) => {
      const order = doc.data();
      total += Number(order.amount || order.price || 0) || 0;
    });
    return total;
  } catch (err) {
    console.error("Gagal menghitung total belanja user:", err);
    return 0;
  }
}

export async function GET(request) {
  try {
    await admin(request);
    const users = await db.collection("users").get();

    const { searchParams } = new URL(request.url);
    const skipSpent = searchParams.get("skipSpent") === "true";

    const usersData = await Promise.all(
      users.docs
        .filter((doc) => {
          // Jangan tampilkan admin internal utama dalam manajemen user
          const role = doc.data().role || "customer";
          return role !== "superadmin";
        })
        .map(async (doc) => {
          const serialized = serializeDoc(doc);
          if (!skipSpent) {
            serialized.totalSpent = await getUserTotalSpent(doc.id);
          }
          return serialized;
        }),
    );

    // Urutkan berdasarkan total belanja terbesar (jika tersedia)
    usersData.sort((a, b) => b.totalSpent - a.totalSpent);

    return NextResponse.json({ users: usersData });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }
}

export async function PUT(request) {
  try {
    const actor = await admin(request);
    const body = await request.json();
    const { userId, role, status } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const updatePayload = {};

    // --- UPDATE ROLE ---
    if (role) {
      if (!["admin", "staff", "customer"].includes(role)) {
        return NextResponse.json({ error: "Invalid role." }, { status: 400 });
      }
      if (userId === actor.uid && role !== "admin") {
        return NextResponse.json(
          { error: "You cannot remove your own admin access." },
          { status: 400 },
        );
      }
      updatePayload.role = role;
      updatePayload.roleUpdatedAt = new Date();
      updatePayload.roleUpdatedBy = actor.uid;
    }

    // --- UPDATE ACCOUNT STATUS (block / activate) ---
    if (status) {
      if (!["active", "blocked"].includes(status)) {
        return NextResponse.json(
          { error: "Invalid status." },
          { status: 400 },
        );
      }
      if (userId === actor.uid && status === "blocked") {
        return NextResponse.json(
          { error: "You cannot block your own account." },
          { status: 400 },
        );
      }
      updatePayload.status = status;
      updatePayload.accountStatusUpdatedAt = new Date();
      updatePayload.accountStatusUpdatedBy = actor.uid;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update. Provide role or status." },
        { status: 400 },
      );
    }

    await userRef.set(updatePayload, { merge: true });

    // Sinkronkan status/role ke Firebase Authentication (jika menggunakan email)
    try {
      const targetAuthUser = await getAuth().getUser(userId);
      if (targetAuthUser) {
        await getAuth().updateUser(userId, {
          disabled: status === "blocked",
        });
      }
    } catch (authErr) {
      // Non-fatal: user mungkin login via phone/anonim, biarkan berjalan
      console.warn("Gagal sinkron ke Firebase Auth:", authErr.message);
    }

    return NextResponse.json({
      message: status
        ? `Account ${status === "blocked" ? "blocked" : "activated"}.`
        : "Role updated.",
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

