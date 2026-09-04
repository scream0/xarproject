"use client";

import { useState, useEffect, lazy, Suspense, useCallback, useRef } from "react";
import styles from "./UserProfil.module.css";
import profileConfig from "@/data/ui/userProfilConfig.json";
import { auth } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { OrdersSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";
import MyVouchers from "@/components/Dashboard/User/Vouchers/MyVouchers";

import ProfileHeader from "./ProfileHeader";
import AddressManagerModal from "./AddressManagerModal";
import { EditProfileModal, AddressFormModal, PasswordModal, OTPModal } from "./ProfileModals";
import { shouldSkipAuthEvent, logoutUser } from "@/utils/authHelpers";
import ConfirmationModal from "@/components/UI/Modal/ConfirmationModal";


const WishlistSection = lazy(() => import("@/components/Dashboard/User/Wishlist/WishlistSection"));
const UserSettings = lazy(() => import("@/components/Dashboard/User/Settings/UserSettings"));
const WalletSection = lazy(() => import("@/components/Dashboard/User/Wallet/WalletSection"));

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
    bankName: "",
    bankAccountNumber: "",
    bankAccountName: "",
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

  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otpPhone, setOtpPhone] = useState("");

  const [verifiedPhones, setVerifiedPhones] = useState([]);
  const [isAddressOtpModalOpen, setIsAddressOtpModalOpen] = useState(false);
  const [addressOtpPhone, setAddressOtpPhone] = useState("");

  const [currentSession, setCurrentSession] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const [isAvatarDeleteConfirmOpen, setIsAvatarDeleteConfirmOpen] = useState(false);
  const [addressToDeleteId, setAddressToDeleteId] = useState(null);

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
      setProfile({ username: "", fullName: "", gender: "", birthDate: "", phone: "", email: "", photoURL: "", photoPublicId: "", memberTier: "VIP Collector", newsletterSubscribed: true, user_vouchers: [], bankName: "", bankAccountNumber: "", bankAccountName: "" });
      setAvailableVouchers([]);
      setAddresses([]);
      return;
    }

    try {
      const userId = currentUser.id;
      const token = currentSession.access_token;
      const headers = { Authorization: `Bearer ${token}` };

      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const [res, resVouchers, resAddresses] = await Promise.all([
        fetch(`${apiBase}/api/user/profile`, { headers, cache: "no-store" }),
        fetch(`${apiBase}/api/user/vouchers/available`, { headers, cache: "no-store" }),
        fetch(`${apiBase}/api/user/${userId}/addresses`, { headers, cache: "no-store" })
      ]);
      
      let result = {};
      let resultVouchers = {};
      let resultAddresses = [];
      try {
        if (res.ok) {
          const text = await res.text();
          result = text ? JSON.parse(text) : {};
        }
        if (resVouchers.ok) {
          const text = await resVouchers.text();
          resultVouchers = text ? JSON.parse(text) : {};
        }
        if (resAddresses.ok) {
          const text = await resAddresses.text();
          resultAddresses = text ? JSON.parse(text) : [];
        }
      } catch (e) {
        console.error("API response parsing failed:", e);
      }

      let availableList = resultVouchers.data || resultVouchers.vouchers || [];
      if (!availableList || availableList.length === 0) {
        try {
          const pubRes = await fetch(`${apiBase}/api/vouchers/public`, { cache: "no-store" });
          if (pubRes.ok) {
            const pubData = await pubRes.json();
            availableList = pubData.data || pubData.vouchers || [];
          }
        } catch (e) {
          console.error("Gagal load public vouchers fallback:", e);
        }
      }
      setAvailableVouchers(availableList);

      const defaultUsername = currentUser.email?.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "") || `user_${userId.substring(0, 5)}`;
      const defaultPhoto = currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || "";
      const defaultFullName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || "";

      if (res.ok && result.exists && result.data) {
        const data = result.data;
        const photoUrlToUse = data.avatar_url || defaultPhoto;
        
        const rawVouchers = data.user_vouchers || [];
        const formattedVouchers = rawVouchers.map((v) => ({
          ...v,
          id: String(v.id || v.voucher_id || ""),
          voucher_id: String(v.voucher_id || v.vouchers?.id || v.id || ""),
          vouchers: v.vouchers || v,
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
          bankName: data.bank_name || "",
          bankAccountNumber: data.bank_account_number || "",
          bankAccountName: data.bank_account_name || "",
        });
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
          bankName: "",
          bankAccountNumber: "",
          bankAccountName: "",
        });
      }
      
      setAddresses(Array.isArray(resultAddresses) ? resultAddresses : []);
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
      data.append("folder", "avatars");
      data.append("publicId", `avatar-${userId}`);
      if (tempProfile.photoPublicId) data.append("oldPublicId", tempProfile.photoPublicId);
      if (tempProfile.photoURL) data.append("oldUrl", tempProfile.photoURL);

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/cloudinary", {
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

  const handleRemoveAvatar = () => {
    if (!currentUser || !currentSession || !tempProfile.photoURL) return;
    setIsAvatarDeleteConfirmOpen(true);
  };

  const confirmRemoveAvatar = async () => {
    if (!currentUser || !currentSession || !tempProfile.photoURL) return;
    setIsAvatarDeleteConfirmOpen(false);

    const toastId = toast.loading(profileConfig.toasts.removeAvatarLoading);
    setRemovingImage(true);
    try {
      const userId = currentUser.id || currentUser.uid;
      const token = currentSession.access_token;

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/cloudinary", {
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

  const saveProfileDirectly = async (cleanUsername) => {
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
        bank_name: tempProfile.bankName,
        bank_account_number: tempProfile.bankAccountNumber,
        bank_account_name: tempProfile.bankAccountName,
      };

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/profile", {
        method: "POST",
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

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const cleanUsername = tempProfile.username?.trim();
    if (!cleanUsername) {
      toast.error("Username tidak boleh kosong.");
      return;
    }

    // Jika nomor HP berubah dan tidak kosong, trigger OTP
    if (tempProfile.phone && tempProfile.phone !== profile.phone) {
      const toastId = toast.loading("Mengirim kode verifikasi WhatsApp...");
      setLoading(true);
      try {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/auth/send-whatsapp-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: tempProfile.phone }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Gagal mengirim OTP");
        
        toast.dismiss(toastId);
        setOtpPhone(tempProfile.phone);
        setIsOtpModalOpen(true);
      } catch (err) {
        toast.error(err.message, { id: toastId });
      } finally {
        setLoading(false);
      }
      return;
    }

    await saveProfileDirectly(cleanUsername);
  };

  const handleVerifyOTP = async (otp) => {
    const toastId = toast.loading("Memverifikasi OTP...");
    setLoading(true);
    try {
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/auth/verify-whatsapp-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: otpPhone, code: otp }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "OTP tidak valid");
      
      toast.success("Nomor telepon diverifikasi!", { id: toastId });
      setIsOtpModalOpen(false);
      
      const cleanUsername = tempProfile.username?.trim();
      await saveProfileDirectly(cleanUsername);
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleSendAddressOtp = async (phone) => {
    const toastId = toast.loading("Mengirim kode verifikasi WhatsApp...");
    setLoading(true);
    try {
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/auth/send-whatsapp-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal mengirim OTP");
      
      toast.dismiss(toastId);
      setAddressOtpPhone(phone);
      setIsAddressOtpModalOpen(true);
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAddressOtp = async (otp) => {
    const toastId = toast.loading("Memverifikasi OTP...");
    setLoading(true);
    try {
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/auth/verify-whatsapp-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: addressOtpPhone, code: otp }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "OTP tidak valid");
      
      toast.success("Nomor telepon diverifikasi!", { id: toastId });
      setIsAddressOtpModalOpen(false);
      setVerifiedPhones((prev) => [...prev, addressOtpPhone]);
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

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/user/profile`, {
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
    toast.loading("Keluar dari sesi...", { id: "user-logout" });
    await logoutUser();
  };

  const fetchAddressesFromServer = async () => {
    const token = currentSession?.access_token;
    const userId = currentSession?.user?.id;
    if (!userId) return;
    
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
    const res = await fetch(`${apiBase}/api/user/${userId}/addresses`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      setAddresses(Array.isArray(data) ? data : []);
    }
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    const toastId = toast.loading(profileConfig.toasts.saveAddressLoading);
    setLoading(true);
    try {
      const isEditing = !!currentAddress.id;
      if (!isEditing && addresses.length >= 3) {
        toast.dismiss(toastId);
        toast.error("Maksimal hanya dapat menyimpan 3 alamat.");
        setLoading(false);
        return;
      }

      const isPrimary = currentAddress.isPrimary || addresses.length === 0;
      const payload = {
        recipientName: currentAddress.recipientName,
        recipientPhone: currentAddress.recipientPhone,
        street: currentAddress.street,
        city: currentAddress.city,
        cityId: currentAddress.cityId,
        province: currentAddress.province,
        postalCode: currentAddress.postalCode,
        label: currentAddress.label || "Rumah",
        isPrimary: isPrimary
      };

      const token = currentSession?.access_token;
      const userId = currentSession?.user?.id;
      const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";

      let res;
      if (isEditing) {
        res = await fetch(`${apiBase}/api/user/${userId}/addresses/${currentAddress.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${apiBase}/api/user/${userId}/addresses`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Gagal menyimpan alamat.");
      }

      await fetchAddressesFromServer();
      toast.success(profileConfig.toasts.saveAddressSuccess, { id: toastId });
      setIsAddressModalOpen(false);
      setCurrentAddress(null);
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAddress = (id) => {
    setAddressToDeleteId(id);
  };

  const confirmDeleteAddress = async () => {
    if (!addressToDeleteId) return;
    const id = addressToDeleteId;
    setAddressToDeleteId(null);
    const toastId = toast.loading(profileConfig.toasts.deleteAddressLoading);
    try {
      const token = currentSession?.access_token;
      const userId = currentSession?.user?.id;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiBase}/api/user/${userId}/addresses/${id}`, {
        method: "DELETE",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Gagal menghapus alamat.");
      }
      
      await fetchAddressesFromServer();
      toast.success(profileConfig.toasts.deleteAddressSuccess, { id: toastId });
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  const handleSetPrimaryAddress = async (id) => {
    const toastId = toast.loading("Mengubah alamat utama...");
    try {
      const addressToUpdate = addresses.find((a) => a.id === id);
      if (!addressToUpdate) throw new Error("Alamat tidak ditemukan");
      
      const payload = {
        recipientName: addressToUpdate.recipientName,
        recipientPhone: addressToUpdate.recipientPhone,
        street: addressToUpdate.street,
        city: addressToUpdate.city,
        cityId: addressToUpdate.cityId,
        province: addressToUpdate.province,
        postalCode: addressToUpdate.postalCode,
        label: addressToUpdate.label,
        isPrimary: true
      };

      const token = currentSession?.access_token;
      const userId = currentSession?.user?.id;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiBase}/api/user/${userId}/addresses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Gagal mengubah alamat utama.");
      }

      await fetchAddressesFromServer();
      toast.success("Alamat utama berhasil diubah.", { id: toastId });
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
        ) : activeTab === "wallet" ? (
          <div className={styles.tabContainer}>
            <div className={styles.tabHeaderCard}>
              <button onClick={() => setActiveTab("profile")} className={styles.backToProfileBtn}>
                <AppIcon name="arrow-left" size={16} />
                <span>Kembali ke Profil</span>
              </button>
              <h3 className={styles.tabTitle}>Dompet & Penarikan Dana</h3>
            </div>
            <WalletSection profile={profile} />
          </div>
        ) : (
          <>
            {/* Wrapper Header Profil yang menyatukan Tombol Navbar di Pojok Kanan Atas */}
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", top: "1rem", right: "1rem", zIndex: 10, display: "flex", gap: "0.5rem" }}>
                <button 
                  className={styles.chatIconBtnNavbar} 
                  onClick={() => setActiveTab("wishlist")} 
                  title="Wishlist Saya" 
                  style={activeTab === "wishlist" ? { color: "var(--primary-accent)", borderColor: "var(--primary-accent)" } : {}}
                >
                  <AppIcon name="heart" className={styles.svgIcon} />
                </button>
                <button 
                  className={styles.chatIconBtnNavbar} 
                  onClick={() => setActiveTab("wallet")} 
                  title="Dompet & Penarikan Dana" 
                  style={activeTab === "wallet" ? { color: "var(--primary-accent)", borderColor: "var(--primary-accent)" } : {}}
                >
                  <AppIcon name="wallet" className={styles.svgIcon} />
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
        onEdit={(addr) => { 
          setCurrentAddress(addr); 
          setIsAddressModalOpen(true); 
          if (addr.recipientPhone) {
            setVerifiedPhones(prev => prev.includes(addr.recipientPhone) ? prev : [...prev, addr.recipientPhone]);
          }
        }}
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
        verifiedPhones={verifiedPhones}
        onSendOtp={handleSendAddressOtp}
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

      <OTPModal
        isOpen={isOtpModalOpen}
        onClose={() => setIsOtpModalOpen(false)}
        onSubmit={handleVerifyOTP}
        onResend={async (phone) => {
          const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/auth/send-whatsapp-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone })
          });
          if (!res.ok) toast.error("Gagal mengirim ulang OTP");
          else toast.success("Kode OTP baru telah dikirim");
        }}
        phone={otpPhone}
        loading={loading}
      />

      <OTPModal
        isOpen={isAddressOtpModalOpen}
        onClose={() => setIsAddressOtpModalOpen(false)}
        onSubmit={handleVerifyAddressOtp}
        onResend={handleSendAddressOtp}
        phone={addressOtpPhone}
        loading={loading}
      />
      
      <ConfirmationModal
        isOpen={isAvatarDeleteConfirmOpen}
        onClose={() => setIsAvatarDeleteConfirmOpen(false)}
        onConfirm={confirmRemoveAvatar}
        title="Hapus Avatar"
        message={profileConfig.prompts.removeAvatarConfirm}
      />
      
      <ConfirmationModal
        isOpen={!!addressToDeleteId}
        onClose={() => setAddressToDeleteId(null)}
        onConfirm={confirmDeleteAddress}
        title="Hapus Alamat"
        message={profileConfig.prompts.deleteAddressConfirm}
      />
    </div>
  );
}