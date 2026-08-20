import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AppIcon } from "@/components/UI/Icon/AppIcon";

export default function UserChatModal({ isOpen, onClose, user }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && user) {
      fetchMessages();
      
      const channel = supabase
        .channel("public:chats:user")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "chats", filter: `user_id=eq.${user.uid || user.id}` },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const incoming = payload.new;
              setMessages((prev) => {
                if (prev.find((m) => m.id === incoming.id)) return prev;
                return [...prev, incoming];
              });
            } else if (payload.eventType === "UPDATE") {
              const updated = payload.new;
              setMessages((prev) => prev.map(m => m.id === updated.id ? updated : m));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isOpen, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    const userId = user.uid || user.id;
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("chats")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      
      // Mark admin messages as read
      const unreadIds = data.filter(m => m.sender_role === 'admin' && !m.is_read).map(m => m.id);
      if (unreadIds.length > 0) {
        await supabase.from("chats").update({ is_read: true }).in("id", unreadIds);
      }

    } catch (err) {
      console.error("Fetch messages error:", err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const msgText = newMessage.trim();
    setNewMessage(""); // Optimistic clear

    try {
      const { error } = await supabase.from("chats").insert([
        {
          user_id: user.uid || user.id,
          message: msgText,
          sender_role: "user",
          is_read: false
        }
      ]);

      if (error) throw error;
    } catch (err) {
      console.error("Send message error:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "clamp(20px, 10vw, 80px)",
      right: "clamp(10px, 5vw, 20px)",
      width: "min(350px, calc(100vw - 20px))",
      height: "min(500px, calc(100vh - 120px))",
      background: "var(--surface-primary)",
      borderRadius: "12px",
      boxShadow: "var(--shadow-md)",
      display: "flex",
      flexDirection: "column",
      zIndex: 1000,
      border: "1px solid var(--border-color)",
      overflow: "hidden"
    }}>
      <div style={{
        background: "var(--primary-accent)",
        color: "var(--primary-accent-text)",
        padding: "16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div style={{ fontWeight: "bold" }}>Chat dengan Admin</div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--primary-accent-text)", cursor: "pointer" }}>
          <AppIcon name="x" size={20} />
        </button>
      </div>
      
      <div style={{ flex: 1, padding: "16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", background: "var(--background)" }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-secondary)", marginTop: "auto", marginBottom: "auto" }}>
            Mulai obrolan dengan admin Mameko.
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.sender_role === "user" ? "flex-end" : "flex-start",
                background: m.sender_role === "user" ? "var(--primary-accent)" : "var(--surface-primary)",
                color: m.sender_role === "user" ? "var(--primary-accent-text)" : "var(--text-primary)",
                padding: "10px 14px",
                borderRadius: "8px",
                maxWidth: "80%",
                boxShadow: "var(--shadow-sm)",
                border: m.sender_role === "user" ? "none" : "1px solid var(--border-color)"
              }}
            >
              <div style={{ fontSize: "14px" }}>{m.message}</div>
              <div style={{ fontSize: "10px", opacity: 0.7, marginTop: "4px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}>
                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {m.sender_role === "user" && (
                  <AppIcon name={m.is_read ? "check-check" : "check"} size={14} color={m.is_read ? "#3b82f6" : "currentColor"} />
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} style={{ padding: "16px", borderTop: "1px solid var(--border-color)", display: "flex", gap: "8px", background: "var(--surface-primary)" }}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Ketik pesan..."
          style={{ flex: 1, padding: "10px 14px", borderRadius: "6px", border: "1px solid var(--border-color)", outline: "none", background: "var(--input-background)", color: "var(--text-primary)" }}
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
          style={{ padding: "10px", background: "var(--primary-accent)", color: "var(--primary-accent-text)", border: "none", borderRadius: "6px", cursor: newMessage.trim() ? "pointer" : "not-allowed", opacity: newMessage.trim() ? 1 : 0.7 }}
        >
          <AppIcon name="send" size={18} />
        </button>
      </form>
      <div style={{ padding: "4px 16px 12px", background: "var(--surface-primary)", fontSize: "11px", color: "var(--text-secondary)", textAlign: "center" }}>
        Riwayat obrolan akan direset otomatis setiap 24 jam.
      </div>
    </div>
  );
}
