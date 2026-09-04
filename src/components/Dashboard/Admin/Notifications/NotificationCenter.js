"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import styles from "./NotificationCenter.module.css";
import { shouldSkipAuthEvent } from "@/utils/authHelpers";
import config from "@/data/ui/notificationCenterConfig.json";
import { NotificationsSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";
import ConfirmationModal from "@/components/UI/Modal/ConfirmationModal";
import { Package, CreditCard, Gift, Bell, TrendingDown } from "lucide-react";

function timeAgo(dateString) {
  if (!dateString) return "Baru saja";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Baru saja";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

const capitalize = (s) => {
  if (typeof s !== "string") return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const TYPE_ICON = {
  order: <Package size={18} />,
  payment: <CreditCard size={18} />,
  promo: <Gift size={18} />,
  system: <Bell size={18} />,
  stock: <TrendingDown size={18} />,
};

export default function NotificationCenter({ onUnreadCountChange }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState(null);
  const lastUserIdRef = useRef(null);
  const [createForm, setCreateForm] = useState({
    title: "",
    message: "",
    link: "",
    type: "system",
    audience: "admin",
  });

  const getSupabaseToken = async () => {
    const { data: { session } } = await auth.getSession();
    return session?.access_token || null;
  };

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getSupabaseToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/notifications?scope=system", {
        headers,
      });
      const contentType = res.headers.get("content-type");
      let result = {};
      if (contentType && contentType.includes("application/json")) {
        const text = await res.text();
        try {
          result = text ? JSON.parse(text) : {};
        } catch (e) {
          console.error("Gagal parse JSON notifikasi admin:", e);
        }
      }
      if (!res.ok) throw new Error(result.error || "Gagal memuat notifikasi.");
      
      const mappedNotifications = (result.notifications || []).map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        link: n.link,
        type: n.type,
        audience: n.audience,
        createdAt: n.created_at,
        isRead: n.is_read,
      }));
      setNotifications(mappedNotifications);
    } catch (err) {
      console.error("Gagal memuat notifikasi admin:", err);
      toast.error(err.message || "Gagal memuat notifikasi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initAuthAndFetch = async () => {
      await loadNotifications();
    };

    initAuthAndFetch();

    const { data: { subscription } } = auth.onAuthStateChange(async (_event, session) => {
      if (shouldSkipAuthEvent(_event, session, lastUserIdRef.current)) return;
      lastUserIdRef.current = session?.user?.id || null;

      if (session) {
        await loadNotifications();
      }
    });

    const channel = supabase
      .channel("admin_notifications_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setNotifications((prev) => prev.filter((n) => n.id !== payload.old.id));
            return;
          }

          if (payload.new) {
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
      subscription?.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!isCreateOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsCreateOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCreateOpen]);

  const markAllRead = async () => {
    try {
      const token = await getSupabaseToken();
      if (!token) {
        toast.error("Sesi Anda telah berakhir. Silakan muat ulang.");
        return;
      }

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ markAllAsRead: true }),
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        let result = {};
        if (contentType && contentType.includes("application/json")) {
          const text = await res.text();
          try {
            result = text ? JSON.parse(text) : {};
          } catch (e) {
            console.error("Gagal parse JSON:", e);
          }
        }
        throw new Error(result.error || "Gagal menandai semua notifikasi.");
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success(config.toasts.markAllReadSuccess);
    } catch (err) {
      console.error("Gagal tandai semua dibaca:", err);
      toast.error(err.message || "Gagal memperbarui notifikasi.");
    }
  };

  const markRead = async (notification) => {
    if (notification.isRead) return;
    try {
      const token = await getSupabaseToken();
      await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/notifications", {
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

  const handleNotificationClick = (notification) => {
    markRead(notification);
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const deleteNotification = (notification) => {
    setNotificationToDelete(notification);
  };

  const confirmDeleteNotification = async () => {
    if (!notificationToDelete) return;
    const notification = notificationToDelete;
    setNotificationToDelete(null);

    try {
      const token = await getSupabaseToken();
      if (!token) {
        toast.error("Sesi Anda telah berakhir. Silakan muat ulang.");
        return;
      }

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/notifications?id=${notification.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Gagal menghapus notifikasi.");
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      toast.success(config.toasts.deleteSuccess);
    } catch (err) {
      console.error("Gagal menghapus notifikasi:", err);
      toast.error(err.message || "Gagal menghapus notifikasi.");
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const { title, message, link, type, audience } = createForm;
    if (!title || !message) {
      toast.error("Judul dan pesan wajib diisi.");
      return;
    }
    try {
      setSubmitting(true);
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, message, link, type, audience }),
      });
      const contentType = res.headers.get("content-type");
      let result = {};
      if (contentType && contentType.includes("application/json")) {
        const text = await res.text();
        try {
          result = text ? JSON.parse(text) : {};
        } catch (e) {
          console.error("Gagal parse JSON:", e);
        }
      }
      if (!res.ok) throw new Error(result.error || "Gagal membuat notifikasi.");
      toast.success(config.toasts.createSuccess);
      setIsCreateOpen(false);
      setCreateForm({ title: "", message: "", link: "", type: "system", audience: "admin" });
      await loadNotifications();
    } catch (err) {
      console.error("Gagal membuat notifikasi:", err);
      toast.error(err.message || "Gagal membuat notifikasi.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (onUnreadCountChange) {
      const unreadCount = notifications.filter((n) => !n.isRead).length;
      onUnreadCountChange(unreadCount);
    }
  }, [notifications, onUnreadCountChange]);

  const filteredNotifications = useMemo(() => {
    if (filter === "all") return notifications;
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className={styles.workspaceInner}>
      <div className={`card ${styles.cardHeader}`}>
        <div className={styles.headerTopRow}>
          <div>
            <h3 className={styles.headerTitle}>
              {config.header.title}
              {unreadCount > 0 && (
                <span className={styles.unreadBadge}>{unreadCount}</span>
              )}
            </h3>
            <p className={styles.headerSubtitle}>{config.header.subtitle}</p>
          </div>
          <div className={styles.headerActions}>
            <button onClick={markAllRead} className={styles.markReadBtn}>
              {config.buttons.markAllRead}
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className={styles.createBtn}
            >
              + {config.buttons.create}
            </button>
          </div>
        </div>

        <div className={styles.filterGroup}>
          {Object.entries(config.tabs).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`${styles.filterBtn} ${
                filter === key ? styles.filterBtnActive : ""
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.notificationsList}>
        {loading ? (
          <NotificationsSkeleton count={5} />
        ) : filteredNotifications.length === 0 ? (
          <div className={`card ${styles.centerStateCard}`}>
            <div className={styles.emptyIcon}>🔔</div>
            <p className={styles.emptyTitle}>{config.emptyTitle}</p>
            <p className={styles.emptyText}>{config.emptyText}</p>
          </div>
        ) : (
          filteredNotifications.map((notification) => {
            const isUnread = !notification.isRead;
            return (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`${styles.notificationItem} ${
                  isUnread ? styles.notificationUnread : ""
                } ${notification.link ? styles.clickable : ""}`}
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
                      {config.typeLabels[notification.type] ||
                        notification.type}
                    </span>
                    <span className={styles.audienceBadge}>
                      {notification.audience || "user"}
                    </span>
                    <span className={styles.timeAgo}>
                      {timeAgo(notification.createdAt)}
                    </span>
                    {notification.link && (
                      <span className={styles.linkIndicator}>Lihat Detail &rarr;</span>
                    )}
                  </div>
                </div>
                <button
                  className={styles.deleteBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notification);
                  }}
                  aria-label="Hapus notifikasi"
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Create Notification Modal */}
      {isCreateOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsCreateOpen(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {config.modal.createTitle}
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className={styles.modalCloseBtn}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreate} className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  {config.modal.titleLabel}
                </label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder={config.modal.titlePlaceholder}
                  value={createForm.title}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, title: e.target.value })
                  }
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  {config.modal.messageLabel}
                </label>
                <textarea
                  className={styles.formTextarea}
                  rows={3}
                  placeholder={config.modal.messagePlaceholder}
                  value={createForm.message}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, message: e.target.value })
                  }
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  {config.modal.linkLabel}
                </label>
                <select
                  className={styles.formSelect}
                  value={createForm.link}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, link: e.target.value })
                  }
                >
                  {config.modal.linkOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.inputLabel}>
                    {config.modal.typeLabel}
                  </label>
                  <select
                    className={styles.formSelect}
                    value={createForm.type}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, type: e.target.value })
                    }
                  >
                    {config.modal.typeOptions.map((option) => (
                      <option key={option} value={option}>
                        {config.typeLabels[option] || option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.inputLabel}>
                    {config.modal.audienceLabel}
                  </label>
                  <select
                    className={styles.formSelect}
                    value={createForm.audience}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, audience: e.target.value })
                    }
                  >
                    {config.modal.audienceOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className={styles.cancelBtn}
                >
                  {config.modal.cancel}
                </button>
                <button type="submit" className={styles.submitBtn} disabled={submitting}>
                  {submitting ? 'Menyimpan...' : config.modal.submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
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