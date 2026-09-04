// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import styles from "./ReviewManager.module.css";
import { supabase, auth } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import reviewConfig from "@/data/ui/reviewManagerConfig.json";

// Helper aman untuk mendeteksi berbagai struktur ekspor Supabase klien/auth
const getSupabaseSession = async () => {
  try {
    if (supabase?.auth?.getSession) {
      const res = await supabase.auth.getSession();
      return res?.data?.session || null;
    }
    if (auth?.getSession) {
      const res = await auth.getSession();
      return res?.data?.session || null;
    }
    if (supabase?.getSession) {
      const res = await supabase.getSession();
      return res?.data?.session || null;
    }
    return null;
  } catch (err) {
    console.error("Gagal mengambil sesi:", err);
    return null;
  }
};

const getSupabaseAuthInstance = () => {
  if (supabase?.auth) return supabase.auth;
  if (auth?.onAuthStateChange) return auth;
  return supabase;
};

export default function ReviewManager() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);
  const [deleteReviewId, setDeleteReviewId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const fetchReviews = async (session: any) => {
    try {
      setLoading(true);
      const token = session?.access_token;
      if (!token) throw new Error(reviewConfig.toasts.authRequired);

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/reviews?all=true&limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const result = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
        throw new Error(result.error || reviewConfig.toasts.fetchError);
      }

      const result = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      setReviews(result.reviews || []);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      toast.error(error.message);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let subscription = null;

    const initAuth = async () => {
      const session = await getSupabaseSession();
      
      if (session) {
        await fetchReviews(session);
      } else {
        setLoading(false);
      }

      const clientAuth = getSupabaseAuthInstance();
      if (clientAuth?.onAuthStateChange) {
        const { data } = clientAuth.onAuthStateChange((_event, session: any) => {
          if (session) {
            fetchReviews(session);
          } else {
            setReviews([]);
            setLoading(false);
          }
        });
        subscription = data?.subscription;
      }
    };

    initAuth();

    return () => {
      if (subscription?.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const handleToggleApprove = async (reviewId: any, newStatus: any) => {
    setUpdatingId(reviewId);
    try {
      const session = await getSupabaseSession();
      const token = session?.access_token;
      if (!token) throw new Error(reviewConfig.toasts.authRequired);

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/reviews", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reviewId, approved: newStatus }),
      });

      if (!res.ok) {
        const result = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
        throw new Error(result.error || (newStatus ? reviewConfig.toasts.approveError : "Gagal membatalkan persetujuan"));
      }

      toast.success(newStatus ? reviewConfig.toasts.approveSuccess : "Status ulasan diubah menjadi pending.");
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, approved: newStatus } : r)),
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleBulkApprove = async (newStatus: any) => {
    if (selectedIds.length === 0) return;
    setIsBulkProcessing(true);
    const toastId = toast.loading(newStatus ? "Menyetujui ulasan terpilih..." : "Membatalkan persetujuan...");

    try {
      const session = await getSupabaseSession();
      const token = session?.access_token;
      if (!token) throw new Error(reviewConfig.toasts.authRequired);

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/reviews", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reviewIds: selectedIds, approved: newStatus }),
      });

      if (!res.ok) {
        const result = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
        throw new Error(result.error || "Gagal memproses ulasan massal");
      }

      toast.success(newStatus ? `${selectedIds.length} ulasan berhasil disetujui!` : `${selectedIds.length} ulasan dijadikan pending.`, { id: toastId });
      setReviews((prev) =>
        prev.map((r) => (selectedIds.includes(r.id) ? { ...r, approved: newStatus } : r)),
      );
      setSelectedIds([]);
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.length} ulasan terpilih secara permanen?`)) {
      return;
    }

    setIsBulkProcessing(true);
    const toastId = toast.loading("Menghapus ulasan terpilih...");

    try {
      const session = await getSupabaseSession();
      const token = session?.access_token;
      if (!token) throw new Error(reviewConfig.toasts.authRequired);

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/reviews", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reviewIds: selectedIds }),
      });

      if (!res.ok) {
        const result = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
        throw new Error(result.error || "Gagal menghapus ulasan massal");
      }

      toast.success(`${selectedIds.length} ulasan berhasil dihapus.`, { id: toastId });
      setReviews((prev) => prev.filter((r) => !selectedIds.includes(r.id)));
      setSelectedIds([]);
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleDeleteClick = (reviewId: any) => {
    setDeleteReviewId(reviewId);
  };

  const confirmDelete = async () => {
    if (!deleteReviewId) return;
    const reviewId = deleteReviewId;
    setUpdatingId(reviewId);
    setDeleteReviewId(null);
    try {
      const session = await getSupabaseSession();
      const token = session?.access_token;
      if (!token) throw new Error(reviewConfig.toasts.authRequired);

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/reviews", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reviewId }),
      });

      if (!res.ok) {
        const result = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
        throw new Error(result.error || reviewConfig.toasts.deleteError);
      }

      toast.success(reviewConfig.toasts.deleteSuccess);
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      setSelectedIds((prev) => prev.filter((id) => id !== reviewId));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredReviews = reviews.filter((review) => {
    if (filter === "all") return true;
    if (filter === "pending") return !review.approved;
    if (filter === "approved") return review.approved;
    return true;
  });

  const isAllFilteredSelected =
    filteredReviews.length > 0 &&
    filteredReviews.every((r) => selectedIds.includes(r.id));

  const toggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredReviews.map((r) => r.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const newIds = new Set([...selectedIds, ...filteredReviews.map((r) => r.id)]);
      setSelectedIds(Array.from(newIds));
    }
  };

  const toggleSelectRow = (reviewId: any) => {
    setSelectedIds((prev) =>
      prev.includes(reviewId)
        ? prev.filter((id) => id !== reviewId)
        : [...prev, reviewId],
    );
  };

  return (
    <div className={styles.reviewManagerContainer}>
      <h2 className={styles.sectionTitle}>{reviewConfig.title}</h2>

      <div className={styles.filterControls}>
        <button
          onClick={() => setFilter("all")}
          className={filter === "all" ? styles.activeFilter : ""}
        >
          {reviewConfig.filters.all} ({reviews.length})
        </button>
        <button
          onClick={() => setFilter("pending")}
          className={filter === "pending" ? styles.activeFilter : ""}
        >
          {reviewConfig.filters.pending} ({reviews.filter((r) => !r.approved).length})
        </button>
        <button
          onClick={() => setFilter("approved")}
          className={filter === "approved" ? styles.activeFilter : ""}
        >
          {reviewConfig.filters.approved} ({reviews.filter((r) => r.approved).length})
        </button>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className={styles.bulkToolbar}>
          <div className={styles.bulkInfo}>
            <span>✓ {selectedIds.length} ulasan dipilih</span>
          </div>
          <div className={styles.bulkActions}>
            <button
              onClick={() => handleBulkApprove(true)}
              disabled={isBulkProcessing}
              className={styles.bulkApproveBtn}
            >
              ✓ Setujui Terpilih
            </button>
            <button
              onClick={() => handleBulkApprove(false)}
              disabled={isBulkProcessing}
              className={styles.bulkRejectBtn}
            >
              ⏳ Jadikan Pending
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isBulkProcessing}
              className={styles.bulkDeleteBtn}
            >
              🗑️ Hapus Terpilih
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className={styles.cancelBtn}
              style={{ padding: "6px 12px", fontSize: "0.75rem" }}
            >
              Batal Pilih
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className={styles.stateText}>{reviewConfig.states.loading}</p>
      ) : filteredReviews.length === 0 ? (
        <p className={styles.stateText}>{reviewConfig.states.empty}</p>
      ) : (
        <div className={styles.tableResponsive}>
          <table className={styles.reviewsTable}>
            <thead>
              <tr>
                <th style={{ width: "40px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={isAllFilteredSelected}
                    onChange={toggleSelectAll}
                    className={styles.checkboxInput}
                    title="Pilih Semua"
                  />
                </th>
                {reviewConfig.tableHeaders.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredReviews.map((review) => {
                const isSelected = selectedIds.includes(review.id);
                return (
                  <tr
                    key={review.id}
                    style={{
                      backgroundColor: isSelected
                        ? "rgba(var(--primary-accent-rgb), 0.08)"
                        : "transparent",
                    }}
                  >
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(review.id)}
                        className={styles.checkboxInput}
                      />
                    </td>
                    <td>{review.productName || "-"}</td>
                    <td>{review.userName || "Pelanggan"}</td>
                    <td>{"⭐".repeat(review.rating || 5)}</td>
                    <td className={styles.commentCell}>
                      <p>{review.comment}</p>
                      {review.reviewPhoto && (
                        <div style={{ marginTop: "6px" }}>
                          <a
                            href={review.reviewPhoto}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "0.75rem",
                              color: "var(--primary-accent)",
                              textDecoration: "underline",
                              fontWeight: 600,
                            }}
                          >
                            📷 Lihat Foto Produk
                          </a>
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          review.approved
                            ? styles.approvedBadge
                            : styles.pendingBadge
                        }
                      >
                        {review.approved
                          ? reviewConfig.statusLabels.approved
                          : reviewConfig.statusLabels.pending}
                      </span>
                    </td>
                    <td className={styles.actionCell}>
                      {!review.approved ? (
                        <button
                          onClick={() => handleToggleApprove(review.id, true)}
                          disabled={updatingId === review.id}
                          className={styles.approveBtn}
                        >
                          {updatingId === review.id
                            ? reviewConfig.buttons.loading
                            : reviewConfig.buttons.approve}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleApprove(review.id, false)}
                          disabled={updatingId === review.id}
                          className={styles.unapproveBtn}
                          title="Ubah kembali menjadi pending"
                        >
                          {updatingId === review.id ? "Memproses..." : "Batal Setujui"}
                        </button>
                      )}
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDeleteClick(review.id)}
                        disabled={updatingId === review.id}
                      >
                        {updatingId === review.id
                          ? reviewConfig.buttons.processing
                          : reviewConfig.buttons.delete}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {deleteReviewId && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalHeader}>Konfirmasi Hapus</h3>
            <p className={styles.modalBody}>{reviewConfig.confirmations.deletePrompt}</p>
            <div className={styles.modalFooter}>
              <button 
                className={styles.cancelBtn} 
                onClick={() => setDeleteReviewId(null)}
                disabled={updatingId === deleteReviewId}
              >
                Batal
              </button>
              <button 
                className={styles.confirmBtn} 
                onClick={confirmDelete}
                disabled={updatingId === deleteReviewId}
              >
                {updatingId === deleteReviewId ? "Menghapus..." : "Hapus Ulasan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}