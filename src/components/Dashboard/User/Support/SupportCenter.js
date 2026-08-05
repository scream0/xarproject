"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { auth } from "@/lib/supabaseClient";
import styles from "./SupportCenter.module.css";

export default function SupportCenter() {
  const [tickets, setTickets] = useState([]);
  const [subject, setSubject] = useState("");
  const [orderId, setOrderId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async (sessionToken) => {
    try {
      const token = sessionToken || (await auth.getSession()).data.session?.access_token;
      const res = await fetch("/api/support", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTickets(data.tickets || []);
    } catch (error) {
      toast.error(error.message || "Gagal memuat tiket.");
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
          setTickets([]);
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

  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data: { session } } = await auth.getSession();
      const token = session?.access_token;

      if (!token) {
        toast.error("Sesi Anda telah berakhir. Silakan muat ulang.");
        return;
      }

      const res = await fetch("/api/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subject, orderId, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Tiket bantuan dibuat.");
      setSubject("");
      setOrderId("");
      setMessage("");
      load(token);
    } catch (error) {
      toast.error(error.message || "Gagal membuat tiket.");
    }
  };

  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <p>Customer care</p>
        <h2>Butuh bantuan?</h2>
        <form onSubmit={submit}>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subjek masalah"
            required
          />
          <input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="ID pesanan (opsional)"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ceritakan yang bisa kami bantu"
            required
          />
          <button>Kirim tiket</button>
        </form>
      </section>
      <section className={styles.card}>
        <h3>Tiket saya</h3>
        {loading ? (
          <p>Memuat…</p>
        ) : (
          tickets.map((ticket) => (
            <article key={ticket.id}>
              <div>
                <b>{ticket.subject}</b>
                <small>{ticket.orderId || "Tanpa pesanan"}</small>
              </div>
              <strong>{ticket.status}</strong>
              <p>{ticket.messages?.at(-1)?.body}</p>
            </article>
          ))
        )}
        {!loading && !tickets.length && <p>Belum ada tiket bantuan.</p>}
      </section>
    </div>
  );
}