import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function verifyUser(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) throw new Error("Unauthorized: No token provided");

  const token = authHeader.split("Bearer ")[1];
  if (!token) throw new Error("Unauthorized: Invalid token format");

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) throw new Error("Unauthorized: Invalid token");

  return user;
}

export async function verifyAdmin(request: Request) {
  const user = await verifyUser(request);

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || !data || !["admin", "superadmin"].includes(String(data.role).toLowerCase())) {
    throw new Error("Forbidden: User is not an administrator");
  }

  return user;
}
