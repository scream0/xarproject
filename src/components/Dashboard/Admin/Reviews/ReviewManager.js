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

  const fetchReviews = async (session) => {
    try {
      setLoading(true);
      const token = session?.access_token;
      if (!token) throw new Error(reviewConfig.toasts.authRequired);

      const res = await fetch("/api/reviews", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || reviewConfig.toasts.fetchError);
      }

      const result = await res.json();
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
        const { data } = clientAuth.onAuthStateChange((_event, session) => {
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

  const handleApprove = async (reviewId) => {
    setUpdatingId(reviewId);
    try {
      const session = await getSupabaseSession();
      const token = session?.access_token;
      if (!token) throw new Error(reviewConfig.toasts.authRequired);

      const res = await fetch("/api/reviews", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reviewId, approved: true }),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || reviewConfig.toasts.approveError);
      }

      toast.success(reviewConfig.toasts.approveSuccess);
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, approved: true } : r)),
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteClick = (reviewId) => {
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

      const res = await fetch("/api/reviews", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reviewId }),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || reviewConfig.toasts.deleteError);
      }

      toast.success(reviewConfig.toasts.deleteSuccess);
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
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

  return (
    <div className={styles.reviewManagerContainer}>
      <h2 className={styles.sectionTitle}>{reviewConfig.title}</h2>

      <div className={styles.filterControls}>
        <button
          onClick={() => setFilter("all")}
          className={filter === "all" ? styles.activeFilter : ""}
        >
          {reviewConfig.filters.all}
        </button>
        <button
          onClick={() => setFilter("pending")}
          className={filter === "pending" ? styles.activeFilter : ""}
        >
          {reviewConfig.filters.pending}
        </button>
        <button
          onClick={() => setFilter("approved")}
          className={filter === "approved" ? styles.activeFilter : ""}
        >
          {reviewConfig.filters.approved}
        </button>
      </div>

      {loading ? (
        <p className={styles.stateText}>{reviewConfig.states.loading}</p>
      ) : filteredReviews.length === 0 ? (
        <p className={styles.stateText}>{reviewConfig.states.empty}</p>
      ) : (
        <div className={styles.tableResponsive}>
          <table className={styles.reviewsTable}>
            <thead>
              <tr>
                {reviewConfig.tableHeaders.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredReviews.map((review) => (
                <tr key={review.id}>
                  <td>{review.productName}</td>
                  <td>{review.userName}</td>
                  <td>{"⭐".repeat(review.rating)}</td>
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
                    {!review.approved && (
                      <button
                        onClick={() => handleApprove(review.id)}
                        disabled={updatingId === review.id}
                        className={styles.approveBtn}
                      >
                        {updatingId === review.id
                          ? reviewConfig.buttons.loading
                          : reviewConfig.buttons.approve}
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
              ))}
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