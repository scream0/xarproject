"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import OrdersSection from "@/components/Dashboard/User/Order/OrdersSection";

function OrderContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");
  const transactionStatus = searchParams.get("transaction_status");

  // Anda bisa menggunakan orderId atau transactionStatus di sini jika diperlukan,
  // atau langsung merender OrdersSection Anda.
  return (
    <div style={{ padding: "1.25rem", width: "100%", minHeight: "100vh" }}>
      <OrdersSection />
    </div>
  );
}

export default function AccountOrdersPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", textAlign: "center" }}>Memuat halaman pesanan...</div>}>
      <OrderContent />
    </Suspense>
  );
}