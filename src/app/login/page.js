"use client";
import LoginForm from "@/features/components/LoginForm";
import styles from "./login.module.css";
import "./login.theme.css";
import config from "@/data/ui/loginConfig.json";
import { Suspense } from "react";
import { LoginSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";

export default function LoginPage() {
  return (
    <div className={styles.pageContainer}>
      {/* Panel Brand */}
      <div className={styles.leftPanel}>
        <h1 className={styles.brandTitle}>{config.brand.name}</h1>
        <p className={styles.brandSub}>{config.brand.subtitle}</p>
      </div>

      {/* Panel Form */}
      <div className={styles.rightPanel}>
        <div className={styles.formWrapper}>
          {" "}
          <Suspense fallback={<LoginSkeleton />}>
            <LoginForm />
          </Suspense>
          <a href={config.content.backLinkHref} className={styles.backLink}>
            {config.content.backLinkLabel}
          </a>
        </div>
      </div>
    </div>
  );
}
