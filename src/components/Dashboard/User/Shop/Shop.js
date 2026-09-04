"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import { useStore } from "@/context/StoreContext";
import { getDiscountedPrice } from "@/utils/promo";
import styles from "./Shop.module.css";

import { AppIcon } from "@/components/UI/Icon/AppIcon";
import { supabase } from "@/lib/supabaseClient";

// Import Skeleton
import { ShopSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";

// Import Konfigurasi JSON
import shopConfig from "@/data/ui/shopConfig.json";

const PRODUCTS_PER_PAGE = 12;
const EMPTY_PRODUCTS = [];

export default function Shop({ searchQuery = "", onBukaDetail, initialData }) {
  const { addToCart, activePromo } = useStore();

  // If initialData is provided, use it for the initial state.
  const [products, setProducts] = useState(initialData?.products || []);
  const [orderItemsMap, setOrderItemsMap] = useState(initialData?.salesMap || {});
  const [allReviews, setAllReviews] = useState(initialData?.reviews || []);
  const [loading, setLoading] = useState(!initialData); // Not loading if data is passed
  const [sortBy, setSortBy] = useState("default");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(initialData?.totalProducts || 0);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  // Settings from DB
  const [resolvedHeader, setResolvedHeader] = useState(initialData?.publicSettings?.product?.header || { tagline: "our curated collection", title: { main: "Produk", highlight: "Kami" } });

  const [wishlist, setWishlist] = useState([]);

  // Scroll Animation
  const shopRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (shopRef.current) {
      observer.observe(shopRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Populate wishlist from localStorage on client-side after mount to avoid hydration mismatch
  useEffect(() => {
    try {
      const saved = localStorage.getItem("shop_wishlist");
      if (saved) {
        setWishlist(JSON.parse(saved));
      }
    } catch {
      // If parsing fails, do nothing, wishlist remains empty
    }
  }, []);

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

    // Dynamic import for toast to ensure it's client-side only
    import("react-hot-toast").then(toast => {
        toast.default.success(
          isExist
            ? shopConfig.toasts?.wishlistRemove || "Dihapus dari wishlist."
            : shopConfig.toasts?.wishlistAdd ||
                "Berhasil ditambahkan ke wishlist!",
        );
    });
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
        fetches.push(fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/products?${queryParams.toString()}`, { cache: "default" }));
    } else {
        fetches.push(Promise.resolve(null));
    }
    fetches.push(fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/products/sales/public", { cache: "no-store" }));
    fetches.push(fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/reviews?public=true", { cache: "no-store" }));

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
        }
    } else if(productsResult.status === 'rejected') {
        console.error("Gagal memuat produk:", productsResult.reason);
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
  }, [searchQuery, sortBy, currentPage, shopConfig.toasts?.fetchError]);

  // This effect now handles client-side data fetching ONLY when parameters change.
  useEffect(() => {
    // Skip initial fetch if data is already provided by the server.
    const isInitialLoad = initialData && currentPage === 1 && sortBy === 'default' && !searchQuery;
    if (isInitialLoad) {
      return; // Do nothing on the first render if we have server-provided data.
    }

    // When search or sort changes, reset page to 1
    if (currentPage !== 1 && (searchQuery || sortBy !== "default")) {
      setCurrentPage(1);
    } else {
      // Fetch all data if it's a subsequent load (pagination, filter change)
      fetchShopData(true, currentPage > 1);
    }
  }, [searchQuery, sortBy, currentPage, fetchShopData, initialData]);

  // Client-side fetch for latest settings (to immediately reflect admin changes)
  useEffect(() => {
    const fetchLatestSettings = async () => {
      try {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/settings?public=true", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data?.product?.header) {
            setResolvedHeader({
              tagline: data.product.header.tagline || "our curated collection",
              title: {
                main: data.product.header.title?.main || "Produk",
                highlight: data.product.header.title?.highlight || "Kami"
              }
            });
          }
        }
      } catch (error) {
        console.error("Gagal mengambil pengaturan terbaru", error);
      }
    };
    fetchLatestSettings();
  }, []);

  // Supabase Realtime, deferred to prevent blocking initial render.
  useEffect(() => {
    let channel;
    const timer = setTimeout(() => {
      const refreshCatalog = () => fetchShopData(true);
      channel = supabase
        .channel("storefront-catalog")
        .on("postgres_changes", { event: "*", schema: "public", table: "products" }, refreshCatalog)
        .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, refreshCatalog)
        .subscribe();
    }, 1000); // Delay of 1 second

    return () => {
      clearTimeout(timer);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
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
    <div className={`${styles.shopContainer} ${isVisible ? styles.visible : ""}`} ref={shopRef}>

      <div className={styles.shopHeader}>
        <p className={styles.shopTagline}>{resolvedHeader.tagline}</p>
        <h2>{resolvedHeader.title?.main} <span>{resolvedHeader.title?.highlight}</span></h2>
      </div>

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
