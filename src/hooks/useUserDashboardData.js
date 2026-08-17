"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/supabaseClient";
import userConfig from "@/data/ui/userDashboardConfig.json";

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
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let isCancelled = false;
    let subscription = null;

    const fetchUserData = async (currentUser, sessionToken) => {
      if (!currentUser) {
        if (!isCancelled) {
          window.location.replace("/login");
        }
        return;
      }

      setUser(currentUser);
      setLoading(true);
      setError("");

      const userId = currentUser.id || currentUser.uid;
      const headers = sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};

      try {
        const res = await fetch(`/api/users?userId=${userId}`, { headers });
        const result = await res.json();

        if (res.ok && result.exists && result.data) {
          const data = result.data;
          const resolvedName = normalizeUserName(
            data.full_name,
            data.username,
            currentUser.user_metadata?.full_name,
            currentUser.user_metadata?.name,
            currentUser.phone,
            currentUser.email,
          );

          if (!isCancelled) {
            setUserName(resolvedName);
            setRole(data.role || userConfig.defaultRole);
          }
        } else {
          const defaultName = normalizeUserName(
            currentUser.user_metadata?.full_name,
            currentUser.user_metadata?.name,
            currentUser.phone,
            currentUser.email,
          );

          try {
            await fetch("/api/users", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                ...headers,
              },
              body: JSON.stringify({
                userId,
                type: "profile",
                email: currentUser.email || "",
                phone: currentUser.phone || "",
                full_name: defaultName,
              }),
            });
          } catch (createErr) {
            console.error(userConfig.toasts.initError, createErr);
          }

          if (!isCancelled) {
            setUserName(defaultName);
            setRole(userConfig.defaultRole);
          }
        }
      } catch (err) {
        console.error(userConfig.toasts.fetchError, err);

        if (!isCancelled) {
          setError(userConfig.messages.loadUserError);
          setUserName(
            normalizeUserName(
              currentUser.user_metadata?.full_name,
              currentUser.user_metadata?.name,
              currentUser.phone,
              currentUser.email,
              userConfig.defaultUser,
            ),
          );
          setRole(userConfig.defaultRole);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    const initAuth = async () => {
      const { data: { session } } = await auth.getSession();
      if (!session?.user) {
        if (!isCancelled) {
          window.location.replace("/login");
        }
        return;
      }

      await fetchUserData(session.user, session.access_token);

      const { data: authListener } = auth.onAuthStateChange(async (_event, session) => {
        if (!session?.user) {
          if (!isCancelled) {
            window.location.replace("/login");
          }
          return;
        }
        await fetchUserData(session.user, session.access_token);
      });
      subscription = authListener?.subscription;
    };

    initAuth();

    return () => {
      isCancelled = true;
      if (subscription) subscription.unsubscribe();
    };
  }, [retryKey]);

  return {
    user,
    userName,
    role,
    loading,
    error,
    retry: () => setRetryKey((current) => current + 1),
  };
}