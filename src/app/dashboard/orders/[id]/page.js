import OrderDetailWrapper from "@/components/Dashboard/User/Order/OrderDetailWrapper";

export default async function OrderDetailRoutePage({ params }) {
  const resolvedParams = await params;
  return <OrderDetailWrapper orderId={resolvedParams?.id || resolvedParams?.orderId} />;
}