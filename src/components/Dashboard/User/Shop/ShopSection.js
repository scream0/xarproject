"use client";
import { useState, useEffect, useMemo } from "react";
import { useStore } from "@/context/StoreContext";
import styles from "./ShopSection.module.css";
import toast from "react-hot-toast";

// Import Konfigurasi JSON
import shopConfig from "@/data/ui/shopConfig.json";

export default function ShopSection() {
  const { addToCart, products: contextProducts } = useStore();
  const [products, setProducts] = useState([]);
  const [orderItemsMap, setOrderItemsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("default");

  // State untuk Modal Detail Produk
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeVariantIdx, setActiveVariantIdx] = useState(0);

  // 1. Fetch Products & Orders dari Database Supabase dengan Refresh Otomatis
  const fetchShopData = async () => {
    try {
      const [productsRes, ordersRes] = await Promise.all([
        fetch("/api/products", { cache: "no-store" }),
        fetch("/api/orders", { cache: "no-store" }),
      ]);

      const productsResult = await productsRes.json();
      const ordersResult = await ordersRes.json();

      if (!productsRes.ok)
        throw new Error(productsResult.error || "Gagal memuat katalog");

      const fetchedProducts =
        productsResult.data || productsResult.products || productsResult || [];
      setProducts(fetchedProducts);

      // Hitung jumlah terjual dari database pesanan
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
    } catch (err) {
      console.error("Gagal memuat data shop:", err);
      toast.error("Gagal memuat produk dari database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShopData();

    // Event listener kustom untuk merefresh data otomatis saat transaksi/pembayaran sukses
    const handleStorageChange = () => fetchShopData();
    window.addEventListener("product-stock-updated", handleStorageChange);
    return () => {
      window.removeEventListener("product-stock-updated", handleStorageChange);
    };
  }, [contextProducts]);

  const dynamicCategories = useMemo(() => {
    const categoriesSet = new Set();
    products.forEach((p) => {
      if (p.category) {
        categoriesSet.add(p.category.trim());
      }
    });
    return Array.from(categoriesSet);
  }, [products]);

  const processedProducts = useMemo(() => {
    let result = [...products];

    if (selectedCategory !== "all") {
      result = result.filter(
        (p) =>
          (p.category || "").toLowerCase().trim() ===
          selectedCategory.toLowerCase().trim(),
      );
    }

    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(query) ||
          (p.description || "").toLowerCase().includes(query),
      );
    }

    if (sortBy === "price-low") {
      result.sort((a, b) => {
        const priceA = a.variants?.[0]?.price || a.price || 0;
        const priceB = b.variants?.[0]?.price || b.price || 0;
        return priceA - priceB;
      });
    } else if (sortBy === "price-high") {
      result.sort((a, b) => {
        const priceA = a.variants?.[0]?.price || a.price || 0;
        const priceB = b.variants?.[0]?.price || b.price || 0;
        return priceB - priceA;
      });
    } else if (sortBy === "name") {
      result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }

    return result;
  }, [products, selectedCategory, searchQuery, sortBy]);

  // Fungsi helper untuk mengekstrak dan mengecek stok dari JSONB variants
  const getVariantStock = (variant) => {
    if (!variant) return 0;
    return Number(variant.stock ?? variant.stok ?? 0);
  };

  const getProductTotalStock = (product) => {
    const variants = product.variants;
    if (Array.isArray(variants) && variants.length > 0) {
      return variants.reduce((acc, v) => acc + getVariantStock(v), 0);
    }
    return Number(product.stock ?? product.stok ?? 0);
  };

  const isProductOutOfStock = (product) => {
    const variants = product.variants;
    if (Array.isArray(variants) && variants.length > 0) {
      const allVariantsEmpty = variants.every((v) => getVariantStock(v) <= 0);
      return !product.is_available || allVariantsEmpty;
    }
    return (
      !product.is_available || Number(product.stock ?? product.stok ?? 0) <= 0
    );
  };

  // Mencari varian pertama yang masih memiliki stok untuk tombol cepat di kartu
  const getFirstAvailableVariantIndex = (product) => {
    const variants = product.variants || [];
    if (variants.length === 0) return 0;
    const idx = variants.findIndex((v) => getVariantStock(v) > 0);
    return idx !== -1 ? idx : 0;
  };

  // Fungsi tambah ke keranjang dengan validasi stok varian akurat
  const handleAddToCart = (product, variantIndex = 0) => {
    const variants = product.variants || [];
    const targetIdx =
      variantIndex >= 0 ? variantIndex : getFirstAvailableVariantIndex(product);
    const variant = variants[targetIdx] || {
      size: "Standard 50ml",
      price: product.price || 0,
      stock: 10,
    };

    const currentStock = getVariantStock(variant);
    if (currentStock <= 0 || !product.is_available) {
      toast.error(
        `Stok ${product.name} (${variant.size || "Varian ini"}) sudah habis!`,
      );
      fetchShopData(); // Refresh otomatis jika stok keduluan habis
      return;
    }

    addToCart(product, variant, 1);
  };

  return (
    <div className={styles.shopContainer}>
      <header className={styles.shopHeader}>
        <h1 className={styles.shopTitle}>{shopConfig.header.title}</h1>
        <p className={styles.shopSubtitle}>{shopConfig.header.subtitle}</p>
      </header>

      {/* FILTER NAVBAR */}
      <nav className={styles.categoryNavbar}>
        <button
          onClick={() => setSelectedCategory("all")}
          className={`${styles.navCatBtn} ${
            selectedCategory === "all" ? styles.activeNavCatBtn : ""
          }`}
        >
          {shopConfig.filters.allLabel}
        </button>
        {dynamicCategories.map((kat) => (
          <button
            key={kat}
            onClick={() => setSelectedCategory(kat)}
            className={`${styles.navCatBtn} ${
              selectedCategory.toLowerCase() === kat.toLowerCase()
                ? styles.activeNavCatBtn
                : ""
            }`}
          >
            {kat}
          </button>
        ))}
      </nav>

      {/* SEARCH & SORT TOOLBAR */}
      <div className={styles.toolbar}>
        <input
          type="text"
          placeholder={shopConfig.filters.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className={styles.sortSelect}
        >
          <option value="default">{shopConfig.filters.sortDefault}</option>
          <option value="price-low">{shopConfig.filters.sortPriceLow}</option>
          <option value="price-high">{shopConfig.filters.sortPriceHigh}</option>
          <option value="name">{shopConfig.filters.sortName}</option>
        </select>
      </div>

      {loading ? (
        <div className={styles.stateContainer}>
          <p>{shopConfig.messages.loading}</p>
        </div>
      ) : processedProducts.length === 0 ? (
        <div className={styles.stateContainer}>
          <p>{shopConfig.messages.empty}</p>
        </div>
      ) : (
        <div className={styles.productGrid}>
          {processedProducts.map((product) => {
            const pId = String(product.id || "");
            const totalSold =
              orderItemsMap[pId] ||
              Number(product.total_sold || product.sold_count || 0);

            const displayPrice =
              product.variants?.[0]?.price || product.price || 0;
            const priceFormatted = displayPrice
              ? `Rp ${Number(displayPrice).toLocaleString("id-ID")}`
              : shopConfig.card.fallbackPrice;

            const outOfStock = isProductOutOfStock(product);
            const totalStockLeft = getProductTotalStock(product);

            return (
              <div
                key={pId}
                className={styles.productCard}
                onClick={() => {
                  setSelectedProduct(product);
                  setActiveVariantIdx(getFirstAvailableVariantIndex(product));
                }}
                style={{ opacity: outOfStock ? 0.75 : 1 }}
              >
                {/* GAMBAR PRODUK */}
                <div className={styles.productCardImageWrapper}>
                  {product.image_url || product.image ? (
                    <img
                      src={product.image_url || product.image}
                      alt={product.name}
                      className={styles.productCardImg}
                    />
                  ) : (
                    <div className={styles.productCardPlaceholder}>
                      {shopConfig.card.placeholderImageText}
                    </div>
                  )}
                  <span className={styles.cardCategoryBadge}>
                    {product.category || "Parfum"}
                  </span>
                  {outOfStock && (
                    <span
                      style={{
                        position: "absolute",
                        top: "10px",
                        left: "10px",
                        background: "#ef4444",
                        color: "#fff",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: "600",
                        zIndex: 2,
                      }}
                    >
                      HABIS
                    </span>
                  )}
                </div>

                {/* KONTEN CARD */}
                <div className={styles.productCardBody}>
                  <div className={styles.cardTopInfo}>
                    <h3 className={styles.productName}>{product.name}</h3>
                    {/* Tombol Keranjang */}
                    <button
                      className={styles.cartIconBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!outOfStock) {
                          const bestVariantIdx =
                            getFirstAvailableVariantIndex(product);
                          handleAddToCart(product, bestVariantIdx);
                        }
                      }}
                      disabled={outOfStock}
                      aria-label="Tambah ke Keranjang"
                      title={outOfStock ? "Stok Habis" : "Tambah ke Keranjang"}
                      style={{
                        opacity: outOfStock ? 0.3 : 1,
                        cursor: outOfStock ? "not-allowed" : "pointer",
                      }}
                    >
                      <svg
                        style={{
                          width: "18px",
                          height: "18px",
                          stroke: "currentColor",
                          strokeWidth: 2,
                          fill: "none",
                          strokeLinecap: "round",
                          strokeLinejoin: "round",
                        }}
                      >
                        <use href="/assets/icon/feather-sprite.svg#shopping-cart" />
                      </svg>
                    </button>
                  </div>

                  <div className={styles.cardPriceRow}>
                    <span className={styles.cardPrice}>
                      {outOfStock ? "Stok Habis" : priceFormatted}
                    </span>
                  </div>

                  <div className={styles.cardFooterInfo}>
                    <span className={styles.soldCount}>
                      Terjual {totalSold} pcs{" "}
                      {outOfStock ? "" : `• Sisa: ${totalStockLeft}`}
                    </span>
                    <span className={styles.viewDetailText}>Detail →</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DETAIL PRODUK */}
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
              <svg
                style={{
                  width: "20px",
                  height: "20px",
                  stroke: "currentColor",
                  strokeWidth: 2,
                  fill: "none",
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                }}
              >
                <use href="/assets/icon/feather-sprite.svg#x" />
              </svg>
            </button>

            <div className={styles.modalGrid}>
              <div className={styles.modalImageWrapper}>
                {selectedProduct.image_url || selectedProduct.image ? (
                  <img
                    src={selectedProduct.image_url || selectedProduct.image}
                    alt={selectedProduct.name}
                    className={styles.modalImg}
                  />
                ) : (
                  <div className={styles.modalPlaceholderImg}>
                    {shopConfig.card.placeholderImageText}
                  </div>
                )}
              </div>

              <div className={styles.modalDetails}>
                <span className={styles.productCategory}>
                  {selectedProduct.category || shopConfig.card.defaultCategory}
                </span>
                <h2 className={styles.modalTitle}>{selectedProduct.name}</h2>
                <p className={styles.modalDesc}>
                  {selectedProduct.description ||
                    shopConfig.card.defaultDescription}
                </p>

                {selectedProduct.variants &&
                  selectedProduct.variants.length > 0 && (
                    <div className={styles.variantBox}>
                      <span className={styles.variantLabel}>
                        {shopConfig.card.variantLabel}
                      </span>
                      <div className={styles.variantChips}>
                        {selectedProduct.variants.map((v, idx) => {
                          const variantStock = getVariantStock(v);
                          const isVariantEmpty = variantStock <= 0;
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                if (!isVariantEmpty) setActiveVariantIdx(idx);
                              }}
                              className={`${styles.chip} ${
                                activeVariantIdx === idx
                                  ? styles.activeChip
                                  : ""
                              }`}
                              style={{
                                opacity: isVariantEmpty ? 0.4 : 1,
                                borderColor: isVariantEmpty
                                  ? "#ef4444"
                                  : undefined,
                                cursor: isVariantEmpty
                                  ? "not-allowed"
                                  : "pointer",
                              }}
                            >
                              {v.size || `Varian ${idx + 1}`}{" "}
                              {isVariantEmpty
                                ? "(Habis)"
                                : `(Sisa: ${variantStock})`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                <div className={styles.modalPriceAction}>
                  <span className={styles.modalPrice}>
                    {selectedProduct.variants?.[activeVariantIdx]?.price
                      ? `Rp ${Number(
                          selectedProduct.variants[activeVariantIdx].price,
                        ).toLocaleString("id-ID")}`
                      : `Rp ${Number(selectedProduct.price || 0).toLocaleString(
                          "id-ID",
                        )}`}
                  </span>

                  {/* Tombol Beli di Modal dengan Validasi Stok Varian Aktif */}
                  {(() => {
                    const activeVariant =
                      selectedProduct.variants?.[activeVariantIdx];
                    const activeStock = getVariantStock(activeVariant);
                    const isSoldOut =
                      activeStock <= 0 || !selectedProduct.is_available;

                    return (
                      <button
                        onClick={() => {
                          if (!isSoldOut) {
                            handleAddToCart(selectedProduct, activeVariantIdx);
                            setSelectedProduct(null);
                          }
                        }}
                        disabled={isSoldOut}
                        className={styles.buyBtn}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          backgroundColor: isSoldOut ? "#374151" : undefined,
                          cursor: isSoldOut ? "not-allowed" : "pointer",
                          opacity: isSoldOut ? 0.5 : 1,
                        }}
                      >
                        <svg
                          style={{
                            width: "18px",
                            height: "18px",
                            stroke: "currentColor",
                            strokeWidth: 2,
                            fill: "none",
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                          }}
                        >
                          <use href="/assets/icon/feather-sprite.svg#shopping-cart" />
                        </svg>
                        <span>
                          {isSoldOut
                            ? "Stok Varian Habis"
                            : "Tambah ke Keranjang"}
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
