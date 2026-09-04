function getVariantStock(variant: any) {
  if (!variant || typeof variant !== "object") return 0;
  return Number(variant.stock ?? variant.stok ?? 0) || 0;
}

function calculateDashboardStats({ products = [], orders = [] }: { products?: any[]; orders?: any[] } = {}) {
  const productList = Array.isArray(products) ? products : [];
  const orderList = Array.isArray(orders) ? orders : [];

  const activeProductsCount = productList.length;
  const lowStockCount = productList.reduce((count, product) => {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    const lowStockVariants = variants.filter((variant: any) => getVariantStock(variant) <= 5);
    return count + lowStockVariants.length;
  }, 0);

  const paidStatuses = new Set(["paid", "success", "processing", "shipped", "shipping", "completed", "settlement", "delivered", "capture"]);

  const totalRevenue = orderList.reduce((total, order) => {
    const status = String(order?.status || "").toLowerCase();
    if (!paidStatuses.has(status)) return total;
    return total + Number(order?.amount || order?.total_amount || order?.gross_amount || order?.total || order?.price || 0);
  }, 0);

  return {
    totalRevenue,
    totalOrders: orderList.length,
    activeProducts: activeProductsCount,
    lowStockCount,
  };
}

export { calculateDashboardStats };
