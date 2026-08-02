
"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import styles from "./AddressManager.module.css";
import { AddressForm } from "./AddressForm";

export function AddressManager({ user, onSelectAddress, selectedAddressId, setAllAddresses }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);

  useEffect(() => {
    if (user) {
      fetch(`/api/users/${user.uid}/addresses`)
        .then((res) => res.json())
        .then((data) => {
          setAddresses(data);
          setAllAddresses(data);
          if (data.length > 0) {
            const primary = data.find(a => a.isPrimary) || data[0];
            onSelectAddress(primary.id);
          }
        })
        .catch(() => toast.error("Gagal memuat alamat."))
        .finally(() => setLoading(false));
    }
  }, [user, onSelectAddress, setAllAddresses]);

  const handleSaveAddress = async (addressData) => {
    const url = editingAddress
      ? `/api/users/${user.uid}/addresses/${editingAddress.id}`
      : `/api/users/${user.uid}/addresses`;
    const method = editingAddress ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addressData),
    });

    if (!res.ok) {
      toast.error("Gagal menyimpan alamat.");
      return;
    }

    const savedAddress = await res.json();
    let updatedAddresses;
    if (editingAddress) {
      updatedAddresses = addresses.map((a) => (a.id === savedAddress.id ? savedAddress : a));
    } else {
      updatedAddresses = [...addresses, savedAddress];
    }
    setAddresses(updatedAddresses);
    setAllAddresses(updatedAddresses);

    toast.success("Alamat berhasil disimpan!");
    setShowModal(false);
    setEditingAddress(null);
  };

  const handleDeleteAddress = async (addressId) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus alamat ini?")) {
      const res = await fetch(`/api/users/${user.uid}/addresses/${addressId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        const updatedAddresses = addresses.filter((a) => a.id !== addressId);
        setAddresses(updatedAddresses);
        setAllAddresses(updatedAddresses);
        toast.success("Alamat berhasil dihapus.");
        if (selectedAddressId === addressId) {
            onSelectAddress(null);
        }
      } else {
        toast.error("Gagal menghapus alamat.");
      }
    }
  };

  const handleSetPrimary = async (addressId) => {
    const res = await fetch(`/api/users/${user.uid}/addresses/${addressId}/set-primary`, {
      method: "PATCH",
    });

    if (res.ok) {
        const updatedAddresses = addresses.map(a => ({...a, isPrimary: a.id === addressId}));
        setAddresses(updatedAddresses);
        setAllAddresses(updatedAddresses);
        toast.success("Alamat utama berhasil diubah.");
    } else {
        toast.error("Gagal mengubah alamat utama.");
    }
  };

  return (
    <div className={styles.addressManager}>
        <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
                Alamat Pengiriman
            </h2>
            <button
                className={styles.sectionAction}
                onClick={() => {
                    setEditingAddress(null);
                    setShowModal(true);
                }}
            >
                + Tambah Baru
            </button>
        </div>

      {loading ? (
        <p>Memuat alamat...</p>
      ) : addresses.length === 0 ? (
        <p>Belum ada alamat tersimpan.</p>
      ) : (
        <div className={styles.addressList}>
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`${styles.addressCard} ${
                selectedAddressId === addr.id ? styles.addressCardSelected : ""
              }`}
              onClick={() => onSelectAddress(addr.id)}
            >
                <div className={styles.addressContent}>
                    <span className={styles.addressLabel}>
                        {addr.label}
                        {addr.isPrimary && <span className={styles.primaryBadge}>Utama</span>}
                    </span>
                    <p className={styles.addressName}>{addr.recipientName}</p>
                    <p className={styles.addressPhone}>{addr.recipientPhone}</p>
                    <p className={styles.addressFull}>
                        {addr.street}, {addr.city}, {addr.province} {addr.postalCode}
                    </p>
                </div>
                <div className={styles.addressActions}>
                    {!addr.isPrimary && <button onClick={(e) => {e.stopPropagation(); handleSetPrimary(addr.id)}}>Jadikan Utama</button>}
                    <button onClick={(e) => {e.stopPropagation(); setEditingAddress(addr); setShowModal(true);}}>Ubah</button>
                    <button onClick={(e) => {e.stopPropagation(); handleDeleteAddress(addr.id)}}>Hapus</button>
                </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AddressForm
          address={editingAddress}
          onSave={handleSaveAddress}
          onClose={() => {
            setShowModal(false);
            setEditingAddress(null);
          }}
        />
      )}
    </div>
  );
}
