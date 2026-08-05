import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function admin(request) {
  const token = request.headers.get("Authorization")?.split("Bearer ")[1];
  if (!token) throw new Error("Authentication required.");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw new Error("Authentication required.");

  let isAdmin = user.user_metadata?.role === "admin";
  if (!isAdmin) {
    const { data: profile } = await supabaseAdmin.from("users").select("role").eq("id", user.id).single();
    if (profile?.role === "admin") isAdmin = true;
  }
  if (!isAdmin) throw new Error("Admin access required.");
  return user;
}

function serializeDoc(row) {
  return {
    id: row.id,
    email: row.email || "",
    name: row.full_name || row.username || "User",
    role: row.role || "customer",
    phone: row.phone || row.phone_number || "",
    createdAt: row.created_at || "",
    lastLogin: row.last_login || "",
    status: row.status || "active",
    points: Number(row.points || 0),
    balance: Number(row.balance || 0),
    totalSpent: Number(row.total_spent || 0),
    accountStatusUpdatedAt: row.accountStatusUpdatedAt || "",
    accountStatusUpdatedBy: row.accountStatusUpdatedBy || "",
    roleUpdatedAt: row.roleUpdatedAt || "",
  };
}

async function getUserTotalSpent(userId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("amount")
      .eq("user_id", userId);
    if (error || !data) return 0;
    return data.reduce((sum, order) => sum + (Number(order.amount) || 0), 0);
  } catch (err) {
    console.error("Gagal menghitung total belanja user:", err);
    return 0;
  }
}

export async function GET(request) {
  try {
    await admin(request);
    const { data: users, error } = await supabaseAdmin.from("users").select("*");
    if (error) throw error;

    const { searchParams } = new URL(request.url);
    const skipSpent = searchParams.get("skipSpent") === "true";

    const usersData = await Promise.all(
      (users || [])
        .filter((row) => (row.role || "customer") !== "superadmin")
        .map(async (row) => {
          const serialized = serializeDoc(row);
          if (!skipSpent && !serialized.totalSpent) {
            serialized.totalSpent = await getUserTotalSpent(row.id);
          }
          return serialized;
        }),
    );

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

    const { data: userRecord, error: userErr } = await supabaseAdmin.from("users").select("*").eq("id", userId).single();
    if (userErr || !userRecord) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const updatePayload = {};

    if (role) {
      if (!["admin", "staff", "customer"].includes(role)) {
        return NextResponse.json({ error: "Invalid role." }, { status: 400 });
      }
      if (userId === actor.id && role !== "admin") {
        return NextResponse.json(
          { error: "You cannot remove your own admin access." },
          { status: 400 },
        );
      }
      updatePayload.role = role;
      updatePayload.roleUpdatedAt = new Date().toISOString();
      updatePayload.roleUpdatedBy = actor.id;
    }

    if (status) {
      if (!["active", "blocked"].includes(status)) {
        return NextResponse.json(
          { error: "Invalid status." },
          { status: 400 },
        );
      }
      if (userId === actor.id && status === "blocked") {
        return NextResponse.json(
          { error: "You cannot block your own account." },
          { status: 400 },
        );
      }
      updatePayload.status = status;
      updatePayload.accountStatusUpdatedAt = new Date().toISOString();
      updatePayload.accountStatusUpdatedBy = actor.id;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update. Provide role or status." },
        { status: 400 },
      );
    }

    const { error: updateErr } = await supabaseAdmin.from("users").update(updatePayload).eq("id", userId);
    if (updateErr) throw updateErr;

    // Optional auth metadata sync
    if (role || status) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: { role: role || userRecord.role },
          ban_duration: status === "blocked" ? "876000h" : "none",
        });
      } catch (authErr) {
        console.warn("Gagal sinkron ke Supabase Auth:", authErr.message);
      }
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


