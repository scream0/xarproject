"use client";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { shouldSkipAuthEvent } from "@/utils/authHelpers";
import styles from "./NotificationsSection.module.css";
import notificationsConfig from "@/data/ui/notificationsConfig.json";
import { NotificationsSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";

// Format waktu menjadi "Baru saja", "5 menit lalu", dst.
function timeAgo(dateString) {
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

const TYPE_ICON = {
  order: "package",
  payment: "shopping-cart",
  promo: "gift",
  system: "bell",
};

export default function NotificationsSection({ onUnreadCountChange }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [submittingMarkAllRead, setSubmittingMarkAllRead] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const lastUserIdRef = useRef(null);

  const loadNotifications = useCallback(async (session) => {
    try {
      setLoading(true);
      const token = session?.access_token;
      
      const res = await fetch("/api/notifications", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal memuat notifikasi.");
      setNotifications(result.notifications || []);
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

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [loadNotifications]);

  const markAllRead = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        toast.error("Sesi Anda telah berakhir. Silakan muat ulang.");
        return;
      }
      setSubmittingMarkAllRead(true);

      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ markAllAsRead: true }),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Gagal menandai semua notifikasi.");
      }
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success(notificationsConfig.toasts.markAllReadSuccess);
    } catch (err) {
      console.error("Gagal tandai semua dibaca:", err);
      toast.error(err.message || "Gagal memperbarui notifikasi.");
    } finally {
      setSubmittingMarkAllRead(false);
    }
  };

  const markRead = async (notification) => {
    if (notification.isRead) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      await fetch("/api/notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ notificationId: notification.id, isRead: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
      );
    } catch (err) {
      console.error("Gagal menandai notifikasi:", err);
    }
  };

  const deleteNotification = async (notification) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus notifikasi ini?")) {
      return;
    }
    try {
      setDeletingId(notification.id);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(
        `/api/notifications?id=${notification.id}`,
        {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (!res.ok) throw new Error("Gagal menghapus notifikasi.");
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
                }`}
                onClick={() => markRead(notification)}
              >
                <div
                  className={`${styles.notificationIcon} ${
                    styles[`type_${notification.type}`] || ""
                  }`}
                >
                  {TYPE_ICON[notification.type] || "bell"}
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
                  </div>
                </div>
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}