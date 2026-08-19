function createUserOrderDetailHandler({
  db,
  createJsonResponse = (body, init) => Response.json(body, init),
  onError = (error) => console.error("Failed to load order detail:", error),
}) {
  return async function handleUserOrderDetail(request, context = {}) {
    try {
      const params = context?.params ? await context.params : {};
      const orderId = params?.id || params?.orderId;
      const { searchParams } = new URL(request.url);
      const queryUserId = searchParams.get("userId")?.trim();

      if (!orderId) {
        return createJsonResponse(
          { success: false, error: "Order id is required" },
          { status: 400 },
        );
      }

      // Check Bearer token if present
      let authUserId = null;
      const authHeader = request.headers.get("authorization");
      if (authHeader && db?.auth?.getUser) {
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (token) {
          try {
            const { data: authData } = await db.auth.getUser(token);
            if (authData?.user?.id) {
              authUserId = authData.user.id;
            }
          } catch {
            // Ignore token error, fallback to queryUserId
          }
        }
      }

      const effectiveUserId = authUserId || queryUserId;

      if (!effectiveUserId) {
        return createJsonResponse(
          { success: false, error: "userId is required" },
          { status: 400 },
        );
      }

      // 1. Fetch Order by ID or order_number
      let orderData = null;
      const orderRes = await db.from("orders").select("*").eq("id", orderId).single();
      if (orderRes?.data) {
        orderData = orderRes.data;
      } else {
        try {
          const orderNumRes = await db.from("orders").select("*").eq("order_number", orderId).single();
          if (orderNumRes?.data) {
            orderData = orderNumRes.data;
          }
        } catch {
          // ignore error if table does not support order_number query
        }
      }

      if (!orderData) {
        return createJsonResponse(
          { success: false, error: "Order not found" },
          { status: 404 },
        );
      }

      // Verify User ownership
      const orderOwnerId = String(orderData.user_id || orderData.userId || "");
      if (orderOwnerId && orderOwnerId !== effectiveUserId) {
        return createJsonResponse(
          { success: false, error: "Forbidden" },
          { status: 403 },
        );
      }

      // 2. Fetch Order Items
      const targetOrderId = orderData.id || orderId;
      const itemsRes = await db.from("order_items").select("*").eq("order_id", targetOrderId);
      const rawItems = (itemsRes?.data && itemsRes.data.length > 0)
        ? itemsRes.data
        : (Array.isArray(orderData.items) ? orderData.items : []);

      // 3. Parse JSON structures safely
      let shippingDetail = orderData.shipping_detail || orderData.shippingDetail || {};
      if (typeof shippingDetail === "string") {
        try { shippingDetail = JSON.parse(shippingDetail); } catch { shippingDetail = {}; }
      }

      let shippingAddress = orderData.shipping_address || orderData.shippingAddress || null;
      if (typeof shippingAddress === "string") {
        try { shippingAddress = JSON.parse(shippingAddress); } catch { shippingAddress = orderData.shipping_address; }
      }

      let statusHistory = orderData.status_history || orderData.statusHistory || [];
      if (typeof statusHistory === "string") {
        try { statusHistory = JSON.parse(statusHistory); } catch { statusHistory = []; }
      }
      if (!Array.isArray(statusHistory)) {
        statusHistory = [];
      }

      const order = {
        id: orderData.id,
        orderId: orderData.id,
        order_number: orderData.order_number || orderData.id,
        userId: orderData.user_id || orderData.userId,
        user_id: orderData.user_id || orderData.userId,
        status: orderData.status,
        amount: Number(orderData.amount || orderData.total_amount || 0),
        total_amount: Number(orderData.total_amount || orderData.amount || 0),
        shippingCost: Number(orderData.shipping_cost || 0),
        shipping_cost: Number(orderData.shipping_cost || 0),
        discountAmount: Number(orderData.discount_amount || 0),
        discount_amount: Number(orderData.discount_amount || 0),
        taxAmount: Number(orderData.tax_amount || 0),
        tax_amount: Number(orderData.tax_amount || 0),
        paymentType: orderData.payment_type,
        payment_type: orderData.payment_type,
        customerName: orderData.customer_name,
        customer_name: orderData.customer_name,
        customerEmail: orderData.customer_email,
        customer_email: orderData.customer_email,
        customerPhone: orderData.customer_phone,
        customer_phone: orderData.customer_phone,
        shippingAddress: shippingAddress,
        shipping_address: shippingAddress,
        shippingDetail: shippingDetail,
        shipping_detail: shippingDetail,
        shippingReceiptNumber: orderData.shipping_receipt_number,
        shipping_receipt_number: orderData.shipping_receipt_number,
        snap_token: orderData.snap_token,
        notes: orderData.notes,
        statusHistory: statusHistory,
        status_history: statusHistory,
        createdAt: orderData.created_at || orderData.createdAt,
        created_at: orderData.created_at || orderData.createdAt,
        updatedAt: orderData.updated_at || orderData.updatedAt,
        updated_at: orderData.updated_at || orderData.updatedAt,
      };

      const items = rawItems.map((item, idx) => ({
        id: item.id || idx,
        productId: item.product_id || item.productId,
        product_id: item.product_id || item.productId,
        name: item.product_name || item.name || "Produk XAR",
        product_name: item.product_name || item.name || "Produk XAR",
        variantName: item.variant_name || item.variant || item.size || null,
        variant_name: item.variant_name || item.variant || item.size || null,
        size: item.variant_name || item.variant || item.size || null,
        quantity: Math.max(1, Number(item.quantity || item.qty || 1)),
        qty: Math.max(1, Number(item.quantity || item.qty || 1)),
        price: Number(item.price || item.subtotal || 0),
      }));

      const shipping = {
        shipping_address: shippingAddress,
        courier_name: shippingDetail?.courierName || shippingDetail?.courier_name || orderData.courier_name || "-",
        service_type: shippingDetail?.courierService || shippingDetail?.service_type || orderData.courier_service || "-",
        etd: shippingDetail?.courierEtd || shippingDetail?.etd || "-",
        tracking_number: orderData.shipping_receipt_number || orderData.tracking_number || shippingDetail?.tracking_number || null,
        ...(typeof shippingDetail === "object" && shippingDetail !== null ? shippingDetail : {}),
      };

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
