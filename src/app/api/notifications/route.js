import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Helper: Verifies user identity using Supabase and determines if they are an admin.
async function identity(request) {
  const token = request.headers.get("authorization")?.split(" ")[1];
  if (!token) {
    throw new Error("Authentication required.");
  }

  // Menggunakan method getUser(token) yang kompatibel dengan versi supabase-js modern
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    throw new Error(`Authentication failed: ${authError?.message || "Invalid token"}`);
  }

  // Mengambil role dari tabel profiles (menggantikan tabel users)
  const { data: profile, error: dbError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (dbError) {
    console.warn(`Could not fetch profile for user ${user.id}: ${dbError.message}`);
  }

  const isAdmin = ["admin", "superadmin"].includes(String(profile?.role || "").toLowerCase());
  return { uid: user.id, admin: isAdmin };
}

// GET -> Fetches notifications.
export async function GET(request) {
  try {
    const user = await identity(request);
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "mine";

    let query = supabaseAdmin.from("notifications").select("*");

    // Admin scope: can see system/admin notifications, all broadcasts, and their own notifications
    if (user.admin && scope !== "mine") {
      query = query.or(`audience.eq.admin,user_id.is.null,user_id.eq.${user.uid}`);
    } else {
      // Default scope: user's own notifications + system-wide broadcasts ('all' and 'user')
      query = query.or(`user_id.eq.${user.uid},and(user_id.is.null,audience.eq.all),and(user_id.is.null,audience.eq.user)`);
    }

    // Apply sorting and limit directly in the query for efficiency.
    const { data: notifications, error } = await query
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("GET /api/notifications error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}

// POST -> Creates a notification.
export async function POST(request) {
  try {
    const actor = await identity(request);
    const body = await request.json().catch(() => ({}));
    const { userId, title, message, type, link, audience } = body;

    if (!title || !message) {
      return NextResponse.json({ error: "title and message are required" }, { status: 400 });
    }

    const targetUserId = actor.admin && userId ? userId : (actor.admin ? null : actor.uid);
    const targetAudience = actor.admin ? audience || "user" : "user";

    const payload = {
      user_id: targetUserId,
      audience: targetAudience,
      title,
      message,
      type: type || "info",
      link: link || undefined, // Supabase client ignores undefined fields
    };

    const { data, error } = await supabaseAdmin
      .from("notifications")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ id: data.id, message: "Notification created." }, { status: 201 });
  } catch (error) {
    console.error("POST /api/notifications error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT -> Updates notifications, primarily for marking as read.
export async function PUT(request) {
  try {
    const user = await identity(request);
    const body = await request.json().catch(() => ({}));
    const { notificationId, isRead, markAllAsRead } = body;

    // Logic for "Mark All as Read"
    if (markAllAsRead) {
      let query = supabaseAdmin
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("is_read", false);

      if (user.admin) {
        query = query.is("user_id", null);
      } else {
        query = query.eq("user_id", user.uid);
      }

      const { count, error } = await query;
      if (error) throw error;

      return NextResponse.json({ message: `${count || 0} notifications marked as read.` });
    }

    if (!notificationId) {
      return NextResponse.json({ error: "notificationId is required" }, { status: 400 });
    }

    // Logic for updating a single notification
    const { data: notification, error: fetchError } = await supabaseAdmin
      .from("notifications")
      .select("user_id, audience")
      .eq("id", notificationId)
      .single();

    if (fetchError) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    if (!user.admin && notification.user_id !== user.uid) {
      return NextResponse.json({ error: "You can only update your own private notifications." }, { status: 403 });
    }
    
    const readStatus = isRead !== undefined ? isRead : true;
    const updatePayload = {
      is_read: readStatus,
      read_at: readStatus ? new Date().toISOString() : null,
    };

    const { error: updateError } = await supabaseAdmin
      .from("notifications")
      .update(updatePayload)
      .eq("id", notificationId);

    if (updateError) throw updateError;

    return NextResponse.json({ message: "Notification updated." });
  } catch (error) {
    console.error("PUT /api/notifications error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE -> Deletes a notification.
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
      return NextResponse.json({ error: "notificationId is required" }, { status: 400 });
    }
    
    const { data: notification, error: fetchError } = await supabaseAdmin
      .from("notifications")
      .select("user_id, audience")
      .eq("id", notificationId)
      .single();

    if (fetchError) return NextResponse.json({ error: "Notification not found." }, { status: 404 });

    // Ownership check for non-admins
    if (!user.admin && notification.user_id !== user.uid) {
      return NextResponse.json({ error: "You can only delete your own private notifications." }, { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("notifications")
      .delete()
      .eq("id", notificationId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ message: "Notification deleted." });
  } catch (error) {
    console.error("DELETE /api/notifications error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}