import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Default automation rules, to be used if none are set in the database.
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

// Helper for admin verification
async function verifyAdmin(request) {
  const token = request.headers.get("authorization")?.split(" ")[1];
  if (!token) {
    throw new Error("Unauthorized: No token provided");
  }
  const { data: user, error } = await supabaseAdmin.auth.api.getUser(token);
  if (error) {
    throw new Error("Unauthorized: Invalid token");
  }
  const { data: adminUser, error: dbError } = await supabaseAdmin
    .from("users")
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

    // Fetch automation rules from the singleton store_config table
    const { data, error } = await supabaseAdmin
      .from("store_config")
      .select("automation_rules")
      .eq("singleton_id", true)
      .single();

    if (error) {
      console.error("Error fetching automation rules:", error.message);
      throw new Error("Could not fetch store configuration.");
    }

    // If rules exist in the DB, use them; otherwise, use the defaults.
    const rules = data?.automation_rules || defaultRules;
    return NextResponse.json({ rules });
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
    await verifyAdmin(request);
    const { rules } = await request.json();

    if (!Array.isArray(rules)) {
      return NextResponse.json(
        { success: false, error: "Input 'rules' must be an array." },
        { status: 400 },
      );
    }

    // Update the automation_rules in the singleton store_config table
    const { error } = await supabaseAdmin
      .from("store_config")
      .update({ automation_rules: rules })
      .eq("singleton_id", true);

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
