"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
import { auth } from "@/lib/firebaseClient";
import userConfig from "@/data/ui/userDashboardConfig.json";

const db = getFirestore();

function toTitleCase(value) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatEmailName(email) {
  return toTitleCase(
    String(email || "")
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function normalizeUserName(...candidates) {
  for (const candidate of candidates) {
    const raw = String(candidate || "").trim();

    if (!raw) {
      continue;
    }

    if (raw.includes("@")) {
      const formattedFromEmail = formatEmailName(raw);
      if (formattedFromEmail) {
        return formattedFromEmail;
      }
    }

    if (/^[+\d\s-]+$/.test(raw)) {
      return raw;
    }

    const formatted = toTitleCase(
      raw.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim(),
    );

    if (formatted) {
      return formatted;
    }
  }

  return userConfig.defaultCustomer;
}

export function useUserDashboardData() {
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        window.location.replace("/login");
        return;
      }

      setUser(currentUser);
      setLoading(true);
      setError("");

      try {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const resolvedName = normalizeUserName(
            data.full_name,
            data.username,
            currentUser.displayName,
            currentUser.phoneNumber,
            currentUser.email,
          );

          if (!isCancelled) {
            setUserName(resolvedName);
          }
        } else {
          const defaultName = normalizeUserName(
            currentUser.displayName,
            currentUser.phoneNumber,
            currentUser.email,
          );

          try {
            await setDoc(
              docRef,
              {
                uid: currentUser.uid,
                email: currentUser.email || "",
                phone_number: currentUser.phoneNumber || "",
                full_name: defaultName,
                created_at: new Date().toISOString(),
              },
              { merge: true },
            );
          } catch (createErr) {
            console.error(userConfig.toasts.initError, createErr);
          }

          if (!isCancelled) {
            setUserName(defaultName);
          }
        }
      } catch (err) {
        console.error(userConfig.toasts.fetchError, err);

        if (!isCancelled) {
          setError(userConfig.messages.loadUserError);
          setUserName(
            normalizeUserName(
              currentUser.displayName,
              currentUser.phoneNumber,
              currentUser.email,
              userConfig.defaultUser,
            ),
          );
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [retryKey]);

  return {
    user,
    userName,
    loading,
    error,
    retry: () => setRetryKey((current) => current + 1),
  };
}