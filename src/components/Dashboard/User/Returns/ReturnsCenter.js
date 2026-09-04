"use client";
import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { auth } from "@/lib/supabaseClient";
import styles from "./ReturnsCenter.module.css";
import { shouldSkipAuthEvent } from "@/utils/authHelpers";

const RETURN_STATUS_INFO = {
  pending: { label: "Menunggu Review", color: "#f59e0b" },
  approved: { label: "Disetujui ✅", color: "#10b981" },
  rejected: { label: "Ditolak ❌", color: "#ef4444" },
  return_requested: { label: "Menunggu Review", color: "#f59e0b" },
  returned: { label: "Selesai", color: "#6366f1" },
};

export default function ReturnsCenter() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const lastUserIdRef = useRef(null);

  const load = async (sessionToken) => {
    try {
      const token = sessionToken || (await auth.getSession()).data.session?.access_token;
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/returns", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRequests(data.returns || []);
    } catch (error) {
      toast.error(error.message || "Gagal memuat riwayat retur.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let subscription = null;

    const initAuth = async () => {
      const { data: { session } } = await auth.getSession();
      lastUserIdRef.current = session?.user?.id || null;
      if (session) {
        load(session.access_token);
      } else {
        setLoading(false);
      }

      const { data: authListener } = auth.onAuthStateChange((_event, session) => {
        if (shouldSkipAuthEvent(_event, session, lastUserIdRef.current)) return;
        lastUserIdRef.current = session?.user?.id || null;
        if (session) {
          load(session.access_token);
        } else {
          setRequests([]);
          setLoading(false);
        }
      });
      subscription = authListener?.subscription;
    };

    initAuth();
    return () => { if (subscription) subscription.unsubscribe(); };
  }, []);

  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>After-sales support</p>
        <h2>Riwayat Pengajuan Retur & Refund</h2>
        <p className={styles.copy}>
          Di sini kamu dapat melihat status pengajuan retur yang telah kamu kirim.
          Pengajuan retur dapat dilakukan dari halaman <strong>Pesanan</strong> pada pesanan yang sudah Selesai.
        </p>
      </section>

      <section className={styles.card}>
        <h3>Status pengajuan</h3>
        {loading ? (
          <p>Memuat pengajuan…</p>
        ) : requests.length ? (
          <div className={styles.list}>
            {requests.map((item) => {
              const statusInfo = RETURN_STATUS_INFO[item.status] || { label: item.status, color: "#71717a" };
              return (
                <div key={item.id} style={{ display: "flex", flexDirection: "column", padding: "16px 0", borderBottom: "1px solid var(--border-light)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                    <div style={{ flex: 1 }}>
                      <b style={{ fontSize: "0.9rem" }}>#{item.orderId?.slice(-8)?.toUpperCase() || "—"}</b>
                      <br />
                      <small style={{ color: "var(--text-secondary)" }}>
                        {item.reason} &nbsp;·&nbsp;{" "}
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                          : ""}
                      </small>
                    </div>
                    <span style={{
                      flexShrink: 0,
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: "20px",
                      background: `${statusInfo.color}20`,
                      color: statusInfo.color,
                      border: `1px solid ${statusInfo.color}40`,
                    }}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {item.evidence && (
                    <div style={{ marginTop: "8px" }}>
                      <a
                        href={item.evidence}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--primary-color)", fontSize: "0.82rem", textDecoration: "underline" }}
                      >
                        📎 Lihat Foto Bukti
                      </a>
                    </div>
                  )}

                  {item.adminNote && (
                    <div style={{
                      marginTop: "10px",
                      padding: "10px 14px",
                      background: item.status === "approved" ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
                      borderLeft: `3px solid ${item.status === "approved" ? "#10b981" : "#ef4444"}`,
                      borderRadius: "0 6px 6px 0",
                      fontSize: "0.85rem",
                      color: "var(--text-primary)",
                    }}>
                      <strong>Catatan Admin:</strong> {item.adminNote}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
            <p style={{ fontSize: "2rem", marginBottom: "8px" }}>📦</p>
            <p>Belum ada pengajuan retur atau refund.</p>
            <small>Kamu dapat mengajukan retur dari halaman <strong>Pesanan</strong>.</small>
          </div>
        )}
      </section>
    </div>
  );
}