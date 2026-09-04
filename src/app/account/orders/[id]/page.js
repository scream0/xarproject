import OrderDetailWrapper from "@/components/Dashboard/User/Order/OrderDetailWrapper";

export default async function AccountOrderDetailRoutePage({ params }) {
  const resolvedParams = await params;
  return <OrderDetailWrapper orderId={resolvedParams.id} />;
}