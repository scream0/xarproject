// @ts-nocheck
"use client";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { shouldSkipAuthEvent } from "@/utils/authHelpers";
import styles from "./NotificationsSection.module.css";
import notificationsConfig from "@/data/ui/notificationsConfig.json";
import { NotificationsSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";
import ConfirmationModal from "@/components/UI/Modal/ConfirmationModal";
import { Package, CreditCard, Gift, Bell } from "lucide-react";

// Format waktu menjadi "Baru saja", "5 menit lalu", dst.
function timeAgo(dateString: any) {
  if (!dateString) return notificationsConfig.timeAgo.justNow;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return notificationsConfig.timeAgo.justNow;

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return notificationsConfig.timeAgo.justNow;
  if (minutes < 60) return `${minutes} ${notificationsConfig.timeAgo.minutesAgo}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${notificationsConfig.timeAgo.hoursAgo}`;
  const days = Math.floor(hours / 24);
  return `${days} ${notificationsConfig.timeAgo.daysAgo}`;
}

const capitalize = (s: any) => s.charAt(0).toUpperCase() + s.slice(1);

const TYPE_ICON = {
  order: <Package size={18} />,
  payment: <CreditCard size={18} />,
  promo: <Gift size={18} />,
  system: <Bell size={18} />,
};

export default function NotificationsSection({ onUnreadCountChange }: any) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [submittingMarkAllRead, setSubmittingMarkAllRead] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [notificationToDelete, setNotificationToDelete] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const lastUserIdRef = useRef(null);

  const loadNotifications = useCallback(async (session: any) => {
    try {
      setLoading(true);
      const token = session?.access_token;
      
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/notifications", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      let result = {};
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const text = await res.text();
        try {
          result = text ? JSON.parse(text) : {};
        } catch (e) {
          console.error("Gagal parse JSON:", e);
        }
      }
      if (!res.ok) throw new Error(result.error || "Gagal memuat notifikasi.");
      
      // Map dari struktur database ke frontend (camelCase)
      const mappedNotifications = (result.notifications || []).map((n: any) => ({
        ...n,
        createdAt: n.created_at,
        isRead: n.is_read,
      }));
      setNotifications(mappedNotifications);
    } catch (err) {
      console.error("Gagal memuat notifikasi:", err);
      toast.error(notificationsConfig.toasts.fetchError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let subscription = null;

    const initAuth = async () => {
      if (!supabase?.auth) {
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      setCurrentSession(session);
      lastUserIdRef.current = session?.user?.id || null;

      if (session) {
        await loadNotifications(session);
      } else {
        setLoading(false);
      }

      // Listener perubahan sesi Supabase
      const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (shouldSkipAuthEvent(_event, session, lastUserIdRef.current)) return;
        lastUserIdRef.current = session?.user?.id || null;
        
        setCurrentSession(session);
        if (session) {
          await loadNotifications(session);
        } else {
          setNotifications([]);
          setLoading(false);
        }
      });
      subscription = authListener?.subscription;
    };

    initAuth();

    // Real-time subscription for user notifications
    // Dibuat secara sinkron (di luar async) agar bisa langsung dibersihkan saat unmount
    const realtimeChannel = supabase
      .channel("user_notifications_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        (payload) => {
          const userId = lastUserIdRef.current;
          
          if (payload.eventType === "DELETE") {
            setNotifications((prev) => prev.filter((n) => n.id !== payload.old.id));
            return;
          }

          if (
            payload.new &&
            (payload.new.audience === "user" ||
             payload.new.audience === "all" ||
             payload.new.user_id === userId)
          ) {
            const mapped = {
              ...payload.new,
              createdAt: payload.new.created_at,
              isRead: payload.new.is_read || false,
            };

            if (payload.eventType === "INSERT") {
              setNotifications((prev) => {
                if (prev.some((n) => n.id === mapped.id)) return prev;
                return [mapped, ...prev].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
              });
            } else if (payload.eventType === "UPDATE") {
              setNotifications((prev) =>
                prev.map((n) => {
                  if (n.id === mapped.id) {
                    return { ...n, ...mapped, isRead: n.isRead };
                  }
                  return n;
                })
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (subscription) subscription.unsubscribe();
      supabase.removeChannel(realtimeChannel);
    };
  }, [loadNotifications]);

  const markAllRead = async () => {
    try {
      setSubmittingMarkAllRead(true);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      if (!res.ok) throw new Error("Gagal memperbarui notifikasi.");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success(notificationsConfig.toasts.markAllReadSuccess);
    } catch (err) {
      console.error("Gagal tandai semua dibaca:", err);
      toast.error(err.message || "Gagal memperbarui notifikasi.");
    } finally {
      setSubmittingMarkAllRead(false);
    }
  };

  const markRead = async (notification: any) => {
    if (notification.isRead) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ notificationId: notification.id, isRead: true }),
      });
    } catch (err) {
      console.error("Gagal menandai notifikasi:", err);
    }

    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
    );
  };

  const handleNotificationClick = (notification: any) => {
    markRead(notification);
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const deleteNotification = (notification: any) => {
    setNotificationToDelete(notification);
  };

  const confirmDeleteNotification = async () => {
    if (!notificationToDelete) return;
    const notification = notificationToDelete;
    setNotificationToDelete(null);

    try {
      setDeletingId(notification.id);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/user/notifications?id=${notification.id}`,
        {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal menghapus notifikasi.");
      }
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      toast.success(notificationsConfig.toasts.deleteSuccess);
    } catch (err) {
      console.error("Gagal menghapus notifikasi:", err);
      toast.error(err.message || "Gagal menghapus notifikasi.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredNotifications = useMemo(() => {
    let result = notifications;
    if (filter === "unread") {
      result = result.filter((n) => !n.isRead);
    } else if (filter !== "all") {
      result = result.filter((n) => n.type === filter);
    }
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          (n.title || "").toLowerCase().includes(query) ||
          (n.message || "").toLowerCase().includes(query),
      );
    }
    return result;
  }, [notifications, filter, searchQuery]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    if (typeof onUnreadCountChange === "function") {
      onUnreadCountChange(unreadCount);
    }
  }, [onUnreadCountChange, unreadCount]);

  return (
    <div className={styles.workspaceInner}>
      {/* Header */}
      <div className={`card ${styles.cardHeader}`}>
        <div className={styles.headerTopRow}>
          <div>
            <h3 className={styles.headerTitle}>
              {notificationsConfig.header.title}
              {unreadCount > 0 && (
                <span className={styles.unreadBadge}>{unreadCount}</span>
              )}
            </h3>
            <p className={styles.headerSubtitle}>
              {notificationsConfig.header.subtitle}
            </p>
          </div>
          <div className={styles.headerActions}>
            <input
              type="text"
              placeholder={notificationsConfig.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            <button
              onClick={markAllRead}
              className={styles.markReadBtn}
              disabled={submittingMarkAllRead}
            >
              {submittingMarkAllRead ? "Menandai..." : notificationsConfig.buttons.markAllRead}
            </button>
          </div>
        </div>

        <div className={styles.filterGroup}>
          {Object.entries(notificationsConfig.tabs).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`${styles.filterBtn} ${
                filter === key ? styles.filterBtnActive : ""
              }`}
            >
              {label}
              {key === "unread" && unreadCount > 0 && (
                <span className={styles.filterCount}>{unreadCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Notification List */}
      <div className={styles.notificationsList}>
        {loading ? (
          <NotificationsSkeleton count={5} />
        ) : filteredNotifications.length === 0 ? (
          <div className={`card ${styles.centerStateCard}`}>
            <div className={styles.emptyIcon}>🔔</div>
            <p className={styles.emptyTitle}>
              {filter === "unread"
                ? notificationsConfig.emptyUnread
                : notificationsConfig.emptyTitle}
            </p>
            <p className={styles.emptyText}>
              {notificationsConfig.emptyText}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => {
            const isUnread = !notification.isRead;
            return (
              <div
                key={notification.id}
                className={`${styles.notificationItem} ${
                  isUnread ? styles.notificationUnread : ""
                } ${notification.link ? styles.clickable : ""}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div
                  className={`${styles.notificationIcon} ${
                    styles[`icon${capitalize(notification.type)}`] ||
                    styles.iconSystem
                  }`}
                >
                  {TYPE_ICON[notification.type] || <Bell size={18} />}
                </div>
                <div className={styles.notificationContent}>
                  <div className={styles.notificationTitleRow}>
                    <span className={styles.notificationTitle}>
                      {notification.title}
                    </span>
                    {isUnread && <span className={styles.unreadDot} />}
                  </div>
                  <p className={styles.notificationMessage}>
                    {notification.message}
                  </p>
                  <div className={styles.notificationMeta}>
                    <span className={styles.typeBadge}>
                      {notificationsConfig.typeLabels[notification.type] ||
                        notification.type}
                    </span>
                    <span className={styles.timeAgo}>
                      {timeAgo(notification.createdAt)}
                    </span>
                    {notification.link && (
                      <span className={styles.linkIndicator}>Lihat Detail &rarr;</span>
                    )}
                  </div>
                </div>
                {notification.user_id !== null && (
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification);
                    }}
                    aria-label="Hapus notifikasi"
                    disabled={deletingId === notification.id}
                  >
                    {deletingId === notification.id ? "..." : "✕"}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <ConfirmationModal
        isOpen={!!notificationToDelete}
        onClose={() => setNotificationToDelete(null)}
        onConfirm={confirmDeleteNotification}
        title="Hapus Notifikasi"
        message="Apakah Anda yakin ingin menghapus notifikasi ini?"
      />
    </div>
  );
}