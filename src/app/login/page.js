"use client";
import LoginForm from "@/components/auth/LoginForm";
import styles from "./login.module.css";
import config from "@/data/ui/loginConfig.json";
import { Suspense } from "react";

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
          <Suspense fallback={<div>Loading...</div>}>
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
