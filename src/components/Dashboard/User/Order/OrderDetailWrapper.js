"use client";

import dynamic from "next/dynamic";

const OrderDetailPage = dynamic(() => import("./OrderDetailPage"), {
  ssr: false,
});

export default function OrderDetailWrapper({ orderId }) {
  return <OrderDetailPage orderId={orderId} />;
}
