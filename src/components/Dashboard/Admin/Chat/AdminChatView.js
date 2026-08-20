"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";

export default function AdminChatView() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchUsers();

    const channel = supabase
      .channel("public:chats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chats" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const incoming = payload.new;
            // Update messages if the active chat matches
            setMessages((prev) => {
              if (selectedUser && incoming.user_id === selectedUser.id) {
                // Check for duplicates
                if (prev.find((m) => m.id === incoming.id)) return prev;
                return [...prev, incoming];
              }
              return prev;
            });
            
            // Refresh user list to show new message indicators or resort
            fetchUsers();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedUser]);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser.id);
    }
  }, [selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchUsers = async () => {
    try {
      // Get unique users from chats
      const { data: chatsData, error: chatsError } = await supabase
        .from("chats")
        .select("user_id, created_at, message, is_read, sender_role")
        .order("created_at", { ascending: false });

      if (chatsError) throw chatsError;

      // Group by user
      const userMap = new Map();
      chatsData.forEach((chat) => {
        if (!userMap.has(chat.user_id)) {
          userMap.set(chat.user_id, {
            id: chat.user_id,
            lastMessage: chat.message,
            lastMessageAt: chat.created_at,
            unreadCount: chat.sender_role === 'user' && !chat.is_read ? 1 : 0
          });
        } else {
          const existing = userMap.get(chat.user_id);
          if (chat.sender_role === 'user' && !chat.is_read) {
            existing.unreadCount += 1;
          }
        }
      });

      // Now fetch profiles for these users
      const userIds = Array.from(userMap.keys());
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, name, email")
          .in("id", userIds);

        if (profilesError) throw profilesError;

        const usersList = profiles.map((p) => ({
          ...p,
          ...userMap.get(p.id)
        })).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

        setUsers(usersList);
      }
    } catch (err) {
      console.error("Fetch users error:", err);
      // toast.error("Gagal mengambil daftar chat");
    }
  };

  const fetchMessages = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("chats")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Mark unread as read
      const unreadIds = data.filter(m => m.sender_role === 'user' && !m.is_read).map(m => m.id);
      if (unreadIds.length > 0) {
        await supabase.from("chats").update({ is_read: true }).in("id", unreadIds);
        fetchUsers(); // Refresh unread count in sidebar
      }

    } catch (err) {
      console.error("Fetch messages error:", err);
      toast.error("Gagal mengambil pesan");
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;

    const msgText = newMessage.trim();
    setNewMessage(""); // Optimistic clear

    try {
      const { error } = await supabase.from("chats").insert([
        {
          user_id: selectedUser.id,
          message: msgText,
          sender_role: "admin",
          is_read: true // admin messages are read by admin naturally
        }
      ]);

      if (error) throw error;
    } catch (err) {
      console.error("Send message error:", err);
      toast.error("Gagal mengirim pesan");
    }
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 100px)", border: "1px solid var(--border-color)", borderRadius: "8px", overflow: "hidden", background: "var(--surface-primary)", color: "var(--text-primary)" }}>
      {/* Sidebar Users */}
      <div style={{ width: "300px", borderRight: "1px solid var(--border-color)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid var(--border-color)", fontWeight: "bold" }}>
          Daftar Percakapan
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {users.length === 0 ? (
            <div style={{ padding: "16px", color: "var(--text-secondary)", textAlign: "center" }}>Belum ada chat</div>
          ) : (
            users.map((u) => (
              <div
                key={u.id}
                onClick={() => setSelectedUser(u)}
                style={{
                  padding: "16px",
                  borderBottom: "1px solid var(--border-color)",
                  cursor: "pointer",
                  background: selectedUser?.id === u.id ? "var(--surface-secondary)" : "var(--surface-primary)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <div style={{ overflow: "hidden" }}>
                  <div style={{ fontWeight: "600", fontSize: "14px", textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden" }}>
                    {u.name || u.email || "User"}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden" }}>
                    {u.lastMessage}
                  </div>
                </div>
                {u.unreadCount > 0 && (
                  <div style={{ background: "var(--danger-color)", color: "#fff", fontSize: "12px", padding: "2px 6px", borderRadius: "10px", minWidth: "20px", textAlign: "center" }}>
                    {u.unreadCount}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {selectedUser ? (
          <>
            <div style={{ padding: "16px", borderBottom: "1px solid var(--border-color)", fontWeight: "bold", background: "var(--surface-secondary)" }}>
              Chatting dengan {selectedUser.name || selectedUser.email}
            </div>
            <div style={{ flex: 1, padding: "16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", background: "var(--background)" }}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.sender_role === "admin" ? "flex-end" : "flex-start",
                    background: m.sender_role === "admin" ? "var(--primary-accent)" : "var(--surface-primary)",
                    color: m.sender_role === "admin" ? "var(--primary-accent-text)" : "var(--text-primary)",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    maxWidth: "70%",
                    boxShadow: "var(--shadow-sm)",
                    border: m.sender_role === "admin" ? "none" : "1px solid var(--border-color)"
                  }}
                >
                  <div style={{ fontSize: "14px" }}>{m.message}</div>
                  <div style={{ fontSize: "10px", opacity: 0.7, marginTop: "4px", textAlign: "right" }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} style={{ padding: "16px", borderTop: "1px solid var(--border-color)", display: "flex", gap: "8px", background: "var(--surface-primary)" }}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Tulis balasan..."
                style={{ flex: 1, padding: "10px 14px", borderRadius: "6px", border: "1px solid var(--border-color)", outline: "none", background: "var(--input-background)", color: "var(--text-primary)" }}
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                style={{ padding: "10px 20px", background: "var(--primary-accent)", color: "var(--primary-accent-text)", border: "none", borderRadius: "6px", cursor: newMessage.trim() ? "pointer" : "not-allowed", opacity: newMessage.trim() ? 1 : 0.7 }}
              >
                Kirim
              </button>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
            Pilih pengguna dari sidebar untuk mulai chat
          </div>
        )}
      </div>
    </div>
  );
}
