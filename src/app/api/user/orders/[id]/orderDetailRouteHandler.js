function createUserOrderDetailHandler({
  db,
  createJsonResponse = (body, init) => Response.json(body, init),
  onError = (error) => console.error("Failed to load order detail:", error),
}) {
  return async function handleUserOrderDetail(request, { params } = {}) {
    try {
      const orderId = params?.id;
      const { searchParams } = new URL(request.url);
      const userId = searchParams.get("userId")?.trim();

      if (!orderId) {
        return createJsonResponse(
          { success: false, error: "Order id is required" },
          { status: 400 },
        );
      }

      if (!userId) {
        return createJsonResponse(
          { success: false, error: "userId is required" },
          { status: 400 },
        );
      }

      const [orderRes, itemsRes] = await Promise.all([
        db.from("orders").select("*").eq("id", orderId).single(),
        db.from("order_items").select("*").eq("order_id", orderId),
      ]);

      if (orderRes.error || !orderRes.data) {
        return createJsonResponse(
          { success: false, error: "Order not found" },
          { status: 404 },
        );
      }

      const orderData = orderRes.data;
      if (String(orderData.user_id || orderData.userId || "") !== userId) {
        return createJsonResponse(
          { success: false, error: "Forbidden" },
          { status: 403 },
        );
      }

      const order = {
        id: orderData.id,
        orderId: orderData.id,
        order_number: orderData.order_number || orderData.id,
        userId: orderData.user_id,
        status: orderData.status,
        amount: Number(orderData.amount || 0),
        shippingCost: Number(orderData.shipping_cost || 0),
        discountAmount: Number(orderData.discount_amount || 0),
        taxAmount: Number(orderData.tax_amount || 0),
        paymentType: orderData.payment_type,
        customerName: orderData.customer_name,
        customerEmail: orderData.customer_email,
        customerPhone: orderData.customer_phone,
        shippingAddress: orderData.shipping_address,
        shippingDetail: orderData.shipping_detail,
        shippingReceiptNumber: orderData.shipping_receipt_number,
        notes: orderData.notes,
        statusHistory: Array.isArray(orderData.status_history) ? orderData.status_history : [],
        createdAt: orderData.created_at,
        updatedAt: orderData.updated_at,
      };

      const items = (itemsRes.data || []).map((item) => ({
        id: item.id,
        productId: item.product_id,
        name: item.product_name,
        variantName: item.variant_name,
        quantity: item.quantity,
        price: Number(item.price || 0),
      }));

      const shipping = orderData.shipping_detail || orderData.shipping_address || null;
      const statusHistory = Array.isArray(orderData.status_history) ? orderData.status_history : [];

      return createJsonResponse({
        success: true,
        order,
        items,
        shipping,
        statusHistory,
      });
    } catch (error) {
      onError(error);
      return createJsonResponse(
        { success: false, error: error.message || "Internal Server Error" },
        { status: 500 },
      );
    }
  };
}

export { createUserOrderDetailHandler };

