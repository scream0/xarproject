// src/utils/authHelpers.js
import { supabase } from "@/lib/supabaseClient";

// --- HELPER INTERNAL (PRIVATE) ---

// 1. Helper untuk membuat Cookie Sesi di Server
async function setSessionCookie(accessToken: string) {
  const response = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: accessToken }),
  });

  if (!response.ok) {
    throw new Error("Gagal membuat sesi cookie di server.");
  }
}

// ==========================================
// EKSPOR FUNGSI AUTENTIKASI
// ==========================================

/**
 * 1. Login dengan Email & Password
 */
export const loginWithEmail = async (email: string, password: string) => {
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

  return user;
};

/**
 * 2. Registrasi Akun Baru (Email & Password)
 */
export const registerWithEmail = async (name: string, email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        role: "customer",
      },
    },
  });

  if (error) {
    throw error;
  }

  const user = data.user;
  const accessToken = data.session?.access_token;

  if (accessToken) {
    await setSessionCookie(accessToken);
  }

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
 * 4. Kirim Kode OTP via Email (Supabase Auth + Resend SMTP)
 */
export const sendEmailOtp = async (email: string) => {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Format alamat email tidak valid.");
  }

  const redirectUrl = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

  const { data, error } = await supabase.auth.signInWithOtp({
    email: cleanEmail,
    options: {
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) {
    if (error.message?.includes("rate_limit") || error.status === 429) {
      throw new Error("Terlalu banyak permintaan kode. Mohon tunggu 1 menit sebelum mencoba lagi.");
    }
    throw error;
  }

  return { email: cleanEmail, data };
};

/**
 * 5. Verifikasi Kode OTP Email dan Buat Sesi Login
 */
export const verifyEmailOtp = async (email: string, otpCode: string) => {
  const cleanEmail = email.trim().toLowerCase();
  const cleanToken = otpCode.trim();

  if (!cleanToken || cleanToken.length < 6) {
    throw new Error("Kode OTP harus terdiri dari 6 digit.");
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email: cleanEmail,
    token: cleanToken,
    type: "email",
  });

  if (error) {
    if (
      error.message?.includes("expired") ||
      error.message?.includes("invalid") ||
      error.status === 400 ||
      error.status === 401
    ) {
      throw new Error("Kode OTP salah atau telah kedaluwarsa. Silakan minta kode baru.");
    }
    throw error;
  }

  return data.user;
};

// Aliases for backward compatibility
export const sendOtpCode = sendEmailOtp;
export const verifyOtpAndLogin = verifyEmailOtp;

/**
 * 6. Kirim Email Reset Password
 */
export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    throw error;
  }
};

/**
 * 7. Logout Pengguna (Hapus Cookie Sesi, Supabase Auth & Storage)
 * Infallible direct logout: membersihkan cache seketika & menjamin redirect ke /login
 */
let isLoggingOutInProgress = false;

export const logoutUser = async () => {
  if (isLoggingOutInProgress) return;
  isLoggingOutInProgress = true;

  try {
    // Bersihkan storage & token lokal secara instan
    if (typeof window !== "undefined") {
      try {
        sessionStorage.clear();
        // Hapus token Supabase dari localStorage
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("sb-") || key.includes("supabase") || key.includes("auth"))) {
            localStorage.removeItem(key);
          }
        }
      } catch (e) {
        console.warn("Storage cleanup warning:", e);
      }
    }

    // Timeout guard: maksimal tunggu 1.5 detik untuk network call
    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 1500));

    const logoutNetworkWork = Promise.allSettled([
      fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
      supabase.auth.signOut(),
    ]);

    await Promise.race([logoutNetworkWork, timeoutPromise]);
  } catch (error) {
    console.error("Terjadi kesalahan saat logout:", error);
  } finally {
    // Selalu jamin redirect bersih ke halaman login tanpa pernah stuck
    if (typeof window !== "undefined") {
      window.location.replace("/login");
      // Fallback navigation jika replace ditahan oleh browser
      setTimeout(() => {
        window.location.href = "/login";
      }, 300);
    }
  }
};

/**
 * 8. Helper to determine if an auth state change event should be skipped
 * to prevent unnecessary re-fetching (e.g. on TOKEN_REFRESHED).
 */
export function shouldSkipAuthEvent(event: string, session: any, lastUserId: string | null) {
  if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
    return true;
  }
  
  if (session?.user?.id && session.user.id === lastUserId) {
    return true;
  }

  return false;
}
