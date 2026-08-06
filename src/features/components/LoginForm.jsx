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
  const [otpSent, setOtpSent] = useState(false);
  const [isFormFocused, setIsFormFocused] = useState(false);

  const { form } = loginConfig || {};

  // Helper untuk mengecek role di database dan melakukan redirect yang sesuai
  const handlePostLoginRedirect = async (userId) => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (!profileError && profile?.role === "admin") {
        window.location.replace("/dashboard");
      } else {
        window.location.replace(callbackUrl);
      }
    } catch (err) {
      console.error("Gagal memeriksa role:", err);
      window.location.replace(callbackUrl);
    }
  };

  // ==========================================
  // GOOGLE CREDENTIAL RESPONSE HANDLER
  // ==========================================
  const handleGoogleCredentialResponse = async (response) => {
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const idToken = response.credential;

      const { data, error: signInError } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });

      if (signInError) throw signInError;

      setCustomer({
        name: data.user?.user_metadata?.name || "User Google",
        email: data.user?.email,
        phone: data.user?.user_metadata?.phone || "",
      });

      await handlePostLoginRedirect(data.user.id);
    } catch (err) {
      setError(err.message || "Gagal masuk menggunakan Google.");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setFormData((prev) => ({ ...prev, email: savedEmail }));
      setRememberMe(true);
    }

    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (googleClientId) {
      const checkGoogleLoaded = setInterval(() => {
        if (window.google && window.google.accounts) {
          clearInterval(checkGoogleLoaded);
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredentialResponse,
          });

          const buttonElement = document.getElementById("googleButtonDiv");
          if (buttonElement) {
            window.google.accounts.id.renderButton(buttonElement, {
              theme: "outline",
              size: "large",
              width: "100%",
            });
          }
        }
      }, 100);

      return () => clearInterval(checkGoogleLoaded);
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

      setCustomer({
        name: "User WhatsApp",
        email: data.email,
        phone: formData.phone,
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await handlePostLoginRedirect(user.id);
      } else {
        window.location.replace(callbackUrl);
      }
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
        setTimeout(async () => {
          if (data.user) {
            await handlePostLoginRedirect(data.user.id);
          } else {
            window.location.replace(callbackUrl);
          }
        }, 2000);
      } catch (err) {
        setError(err.message || "Gagal membuat akun.");
        setIsLoading(false);
      }
      return;
    }

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

      await handlePostLoginRedirect(data.user.id);
    } catch (err) {
      setError(err.message || "Email atau password salah.");
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
      <script src="https://accounts.google.com/gsi/client" async defer></script>

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

        <div className={styles.socialWrapper} style={{ display: "flex", justifyContent: "center", width: "100%" }}>
          <div id="googleButtonDiv"></div>
        </div>
      </div>
    </div>
  );
}