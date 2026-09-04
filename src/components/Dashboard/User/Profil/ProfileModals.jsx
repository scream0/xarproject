import React from "react";
import styles from "./UserProfil.module.css";
import { BiteshipAreaSelect } from "@/components/UI/BiteshipAreaSelect/BiteshipAreaSelect";

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

          <div style={{ marginTop: '20px', marginBottom: '10px', borderTop: '1px solid #eaeaea', paddingTop: '15px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '15px' }}>Informasi Rekening Bank (Untuk Penarikan Dana)</h4>
            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>Nama Bank</label>
              <input type="text" value={tempProfile.bankName || ""} onChange={(e) => setTempProfile({ ...tempProfile, bankName: e.target.value })} className={styles.formInput} placeholder="Contoh: BCA, Mandiri, BRI" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>Nomor Rekening</label>
              <input type="text" value={tempProfile.bankAccountNumber || ""} onChange={(e) => setTempProfile({ ...tempProfile, bankAccountNumber: e.target.value })} className={styles.formInput} placeholder="Masukkan nomor rekening valid" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>Nama Pemilik Rekening</label>
              <input type="text" value={tempProfile.bankAccountName || ""} onChange={(e) => setTempProfile({ ...tempProfile, bankAccountName: e.target.value })} className={styles.formInput} placeholder="Sesuai buku tabungan" />
            </div>
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
  verifiedPhones = [],
  onSendOtp,
}) {
  if (!isOpen || !currentAddress) return null;

  const isPhoneVerified = verifiedPhones.includes(currentAddress.recipientPhone);
  const isValidPhone = currentAddress.recipientPhone?.length >= 9;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{currentAddress?.id ? "Edit Alamat" : "Tambah Alamat Baru"}</h3>
          <button onClick={onClose} className={styles.closeModalBtn}>✕</button>
        </div>
        <form onSubmit={handleSaveAddress}>
          {/* 1. Kontak Penerima */}
          <div className={styles.sectionDividerTitle}>
            👤 Kontak Penerima
          </div>
          <div className={styles.formRow2}>
            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>{profileConfig.modals.address.recipientName} *</label>
              <input
                type="text"
                value={currentAddress.recipientName}
                onChange={(e) => setCurrentAddress({ ...currentAddress, recipientName: e.target.value })}
                required
                className={styles.formInput}
                placeholder="Nama penerima"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>{profileConfig.modals.address.recipientPhone} *</label>
              <input
                type="text"
                value={currentAddress.recipientPhone}
                onChange={(e) => setCurrentAddress({ ...currentAddress, recipientPhone: e.target.value })}
                required
                className={styles.formInput}
                placeholder="08xxxxxxxxxx"
              />
              {typeof onSendOtp === "function" && (
                <div style={{ marginTop: "6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {isPhoneVerified && currentAddress.recipientPhone ? (
                    <span style={{ fontSize: "0.75rem", color: "var(--success-color, #10b981)", fontWeight: 600 }}>
                      ✓ Nomor terverifikasi
                    </span>
                  ) : (
                    <>
                      <span className={styles.otpUnverifiedTag}>
                        {currentAddress.recipientPhone ? "Belum diverifikasi" : ""}
                      </span>
                      <button
                        type="button"
                        disabled={!isValidPhone || loading}
                        onClick={() => typeof onSendOtp === 'function' && onSendOtp(currentAddress.recipientPhone)}
                        className={`${styles.actionBtnPrimary} ${styles.otpActionBtn}`}
                      >
                        {loading ? "Mengirim..." : "Kirim OTP via WA"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2. Wilayah Pengiriman Biteship */}
          <div className={styles.sectionDividerTitle}>
            📍 Wilayah Pengiriman
          </div>
          <div className={styles.formGroup}>
            <label className={styles.inputLabel}>Kecamatan / Kota / Kode Pos *</label>
            <BiteshipAreaSelect
              value={{
                province: currentAddress.province,
                city: currentAddress.city,
                district: currentAddress.district,
                postalCode: currentAddress.postalCode,
                biteshipAreaId: currentAddress.cityId,
              }}
              onChange={(next) => setCurrentAddress((prev) => ({ 
                ...prev, 
                ...next,
                cityId: next.biteshipAreaId || next.cityId || prev.cityId
              }))}
            />
          </div>

          {/* 3. Alamat Lengkap & Detail Rumah */}
          <div className={styles.sectionDividerTitle}>
            🏠 Alamat Lengkap & Patokan
          </div>
          <div className={styles.formGroup}>
            <label className={styles.inputLabel}>{profileConfig.modals.address.street} *</label>
            <textarea
              rows="2"
              value={currentAddress.street}
              onChange={(e) => setCurrentAddress({ ...currentAddress, street: e.target.value })}
              required
              className={styles.formTextarea}
              placeholder="Nama jalan, nomor rumah, RT/RW, Blok, nama gedung..."
            />
          </div>

          <div className={styles.formRow2}>
            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>Label Alamat</label>
              <input
                type="text"
                value={currentAddress.label || "Rumah"}
                onChange={(e) => setCurrentAddress({ ...currentAddress, label: e.target.value })}
                className={styles.formInput}
                placeholder="Rumah / Kantor / Kos"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.inputLabel}>Catatan Kurir (Opsional)</label>
              <input
                type="text"
                value={currentAddress.notes || ""}
                onChange={(e) => setCurrentAddress({ ...currentAddress, notes: e.target.value })}
                className={styles.formInput}
                placeholder="Warna pagar, titip satpam, dll"
              />
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" onClick={onClose} className={styles.actionBtnOutline}>{profileConfig.modals.address.cancel}</button>
            <button type="submit" disabled={loading || !isPhoneVerified} className={styles.actionBtnPrimary}>
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

export function OTPModal({
  isOpen,
  onClose,
  onSubmit,
  onResend,
  phone,
  loading,
}) {
  const [otp, setOtp] = React.useState(new Array(6).fill(""));
  const inputRefs = React.useRef([]);
  const [resendTimer, setResendTimer] = React.useState(60);

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setOtp(new Array(6).fill(""));
      setResendTimer(60);
      setTimeout(() => {
        if (inputRefs.current[0]) inputRefs.current[0].focus();
      }, 100);
    }
  }, [isOpen]);

  // Countdown timer
  React.useEffect(() => {
    if (!isOpen) return;
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer, isOpen]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  if (!isOpen) return null;

  const handleChange = (value, index) => {
    // Hanya angka saja
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    // Auto-advance
    if (digit && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      if (otp[index] === "" && index > 0 && inputRefs.current[index - 1]) {
        inputRefs.current[index - 1].focus();
      } else if (otp[index] !== "") {
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
    if (!pastedData) return;
    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);
    const nextIndex = Math.min(pastedData.length, 5);
    if (inputRefs.current[nextIndex]) {
      inputRefs.current[nextIndex].focus();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const otpString = otp.join("");
    if (otpString.length === 6) {
      onSubmit(otpString);
    }
  };

  const handleResend = () => {
    setOtp(new Array(6).fill(""));
    setResendTimer(60);
    if (onResend) onResend(phone);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "400px" }}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Verifikasi WhatsApp</h3>
          <button onClick={onClose} className={styles.closeModalBtn}>✕</button>
        </div>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ 
            width: "60px", 
            height: "60px", 
            backgroundColor: "var(--primary-accent)", 
            borderRadius: "50%", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            margin: "0 auto 16px auto",
            color: "white",
            fontSize: "24px"
          }}>
            💬
          </div>
          <p style={{ fontSize: "15px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
            Masukkan 6-digit kode OTP yang telah kami kirimkan ke nomor WhatsApp <b style={{ color: "var(--text-primary)" }}>{phone}</b>
          </p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "16px" }}>
            {otp.map((data, index) => (
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="1"
                key={index}
                value={data}
                onChange={(e) => handleChange(e.target.value, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onPaste={handlePaste}
                ref={(ref) => inputRefs.current[index] = ref}
                disabled={loading}
                autoComplete="one-time-code"
                style={{
                  width: "45px",
                  height: "55px",
                  fontSize: "24px",
                  textAlign: "center",
                  borderRadius: "12px",
                  border: "2px solid var(--border-color)",
                  backgroundColor: "var(--surface-primary)",
                  color: "var(--text-primary)",
                  fontWeight: "700",
                  transition: "all 0.2s ease",
                  outline: "none",
                  boxShadow: data ? "0 4px 12px rgba(0,0,0,0.05)" : "none"
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--primary-accent)";
                  e.target.style.boxShadow = "0 0 0 4px rgba(99, 102, 241, 0.1)";
                  e.target.style.transform = "translateY(-2px)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = data ? "var(--primary-accent)" : "var(--border-color)";
                  e.target.style.boxShadow = data ? "0 4px 12px rgba(0,0,0,0.05)" : "none";
                  e.target.style.transform = "translateY(0)";
                }}
              />
            ))}
          </div>

          {/* Timer / Resend */}
          <div style={{ textAlign: "center", marginBottom: "20px", fontSize: "13px", color: "var(--text-secondary)" }}>
            {resendTimer > 0 ? (
              <span>Kirim Ulang Kode ({formatTime(resendTimer)})</span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--primary-accent)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  textDecoration: "underline",
                  padding: 0
                }}
              >
                Kirim Ulang Kode OTP
              </button>
            )}
          </div>

          <div className={styles.modalFooter} style={{ borderTop: "none", paddingTop: 0 }}>
            <button 
              type="button" 
              onClick={onClose} 
              className={styles.actionBtnOutline} 
              disabled={loading}
              style={{ flex: 1 }}
            >
              Batal
            </button>
            <button 
              type="submit" 
              disabled={loading || otp.join("").length !== 6} 
              className={styles.actionBtnPrimary}
              style={{ flex: 1 }}
            >
              {loading ? "Memverifikasi..." : "Verifikasi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}