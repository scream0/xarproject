"use client";
import { useState, useEffect } from "react";
import styles from "./UserProfil.module.css";
import profileConfig from "@/data/ui/userProfilConfig.json";
import { auth } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { ProvinceCitySelect } from "@/components/UI/ProvinceCitySelect/ProvinceCitySelect";

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

      // Listener perubahan sesi Supabase
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
      const token = currentSession?.access_token;

      // Re-autentikasi / verifikasi password lama via Supabase signInWithPassword
      const { error: signInError } = await auth.signInWithPassword({
        email: currentUser.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error("Password saat ini salah.");
      }

      // Perbarui password via Supabase updateUser
      const { error: updateError } = await auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message || "Gagal memperbarui password.");
      }

      // Sinkronisasi ke backend jika ada endpoint khusus
      await fetch("/api/users/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ newPassword }),
      });

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
      {/* Header Info */}
      <div className={`card ${styles.sectionHeaderCard}`}>
        <div>
          <h3 className={styles.sectionHeaderTitle}>
            {profileConfig.header.title}
          </h3>
          <p className={styles.sectionHeaderSubtitle}>
            {profileConfig.header.subtitle}
          </p>
        </div>
      </div>

      {/* Grid Ringkasan Profil */}
      <div className={styles.profileOverviewGrid}>
        <div className="card">
          <div className={styles.cardHeaderFlex}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div className={styles.avatar}>
                {profile.photoURL ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={profile.photoURL} alt="Avatar" />
                ) : (
                  <span>👤</span>
                )}
              </div>
              <h4 className={styles.cardTitle}>
                {profileConfig.labels.personalInfo}
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
          <div className={styles.profileInfoList}>
            <div className={styles.infoRow}>
              <span>{profileConfig.labels.username}</span>
              <span className={styles.infoValue}>
                @{profile.username || "belum_diatur"}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span>{profileConfig.labels.fullName}</span>
              <span className={styles.infoValue}>
                {profile.fullName || "-"}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span>{profileConfig.labels.email}</span>
              <span className={styles.infoValue}>{profile.email || "-"}</span>
            </div>
            <div className={styles.infoRow}>
              <span>{profileConfig.labels.phone}</span>
              <span className={styles.infoValue}>{profile.phone || "-"}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className={styles.cardHeaderFlex}>
            <h4 className={styles.cardTitle}>
              {profileConfig.labels.security}
            </h4>
          </div>
          <div className={styles.profileInfoList}>
            <div className={styles.infoRow}>
              <span>{profileConfig.labels.loginMethod}</span>
              <span className={styles.infoValue}>
                {currentUser?.app_metadata?.provider || "Email"}
              </span>
            </div>
          </div>
          <div className={styles.securityActions}>
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              className={styles.actionBtnPrimary}
            >
              {profileConfig.labels.changePassword}
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
              className={styles.actionBtnDanger}
            >
              {deletingAccount
                ? profileConfig.labels.deleting
                : profileConfig.labels.deleteAccount}
            </button>
          </div>
        </div>
      </div>

      {/* Section Buku Alamat */}
      <div className="card">
        <div className={styles.cardHeaderFlex}>
          <h4 className={styles.cardTitle}>
            {profileConfig.labels.addressBook}
          </h4>
          <button
            onClick={() => {
              setCurrentAddress({
                id: null,
                label: "Rumah",
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
          >
            {profileConfig.buttons.addAddress}
          </button>
        </div>
        {addresses.length === 0 ? (
          <p className={styles.emptyStateText}>
            {profileConfig.states.emptyAddress}
          </p>
        ) : (
          <div className={styles.addressGrid}>
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className={`${styles.addressCard} ${addr.isPrimary ? styles.addressCardPrimary : ""}`}
              >
                {addr.isPrimary && (
                  <span className={styles.primaryBadge}>
                    {profileConfig.labels.primaryBadge}
                  </span>
                )}
                <div className={styles.addressContent}>
                  <h4>
                    {addr.label} - {addr.recipientName}
                  </h4>
                  <p>📞 {addr.recipientPhone}</p>
                  <p>
                    📍 {addr.street}, {addr.city}
                    {addr.province ? `, ${addr.province}` : ""} ({addr.postalCode})
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
                    {profileConfig.labels.edit}
                  </button>
                  {!addr.isPrimary && (
                    <button
                      onClick={() => handleSetPrimaryAddress(addr.id)}
                      className={styles.smallBtn}
                    >
                      {profileConfig.labels.setPrimary}
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteAddress(addr.id)}
                    className={styles.smallBtnDanger}
                  >
                    {profileConfig.labels.delete}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Edit Profil */}
      {isProfileModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsProfileModalOpen(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {profileConfig.modals.editProfile.title}
              </h3>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className={styles.closeModalBtn}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveProfile}>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  {profileConfig.modals.editProfile.avatarLabel}
                </label>
                <div className={styles.avatarUpload}>
                  <div
                    className={styles.avatar}
                    style={{ width: 60, height: 60 }}
                  >
                    {tempProfile.photoURL ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={tempProfile.photoURL} alt="Avatar" />
                    ) : (
                      <span>👤</span>
                    )}
                  </div>
                  <input
                    type="file"
                    id="avatar-upload"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage || removingImage}
                    style={{ display: "none" }}
                  />
                  <label htmlFor="avatar-upload" className={styles.smallBtn}>
                    {profileConfig.modals.editProfile.selectImage}
                  </label>
                  {tempProfile.photoURL && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={uploadingImage || removingImage}
                      className={styles.smallBtnDanger}
                    >
                      {profileConfig.modals.editProfile.removeImage}
                    </button>
                  )}
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  {profileConfig.modals.editProfile.username}
                </label>
                <div className={styles.inputWithPrefix}>
                  <span>@</span>
                  <input
                    type="text"
                    value={tempProfile.username || ""}
                    onChange={handleUsernameChange}
                    required
                  />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  {profileConfig.modals.editProfile.fullName}
                </label>
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
                  {profileConfig.modals.editProfile.phone}
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
                <label className={styles.inputLabel}>
                  {profileConfig.modals.editProfile.birthDate}
                </label>
                <input
                  type="date"
                  value={tempProfile.birthDate || ""}
                  onChange={(e) =>
                    setTempProfile({
                      ...tempProfile,
                      birthDate: e.target.value,
                    })
                  }
                  className={styles.formInput}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  {profileConfig.modals.editProfile.gender}
                </label>
                <select
                  value={tempProfile.gender || ""}
                  onChange={(e) =>
                    setTempProfile({ ...tempProfile, gender: e.target.value })
                  }
                  className={styles.formSelect}
                >
                  <option value="">
                    {profileConfig.modals.editProfile.genderOptions.placeholder}
                  </option>
                  <option value="Male">
                    {profileConfig.modals.editProfile.genderOptions.male}
                  </option>
                  <option value="Female">
                    {profileConfig.modals.editProfile.genderOptions.female}
                  </option>
                </select>
              </div>
              <div className={styles.formGroupCheckbox}>
                <input
                  type="checkbox"
                  id="newsletter"
                  checked={tempProfile.newsletterSubscribed ?? true}
                  onChange={(e) =>
                    setTempProfile({
                      ...tempProfile,
                      newsletterSubscribed: e.target.checked,
                    })
                  }
                />
                <label htmlFor="newsletter">
                  {profileConfig.modals.editProfile.newsletterLabel}
                </label>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className={styles.smallBtn}
                >
                  {profileConfig.modals.editProfile.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loading || uploadingImage || removingImage}
                  className={styles.actionBtnPrimary}
                >
                  {loading
                    ? profileConfig.modals.editProfile.saving
                    : profileConfig.modals.editProfile.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Alamat */}
      {isAddressModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsAddressModalOpen(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {currentAddress?.id
                  ? profileConfig.modals.address.editTitle
                  : profileConfig.modals.address.addTitle}
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
                  {profileConfig.modals.address.label}
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
                  required
                  className={styles.formInput}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  {profileConfig.modals.address.recipientName}
                </label>
                <input
                  type="text"
                  value={currentAddress.recipientName}
                  onChange={(e) =>
                    setCurrentAddress({
                      ...currentAddress,
                      recipientName: e.target.value,
                    })
                  }
                  required
                  className={styles.formInput}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  {profileConfig.modals.address.recipientPhone}
                </label>
                <input
                  type="text"
                  value={currentAddress.recipientPhone}
                  onChange={(e) =>
                    setCurrentAddress({
                      ...currentAddress,
                      recipientPhone: e.target.value,
                    })
                  }
                  required
                  className={styles.formInput}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  {profileConfig.modals.address.street}
                </label>
                <textarea
                  rows="2"
                  value={currentAddress.street}
                  onChange={(e) =>
                    setCurrentAddress({
                      ...currentAddress,
                      street: e.target.value,
                    })
                  }
                  required
                  className={styles.formTextarea}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  {profileConfig.modals.address.city}
                </label>
                <ProvinceCitySelect
                  value={{
                    province: currentAddress.province,
                    city: currentAddress.city,
                    cityId: currentAddress.cityId,
                    cityType: currentAddress.cityType,
                  }}
                  onChange={(next) =>
                    setCurrentAddress((prev) => ({ ...prev, ...next }))
                  }
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  {profileConfig.modals.address.postalCode}
                </label>
                <input
                  type="text"
                  value={currentAddress.postalCode}
                  onChange={(e) =>
                    setCurrentAddress({
                      ...currentAddress,
                      postalCode: e.target.value,
                    })
                  }
                  required
                  className={styles.formInput}
                />
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(false)}
                  className={styles.smallBtn}
                >
                  {profileConfig.modals.address.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={styles.actionBtnPrimary}
                >
                  {loading
                    ? profileConfig.modals.address.saving
                    : profileConfig.modals.address.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Password */}
      {isPasswordModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsPasswordModalOpen(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {profileConfig.modals.password.title}
              </h3>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className={styles.closeModalBtn}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handlePasswordChange}>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  {profileConfig.modals.password.current}
                </label>
                <input
                  type="password"
                  value={passwords.currentPassword}
                  onChange={(e) =>
                    setPasswords({
                      ...passwords,
                      currentPassword: e.target.value,
                    })
                  }
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  {profileConfig.modals.password.new}
                </label>
                <input
                  type="password"
                  value={passwords.newPassword}
                  onChange={(e) =>
                    setPasswords({ ...passwords, newPassword: e.target.value })
                  }
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.inputLabel}>
                  {profileConfig.modals.password.confirm}
                </label>
                <input
                  type="password"
                  value={passwords.confirmPassword}
                  onChange={(e) =>
                    setPasswords({
                      ...passwords,
                      confirmPassword: e.target.value,
                    })
                  }
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className={styles.smallBtn}
                >
                  {profileConfig.modals.password.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isPasswordChanging}
                  className={styles.actionBtnPrimary}
                >
                  {isPasswordChanging
                    ? profileConfig.modals.password.submitting
                    : profileConfig.modals.password.submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}