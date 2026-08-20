"use client";

import { useState, useEffect, lazy, Suspense, useCallback, useRef } from "react";
import styles from "./UserProfil.module.css";
import profileConfig from "@/data/ui/userProfilConfig.json";
import { auth } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { OrdersSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";
import MyVouchers from "@/components/Dashboard/User/Vouchers/MyVouchers";

// Import komponen modular baru
import ProfileHeader from "./ProfileHeader";
import AddressManagerModal from "./AddressManagerModal";
import { EditProfileModal, AddressFormModal, PasswordModal } from "./ProfileModals";
import { shouldSkipAuthEvent } from "@/utils/authHelpers";

const OrdersSection = lazy(() => import("@/components/Dashboard/User/Order/OrdersSection"));
const WishlistSection = lazy(() => import("@/components/Dashboard/User/Wishlist/WishlistSection"));
const SupportCenter = lazy(() => import("@/components/Dashboard/User/Support/SupportCenter"));
const UserSettings = lazy(() => import("@/components/Dashboard/User/Settings/UserSettings"));

export default function ProfileSection() {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [isPasswordChanging, setIsPasswordChanging] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  
  const [activeTab, setActiveTab] = useState("profile");
  const [isManageAddressModalOpen, setIsManageAddressModalOpen] = useState(false);

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
    user_vouchers: [], 
  });

  const [availableVouchers, setAvailableVouchers] = useState([]);
  const [addresses, setAddresses] = useState([]);

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
      return pathWithoutVersion.substring(0, pathWithoutVersion.lastIndexOf("."));
    } catch (e) {
      console.error("Gagal mengekstrak public_id:", e);
      return "";
    }
  };

  useEffect(() => {
    let lastUserId = null;
    
    const getSessionData = async () => {
      const { data: { session } } = await auth.getSession();
      lastUserId = session?.user?.id || null;
      setCurrentSession(session);
      setCurrentUser(session?.user ?? null);
    };

    getSessionData();

    const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
      if (shouldSkipAuthEvent(event, session, lastUserId)) return;
      lastUserId = session?.user?.id || null;

      if (event === "TOKEN_REFRESHED") {
        setCurrentSession(session);
        return; 
      }
      setCurrentSession(session);
      setCurrentUser(session?.user ?? null);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!currentUser || !currentSession) {
      setProfile({ username: "", fullName: "", gender: "", birthDate: "", phone: "", email: "", photoURL: "", photoPublicId: "", memberTier: "VIP Collector", newsletterSubscribed: true, user_vouchers: [] });
      setAvailableVouchers([]);
      setAddresses([]);
      return;
    }

    try {
      const userId = currentUser.id;
      const token = currentSession.access_token;
      const headers = { Authorization: `Bearer ${token}` };

      const [res, resVouchers] = await Promise.all([
        fetch(`/api/profile`, { headers }),
        fetch(`/api/vouchers/available`, { headers })
      ]);
      
      const result = res.ok ? await res.json() : {};
      const resultVouchers = resVouchers.ok ? await resVouchers.json() : {};

      if (resVouchers.ok && resultVouchers.success) {
        setAvailableVouchers(resultVouchers.vouchers || []);
      }

      const defaultUsername = currentUser.email?.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "") || `user_${userId.substring(0, 5)}`;
      const defaultPhoto = currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || "";
      const defaultFullName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || "";

      if (res.ok && result.success && result.profile) {
        const data = result.profile;
        const photoUrlToUse = data.photo_url || defaultPhoto;
        
        const rawVouchers = data.user_vouchers || [];
        const formattedVouchers = rawVouchers.map((v) => ({
          ...v,
          voucher_id: Number(v.voucher_id || v.vouchers?.id || 0),
        }));

        setProfile({
          username: data.username || defaultUsername,
          fullName: data.full_name || defaultFullName,
          gender: data.gender || "",
          birthDate: data.birth_date || "",
          phone: data.phone || currentUser.phone || "",
          email: currentUser.email || "",
          photoURL: photoUrlToUse,
          photoPublicId: data.photo_public_id || extractPublicIdFromUrl(photoUrlToUse),
          memberTier: data.member_tier || "VIP Collector",
          newsletterSubscribed: data.newsletter_subscribed ?? true,
          user_vouchers: formattedVouchers, 
        });
        setAddresses(data.addresses || []);
      } else {
        setProfile({
          username: defaultUsername,
          fullName: defaultFullName,
          phone: currentUser.phone || "",
          email: currentUser.email || "",
          photoURL: defaultPhoto,
          photoPublicId: extractPublicIdFromUrl(defaultPhoto),
          memberTier: "VIP Collector",
          newsletterSubscribed: true,
          gender: "",
          birthDate: "",
          user_vouchers: [], 
        });
        setAddresses([]);
      }
    } catch (err) {
      console.error("Gagal memuat profil:", err);
      toast.error(profileConfig.toasts.fetchError);
    }
  }, [currentUser?.id, currentSession]); 

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]); 

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
      if (tempProfile.photoPublicId) data.append("oldPublicId", tempProfile.photoPublicId);
      else if (tempProfile.photoURL) data.append("oldUrl", tempProfile.photoURL);

      const res = await fetch("/api/cloudinary", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: data,
      });
      const result = await res.json();

      if (res.ok && result.secure_url) {
        setTempProfile((prev) => ({ ...prev, photoURL: result.secure_url, photoPublicId: result.public_id }));
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
    if (!currentUser || !currentSession || !tempProfile.photoURL || !window.confirm(profileConfig.prompts.removeAvatarConfirm)) return;

    const toastId = toast.loading(profileConfig.toasts.removeAvatarLoading);
    setRemovingImage(true);
    try {
      const userId = currentUser.id || currentUser.uid;
      const token = currentSession.access_token;

      const res = await fetch("/api/cloudinary", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ userId, publicId: tempProfile.photoPublicId }),
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
      const token = currentSession?.access_token;
      const payload = {
        username: cleanUsername,
        full_name: tempProfile.fullName,
        phone: tempProfile.phone,
        gender: tempProfile.gender,
        birth_date: tempProfile.birthDate,
        photo_url: tempProfile.photoURL,
        photo_public_id: tempProfile.photoPublicId,
        newsletter_subscribed: tempProfile.newsletterSubscribed,
      };

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal menyimpan profil.");

      setProfile((prev) => ({ ...prev, ...tempProfile, username: cleanUsername }));
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
      const { error: signInError } = await auth.signInWithPassword({ email: currentUser.email, password: currentPassword });
      if (signInError) throw new Error("Password saat ini salah.");

      const { error: updateError } = await auth.updateUser({ password: newPassword });
      if (updateError) throw new Error(updateError.message || "Gagal memperbarui password.");

      toast.success(profileConfig.toasts.passwordSuccess, { id: toastId });
      setIsPasswordModalOpen(false);
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      toast.error(error.message || "Gagal mengubah password.", { id: toastId });
    } finally {
      setIsPasswordChanging(false);
    }
  };

  const handleDeleteAccount = async () => {

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
    if (loggingOut) return;
    const toastId = toast.loading("Keluar dari sesi...");
    setLoggingOut(true);
    try {
      await auth.signOut();
      toast.success("Berhasil keluar.", { id: toastId });
      window.location.href = "/login";
    } catch (err) {
      toast.error("Gagal keluar akun.", { id: toastId });
      setLoggingOut(false);
    }
  };

  const updateAddressesOnServer = async (updatedAddresses, successMessage, toastId) => {
    const token = currentSession?.access_token;
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ addresses: updatedAddresses }),
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

      const isEditing = addresses.some((a) => a.id === newAddressItem.id);
      if (!isEditing && updatedAddresses.length >= 3) {
        toast.dismiss(toastId);
        toast.error("Maksimal hanya dapat menyimpan 3 alamat.");
        setLoading(false);
        return;
      }

      if (newAddressItem.isPrimary || updatedAddresses.length === 0) {
        updatedAddresses = updatedAddresses.map((addr) => ({ ...addr, isPrimary: false }));
        newAddressItem.isPrimary = true;
      }

      const existingIndex = updatedAddresses.findIndex((addr) => addr.id === newAddressItem.id);
      if (existingIndex > -1) {
        updatedAddresses[existingIndex] = newAddressItem;
      } else {
        updatedAddresses.push(newAddressItem);
      }

      await updateAddressesOnServer(updatedAddresses, profileConfig.toasts.saveAddressSuccess, toastId);
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
      if (updatedAddresses.length > 0 && !updatedAddresses.some((a) => a.isPrimary)) {
        updatedAddresses[0].isPrimary = true;
      }
      await updateAddressesOnServer(updatedAddresses, profileConfig.toasts.deleteAddressSuccess, toastId);
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  const handleSetPrimaryAddress = async (id) => {
    const toastId = toast.loading(profileConfig.toasts.setPrimaryLoading);
    try {
      const updatedAddresses = addresses.map((addr) => ({ ...addr, isPrimary: addr.id === id }));
      await updateAddressesOnServer(updatedAddresses, profileConfig.toasts.setPrimarySuccess, toastId);
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  return (
    <div className={styles.workspaceInner}>
      {/* Konten Tab Aktif */}
      <Suspense fallback={<OrdersSkeleton count={3} />}>
        {activeTab === "settings" ? (
          <UserSettings
            profile={profile}
            addresses={addresses}
            deletingAccount={deletingAccount}
            onBackToProfile={() => setActiveTab("profile")}
            onOpenProfileModal={() => { setTempProfile(profile); setIsProfileModalOpen(true); }}
            onOpenManageAddressModal={() => setIsManageAddressModalOpen(true)}
            onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
            onOpenLogoutModal={handleLogout}
            onDeleteAccount={handleDeleteAccount}
          />
        ) : activeTab === "wishlist" ? (
          <div className={styles.tabContainer}>
            <div className={styles.tabHeaderCard}>
              <button onClick={() => setActiveTab("profile")} className={styles.backToProfileBtn}>
                <AppIcon name="arrow-left" size={16} />
                <span>Kembali ke Profil</span>
              </button>
              <h3 className={styles.tabTitle}>Wishlist Saya</h3>
            </div>
            <WishlistSection />
          </div>
        ) : activeTab === "support" ? (
          <div className={styles.tabContainer}>
            <div className={styles.tabHeaderCard}>
              <button onClick={() => setActiveTab("profile")} className={styles.backToProfileBtn}>
                <AppIcon name="arrow-left" size={16} />
                <span>Kembali ke Profil</span>
              </button>
              <h3 className={styles.tabTitle}>Pusat Bantuan</h3>
            </div>
            <SupportCenter onClose={() => setActiveTab("profile")} />
          </div>
        ) : (
          <>
            {/* Wrapper Header Profil yang menyatukan Tombol Navbar di Pojok Kanan Atas */}
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", top: "1rem", right: "1rem", zIndex: 10, display: "flex", gap: "0.5rem" }}>
                <button 
                  className={styles.chatIconBtnNavbar} 
                  onClick={() => setActiveTab("support")} 
                  title="Pusat Bantuan" 
                  style={activeTab === "support" ? { color: "var(--primary-accent)", borderColor: "var(--primary-accent)" } : {}}
                >
                  <AppIcon name="help-circle" className={styles.svgIcon} />
                </button>
                <button 
                  className={styles.chatIconBtnNavbar} 
                  onClick={() => setActiveTab("wishlist")} 
                  title="Wishlist Saya" 
                  style={activeTab === "wishlist" ? { color: "var(--primary-accent)", borderColor: "var(--primary-accent)" } : {}}
                >
                  <AppIcon name="heart" className={styles.svgIcon} />
                </button>
                <button 
                  className={styles.cartIconBtnNavbar} 
                  onClick={() => setActiveTab("settings")} 
                  title="Pengaturan Akun" 
                  style={activeTab === "settings" ? { color: "var(--primary-accent)", borderColor: "var(--primary-accent)" } : {}}
                >
                  <AppIcon name="settings" className={styles.svgIcon} />
                </button>
              </div>

              <ProfileHeader profile={profile} />
            </div>

            <div className="card" style={{ padding: "0", background: "transparent", border: "none", boxShadow: "none" }}>
              <OrdersSection />
            </div>
            <MyVouchers
              availableVouchers={availableVouchers}
              claimedVouchers={profile.user_vouchers || []}
              refreshProfile={fetchProfile}
            />
          </>
        )}
      </Suspense>

      {/* Modal Terpisah */}
      <AddressManagerModal
        isOpen={isManageAddressModalOpen}
        onClose={() => setIsManageAddressModalOpen(false)}
        addresses={addresses}
        onSetPrimary={handleSetPrimaryAddress}
        onEdit={(addr) => { setCurrentAddress(addr); setIsAddressModalOpen(true); }}
        onDelete={handleDeleteAddress}
        onOpenAdd={() => {
          setCurrentAddress({
            id: null,
            label: addresses.length === 0 ? "Rumah" : "Kantor",
            recipientName: profile.fullName,
            recipientPhone: profile.phone,
            street: "", province: "", city: "", cityId: "", cityType: "", postalCode: "",
            isPrimary: addresses.length === 0,
          });
          setIsAddressModalOpen(true);
        }}
      />

      <EditProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profileConfig={profileConfig}
        tempProfile={tempProfile}
        setTempProfile={setTempProfile}
        handleUsernameChange={handleUsernameChange}
        handleImageUpload={handleImageUpload}
        handleRemoveAvatar={handleRemoveAvatar}
        handleSaveProfile={handleSaveProfile}
        uploadingImage={uploadingImage}
        removingImage={removingImage}
        loading={loading}
      />

      <AddressFormModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        currentAddress={currentAddress}
        setCurrentAddress={setCurrentAddress}
        handleSaveAddress={handleSaveAddress}
        profileConfig={profileConfig}
        loading={loading}
      />

      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        passwords={passwords}
        setPasswords={setPasswords}
        handlePasswordChange={handlePasswordChange}
        profileConfig={profileConfig}
        isPasswordChanging={isPasswordChanging}
      />
    </div>
  );
}