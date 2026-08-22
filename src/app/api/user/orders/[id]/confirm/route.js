import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyUser } from "@/lib/apiAuth";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY || process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const dynamic = "force-dynamic";

export async function POST(request, context) {
  try {
    const params = await context.params;
    const orderId = params?.id;
    const { searchParams } = new URL(request.url);
    const user = await verifyUser(request);
    const userId = user.id;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Order id is required" },
        { status: 400 },
      );
    }

    const { data: orderData, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (fetchErr || !orderData) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 },
      );
    }

    if (String(orderData.user_id || "") !== userId) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const currentStatus = (orderData.status || "").toLowerCase();
    if (currentStatus === "cancelled") {
      return NextResponse.json(
        { success: false, error: "Cancelled orders cannot be confirmed" },
        { status: 409 },
      );
    }

    const historyEntry = {
      status: "delivered",
      notes: "Pembeli mengonfirmasi pesanan diterima",
      actor: "customer",
      timestamp: new Date().toISOString(),
    };

    let newShippingDetail = orderData.shipping_detail || {};
    
    const paymentProofUrl = newShippingDetail.payment_proof_url;
    if (paymentProofUrl) {
      try {
        const match = paymentProofUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
        const publicId = match ? match[1] : null;
        if (publicId) {
          await cloudinary.uploader.destroy(publicId, {
            resource_type: "image",
            invalidate: true,
          });
        }
      } catch (cloudinaryErr) {
        console.error("Gagal menghapus bukti pembayaran dari Cloudinary:", cloudinaryErr);
      }
      
      delete newShippingDetail.payment_proof_url;
    }

    const { data: updatedOrder, error: updateErr } = await supabaseAdmin
      .from("orders")
      .update({
        status: "delivered",
        shipping_detail: newShippingDetail,
        status_history: [...(orderData.status_history || []), historyEntry],
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error("Failed to confirm order:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}

