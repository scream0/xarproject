"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/context/StoreContext";
import styles from "./CartSidebar.module.css";
import cartData from "@/data/ui/cartSidebarConfig.json";

export function CartSidebar() {
  const {
    isCartOpen,
    setIsCartOpen,
    cart,
    removeFromCart,
    addToCart,
    cartTotal,
    rupiah,
    products,
    updateCartItemVariant,
    getAvailableVariants,
    processPayment,
    isProcessing,
  } = useStore();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  const closeSidebar = () => setIsCartOpen(false);

  // Normalisasi array produk untuk pencarian
  const productList = Array.isArray(products)
    ? products
    : products?.produkItems || [];

  return (
    <div
      className={`${styles.sidebarOverlay} ${isCartOpen ? styles.active : ""}`}
    >
      <button className={styles.cartCloseBtn} onClick={closeSidebar}>
        <svg className={styles.feather}>
          <use
            href={`/assets/icon/feather-sprite.svg#${cartData?.icons?.close}`}
          />
        </svg>
      </button>

      <h3 className={styles.cartSidebarTitle}>{cartData?.labels?.title}</h3>

      {cart.items.length > 0 ? (
        <div className={styles.cartItemsWrapper}>
          {cart.items.map((item) => {
            // Logika Stok & Varian
            const originalProduct = productList.find((p) => p.id === item.id);
            const variantInfo = originalProduct?.variants?.find(
              (v) => v.size === item.size,
            );
            const maxStock = variantInfo?.stock ?? 0;
            const isMaxReached = item.quantity >= maxStock;

            // LOGIKA GAMBAR DINAMIS PER VARIAN:
            // Prioritaskan gambar khusus varian jika ada.
            // Jika tidak ada, gunakan gambar utama item/produk.
            const itemImageSrc =
              variantInfo?.imageUrl ||
              item.imageUrl ||
              (item.image ? `${item.image}` : "/assets/placeholder.jpg");

            return (
              <div className={styles.cartItem} key={item.cartId}>
                <div className={styles.cartItemImg}>
                  <img
                    src={itemImageSrc}
                    alt={item.name}
                    onError={(e) => {
                      e.target.src = "/assets/placeholder.jpg";
                    }}
                  />
                </div>
                <div className={styles.cartItemDetails}>
                  <h3 className={styles.cartItemName}>{item.name}</h3>

                  <div className={styles.cartVariantSelector}>
                    <span>{cartData?.labels?.variant}</span>
                    <select
                      value={item.size}
                      onChange={(e) =>
                        updateCartItemVariant(item.cartId, e.target.value)
                      }
                    >
                      {getAvailableVariants(item.id).map((v) => {
                        const isOutOfStock = (v.stock ?? 0) <= 0;
                        return (
                          <option
                            key={v.size}
                            value={v.size}
                            disabled={isOutOfStock}
                          >
                            {v.size} ({rupiah(v.price)}){" "}
                            {isOutOfStock ? "- Habis" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className={styles.cartItemPriceRow}>
                    <span className={styles.cartCurrentPrice}>
                      {rupiah(item.price)}
                    </span>
                    <div className={styles.cartQtyControl}>
                      <button
                        className={styles.cartQtyBtn}
                        onClick={() => removeFromCart(item.cartId)}
                      >
                        {cartData?.labels?.quantityMinus}
                      </button>
                      <span className={styles.cartQtyValue}>
                        {item.quantity}
                      </span>

                      {/* Tombol Plus - Dibatasi oleh stok varian */}
                      <button
                        className={styles.cartQtyBtn}
                        disabled={isMaxReached || isProcessing}
                        onClick={() => {
                          if (originalProduct && !isMaxReached) {
                            addToCart(
                              originalProduct,
                              { size: item.size, price: item.price },
                              1,
                            );
                          }
                        }}
                        style={{
                          opacity: isMaxReached ? 0.5 : 1,
                          cursor: isMaxReached ? "not-allowed" : "pointer",
                        }}
                      >
                        {cartData?.labels?.quantityPlus}
                      </button>
                    </div>
                    <span className={styles.cartItemTotal}>
                      {rupiah(item.total)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyCartStatus}>
          <div className={styles.keranjangKosongIcon}>
            <svg className={styles.feather}>
              <use
                href={`/assets/icon/feather-sprite.svg#${cartData?.icons?.emptyCart}`}
              />
            </svg>
          </div>
          <p>{cartData?.emptyState?.message}</p>
          <a
            href={cartData?.emptyState?.buttonLink}
            onClick={closeSidebar}
            className={styles.btnContinueShopping}
          >
            {cartData?.emptyState?.buttonText}
          </a>
        </div>
      )}

      {cart.items.length > 0 && (
        <div className={styles.cartFooterWrapper}>
          <div className={styles.cartTotalRow}>
            <h4>{cartData?.labels?.total}</h4>
            <span className={styles.cartGrandTotal}>{rupiah(cartTotal)}</span>
          </div>
          <button
            className={styles.cartCheckoutBtn}
            onClick={processPayment}
            disabled={isProcessing}
          >
            {isProcessing ? "Memproses..." : cartData?.labels?.checkout}
          </button>
        </div>
      )}
    </div>
  );
}
