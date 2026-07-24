"use client";
import { useState, useEffect, useMemo } from "react";
import { useStore } from "@/context/StoreContext";
import styles from "./ShopSection.module.css";
import toast from "react-hot-toast";

// Import Konfigurasi JSON
import shopConfig from "@/data/ui/shopConfig.json";

const PRODUCTS_PER_PAGE = 12;

export default function ShopSection() {
  const { addToCart, products: contextProducts } = useStore();
  const [products, setProducts] = useState([]);
  const [orderItemsMap, setOrderItemsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PER_PAGE);

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

      const fetchedProducts = productsResult.data || productsResult.products || productsResult || [];
      setProducts(fetchedProducts);

      // Hitung jumlah terjual dari database pesanan
      const transactions = Array.isArray(ordersResult) ? ordersResult : (ordersResult.data || ordersResult.orders || []);
      const soldCounts = {};
      transactions.forEach((order) => {
        const status = (order.status || "").toLowerCase();
        if (["success", "completed", "shipping", "shipped", "settlement", "capture", "paid"].includes(status)) {
          const items = order.items || order.order_items || [];
          items.forEach((item) => {
            const pId = String(item.id || item.productId || item.product_id || "");
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
    const handleStorageChange = () => fetchShopData();
    window.addEventListener("product-stock-updated", handleStorageChange);
    return () => {
      window.removeEventListener("product-stock-updated", handleStorageChange);
    };
  }, [contextProducts]);

  const dynamicCategories = useMemo(() => {
    const categoriesSet = new Set();
    products.forEach((p) => {
      if (p.category) categoriesSet.add(p.category.trim());
    });
    return Array.from(categoriesSet);
  }, [products]);

  const processedProducts = useMemo(() => {
    let result = [...products];

    if (selectedCategory !== "all") {
      result = result.filter((p) => (p.category || "").toLowerCase().trim() === selectedCategory.toLowerCase().trim());
    }

    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter((p) => (p.name || "").toLowerCase().includes(query) || (p.description || "").toLowerCase().includes(query));
    }

    switch (sortBy) {
      case "price-low":
        result.sort((a, b) => (a.variants?.[0]?.price || a.price || 0) - (b.variants?.[0]?.price || b.price || 0));
        break;
      case "price-high":
        result.sort((a, b) => (b.variants?.[0]?.price || b.price || 0) - (a.variants?.[0]?.price || a.price || 0));
        break;
      case "name":
        result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        break;
      default:
        break;
    }
    return result;
  }, [products, selectedCategory, searchQuery, sortBy]);

  const getVariantStock = (variant) => Number(variant?.stock ?? variant?.stok ?? 0);

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
    const idx = (product.variants || []).findIndex((v) => getVariantStock(v) > 0);
    return idx !== -1 ? idx : 0;
  };

  const handleAddToCart = (product, variantIndex = 0) => {
    const variants = product.variants || [];
    const targetIdx = variantIndex >= 0 ? variantIndex : getFirstAvailableVariantIndex(product);
    const variant = variants[targetIdx] || { size: "Standard", price: product.price || 0, stock: 10 };

    if (getVariantStock(variant) <= 0) {
      toast.error(`Stok ${product.name} (${variant.size}) sudah habis!`);
      fetchShopData();
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

      <nav className={styles.categoryNavbar}>
        <button onClick={() => setSelectedCategory("all")} className={`${styles.navCatBtn} ${selectedCategory === "all" ? styles.activeNavCatBtn : ""}`}>
          {shopConfig.filters.allLabel}
        </button>
        {dynamicCategories.map((kat) => (
          <button key={kat} onClick={() => setSelectedCategory(kat)} className={`${styles.navCatBtn} ${selectedCategory.toLowerCase() === kat.toLowerCase() ? styles.activeNavCatBtn : ""}`}>
            {kat}
          </button>
        ))}
      </nav>

      <div className={styles.toolbar}>
        <input type="text" placeholder={shopConfig.filters.searchPlaceholder} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={styles.searchInput} />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={styles.sortSelect}>
          <option value="default">{shopConfig.filters.sortDefault}</option>
          <option value="price-low">{shopConfig.filters.sortPriceLow}</option>
          <option value="price-high">{shopConfig.filters.sortPriceHigh}</option>
          <option value="name">{shopConfig.filters.sortName}</option>
        </select>
      </div>

      {loading ? (
        <div className={styles.stateContainer}><p>{shopConfig.messages.loading}</p></div>
      ) : processedProducts.length === 0 ? (
        <div className={styles.stateContainer}><p>{shopConfig.messages.empty}</p></div>
      ) : (
        <>
          <div className={styles.productGrid}>
            {processedProducts.slice(0, visibleCount).map((product) => {
              const pId = String(product.id || "");
              const totalSold = orderItemsMap[pId] || Number(product.total_sold || 0);
              const displayPrice = product.variants?.[0]?.price || product.price || 0;
              const priceFormatted = displayPrice ? `Rp ${Number(displayPrice).toLocaleString("id-ID")}` : shopConfig.card.fallbackPrice;
              const outOfStock = isProductOutOfStock(product);
              const totalStockLeft = getProductTotalStock(product);

              return (
                <div key={pId} className={`${styles.productCard} ${outOfStock ? styles.outOfStock : ""}`} onClick={() => { setSelectedProduct(product); setActiveVariantIdx(getFirstAvailableVariantIndex(product)); }}>
                  <div className={styles.productCardImageWrapper}>
                    {product.image_url ? <img src={product.image_url} alt={product.name} className={styles.productCardImg} /> : <div className={styles.productCardPlaceholder}>{shopConfig.card.placeholderImageText}</div>}
                    <span className={styles.cardCategoryBadge}>{product.category || "Parfum"}</span>
                    {outOfStock && <span className={styles.outOfStockBadge}>HABIS</span>}
                  </div>
                  <div className={styles.productCardBody}>
                    <div className={styles.cardTopInfo}>
                      <h3 className={styles.productName}>{product.name}</h3>
                      <button className={`${styles.cartIconBtn} ${outOfStock ? styles.cartIconBtnDisabled : ""}`} onClick={(e) => { e.stopPropagation(); if (!outOfStock) handleAddToCart(product, getFirstAvailableVariantIndex(product)); }} disabled={outOfStock} aria-label="Tambah ke Keranjang" title={outOfStock ? "Stok Habis" : "Tambah ke Keranjang"}>
                        <svg><use href="/assets/icon/feather-sprite.svg#shopping-cart" /></svg>
                      </button>
                    </div>
                    <div className={styles.cardPriceRow}><span className={styles.cardPrice}>{outOfStock ? "Stok Habis" : priceFormatted}</span></div>
                    <div className={styles.cardFooterInfo}>
                      <span className={styles.soldCount}>Terjual {totalSold} {outOfStock ? "" : `• Sisa: ${totalStockLeft}`}</span>
                      <span className={styles.viewDetailText}>Detail →</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {visibleCount < processedProducts.length && (
            <div className={styles.paginationWrapper}>
              <button onClick={() => setVisibleCount(prev => prev + PRODUCTS_PER_PAGE)} className={styles.loadMoreBtn}>
                Lihat Lebih Banyak
              </button>
            </div>
          )}
        </>
      )}

      {selectedProduct && (
        <div className={styles.modalOverlay} onClick={() => setSelectedProduct(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeModalBtn} onClick={() => setSelectedProduct(null)} aria-label="Tutup"><svg><use href="/assets/icon/feather-sprite.svg#x" /></svg></button>
            <div className={styles.modalGrid}>
              <div className={styles.modalImageWrapper}>
                {selectedProduct.image_url ? <img src={selectedProduct.image_url} alt={selectedProduct.name} className={styles.modalImg} /> : <div className={styles.modalPlaceholderImg}>{shopConfig.card.placeholderImageText}</div>}
              </div>
              <div className={styles.modalDetails}>
                <span className={styles.productCategory}>{selectedProduct.category || shopConfig.card.defaultCategory}</span>
                <h2 className={styles.modalTitle}>{selectedProduct.name}</h2>
                <p className={styles.modalDesc}>{selectedProduct.description || shopConfig.card.defaultDescription}</p>
                {selectedProduct.variants?.length > 0 && (
                  <div className={styles.variantBox}>
                    <span className={styles.variantLabel}>{shopConfig.card.variantLabel}</span>
                    <div className={styles.variantChips}>
                      {selectedProduct.variants.map((v, idx) => {
                        const isVariantEmpty = getVariantStock(v) <= 0;
                        return (
                          <button key={idx} onClick={() => !isVariantEmpty && setActiveVariantIdx(idx)} className={`${styles.chip} ${activeVariantIdx === idx ? styles.activeChip : ""} ${isVariantEmpty ? styles.variantChipDisabled : ""}`} disabled={isVariantEmpty}>
                            {v.size || `Varian ${idx + 1}`} {isVariantEmpty ? "(Habis)" : `(Sisa: ${getVariantStock(v)})`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className={styles.modalPriceAction}>
                  <span className={styles.modalPrice}>
                    {`Rp ${Number(selectedProduct.variants?.[activeVariantIdx]?.price || selectedProduct.price || 0).toLocaleString("id-ID")}`}
                  </span>
                  {(() => {
                    const activeVariant = selectedProduct.variants?.[activeVariantIdx];
                    const isSoldOut = getVariantStock(activeVariant) <= 0;
                    return (
                      <button onClick={() => { if (!isSoldOut) { handleAddToCart(selectedProduct, activeVariantIdx); setSelectedProduct(null); } }} disabled={isSoldOut} className={`${styles.buyBtn} ${isSoldOut ? styles.modalBuyBtnDisabled : ""}`}>
                        <svg><use href="/assets/icon/feather-sprite.svg#shopping-cart" /></svg>
                        <span>{isSoldOut ? "Stok Varian Habis" : "Tambah ke Keranjang"}</span>
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
