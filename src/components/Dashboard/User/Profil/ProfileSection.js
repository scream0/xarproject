"use client";
import { useState, useEffect } from "react";
import styles from "./ProfileSection.module.css";
import profileConfig from "@/data/ui/userProfilConfig.json";
import { auth } from "@/lib/firebaseClient";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import toast from "react-hot-toast";

const db = getFirestore();

export default function ProfileSection() {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);

  // Data Profil Utama
  const [profile, setProfile] = useState({
    username: "",
    fullName: "",
    gender: "",
    birthDate: "",
    phone: "",
    email: "",
    photoURL: "",
    photoPublicId: "",
  });

  // Daftar Alamat (Maksimal 3)
  const [addresses, setAddresses] = useState([]);

  // State Modal Edit Profil
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [tempProfile, setTempProfile] = useState({});

  // State Modal Alamat (Tambah/Edit)
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [currentAddress, setCurrentAddress] = useState({
    id: null,
    label: "Rumah",
    recipientName: "",
    recipientPhone: "",
    street: "",
    city: "",
    postalCode: "",
    isPrimary: false,
  });

  const currentUser = auth.currentUser;

  // Helper untuk ekstrak public_id dari URL Cloudinary
  const extractPublicIdFromUrl = (url) => {
    if (!url || !url.includes("cloudinary.com")) return "";
    try {
      const parts = url.split("/upload/");
      if (parts.length < 2) return "";
      let pathWithoutVersion = parts[1].replace(/^v\d+\//, "");
      const publicId = pathWithoutVersion.substring(
        0,
        pathWithoutVersion.lastIndexOf("."),
      );
      return publicId;
    } catch (e) {
      console.error("Gagal mengekstrak public_id:", e);
      return "";
    }
  };

  useEffect(() => {
    async function fetchUserData() {
      if (!currentUser) return;
      try {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);

        const defaultUsername = currentUser.email
          ? currentUser.email
              .split("@")[0]
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, "")
          : "user_" + currentUser.uid.substring(0, 5);
        const defaultPhoto = currentUser.photoURL || "";

        if (docSnap.exists()) {
          const data = docSnap.data();
          const photoUrlToUse = data.photo_url || defaultPhoto;
          const resolvedPublicId =
            data.photo_public_id || extractPublicIdFromUrl(photoUrlToUse);

          setProfile({
            username: data.username || defaultUsername,
            fullName: data.full_name || currentUser.displayName || "",
            gender: data.gender || "",
            birthDate: data.birth_date || "",
            phone: data.phone || currentUser.phoneNumber || "",
            email: currentUser.email || "",
            photoURL: photoUrlToUse,
            photoPublicId: resolvedPublicId,
          });
          setAddresses(data.addresses || []);
        } else {
          setProfile({
            username: defaultUsername,
            fullName: currentUser.displayName || "",
            phone: currentUser.phoneNumber || "",
            email: currentUser.email || "",
            photoURL: defaultPhoto,
            photoPublicId: extractPublicIdFromUrl(defaultPhoto),
          });
        }
      } catch (err) {
        console.error("Gagal memuat profil:", err);
        toast.error("Gagal memuat data profil.");
      }
    }
    fetchUserData();
  }, [currentUser]);

  // Handler format username ala sosmed
  const handleUsernameChange = (e) => {
    const formatted = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setTempProfile({ ...tempProfile, username: formatted });
  };

  // Handler Upload Avatar via Cloudinary
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser) return;

    const toastId = toast.loading("Mengunggah avatar baru...");
    setUploadingImage(true);

    try {
      const data = new FormData();
      data.append("file", file);
      data.append("userId", currentUser.uid);

      if (tempProfile.photoPublicId) {
        data.append("oldPublicId", tempProfile.photoPublicId);
      } else if (tempProfile.photoURL) {
        data.append("oldUrl", tempProfile.photoURL);
      }

      const res = await fetch("/api/cloudinary", {
        method: "POST",
        body: data,
      });

      const responseText = await res.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(responseText || "Gagal memproses respons dari server.");
      }

      if (res.ok && result.secure_url) {
        setTempProfile((prev) => ({
          ...prev,
          photoURL: result.secure_url,
          photoPublicId: result.public_id,
        }));
        toast.success("Avatar berhasil diunggah!", { id: toastId });
      } else {
        throw new Error(result.error || "Gagal mengunggah gambar ke server.");
      }
    } catch (err) {
      console.error("Upload Error:", err);
      toast.error(err.message || "Gagal mengganti avatar.", { id: toastId });
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  // Handler Hapus Avatar
  const handleRemoveAvatar = async () => {
    if (!currentUser || !tempProfile.photoURL) return;
    if (!window.confirm("Yakin ingin menghapus foto profil ini?")) return;

    const toastId = toast.loading("Menghapus avatar...");
    setRemovingImage(true);

    try {
      const res = await fetch("/api/cloudinary", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.uid,
          publicId: tempProfile.photoPublicId || undefined,
        }),
      });

      if (!res.ok) throw new Error("Gagal menghapus avatar dari server.");

      setTempProfile((prev) => ({ ...prev, photoURL: "", photoPublicId: "" }));
      toast.success("Avatar berhasil dihapus.", { id: toastId });
    } catch (err) {
      console.error("Remove Avatar Error:", err);
      toast.error("Gagal menghapus avatar.", { id: toastId });
    } finally {
      setRemovingImage(false);
    }
  };

  // Simpan Perubahan Profil ke Firestore dengan Cek Unik Username
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const cleanUsername = tempProfile.username?.trim();

    if (!cleanUsername) {
      toast.error("Username tidak boleh kosong.");
      return;
    }

    const toastId = toast.loading("Menyimpan perubahan profil...");
    setLoading(true);

    try {
      if (cleanUsername !== profile.username) {
        const q = query(
          collection(db, "users"),
          where("username", "==", cleanUsername),
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          toast.error(
            `Username @${cleanUsername} sudah digunakan orang lain.`,
            {
              id: toastId,
            },
          );
          setLoading(false);
          return;
        }
      }

      const docRef = doc(db, "users", currentUser.uid);
      const updatedData = {
        username: cleanUsername,
        full_name: tempProfile.fullName,
        gender: tempProfile.gender,
        birth_date: tempProfile.birthDate,
        phone: tempProfile.phone,
        photo_url: tempProfile.photoURL || "",
        photo_public_id: tempProfile.photoPublicId || "",
        updated_at: new Date(),
      };

      await setDoc(docRef, updatedData, { merge: true });
      setProfile((prev) => ({
        ...prev,
        ...tempProfile,
        username: cleanUsername,
      }));
      setIsProfileModalOpen(false);
      toast.success("Profil berhasil diperbarui!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Gagal menyimpan profil.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // Simpan / Tambah Alamat (Maksimal 3)
  const handleSaveAddress = async (e) => {
    e.preventDefault();
    if (addresses.length >= 3 && !currentAddress.id) {
      toast.error("Maksimal hanya dapat menyimpan 3 alamat.");
      return;
    }

    const toastId = toast.loading("Menyimpan alamat...");
    setLoading(true);

    try {
      let updatedAddresses = [...addresses];
      const newAddressItem = {
        ...currentAddress,
        id: currentAddress.id || Date.now().toString(),
      };

      if (newAddressItem.isPrimary || updatedAddresses.length === 0) {
        updatedAddresses = updatedAddresses.map((addr) => ({
          ...addr,
          isPrimary: false,
        }));
        newAddressItem.isPrimary = true;
      }

      if (currentAddress.id) {
        updatedAddresses = updatedAddresses.map((addr) =>
          addr.id === currentAddress.id ? newAddressItem : addr,
        );
      } else {
        updatedAddresses.push(newAddressItem);
      }

      const docRef = doc(db, "users", currentUser.uid);
      await setDoc(docRef, { addresses: updatedAddresses }, { merge: true });

      setAddresses(updatedAddresses);
      setIsAddressModalOpen(false);
      toast.success("Alamat berhasil disimpan!", { id: toastId });
    } catch (err) {
      toast.error("Gagal menyimpan alamat.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // Hapus Alamat
  const handleDeleteAddress = async (id) => {
    if (!window.confirm("Hapus alamat ini?")) return;
    try {
      let updatedAddresses = addresses.filter((addr) => addr.id !== id);
      if (
        updatedAddresses.length > 0 &&
        !updatedAddresses.some((a) => a.isPrimary)
      ) {
        updatedAddresses[0].isPrimary = true;
      }

      const docRef = doc(db, "users", currentUser.uid);
      await setDoc(docRef, { addresses: updatedAddresses }, { merge: true });
      setAddresses(updatedAddresses);
      toast.success("Alamat dihapus.");
    } catch (err) {
      toast.error("Gagal menghapus alamat.");
    }
  };

  // Jadikan Alamat Utama
  const handleSetPrimaryAddress = async (id) => {
    try {
      const updatedAddresses = addresses.map((addr) => ({
        ...addr,
        isPrimary: addr.id === id,
      }));

      const docRef = doc(db, "users", currentUser.uid);
      await setDoc(docRef, { addresses: updatedAddresses }, { merge: true });
      setAddresses(updatedAddresses);
      toast.success("Alamat utama diperbarui.");
    } catch (err) {
      toast.error("Gagal memperbarui alamat utama.");
    }
  };

  return (
    <div className={styles.workspaceInner}>
      {/* Header Info */}
      <div className={`card ${styles.sectionHeaderCard}`}>
        <h3 className={styles.sectionHeaderTitle}>
          {profileConfig.header.title}
        </h3>
        <p className={styles.sectionHeaderSubtitle}>
          {profileConfig.header.subtitle}
        </p>
      </div>

      {/* Grid Ringkasan Profil */}
      <div className={styles.profileOverviewGrid}>
        {/* Card Ringkasan Akun */}
        <div className="card">
          <div className={styles.cardHeaderFlex}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  backgroundColor: "#07090e",
                  border: "1px solid rgba(255,255,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {profile.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt="Avatar"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <span style={{ fontSize: "1.2rem", color: "#64748b" }}>
                    👤
                  </span>
                )}
              </div>
              <h4 className={styles.cardTitle} style={{ margin: 0 }}>
                Informasi Personal
              </h4>
            </div>
            <button
              onClick={() => {
                setTempProfile(profile);
                setIsProfileModalOpen(true);
              }}
              className={styles.actionBtnOutline}
            >
              {profileConfig.buttons.editProfile}
            </button>
          </div>
          <div className={styles.profileInfoList} style={{ marginTop: "16px" }}>
            <div className={styles.infoRow}>
              <span>Username Handle:</span>
              <span
                className={styles.infoValue}
                style={{ color: "#818cf8", fontWeight: 600 }}
              >
                @{profile.username || "belum_diatur"}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span>Nama Lengkap:</span>
              <span className={styles.infoValue}>
                {profile.fullName || "-"}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span>Email:</span>
              <span className={styles.infoValue}>{profile.email || "-"}</span>
            </div>
            <div className={styles.infoRow}>
              <span>No. WhatsApp:</span>
              <span className={styles.infoValue}>{profile.phone || "-"}</span>
            </div>
            <div className={styles.infoRow}>
              <span>Jenis Kelamin:</span>
              <span className={styles.infoValue}>{profile.gender || "-"}</span>
            </div>
          </div>
        </div>

        {/* Card Ringkasan Kontak / Sesi */}
        <div className="card">
          <div className={styles.cardHeaderFlex}>
            <h4 className={styles.cardTitle}>Keamanan & Sesi</h4>
          </div>
          <div className={styles.profileInfoList}>
            <div className={styles.infoRow}>
              <span>UID Pengguna:</span>
              <span className={styles.infoValue}>
                {currentUser?.uid.substring(0, 10)}...
              </span>
            </div>
            <div className={styles.infoRow}>
              <span>Metode Login:</span>
              <span className={styles.infoValue}>
                {currentUser?.providerData?.[0]?.providerId || "Google / Phone"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section Buku Alamat (Maksimal 3) */}
      <div className="card">
        <div className={styles.cardHeaderFlex}>
          <div>
            <h4 className={styles.cardTitle}>
              Daftar Alamat Pengiriman ({addresses.length}/3)
            </h4>
          </div>
          {addresses.length < 3 && (
            <button
              onClick={() => {
                setCurrentAddress({
                  id: null,
                  label: "Rumah",
                  recipientName: profile.fullName,
                  recipientPhone: profile.phone,
                  street: "",
                  city: "",
                  postalCode: "",
                  isPrimary: addresses.length === 0,
                });
                setIsAddressModalOpen(true);
              }}
              className={styles.actionBtnPrimary}
            >
              {profileConfig.buttons.addAddress}
            </button>
          )}
        </div>

        {addresses.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0 }}>
            Belum ada alamat tersimpan. Tambahkan alamat untuk memudahkan
            pengiriman pesanan.
          </p>
        ) : (
          <div className={styles.addressGrid}>
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className={`${styles.addressCard} ${addr.isPrimary ? styles.addressCardPrimary : ""}`}
              >
                {addr.isPrimary && (
                  <span className={styles.primaryBadge}>Utama</span>
                )}
                <div className={styles.addressContent}>
                  <h4>
                    {addr.label} - {addr.recipientName}
                  </h4>
                  <p>📞 {addr.recipientPhone}</p>
                  <p>
                    📍 {addr.street}, {addr.city} ({addr.postalCode})
                  </p>
                </div>
                <div className={styles.addressActions}>
                  <button
                    onClick={() => {
                      setCurrentAddress(addr);
                      setIsAddressModalOpen(true);
                    }}
                    className={styles.smallBtn}
                  >
                    Edit
                  </button>
                  {!addr.isPrimary && (
                    <button
                      onClick={() => handleSetPrimaryAddress(addr.id)}
                      className={styles.smallBtn}
                    >
                      Jadikan Utama
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteAddress(addr.id)}
                    className={styles.smallBtnDanger}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- MODAL EDIT PROFIL --- */}
      {isProfileModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Edit Informasi Profil</h3>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className={styles.closeModalBtn}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveProfile}>
              {/* Pengaturan Avatar / Foto Profil */}
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  Foto Profil (Avatar)
                </label>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "16px" }}
                >
                  <div
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "50%",
                      overflow: "hidden",
                      backgroundColor: "#07090e",
                      border: "1px solid rgba(255,255,255,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {tempProfile.photoURL ? (
                      <img
                        src={tempProfile.photoURL}
                        alt="Avatar"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: "1.5rem", color: "#64748b" }}>
                        👤
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage || removingImage}
                      style={{ fontSize: "0.8rem", color: "#cbd5e1" }}
                    />
                    {tempProfile.photoURL && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        disabled={uploadingImage || removingImage}
                        style={{
                          background: "transparent",
                          color: "#f43f5e",
                          border: "1px solid rgba(244,63,94,0.4)",
                          padding: "4px 10px",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                        }}
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  Username Handle (Sosmed)
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "#07090e",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      padding: "0 12px",
                      color: "#818cf8",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                    }}
                  >
                    @
                  </span>
                  <input
                    type="text"
                    value={tempProfile.username || ""}
                    onChange={handleUsernameChange}
                    placeholder="nama_pengguna"
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      padding: "10px 10px 10px 0",
                      color: "#fff",
                      outline: "none",
                      fontSize: "0.85rem",
                    }}
                    required
                  />
                </div>
                <small
                  style={{
                    fontSize: "0.7rem",
                    color: "#64748b",
                    marginTop: "4px",
                    display: "block",
                  }}
                >
                  Hanya huruf kecil, angka, dan underscore (_). Unik di seluruh
                  platform.
                </small>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>Nama Lengkap</label>
                <input
                  type="text"
                  value={tempProfile.fullName || ""}
                  onChange={(e) =>
                    setTempProfile({ ...tempProfile, fullName: e.target.value })
                  }
                  className={styles.formInput}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  Nomor WhatsApp / Telepon
                </label>
                <input
                  type="text"
                  value={tempProfile.phone || ""}
                  onChange={(e) =>
                    setTempProfile({ ...tempProfile, phone: e.target.value })
                  }
                  className={styles.formInput}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>Jenis Kelamin</label>
                <select
                  value={tempProfile.gender || ""}
                  onChange={(e) =>
                    setTempProfile({ ...tempProfile, gender: e.target.value })
                  }
                  className={styles.formSelect}
                >
                  <option value="">Pilih...</option>
                  <option value="Male">Laki-laki</option>
                  <option value="Female">Perempuan</option>
                </select>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className={styles.smallBtn}
                >
                  {profileConfig.buttons.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loading || uploadingImage || removingImage}
                  className={styles.actionBtnPrimary}
                >
                  {loading ? "Menyimpan..." : profileConfig.buttons.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL TAMBAH / EDIT ALAMAT --- */}
      {isAddressModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {currentAddress.id ? "Edit Alamat" : "Tambah Alamat Baru"}
              </h3>
              <button
                onClick={() => setIsAddressModalOpen(false)}
                className={styles.closeModalBtn}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveAddress}>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  Label Alamat (Contoh: Rumah, Kantor)
                </label>
                <input
                  type="text"
                  value={currentAddress.label}
                  onChange={(e) =>
                    setCurrentAddress({
                      ...currentAddress,
                      label: e.target.value,
                    })
                  }
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>Nama Penerima</label>
                <input
                  type="text"
                  value={currentAddress.recipientName}
                  onChange={(e) =>
                    setCurrentAddress({
                      ...currentAddress,
                      recipientName: e.target.value,
                    })
                  }
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>Telepon Penerima</label>
                <input
                  type="text"
                  value={currentAddress.recipientPhone}
                  onChange={(e) =>
                    setCurrentAddress({
                      ...currentAddress,
                      recipientPhone: e.target.value,
                    })
                  }
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  Alamat Lengkap (Jalan, No. Rumah, Patokan)
                </label>
                <textarea
                  rows="3"
                  value={currentAddress.street}
                  onChange={(e) =>
                    setCurrentAddress({
                      ...currentAddress,
                      street: e.target.value,
                    })
                  }
                  className={styles.formTextarea}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>Kota / Kabupaten</label>
                <input
                  type="text"
                  value={currentAddress.city}
                  onChange={(e) =>
                    setCurrentAddress({
                      ...currentAddress,
                      city: e.target.value,
                    })
                  }
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>Kode Pos</label>
                <input
                  type="text"
                  value={currentAddress.postalCode}
                  onChange={(e) =>
                    setCurrentAddress({
                      ...currentAddress,
                      postalCode: e.target.value,
                    })
                  }
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(false)}
                  className={styles.smallBtn}
                >
                  {profileConfig.buttons.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={styles.actionBtnPrimary}
                >
                  {loading ? "Menyimpan..." : profileConfig.buttons.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
