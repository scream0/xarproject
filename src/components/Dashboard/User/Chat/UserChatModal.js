import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AppIcon } from "@/components/UI/Icon/AppIcon";

export default function UserChatModal({ isOpen, onClose, user }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [isAdminOnline, setIsAdminOnline] = useState(false);
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const presenceChannelRef = useRef(null);
  const typingTimeoutRef = useRef(null);

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

      const presenceChannel = supabase.channel('public:chats:presence', {
        config: { presence: { key: user.uid || user.id } }
      });
      presenceChannelRef.current = presenceChannel;

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState();
          let adminOnline = false;
          for (const key in state) {
            if (state[key].some(s => s.role === 'admin')) adminOnline = true;
          }
          setIsAdminOnline(adminOnline);
        })
        .on('broadcast', { event: 'typing' }, (payload) => {
          if (payload.payload.role === 'admin' && payload.payload.targetUserId === (user.uid || user.id)) {
            setIsAdminTyping(true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setIsAdminTyping(false), 3000);
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({ role: 'user', id: user.uid || user.id });
          }
        });

      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(presenceChannel);
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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Ukuran gambar maksimal 5MB");
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
    if (presenceChannelRef.current) {
      presenceChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { role: 'user', userId: user.uid || user.id }
      });
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !user || isUploading) return;

    const msgText = newMessage.trim();
    const fileToUpload = selectedFile;
    setNewMessage(""); // Optimistic clear
    removeFile();
    setIsUploading(true);

    try {
      let imageUrl = null;
      if (fileToUpload) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        const formData = new FormData();
        formData.append("file", fileToUpload);
        formData.append("userId", user.uid || user.id);
        formData.append("folder", "chats");

        const res = await fetch("/api/cloudinary", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        const data = await res.json();
        if (data.secure_url) {
          imageUrl = data.secure_url;
        } else {
          throw new Error("Gagal mengunggah gambar");
        }
      }

      const { error } = await supabase.from("chats").insert([
        {
          user_id: user.uid || user.id,
          message: msgText || "",
          image_url: imageUrl,
          sender_role: "user",
          is_read: false
        }
      ]);

      if (error) throw error;
    } catch (err) {
      console.error("Send message error:", err);
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(3px)",
          zIndex: 999,
          animation: "fadeIn 0.2s ease"
        }}
        onClick={onClose}
      />
      <div style={{
        position: "fixed",
        bottom: "clamp(20px, 10vw, 80px)",
        right: "clamp(10px, 5vw, 20px)",
        width: "min(350px, calc(100vw - 20px))",
        height: "min(500px, calc(100vh - 120px))",
        background: "var(--surface-primary)",
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
        border: "1px solid var(--border-color)",
        overflow: "hidden",
        animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
      }}>
      <div style={{
        background: "var(--primary-accent)",
        color: "var(--primary-accent-text)",
        padding: "16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div>
          <div style={{ fontWeight: "bold" }}>Chat dengan Admin</div>
          <div style={{ fontSize: "12px", opacity: 0.8, display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
            <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: isAdminOnline ? "#4ade80" : "#9ca3af" }}></span>
            {isAdminOnline ? "Online" : "Offline"}
          </div>
        </div>
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
              {m.image_url && (
                <img 
                  src={m.image_url} 
                  alt="Attachment" 
                  style={{ maxWidth: '100%', borderRadius: '4px', marginBottom: m.message ? '8px' : '0', cursor: 'pointer' }} 
                  onClick={() => setZoomedImage(m.image_url)}
                />
              )}
              {m.message && <div style={{ fontSize: "14px" }}>{m.message}</div>}
              <div style={{ fontSize: "10px", opacity: 0.7, marginTop: "4px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}>
                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {m.sender_role === "user" && (
                  <AppIcon name={m.is_read ? "check-check" : "check"} size={14} color={m.is_read ? "#3b82f6" : "currentColor"} />
                )}
              </div>
            </div>
          ))
        )}
        {isAdminTyping && (
          <div style={{ alignSelf: "flex-start", fontSize: "12px", color: "var(--text-secondary)", padding: "4px 8px", fontStyle: "italic" }}>
            Admin sedang mengetik...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ background: "var(--surface-primary)", borderTop: "1px solid var(--border-color)", display: "flex", flexDirection: "column" }}>
        {previewUrl && (
          <div style={{ padding: "8px 16px", position: "relative", display: "inline-block", alignSelf: "flex-start", marginTop: "8px", marginLeft: "16px", background: "var(--surface-secondary)", borderRadius: "8px" }}>
            <img src={previewUrl} alt="Preview" style={{ height: "60px", borderRadius: "4px", objectFit: "cover" }} />
            <button type="button" onClick={removeFile} style={{ position: "absolute", top: "-6px", right: "-6px", background: "rgba(0,0,0,0.6)", color: "white", border: "none", borderRadius: "50%", padding: "4px", cursor: "pointer", display: "flex" }}>
              <AppIcon name="x" size={12} />
            </button>
          </div>
        )}
        <form onSubmit={handleSendMessage} style={{ padding: "12px 16px", display: "flex", gap: "8px", alignItems: "center" }}>
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
            style={{ padding: "8px", background: "transparent", color: "var(--text-secondary)", border: "none", cursor: "pointer", display: "flex" }}
          >
            <AppIcon name="image" size={20} />
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={handleTyping}
            placeholder="Ketik pesan..."
            style={{ flex: 1, padding: "10px 14px", borderRadius: "6px", border: "1px solid var(--border-color)", outline: "none", background: "var(--input-background)", color: "var(--text-primary)" }}
          />
          <button
            type="submit"
            disabled={(!newMessage.trim() && !selectedFile) || isUploading}
            style={{ padding: "10px", background: "var(--primary-accent)", color: "var(--primary-accent-text)", border: "none", borderRadius: "6px", cursor: (!newMessage.trim() && !selectedFile) || isUploading ? "not-allowed" : "pointer", opacity: (!newMessage.trim() && !selectedFile) || isUploading ? 0.7 : 1 }}
          >
            {isUploading ? (
              <AppIcon name="loader" size={18} className="animate-spin" />
            ) : (
              <AppIcon name="send" size={18} />
            )}
          </button>
        </form>
      </div>
      <div style={{ padding: "4px 16px 12px", background: "var(--surface-primary)", fontSize: "11px", color: "var(--text-secondary)", textAlign: "center" }}>
        Riwayat obrolan akan direset otomatis setiap 24 jam.
      </div>
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
    </>
  );
}
