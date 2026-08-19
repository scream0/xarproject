import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const orderId = resolvedParams?.id || resolvedParams?.orderId;

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 }
      );
    }

    // 1. Ambil data pesanan berdasarkan ID atau Nomor Pesanan
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .or(`id.eq.${orderId},order_number.eq.${orderId}`)
      .maybeSingle();

    if (orderError) {
      console.error("[API Order Detail] Error fetching order:", orderError);
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    if (!order) {
      return NextResponse.json(
        { error: `Pesanan "${orderId}" tidak ditemukan.` },
        { status: 404 }
      );
    }

    // 2. Ambil item dari order_items
    const { data: itemsData } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    // 3. Parsing data JSON string dari database
    let parsedAddress = null;
    try {
      parsedAddress = typeof order.shipping_address === "string"
        ? JSON.parse(order.shipping_address)
        : order.shipping_address;
    } catch {
      parsedAddress = order.shipping_address;
    }

    let parsedShippingDetail = {};
    try {
      parsedShippingDetail = typeof order.shipping_detail === "string"
        ? JSON.parse(order.shipping_detail)
        : (order.shipping_detail || {});
    } catch {
      parsedShippingDetail = {};
    }

    let parsedStatusHistory = [];
    try {
      parsedStatusHistory = typeof order.status_history === "string"
        ? JSON.parse(order.status_history)
        : (order.status_history || []);
    } catch {
      parsedStatusHistory = [];
    }

    // 4. Struktur data pengiriman yang seragam untuk frontend
    const shipping = {
      shipping_address: parsedAddress,
      courier_name: parsedShippingDetail?.courierName || order.courier_name || "-",
      service_type: parsedShippingDetail?.courierService || order.courier_service || "-",
      etd: parsedShippingDetail?.courierEtd || "-",
      tracking_number: order.shipping_receipt_number || order.tracking_number || null,
    };

    return NextResponse.json(
      {
        success: true,
        order: {
          ...order,
          shipping_address: parsedAddress,
          shipping_detail: parsedShippingDetail,
        },
        items: itemsData && itemsData.length > 0 ? itemsData : (order.items || []),
        shipping: shipping,
        statusHistory: parsedStatusHistory,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API Order Detail] Internal Server Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}