import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { auth } from "@/lib/supabaseClient";
import styles from './OrdersManagement.module.css';

const money = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [promptModal, setPromptModal] = useState({ isOpen: false, id: null, action: null, message: '', note: '' });

  const getSupabaseToken = async () => {
    const { data: { session } } = await auth.getSession();
    return session?.access_token || null;
  };

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/admin/withdrawals", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(data.error || 'Failed to fetch withdrawals');
      setWithdrawals(data.withdrawals || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const openPrompt = (id, action) => {
    setPromptModal({
      isOpen: true,
      id,
      action,
      message: action === 'reject' ? "Masukkan alasan penolakan penarikan:" : "Catatan untuk user (opsional) - Misal: Referensi transfer:",
      note: action === 'approve' ? "Dana berhasil ditransfer" : ""
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
    const toastId = toast.loading(`Processing withdrawal...`);
    try {
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/admin/withdrawals/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : undefined
        },
        body: JSON.stringify({ action, description: note }), 
      });
      const data = (res.headers?.get("content-type")?.includes("application/json") ? await res.json() : {});
      if (!res.ok) throw new Error(data.error || 'Failed to process withdrawal');
      
      toast.success(`Withdrawal ${action === 'approve' ? 'approved' : 'rejected'} successfully`, { id: toastId });
      fetchWithdrawals();
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className={styles.tabContent}>
      <h3>Penarikan Dana (Withdrawals)</h3>
      {loading ? (
        <p>Memuat data penarikan...</p>
      ) : withdrawals.length === 0 ? (
        <p>Belum ada pengajuan penarikan dana.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>User / Rekening</th>
                <th>Nominal</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => (
                <tr key={w.id}>
                  <td>{new Date(w.created_at).toLocaleString('id-ID')}</td>
                  <td>
                    <div><b>{w.profiles?.full_name || w.profiles?.username || 'User'}</b></div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {w.profiles?.bank_name} - {w.profiles?.bank_account_number} <br/>
                      (A/N: {w.profiles?.bank_account_name})
                    </div>
                  </td>
                  <td style={{ fontWeight: 'bold' }}>{money(w.amount)}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles[w.status] || ''}`}>
                      {w.status}
                    </span>
                  </td>
                  <td>
                    {w.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className={styles.actionBtnPrimary} 
                          onClick={() => openPrompt(w.id, 'approve')}
                          disabled={processingId === w.id}
                        >
                          Approve
                        </button>
                        <button 
                          className={styles.actionBtnDanger} 
                          onClick={() => openPrompt(w.id, 'reject')}
                          disabled={processingId === w.id}
                        >
                          Reject
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
            <h4>Konfirmasi Penarikan</h4>
            <p style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>{promptModal.message}</p>
            <textarea 
              className={styles.modalInput}
              value={promptModal.note}
              onChange={(e) => setPromptModal({ ...promptModal, note: e.target.value })}
              placeholder="Tulis catatan di sini..."
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
