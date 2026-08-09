"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { auth, supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import styles from "./NotificationCenter.module.css";
import config from "@/data/ui/notificationCenterConfig.json";
import { NotificationsSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";

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

const TYPE_ICON = {
  order: "📦",
  payment: "💳",
  promo: "🎁",
  system: "🔔",
  stock: "📉",
};

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    message: "",
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
      
      const res = await fetch("/api/notifications?scope=system", {
        headers,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal memuat notifikasi.");
      setNotifications(result.notifications || []);
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
      if (session) {
        await loadNotifications();
      }
    });

    return () => {
      subscription?.unsubscribe();
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
      toast.success(config.toasts.markAllReadSuccess);
    } catch (err) {
      console.error("Gagal tandai semua dibaca:", err);
      toast.error(err.message || "Gagal memperbarui notifikasi.");
    }
  };

  const deleteNotification = async (notification) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus notifikasi ini?")) {
      return;
    }
    try {
      const token = await getSupabaseToken();
      if (!token) {
        toast.error("Sesi Anda telah berakhir. Silakan muat ulang.");
        return;
      }

      const res = await fetch(
        `/api/notifications?id=${notification.id}`,
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
    const { title, message, type, audience } = createForm;
    if (!title || !message) {
      toast.error("Judul dan pesan wajib diisi.");
      return;
    }
    try {
      setSubmitting(true);
      const token = await getSupabaseToken();
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, message, type, audience }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal membuat notifikasi.");
      toast.success(config.toasts.createSuccess);
      setIsCreateOpen(false);
      setCreateForm({
        title: "",
        message: "",
        type: "system",
        audience: "admin",
      });
      await loadNotifications();
    } catch (err) {
      console.error("Gagal membuat notifikasi:", err);
      toast.error(err.message || "Gagal membuat notifikasi.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredNotifications = useMemo(() => {
    if (filter === "all") return notifications;
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className={styles.workspaceInner}>
      {/* Header */}
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

      {/* Notification List */}
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
                className={`${styles.notificationItem} ${
                  isUnread ? styles.notificationUnread : ""
                }`}
              >
                <div
                  className={`${styles.notificationIcon} ${
                    styles[`type_${notification.type}`] || ""
                  }`}
                >
                  {TYPE_ICON[notification.type] || "🔔"}
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
                  </div>
                </div>
                <button
                  className={styles.deleteBtn}
                  onClick={() => deleteNotification(notification)}
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
    </div>
  );
}