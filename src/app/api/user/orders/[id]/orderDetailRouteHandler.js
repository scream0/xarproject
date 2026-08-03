function createUserOrderDetailHandler({
  db,
  mapOrderDoc,
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

      const orderRef = db.collection("orders").doc(orderId);
      const [orderSnap, itemsSnap, shippingSnap, historySnap] = await Promise.all([
        orderRef.get(),
        orderRef.collection("order_items").get(),
        orderRef.collection("shipping_details").doc("primary").get(),
        orderRef.collection("order_status_history").orderBy("created_at", "asc").get(),
      ]);

      if (!orderSnap.exists) {
        return createJsonResponse(
          { success: false, error: "Order not found" },
          { status: 404 },
        );
      }

      const order = mapOrderDoc(orderSnap);
      if (String(order.userId || "") !== userId) {
        return createJsonResponse(
          { success: false, error: "Forbidden" },
          { status: 403 },
        );
      }

      const items = itemsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const shipping = shippingSnap.exists ? shippingSnap.data() : null;
      const statusHistory = historySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

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
