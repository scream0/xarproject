// src/features/auth/ProtectedRoute.jsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { auth } from "@/lib/supabaseClient";

const ProtectedRoute = ({ children }) => {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const { data: authListener } = auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (!user) {
        router.replace("/login");
      } else {
        setAuthorized(true);
      }
      setLoading(false);
    });

    return () => {
      authListener?.subscription.unsubscribe();
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

