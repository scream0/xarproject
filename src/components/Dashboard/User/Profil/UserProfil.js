"use client";
import { useState, useEffect } from "react";
import styles from "./UserProfil.module.css";
import profileConfig from "@/data/ui/userProfilConfig.json";
import { auth } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { ProvinceCitySelect } from "@/components/UI/ProvinceCitySelect/ProvinceCitySelect";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import OrdersSection from "@/components/Dashboard/User/Order/OrdersSection";
import WishlistSection from "@/components/Dashboard/User/Wishlist/WishlistSection";
import SupportCenter from "@/components/Dashboard/User/Support/SupportCenter";

export default function ProfileSection() {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [isPasswordChanging, setIsPasswordChanging] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isManageAddressModalOpen, setIsManageAddressModalOpen] = useState(false); // Modal khusus list alamat

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
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false); 
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);   
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

  const [currentSession, setCurrentSession] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const extractPublicIdFromUrl = (url) => {
    if (!url || !url.includes("cloudinary.com")) return "";
    try {
      const parts = url.split("/upload/");
      if (parts.length < 2) return "";
      let pathWithoutVersion = parts[1].replace(/^v\d+\//, "");
      return pathWithoutVersion.substring(
        0,
        pathWithoutVersion.lastIndexOf("."),
      );
    } catch (e) {
      console.error("Gagal mengekstrak public_id:", e);
      return "";
    }
  };

  useEffect(() => {
    let subscription = null;

    const initAuthAndFetch = async () => {
      const { data: { session } } = await auth.getSession();
      setCurrentSession(session);
      const user = session?.user || null;
      setCurrentUser(user);

      if (!user) return;

      try {
        const userId = user.id || user.uid;
        const token = session?.access_token;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch(`/api/users?userId=${userId}`, { headers });
        const result = await res.json();

        const defaultUsername =
          user.email
            ?.split("@")[0]
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, "") ||
          `user_${userId.substring(0, 5)}`;
        
        const defaultPhoto = user.user_metadata?.avatar_url || user.user_metadata?.picture || "";

        if (res.ok && result.exists && result.data) {
          const data = result.data;
          const photoUrlToUse = data.photo_url || defaultPhoto;
          setProfile({
            username: data.username || defaultUsername,
            fullName: data.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "",
            gender: data.gender || "",
            birthDate: data.birth_date || "",
            phone: data.phone || user.phone || "",
            email: user.email || "",
            photoURL: photoUrlToUse,
            photoPublicId:
              data.photo_public_id || extractPublicIdFromUrl(photoUrlToUse),
            memberTier: data.member_tier || "VIP Collector",
            newsletterSubscribed: data.newsletter_subscribed ?? true,
          });
          setAddresses(data.addresses || []);
        } else {
          setProfile({
            username: defaultUsername,
            fullName: user.user_metadata?.full_name || user.user_metadata?.name || "",
            phone: user.phone || "",
            email: user.email || "",
            photoURL: defaultPhoto,
            photoPublicId: extractPublicIdFromUrl(defaultPhoto),
            memberTier: "VIP Collector",
            newsletterSubscribed: true,
          });
        }
      } catch (err) {
        console.error("Gagal memuat profil:", err);
        toast.error(profileConfig.toasts.fetchError);
      }

      const { data: authListener } = auth.onAuthStateChange(async (_event, session) => {
        setCurrentSession(session);
        setCurrentUser(session?.user || null);
      });
      subscription = authListener?.subscription;
    };

    initAuthAndFetch();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const handleUsernameChange = (e) => {
    const formatted = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setTempProfile({ ...tempProfile, username: formatted });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser || !currentSession) return;

    const toastId = toast.loading(profileConfig.toasts.uploadingAvatar);
    setUploadingImage(true);
    try {
      const userId = currentUser.id || currentUser.uid;
      const token = currentSession.access_token;

      const data = new FormData();
      data.append("file", file);
      data.append("userId", userId);
      if (tempProfile.photoPublicId)
        data.append("oldPublicId", tempProfile.photoPublicId);
      else if (tempProfile.photoURL)
        data.append("oldUrl", tempProfile.photoURL);

      const res = await fetch("/api/cloudinary", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: data,
      });
      const result = await res.json();

      if (res.ok && result.secure_url) {
        setTempProfile((prev) => ({
          ...prev,
          photoURL: result.secure_url,
          photoPublicId: result.public_id,
        }));
        toast.success(profileConfig.toasts.uploadSuccess, { id: toastId });
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
    if (
      !currentUser ||
      !currentSession ||
      !tempProfile.photoURL ||
      !window.confirm(profileConfig.prompts.removeAvatarConfirm)
    )
      return;

    const toastId = toast.loading(profileConfig.toasts.removeAvatarLoading);
    setRemovingImage(true);
    try {
      const userId = currentUser.id || currentUser.uid;
      const token = currentSession.access_token;

      const res = await fetch("/api/cloudinary", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId,
          publicId: tempProfile.photoPublicId,
        }),
      });
      if (!res.ok) throw new Error("Gagal menghapus avatar.");
      setTempProfile((prev) => ({ ...prev, photoURL: "", photoPublicId: "" }));
      toast.success(profileConfig.toasts.removeAvatarSuccess, { id: toastId });
    } catch (err) {
      toast.error(profileConfig.toasts.removeAvatarLoading, { id: toastId });
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

    const toastId = toast.loading(profileConfig.toasts.saveProfileLoading);
    setLoading(true);
    try {
      const userId = currentUser.id || currentUser.uid;
      const token = currentSession?.access_token;

      const res = await fetch("/api/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId,
          type: "profile",
          ...tempProfile,
          username: cleanUsername,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal menyimpan profil.");
      setProfile((prev) => ({
        ...prev,
        ...tempProfile,
        username: cleanUsername,
      }));
      setIsProfileModalOpen(false);
      toast.success(profileConfig.toasts.saveProfileSuccess, { id: toastId });
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
      toast.error(profileConfig.toasts.passwordMismatch);
      return;
    }
    if (newPassword.length < 6) {
      toast.error(profileConfig.toasts.passwordLength);
      return;
    }

    setIsPasswordChanging(true);
    const toastId = toast.loading(profileConfig.toasts.passwordLoading);

    try {
      const { error: signInError } = await auth.signInWithPassword({
        email: currentUser.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error("Password saat ini salah.");
      }

      const { error: updateError } = await auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message || "Gagal memperbarui password.");
      }

      toast.success(profileConfig.toasts.passwordSuccess, { id: toastId });
      setIsPasswordModalOpen(false);
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      let errorMessage = error.message || "Gagal mengubah password.";
      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsPasswordChanging(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm(profileConfig.prompts.deleteAccountConfirm)) return;

    const toastId = toast.loading(profileConfig.toasts.deleteAccountLoading);
    setDeletingAccount(true);
    try {
      const userId = currentUser.id || currentUser.uid;
      const token = currentSession?.access_token;

      const res = await fetch(`/api/users?userId=${userId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      
      toast.success(profileConfig.toasts.deleteAccountSuccess, { id: toastId });
      await auth.signOut();
      window.location.href = "/login";
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleLogout = async () => {
    const toastId = toast.loading("Keluar dari sesi...");
    setLoggingOut(true);
    try {
      await auth.signOut();
      toast.success("Berhasil keluar.", { id: toastId });
      window.location.href = "/login";
    } catch (err) {
      toast.error("Gagal keluar akun.", { id: toastId });
      setLoggingOut(false);
      setIsLogoutModalOpen(false);
    }
  };

  const updateAddressesOnServer = async (
    updatedAddresses,
    successMessage,
    toastId,
  ) => {
    const userId = currentUser.id || currentUser.uid;
    const token = currentSession?.access_token;

    const res = await fetch("/api/users", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        userId,
        type: "addresses",
        addresses: updatedAddresses,
      }),
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
    const toastId = toast.loading(profileConfig.toasts.saveAddressLoading);
    setLoading(true);
    try {
      let updatedAddresses = [...addresses];
      
      const newAddressItem = {
        ...currentAddress,
        id: currentAddress.id || `addr_${Date.now()}`,
        label: currentAddress.label || "Rumah",
      };

      // Validasi batas maksimal 3 alamat jika sedang membuat alamat baru
      const isEditing = addresses.some((a) => a.id === newAddressItem.id);
      if (!isEditing && updatedAddresses.length >= 3) {
        toast.dismiss(toastId);
        toast.error("Maksimal hanya dapat menyimpan 3 alamat.");
        setLoading(false);
        return;
      }

      if (newAddressItem.isPrimary || updatedAddresses.length === 0) {
        updatedAddresses = updatedAddresses.map((addr) => ({
          ...addr,
          isPrimary: false,
        }));
        newAddressItem.isPrimary = true;
      }

      const existingIndex = updatedAddresses.findIndex(
        (addr) => addr.id === newAddressItem.id,
      );
      if (existingIndex > -1) {
        updatedAddresses[existingIndex] = newAddressItem;
      } else {
        updatedAddresses.push(newAddressItem);
      }

      await updateAddressesOnServer(
        updatedAddresses,
        profileConfig.toasts.saveAddressSuccess,
        toastId,
      );
      setIsAddressModalOpen(false);
      setCurrentAddress(null);
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAddress = async (id) => {
    if (!window.confirm(profileConfig.prompts.deleteAddressConfirm)) return;
    const toastId = toast.loading(profileConfig.toasts.deleteAddressLoading);
    try {
      let updatedAddresses = addresses.filter((addr) => addr.id !== id);
      if (
        updatedAddresses.length > 0 &&
        !updatedAddresses.some((a) => a.isPrimary)
      ) {
        updatedAddresses[0].isPrimary = true;
      }
      await updateAddressesOnServer(
        updatedAddresses,
        profileConfig.toasts.deleteAddressSuccess,
        toastId,
      );
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  const handleSetPrimaryAddress = async (id) => {
    const toastId = toast.loading(profileConfig.toasts.setPrimaryLoading);
    try {
      const updatedAddresses = addresses.map((addr) => ({
        ...addr,
        isPrimary: addr.id === id,
      }));
      await updateAddressesOnServer(
        updatedAddresses,
        profileConfig.toasts.setPrimarySuccess,
        toastId,
      );
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  return (
    <div className={styles.workspaceInner}>
      {/* Navbar Atas Melayang */}
      <div className={styles.shopNavbar}>
        <div className={styles.navbarActions}>
          <button
            className={styles.chatIconBtnNavbar}
            onClick={() => setIsSupportModalOpen(true)}
            aria-label="Bantuan"
            title="Pusat Bantuan"
          >
            <AppIcon name="help-circle" className={styles.svgIcon} />
          </button>
          <button
            className={styles.cartIconBtnNavbar}
            onClick={() => setIsSettingsModalOpen(true)}
            aria-label="Pengaturan"
            title="Pengaturan Akun"
          >
            <AppIcon name="settings" className={styles.svgIcon} />
          </button>
        </div>
      </div>

      {/* Header Info: Foto dan Nama Pengguna */}
      <div className={`card ${styles.sectionHeaderCard}`} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div className={styles.avatar}>
          {profile.photoURL ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={profile.photoURL} alt="Avatar" />
          ) : (
            <span>👤</span>
          )}
        </div>
        <div>
          <h3 className={styles.sectionHeaderTitle} style={{ margin: 0 }}>
            {profile.fullName || profile.username || "Pengguna"}
          </h3>
          <p className={styles.sectionHeaderSubtitle} style={{ margin: "4px 0 0 0" }}>
            {profile.email || "VIP Collector"}
          </p>
        </div>
      </div>

      {/* OrdersSection */}
      <div className="card" style={{ padding: "0", background: "transparent", border: "none", boxShadow: "none" }}>
        <OrdersSection />
      </div>

      {/* WishlistSection */}
      <div className="card" style={{ padding: "0", background: "transparent", border: "none", boxShadow: "none" }}>
        <WishlistSection />
      </div>

      {/* ====================================================
         MODAL PENGATURAN UTAMA
         ==================================================== */}
      {isSettingsModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsSettingsModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "550px" }}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Pengaturan Akun</h3>
              <button onClick={() => setIsSettingsModalOpen(false)} className={styles.closeModalBtn}>✕</button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "10px 0" }}>
              {/* Menu 1: Edit Profil */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "var(--surface-secondary)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-primary)" }}>Edit Informasi Profil</h4>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.75rem", color: "var(--text-secondary)" }}>Perbarui nama, username, nomor telepon & avatar.</p>
                </div>
                <button
                  onClick={() => {
                    setTempProfile(profile);
                    setIsProfileModalOpen(true);
                  }}
                  className={styles.actionBtnOutline}
                >
                  Ubah
                </button>
              </div>

              {/* Menu 2: Kelola Alamat (Maksimal 3 Alamat) */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "var(--surface-secondary)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-primary)" }}>
                    Buku Alamat Pengiriman <span style={{ fontSize: "0.75rem", color: "var(--primary-accent)", fontWeight: 600 }}>({addresses.length}/3)</span>
                  </h4>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.75rem", color: "var(--text-secondary)" }}>Atur alamat utama dan kantor (maksimal 3 alamat).</p>
                </div>
                <button
                  onClick={() => setIsManageAddressModalOpen(true)}
                  className={styles.actionBtnPrimary}
                >
                  Kelola Alamat
                </button>
              </div>

              {/* Menu 3: Ganti Password */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "var(--surface-secondary)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-primary)" }}>Keamanan & Password</h4>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.75rem", color: "var(--text-secondary)" }}>Ganti kata sandi akun secara berkala.</p>
                </div>
                <button
                  onClick={() => setIsPasswordModalOpen(true)}
                  className={styles.actionBtnPrimary}
                >
                  Ganti
                </button>
              </div>

              {/* Menu 4: Logout & Hapus Akun */}
              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                  onClick={() => setIsLogoutModalOpen(true)}
                  className={styles.actionBtnDanger}
                  style={{ flex: 1, padding: "0.75rem" }}
                >
                  Keluar Akun (Logout)
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className={styles.actionBtnDanger}
                  style={{ flex: 1, padding: "0.75rem", background: "transparent", border: "1px solid var(--danger-color, #ef4444)", color: "var(--danger-color, #ef4444)" }}
                >
                  {deletingAccount ? "Menghapus..." : "Hapus Akun"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
         MODAL KELOLA & LIST DAFTAR ALAMAT (Maks 3 Alamat)
         ==================================================== */}
      {isManageAddressModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsManageAddressModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Buku Alamat Saya ({addresses.length}/3)</h3>
              <button onClick={() => setIsManageAddressModalOpen(false)} className={styles.closeModalBtn}>✕</button>
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
                          <button onClick={() => handleSetPrimaryAddress(addr.id)} style={{ background: "transparent", border: "1px solid var(--border-color)", color: "var(--text-secondary)", fontSize: "0.7rem", padding: "3px 8px", borderRadius: "4px", cursor: "pointer" }}>
                            Jadikan Utama
                          </button>
                        )}
                        <button onClick={() => { setCurrentAddress(addr); setIsAddressModalOpen(true); }} style={{ background: "transparent", border: "1px solid var(--border-color)", color: "var(--text-primary)", fontSize: "0.7rem", padding: "3px 8px", borderRadius: "4px", cursor: "pointer" }}>
                          Edit
                        </button>
                        <button onClick={() => handleDeleteAddress(addr.id)} style={{ background: "rgba(var(--danger-color-rgb), 0.1)", border: "1px solid rgba(var(--danger-color-rgb), 0.3)", color: "var(--danger-color)", fontSize: "0.7rem", padding: "3px 8px", borderRadius: "4px", cursor: "pointer" }}>
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

              {/* Tombol Tambah Alamat (Disabled jika sudah 3) */}
              {addresses.length < 3 ? (
                <button
                  onClick={() => {
                    setCurrentAddress({
                      id: null,
                      label: addresses.length === 0 ? "Rumah" : "Kantor",
                      recipientName: profile.fullName,
                      recipientPhone: profile.phone,
                      street: "",
                      province: "",
                      city: "",
                      cityId: "",
                      cityType: "",
                      postalCode: "",
                      isPrimary: addresses.length === 0,
                    });
                    setIsAddressModalOpen(true);
                  }}
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
      )}

      {/* ====================================================
         MODAL KONFIRMASI LOGOUT ELEGAN
         ==================================================== */}
      {isLogoutModalOpen && (
        <div className={styles.modalOverlay} onClick={() => !loggingOut && setIsLogoutModalOpen(false)}>
          <div 
            className={styles.modalContent} 
            onClick={(e) => e.stopPropagation()} 
            style={{ maxWidth: "400px", textAlign: "center", padding: "32px 24px", gap: "20px" }}
          >
            <div style={{ 
              width: "56px", 
              height: "56px", 
              borderRadius: "50%", 
              background: "rgba(var(--primary-accent-rgb), 0.12)", 
              color: "var(--primary-accent)", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              margin: "0 auto" 
            }}>
              <AppIcon name="log-out" size={26} strokeWidth={2} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <h3 style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: "1.2rem", fontWeight: 500, color: "var(--text-primary)" }}>
                Keluar dari Akun?
              </h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                Anda harus masuk kembali menggunakan kredensial akun Anda untuk mengakses riwayat pesanan dan fitur member.
              </p>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(false)}
                disabled={loggingOut}
                style={{ flex: 1, padding: "0.75rem", borderRadius: "6px", background: "var(--surface-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", cursor: "pointer" }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                style={{ flex: 1, padding: "0.75rem", borderRadius: "6px", background: "var(--primary-accent)", border: "1px solid var(--primary-accent)", color: "var(--primary-accent-text)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", cursor: "pointer", opacity: loggingOut ? 0.7 : 1 }}
              >
                {loggingOut ? "Keluar..." : "Ya, Keluar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
         MODAL BANTUAN / SUPPORT CENTER
         ==================================================== */}
      {isSupportModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsSupportModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px", padding: "0", background: "transparent", border: "none" }}>
            <SupportCenter onClose={() => setIsSupportModalOpen(false)} />
          </div>
        </div>
      )}

      {/* ====================================================
         MODAL SUBSIDIARIS (Edit Profil, Tambah/Edit Alamat, Password)
         ==================================================== */}
      {isProfileModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsProfileModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{profileConfig.modals.editProfile.title}</h3>
              <button onClick={() => setIsProfileModalOpen(false)} className={styles.closeModalBtn}>✕</button>
            </div>
            <form onSubmit={handleSaveProfile}>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>{profileConfig.modals.editProfile.avatarLabel}</label>
                <div className={styles.avatarUpload}>
                  <div className={styles.avatar} style={{ width: 60, height: 60 }}>
                    {tempProfile.photoURL ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={tempProfile.photoURL} alt="Avatar" />
                    ) : (
                      <span>👤</span>
                    )}
                  </div>
                  <input type="file" id="avatar-upload" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage || removingImage} style={{ display: "none" }} />
                  <label htmlFor="avatar-upload" className={styles.actionBtnOutline} style={{ cursor: "pointer" }}>{profileConfig.modals.editProfile.selectImage}</label>
                  {tempProfile.photoURL && (
                    <button type="button" onClick={handleRemoveAvatar} disabled={uploadingImage || removingImage} className={styles.actionBtnDanger}>
                      {profileConfig.modals.editProfile.removeImage}
                    </button>
                  )}
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>{profileConfig.modals.editProfile.username}</label>
                <div className={styles.inputWithPrefix}>
                  <span>@</span>
                  <input type="text" value={tempProfile.username || ""} onChange={handleUsernameChange} required />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>{profileConfig.modals.editProfile.fullName}</label>
                <input type="text" value={tempProfile.fullName || ""} onChange={(e) => setTempProfile({ ...tempProfile, fullName: e.target.value })} className={styles.formInput} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>{profileConfig.modals.editProfile.phone}</label>
                <input type="text" value={tempProfile.phone || ""} onChange={(e) => setTempProfile({ ...tempProfile, phone: e.target.value })} className={styles.formInput} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>{profileConfig.modals.editProfile.birthDate}</label>
                <input type="date" value={tempProfile.birthDate || ""} onChange={(e) => setTempProfile({ ...tempProfile, birthDate: e.target.value })} className={styles.formInput} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>{profileConfig.modals.editProfile.gender}</label>
                <select value={tempProfile.gender || ""} onChange={(e) => setTempProfile({ ...tempProfile, gender: e.target.value })} className={styles.formSelect}>
                  <option value="">{profileConfig.modals.editProfile.genderOptions.placeholder}</option>
                  <option value="Male">{profileConfig.modals.editProfile.genderOptions.male}</option>
                  <option value="Female">{profileConfig.modals.editProfile.genderOptions.female}</option>
                </select>
              </div>
              <div className={styles.formGroupCheckbox}>
                <input type="checkbox" id="newsletter" checked={tempProfile.newsletterSubscribed ?? true} onChange={(e) => setTempProfile({ ...tempProfile, newsletterSubscribed: e.target.checked })} />
                <label htmlFor="newsletter">{profileConfig.modals.editProfile.newsletterLabel}</label>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" onClick={() => setIsProfileModalOpen(false)} className={styles.actionBtnOutline}>{profileConfig.modals.editProfile.cancel}</button>
                <button type="submit" disabled={loading || uploadingImage || removingImage} className={styles.actionBtnPrimary}>
                  {loading ? profileConfig.modals.editProfile.saving : profileConfig.modals.editProfile.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddressModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsAddressModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{currentAddress?.id ? "Edit Alamat" : "Tambah Alamat Baru"}</h3>
              <button onClick={() => setIsAddressModalOpen(false)} className={styles.closeModalBtn}>✕</button>
            </div>
            <form onSubmit={handleSaveAddress}>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>Label Alamat (Contoh: Rumah, Kantor)</label>
                <input type="text" value={currentAddress.label} onChange={(e) => setCurrentAddress({ ...currentAddress, label: e.target.value })} required className={styles.formInput} placeholder="Rumah / Kantor / Apartemen" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>{profileConfig.modals.address.recipientName}</label>
                <input type="text" value={currentAddress.recipientName} onChange={(e) => setCurrentAddress({ ...currentAddress, recipientName: e.target.value })} required className={styles.formInput} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>{profileConfig.modals.address.recipientPhone}</label>
                <input type="text" value={currentAddress.recipientPhone} onChange={(e) => setCurrentAddress({ ...currentAddress, recipientPhone: e.target.value })} required className={styles.formInput} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>{profileConfig.modals.address.street}</label>
                <textarea rows="2" value={currentAddress.street} onChange={(e) => setCurrentAddress({ ...currentAddress, street: e.target.value })} required className={styles.formTextarea} placeholder="Nama jalan, nomor rumah, RT/RW, Patokan..." />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>{profileConfig.modals.address.city}</label>
                <ProvinceCitySelect value={{ province: currentAddress.province, city: currentAddress.city, cityId: currentAddress.cityId, cityType: currentAddress.cityType }} onChange={(next) => setCurrentAddress((prev) => ({ ...prev, ...next }))} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>{profileConfig.modals.address.postalCode}</label>
                <input type="text" value={currentAddress.postalCode} onChange={(e) => setCurrentAddress({ ...currentAddress, postalCode: e.target.value })} required className={styles.formInput} />
              </div>
              <div className={styles.modalFooter}>
                <button type="button" onClick={() => setIsAddressModalOpen(false)} className={styles.actionBtnOutline}>{profileConfig.modals.address.cancel}</button>
                <button type="submit" disabled={loading} className={styles.actionBtnPrimary}>
                  {loading ? profileConfig.modals.address.saving : profileConfig.modals.address.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPasswordModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsPasswordModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{profileConfig.modals.password.title}</h3>
              <button onClick={() => setIsPasswordModalOpen(false)} className={styles.closeModalBtn}>✕</button>
            </div>
            <form onSubmit={handlePasswordChange}>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>{profileConfig.modals.password.current}</label>
                <input type="password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} className={styles.formInput} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>{profileConfig.modals.password.new}</label>
                <input type="password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} className={styles.formInput} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>{profileConfig.modals.password.confirm}</label>
                <input type="password" value={passwords.confirmPassword} onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })} className={styles.formInput} required />
              </div>
              <div className={styles.modalFooter}>
                <button type="button" onClick={() => setIsPasswordModalOpen(false)} className={styles.actionBtnOutline}>{profileConfig.modals.password.cancel}</button>
                <button type="submit" disabled={isPasswordChanging} className={styles.actionBtnPrimary}>
                  {isPasswordChanging ? profileConfig.modals.password.submitting : profileConfig.modals.password.submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}