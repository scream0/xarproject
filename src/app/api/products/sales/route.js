import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = "force-dynamic";

// This endpoint returns the total number of sales for each product
// as a map of { productId: total_sold }.
// Public endpoint — used on the storefront to show "Terjual X" badges.
export async function GET() {
  try {
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
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}