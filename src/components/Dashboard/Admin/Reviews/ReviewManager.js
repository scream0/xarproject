"use client";
import { useState, useEffect } from "react";
import styles from "./ReviewManager.module.css";
import { auth } from "@/lib/firebaseClient";
import toast from "react-hot-toast";

export default function ReviewManager() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // 'all', 'pending', 'approved'
  const [updatingId, setUpdatingId] = useState(null);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Admin not authenticated.");
      
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/reviews", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Gagal memuat ulasan.");
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
    fetchReviews();
  }, []);
  
  const handleApprove = async (reviewId) => {
    setUpdatingId(reviewId);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Admin not authenticated.");
      const token = await currentUser.getIdToken();

      const res = await fetch('/api/reviews', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reviewId, approved: true }),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Gagal menyetujui ulasan.');
      }
      
      toast.success("Ulasan berhasil disetujui!");
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, approved: true } : r));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (reviewId) => {
    if (!confirm("Apakah Anda yakin ingin menghapus ulasan ini? Tindakan ini tidak bisa dibatalkan.")) {
      return;
    }
    setUpdatingId(reviewId);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Admin not authenticated.");
      const token = await currentUser.getIdToken();

      const res = await fetch('/api/reviews', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reviewId }),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Gagal menghapus ulasan.');
      }
      
      toast.success("Ulasan berhasil dihapus.");
      setReviews(prev => prev.filter(r => r.id !== reviewId));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredReviews = reviews.filter(review => {
    if (filter === 'all') return true;
    if (filter === 'pending') return !review.approved;
    if (filter === 'approved') return review.approved;
    return true;
  });

  return (
    <div className={styles.reviewManagerContainer}>
      <h2 className={styles.sectionTitle}>Manajemen Ulasan Produk</h2>
      
      <div className={styles.filterControls}>
        <button onClick={() => setFilter('all')} className={filter === 'all' ? styles.activeFilter : ''}>Semua</button>
        <button onClick={() => setFilter('pending')} className={filter === 'pending' ? styles.activeFilter : ''}>Pending</button>
        <button onClick={() => setFilter('approved')} className={filter === 'approved' ? styles.activeFilter : ''}>Disetujui</button>
      </div>

      {loading ? (
        <p>Memuat ulasan...</p>
      ) : filteredReviews.length === 0 ? (
        <p>Tidak ada ulasan untuk ditampilkan.</p>
      ) : (
        <div className={styles.tableResponsive}>
          <table className={styles.reviewsTable}>
            <thead>
              <tr>
                <th>Produk</th>
                <th>Pengguna</th>
                <th>Rating</th>
                <th>Komentar</th>
                <th>Status</th>
                <th>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {filteredReviews.map((review) => (
                <tr key={review.id}>
                  <td>{review.productName}</td>
                  <td>{review.userName}</td>
                  <td>{'⭐'.repeat(review.rating)}</td>
                  <td className={styles.commentCell}>{review.comment}</td>
                  <td>
                    <span className={review.approved ? styles.approvedBadge : styles.pendingBadge}>
                      {review.approved ? 'Disetujui' : 'Pending'}
                    </span>
                  </td>
                  <td className={styles.actionCell}>
                    {!review.approved && (
                      <button 
                        onClick={() => handleApprove(review.id)}
                        disabled={updatingId === review.id}
                        className={styles.approveBtn}
                      >
                        {updatingId === review.id ? '...' : 'Setujui'}
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(review.id)}
                      disabled={updatingId === review.id}
                      className={styles.deleteBtn}
                    >
                      {updatingId === review.id ? '...' : 'Hapus'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
