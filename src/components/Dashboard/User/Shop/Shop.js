"use client";

import { useState, useEffect, useMemo } from "react";
import { useStore } from "@/context/StoreContext";
import { getDiscountedPrice } from "@/utils/promo";
import styles from "./Shop.module.css";
import toast from "react-hot-toast";
import { AppIcon } from "@/components/UI/Icon/AppIcon";

// Import Skeleton
import { ShopSkeleton } from "@/components/UI/Skeleton/SkeletonLayouts";

// Import Konfigurasi JSON
import shopConfig from "@/data/ui/shopConfig.json";

const PRODUCTS_PER_PAGE = 12;

export default function Shop() {
  const { addToCart, products: contextProducts, activePromo, cartQuantity, setIsCartOpen } = useStore();
  const [products, setProducts] = useState([]);
  const [orderItemsMap, setOrderItemsMap] = useState({});
  const [allReviews, setAllReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PER_PAGE);

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

  // State untuk Modal Detail Produk
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeVariantIdx, setActiveVariantIdx] = useState(0);

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

  // Fetch Produk, Orders & Reviews secara terpisah
  const fetchShopData = async () => {
    try {
      const productsRes = await fetch("/api/products", { cache: "no-store" });
      const prodContentType = productsRes.headers.get("content-type");

      if (!prodContentType || !prodContentType.includes("application/json")) {
        throw new Error(
          "Endpoint /api/products tidak mengembalikan JSON yang valid.",
        );
      }

      const productsResult = await productsRes.json();
      if (!productsRes.ok)
        throw new Error(productsResult.error || "Gagal memuat katalog produk");

      const fetchedProducts =
        productsResult.data || productsResult.products || productsResult || [];
      setProducts(fetchedProducts);
    } catch (err) {
      console.error("Gagal memuat produk:", err.message);
      toast.error(
        shopConfig.toasts?.fetchError || "Gagal memuat katalog produk",
      );
    } finally {
      setLoading(false);
    }

    try {
      const ordersRes = await fetch("/api/orders", { cache: "no-store" });
      const orderContentType = ordersRes.headers.get("content-type");

      if (
        ordersRes.ok &&
        orderContentType &&
        orderContentType.includes("application/json")
      ) {
        const ordersResult = await ordersRes.json();
        const transactions = Array.isArray(ordersResult)
          ? ordersResult
          : ordersResult.data || ordersResult.orders || [];

        const soldCounts = {};
        transactions.forEach((order) => {
          const status = (order.status || "").toLowerCase();
          if (
            [
              "success",
              "completed",
              "shipping",
              "shipped",
              "settlement",
              "capture",
              "paid",
            ].includes(status)
          ) {
            const items = order.items || order.order_items || [];
            items.forEach((item) => {
              const pId = String(
                item.id || item.productId || item.product_id || "",
              );
              const qty = Number(item.quantity || item.qty) || 1;
              if (pId) {
                soldCounts[pId] = (soldCounts[pId] || 0) + qty;
              }
            });
          }
        });
        setOrderItemsMap(soldCounts);
      }
    } catch (err) {
      console.warn("Catatan: Data orders belum tersedia.", err.message);
    }

    // Fetch review yang sudah approved dari collection "reviews"
    try {
      const reviewsRes = await fetch("/api/reviews?public=true", {
        cache: "no-store",
      });
      const reviewContentType = reviewsRes.headers.get("content-type");

      if (
        reviewsRes.ok &&
        reviewContentType &&
        reviewContentType.includes("application/json")
      ) {
        const reviewsResult = await reviewsRes.json();
        setAllReviews(reviewsResult.reviews || []);
      }
    } catch (err) {
      console.warn("Catatan: Data ulasan belum tersedia.", err.message);
    }
  };

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      fetchShopData();
    }, 0);
    const handleStorageChange = () => fetchShopData();
    window.addEventListener("product-stock-updated", handleStorageChange);
    return () => {
      window.clearTimeout(syncTimer);
      window.removeEventListener("product-stock-updated", handleStorageChange);
    };
  }, [contextProducts]);

  const processedProducts = useMemo(() => {
    let result = [...products];

    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(query) ||
          (p.description || "").toLowerCase().includes(query),
      );
    }

    switch (sortBy) {
      case "price-low":
        result.sort(
          (a, b) =>
            (a.variants?.[0]?.price || a.price || 0) -
            (b.variants?.[0]?.price || b.price || 0),
        );
        break;
      case "price-high":
        result.sort(
          (a, b) =>
            (b.variants?.[0]?.price || b.price || 0) -
            (a.variants?.[0]?.price || a.price || 0),
        );
        break;
      case "name":
        result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        break;
      default:
        break;
    }
    return result;
  }, [products, searchQuery, sortBy]);

  const productReviewsMap = useMemo(() => {
    const map = {};
    allReviews.forEach((rev) => {
      const pId = String(rev.productId || "");
      if (!pId) return;

      if (!map[pId]) map[pId] = [];
      map[pId].push({
        id: rev.id,
        customer: rev.userName || "Pelanggan",
        rating: Number(rev.rating || 5),
        comment: rev.comment || "Produk sangat bagus dan berkualitas!",
        photo: rev.photo || rev.review_photo || null,
        date: rev.createdAt
          ? new Date(
              rev.createdAt.seconds
                ? rev.createdAt.seconds * 1000
                : rev.createdAt,
            ).toLocaleDateString("id-ID")
          : "Baru saja",
      });
    });
    return map;
  }, [allReviews]);

  const productReviews = useMemo(() => {
    if (!selectedProduct) return [];
    const targetId = String(selectedProduct.id || selectedProduct._id || "");
    const dynamicReviews = productReviewsMap[targetId] || [];

    if (dynamicReviews.length === 0 && Array.isArray(selectedProduct.reviews)) {
      return selectedProduct.reviews;
    }
    return dynamicReviews;
  }, [selectedProduct, productReviewsMap]);

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

  const handleAddToCart = (product, variantIndex = 0) => {
    const variants = product.variants || [];
    const targetIdx =
      variantIndex >= 0 ? variantIndex : getFirstAvailableVariantIndex(product);
    const variant = variants[targetIdx] || {
      size: "Standard",
      price: product.price || 0,
      stock: 10,
    };

    if (getVariantStock(variant) <= 0) {
      toast.error(`Stok ${product.name} (${variant.size}) sudah habis!`);
      fetchShopData();
      return;
    }
    addToCart(product, variant, 1);
  };

  return (
    <div className={styles.shopContainer}>
      {/* Navbar Atas Melayang */}
      <div className={styles.shopNavbar}>
        <div className={styles.navbarSearchWrapper}>
          <AppIcon name="search" className={styles.searchIcon} />
          <input
            type="text"
            placeholder={
              shopConfig.filters?.searchPlaceholder || "Cari parfum..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInputNavbar}
          />
        </div>
        <div className={styles.navbarActions}>
          <button
            className={styles.chatIconBtnNavbar}
            onClick={() => toast.success("Membuka chat...")}
            aria-label="Chat"
          >
            <AppIcon name="message-circle" className={styles.svgIcon} />
          </button>
          <button
            className={styles.cartIconBtnNavbar}
            onClick={() => setIsCartOpen(true)}
            aria-label={shopConfig.aria?.cart || "Keranjang"}
          >
            <AppIcon name="shopping-cart" className={styles.svgIcon} />
            {cartQuantity > 0 && (
              <span className={styles.cartQuantityBadge}>
                {cartQuantity}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter Tabs (Fungsional) */}
      <div className={styles.filterTabsWrapper}>
        <button
          onClick={() => setSortBy("default")}
          className={`${styles.filterTabBtn} ${sortBy === "default" ? styles.activeFilterTab : ""}`}
        >
          {shopConfig.filters?.sortDefault || "Terbaru"}
        </button>
        <button
          onClick={() => setSortBy("price-low")}
          className={`${styles.filterTabBtn} ${sortBy === "price-low" ? styles.activeFilterTab : ""}`}
        >
          {shopConfig.filters?.sortPriceLow || "Harga Terendah"}
        </button>
        <button
          onClick={() => setSortBy("price-high")}
          className={`${styles.filterTabBtn} ${sortBy === "price-high" ? styles.activeFilterTab : ""}`}
        >
          {shopConfig.filters?.sortPriceHigh || "Harga Tertinggi"}
        </button>
        <button
          onClick={() => setSortBy("name")}
          className={`${styles.filterTabBtn} ${sortBy === "name" ? styles.activeFilterTab : ""}`}
        >
          {shopConfig.filters?.sortName || "Nama"}
        </button>
      </div>

      {loading ? (
        <ShopSkeleton count={8} />
      ) : processedProducts.length === 0 ? (
        <div className={styles.stateContainer}>
          <p>{shopConfig.messages?.empty || "Produk tidak ditemukan."}</p>
        </div>
      ) : (
        <>
          <div className={styles.productGrid}>
            {processedProducts.slice(0, visibleCount).map((product) => {
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

              return (
                <div
                  key={pId}
                  className={`${styles.productCard} ${outOfStock ? styles.outOfStock : ""}`}
                  onClick={() => {
                    setSelectedProduct(product);
                    setActiveVariantIdx(getFirstAvailableVariantIndex(product));
                  }}
                >
                  <div className={styles.productCardImageWrapper}>
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className={styles.productCardImg}
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
                          if (!outOfStock)
                            handleAddToCart(
                              product,
                              getFirstAvailableVariantIndex(product),
                            );
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
          {visibleCount < processedProducts.length && (
            <div className={styles.paginationWrapper}>
              <button
                onClick={() =>
                  setVisibleCount((prev) => prev + PRODUCTS_PER_PAGE)
                }
                className={styles.loadMoreBtn}
              >
                {shopConfig.buttons?.loadMore || "Muat Lebih Banyak"}
              </button>
            </div>
          )}
        </>
      )}

      {selectedProduct && (
        <div
          className={styles.modalOverlay}
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={styles.closeModalBtn}
              onClick={() => setSelectedProduct(null)}
              aria-label="Tutup"
            >
              <AppIcon name="x" />
            </button>
            <div className={styles.modalGrid}>
              <div className={styles.modalImageWrapper}>
                {selectedProduct.image_url ? (
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className={styles.modalImg}
                  />
                ) : (
                  <div className={styles.modalPlaceholderImg}>
                    {shopConfig.card?.placeholderImageText || "No Image"}
                  </div>
                )}
              </div>
              <div className={styles.modalDetails}>
                <span className={styles.productCategory}>
                  {selectedProduct.category ||
                    shopConfig.card?.defaultCategory ||
                    "Parfum"}
                </span>
                <h2 className={styles.modalTitle}>{selectedProduct.name}</h2>
                <p className={styles.modalDesc}>
                  {selectedProduct.description ||
                    shopConfig.card?.defaultDescription ||
                    "Deskripsi belum tersedia."}
                </p>
                {selectedProduct.variants?.length > 0 && (
                  <div className={styles.variantBox}>
                    <span className={styles.variantLabel}>
                      {shopConfig.card?.variantLabel || "Pilih Varian"}
                    </span>
                    <div className={styles.variantChips}>
                      {selectedProduct.variants.map((v, idx) => {
                        const isVariantEmpty = getVariantStock(v) <= 0;
                        return (
                          <button
                            key={idx}
                            onClick={() =>
                              !isVariantEmpty && setActiveVariantIdx(idx)
                            }
                            className={`${styles.chip} ${activeVariantIdx === idx ? styles.activeChip : ""} ${isVariantEmpty ? styles.variantChipDisabled : ""}`}
                            disabled={isVariantEmpty}
                          >
                            {v.size || `Varian ${idx + 1}`}{" "}
                            {isVariantEmpty
                              ? "(Habis)"
                              : `(Sisa: ${getVariantStock(v)})`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Bagian Ulasan & Foto Pelanggan */}
                <div className={styles.reviewsSection}>
                  <h4 className={styles.reviewsTitle}>
                    {shopConfig.reviews?.title || "Ulasan & Foto Pelanggan"} (
                    {productReviews.length})
                  </h4>
                  <div className={styles.reviewsList}>
                    {productReviews.length === 0 ? (
                      <p className={styles.emptyReviews}>
                        {shopConfig.reviews?.empty ||
                          "Belum ada ulasan untuk produk ini."}
                      </p>
                    ) : (
                      productReviews.map((rev, rIdx) => (
                        <div key={rIdx} className={styles.reviewItem}>
                          <div className={styles.reviewHeader}>
                            <span className={styles.reviewCustomer}>
                              {rev.customer}
                            </span>
                            <span className={styles.reviewStars}>
                              {"★".repeat(rev.rating)}
                            </span>
                          </div>
                          <p className={styles.reviewComment}>{rev.comment}</p>
                          {rev.photo && (
                            <img
                              src={rev.photo}
                              alt="Ulasan customer"
                              className={styles.reviewPhoto}
                            />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className={styles.modalPriceAction}>
                  {(() => {
                    const rawPrice = Number(selectedProduct.variants?.[activeVariantIdx]?.price || selectedProduct.price || 0);
                    const discounted = getDiscountedPrice(rawPrice, activePromo);
                    return (
                      <>
                        <span>
                          {discounted.hasDiscount && (
                            <span className={styles.modalPriceOriginal}>
                              {`Rp ${rawPrice.toLocaleString("id-ID")}`}
                            </span>
                          )}
                          <span className={styles.modalPrice}>
                            {`Rp ${Number(discounted.price).toLocaleString("id-ID")}`}
                          </span>
                          {discounted.hasDiscount && (
                            <span className={styles.modalPriceBadge}>
                              Hemat {`Rp ${Number(discounted.savings).toLocaleString("id-ID")}`}
                            </span>
                          )}
                        </span>
                      </>
                    );
                  })()}
                  {(() => {
                    const activeVariant =
                      selectedProduct.variants?.[activeVariantIdx];
                    const isSoldOut = getVariantStock(activeVariant) <= 0;
                    return (
                      <button
                        onClick={() => {
                          if (!isSoldOut) {
                            handleAddToCart(selectedProduct, activeVariantIdx);
                            setSelectedProduct(null);
                          }
                        }}
                        disabled={isSoldOut}
                        className={`${styles.buyBtn} ${isSoldOut ? styles.modalBuyBtnDisabled : ""}`}
                      >
                        <AppIcon name="shopping-cart" />
                        <span>
                          {isSoldOut
                            ? shopConfig.buttons?.outOfStock || "Habis"
                            : shopConfig.buttons?.addToCart || "Beli Sekarang"}
                        </span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}