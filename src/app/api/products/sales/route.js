import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = "force-dynamic";

// This endpoint calculates the total number of sales for each product
// and returns a map of { productId: total_sold }.
// This is much more efficient than sending all orders to the client.
export async function GET() {
  try {
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('status, order_items(product_id, quantity)')
      .in('status', ['success', 'completed', 'shipping', 'shipped', 'settlement', 'capture', 'paid']);

    if (ordersError) throw ordersError;

    const salesMap = {};
    orders.forEach(order => {
      order.order_items.forEach(item => {
        if (item.product_id) {
          salesMap[item.product_id] = (salesMap[item.product_id] || 0) + item.quantity;
        }
      });
    });

    return NextResponse.json({ success: true, sales: salesMap });
  } catch (error) {
    console.error("GET /api/products/sales error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
