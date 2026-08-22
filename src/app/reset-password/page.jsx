"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { shouldSkipAuthEvent } from "@/utils/authHelpers";
import styles from "@/features/components/LoginForm.module.css";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [isFormFocused, setIsFormFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const lastUserIdRef = useRef(null);

  useEffect(() => {
    let active = true;
    const verifyRecoverySession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      lastUserIdRef.current = session?.user?.id || null;
      if (active && session) setReady(true);
    };
    void verifyRecoverySession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (shouldSkipAuthEvent(event, session, lastUserIdRef.current)) return;
      lastUserIdRef.current = session?.user?.id || null;
      if (event === "PASSWORD_RECOVERY" && session && active) setReady(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 12) return setError("Password minimal 12 karakter.");
    if (password !== confirmPassword) return setError("Konfirmasi password tidak cocok.");
    setSaving(true);
    
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    
    if (updateError) return setError(updateError.message);
    setMessage("Password berhasil diperbarui. Silakan masuk kembali.");
    window.setTimeout(() => router.replace("/login"), 1500);
  };

  if (!ready) {
    return (
      <div className={styles.formWrapper} style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div className={styles.loginCard} style={{ textAlign: "center" }}>
          <h2 className={styles.loginTitle} style={{ marginBottom: "0.5rem" }}>Tautan Tidak Valid</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Link reset password tidak valid atau telah kedaluwarsa. Silakan minta ulang melalui halaman login.
          </p>
          <button 
            className={styles.btnOtpRequest} 
            onClick={() => router.replace("/login")}
            style={{ marginTop: "1.5rem" }}
          >
            Kembali ke Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formWrapper} style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
      {/* Efek Senter Lampu */}
      <div className={`${styles.lampContainer} ${isFormFocused ? styles.lampActive : ""}`}>
        <svg className={styles.lampSvg} viewBox="0 0 40 140" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="metalGradient" x1="0" y1="110" x2="40" y2="122" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#121212" />
              <stop offset="30%" stopColor="#262626" />
              <stop offset="50%" stopColor="#3a3a3a" />
              <stop offset="70%" stopColor="#262626" />
              <stop offset="100%" stopColor="#121212" />
            </linearGradient>
          </defs>
          <line x1="20" y1="0" x2="20" y2="110" className={styles.lampCord} />
          <circle cx="20" cy="120" r="4.5" className={styles.lampBulb} />
          <path d="M10 110L4 122H36L30 110H10Z" fill="url(#metalGradient)" className={styles.lampOuterBody} />
          <ellipse cx="20" cy="122" rx="16" ry="2" className={styles.lampInnerRim} />
        </svg>
        <div className={styles.lampConeLight} />
      </div>

      <div className={styles.loginCard}>
        <h2 className={styles.loginTitle}>Buat Password Baru</h2>

        <form onSubmit={submit} className={styles.loginForm}>
          {error && <div className={styles.errorMessage}>{error}</div>}
          {message && <div className={styles.successMessage}>{message}</div>}

          <div className={styles.inputWrapper}>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Password Baru (Minimal 12 karakter)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.inputField}
              disabled={saving}
              required
              minLength={12}
              onFocus={() => setIsFormFocused(true)}
              onBlur={() => setIsFormFocused(false)}
            />
          </div>

          <div className={styles.inputWrapper}>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Konfirmasi Password Baru"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={styles.inputField}
              disabled={saving}
              required
              minLength={12}
              onFocus={() => setIsFormFocused(true)}
              onBlur={() => setIsFormFocused(false)}
            />
          </div>

          <div className={styles.optionsRow}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                disabled={saving}
              />
              <span className={styles.customCheckmark}></span>
              Tampilkan Password
            </label>
          </div>

          <button
            type="submit"
            className={`${styles.btnLogin} ${saving ? styles.btnLoading : ""}`}
            disabled={saving}
          >
            {saving ? <span className={styles.spinner}></span> : "Simpan Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
