"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const verifyRecoverySession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (active && session) setReady(true);
    };
    void verifyRecoverySession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
    if (password.length < 12) return setError("Password minimal 12 karakter.");
    if (password !== confirmPassword) return setError("Konfirmasi password tidak cocok.");
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) return setError(updateError.message);
    setMessage("Password berhasil diperbarui. Silakan masuk kembali.");
    window.setTimeout(() => router.replace("/login"), 1200);
  };

  if (!ready) {
    return <main style={{ padding: "3rem", textAlign: "center" }}>Link reset tidak valid atau telah kedaluwarsa.</main>;
  }

  return (
    <main style={{ maxWidth: 420, margin: "4rem auto", padding: "1.5rem" }}>
      <h1>Buat password baru</h1>
      <form onSubmit={submit}>
        <label>Password baru<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="12" required /></label>
        <label>Konfirmasi password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength="12" required /></label>
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        <button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan password"}</button>
      </form>
    </main>
  );
}
