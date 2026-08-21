"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import toast from "react-hot-toast";
import styles from "./WishlistSection.module.css";
import wishlistConfig from "@/data/ui/wishlistConfig.json";
import { AppIcon } from "@/components/UI/Icon/AppIcon";
import ConfirmationModal from "@/components/UI/Modal/ConfirmationModal";

function readWishlist() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const saved = localStorage.getItem("shop_wishlist");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export default function WishlistSection() {
  const router = useRouter();
  const { products, addToCart } = useStore();
  const [wishlist, setWishlist] = useState(readWishlist);
  const [searchQuery, setSearchQuery] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const syncWishlist = () => {
    setWishlist(readWishlist());
  };

  useEffect(() => {
    const handleWishlistUpdated = (event) => {
      const nextItems = event.detail?.items;
      if (Array.isArray(nextItems)) {
        setWishlist(nextItems);
        return;
      }
      syncWishlist();
    };

    window.addEventListener("storage", syncWishlist);
    window.addEventListener("wishlist-updated", handleWishlistUpdated);

    return () => {
      window.removeEventListener("storage", syncWishlist);
      window.removeEventListener("wishlist-updated", handleWishlistUpdated);
    };
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
    const nextWishlist = wishlist.filter(
      (id) => String(id) !== String(productId),
    );

    setWishlist(nextWishlist);
    window.dispatchEvent(
      new CustomEvent("wishlist-updated", {
        detail: { count: nextWishlist.length, items: nextWishlist },
      }),
    );
    toast.success(wishlistConfig.toasts.removeSuccess || "Produk dihapus dari wishlist");
  };

  const confirmClearAll = () => {
    setShowClearConfirm(false);
    setWishlist([]);
    window.dispatchEvent(
      new CustomEvent("wishlist-updated", {
        detail: { count: 0, items: [] },
      }),
    );
    toast.success("Wishlist berhasil dikosongkan");
  };

  const handleClearAll = () => {
    setShowClearConfirm(true);
  };

  const handleAddToCart = (product, e) => {
    e.stopPropagation();
    const status = getStockStatus(product);
    if (status === "outOfStock") {
      toast.error(wishlistConfig.stock.outOfStock || "Produk habis");
      return;
    }
    const variant = getFirstAvailableVariant(product);
    addToCart(product, variant, 1);
    toast.success(wishlistConfig.toasts.addedSuccess || "Berhasil ditambahkan ke keranjang");
  };

  const handleCardClick = (product) => {
    const pId = product.id || product._id;
    router.push(`/products/${pId}`);
  };

  const handleExplore = () => {
    router.push("/dashboard?tab=shop");
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
            <div className={styles.searchWrapper}>
              <AppIcon name="search" size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder={wishlistConfig.searchPlaceholder || "Cari koleksi parfum..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            {wishlistProducts.length > 0 && (
              <button onClick={handleClearAll} className={styles.clearAllBtn} title="Kosongkan Wishlist">
                <AppIcon name="trash" size={15} />
                <span>Kosongkan</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Product Grid / Empty State */}
      {filteredProducts.length === 0 ? (
        <div className={`card ${styles.centerStateCard}`}>
          <div className={styles.emptyIconWrapper}>
            <AppIcon name="heart" size={36} className={styles.emptySvg} />
          </div>
          <h4 className={styles.emptyTitle}>{wishlistConfig.emptyTitle || "Wishlist Anda Masih Kosong"}</h4>
          <p className={styles.emptyText}>{wishlistConfig.emptyText || "Simpan aroma parfum favorit Anda ke sini untuk memudahkan akses pembelian di kemudian hari."}</p>
          <button onClick={handleExplore} className={styles.exploreBtn}>
            {wishlistConfig.buttons.explore || "Jelajahi Koleksi"}
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
                onClick={() => handleCardClick(product)}
                className={`${styles.productCard} ${
                  stockStatus === "outOfStock" ? styles.outOfStock : ""
                }`}
              >
                <div className={styles.productImageWrapper}>
                  {product.image_url || product.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={product.image_url || product.imageUrl}
                      alt={product.name}
                      className={styles.productImg}
                    />
                  ) : (
                    <div className={styles.productPlaceholder}>
                      <span>No Image</span>
                    </div>
                  )}
                  <span className={styles.categoryBadge}>
                    {product.category || "Extrait de Parfum"}
                  </span>
                  <button
                    className={styles.removeBtn}
                    onClick={(e) => handleRemove(pId, e)}
                    aria-label={wishlistConfig.buttons.remove || "Hapus"}
                    title="Hapus dari wishlist"
                  >
                    <AppIcon name="x" size={14} />
                  </button>
                  {stockStatus === "outOfStock" && (
                    <span className={styles.outOfStockBadge}>
                      {wishlistConfig.stock.outOfStock || "Habis"}
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
                        (wishlistConfig.stock.available || "Tersedia")}
                      {stockStatus === "lowStock" &&
                        (wishlistConfig.stock.lowStock || "Stok Terbatas")}
                      {stockStatus === "outOfStock" &&
                        (wishlistConfig.stock.outOfStock || "Habis")}
                    </span>
                  </div>
                  <button
                    className={styles.addToCartBtn}
                    onClick={(e) => handleAddToCart(product, e)}
                    disabled={stockStatus === "outOfStock"}
                  >
                    <AppIcon name="shopping-bag" size={15} />
                    <span>{wishlistConfig.buttons.addToCart || "+ Keranjang"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      <ConfirmationModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={confirmClearAll}
        title="Kosongkan Wishlist"
        message="Apakah Anda yakin ingin mengosongkan seluruh wishlist?"
      />
    </div>
  );
}