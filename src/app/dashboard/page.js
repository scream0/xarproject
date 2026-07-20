"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebaseClient";
import styles from "./Dashboard.module.css";

// Import dua dashboard
import AdminDashboard from "@/components/Dashboard/Admin/AdminDashboard";
import UserDashboard from "@/components/Dashboard/User/UserDashboard";

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        window.location.href = "/login";
        return; // Hentikan eksekusi
      }

      setUser(currentUser);

      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        // Menggunakan optional chaining (?.) agar tidak error jika field role kosong
        const userRole = userDoc.exists() ? userDoc.data()?.role : "customer";
        setRole(userRole || "customer"); // Fallback ke "customer" jika undefined
      } catch (error) {
        console.error("Gagal ambil data role:", error);
        setRole("customer");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <p>VERIFYING CREDENTIALS...</p>
      </div>
    );
  }

  return (
    <>
      {role === "admin" ? (
        <AdminDashboard user={user} />
      ) : (
        <UserDashboard user={user} />
      )}
    </>
  );
}
