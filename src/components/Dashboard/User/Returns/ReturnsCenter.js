"use client";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { auth } from "@/lib/supabaseClient";
import styles from "./ReturnsCenter.module.css";

export default function ReturnsCenter() {
  const [requests, setRequests] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("Damaged item");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);


  const load = async (sessionToken) => {
    try {
      const token = sessionToken || (await auth.getSession()).data.session?.access_token;
      const res = await fetch("/api/returns", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRequests(data.requests || []);
    } catch (error) {
      toast.error(error.message || "Unable to load return requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let subscription = null;

    const initAuth = async () => {
      const { data: { session } } = await auth.getSession();
      if (session) {
        load(session.access_token);
      } else {
        setLoading(false);
      }

      const { data: authListener } = auth.onAuthStateChange((_event, session) => {
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

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    try {
      const { data: { session } } = await auth.getSession();
      const token = session?.access_token;

      if (!token) {
        toast.error("Sesi Anda telah berakhir. Silakan muat ulang.");
        return;
      }

      const res = await fetch("/api/returns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId, reason, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Permintaan retur terkirim.");
      setOrderId("");
      setNotes("");
      load(token);
    } catch (error) {
      toast.error(error.message || "Gagal mengirim permintaan retur.");
    }
  };

  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>After-sales support</p>
        <h2>Pengajuan retur atau refund</h2>
        <p className={styles.copy}>
          Retur dapat diajukan setelah pesanan selesai. Tim kami akan memperbarui
          statusnya di sini.
        </p>
        <form onSubmit={submit}>
          <label>
            ID pesanan
            <input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Contoh: ORDER-123"
              required
            />
          </label>
          <label>
            Alasan
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option>Damaged item</option>
              <option>Wrong item</option>
              <option>Item not as described</option>
              <option>Other</option>
            </select>
          </label>
          <label>
            Catatan
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Jelaskan masalahnya secara singkat"
            />
          </label>
          <button type="submit">Kirim pengajuan</button>
        </form>
      </section>
      <section className={styles.card}>
        <h3>Status pengajuan</h3>
        {loading ? (
          <p>Memuat pengajuan…</p>
        ) : requests.length ? (
          <div className={styles.list}>
            {requests.map((item) => (
              <div key={item.id}>
                <span>
                  <b>{item.orderId}</b>
                  <small>
                    {item.reason} ·{" "}
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleDateString("id-ID")
                      : ""}
                  </small>
                </span>
                <strong className={styles[`status${item.status}`]}>
                  {item.status}
                </strong>
              </div>
            ))}
          </div>
        ) : (
          <p>Belum ada pengajuan retur atau refund.</p>
        )}
      </section>
    </div>
  );
}