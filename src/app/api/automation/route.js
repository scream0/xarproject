import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const defaultRules = [
  {
    id: "low-stock",
    name: "Low stock alert",
    description: "Create an operational alert when a variant reaches the stock threshold.",
    enabled: true,
    value: "5",
  },
  {
    id: "payment-reminder",
    name: "Pending payment reminder",
    description: "Flag pending orders that need follow-up after the configured number of hours.",
    enabled: true,
    value: "24",
  },
  {
    id: "review-request",
    name: "Review request",
    description: "Queue a review request after an order is completed.",
    enabled: true,
    value: "3",
  },
];

async function verifyAdmin(request) {
  const token = request.headers.get("authorization")?.split(" ")[1];
  if (!token) {
    throw new Error("Unauthorized: No token provided");
  }
  
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    throw new Error("Unauthorized: Invalid token");
  }

  // Diperbarui dari tabel "users" ke tabel "profiles"
  const { data: adminUser, error: dbError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
    
  if (dbError || !adminUser || adminUser.role !== "admin") {
    throw new Error("Forbidden: User is not an admin");
  }
  return user.id;
}

export async function GET(request) {
  try {
    await verifyAdmin(request);

    // Mengambil langsung dari tabel khusus store_automation
    const { data, error } = await supabaseAdmin
      .from("store_automation")
      .select("rules")
      .eq("id", "main")
      .single();

    if (error || !data) {
      return NextResponse.json({ rules: defaultRules });
    }

    return NextResponse.json({ rules: data.rules || defaultRules });
  } catch (error) {
    console.error("GET /api/automation error:", error.message);
    const isAuthError = error.message.includes("Unauthorized") || error.message.includes("Forbidden");
    const statusCode = isAuthError ? 403 : 500;
    return NextResponse.json(
      { success: false, error: error.message },
      { status: statusCode },
    );
  }
}

export async function PUT(request) {
  try {
    const userId = await verifyAdmin(request);
    const { rules } = await request.json();

    if (!Array.isArray(rules)) {
      return NextResponse.json(
        { success: false, error: "Input 'rules' must be an array." },
        { status: 400 },
      );
    }

    // Menyimpan langsung ke tabel store_automation menggunakan upsert
    const { error } = await supabaseAdmin
      .from("store_automation")
      .upsert({
        id: "main",
        rules: rules,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      });

    if (error) {
      console.error("Error updating automation rules:", error.message);
      throw new Error("Failed to save automation rules.");
    }

    return NextResponse.json({ success: true, message: "Automation rules saved." });
  } catch (error) {
    console.error("PUT /api/automation error:", error.message);
    const isAuthError = error.message.includes("Unauthorized") || error.message.includes("Forbidden");
    const statusCode = isAuthError ? 403 : 500;
    return NextResponse.json(
      { success: false, error: error.message },
      { status: statusCode },
    );
  }
}