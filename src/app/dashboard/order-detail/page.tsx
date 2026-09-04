"use client";
import OrderDetailWrapper from "@/components/Dashboard/User/Order/OrderDetailWrapper";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Content() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || searchParams.get("orderId");
  if (!id) return null;
  return <OrderDetailWrapper orderId={id} />;
}

export default function OrderDetailRoutePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Content />
    </Suspense>
  );
}