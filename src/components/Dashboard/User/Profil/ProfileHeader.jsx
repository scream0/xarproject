import React from "react";
import styles from "./UserProfil.module.css";

export default function ProfileHeader({ profile }) {
  return (
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
  );
}