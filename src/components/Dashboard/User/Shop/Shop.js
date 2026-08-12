"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { useStore } from "@/context/StoreContext";
import { getDiscountedPrice } from "@/utils/promo";
import styles from "./Shop.module.css";
import toast from "react-hot-toast";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { supabase } from "@/lib/supabaseClient";

// Import Skeleton
import { ShopSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";

// Import Konfigurasi JSON
import shopConfig from "@/data/ui/shopConfig.json";

const PRODUCTS_PER_PAGE = 12;

export default function Shop({ initialProducts = [], initialTotalProducts = 0, searchQuery = "", onBukaDetail }) {
  const { addToCart, products: contextProducts, activePromo, cartQuantity, setIsCartOpen } = useStore();
  const [products, setProducts] = useState(initialProducts || []);
  const [orderItemsMap, setOrderItemsMap] = useState({});
  const [allReviews, setAllReviews] = useState([]);
  const [loading, setLoading] = useState(!initialProducts);
  const [sortBy, setSortBy] = useState("default");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(initialTotalProducts || 0);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  // Wishlist State (LocalStorage persistence)
  const [wishlist, setWishlist] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("shop_wishlist");
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const toggleWishlist = (productId, e) => {
    e.stopPropagation();
    const isExist = wishlist.includes(productId);
    const updated = isExist
      ? wishlist.filter((id) => id !== productId)
      : [...wishlist, productId];

    setWishlist(updated);

    try {
      localStorage.setItem("shop_wishlist", JSON.stringify(updated));
    } catch {}

    window.dispatchEvent(
      new CustomEvent("wishlist-updated", {
        detail: { count: updated.length, items: updated },
      }),
    );

    toast.success(
      isExist
        ? shopConfig.toasts?.wishlistRemove || "Dihapus dari wishlist."
        : shopConfig.toasts?.wishlistAdd ||
            "Berhasil ditambahkan ke wishlist!",
    );
  };

  const fetchShopData = useCallback(async (shouldFetchProducts = true, append = false) => {
    if (shouldFetchProducts) {
      if (!append) {
        setLoading(true);
      } else {
        setIsFetchingMore(true);
      }
    }

    const queryParams = new URLSearchParams();
    if (searchQuery) queryParams.append("search", searchQuery);
    queryParams.append("sortBy", sortBy);
    queryParams.append("page", currentPage.toString());
    queryParams.append("limit", PRODUCTS_PER_PAGE.toString());

    const fetches = [];
    if (shouldFetchProducts) {
        fetches.push(fetch(`/api/products?${queryParams.toString()}`, { cache: "default" }));
    } else {
        fetches.push(Promise.resolve(null));
    }
    fetches.push(fetch("/api/products/sales", { cache: "no-store" }));
    fetches.push(fetch("/api/reviews?public=true", { cache: "no-store" }));

    const [productsResult, salesResult, reviewsResult] = await Promise.allSettled(fetches);

    // Process Products
    if (productsResult.status === 'fulfilled' && productsResult.value) {
        const res = productsResult.value;
        const contentType = res.headers.get("content-type");
        if (res.ok && contentType && contentType.includes("application/json")) {
            const result = await res.json();
            const fetchedProducts = result.data || result.products || result || [];
            setProducts((prev) => (append ? [...prev, ...fetchedProducts] : fetchedProducts));
            setTotalProducts(result.total || 0);
        } else if (res) {
            const errorText = await res.text();
            console.error("Gagal memuat produk:", errorText);
            toast.error(shopConfig.toasts?.fetchError || "Gagal memuat katalog produk");
        }
    } else if(productsResult.status === 'rejected') {
        console.error("Gagal memuat produk:", productsResult.reason);
        toast.error(shopConfig.toasts?.fetchError || "Gagal memuat katalog produk");
    }

    // Process Sales Data
    if (salesResult.status === 'fulfilled') {
        const res = salesResult.value;
        const contentType = res.headers.get("content-type");
        if (res.ok && contentType && contentType.includes("application/json")) {
            const result = await res.json();
            setOrderItemsMap(result.sales || {});
        } else {
           console.warn("Catatan: Data penjualan belum tersedia, respons tidak valid.");
        }
    } else {
        console.warn("Catatan: Data penjualan belum tersedia.", salesResult.reason.message);
    }

    // Process Reviews
    if (reviewsResult.status === 'fulfilled') {
        const res = reviewsResult.value;
        const contentType = res.headers.get("content-type");
        if (res.ok && contentType && contentType.includes("application/json")) {
            const result = await res.json();
            setAllReviews(result.reviews || []);
        } else {
            console.warn("Catatan: Data ulasan belum tersedia, respons tidak valid.");
        }
    } else {
        console.warn("Catatan: Data ulasan belum tersedia.", reviewsResult.reason.message);
    }

    setLoading(false);
    setIsFetchingMore(false);
  }, [searchQuery, sortBy, currentPage, toast, shopConfig.toasts?.fetchError]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    // When search or sort changes, reset page to 1
    if (currentPage !== 1 && (searchQuery || sortBy !== "default")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentPage(1);
    } else {
      const shouldFetchProducts = !initialProducts || products.length === 0 || currentPage > 1;
      fetchShopData(shouldFetchProducts, currentPage > 1);
    }
  }, [searchQuery, sortBy, currentPage, fetchShopData, initialProducts, products.length]);

  // Supabase Realtime keeps catalog stock, price and public review data in sync.
  useEffect(() => {
    const refreshCatalog = () => fetchShopData(true);
    const channel = supabase
      .channel("storefront-catalog")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, refreshCatalog)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, refreshCatalog)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchShopData]);

  // Handle product-stock-updated event
  useEffect(() => {
    const handleStorageChange = () => fetchShopData(true);
    window.addEventListener("product-stock-updated", handleStorageChange);
    return () => {
      window.removeEventListener("product-stock-updated", handleStorageChange);
    };
  }, [fetchShopData]);

  const handleLoadMore = () => {
    setCurrentPage((prevPage) => prevPage + 1);
  };

  const currentProducts = useMemo(() => products, [products]);

  const getVariantStock = (variant) =>
    Number(variant?.stock ?? variant?.stok ?? 0);

  const getProductTotalStock = (product) => {
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      return product.variants.reduce((acc, v) => acc + getVariantStock(v), 0);
    }
    return getVariantStock(product);
  };

  const isProductOutOfStock = (product) => {
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      return product.variants.every((v) => getVariantStock(v) <= 0);
    }
    return getVariantStock(product) <= 0;
  };

  const getFirstAvailableVariantIndex = (product) => {
    const idx = (product.variants || []).findIndex(
      (v) => getVariantStock(v) > 0,
    );
    return idx !== -1 ? idx : 0;
  };

  return (
    <div className={styles.shopContainer}>


      <h2 className={styles.productsHeader}>Produk Kami</h2>

      {/* Filter Tabs (Fungsional) */}
      <div className={styles.filterTabsWrapper}>
        <button
          onClick={() => {
            setSortBy("default");
            setCurrentPage(1);
          }}
          className={`${styles.filterTabBtn} ${sortBy === "default" ? styles.activeFilterTab : ""}`}
        >
          {shopConfig.filters?.sortDefault || "Terbaru"}
        </button>
        <button
          onClick={() => {
            setSortBy("price-low");
            setCurrentPage(1);
          }}
          className={`${styles.filterTabBtn} ${sortBy === "price-low" ? styles.activeFilterTab : ""}`}
        >
          {shopConfig.filters?.sortPriceLow || "Harga Terendah"}
        </button>
        <button
          onClick={() => {
            setSortBy("price-high");
            setCurrentPage(1);
          }}
          className={`${styles.filterTabBtn} ${sortBy === "price-high" ? styles.activeFilterTab : ""}`}
        >
          {shopConfig.filters?.sortPriceHigh || "Harga Tertinggi"}
        </button>
        <button
          onClick={() => {
            setSortBy("name");
            setCurrentPage(1);
          }}
          className={`${styles.filterTabBtn} ${sortBy === "name" ? styles.activeFilterTab : ""}`}
        >
          {shopConfig.filters?.sortName || "Nama"}
        </button>
      </div>

      {loading ? (
        <ShopSkeleton count={PRODUCTS_PER_PAGE} />
      ) : currentProducts.length === 0 && !isFetchingMore ? (
        <div className={styles.stateContainer}>
          <p>{shopConfig.messages?.empty || "Produk tidak ditemukan."}</p>
        </div>
      ) : (
        <>
          <div className={styles.productGrid}>
            {currentProducts.map((product) => {
              const pId = String(product.id || product._id || "");
              const totalSold =
                orderItemsMap[pId] || Number(product.total_sold || 0);
              const displayPrice =
                product.variants?.[0]?.price || product.price || 0;
              const priceFormatted = displayPrice
                ? `Rp ${Number(displayPrice).toLocaleString("id-ID")}`
                : shopConfig.card?.fallbackPrice || "Rp 0";
              const outOfStock = isProductOutOfStock(product);
              const totalStockLeft = getProductTotalStock(product);
              const isWishlisted = wishlist.includes(pId);
              const productReviews = allReviews.filter((review) => String(review.productId) === pId);
              const averageRating = productReviews.length ? (productReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / productReviews.length).toFixed(1) : null;

              return (
                <div
                  key={pId}
                  className={`${styles.productCard} ${outOfStock ? styles.outOfStock : ""}`}
                  onClick={() => onBukaDetail(product)}
                >
                  <div className={styles.productCardImageWrapper}>
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        className={styles.productCardImg}
                        width={300}
                        height={300}
                      />
                    ) : (
                      <div className={styles.productCardPlaceholder}>
                        {shopConfig.card?.placeholderImageText || "No Image"}
                      </div>
                    )}
                    <span className={styles.cardCategoryBadge}>
                      {product.category ||
                        shopConfig.card?.defaultCategory ||
                        "Parfum"}
                    </span>
                    <button
                      className={`${styles.wishlistBtn} ${isWishlisted ? styles.wishlistActive : ""}`}
                      onClick={(e) => toggleWishlist(pId, e)}
                      aria-label="Wishlist"
                    >
                      <svg viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                        />
                      </svg>
                    </button>
                    {outOfStock && (
                      <span className={styles.outOfStockBadge}>
                        {shopConfig.card?.soldOutBadge || "Habis"}
                      </span>
                    )}
                  </div>
                  <div className={styles.productCardBody}>
                    <div className={styles.cardTopInfo}>
                      <h3 className={styles.productName}>{product.name}</h3>
                      <button
                        className={`${styles.cartIconBtn} ${outOfStock ? styles.cartIconBtnDisabled : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!outOfStock) {
                            const variant = product.variants?.[getFirstAvailableVariantIndex(product)] || { size: "Standard", price: product.price || 0, stock: 10 };
                            addToCart(product, variant, 1);
                          }
                        }}
                        disabled={outOfStock}
                        aria-label={
                          shopConfig.card?.addToCartTitle ||
                          "Tambah ke keranjang"
                        }
                      >
                        <AppIcon name="shopping-cart" />
                      </button>
                    </div>
                    <div className={styles.cardPriceRow}>
                      {(() => {
                        if (outOfStock) return <span className={styles.cardPrice}>{shopConfig.card?.outOfStockTitle || "Stok Habis"}</span>;
                        const discounted = getDiscountedPrice(displayPrice, activePromo);
                        return (
                          <>
                            {discounted.hasDiscount && (
                              <span className={styles.cardOriginalPrice}>
                                {priceFormatted}
                              </span>
                            )}
                            <span className={styles.cardPrice}>
                              {`Rp ${Number(discounted.price).toLocaleString("id-ID")}`}
                            </span>
                            {discounted.hasDiscount && (
                              <span className={styles.cardDiscountBadge}>
                                Hemat {`Rp ${Number(discounted.savings).toLocaleString("id-ID")}`}
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <div className={styles.reviewSummary}>{averageRating ? `★ ${averageRating} (${productReviews.length})` : "Belum ada ulasan"}</div>
                    <div className={styles.cardFooterInfo}>
                      <span
                        className={
                          outOfStock
                            ? styles.soldCount
                            : totalStockLeft <= 5
                              ? styles.stockIndicatorLow
                              : styles.stockIndicator
                        }
                      >
                        {outOfStock
                          ? `Terjual ${totalSold}`
                          : `Sisa ${totalStockLeft} lagi!`}
                      </span>
                      <span className={styles.viewDetailText}>
                        {shopConfig.card?.viewDetail || "Detail"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {currentProducts.length < totalProducts && (currentPage * PRODUCTS_PER_PAGE < totalProducts) && (
            <div className={styles.paginationWrapper}>
              <button
                onClick={handleLoadMore}
                disabled={isFetchingMore}
                className={styles.loadMoreBtn}
              >
                {shopConfig.buttons?.loadMore || "Muat Lebih Banyak"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
