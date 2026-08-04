"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";

export function useAdminAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState("");
  const [accessError, setAccessError] = useState("");

  useEffect(() => {
    let isDisposed = false;
    let activeController = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      activeController?.abort();

      if (!currentUser) {
        window.location.replace("/login");
        return;
      }

      const abortController = new AbortController();
      activeController = abortController;

      setUser(currentUser);
      setAccessError("");
      setLoading(true);

      try {
        const res = await fetch(`/api/users?userId=${currentUser.uid}`, {
          signal: abortController.signal,
        });

        if (!res.ok) {
          throw new Error("Gagal memverifikasi akses admin.");
        }

        const result = await res.json();
        const detectedRole = String(result?.data?.role || "").toLowerCase();
        const hasAdminRole = ["admin", "superadmin"].includes(detectedRole);

        if (!isDisposed) {
          setRole(detectedRole);
          setIsAdmin(hasAdminRole);

          if (!hasAdminRole) {
            setAccessError(
              "Akun ini tidak memiliki hak akses administrator untuk membuka Command Center.",
            );
          }
        }
      } catch (error) {
        if (abortController.signal.aborted || isDisposed) {
          return;
        }

        setIsAdmin(false);
        setAccessError(
          error?.message ||
            "Terjadi gangguan saat memverifikasi akses admin. Coba lagi beberapa saat.",
        );
      } finally {
        if (!isDisposed && activeController === abortController) {
          setLoading(false);
        }
      }
    });

    return () => {
      isDisposed = true;
      activeController?.abort();
      unsubscribe();
    };
  }, []);

  return {
    user,
    loading,
    isAdmin,
    role,
    accessError,
  };
}