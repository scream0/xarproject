// src/lib/supabaseClient.js
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL atau Anon Key belum disetel di environment variables (.env.local)");
}

// createBrowserClient otomatis menulis session ke cookie (bukan cuma localStorage),
// jadi middleware/proxy di server bisa membaca sesi login yang sama.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Ekspor kompatibilitas agar modul lain yang mengimpor { auth } atau { db } tetap berjalan lancar
export const auth = supabase.auth;
export const db = supabase;