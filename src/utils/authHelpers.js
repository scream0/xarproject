// src/utils/authHelpers.js
import { supabase } from "@/lib/supabaseClient";

// --- HELPER INTERNAL (PRIVATE) ---

// 1. Helper untuk membuat Cookie Sesi di Server
async function setSessionCookie(accessToken) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });

  if (!response.ok) {
    throw new Error("Gagal membuat sesi cookie di server.");
  }
}

// 2. Helper untuk sinkronisasi data user ke database via API
async function syncUserToServer(userData) {
  try {
    await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });
  } catch (err) {
    console.error("Gagal menyinkronkan user ke server:", err);
  }
}

// ==========================================
// EKSPOR FUNGSI AUTENTIKASI
// ==========================================

/**
 * 1. Login dengan Email & Password
 */
export const loginWithEmail = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  const user = data.user;
  const accessToken = data.session?.access_token;

  if (accessToken) {
    await setSessionCookie(accessToken);
  }

  await syncUserToServer({
    uid: user.id,
    email: user.email,
    name: user.user_metadata?.name || "User",
    phone: user.phone || "",
  });

  return user;
};

/**
 * 2. Registrasi Akun Baru (Email & Password)
 */
export const registerWithEmail = async (name, email, password) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name,
        role: "user",
      },
    },
  });

  if (error) {
    throw error;
  }

  const user = data.user;
  const accessToken = data.session?.access_token;

  // Jika sign-up otomatis menghasilkan sesi (email confirmation dimatikan)
  if (accessToken) {
    await setSessionCookie(accessToken);
  }

  await syncUserToServer({
    uid: user?.id,
    email: user?.email || email,
    name: name,
    phone: "",
    role: "user",
  });

  return user;
};

/**
 * 3. Login dengan Google Popup
 */
export const loginWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
  });

  if (error) {
    throw error;
  }

  return data;
};

/**
 * 4. Kirim Kode OTP via SMS (Nomor HP)
 */
export const sendOtpCode = async (phoneInput) => {
  let formattedPhone = phoneInput.trim();
  if (formattedPhone.startsWith("0")) {
    formattedPhone = "+62" + formattedPhone.substring(1);
  } else if (formattedPhone.startsWith("8")) {
    formattedPhone = "+62" + formattedPhone;
  }

  if (!formattedPhone.startsWith("+")) {
    throw new Error("Format nomor HP tidak valid.");
  }

  const { data, error } = await supabase.auth.signInWithOtp({
    phone: formattedPhone,
  });

  if (error) {
    throw error;
  }

  return { phone: formattedPhone, data };
};

/**
 * 5. Verifikasi Kode OTP dan Login
 */
export const verifyOtpAndLogin = async (phone, otpCode) => {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token: otpCode,
    type: "sms",
  });

  if (error) {
    throw error;
  }

  const user = data.user;
  const accessToken = data.session?.access_token;

  if (accessToken) {
    await setSessionCookie(accessToken);
  }

  await syncUserToServer({
    uid: user.id,
    email: user.email || "",
    name: user.user_metadata?.name || "User",
    phone: user.phone || "",
    role: "user",
  });

  return user;
};

/**
 * 6. Kirim Email Reset Password
 */
export const resetPassword = async (email) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    throw error;
  }
};

/**
 * 7. Logout Pengguna (Hapus Cookie Sesi & Supabase Auth)
 */
export const logoutUser = async () => {
  try {
    // Hapus session cookie di server
    await fetch("/api/auth/logout", { method: "POST" });

    // Keluar dari sesi Supabase client
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }

    // Redirect bersih ke halaman login
    window.location.replace("/login");
  } catch (error) {
    console.error("Terjadi kesalahan saat logout:", error);
  }
};