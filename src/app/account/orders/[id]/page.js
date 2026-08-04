import OrderDetailPage from "@/components/Dashboard/User/Order/OrderDetailPage";

export default function AccountOrderDetailRoutePage({ params }) {
  return <OrderDetailPage orderId={params.id} />;
}
