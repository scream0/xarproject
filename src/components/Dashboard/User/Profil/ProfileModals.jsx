import React from "react";
import styles from "./UserProfil.module.css";
import { ProvinceCitySelect } from "@/components/UI/ProvinceCitySelect/ProvinceCitySelect";

export function EditProfileModal({
  isOpen,
  onClose,
  profileConfig,
  tempProfile,
  setTempProfile,
  handleUsernameChange,
  handleImageUpload,
  handleRemoveAvatar,
  handleSaveProfile,
  uploadingImage,
  removingImage,
  loading,
}) {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{profileConfig.modals.editProfile.title}</h3>
          <button onClick={onClose} className={styles.closeModalBtn}>✕</button>
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
            <button type="button" onClick={onClose} className={styles.actionBtnOutline}>{profileConfig.modals.editProfile.cancel}</button>
            <button type="submit" disabled={loading || uploadingImage || removingImage} className={styles.actionBtnPrimary}>
              {loading ? profileConfig.modals.editProfile.saving : profileConfig.modals.editProfile.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AddressFormModal({
  isOpen,
  onClose,
  currentAddress,
  setCurrentAddress,
  handleSaveAddress,
  profileConfig,
  loading,
}) {
  if (!isOpen || !currentAddress) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{currentAddress?.id ? "Edit Alamat" : "Tambah Alamat Baru"}</h3>
          <button onClick={onClose} className={styles.closeModalBtn}>✕</button>
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
            <button type="button" onClick={onClose} className={styles.actionBtnOutline}>{profileConfig.modals.address.cancel}</button>
            <button type="submit" disabled={loading} className={styles.actionBtnPrimary}>
              {loading ? profileConfig.modals.address.saving : profileConfig.modals.address.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PasswordModal({
  isOpen,
  onClose,
  passwords,
  setPasswords,
  handlePasswordChange,
  profileConfig,
  isPasswordChanging,
}) {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{profileConfig.modals.password.title}</h3>
          <button onClick={onClose} className={styles.closeModalBtn}>✕</button>
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
            <button type="button" onClick={onClose} className={styles.actionBtnOutline}>{profileConfig.modals.password.cancel}</button>
            <button type="submit" disabled={isPasswordChanging} className={styles.actionBtnPrimary}>
              {isPasswordChanging ? profileConfig.modals.password.submitting : profileConfig.modals.password.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}