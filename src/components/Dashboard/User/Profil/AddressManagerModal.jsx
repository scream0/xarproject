import React from "react";
import styles from "./UserProfil.module.css";

export default function AddressManagerModal({
  isOpen,
  onClose,
  addresses,
  onSetPrimary,
  onEdit,
  onDelete,
  onOpenAdd,
}) {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Buku Alamat Saya ({addresses.length}/3)</h3>
          <button onClick={onClose} className={styles.closeModalBtn}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "10px 0" }}>
          {addresses.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "0.85rem", padding: "1rem 0" }}>
              Belum ada alamat tersimpan. Silakan tambahkan alamat pengiriman Anda.
            </p>
          ) : (
            addresses.map((addr) => (
              <div key={addr.id} style={{ padding: "14px", background: "var(--surface-secondary)", border: "1px solid var(--border-color)", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-primary)" }}>{addr.label || "Alamat"}</span>
                    {addr.isPrimary && (
                      <span style={{ fontSize: "0.65rem", background: "rgba(var(--primary-accent-rgb), 0.15)", color: "var(--primary-accent)", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                        UTAMA
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {!addr.isPrimary && (
                      <button onClick={() => onSetPrimary(addr.id)} style={{ background: "transparent", border: "1px solid var(--border-color)", color: "var(--text-secondary)", fontSize: "0.7rem", padding: "3px 8px", borderRadius: "4px", cursor: "pointer" }}>
                        Jadikan Utama
                      </button>
                    )}
                    <button onClick={() => onEdit(addr)} style={{ background: "transparent", border: "1px solid var(--border-color)", color: "var(--text-primary)", fontSize: "0.7rem", padding: "3px 8px", borderRadius: "4px", cursor: "pointer" }}>
                      Edit
                    </button>
                    <button onClick={() => onDelete(addr.id)} style={{ background: "rgba(var(--danger-color-rgb), 0.1)", border: "1px solid rgba(var(--danger-color-rgb), 0.3)", color: "var(--danger-color)", fontSize: "0.7rem", padding: "3px 8px", borderRadius: "4px", cursor: "pointer" }}>
                      Hapus
                    </button>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-primary)", fontWeight: 500 }}>
                  {addr.recipientName} ({addr.recipientPhone})
                </p>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                  {addr.street}, {addr.city}, {addr.province} - {addr.postalCode}
                </p>
              </div>
            ))
          )}

          {addresses.length < 3 ? (
            <button
              onClick={onOpenAdd}
              className={styles.actionBtnPrimary}
              style={{ width: "100%", marginTop: "6px" }}
            >
              + Tambah Alamat Baru ({addresses.length}/3)
            </button>
          ) : (
            <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-secondary)", fontStyle: "italic", margin: "4px 0 0 0" }}>
              Batas maksimal 3 alamat telah tercapai. Hapus salah satu alamat jika ingin menambahkan yang baru.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}