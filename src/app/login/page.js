"use client";
import LoginForm from "@/features/components/LoginForm";
import InteractiveBackground from "./InteractiveBackground";
import styles from "./login.module.css";
import "./login.theme.css";
import config from "@/data/ui/loginConfig.json";
import { Suspense } from "react";
import { LoginSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";

export default function LoginPage() {
  return (
    <div className={styles.pageContainer}>
      <InteractiveBackground />
      <div className={styles.loginWrapper}>

        {/* Brand Section */}
        <div className={styles.brandHeader}>

          <a href={config.content.backLinkHref} className={styles.brandLinkWrapper}>
            <h1 className={styles.brandTitle}>{config.brand.name}</h1>
          </a>
          <p className={styles.brandSub}>{config.brand.subtitle}</p>
        </div>


        {/* Form Section */}
        <div className={styles.formContainer}>
          <Suspense fallback={<LoginSkeleton />}>
            <LoginForm />
          </Suspense>
        </div>

        {/* Back Link */}
        <div className={styles.footerLink}>
          <a href={config.content.backLinkHref} className={styles.backLink}>
            {config.content.backLinkLabel}
          </a>
        </div>
      </div>
    </div>
  );
}
