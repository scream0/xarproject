// src/features/auth/ProtectedRoute.jsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/supabaseClient";
import { shouldSkipAuthEvent } from "@/utils/authHelpers";

const ProtectedRoute = ({ children }) => {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let subscription = null;
    let lastUserId = null;

    const checkAuth = async () => {
      try {
        // 1. Cek sesi awal secara langsung
        const { data: { session } } = await auth.getSession();
        if (!session?.user) {
          router.replace("/login");
          return;
        } else {
          lastUserId = session.user.id || session.user.uid;
          setAuthorized(true);
        }
      } catch (err) {
        console.error("Auth check error:", err);
        router.replace("/login");
      } finally {
        setLoading(false);
      }

      // 2. Pasang listener untuk perubahan status autentikasi selanjutnya
      const { data: authListener } = auth.onAuthStateChange((_event, session) => {
        if (shouldSkipAuthEvent(_event, session, lastUserId)) {
          return;
        }
        
        const user = session?.user;
        if (!user) {
          router.replace("/login");
          setAuthorized(false);
        } else {
          lastUserId = user.id || user.uid;
          setAuthorized(true);
        }
        setLoading(false);
      });
      
      subscription = authListener?.subscription;
    };

    checkAuth();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [router]);

  // Memberikan feedback visual yang minimalis saat memuat
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <div className="animate-pulse text-sm tracking-widest text-gray-400">
          LOADING...
        </div>
      </div>
    );
  }

  // Jika sudah terotorisasi, render kontennya
  return authorized ? children : null;
};

export default ProtectedRoute;