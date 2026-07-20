// src/components/auth/ProtectedRoute.jsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { auth } from "../../lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";

const ProtectedRoute = ({ children }) => {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // Gunakan replace agar user tidak bisa kembali dengan tombol "back"
        router.replace("/login");
      } else {
        setAuthorized(true);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Memberikan feedback visual yang minimalis saat memuat (Luxury style)
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
