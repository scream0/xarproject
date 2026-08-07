"use client";
import { useState } from "react";
import styles from "./UserSettings.module.css";
import { AppIcon } from "@/components/UI/Icon/AppIcon";

export default function UserSettings({
  addresses,
  deletingAccount,
  onBackToProfile,
  onOpenProfileModal,
  onOpenManageAddressModal,
  onOpenPasswordModal,
  onOpenLogoutModal,
  onDeleteAccount,
}) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  return (
    <div className={styles.settingsContainer}>
      {/* Header Pengaturan dengan Tombol Kembali */}
      <div className={styles.settingsHeader}>
        <button onClick={onBackToProfile} className={styles.backBtn}>
          <AppIcon name="arrow-left" size={16} />
          <span>Kembali ke Profil</span>
        </button>
        <div className={styles.headerTitleWrapper}>
          <h3 className={styles.settingsTitle}>Pengaturan Akun</h3>
          <p className={styles.settingsSubtitle}>Kelola informasi pribadi, buku alamat, dan keamanan akun Anda</p>
        </div>
      </div>

      <div className={styles.settingsSectionsWrapper}>
        {/* GRUP 1: INFORMASI AKUN & PENGIRIMAN */}
        <div className={styles.sectionGroup}>
          <h4 className={styles.groupLabel}>Informasi & Buku Alamat</h4>
          <div className={styles.settingsGrid}>
            
            {/* Menu 1: Edit Profil */}
            <div className={styles.settingItem} onClick={onOpenProfileModal} role="button" tabIndex={0}>
              <div className={styles.settingLeft}>
                <div className={styles.iconBox}>
                  <AppIcon name="user" size={20} />
                </div>
                <div className={styles.settingInfo}>
                  <h4>Edit Informasi Profil</h4>
                  <p>Perbarui nama, username, nomor telepon, tanggal lahir & avatar.</p>
                </div>
              </div>
              <div className={styles.settingRight}>
                <span className={styles.actionText}>Ubah</span>
                <span className={styles.chevronIcon}>›</span>
              </div>
            </div>

            {/* Menu 2: Kelola Alamat */}
            <div className={styles.settingItem} onClick={onOpenManageAddressModal} role="button" tabIndex={0}>
              <div className={styles.settingLeft}>
                <div className={styles.iconBox}>
                  <AppIcon name="map-pin" size={20} />
                </div>
                <div className={styles.settingInfo}>
                  <h4>
                    Buku Alamat Pengiriman{" "}
                    <span className={styles.addressCountBadge}>
                      ({addresses.length}/3 Alamat)
                    </span>
                  </h4>
                  <p>Atur alamat utama dan lokasi pengiriman pesanan Anda.</p>
                </div>
              </div>
              <div className={styles.settingRight}>
                <span className={styles.actionText}>Kelola</span>
                <span className={styles.chevronIcon}>›</span>
              </div>
            </div>

          </div>
        </div>

        {/* GRUP 2: KEAMANAN */}
        <div className={styles.sectionGroup}>
          <h4 className={styles.groupLabel}>Keamanan Akun</h4>
          <div className={styles.settingsGrid}>
            
            {/* Menu 3: Ganti Password */}
            <div className={styles.settingItem} onClick={onOpenPasswordModal} role="button" tabIndex={0}>
              <div className={styles.settingLeft}>
                <div className={styles.iconBox}>
                  <AppIcon name="settings" size={20} />
                </div>
                <div className={styles.settingInfo}>
                  <h4>Keamanan & Sandi</h4>
                  <p>Perbarui kata sandi akun secara berkala untuk perlindungan optimal.</p>
                </div>
              </div>
              <div className={styles.settingRight}>
                <span className={styles.actionText}>Perbarui</span>
                <span className={styles.chevronIcon}>›</span>
              </div>
            </div>

          </div>
        </div>

        {/* GRUP 3: ZONA BAHAYA / SESI */}
        <div className={styles.sectionGroup}>
          <h4 className={styles.groupLabel} style={{ color: "var(--danger-color, #ef4444)" }}>Zona Sesi & Akun</h4>
          <div className={styles.dangerActionsGrid}>
            
            <button
              onClick={onOpenLogoutModal}
              className={styles.dangerCardBtn}
            >
              <div className={styles.dangerCardLeft}>
                <AppIcon name="log-out" size={18} />
                <span>LOGOUT</span>
              </div>
              <span className={styles.chevronIcon}>›</span>
            </button>

            <button
              onClick={() => setIsDeleteModalOpen(true)}
              disabled={deletingAccount}
              className={`${styles.dangerCardBtn} ${styles.deleteCardBtn}`}
            >
              <div className={styles.dangerCardLeft}>
                <AppIcon name="trash-2" size={18} />
                <span>{deletingAccount ? "Menghapus Akun..." : "Hapus Akun Secara Permanen"}</span>
              </div>
              <span className={styles.chevronIcon}>›</span>
            </button>

          </div>
        </div>
      </div>

      {/* ====================================================
         MODAL KONFIRMASI HAPUS AKUN (High-End Luxury Style)
         ==================================================== */}
      {isDeleteModalOpen && (
        <div className={styles.modalOverlay} onClick={() => !deletingAccount && setIsDeleteModalOpen(false)}>
          <div 
            className={styles.modalContent} 
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.deleteIconWrapper}>
              <AppIcon name="alert-triangle" size={26} strokeWidth={2} />
            </div>

            <div className={styles.deleteContentText}>
              <h3>Hapus Akun Secara Permanen?</h3>
              <p>
                Tindakan ini tidak dapat dibatalkan. Semua data profil, riwayat pesanan, wishlist, dan buku alamat Anda akan dihapus secara permanen dari server kami.
              </p>
            </div>

            <div className={styles.deleteActions}>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={deletingAccount}
                className={styles.modalCancelBtn}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteAccount();
                }}
                disabled={deletingAccount}
                className={styles.modalConfirmDeleteBtn}
              >
                {deletingAccount ? "Menghapus..." : "Ya, Hapus Akun"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}