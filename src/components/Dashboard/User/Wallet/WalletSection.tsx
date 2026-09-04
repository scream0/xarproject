// @ts-nocheck
import React, { useState, useEffect } from 'react';
import styles from './WalletSection.module.css';
import toast from 'react-hot-toast';
import { AppIcon } from '@/components/UI/Icon/AppIcon';
import { auth } from '@/lib/supabaseClient';

export default function WalletSection({ profile }) {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const getSupabaseToken = async () => {
    const { data: { session } } = await auth.getSession();
    return session?.access_token;
  };

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/wallet", {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBalance(data.balance);
        setTransactions(data.transactions || []);
      } else {
        throw new Error(data.error || 'Gagal memuat wallet');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const handleWithdraw = async (e: any) => {
    e.preventDefault();
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) {
      toast.error('Masukkan nominal yang valid');
      return;
    }
    if (amount > balance) {
      toast.error('Saldo tidak mencukupi');
      return;
    }
    if (!profile?.bankName || !profile?.bankAccountNumber || !profile?.bankAccountName) {
      toast.error('Lengkapi info rekening bank di Pengaturan Profil terlebih dahulu');
      return;
    }

    setWithdrawLoading(true);
    const toastId = toast.loading('Memproses pengajuan penarikan...');
    try {
      const token = await getSupabaseToken();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/wallet/withdraw", {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : undefined
        },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengajukan penarikan');
      
      toast.success('Pengajuan penarikan berhasil!', { id: toastId });
      setIsWithdrawModalOpen(false);
      setWithdrawAmount('');
      fetchWallet(); // Refresh data
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setWithdrawLoading(false);
    }
  };

  const getStatusColor = (status: any) => {
    switch (status) {
      case 'completed': return 'var(--success-color, #10b981)';
      case 'pending': return 'var(--warning-color, #f59e0b)';
      case 'failed':
      case 'rejected': return 'var(--error-color, #ef4444)';
      default: return 'var(--text-secondary, #6b7280)';
    }
  };

  const getStatusText = (status: any) => {
    switch (status) {
      case 'completed': return 'Berhasil';
      case 'pending': return 'Diproses';
      case 'failed': return 'Gagal';
      case 'rejected': return 'Ditolak';
      default: return status;
    }
  };

  return (
    <div className={styles.walletContainer}>
      <div className={styles.balanceCard}>
        <div className={styles.balanceHeader}>
          <AppIcon name="wallet" size={24} className={styles.walletIcon} />
          <span>Saldo Anda</span>
        </div>
        <div className={styles.balanceAmount}>
          {loading ? '...' : `Rp ${balance.toLocaleString('id-ID')}`}
        </div>
        <button 
          className={styles.withdrawBtn} 
          onClick={() => setIsWithdrawModalOpen(true)}
          disabled={loading || balance <= 0}
        >
          Tarik Dana
        </button>
      </div>

      <div className={styles.transactionsSection}>
        <h3 className={styles.transactionsTitle}>Riwayat Transaksi</h3>
        {loading ? (
          <p className={styles.emptyState}>Memuat riwayat...</p>
        ) : transactions.length === 0 ? (
          <div className={styles.emptyState}>
            <AppIcon name="file-text" size={40} className={styles.emptyIcon} />
            <p>Belum ada riwayat transaksi.</p>
          </div>
        ) : (
          <div className={styles.transactionsList}>
            {transactions.map((trx) => (
              <div key={trx.id} className={styles.transactionItem}>
                <div className={styles.transactionLeft}>
                  <div className={styles.transactionIconWrapper} data-type={trx.type}>
                    <AppIcon name={trx.type === 'refund' ? 'corner-down-left' : 'arrow-up-right'} size={18} />
                  </div>
                  <div className={styles.transactionInfo}>
                    <span className={styles.transactionType}>
                      {trx.type === 'refund' ? 'Pengembalian Dana (Refund)' : 'Penarikan Dana'}
                    </span>
                    <span className={styles.transactionDate}>
                      {new Date(trx.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                    {trx.description && (
                      <span className={styles.transactionDesc}>{trx.description}</span>
                    )}
                  </div>
                </div>
                <div className={styles.transactionRight}>
                  <span 
                    className={styles.transactionAmount} 
                    data-type={trx.type}
                  >
                    {trx.type === 'refund' ? '+' : '-'} Rp {parseFloat(trx.amount).toLocaleString('id-ID')}
                  </span>
                  <span 
                    className={styles.transactionStatus} 
                    style={{ backgroundColor: `${getStatusColor(trx.status)}20`, color: getStatusColor(trx.status) }}
                  >
                    {getStatusText(trx.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isWithdrawModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsWithdrawModalOpen(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Penarikan Dana</h3>
              <button className={styles.closeBtn} onClick={() => setIsWithdrawModalOpen(false)}>✕</button>
            </div>
            
            {!profile?.bankName || !profile?.bankAccountNumber || !profile?.bankAccountName ? (
              <div className={styles.warningBox}>
                <AppIcon name="alert-triangle" size={20} />
                <p>Silakan lengkapi informasi Rekening Bank di menu Pengaturan Akun terlebih dahulu sebelum melakukan penarikan dana.</p>
              </div>
            ) : (
              <form onSubmit={handleWithdraw}>
                <div className={styles.bankInfoPreview}>
                  <div className={styles.bankInfoItem}>
                    <span className={styles.bankInfoLabel}>Bank:</span>
                    <span className={styles.bankInfoValue}>{profile.bankName}</span>
                  </div>
                  <div className={styles.bankInfoItem}>
                    <span className={styles.bankInfoLabel}>Rekening:</span>
                    <span className={styles.bankInfoValue}>{profile.bankAccountNumber}</span>
                  </div>
                  <div className={styles.bankInfoItem}>
                    <span className={styles.bankInfoLabel}>Atas Nama:</span>
                    <span className={styles.bankInfoValue}>{profile.bankAccountName}</span>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Nominal Penarikan (Rp)</label>
                  <input 
                    type="number" 
                    value={withdrawAmount} 
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    max={balance}
                    placeholder="Masukkan nominal"
                    required
                  />
                  <small>Saldo tersedia: Rp {balance.toLocaleString('id-ID')}</small>
                </div>

                <div className={styles.modalFooter}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setIsWithdrawModalOpen(false)}>Batal</button>
                  <button type="submit" className={styles.submitBtn} disabled={withdrawLoading}>
                    {withdrawLoading ? 'Memproses...' : 'Tarik Dana'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
