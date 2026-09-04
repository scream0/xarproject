import type { SalesMap } from '@/types/data';

const PRODUCTS_PER_PAGE = 12;

// Gunakan NEXT_PUBLIC_API_URL yang sudah didefinisikan (misal: https://api.mameko.id)
const getBaseUrl = () => {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
};

/**
 * Fetches the initial list of products for the main page.
 * Uses the Go API to ensure consistency with the Shop page.
 */
export async function getInitialProducts() {
  try {
    const res = await fetch(`${getBaseUrl()}/api/products?page=1&limit=${PRODUCTS_PER_PAGE}`, {
      cache: "force-cache", 
    });
    
    if (!res.ok) {
      throw new Error(`Failed to fetch products: ${res.statusText}`);
    }

    const result = await res.json();
    const data = result.data || result.products || [];

    const parsedData = data.map((product: any) => {
      let parsedVariants = product.variants;
      if (typeof parsedVariants === "string") {
        try {
          parsedVariants = JSON.parse(parsedVariants);
        } catch (e) {
          parsedVariants = [];
        }
      }
      return {
        ...product,
        variants: parsedVariants,
      };
    });

    return { products: parsedData, total: result.total ?? 0 };
  } catch (error) {
    if (error instanceof Error) {
      console.error("[ProductService] " + error.message);
    } else {
      console.error("[ProductService] An unknown error occurred");
    }
    return { products: [], total: 0 };
  }
}

/**
 * Fetches the total sales for each product.
 */
export async function getSalesData(): Promise<SalesMap> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/products/sales/public`, {
      cache: "force-cache",
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch sales data: ${res.statusText}`);
    }

    const result = await res.json();
    return result.sales || {};
  } catch (error) {
    if (error instanceof Error) {
      console.error("[ProductService] Error fetching sales data: " + error.message);
    } else {
      console.error("[ProductService] An unknown error occurred while fetching sales data");
    }
     return {};
  }
}

/**
 * Fetches all approved public reviews.
 */
export async function getPublicReviews() {
   try {
    const res = await fetch(`${getBaseUrl()}/api/reviews?public=true`, {
      cache: "force-cache",
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch public reviews: ${res.statusText}`);
    }

    const result = await res.json();
    const data = result.reviews || [];
    
    // Map to camelCase to remain consistent with what Shop.js expects
    return data.map((r: any) => ({
      id: r.id,
      productId: r.product_id || r.productId,
      userName: r.user_name || r.userName,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at || r.createdAt,
    }));
  } catch (error) {
    if (error instanceof Error) {
      console.error("[ProductService] Error fetching public reviews: " + error.message);
    } else {
      console.error("[ProductService] An unknown error occurred while fetching public reviews");
    }
     return [];
  }
}
