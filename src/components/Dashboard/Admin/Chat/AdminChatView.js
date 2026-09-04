"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import styles from "./AdminChatView.module.css";

const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1000, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch(e) {}
};

const QUICK_REPLIES = [
  "Halo! Ada yang bisa kami bantu?",
  "Pesanan Anda sedang kami proses.",
  "Mohon tunggu sebentar ya, kami akan segera mengeceknya."
];

export default function AdminChatView({ onUnreadCountChange }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const presenceChannelRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const selectedUserRef = useRef(selectedUser);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
    setIsTyping(false);
  }, [selectedUser]);

  useEffect(() => {
    fetchUsers();

    const channel = supabase
      .channel("admin_public_chats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chats" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const incoming = payload.new;
            if (incoming.sender_role === 'user') {
              playNotificationSound();
            }
            // Update messages if the active chat matches
            setMessages((prev) => {
              const currentSelected = selectedUserRef.current;
              if (currentSelected && incoming.user_id === currentSelected.id) {
                // If admin is viewing this chat, mark it as read immediately
                if (incoming.sender_role === 'user' && !incoming.is_read) {
                  supabase.auth.getSession().then(({ data: { session } }) => {
                    if (session?.access_token) {
                      fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/chats/${incoming.user_id}/read`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                        body: JSON.stringify({ ids: [incoming.id] })
                      }).catch(() => {});
                    }
                  });
                  incoming.is_read = true;
                }
                
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

    const presenceChannel = supabase.channel('public:chats:presence', {
      config: { presence: { key: 'admin' } }
    });
    presenceChannelRef.current = presenceChannel;

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const online = new Set();
        for (const key in state) {
          state[key].forEach(s => {
            if (s.role === 'user' && s.id) online.add(s.id);
          });
        }
        setOnlineUsers(online);
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.role === 'user' && selectedUserRef.current && payload.payload.userId === selectedUserRef.current.id) {
          setIsTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ role: 'admin' });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser.id);
    }
  }, [selectedUser]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  };

  useEffect(() => {
    // Panggil beruntun untuk melawan CSS transition & image loading yang lambat
    setTimeout(scrollToBottom, 50);
    setTimeout(scrollToBottom, 300);
    setTimeout(scrollToBottom, 600);
  }, [messages, selectedUser]);

  const fetchUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/chats?t=" + Date.now(), {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache"
        }
      });
      const result = res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {};
      if (!res.ok || !result.success) throw new Error(result.error || `HTTP ${res.status}`);
      
      const chatsData = result.data || [];
      console.log("chatsData from API:", chatsData);
      
      const usersList = chatsData.map((chat) => ({
        id: chat.user_id,
        name: chat.full_name || chat.email || "User",
        email: chat.email,
        avatar: chat.avatar_url,
        lastMessageAt: chat.last_activity,
        unreadCount: chat.unread_count,
        lastMessage: chat.last_message || (chat.last_image ? "[Gambar]" : "...")
      })).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

      setUsers(usersList);

      // Emit total unread count to parent
      if (onUnreadCountChange) {
        const totalUnread = usersList.reduce((sum, u) => sum + (u.unreadCount || 0), 0);
        onUnreadCountChange(totalUnread);
      }
    } catch (err) {
      console.error("Fetch users error:", err);
    }
  };

  const fetchMessages = async (userId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/chats/" + userId, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {};
      if (!res.ok || !result.success) throw new Error(result.error || `HTTP ${res.status}`);
      
      const data = result.data || [];
      setMessages(data);

      // Mark unread as read
      const unreadIds = data.filter(m => m.sender_role === 'user' && !m.is_read).map(m => m.id);
      if (unreadIds.length > 0) {
        await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/chats/" + userId + "/read", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ ids: unreadIds })
        });
        fetchUsers(); // Refresh unread count in sidebar
      }

    } catch (err) {
      console.error("Fetch messages error:", err);
      toast.error("Gagal mengambil pesan");
    }
  };


  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Ukuran gambar maksimal 5MB");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (presenceChannelRef.current && selectedUser) {
      presenceChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { role: 'admin', targetUserId: selectedUser.id }
      });
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !selectedUser || isUploading) return;

    const msgText = newMessage.trim();
    const fileToUpload = selectedFile;
    setNewMessage(""); // Optimistic clear
    removeFile();
    setIsUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Unauthenticated");

      let imageUrl = null;
      if (fileToUpload) {
        const formData = new FormData();
        formData.append("file", fileToUpload);
        formData.append("folder", "chats");

        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/cloudinary", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
        if (data.secure_url) {
          imageUrl = data.secure_url;
        } else {
          throw new Error("Gagal mengunggah gambar");
        }
      }

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: selectedUser.id, message: msgText, image_url: imageUrl })
      });
      const result = res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {};
      if (!res.ok || !result.success) throw new Error(result.error || `HTTP ${res.status} - Gagal mengirim pesan`);

      // Optimistic update: tambahkan pesan ke state agar langsung muncul
      if (result.data) {
        setMessages(prev => {
          if (prev.find(m => m.id === result.data.id)) return prev;
          return [...prev, result.data];
        });
      } else {
        fetchMessages(selectedUser.id);
      }

    } catch (err) {
      console.error("Send message error:", err);
      toast.error("Gagal mengirim pesan");
    } finally {
      setIsUploading(false);
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
                style={{ display: "flex", gap: "12px", alignItems: "center" }}
              >
                <div style={{ position: "relative", width: "36px", height: "36px", flexShrink: 0 }}>
                  <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "var(--surface-secondary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", position: "absolute", top: 0, left: 0 }}>
                    <AppIcon name="user" size={20} />
                  </div>
                  {u.avatar && (
                    <img 
                      src={u.avatar} 
                      alt="" 
                      style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", position: "absolute", top: 0, left: 0, zIndex: 1 }} 
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                </div>
                <div className={styles.userInfo}>
                  <div className={styles.userName} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: onlineUsers.has(u.id) ? "#4ade80" : "#9ca3af" }}></span>
                    {u.name || u.email || "User"}
                  </div>
                  <div className={styles.userLastMessage} style={{ opacity: 0.7, fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "150px" }}>
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
              <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Chatting dengan {selectedUser.name || selectedUser.email || "User"}</span>
                <span style={{ display: "inline-block", padding: "2px 6px", fontSize: "10px", borderRadius: "10px", background: onlineUsers.has(selectedUser.id) ? "rgba(74, 222, 128, 0.2)" : "rgba(156, 163, 175, 0.2)", color: onlineUsers.has(selectedUser.id) ? "#4ade80" : "#9ca3af" }}>
                  {onlineUsers.has(selectedUser.id) ? "Online" : "Offline"}
                </span>
              </div>
            </div>
            <div ref={chatContainerRef} className={styles.messagesList}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`${styles.messageBubble} ${m.sender_role === "admin" ? styles.admin : styles.user}`}
                >
                  {m.image_url && (
                    <img 
                      src={m.image_url} 
                      alt="Attachment" 
                      style={{ maxWidth: '100%', borderRadius: '4px', marginBottom: m.message ? '8px' : '0', cursor: 'pointer' }} 
                      onClick={() => setZoomedImage(m.image_url)}
                      onLoad={scrollToBottom}
                    />
                  )}
                  {m.message && <div>{m.message}</div>}
                  <span className={styles.messageTime} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {m.sender_role === "admin" && (
                      <AppIcon name={m.is_read ? "check-check" : "check"} size={14} color={m.is_read ? "#3b82f6" : "currentColor"} />
                    )}
                  </span>
                </div>
              ))}
              {isTyping && (
                <div style={{ alignSelf: "flex-start", fontSize: "12px", color: "var(--text-secondary)", padding: "4px 8px", fontStyle: "italic" }}>
                  Pengguna sedang mengetik...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            {previewUrl && (
              <div style={{ padding: "8px 16px", position: "relative", display: "inline-block", alignSelf: "flex-start", marginTop: "8px", marginLeft: "16px", background: "var(--surface-secondary)", borderRadius: "8px" }}>
                <img src={previewUrl} alt="Preview" style={{ height: "60px", borderRadius: "4px", objectFit: "cover" }} />
                <button type="button" onClick={removeFile} style={{ position: "absolute", top: "-6px", right: "-6px", background: "rgba(0,0,0,0.6)", color: "white", border: "none", borderRadius: "50%", padding: "4px", cursor: "pointer", display: "flex" }}>
                  <AppIcon name="x" size={12} />
                </button>
              </div>
            )}
            
            {/* Quick Replies */}
            <div style={{ padding: "0 16px", display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px", maxWidth: "100%", boxSizing: "border-box" }}>
              {QUICK_REPLIES.map((reply, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setNewMessage(reply)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "16px",
                    border: "1px solid var(--border-color)",
                    background: "var(--surface-secondary)",
                    color: "var(--text-secondary)",
                    fontSize: "12px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0
                  }}
                >
                  {reply}
                </button>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className={styles.chatInputArea} style={{ alignItems: "center" }}>
              <input
                type="file"
                accept="image/jpeg, image/png, image/webp"
                style={{ display: "none" }}
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                style={{ padding: "8px", background: "transparent", color: "var(--text-secondary)", border: "none", cursor: "pointer", display: "flex", marginRight: "4px" }}
              >
                <AppIcon name="image" size={20} />
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={handleTyping}
                placeholder="Tulis balasan..."
                className={styles.inputField}
              />
              <button
                type="submit"
                disabled={(!newMessage.trim() && !selectedFile) || isUploading}
                className={styles.sendBtn}
                style={{ opacity: (!newMessage.trim() && !selectedFile) || isUploading ? 0.7 : 1 }}
              >
                {isUploading ? (
                  <AppIcon name="loader" size={18} className="animate-spin" />
                ) : (
                  <AppIcon name="send" size={18} />
                )}
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
      
      {/* Lightbox Zoom */}
      {zoomedImage && (
        <div 
          style={{
            position: "fixed", inset: 0, zIndex: 10000,
            background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center",
            padding: "20px"
          }}
          onClick={() => setZoomedImage(null)}
        >
          <img src={zoomedImage} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "8px" }} alt="Zoomed" />
          <button style={{ position: "absolute", top: "20px", right: "20px", background: "rgba(0,0,0,0.5)", color: "white", border: "none", borderRadius: "50%", padding: "12px", cursor: "pointer" }}>
            <AppIcon name="x" size={24} />
          </button>
        </div>
      )}
    </div>
  );
}
