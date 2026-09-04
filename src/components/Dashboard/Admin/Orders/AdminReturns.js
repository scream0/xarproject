import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { auth } from "@/lib/supabaseClient";
import styles from './OrdersManagement.module.css';

export default function AdminReturns() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [promptModal, setPromptModal] = useState({ isOpen: false, id: null, action: null, message: '', note: '' });

  const getSupabaseToken = async () => {
    const { data: { session } } = await auth.getSession();
    return session?.access_token || null;
  };

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/returns", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(data.error || 'Failed to fetch return requests');
      setReturns(data.returns || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, []);

  const openPrompt = (id, action) => {
    setPromptModal({
      isOpen: true,
      id,
      action,
      message: action === 'reject' ? "Masukkan alasan penolakan:" : "Menyetujui retur ini akan otomatis memindahkan dana pesanan ke daftar antrean Pencairan Dana (Withdrawals). Masukkan catatan persetujuan (opsional):",
      note: action === 'approve' ? "Telah disetujui admin" : ""
    });
  };

  const closePrompt = () => {
    setPromptModal({ isOpen: false, id: null, action: null, message: '', note: '' });
  };

  const handleAction = async () => {
    const { id, action, note } = promptModal;
    if (!id || !action) return;
    
    if (action === 'reject' && !note.trim()) {
      toast.error("Alasan penolakan harus diisi");
      return;
    }

    closePrompt();
    setProcessingId(id);
    const toastId = toast.loading(`Processing return...`);
    try {
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/returns/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : undefined
        },
        body: JSON.stringify({ action, admin_note: note }), 
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(data.error || 'Failed to process return');
      
      toast.success(`Return request ${action === 'approve' ? 'approved' : 'rejected'} successfully`, { id: toastId });
      fetchReturns();
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className={styles.tabContent}>
      <h3>Pengembalian Dana & Barang (Refund / Return)</h3>
      {loading ? (
        <p>Memuat data pengembalian...</p>
      ) : returns.length === 0 ? (
        <p>Belum ada pengajuan pengembalian.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Order ID</th>
                <th>User</th>
                <th>Alasan</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id}>
                  <td>{r.createdAt ? new Date(r.createdAt).toLocaleString('id-ID') : '-'}</td>
                  <td>{r.orderId || r.order_id}</td>
                  <td>
                    {r.username || r.email?.split('@')[0] || 'User'} <br/>
                    <small>{r.email}</small>
                  </td>
                  <td>
                    <b>{r.reason}</b>
                    {r.notes && <div><small>{r.notes}</small></div>}
                    {r.evidence && (
                      <div style={{ marginTop: '4px' }}>
                        <a href={r.evidence} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', fontSize: '0.85rem', textDecoration: 'underline' }}>
                          Lihat Bukti Foto
                        </a>
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles[r.status] || ''}`}>
                      {r.status}
                    </span>
                    {(r.bankName || r.bankNumber) && (
                      <div style={{ marginTop: '8px', fontSize: '0.8rem', padding: '6px', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
                        <strong>Bank:</strong> {r.bankName} <br/>
                        <strong>No:</strong> {r.bankNumber} <br/>
                        <strong>A/N:</strong> {r.bankHolder}
                      </div>
                    )}
                  </td>
                  <td>
                    {['requested', 'pending', 'return_requested'].includes(r.status) && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className={styles.actionBtnPrimary} 
                          onClick={() => openPrompt(r.id, 'approve')}
                          disabled={processingId === r.id}
                        >
                          Setujui & Refund
                        </button>
                        <button 
                          className={styles.actionBtnDanger} 
                          onClick={() => openPrompt(r.id, 'reject')}
                          disabled={processingId === r.id}
                        >
                          Tolak
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {promptModal.isOpen && (
        <div className={styles.modalOverlay} onClick={closePrompt}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h4>Konfirmasi</h4>
            <p style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>{promptModal.message}</p>
            <textarea 
              className={styles.modalInput}
              value={promptModal.note}
              onChange={(e) => setPromptModal({ ...promptModal, note: e.target.value })}
              placeholder="Tulis pesan Anda di sini..."
              autoFocus
            />
            <div className={styles.modalActions}>
              <button className={styles.modalCancelBtn} onClick={closePrompt}>Batal</button>
              <button 
                className={promptModal.action === 'approve' ? styles.actionBtnPrimary : styles.actionBtnDanger}
                onClick={handleAction}
              >
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
