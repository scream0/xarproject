"use client";
import React, { useState, useEffect } from "react";
import loginConfig from "@/data/ui/loginConfig.json";
import styles from "./LoginForm.module.css";
import { useStore } from "@/context/StoreContext";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginForm() {
  const { setCustomer } = useStore();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
  });

  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [isRegister, setIsRegister] = useState(false);
  const [isPhoneMode, setIsPhoneMode] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false); // Penanda apakah OTP sudah dikirim
  const [isFormFocused, setIsFormFocused] = useState(false);

  const { form } = loginConfig || {};

  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setFormData((prev) => ({ ...prev, email: savedEmail }));
      setRememberMe(true);
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ==========================================
  // 1. KIRIM OTP KE WHATSAPP
  // ==========================================
  const handleSendOtp = async () => {
    if (!formData.phone) {
      setError(form?.validation?.phoneRequired || "Silakan isi nomor HP Anda terlebih dahulu.");
      return;
    }
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/send-whatsapp-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formData.phone }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Gagal mengirim OTP.");

      setOtpSent(true);
      setSuccessMessage(`Kode OTP sukses dikirim ke WhatsApp ${formData.phone}`);
    } catch (err) {
      setError(err.message || "Gagal mengirim WhatsApp OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // 2. VERIFIKASI OTP & LOGIN WHATSAPP
  // ==========================================
  const handleVerifyOtp = async () => {
    if (!otpCode) {
      setError(form?.validation?.otpRequired || "Silakan masukkan kode OTP terlebih dahulu.");
      return;
    }
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/verify-whatsapp-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formData.phone, otp: otpCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Verifikasi OTP gagal.");

      // Login otomatis ke Supabase menggunakan token magic link yang digenerate backend
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: data.email,
      });

      if (signInError) {
        // Jika gagal magic link, gunakan custom session / set cookie manual sesuai implementasi backend
      }

      setCustomer({
        name: "User WhatsApp",
        email: data.email,
        phone: formData.phone,
      });

      window.location.replace(callbackUrl);
    } catch (err) {
      setError(err.message || "Kode OTP salah atau kedaluwarsa.");
      setIsLoading(false);
    }
  };

  // ==========================================
  // 3. LOGIN & REGISTER DENGAN EMAIL/PASSWORD SUPABASE
  // ==========================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    if (isPhoneMode) {
      await handleVerifyOtp();
      return;
    }

    if (isRegister) {
      if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
        setError(form?.validation?.allFieldsRequired || "Semua kolom registrasi wajib diisi.");
        setIsLoading(false);
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError(form?.validation?.passwordMismatch || "Konfirmasi password tidak cocok.");
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: { name: formData.name, role: "customer" },
          },
        });

        if (signUpError) throw signUpError;

        setCustomer({
          name: formData.name,
          email: formData.email,
          phone: "",
        });

        setSuccessMessage("Registrasi berhasil! Silakan periksa email Anda jika verifikasi diperlukan.");
        setTimeout(() => {
          window.location.replace(callbackUrl);
        }, 2000);
      } catch (err) {
        setError(err.message || "Gagal membuat akun.");
        setIsLoading(false);
      }
      return;
    }

    // Login Email & Password Biasa
    if (!formData.email || !formData.password) {
      setError(form?.emptyFieldsMessage || "Semua kolom wajib diisi.");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) throw signInError;

      setCustomer({
        name: data.user?.user_metadata?.name || "User",
        email: data.user?.email,
        phone: data.user?.user_metadata?.phone || "",
      });

      if (rememberMe) {
        localStorage.setItem("rememberedEmail", formData.email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      window.location.replace(callbackUrl);
    } catch (err) {
      setError(err.message || "Email atau password salah.");
      setIsLoading(false);
    }
  };

  // ==========================================
  // 4. GOOGLE LOGIN SUPABASE
  // ==========================================
  const handleGoogleLogin = async () => {
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      // Mengambil origin domain saat ini (otomatis mendeteksi mameko.my.id atau localhost)
      const currentOrigin = window.location.origin;
      const redirectTarget = `${currentOrigin}${callbackUrl}`;

      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTarget,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (googleError) throw googleError;
    } catch (err) {
      setError(err.message || "Gagal masuk menggunakan Google.");
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setError("Silakan masukkan email Anda terlebih dahulu untuk mereset password.");
      return;
    }
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setSuccessMessage("Link reset password telah dikirim ke email Anda.");
    } catch (err) {
      setError(err.message || "Gagal mengirim email reset.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRegisterMode = () => {
    setIsRegister(!isRegister);
    setIsPhoneMode(false);
    setError("");
    setSuccessMessage("");
    setOtpSent(false);
    setOtpCode("");
  };

  const getFormTitle = () => {
    if (isRegister) return form?.titles?.register || "CREATE ACCOUNT";
    if (isPhoneMode) return form?.titles?.phone || "WHATSAPP OTP SIGN IN";
    return form?.title || "SIGN IN";
  };

  const getSubmitButtonText = () => {
    if (isRegister) return form?.buttons?.signUp || "SIGN UP";
    if (isPhoneMode && otpSent) return form?.buttons?.verifyOtp || "VERIFIKASI OTP";
    if (isPhoneMode && !otpSent) return form?.buttons?.sendOtp || "KIRIM KODE OTP";
    return form?.buttonText || "SIGN IN";
  };

  return (
    <div className={styles.formWrapper}>
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
        <h2 className={styles.loginTitle}>{getFormTitle()}</h2>

        <form onSubmit={isPhoneMode && !otpSent ? (e) => { e.preventDefault(); handleSendOtp(); } : handleSubmit} className={styles.loginForm}>
          {error && <div className={styles.errorMessage}>{error}</div>}
          {successMessage && <div className={styles.successMessage}>{successMessage}</div>}

          {form?.fields?.map((field) => {
            if (!field || !field.name) return null;
            const shouldRender =
              field.visibility === "always" ||
              (field.visibility === "registerOnly" && isRegister) ||
              (field.visibility === "phoneModeOnly" && isPhoneMode && !otpSent && field.name === "phone") ||
              (field.visibility === "emailModeOnly" && !isPhoneMode);

            if (!shouldRender) return null;

            return (
              <div key={field.name} className={styles.inputWrapper}>
                <input
                  type={field.type === "password" && showPassword ? "text" : field.type}
                  name={field.name}
                  placeholder={field.placeholder}
                  value={formData[field.name] || ""}
                  onChange={handleChange}
                  className={styles.inputField}
                  disabled={isLoading}
                  required={field.required && (isRegister || !isPhoneMode)}
                  onFocus={() => setIsFormFocused(true)}
                  onBlur={() => setIsFormFocused(false)}
                />
              </div>
            );
          })}

          {isPhoneMode && otpSent && (
            <div className={styles.inputWrapper}>
              <input
                type="text"
                placeholder={form?.otpPlaceholder || "Masukkan 6 digit OTP WhatsApp"}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className={styles.inputField}
                disabled={isLoading}
                maxLength={6}
                onFocus={() => setIsFormFocused(true)}
                onBlur={() => setIsFormFocused(false)}
              />
            </div>
          )}

          {!isRegister && !isPhoneMode && (
            <div className={styles.optionsRow}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                />
                <span className={styles.customCheckmark}></span>
                {form?.labels?.rememberMe || "Remember Me"}
              </label>
              <button
                type="button"
                className={styles.forgotPasswordLink}
                onClick={handleForgotPassword}
                disabled={isLoading}
              >
                {form?.labels?.forgotPassword || "Forgot Password?"}
              </button>
            </div>
          )}

          <button
            type="submit"
            className={`${styles.btnLogin} ${isLoading ? styles.btnLoading : ""}`}
            disabled={isLoading}
          >
            {isLoading ? <span className={styles.spinner}></span> : getSubmitButtonText()}
          </button>
        </form>

        {!isRegister && (
          <button
            type="button"
            className={styles.switchModeBtn}
            onClick={() => {
              setIsPhoneMode(!isPhoneMode);
              setError("");
              setSuccessMessage("");
              setOtpSent(false);
              setOtpCode("");
            }}
            disabled={isLoading}
          >
            {isPhoneMode
              ? form?.switchText?.emailMode || "Masuk dengan Email & Password"
              : form?.switchText?.phoneMode || "Masuk dengan WhatsApp OTP"}
          </button>
        )}

        <button
          type="button"
          className={styles.switchModeBtn}
          onClick={toggleRegisterMode}
          disabled={isLoading}
          style={{ marginTop: "0.25rem", fontWeight: "600", color: "#a3a3a3" }}
        >
          {isRegister
            ? form?.switchText?.signIn || "Already have an account? Sign In"
            : form?.switchText?.signUp || "Don't have an account? Sign Up"}
        </button>

        <div className={styles.divider}>
          <span>{form?.labels?.oauthDivider || "OR CONTINUE WITH"}</span>
        </div>

        <div className={styles.socialWrapper}>
          <button
            type="button"
            className={styles.btnGoogle}
            onClick={handleGoogleLogin}
            disabled={isLoading}
            aria-label="Sign in with Google"
          >
            <svg className={styles.googleIcon} viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="currentColor" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

