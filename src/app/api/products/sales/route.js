import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdmin } from '@/lib/apiAuth';

export const dynamic = "force-dynamic";

// This endpoint returns the total number of sales for each product
// as a map of { productId: total_sold }.
//
// Data comes from the "product_sales_summary" VIEW, which aggregates
// the JSONB "items" column inside "orders" (see orders_complete_existing.sql).
// This is a single, cheap query — the aggregation itself happens in
// Postgres, not in Node.js.
export async function GET(request) {
  try {
    await verifyAdmin(request);

    const { data, error } = await supabaseAdmin
      .from('product_sales_summary')
      .select('product_id, total_sold');

    if (error) throw error;

    const salesMap = {};
    (data || []).forEach((row) => {
      if (row.product_id) {
        salesMap[row.product_id] = Number(row.total_sold) || 0;
      }
    });

    return NextResponse.json({ success: true, sales: salesMap });
  } catch (error) {
    console.error("GET /api/products/sales error:", error.message);
    const isAuthError = error.message.includes("Unauthorized") || error.message.includes("Forbidden");
    return NextResponse.json(
      { success: false, error: error.message },
      { status: isAuthError ? 403 : 500 },
    );
  }
}