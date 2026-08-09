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
 * Creates an order record in Supabase, saving items directly into the `orders` table.
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
    discountAmount,
    appliedVouchersList, // List semua voucher yang valid dipakai
    snapToken,
  } = orderDetails;

  const orderPayload = {
    id: orderId,
    user_id: userId === "guest" ? null : userId,
    status: status || "pending",
    amount: amount,
    total_amount: amount,
    shipping_cost: shippingCost || 0,
    discount_amount: discountAmount || 0,
    tax_amount: 0,
    payment_type: paymentType,
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    shipping_address: shippingAddress,
    shipping_detail: shippingDetail,
    snap_token: snapToken || null,
    items: items || [],
    status_history: [
      {
        id: `${Date.now()}-system`,
        status_to: status || "pending",
        notes: "Order created, waiting for payment.",
        changed_by: "system",
        created_at: new Date().toISOString(),
        status_from: null,
      },
    ],
  };

  const { error: orderError } = await supabaseAdmin
    .from("orders")
    .insert(orderPayload);

  if (orderError) {
    console.error("Supabase error creating order:", orderError.message);
    throw new Error(`Failed to create order record: ${orderError.message}`);
  }

  // Catat penggunaan semua voucher yang valid ke tabel voucher_usage & tandai used_at di user_vouchers
  if (Array.isArray(appliedVouchersList) && userId && userId !== "guest") {
    for (const v of appliedVouchersList) {
      if (v.voucherId) {
        await supabaseAdmin.from("voucher_usage").insert({
          user_id: userId,
          voucher_id: v.voucherId,
          order_id: orderId,
        });
      }
      if (v.claimId) {
        await supabaseAdmin.from("user_vouchers")
          .update({ used_at: new Date().toISOString() })
          .eq("id", v.claimId);
      }
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
      shippingVoucherId,
      shippingVoucherClaimId,
      discountVoucherId,
      discountVoucherClaimId,
    } = body;

    const orderId = body.orderId || uuidv4();

    if (!orderId || !amount) {
      return NextResponse.json(
        { success: false, error: "orderId and amount are required" },
        { status: 400 },
      );
    }

    const rawSubtotal = (items || []).reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
    let actualShippingCost = Number(shippingCost) || 0;

    let subtotalDiscountAmount = 0;
    let shippingDiscountAmount = 0;
    const validatedVouchers = [];

    // ── 1. VALIDASI VOUCHER DISKON (Percentage / Fixed) ──
    if (discountVoucherId) {
      const { data: dVoucher, error: dErr } = await supabaseAdmin
        .from("vouchers")
        .select("*")
        .eq("id", discountVoucherId)
        .eq("is_active", true)
        .single();

      if (!dErr && dVoucher && rawSubtotal >= Number(dVoucher.min_purchase)) {
        // Validasi klaim user jika ada claimId
        let validClaimId = null;
        if (discountVoucherClaimId && userId && userId !== "guest") {
          const { data: claimRow } = await supabaseAdmin
            .from("user_vouchers")
            .select("id, used_at")
            .eq("id", discountVoucherClaimId)
            .eq("user_id", userId)
            .eq("voucher_id", discountVoucherId)
            .single();

          if (claimRow && !claimRow.used_at) {
            validClaimId = claimRow.id;
          }
        }

        if (dVoucher.type === 'percentage') {
          subtotalDiscountAmount = (rawSubtotal * Number(dVoucher.discount_amount || 0)) / 100;
        } else {
          subtotalDiscountAmount = Number(dVoucher.discount_amount || 0);
        }

        validatedVouchers.push({ voucherId: dVoucher.id, claimId: validClaimId });
      }
    }

    // ── 2. VALIDASI VOUCHER GRATIS ONGKIR (Shipping) ──
    if (shippingVoucherId) {
      const { data: sVoucher, error: sErr } = await supabaseAdmin
        .from("vouchers")
        .select("*")
        .eq("id", shippingVoucherId)
        .eq("is_active", true)
        .single();

      if (!sErr && sVoucher && rawSubtotal >= Number(sVoucher.min_purchase)) {
        let validClaimId = null;
        if (shippingVoucherClaimId && userId && userId !== "guest") {
          const { data: claimRow } = await supabaseAdmin
            .from("user_vouchers")
            .select("id, used_at")
            .eq("id", shippingVoucherClaimId)
            .eq("user_id", userId)
            .eq("voucher_id", shippingVoucherId)
            .single();

          if (claimRow && !claimRow.used_at) {
            validClaimId = claimRow.id;
          }
        }

        shippingDiscountAmount = Math.min(actualShippingCost, Number(sVoucher.discount_amount || 0));
        actualShippingCost = Math.max(0, actualShippingCost - shippingDiscountAmount);

        validatedVouchers.push({ voucherId: sVoucher.id, claimId: validClaimId });
      }
    }

    const totalDiscountAmount = subtotalDiscountAmount + shippingDiscountAmount;

    let customerName = "Customer XAR Store";
    let customerEmail = "customer@xarstore.com";
    let customerPhone = "08123456789";

    if (userId) {
      try {
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (!error && data?.user) {
            customerEmail = data.user.email || customerEmail;
            customerPhone = data.user.phone || customerPhone;
        }
      } catch (err) {
        console.warn("Failed to fetch user data from Supabase for Midtrans:", err.message);
      }
    }

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

    if (subtotalDiscountAmount > 0) {
      formattedItems.push({
        id: "VOUCHER-DISCOUNT",
        price: -Math.round(subtotalDiscountAmount),
        quantity: 1,
        name: "Diskon Voucher Toko",
      });
    }

    if (actualShippingCost > 0) {
      formattedItems.push({
        id: "SHIPPING-COST",
        price: Math.round(actualShippingCost),
        quantity: 1,
        name: "Ongkos Kirim",
      });
    }

    const computedGrossAmount = Math.max(
      1000, 
      rawSubtotal - subtotalDiscountAmount + actualShippingCost
    );

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

    // 1. Create Midtrans Snap Token TERLEBIH DAHULU
    const transaction = await snap.createTransaction(parameter);

    // 2. Save the order record to Supabase
    await createOrderInSupabase({
      userId: userId || "guest",
      orderId,
      items: items || [],
      shippingAddress: shippingAddress || null,
      shippingDetail: shippingDetail || null,
      shippingCost: actualShippingCost,
      discountAmount: totalDiscountAmount,
      amount: computedGrossAmount,
      customerName,
      customerEmail,
      customerPhone,
      status: "pending",
      paymentType: "Midtrans",
      appliedVouchersList: validatedVouchers,
      snapToken: transaction.token,
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