import { supabaseAdmin } from '@/lib/supabaseAdmin';

const PRODUCTS_PER_PAGE = 12;

/**
 * Fetches the initial list of products for the main page.
 * Corresponds to the logic in /api/products GET handler.
 */
export async function getInitialProducts() {
  try {
    let query = supabaseAdmin
      .from("products")
      .select("id, name, description, category, image_url, variants, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(0, PRODUCTS_PER_PAGE - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching initial products:", error);
      // In a server component, throwing the error can be a good strategy
      // as it can be caught by an error boundary.
      throw error;
    }

    return { products: data || [], total: count ?? 0 };
  } catch (error) {
    console.error("[ProductService] " + error.message);
    // Return a default state on failure
    return { products: [], total: 0 };
  }
}

/**
 * Fetches the total sales for each product.
 * Corresponds to the logic in /api/products/sales GET handler.
 */
export async function getSalesData() {
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
    return salesMap;
  } catch (error) {
     console.error("[ProductService] Error fetching sales data: " + error.message);
     return {};
  }
}

/**
 * Fetches all approved public reviews.
 * Corresponds to the logic in /api/reviews GET handler for public requests.
 */
export async function getPublicReviews() {
   try {
    let { data, error } = await supabaseAdmin
        .from("reviews")
        .select("id, product_id, user_name, rating, comment, created_at")
        .eq("approved", true)
        .order("created_at", { ascending: false });

    if (error) throw error;
    
    // The API route does a mapping, but we can just return the direct data
    // if the client side component is adapted slightly. Let's do that for efficiency.
    return data || [];
  } catch (error) {
     console.error("[ProductService] Error fetching public reviews: " + error.message);
     return [];
  }
}
