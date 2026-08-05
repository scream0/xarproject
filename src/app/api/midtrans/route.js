import { NextResponse } from "next/server";
import midtransClient from "midtrans-client";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { v4 as uuidv4 } from 'uuid';


// Initialize Midtrans Snap Client
const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
});

/**
 * Creates an order record in Supabase, including associated order items.
 * This function replaces the original `createOrderRecord` from `orderService`.
 */
async function createOrderInSupabase(orderDetails) {
  const {
    userId,
    orderId,
    items,
    shippingAddress,
    shippingDetail,
    shippingCost,
    amount,
    customerName,
    customerEmail,
    customerPhone,
    status,
    paymentType,
    discountAmount
  } = orderDetails;

  // 1. Prepare the main order payload
  const orderPayload = {
    id: orderId,
    user_id: userId === "guest" ? null : userId,
    status: status || "pending",
    amount: amount,
    shipping_cost: shippingCost || 0,
    discount_amount: discountAmount || 0,
    tax_amount: 0, // Assuming no tax for now, adjust if needed
    payment_type: paymentType,
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    shipping_address: shippingAddress,
    shipping_detail: shippingDetail,
    status_history: [
      {
        status: status || "pending",
        notes: "Order created, waiting for payment.",
        actor: "system",
        timestamp: new Date().toISOString(),
      },
    ],
  };

  // 2. Insert the main order record
  const { error: orderError } = await supabaseAdmin
    .from("orders")
    .insert(orderPayload);

  if (orderError) {
    console.error("Supabase error creating order:", orderError.message);
    throw new Error(`Failed to create order record: ${orderError.message}`);
  }

  // 3. Prepare and insert order items
  if (items && items.length > 0) {
    const orderItemsPayload = items.map((item) => ({
      order_id: orderId,
      product_id: item.productId || item.id, // Assuming item.id or item.productId holds the UUID
      product_name: item.name,
      variant_name: item.size || item.variant_name,
      quantity: item.quantity,
      price: item.price,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItemsPayload);

    if (itemsError) {
      console.error("Supabase error creating order items:", itemsError.message);
      // Attempt to roll back the order creation for consistency
      await supabaseAdmin.from("orders").delete().eq("id", orderId);
      throw new Error(`Failed to create order items: ${itemsError.message}`);
    }
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      userId,
      amount,
      items,
      shippingAddress,
      shippingCost,
      shippingDetail,
      discountAmount,
    } = body;

    // Use provided orderId or generate a new one
    const orderId = body.orderId || uuidv4();

    if (!orderId || !amount) {
      return NextResponse.json(
        { success: false, error: "orderId and amount are required" },
        { status: 400 },
      );
    }

    let customerName = "Customer XAR Store";
    let customerEmail = "customer@xarstore.com";
    let customerPhone = "08123456789";

    // Fetch user details from Supabase auth if userId is provided
    if (userId) {
      try {
        const { data: user, error } = await supabaseAdmin.auth.api.getUserById(userId);
        if (error) throw error;
        if (user) {
            // In Supabase, name isn't a standard auth field. Use email/phone.
            // Name will be sourced from shipping address.
            customerEmail = user.email || customerEmail;
            customerPhone = user.phone || customerPhone;
        }
      } catch (err) {
        console.warn("Failed to fetch user data from Supabase for Midtrans:", err.message);
      }
    }

    // Determine customer name from shipping details if available
    if (shippingAddress?.recipientName) {
        customerName = shippingAddress.recipientName;
    }


    // Format item details for Midtrans
    const formattedItems = (items || []).map((item) => ({
        id: String(item.productId || item.id).substring(0, 50),
        price: Math.round(Number(item.price) || 0),
        quantity: Math.max(1, Number(item.quantity) || 1),
        name: `${item.name} (${item.size || "Standard"})`.substring(0, 50),
      }));

    if (discountAmount > 0) {
      formattedItems.push({
        id: "PROMO-DISCOUNT",
        price: -Math.round(discountAmount),
        quantity: 1,
        name: "Diskon Promo",
      });
    }

    if (shippingCost > 0) {
      formattedItems.push({
        id: "SHIPPING-COST",
        price: Math.round(shippingCost),
        quantity: 1,
        name: "Ongkos Kirim",
      });
    }

    // Ensure gross_amount matches the sum of item_details
    const computedGrossAmount = formattedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: computedGrossAmount,
      },
      item_details: formattedItems,
      customer_details: {
        first_name: customerName,
        email: customerEmail,
        phone: customerPhone,
        shipping_address: shippingAddress ? {
            first_name: shippingAddress.recipientName || customerName,
            phone: shippingAddress.recipientPhone || customerPhone,
            address: shippingAddress.street || "",
            city: shippingAddress.city || "",
            postal_code: shippingAddress.postalCode || "",
            country_code: "IDN",
        } : undefined,
      },
    };

    // 1. Create Midtrans Snap Token
    const transaction = await snap.createTransaction(parameter);

    // 2. Save the order record to Supabase
    await createOrderInSupabase({
      userId: userId || "guest",
      orderId,
      items: items || [],
      shippingAddress: shippingAddress || null,
      shippingDetail: shippingDetail || null,
      shippingCost: shippingCost || 0,
      discountAmount: discountAmount || 0,
      amount: computedGrossAmount,
      customerName,
      customerEmail,
      customerPhone,
      status: "pending",
      paymentType: "Midtrans",
    });

    return NextResponse.json({
      success: true,
      token: transaction.token,
      redirect_url: transaction.redirect_url,
    });
  } catch (error) {
    console.error("Midtrans API Error:", error.message || error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create Midtrans transaction" },
      { status: 500 },
    );
  }
}
