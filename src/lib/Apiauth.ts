import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * apiAuth.ts — Helper otentikasi bersama untuk semua API route.
 *
 * Dipakai oleh route mana pun yang butuh memverifikasi bahwa request
 * datang dari user yang sudah login (via Supabase access_token di header
 * Authorization: Bearer <token>).
 *
 * Import di route:
 *   import { verifyUser } from "@/lib/apiAuth";
 *   const user = await verifyUser(request);
 */

/**
 * Verifikasi token dari header Authorization dan kembalikan user Supabase.
 * Melempar Error dengan prefix "Unauthorized" jika gagal — setiap route
 * yang memanggil ini cukup cek `error.message.includes("Unauthorized")`
 * untuk menentukan status code 401.
 */
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

/**
 * Verifikasi token DAN pastikan user punya role admin (dari tabel profiles).
 * Dipakai di route khusus admin (settings, orders, dsb).
 */
export async function verifyAdmin(request: Request) {
  const user = await verifyUser(request);

  // Cek role admin langsung dari user_metadata (kalau ada), lebih cepat
  if ((user as any).user_metadata?.role === "admin") {
    return user;
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || !data || data.role !== "admin") {
    throw new Error("Forbidden: User is not an administrator");
  }

  return user;
}