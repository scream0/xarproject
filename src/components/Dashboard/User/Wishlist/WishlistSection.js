"use client";
import { useState, useEffect, useMemo } from "react";
import { useStore } from "@/context/StoreContext";
import toast from "react-hot-toast";
import styles from "./WishlistSection.module.css";
import wishlistConfig from "@/data/ui/wishlistConfig.json";
import { WishlistSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";

export default function WishlistSection() {
  const { products, addToCart } = useStore();
  const [wishlist, setWishlist] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Load wishlist from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("shop_wishlist");
      setWishlist(saved ? JSON.parse(saved) : []);
    } catch {
      setWishlist([]);
    }
    setLoading(false);
  }, []);

  // Persist wishlist on change
  useEffect(() => {
    try {
      localStorage.setItem("shop_wishlist", JSON.stringify(wishlist));
    } catch {}
  }, [wishlist]);

  // Match wishlist IDs against product catalog
  const wishlistProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    return wishlist
      .map((id) =>
        products.find(
          (p) => String(p.id || p._id) === String(id),
        ),
      )
      .filter(Boolean);
  }, [wishlist, products]);

  const filteredProducts = useMemo(() => {
    if (searchQuery.trim() === "") return wishlistProducts;
    const query = searchQuery.toLowerCase();
    return wishlistProducts.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(query) ||
        (p.category || "").toLowerCase().includes(query),
    );
  }, [wishlistProducts, searchQuery]);

  const getTotalStock = (product) => {
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      return product.variants.reduce(
        (sum, v) => sum + Number(v.stock ?? v.stok ?? 0),
        0,
      );
    }
    return Number(product.stock ?? product.stok ?? 0);
  };

  const getStockStatus = (product) => {
    const total = getTotalStock(product);
    if (total <= 0) return "outOfStock";
    if (total <= 5) return "lowStock";
    return "available";
  };

  const getFirstAvailableVariant = (product) => {
    const variants = product.variants || [];
    if (variants.length === 0) {
      return {
        size: "Standard",
        price: product.price || 0,
        stock: getTotalStock(product),
      };
    }
    return (
      variants.find((v) => Number(v.stock ?? v.stok ?? 0) > 0) || variants[0]
    );
  };

  const handleRemove = (productId, e) => {
    e.stopPropagation();
    setWishlist((prev) => prev.filter((id) => String(id) !== String(productId)));
    toast.success(wishlistConfig.toasts.removeSuccess);
  };

  const handleAddToCart = (product, e) => {
    e.stopPropagation();
    const status = getStockStatus(product);
    if (status === "outOfStock") {
      toast.error(wishlistConfig.stock.outOfStock);
      return;
    }
    const variant = getFirstAvailableVariant(product);
    addToCart(product, variant, 1);
    toast.success(wishlistConfig.toasts.addedSuccess);
  };

  const handleExplore = () => {
    window.location.href = "/dashboard?tab=shop";
  };

  const formatRupiah = (number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(number);

  return (
    <div className={styles.workspaceInner}>
      {/* Header */}
      <div className={`card ${styles.cardHeader}`}>
        <div className={styles.headerTopRow}>
          <div>
            <h3 className={styles.headerTitle}>
              {wishlistConfig.header.title}
              <span className={styles.countBadge}>{wishlistProducts.length}</span>
            </h3>
            <p className={styles.headerSubtitle}>
              {wishlistConfig.header.subtitle}
            </p>
          </div>
          <div className={styles.headerActions}>
            <input
              type="text"
              placeholder={wishlistConfig.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <WishlistSkeleton count={4} />
      ) : filteredProducts.length === 0 ? (
        <div className={`card ${styles.centerStateCard}`}>
          <div className={styles.emptyIcon}>❤️</div>
          <p className={styles.emptyTitle}>{wishlistConfig.emptyTitle}</p>
          <p className={styles.emptyText}>{wishlistConfig.emptyText}</p>
          <button onClick={handleExplore} className={styles.exploreBtn}>
            {wishlistConfig.buttons.explore}
          </button>
        </div>
      ) : (
        <div className={styles.productGrid}>
          {filteredProducts.map((product) => {
            const pId = String(product.id || product._id);
            const stockStatus = getStockStatus(product);
            const displayPrice =
              product.variants?.[0]?.price || product.price || 0;
            const priceFormatted = displayPrice
              ? formatRupiah(displayPrice)
              : "Rp 0";

            return (
              <div
                key={pId}
                className={`${styles.productCard} ${
                  stockStatus === "outOfStock" ? styles.outOfStock : ""
                }`}
              >
                <div className={styles.productImageWrapper}>
                  {product.image_url || product.imageUrl ? (
                    <img
                      src={product.image_url || product.imageUrl}
                      alt={product.name}
                      className={styles.productImg}
                    />
                  ) : (
                    <div className={styles.productPlaceholder}>
                      No Image
                    </div>
                  )}
                  <span className={styles.categoryBadge}>
                    {product.category || "Parfum"}
                  </span>
                  <button
                    className={styles.removeBtn}
                    onClick={(e) => handleRemove(pId, e)}
                    aria-label={wishlistConfig.buttons.remove}
                  >
                    ✕
                  </button>
                  {stockStatus === "outOfStock" && (
                    <span className={styles.outOfStockBadge}>
                      {wishlistConfig.stock.outOfStock}
                    </span>
                  )}
                </div>

                <div className={styles.productBody}>
                  <h4 className={styles.productName}>{product.name}</h4>
                  <div className={styles.productPriceRow}>
                    <span className={styles.productPrice}>
                      {priceFormatted}
                    </span>
                    <span
                      className={`${styles.stockBadge} ${
                        styles[`stock_${stockStatus}`]
                      }`}
                    >
                      {stockStatus === "available" &&
                        wishlistConfig.stock.available}
                      {stockStatus === "lowStock" &&
                        wishlistConfig.stock.lowStock}
                      {stockStatus === "outOfStock" &&
                        wishlistConfig.stock.outOfStock}
                    </span>
                  </div>
                  <button
                    className={styles.addToCartBtn}
                    onClick={(e) => handleAddToCart(product, e)}
                    disabled={stockStatus === "outOfStock"}
                  >
                    {wishlistConfig.buttons.addToCart}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

