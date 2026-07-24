"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import styles from "./CartSidebar.module.css";
import cartConfig from "@/data/ui/cartSidebarConfig.json";

export function CartSidebar() {
  const router = useRouter();
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
    user,
  } = useStore();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  const closeSidebar = () => setIsCartOpen(false);

  const productList = Array.isArray(products) ? products : (products?.data || []);

  const handleCheckoutClick = async () => {
    if (!user) {
      if (typeof window !== "undefined") {
        localStorage.setItem("pending_cart", JSON.stringify(cart));
      }
      closeSidebar();
      router.push("/login");
      return;
    }
    if (processPayment) processPayment();
  };

  const handleExploreClick = (e) => {
    e.preventDefault();
    closeSidebar();
    router.push(cartConfig?.emptyState?.buttonLink || "/");
  };

  const handleRemoveItem = (cartId) => {
    if (window.confirm("Hapus item ini dari keranjang?")) {
      removeFromCart(cartId, 'all');
    }
  };

  // Free Shipping Progress Bar Logic
  const freeShippingThreshold = cartConfig.shipping.freeShippingThreshold || 500000;
  const amountNeeded = freeShippingThreshold - cartTotal;
  const progressPercentage = Math.min((cartTotal / freeShippingThreshold) * 100, 100);

  return (
    <>
      <div className={`${styles.sidebarOverlay} ${isCartOpen ? styles.active : ""}`} onClick={closeSidebar}></div>
      <aside className={`${styles.cartSidebar} ${isCartOpen ? styles.active : ""}`}>
        <header className={styles.cartHeader}>
          <h3 className={styles.cartSidebarTitle}>{cartConfig?.labels?.title}</h3>
          <button className={styles.cartCloseBtn} onClick={closeSidebar}>
            <svg className={styles.svgIcon}><use href={`/assets/icon/feather-sprite.svg#${cartConfig?.icons?.close}`} /></svg>
          </button>
        </header>

        {cart?.items?.length > 0 ? (
          <>
            <div className={styles.cartItemsWrapper}>
              {cart.items.map((item) => {
                const originalProduct = productList.find((p) => String(p.id) === String(item.id));
                const variantInfo = originalProduct?.variants?.find((v) => v.size === item.size);
                const maxStock = Number(variantInfo?.stock ?? variantInfo?.stok ?? 10);
                const isMaxReached = item.quantity >= maxStock;
                const itemImageSrc = variantInfo?.image_url || item.image_url || "/assets/placeholder.jpg";

                return (
                  <div className={styles.cartItem} key={item.cartId}>
                    <div className={styles.cartItemImg}><img src={itemImageSrc} alt={item.name} /></div>
                    <div className={styles.cartItemDetails}>
                      <div className={styles.itemHeader}>
                        <h4 className={styles.cartItemName}>{item.name}</h4>
                        <button className={styles.removeItemBtn} onClick={() => handleRemoveItem(item.cartId)} title="Hapus Item">
                          <svg className={styles.svgIcon}><use href="/assets/icon/feather-sprite.svg#trash-2" /></svg>
                        </button>
                      </div>
                      
                      <div className={styles.cartVariantSelector}>
                        <span>{cartConfig?.labels?.variant}</span>
                        <select value={item.size} onChange={(e) => updateCartItemVariant(item.cartId, e.target.value)}>
                          {getAvailableVariants(item.id).map((v) => {
                            const vStock = Number(v.stock ?? v.stok ?? 0);
                            const isOutOfStock = vStock <= 0;
                            return (
                              <option key={v.size} value={v.size} disabled={isOutOfStock}>
                                {v.size} {isOutOfStock ? "(Habis)" : `(Sisa: ${vStock})`}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className={styles.cartItemPriceRow}>
                        <span className={styles.cartCurrentPrice}>{rupiah(item.price)}</span>
                        <div className={styles.cartQtyControl}>
                          <button className={styles.cartQtyBtn} onClick={() => removeFromCart(item.cartId)}>{cartConfig?.labels?.quantityMinus}</button>
                          <span className={styles.cartQtyValue}>{item.quantity}</span>
                          <button className={`${styles.cartQtyBtn} ${isMaxReached ? styles.disabled : ""}`} disabled={isMaxReached || isProcessing} onClick={() => { if (originalProduct && !isMaxReached) { addToCart(originalProduct, { size: item.size, price: item.price, stock: maxStock }, 1); } }}>
                            {cartConfig?.labels?.quantityPlus}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <footer className={styles.cartFooterWrapper}>
              <div className={styles.shippingProgress}>
                {amountNeeded > 0 ? (
                  <p>{cartConfig.shipping.message.replace("{amount}", rupiah(amountNeeded))}</p>
                ) : (
                  <p className={styles.shippingCongrats}>{cartConfig.shipping.congratsMessage}</p>
                )}
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${progressPercentage}%` }}></div>
                </div>
              </div>
              <div className={styles.cartTotalRow}>
                <h4>{cartConfig?.labels?.total}</h4>
                <span className={styles.cartGrandTotal}>{rupiah(cartTotal)}</span>
              </div>
              <button className={styles.cartCheckoutBtn} onClick={handleCheckoutClick} disabled={isProcessing}>
                {isProcessing ? "Memproses..." : cartConfig?.labels?.checkout}
              </button>
            </footer>
          </>
        ) : (
          <div className={styles.emptyCartStatus}>
            <div className={styles.emptyCartIcon}>
              <svg className={styles.svgIcon}><use href={`/assets/icon/feather-sprite.svg#${cartConfig?.icons?.emptyCart}`} /></svg>
            </div>
            <p>{cartConfig?.emptyState?.message}</p>
            <button onClick={handleExploreClick} className={styles.btnContinueShopping}>
              {cartConfig?.emptyState?.buttonText}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
