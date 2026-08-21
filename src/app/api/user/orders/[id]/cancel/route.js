import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyUser } from "@/lib/apiAuth";

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

    if ((orderData.status || "").toLowerCase() !== "pending") {
      return NextResponse.json(
        { success: false, error: "Only pending orders can be cancelled" },
        { status: 409 },
      );
    }

    const historyEntry = {
      status: "cancelled",
      notes: "Pembatalan oleh pelanggan",
      actor: "customer",
      timestamp: new Date().toISOString(),
    };

    const { data: updatedOrder, error: updateErr } = await supabaseAdmin
      .from("orders")
      .update({
        status: "cancelled",
        status_history: [...(orderData.status_history || []), historyEntry],
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // --- Mengembalikan Stok ---
    try {
      const { data: orderItems } = await supabaseAdmin
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);

      if (orderItems && orderItems.length > 0) {
        for (const item of orderItems) {
          const quantity = Number(item.quantity) || 1;
          const { data: product } = await supabaseAdmin
            .from("products")
            .select("id, name, variants")
            .eq("id", item.product_id)
            .single();

          if (product && Array.isArray(product.variants)) {
            const variantIndex = product.variants.findIndex(
              (v) => String(v.size || "").toLowerCase() === String(item.variant_name || "").toLowerCase()
            );

            if (variantIndex > -1) {
              const currentStock = Number(product.variants[variantIndex].stock ?? product.variants[variantIndex].stok ?? 0);
              product.variants[variantIndex].stock = currentStock + quantity;
              
              await supabaseAdmin
                .from("products")
                .update({ variants: product.variants })
                .eq("id", product.id);
            }
          }
        }
      }
    } catch (stockErr) {
      console.error("Failed to restore stock on cancel:", stockErr);
      // Tetap lanjutkan meskipun gagal restore stock agar pesanan tetap batal
    }
    // --------------------------

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error("Failed to cancel order:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
