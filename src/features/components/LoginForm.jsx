"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import loginConfig from "@/data/ui/loginConfig.json";
import styles from "./LoginForm.module.css";
import { useStore } from "@/context/StoreContext";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getSafeAuthRedirect } from "@/utils/authRedirect";

export default function LoginForm() {
  const { setCustomer } = useStore();
  const searchParams = useSearchParams();
  const callbackUrl = getSafeAuthRedirect(searchParams.get("callbackUrl"));

  const [email, setEmail] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [otpArray, setOtpArray] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef([]);

  // Timer State
  const [resendTimer, setResendTimer] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const { form } = loginConfig || {};

  // Resend Timer Logic
  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const formatTime = (timeInSeconds) => {
    const m = Math.floor(timeInSeconds / 60).toString().padStart(2, "0");
    const s = (timeInSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Helper untuk mengecek role di database dan melakukan redirect yang sesuai
  const handlePostLoginRedirect = useCallback(async (userId) => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      let isAdmin = false;
      if (!profileError && profile?.role) {
        isAdmin = ["admin", "superadmin"].includes(String(profile.role).toLowerCase());
      }
      
      if (!isAdmin) {
        const { data: { session } } = await supabase.auth.getSession();
        const metaRole = session?.user?.user_metadata?.role;
        if (metaRole) {
          isAdmin = ["admin", "superadmin"].includes(String(metaRole).toLowerCase());
        }
      }

      if (isAdmin) {
        window.location.replace("/dashboard");
      } else {
        window.location.replace(callbackUrl);
      }
    } catch (err) {
      console.error("Gagal memeriksa role:", err);
      window.location.replace(callbackUrl);
    }
  }, [callbackUrl]);

  // ==========================================
  // GOOGLE CREDENTIAL RESPONSE HANDLER (POPUP)
  // ==========================================
  const handleGoogleCredentialResponse = useCallback(async (response) => {
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
  }, [handlePostLoginRedirect, setCustomer]);

  useEffect(() => {
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
              theme: "outline", // White background, visible and clean
              size: "large",
              width: buttonElement.offsetWidth || 350,
            });
          }
        }
      }, 100);

      return () => clearInterval(checkGoogleLoaded);
    }
  }, [handleGoogleCredentialResponse]);

  // ==========================================
  // OTP BOX HANDLERS
  // ==========================================
  const handleOtpChange = (index, value) => {
    // Hanya terima satu digit angka saja
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtpArray = [...otpArray];
    newOtpArray[index] = digit;
    setOtpArray(newOtpArray);

    // Auto-advance ke kotak berikutnya
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpArray[index] && index > 0) {
      // Move focus to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").slice(0, 6).split("");
    if (pasteData.length > 0) {
      const newOtpArray = [...otpArray];
      pasteData.forEach((char, i) => {
        if (!isNaN(char) && i < 6) {
          newOtpArray[i] = char;
        }
      });
      setOtpArray(newOtpArray);
      // Focus on the next empty box or the last one
      const nextEmptyIndex = newOtpArray.findIndex(val => val === "");
      if (nextEmptyIndex !== -1) {
        inputRefs.current[nextEmptyIndex]?.focus();
      } else {
        inputRefs.current[5]?.focus();
      }
    }
  };

  const requestOtpCode = async () => {
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email,
      });
      if (signInError) throw signInError;
      
      setSuccessMessage("Kode OTP telah dikirim ke email Anda. Silakan periksa kotak masuk (atau spam).");
      setOtpSent(true);
      setResendTimer(60); // 1 menit
    } catch (err) {
      setError(err.message || "Gagal mengirim kode OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // MAIN SUBMIT HANDLER
  // ==========================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      setError("Email wajib diisi.");
      return;
    }

    if (!otpSent) {
      await requestOtpCode();
    } else {
      // TAHAP 2: VERIFIKASI KODE OTP
      const otpCode = otpArray.join("");
      if (otpCode.length < 6) {
        setError("Silakan masukkan kode OTP 6 digit.");
        return;
      }

      setError("");
      setIsLoading(true);

      try {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          email: email,
          token: otpCode,
          type: "email",
        });

        if (verifyError) throw verifyError;

        let userName = data.user?.user_metadata?.name;
        // Jika user baru dan tidak punya nama, gunakan nama depan dari email
        if (!userName) {
          userName = email.split("@")[0];
          await supabase.auth.updateUser({
            data: { name: userName, role: "customer" },
          });
        }

        setCustomer({
          name: userName,
          email: data.user?.email,
          phone: data.user?.user_metadata?.phone || "",
        });

        if (rememberMe) {
          localStorage.setItem("rememberedEmail", email);
        } else {
          localStorage.removeItem("rememberedEmail");
        }

        setSuccessMessage("Berhasil masuk! Mengalihkan...");
        await handlePostLoginRedirect(data.user.id);
      } catch (err) {
        setError("Kode OTP salah atau telah kedaluwarsa.");
        setIsLoading(false);
      }
    }
  };

  return (
    <div className={styles.formWrapper}>
      <script src="https://accounts.google.com/gsi/client" async defer></script>

      <div className={styles.loginCard}>
        <h2 className={styles.loginTitle}>{form?.title || "WELCOME BACK"}</h2>

        {!otpSent && (
          <>
            <div className={styles.socialWrapper}>
              <div id="googleButtonDiv"></div>
            </div>

            <div className={styles.divider}>
              <span>{form?.labels?.oauthDivider || "ATAU LANJUTKAN DENGAN EMAIL"}</span>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className={styles.loginForm}>
          {error && <div className={styles.errorMessage}>{error}</div>}
          {successMessage && <div className={styles.successMessage}>{successMessage}</div>}

          {/* Email Field - Hidden visually if OTP is sent, but keeps it around if needed */}
          {!otpSent && (
            <div className={styles.inputWrapper}>
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder={form?.fields?.find(f => f.name === 'email')?.placeholder || "EMAIL ADDRESS"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.inputField}
                disabled={isLoading}
                required
              />
            </div>
          )}

          {/* OTP Field (Muncul saat kode terkirim) */}
          <div className={`${styles.inputWrapper} ${otpSent ? styles.fieldVisible : styles.fieldHidden}`}>
             {otpSent && (
               <p className={styles.otpNoticeText}>
                 Masukkan kode yang dikirim ke <br/>
                 <strong className={styles.otpNoticeEmail}>{email}</strong>
               </p>
             )}
             <div className={styles.otpContainer}>
               {otpArray.map((digit, index) => (
                 <input
                   key={index}
                   type="tel"
                   inputMode="numeric"
                   pattern="[0-9]*"
                   maxLength={1}
                   value={digit}
                   ref={(el) => (inputRefs.current[index] = el)}
                   onChange={(e) => handleOtpChange(index, e.target.value)}
                   onKeyDown={(e) => handleOtpKeyDown(index, e)}
                   onPaste={handleOtpPaste}
                   className={styles.otpInputBox}
                   disabled={isLoading || !otpSent}
                   autoComplete="one-time-code"
                   suppressHydrationWarning
                 />
               ))}
             </div>
          </div>

          {!otpSent && isClient && (
            <div className={`${styles.optionsRow} ${styles.optionsRowLeft}`}>
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
            </div>
          )}

          <button
            type="submit"
            className={`${styles.btnLogin} ${isLoading ? styles.btnLoading : ""}`}
            disabled={isLoading || (otpSent && otpArray.join("").length < 6)}
          >
            {isLoading ? <span className={styles.spinner}></span> : (!otpSent ? (form?.buttons?.sendOtp || "KIRIM KODE OTP") : (form?.buttons?.verifyOtp || "VERIFIKASI OTP"))}
          </button>

          {otpSent && (
            <>
              {resendTimer > 0 ? (
                <span className={styles.resendTimerText}>
                  Kirim Ulang Kode ({formatTime(resendTimer)})
                </span>
              ) : (
                <button
                  type="button"
                  className={`${styles.switchModeBtn} ${styles.resendOtpBtn}`}
                  onClick={requestOtpCode}
                  disabled={isLoading}
                >
                  Kirim Ulang Kode OTP
                </button>
              )}

              <button
                type="button"
                className={`${styles.switchModeBtn} ${styles.changeEmailBtn}`}
                onClick={() => {
                  setOtpSent(false);
                  setOtpArray(["", "", "", "", "", ""]);
                  setResendTimer(0);
                  setError("");
                  setSuccessMessage("");
                }}
                disabled={isLoading}
              >
                Ubah Alamat Email
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
