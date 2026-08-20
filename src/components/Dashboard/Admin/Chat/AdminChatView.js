"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import styles from "./AdminChatView.module.css";

export default function AdminChatView() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef(null);

  const selectedUserRef = useRef(selectedUser);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    // 24-hour cleanup
    const cleanupOldChats = async () => {
      try {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        await supabase.from("chats").delete().lt("created_at", yesterday);
      } catch (err) {
        console.error("Cleanup error:", err);
      }
    };
    cleanupOldChats();

    fetchUsers();

    const channel = supabase
      .channel("admin_public_chats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chats" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const incoming = payload.new;
            // Update messages if the active chat matches
            setMessages((prev) => {
              const currentSelected = selectedUserRef.current;
              if (currentSelected && incoming.user_id === currentSelected.id) {
                // Check for duplicates
                if (prev.find((m) => m.id === incoming.id)) return prev;
                return [...prev, incoming];
              }
              return prev;
            });
            // Refresh user list to show new message indicators or resort
            fetchUsers();
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new;
            setMessages((prev) => prev.map(m => m.id === updated.id ? updated : m));
            fetchUsers(); // Optional: update unread badge if needed
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
        let profiles = [];
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const res = await fetch("/api/team", {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (res.ok) {
              const result = await res.json();
              profiles = result.users || [];
            }
          }
        } catch (e) {
          console.warn("Could not fetch profiles via API", e);
        }

        const usersList = userIds.map((id) => {
          const p = profiles.find((prof) => prof.id === id) || {};
          return {
            id,
            name: p.name || null,
            email: p.email || null,
            ...userMap.get(id)
          };
        }).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

        setUsers(usersList);
      }
    } catch (err) {
      console.error("Fetch users error:", JSON.stringify(err, null, 2), err.message);
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
    <div className={`${styles.chatContainer} ${selectedUser ? styles.chatActive : ""}`}>
      {/* Sidebar Users */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          Daftar Percakapan
        </div>
        <div className={styles.userList}>
          {users.length === 0 ? (
            <div className={styles.emptySidebar}>Belum ada chat</div>
          ) : (
            users.map((u) => (
              <div
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className={`${styles.userItem} ${selectedUser?.id === u.id ? styles.active : ""}`}
              >
                <div className={styles.userInfo}>
                  <div className={styles.userName}>
                    {u.name || u.email || "User"}
                  </div>
                  <div className={styles.userLastMessage}>
                    {u.lastMessage}
                  </div>
                </div>
                {u.unreadCount > 0 && (
                  <div className={styles.unreadBadge}>
                    {u.unreadCount}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={styles.chatArea}>
        {selectedUser ? (
          <>
            <div className={styles.chatHeader}>
              <button 
                className={styles.backBtn}
                onClick={() => setSelectedUser(null)}
                aria-label="Kembali"
              >
                <AppIcon name="arrow-left" size={18} />
              </button>
              <span>Chatting dengan {selectedUser.name || selectedUser.email || "User"}</span>
            </div>
            <div className={styles.messagesList}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`${styles.messageBubble} ${m.sender_role === "admin" ? styles.admin : styles.user}`}
                >
                  <div>{m.message}</div>
                  <span className={styles.messageTime} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {m.sender_role === "admin" && (
                      <AppIcon name={m.is_read ? "check-check" : "check"} size={14} color={m.is_read ? "#3b82f6" : "currentColor"} />
                    )}
                  </span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className={styles.chatInputArea}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Tulis balasan..."
                className={styles.inputField}
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className={styles.sendBtn}
              >
                <AppIcon name="send" size={18} />
              </button>
            </form>
            <div style={{ padding: "4px 16px 12px", background: "var(--surface-primary)", fontSize: "11px", color: "var(--text-secondary)", textAlign: "center" }}>
              Riwayat obrolan akan direset otomatis setiap 24 jam untuk menjaga kapasitas database.
            </div>
          </>
        ) : (
          <div className={styles.emptyChat}>
            <AppIcon name="message-square" size={48} opacity={0.3} />
            Pilih pengguna dari sidebar untuk mulai chat
          </div>
        )}
      </div>
    </div>
  );
}
