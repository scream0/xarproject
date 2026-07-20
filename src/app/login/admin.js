// src/components/auth/ProtectedRoute.jsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { auth } from "../../lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";

const ProtectedRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // Jika tidak ada user, tendang ke login
        router.push("/login");
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen justify-center items-center">
        Loading...
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
