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
    appliedVoucherId,
    voucherClaimId,
  } = orderDetails;

  // 1. Prepare the main order payload including items array JSON
  const orderPayload = {
    id: orderId,
    user_id: userId === "guest" ? null : userId,
    status: status || "pending",
    amount: amount,
    total_amount: amount, // Menyesuaikan jika tabel menggunakan total_amount
    shipping_cost: shippingCost || 0,
    discount_amount: discountAmount || 0,
    tax_amount: 0,
    payment_type: paymentType,
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    shipping_address: shippingAddress,
    shipping_detail: shippingDetail,
    voucher_claim_id: voucherClaimId || null,
    items: items || [], // Menyimpan item langsung ke kolom JSON `items` di tabel orders
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

  // 2. Insert the main order record
  const { error: orderError } = await supabaseAdmin
    .from("orders")
    .insert(orderPayload);

  if (orderError) {
    console.error("Supabase error creating order:", orderError.message);
    throw new Error(`Failed to create order record: ${orderError.message}`);
  }

  // 3. Jika ada voucher yang dipakai, catat ke tabel voucher_usage
  if (appliedVoucherId && userId && userId !== "guest") {
    const { error: usageError } = await supabaseAdmin
      .from("voucher_usage")
      .insert({
        user_id: userId,
        voucher_id: appliedVoucherId,
        order_id: orderId,
      });

    if (usageError) {
      console.error("Gagal mencatat voucher usage:", usageError.message);
      // Tidak perlu menggagalkan order, cukup log errornya
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
      appliedVoucherId,
      voucherClaimId, 
      voucherDiscount: clientVoucherDiscount = 0,
    } = body;

    const orderId = body.orderId || uuidv4();

    if (!orderId || !amount) {
      return NextResponse.json(
        { success: false, error: "orderId and amount are required" },
        { status: 400 },
      );
    }

    // ── VALIDASI VOUCHER DI SERVER (Security Check) ──
    let verifiedVoucherDiscount = 0;
    let validVoucherId = null;
    let actualShippingCost = Number(shippingCost) || 0;
    let validVoucherClaimId = null;

    if (appliedVoucherId) {
      const { data: dbVoucher, error: vErr } = await supabaseAdmin
        .from("vouchers")
        .select("*")
        .eq("id", appliedVoucherId)
        .eq("is_active", true)
        .single();

      if (!vErr && dbVoucher) {
        const rawSubtotal = (items || []).reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);

        if (rawSubtotal >= Number(dbVoucher.min_purchase)) {
          validVoucherId = dbVoucher.id;

          if (voucherClaimId && userId && userId !== "guest") {
            const { data: claimRow, error: claimErr } = await supabaseAdmin
              .from("user_vouchers")
              .select("id, used_at")
              .eq("id", voucherClaimId)
              .eq("user_id", userId)
              .eq("voucher_id", appliedVoucherId)
              .single();

            if (!claimErr && claimRow && !claimRow.used_at) {
              validVoucherClaimId = claimRow.id;
            }
          }

          if (dbVoucher.type === 'shipping') {
            verifiedVoucherDiscount = Math.min(actualShippingCost, Number(dbVoucher.discount_amount || 0));
            actualShippingCost = Math.max(0, actualShippingCost - verifiedVoucherDiscount);
          } else if (dbVoucher.type === 'percentage') {
            verifiedVoucherDiscount = (rawSubtotal * Number(dbVoucher.discount_amount || 0)) / 100;
          } else {
            verifiedVoucherDiscount = Number(dbVoucher.discount_amount || 0);
          }
        }
      }
    }

    let customerName = "Customer XAR Store";
    let customerEmail = "customer@xarstore.com";
    let customerPhone = "08123456789";

    if (userId) {
      try {
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (error) throw error;
        const user = data?.user;
        if (user) {
            customerEmail = user.email || customerEmail;
            customerPhone = user.phone || customerPhone;
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

    if (verifiedVoucherDiscount > 0) {
      formattedItems.push({
        id: "VOUCHER-DISCOUNT",
        price: -Math.round(verifiedVoucherDiscount),
        quantity: 1,
        name: "Diskon Voucher / Gratis Ongkir",
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

    const computedGrossAmount = formattedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.max(1000, computedGrossAmount),
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

    // 2. Save the order record directly with JSON items to Supabase
    await createOrderInSupabase({
      userId: userId || "guest",
      orderId,
      items: items || [],
      shippingAddress: shippingAddress || null,
      shippingDetail: shippingDetail || null,
      shippingCost: actualShippingCost,
      discountAmount: verifiedVoucherDiscount,
      amount: Math.max(1000, computedGrossAmount),
      customerName,
      customerEmail,
      customerPhone,
      status: "pending",
      paymentType: "Midtrans",
      appliedVoucherId: validVoucherId,
      voucherClaimId: validVoucherClaimId,
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