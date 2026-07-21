"use client";

import React, { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup, // <-- Menggunakan Popup
  GoogleAuthProvider,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  updateProfile,
} from "firebase/auth";
import { auth } from "../../lib/firebaseClient";
import loginConfig from "@/data/ui/loginConfig.json";
import styles from "./LoginForm.module.css";
import { useStore } from "@/context/StoreContext";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const { setCustomer } = useStore();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Ambil callbackUrl dari URL, jika tidak ada, default ke /dashboard
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
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [isFormFocused, setIsFormFocused] = useState(false);

  // Destrukturisasi semua konfigurasi UI dari loginConfig.json
  const { form } = loginConfig || {};

  // ==========================================
  // EFFECT: REMEMBER ME
  // ==========================================
  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setFormData((prev) => ({ ...prev, email: savedEmail }));
      setRememberMe(true);
    }
  }, []);

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        {
          size: "invisible",
          callback: () => {},
        },
      );
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    // ==========================================
    // FLOW 1: MODE REGISTRASI (REGISTER)
    // ==========================================
    if (isRegister) {
      if (
        !formData.name ||
        !formData.email ||
        !formData.password ||
        !formData.confirmPassword
      ) {
        setError(
          form?.validation?.allFieldsRequired ||
            "Semua kolom registrasi wajib diisi.",
        );
        setIsLoading(false);
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError(
          form?.validation?.passwordMismatch ||
            "Konfirmasi password tidak cocok.",
        );
        setIsLoading(false);
        return;
      }

      try {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password,
        );

        await updateProfile(userCredential.user, {
          displayName: formData.name,
        });

        setCustomer({
          name: formData.name,
          email: userCredential.user.email,
          phone: "",
        });

        setSuccessMessage(
          form?.messages?.registerSuccess ||
            "Registrasi akun berhasil! Mengalihkan...",
        );
        window.location.href = callbackUrl; // Hard redirect agar stabil
      } catch (err) {
        console.error("Firebase Register Error:", err.code);
        if (err.code === "auth/email-already-in-use") {
          setError(
            form?.messages?.emailInUse || "Email tersebut sudah terdaftar.",
          );
        } else if (err.code === "auth/weak-password") {
          setError(
            form?.messages?.weakPassword ||
              "Password terlalu lemah (minimal 6 karakter).",
          );
        } else {
          setError(
            form?.messages?.registerFailed ||
              "Gagal membuat akun. Silakan coba lagi.",
          );
        }
        setIsLoading(false);
      }
      return;
    }

    // ==========================================
    // FLOW 2: MODE MASUK DENGAN NOMOR HP (OTP)
    // ==========================================
    if (isPhoneMode) {
      if (!otpCode) {
        setError(
          form?.validation?.otpRequired ||
            "Silakan masukkan kode OTP terlebih dahulu.",
        );
        setIsLoading(false);
        return;
      }
      try {
        const result = await confirmationResult.confirm(otpCode);
        setCustomer({
          name: result.user.displayName || "User",
          email: result.user.email,
          phone: "",
        });
        console.log("Login Nomor HP berhasil! User UID:", result.user.uid);
        window.location.href = callbackUrl; // Hard redirect agar stabil
      } catch (err) {
        console.error("OTP Verification Error:", err.code);
        if (
          err.code === "auth/invalid-credential" ||
          err.code === "auth/code-expired"
        ) {
          setError(
            form?.messages?.invalidOtp ||
              "Kode OTP yang Anda masukkan salah atau telah kedaluwarsa.",
          );
        } else {
          setError(
            form?.messages?.otpFailed ||
              "Gagal memverifikasi kode OTP. Silakan coba lagi.",
          );
        }
        setIsLoading(false);
      }
    }
    // ==========================================
    // FLOW 3: MODE MASUK DENGAN EMAIL & PASSWORD
    // ==========================================
    else {
      if (!formData.email || !formData.password) {
        setError(form?.emptyFieldsMessage || "Semua kolom wajib diisi.");
        setIsLoading(false);
        return;
      }

      try {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          formData.email,
          formData.password,
        );

        setCustomer({
          name: userCredential.user.displayName || "User",
          email: userCredential.user.email,
          phone: "",
        });

        if (rememberMe) {
          localStorage.setItem("rememberedEmail", formData.email);
        } else {
          localStorage.removeItem("rememberedEmail");
        }

        console.log("Login berhasil! User UID:", userCredential.user.uid);
        window.location.href = callbackUrl; // Hard redirect agar stabil
      } catch (err) {
        console.error("Firebase Auth Error:", err.code);
        if (err.code === "auth/invalid-credential") {
          setError(form?.errorMessage || "Email atau password salah.");
        } else if (err.code === "auth/too-many-requests") {
          setError(
            form?.messages?.tooManyRequests ||
              "Terlalu banyak percobaan login gagal. Akun ditangguhkan sementara.",
          );
        } else if (err.code === "auth/user-not-found") {
          setError("Akun tidak ditemukan. Silakan daftar terlebih dahulu.");
        } else {
          setError(
            form?.messages?.loginFailed ||
              "Terjadi masalah saat mencoba masuk. Silakan coba lagi.",
          );
        }
        setIsLoading(false);
      }
    }
  };

  const handleSendOtp = async () => {
    if (!formData.phone) {
      setError(
        form?.validation?.phoneRequired ||
          "Silakan isi nomor HP Anda terlebih dahulu.",
      );
      return;
    }
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    let formattedPhone = formData.phone.trim();
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "+62" + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith("8")) {
      formattedPhone = "+62" + formattedPhone;
    }

    if (!formattedPhone.startsWith("+")) {
      setError(
        form?.validation?.invalidPhoneFormat ||
          "Format nomor HP tidak valid. Gunakan format standar (Contoh: 0812xxx).",
      );
      setIsLoading(false);
      return;
    }

    try {
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(
        auth,
        formattedPhone,
        appVerifier,
      );

      setConfirmationResult(confirmation);
      setSuccessMessage(
        `${form?.messages?.otpSent || "Kode OTP sukses dikirim melalui SMS ke"} ${formattedPhone}`,
      );
    } catch (err) {
      console.error("Phone Auth Error:", err.code);
      if (err.code === "auth/invalid-phone-number") {
        setError(
          form?.messages?.invalidPhoneBackend ||
            "Format nomor HP tidak dikenali oleh sistem backend.",
        );
      } else if (err.code === "auth/too-many-requests") {
        setError(
          form?.messages?.smsLimitReached ||
            "Batas pengiriman SMS untuk nomor ini tercapai. Coba beberapa saat lagi.",
        );
      } else {
        setError(
          form?.messages?.smsFailed ||
            "Gagal mengirim SMS OTP. Periksa jaringan Anda atau coba lagi.",
        );
      }

      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setError(
        form?.validation?.emailRequiredForReset ||
          "Silakan masukkan email Anda terlebih dahulu untuk mereset password.",
      );
      return;
    }
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      await sendPasswordResetEmail(auth, formData.email);
      setSuccessMessage(
        form?.messages?.resetEmailSent ||
          "Link reset password telah dikirim ke email Anda.",
      );
    } catch (err) {
      console.error("Forgot Password Error:", err.code);
      setError(
        form?.messages?.resetEmailFailed ||
          "Gagal mengirim email reset. Pastikan email terdaftar.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // TOMBOL GOOGLE LOGIN (POPUP - ANTI-BLOKIR)
  // ==========================================
  const handleGoogleLogin = () => {
    // Hapus 'async' di sini agar tidak ada jeda micro-task
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    const provider = new GoogleAuthProvider();

    // Jalankan langsung tanpa await di awal pembuka fungsi
    signInWithPopup(auth, provider)
      .then((result) => {
        // Simpan data ke Store
        setCustomer({
          name: result.user.displayName || "User",
          email: result.user.email,
          phone: "",
        });

        console.log(
          "Google Auth (Popup) sukses! User:",
          result.user.displayName,
        );

        // Lempar ke Dashboard
        window.location.href = callbackUrl;
      })
      .catch((err) => {
        console.error("Google Auth Popup Error:", err);
        setIsLoading(false);

        if (err.code === "auth/popup-closed-by-user") {
          return; // Abaikan jika user sengaja menutup popup
        }

        if (err.code === "auth/popup-blocked") {
          setError(
            "Browser Anda memblokir jendela pop-up. Harapizinkan pop-up untuk situs ini.",
          );
          return;
        }

        setError(
          form?.messages?.googleAuthFailed || "Gagal masuk menggunakan Google.",
        );
      });
  };

  const toggleRegisterMode = () => {
    setIsRegister(!isRegister);
    setIsPhoneMode(false);
    setError("");
    setSuccessMessage("");
    setConfirmationResult(null);
    setOtpCode("");
    setIsFormFocused(false);
  };

  const getFormTitle = () => {
    if (isRegister) return form?.titles?.register || "CREATE ACCOUNT";
    if (isPhoneMode) return form?.titles?.phone || "PHONE SIGN IN";
    return form?.title || "SIGN IN";
  };

  const getSubmitButtonText = () => {
    if (isRegister) return form?.buttons?.signUp || "SIGN UP";
    if (isPhoneMode) return form?.buttons?.verifyOtp || "VERIFIKASI OTP";
    return form?.buttonText || "SIGN IN";
  };

  // ==========================================
  // RENDER UI UTAMA
  // ==========================================
  return (
    <div className={styles.formWrapper}>
      <div id="recaptcha-container"></div>

      {/* RENDER ANIMASI LAMPU GANTUNG */}
      <div
        className={`${styles.lampContainer} ${isFormFocused ? styles.lampActive : ""}`}
      >
        <svg
          className={styles.lampSvg}
          viewBox="0 0 40 140"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient
              id="metalGradient"
              x1="0"
              y1="110"
              x2="40"
              y2="122"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#121212" />
              <stop offset="30%" stopColor="#262626" />
              <stop offset="50%" stopColor="#3a3a3a" />
              <stop offset="70%" stopColor="#262626" />
              <stop offset="100%" stopColor="#121212" />
            </linearGradient>
          </defs>
          <line x1="20" y1="0" x2="20" y2="110" className={styles.lampCord} />
          <circle cx="20" cy="120" r="4.5" className={styles.lampBulb} />
          <path
            d="M10 110L4 122H36L30 110H10Z"
            fill="url(#metalGradient)"
            className={styles.lampOuterBody}
          />
          <ellipse
            cx="20"
            cy="122"
            rx="16"
            ry="2"
            className={styles.lampInnerRim}
          />
        </svg>
        <div className={styles.lampConeLight} />
      </div>

      <div className={styles.loginCard}>
        <h2 className={styles.loginTitle}>{getFormTitle()}</h2>

        <form onSubmit={handleSubmit} className={styles.loginForm}>
          {error && <div className={styles.errorMessage}>{error}</div>}
          {successMessage && (
            <div className={styles.successMessage}>{successMessage}</div>
          )}

          {/* RENDER FIELD SECARA DATA-DRIVEN */}
          {form?.fields?.map((field) => {
            if (!field || !field.name) return null;
            const shouldRender =
              field.visibility === "always" ||
              (field.visibility === "registerOnly" && isRegister) ||
              (field.visibility === "phoneModeOnly" &&
                isPhoneMode &&
                !confirmationResult) ||
              (field.visibility === "emailModeOnly" && !isPhoneMode);

            if (!shouldRender) return null;

            const wrapperClass = field.isAnimated
              ? `${styles.inputWrapper} ${isRegister ? styles.fieldVisible : styles.fieldHidden}`
              : styles.inputWrapper;

            return (
              <div key={field.name} className={wrapperClass}>
                <input
                  type={
                    field.type === "password" && showPassword
                      ? "text"
                      : field.type
                  }
                  name={field.name}
                  placeholder={field.placeholder}
                  value={formData[field.name] || ""}
                  onChange={handleChange}
                  className={styles.inputField}
                  disabled={isLoading}
                  required={field.required && isRegister}
                  onFocus={() => setIsFormFocused(true)}
                  onBlur={() => setIsFormFocused(false)}
                />

                {/* Fitur Toggle Mata khusus inputan Password */}
                {field.type === "password" && (
                  <button
                    type="button"
                    className={styles.togglePassword}
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                  >
                    {showPassword ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                        />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            );
          })}

          {/* Aksi Tambahan untuk Mode Phone: Request OTP (Hanya jika belum dikirim) */}
          {isPhoneMode && !confirmationResult && (
            <button
              type="button"
              onClick={handleSendOtp}
              className={styles.btnOtpRequest}
              disabled={isLoading}
            >
              {form?.buttons?.sendOtp || "KIRIM KODE OTP"}
            </button>
          )}

          {/* Input OTP Mandiri setelah SMS sukses terkirim */}
          {isPhoneMode && confirmationResult && (
            <div className={styles.inputWrapper}>
              <input
                type="text"
                placeholder={form?.otpPlaceholder || "Masukkan 6 digit OTP"}
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

          {/* Opsi Row Bawah (Remember Me & Forgot Password) */}
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

          {/* Tombol Submit Utama */}
          {(!isPhoneMode || confirmationResult) && (
            <button
              type="submit"
              className={`${styles.btnLogin} ${isLoading ? styles.btnLoading : ""}`}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className={styles.spinner}></span>
              ) : (
                getSubmitButtonText()
              )}
            </button>
          )}
        </form>

        {/* FOOTER INTERFACE SWITCHER */}
        {!isRegister && (
          <button
            type="button"
            className={styles.switchModeBtn}
            onClick={() => {
              setIsPhoneMode(!isPhoneMode);
              setError("");
              setSuccessMessage("");
              setConfirmationResult(null);
              setOtpCode("");
              setIsFormFocused(false);
            }}
            disabled={isLoading}
          >
            {isPhoneMode
              ? form?.switchText?.emailMode || "Masuk dengan Email & Password"
              : form?.switchText?.phoneMode || "Masuk dengan Nomor HP"}
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

        {/* TOMBOL OAUTH GOOGLE */}
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
            <svg
              className={styles.googleIcon}
              viewBox="0 0 24 24"
              width="20"
              height="20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="currentColor"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="currentColor"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="currentColor"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
