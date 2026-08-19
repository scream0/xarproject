import OrderDetailPage from "@/components/Dashboard/User/Order/OrderDetailPage";

export default async function OrderDetailRoutePage({ params }) {
  const resolvedParams = await params;
  return <OrderDetailPage orderId={resolvedParams?.id || resolvedParams?.orderId} />;
}