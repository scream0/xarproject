"use client";
import { useState, useEffect } from "react";
import styles from "./ProfileSection.module.css";
import profileConfig from "@/data/ui/userProfilConfig.json";
import { auth } from "@/lib/firebaseClient";
import toast from "react-hot-toast";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";

export default function ProfileSection() {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [isPasswordChanging, setIsPasswordChanging] = useState(false);

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
    memberTier: "VIP Collector",
    newsletterSubscribed: true,
  });

  const [addresses, setAddresses] = useState([]);

  // State Modals
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [tempProfile, setTempProfile] = useState({});
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [currentAddress, setCurrentAddress] = useState(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const currentUser = auth.currentUser;

  const extractPublicIdFromUrl = (url) => {
    if (!url || !url.includes("cloudinary.com")) return "";
    try {
      const parts = url.split("/upload/");
      if (parts.length < 2) return "";
      let pathWithoutVersion = parts[1].replace(/^v\d+\//, "");
      return pathWithoutVersion.substring(0, pathWithoutVersion.lastIndexOf("."));
    } catch (e) {
      console.error("Gagal mengekstrak public_id:", e);
      return "";
    }
  };

  useEffect(() => {
    async function fetchUserData() {
      if (!currentUser) return;
      try {
        const res = await fetch(`/api/users?userId=${currentUser.uid}`);
        const result = await res.json();

        const defaultUsername = currentUser.email?.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "") || `user_${currentUser.uid.substring(0, 5)}`;
        const defaultPhoto = currentUser.photoURL || "";

        if (res.ok && result.exists && result.data) {
          const data = result.data;
          const photoUrlToUse = data.photo_url || defaultPhoto;
          setProfile({
            username: data.username || defaultUsername,
            fullName: data.full_name || currentUser.displayName || "",
            gender: data.gender || "",
            birthDate: data.birth_date || "",
            phone: data.phone || currentUser.phoneNumber || "",
            email: currentUser.email || "",
            photoURL: photoUrlToUse,
            photoPublicId: data.photo_public_id || extractPublicIdFromUrl(photoUrlToUse),
            memberTier: data.member_tier || "VIP Collector",
            newsletterSubscribed: data.newsletter_subscribed ?? true,
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
            memberTier: "VIP Collector",
            newsletterSubscribed: true,
          });
        }
      } catch (err) {
        console.error("Gagal memuat profil:", err);
        toast.error("Gagal memuat data profil.");
      }
    }
    fetchUserData();
  }, [currentUser]);

  const handleUsernameChange = (e) => {
    const formatted = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setTempProfile({ ...tempProfile, username: formatted });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser) return;

    const toastId = toast.loading("Mengunggah avatar baru...");
    setUploadingImage(true);
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("userId", currentUser.uid);
      if (tempProfile.photoPublicId) data.append("oldPublicId", tempProfile.photoPublicId);
      else if (tempProfile.photoURL) data.append("oldUrl", tempProfile.photoURL);

      const res = await fetch("/api/cloudinary", { method: "POST", body: data });
      const result = await res.json();

      if (res.ok && result.secure_url) {
        setTempProfile((prev) => ({ ...prev, photoURL: result.secure_url, photoPublicId: result.public_id }));
        toast.success("Avatar berhasil diunggah!", { id: toastId });
      } else {
        throw new Error(result.error || "Gagal mengunggah gambar.");
      }
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    if (!currentUser || !tempProfile.photoURL || !window.confirm("Yakin ingin menghapus foto profil?")) return;

    const toastId = toast.loading("Menghapus avatar...");
    setRemovingImage(true);
    try {
      const res = await fetch("/api/cloudinary", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.uid, publicId: tempProfile.photoPublicId }),
      });
      if (!res.ok) throw new Error("Gagal menghapus avatar.");
      setTempProfile((prev) => ({ ...prev, photoURL: "", photoPublicId: "" }));
      toast.success("Avatar berhasil dihapus.", { id: toastId });
    } catch (err) {
      toast.error("Gagal menghapus avatar.", { id: toastId });
    } finally {
      setRemovingImage(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const cleanUsername = tempProfile.username?.trim();
    if (!cleanUsername) {
      toast.error("Username tidak boleh kosong.");
      return;
    }

    const toastId = toast.loading("Menyimpan profil...");
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.uid,
          type: "profile",
          ...tempProfile,
          username: cleanUsername,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal menyimpan profil.");
      setProfile((prev) => ({ ...prev, ...tempProfile, username: cleanUsername }));
      setIsProfileModalOpen(false);
      toast.success("Profil berhasil diperbarui!", { id: toastId });
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };
  
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = passwords;

    if (newPassword !== confirmPassword) {
      toast.error("Password baru tidak cocok.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password baru minimal 6 karakter.");
      return;
    }

    setIsPasswordChanging(true);
    const toastId = toast.loading("Memverifikasi & mengubah password...");

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      
      toast.success("Password berhasil diubah!", { id: toastId });
      setIsPasswordModalOpen(false);
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
        let errorMessage = "Gagal mengubah password.";
        if (error.code === 'auth/wrong-password') errorMessage = "Password saat ini salah.";
        if (error.code === 'auth/too-many-requests') errorMessage = "Terlalu banyak percobaan. Coba lagi nanti.";
        toast.error(errorMessage, { id: toastId });
    } finally {
        setIsPasswordChanging(false);
    }
  };


  const handleDeleteAccount = async () => {
    if (!window.confirm("PERINGATAN: Ini akan menghapus seluruh data akun Anda secara permanen. Yakin?")) return;

    const toastId = toast.loading("Menghapus akun...");
    setDeletingAccount(true);
    try {
      const res = await fetch(`/api/users?userId=${currentUser.uid}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success("Akun berhasil dihapus. Mengalihkan...", { id: toastId });
      await auth.signOut();
      window.location.href = "/login";
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setDeletingAccount(false);
    }
  };

  const updateAddressesOnServer = async (updatedAddresses, successMessage, toastId) => {
    const res = await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser.uid, type: "addresses", addresses: updatedAddresses }),
    });
    if (!res.ok) {
      const result = await res.json();
      throw new Error(result.error || "Gagal menyimpan alamat.");
    }
    setAddresses(updatedAddresses);
    toast.success(successMessage, { id: toastId });
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    const toastId = toast.loading("Menyimpan alamat...");
    setLoading(true);
    try {
      let updatedAddresses = [...addresses];
      const newAddressItem = { ...currentAddress, id: currentAddress.id || Date.now().toString() };

      if (newAddressItem.isPrimary || updatedAddresses.length === 0) {
        updatedAddresses = updatedAddresses.map((addr) => ({ ...addr, isPrimary: false }));
        newAddressItem.isPrimary = true;
      }
      
      const existingIndex = updatedAddresses.findIndex(addr => addr.id === newAddressItem.id);
      if (existingIndex > -1) {
        updatedAddresses[existingIndex] = newAddressItem;
      } else {
        updatedAddresses.push(newAddressItem);
      }

      await updateAddressesOnServer(updatedAddresses, "Alamat berhasil disimpan!", toastId);
      setIsAddressModalOpen(false);
      setCurrentAddress(null);
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAddress = async (id) => {
    if (!window.confirm("Hapus alamat ini?")) return;
    const toastId = toast.loading("Menghapus alamat...");
    try {
      let updatedAddresses = addresses.filter((addr) => addr.id !== id);
      if (updatedAddresses.length > 0 && !updatedAddresses.some((a) => a.isPrimary)) {
        updatedAddresses[0].isPrimary = true;
      }
      await updateAddressesOnServer(updatedAddresses, "Alamat dihapus.", toastId);
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  const handleSetPrimaryAddress = async (id) => {
    const toastId = toast.loading("Memperbarui alamat utama...");
    try {
      const updatedAddresses = addresses.map((addr) => ({ ...addr, isPrimary: addr.id === id }));
      await updateAddressesOnServer(updatedAddresses, "Alamat utama diperbarui!", toastId);
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  return (
    <div className={styles.workspaceInner}>
      {/* Header Info */}
      <div className={`card ${styles.sectionHeaderCard}`}>
        <div>
          <h3 className={styles.sectionHeaderTitle}>{profileConfig.header.title}</h3>
          <p className={styles.sectionHeaderSubtitle}>{profileConfig.header.subtitle}</p>
        </div>
      </div>

      {/* Grid Ringkasan Profil */}
      <div className={styles.profileOverviewGrid}>
        <div className="card">
          <div className={styles.cardHeaderFlex}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div className={styles.avatar}>
                {profile.photoURL ? <img src={profile.photoURL} alt="Avatar" /> : <span>👤</span>}
              </div>
              <h4 className={styles.cardTitle}>Informasi Personal</h4>
            </div>
            <button onClick={() => { setTempProfile(profile); setIsProfileModalOpen(true); }} className={styles.actionBtnOutline}>
              {profileConfig.buttons.editProfile}
            </button>
          </div>
          <div className={styles.profileInfoList}>
            <div className={styles.infoRow}><span>Username</span><span className={styles.infoValue}>@{profile.username || "belum_diatur"}</span></div>
            <div className={styles.infoRow}><span>Nama Lengkap</span><span className={styles.infoValue}>{profile.fullName || "-"}</span></div>
            <div className={styles.infoRow}><span>Email</span><span className={styles.infoValue}>{profile.email || "-"}</span></div>
            <div className={styles.infoRow}><span>Telepon</span><span className={styles.infoValue}>{profile.phone || "-"}</span></div>
          </div>
        </div>

        <div className="card">
          <div className={styles.cardHeaderFlex}><h4 className={styles.cardTitle}>Keamanan & Sesi</h4></div>
          <div className={styles.profileInfoList}>
            <div className={styles.infoRow}><span>Metode Login</span><span className={styles.infoValue}>{currentUser?.providerData?.[0]?.providerId.replace('.com', '') || "Email"}</span></div>
          </div>
          <div className={styles.securityActions}>
            <button onClick={() => setIsPasswordModalOpen(true)} className={styles.actionBtnPrimary}>Ganti Password</button>
            <button onClick={handleDeleteAccount} disabled={deletingAccount} className={styles.actionBtnDanger}>{deletingAccount ? "Menghapus..." : "Hapus Akun"}</button>
          </div>
        </div>
      </div>

      {/* Section Buku Alamat */}
      <div className="card">
        <div className={styles.cardHeaderFlex}>
          <h4 className={styles.cardTitle}>Buku Alamat</h4>
          <button onClick={() => { setCurrentAddress({ id: null, label: "Rumah", recipientName: profile.fullName, recipientPhone: profile.phone, street: "", city: "", postalCode: "", isPrimary: addresses.length === 0 }); setIsAddressModalOpen(true); }} className={styles.actionBtnPrimary}>
            {profileConfig.buttons.addAddress}
          </button>
        </div>
        {addresses.length === 0 ? <p className={styles.emptyStateText}>Belum ada alamat tersimpan.</p> : (
          <div className={styles.addressGrid}>
            {addresses.map((addr) => (
              <div key={addr.id} className={`${styles.addressCard} ${addr.isPrimary ? styles.addressCardPrimary : ""}`}>
                {addr.isPrimary && <span className={styles.primaryBadge}>Utama</span>}
                <div className={styles.addressContent}>
                  <h4>{addr.label} - {addr.recipientName}</h4>
                  <p>📞 {addr.recipientPhone}</p>
                  <p>📍 {addr.street}, {addr.city} ({addr.postalCode})</p>
                </div>
                <div className={styles.addressActions}>
                  <button onClick={() => { setCurrentAddress(addr); setIsAddressModalOpen(true); }} className={styles.smallBtn}>Edit</button>
                  {!addr.isPrimary && <button onClick={() => handleSetPrimaryAddress(addr.id)} className={styles.smallBtn}>Jadikan Utama</button>}
                  <button onClick={() => handleDeleteAddress(addr.id)} className={styles.smallBtnDanger}>Hapus</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {isProfileModalOpen && ( <div className={styles.modalOverlay} onClick={() => setIsProfileModalOpen(false)}> <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}> <div className={styles.modalHeader}><h3 className={styles.modalTitle}>Edit Profil</h3><button onClick={() => setIsProfileModalOpen(false)} className={styles.closeModalBtn}>✕</button></div> <form onSubmit={handleSaveProfile}><div className={styles.formGroup}><label className={styles.inputLabel}>Foto Profil</label><div className={styles.avatarUpload}> <div className={styles.avatar} style={{width: 60, height: 60}}>{tempProfile.photoURL ? <img src={tempProfile.photoURL} alt="Avatar"/>:<span>👤</span>}</div> <input type="file" id="avatar-upload" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage || removingImage} style={{display: 'none'}}/> <label htmlFor="avatar-upload" className={styles.smallBtn}>Pilih Gambar</label> {tempProfile.photoURL && <button type="button" onClick={handleRemoveAvatar} disabled={uploadingImage || removingImage} className={styles.smallBtnDanger}>Hapus</button>}</div></div><div className={styles.formGroup}><label className={styles.inputLabel}>Username</label><div className={styles.inputWithPrefix}><span>@</span><input type="text" value={tempProfile.username || ""} onChange={handleUsernameChange} required/></div></div><div className={styles.formGroup}><label className={styles.inputLabel}>Nama Lengkap</label><input type="text" value={tempProfile.fullName || ""} onChange={(e) => setTempProfile({ ...tempProfile, fullName: e.target.value })} className={styles.formInput}/></div><div className={styles.formGroup}><label className={styles.inputLabel}>Telepon</label><input type="text" value={tempProfile.phone || ""} onChange={(e) => setTempProfile({ ...tempProfile, phone: e.target.value })} className={styles.formInput}/></div><div className={styles.formGroup}><label className={styles.inputLabel}>Tanggal Lahir</label><input type="date" value={tempProfile.birthDate || ""} onChange={(e) => setTempProfile({ ...tempProfile, birthDate: e.target.value })} className={styles.formInput}/></div><div className={styles.formGroup}><label className={styles.inputLabel}>Jenis Kelamin</label><select value={tempProfile.gender || ""} onChange={(e) => setTempProfile({ ...tempProfile, gender: e.target.value })} className={styles.formSelect}><option value="">Pilih...</option><option value="Male">Laki-laki</option><option value="Female">Perempuan</option></select></div><div className={styles.formGroupCheckbox}><input type="checkbox" id="newsletter" checked={tempProfile.newsletterSubscribed ?? true} onChange={(e) => setTempProfile({ ...tempProfile, newsletterSubscribed: e.target.checked })}/> <label htmlFor="newsletter">Terima info & promo eksklusif</label></div><div className={styles.modalFooter}><button type="button" onClick={() => setIsProfileModalOpen(false)} className={styles.smallBtn}>Batal</button><button type="submit" disabled={loading || uploadingImage || removingImage} className={styles.actionBtnPrimary}>{loading ? "Menyimpan..." : "Simpan"}</button></div></form> </div> </div>)}
      {isAddressModalOpen && ( <div className={styles.modalOverlay} onClick={() => setIsAddressModalOpen(false)}> <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}> <div className={styles.modalHeader}><h3 className={styles.modalTitle}>{currentAddress?.id ? "Edit Alamat" : "Tambah Alamat"}</h3><button onClick={() => setIsAddressModalOpen(false)} className={styles.closeModalBtn}>✕</button></div> <form onSubmit={handleSaveAddress}><div className={styles.formGroup}><label className={styles.inputLabel}>Label Alamat</label><input type="text" value={currentAddress.label} onChange={(e) => setCurrentAddress({ ...currentAddress, label: e.target.value })} required className={styles.formInput}/></div><div className={styles.formGroup}><label className={styles.inputLabel}>Nama Penerima</label><input type="text" value={currentAddress.recipientName} onChange={(e) => setCurrentAddress({ ...currentAddress, recipientName: e.target.value })} required className={styles.formInput}/></div><div className={styles.formGroup}><label className={styles.inputLabel}>Telepon Penerima</label><input type="text" value={currentAddress.recipientPhone} onChange={(e) => setCurrentAddress({ ...currentAddress, recipientPhone: e.target.value })} required className={styles.formInput}/></div><div className={styles.formGroup}><label className={styles.inputLabel}>Alamat Lengkap</label><textarea rows="2" value={currentAddress.street} onChange={(e) => setCurrentAddress({ ...currentAddress, street: e.target.value })} required className={styles.formTextarea}/></div><div className={styles.formGroup}><label className={styles.inputLabel}>Kota/Kabupaten</label><input type="text" value={currentAddress.city} onChange={(e) => setCurrentAddress({ ...currentAddress, city: e.target.value })} required className={styles.formInput}/></div><div className={styles.formGroup}><label className={styles.inputLabel}>Kode Pos</label><input type="text" value={currentAddress.postalCode} onChange={(e) => setCurrentAddress({ ...currentAddress, postalCode: e.target.value })} required className={styles.formInput}/></div><div className={styles.modalFooter}><button type="button" onClick={() => setIsAddressModalOpen(false)} className={styles.smallBtn}>Batal</button><button type="submit" disabled={loading} className={styles.actionBtnPrimary}>{loading ? "Menyimpan..." : "Simpan Alamat"}</button></div></form> </div> </div>)}
      {isPasswordModalOpen && ( <div className={styles.modalOverlay} onClick={() => setIsPasswordModalOpen(false)}> <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}> <div className={styles.modalHeader}><h3 className={styles.modalTitle}>Ganti Password</h3><button onClick={() => setIsPasswordModalOpen(false)} className={styles.closeModalBtn}>✕</button></div> <form onSubmit={handlePasswordChange}><div className={styles.formGroup}><label className={styles.inputLabel}>Password Saat Ini</label><input type="password" value={passwords.currentPassword} onChange={e => setPasswords({...passwords, currentPassword: e.target.value})} className={styles.formInput} required/></div><div className={styles.formGroup}><label className={styles.inputLabel}>Password Baru</label><input type="password" value={passwords.newPassword} onChange={e => setPasswords({...passwords, newPassword: e.target.value})} className={styles.formInput} required/></div><div className={styles.formGroup}><label className={styles.inputLabel}>Konfirmasi Password Baru</label><input type="password" value={passwords.confirmPassword} onChange={e => setPasswords({...passwords, confirmPassword: e.target.value})} className={styles.formInput} required/></div><div className={styles.modalFooter}><button type="button" onClick={() => setIsPasswordModalOpen(false)} className={styles.smallBtn}>Batal</button><button type="submit" disabled={isPasswordChanging} className={styles.actionBtnPrimary}>{isPasswordChanging ? "Memperbarui..." : "Ubah Password"}</button></div></form> </div> </div>)}
    </div>
  );
}
