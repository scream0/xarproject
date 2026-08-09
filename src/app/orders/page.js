"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import OrdersSection from "@/components/Dashboard/User/Order/OrdersSection";
import styles from "./AccountOrdersPage.module.css";

function OrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");
  const transactionStatus = searchParams.get("transaction_status");

  return (
    <div className={styles.container}>
      <div className={styles.headerWrapper}>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className={styles.backButton}
        >
          ← Kembali ke Dashboard
        </button>
      </div>
      <OrdersSection />
    </div>
  );
}

export default function AccountOrdersPage() {
  return (
    <Suspense fallback={<div className={styles.loadingFallback}>Memuat halaman pesanan...</div>}>
      <OrderContent />
    </Suspense>
  );
}