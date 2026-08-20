"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import { getDiscountedPrice } from "@/utils/promo";
import styles from "./CartSidebar.module.css";
import cartConfig from "@/data/ui/cartSidebarConfig.json";
import { AppIcon } from "@/components/UI/Icon/AppIcon";

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
    activePromo,
    promoSavings,
    discountedCartTotal,
  } = useStore();

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, cartId: null });

  const closeSidebar = () => setIsCartOpen(false);

  const productList = Array.isArray(products) ? products : products?.data || [];

  const handleCheckoutClick = async () => {
    if (!user) {
      if (typeof window !== "undefined") {
        localStorage.setItem("pending_cart", JSON.stringify(cart));
      }
      closeSidebar();
      router.push("/login?callbackUrl=/checkout");
      return;
    }
    closeSidebar();
    router.push("/checkout");
  };

  const handleExploreClick = (e) => {
    e.preventDefault();
    closeSidebar();
    router.push(cartConfig?.emptyState?.buttonLink || "/");
  };

  const triggerRemove = (cartId) => {
    setConfirmModal({ isOpen: true, cartId });
  };

  const confirmDelete = () => {
    if (confirmModal.cartId) {
      removeFromCart(confirmModal.cartId, "all");
    }
    setConfirmModal({ isOpen: false, cartId: null });
  };

  const cancelDelete = () => {
    setConfirmModal({ isOpen: false, cartId: null });
  };

  const freeShippingThreshold =
    cartConfig.shipping.freeShippingThreshold || 500000;
  const progressPercentage = Math.min(
    (cartTotal / freeShippingThreshold) * 100,
    100,
  );

  return (
    <>
      <div
        className={`${styles.sidebarOverlay} ${isCartOpen ? styles.active : ""}`}
        onClick={closeSidebar}
      ></div>
      <aside
        className={`${styles.cartSidebar} ${isCartOpen ? styles.active : ""}`}
      >
        <header className={styles.cartHeader}>
          <h3 className={styles.cartSidebarTitle}>
            {cartConfig?.labels?.title}
          </h3>
          <button className={styles.cartCloseBtn} onClick={closeSidebar}>
            <AppIcon name={cartConfig?.icons?.close} className={styles.svgIcon} />
          </button>
        </header>

        {cart?.items?.length > 0 ? (
          <>
            <div className={styles.cartItemsWrapper}>
              {cart.items.map((item) => {
                // Safety net: fallback key kalau cartId dari data lama kosong
                const safeKey =
                  item.cartId || `${item.productId || item.id}-${item.size}`;

                const originalProduct = productList.find(
                  (p) => String(p.id) === String(item.id || item.productId),
                );
                const variantInfo = originalProduct?.variants?.find(
                  (v) => String(v.size || "").toLowerCase() === String(item.size || "").toLowerCase(),
                );
                const maxStock = Number(
                  variantInfo?.stock ?? variantInfo?.stok ?? item.stock ?? 10,
                );
                const isMaxReached = item.quantity >= maxStock;

                const placeholderSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='1.5'><rect x='3' y='3' width='18' height='18' rx='2' ry='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/></svg>";

                const itemImageSrc =
                  item.image ||
                  variantInfo?.image_url ||
                  variantInfo?.imageUrl ||
                  originalProduct?.image_url ||
                  originalProduct?.imageUrl ||
                  placeholderSvg;

                return (
                  <div className={styles.cartItem} key={safeKey}>
                    <div className={styles.cartItemImg}>
                      <img src={itemImageSrc} alt={item.name} />
                    </div>
                    <div className={styles.cartItemDetails}>
                      <div className={styles.itemHeader}>
                        <h4 className={styles.cartItemName}>{item.name}</h4>
                        <button
                          className={styles.removeItemBtn}
                          onClick={() => triggerRemove(item.cartId)}
                          title="Hapus Item"
                        >
                          <AppIcon name="trash-2" className={styles.svgIcon} />
                        </button>
                      </div>

                      <div className={styles.cartVariantSelector}>
                        <span>{cartConfig?.labels?.variant}</span>
                        <select
                          value={item.size}
                          onChange={(e) =>
                            updateCartItemVariant(item.cartId, e.target.value)
                          }
                        >
                          {getAvailableVariants(item.productId || item.id).map((v) => {
                            const vStock = Number(v.stock ?? v.stok ?? 0);
                            const isOutOfStock = vStock <= 0;
                            return (
                              <option
                                key={v.size}
                                value={v.size}
                                disabled={isOutOfStock}
                              >
                                {v.size}{" "}
                                {isOutOfStock ? "(Habis)" : `(Sisa: ${vStock})`}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className={styles.cartItemPriceRow}>
                        <span className={styles.cartPriceGroup}>
                          {activePromo && (
                            <span className={styles.cartOriginalPrice}>
                              {rupiah(item.price)}
                            </span>
                          )}
                          <span className={styles.cartCurrentPrice}>
                            {rupiah(
                              activePromo
                                ? getDiscountedPrice(item.price, activePromo).price
                                : item.price,
                            )}
                          </span>
                        </span>
                        <div className={styles.cartQtyControl}>
                          <button
                            className={`${styles.cartQtyBtn} ${item.quantity === 1 ? styles.disabled : ""}`}
                            disabled={item.quantity === 1 || isProcessing}
                            onClick={() => removeFromCart(item.cartId)}
                          >
                            {cartConfig?.labels?.quantityMinus}
                          </button>
                          <span className={styles.cartQtyValue}>
                            {item.quantity}
                          </span>
                          <button
                            className={`${styles.cartQtyBtn} ${isMaxReached ? styles.disabled : ""}`}
                            disabled={isMaxReached || isProcessing}
                            onClick={() => {
                              if (!isMaxReached) {
                                const productTarget = originalProduct || {
                                  id: item.productId || item.id,
                                  name: item.name,
                                  variants: [{ size: item.size, price: item.price, stock: maxStock }],
                                };

                                addToCart(
                                  productTarget,
                                  {
                                    size: item.size,
                                    price: item.price,
                                    stock: maxStock,
                                  },
                                  1,
                                );
                              }
                            }}
                          >
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
              <div className={styles.cartTotalRow}>
                <h4>{cartConfig?.labels?.total}</h4>
                <span className={styles.cartGrandTotal}>
                  {rupiah(activePromo ? discountedCartTotal : cartTotal)}
                </span>
              </div>
              <button
                className={styles.cartCheckoutBtn}
                onClick={handleCheckoutClick}
                disabled={isProcessing}
              >
                {isProcessing ? "Memproses..." : cartConfig?.labels?.checkout}
              </button>
            </footer>
          </>
        ) : (
          <div className={styles.emptyCartStatus}>
            <div className={styles.emptyCartIcon}>
              <AppIcon name={cartConfig?.icons?.emptyCart} className={styles.svgIcon} />
            </div>
            <p>{cartConfig?.emptyState?.message}</p>

          </div>
        )}
      </aside>

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmModal}>
            <h4>Hapus Item</h4>
            <p>Apakah Anda yakin ingin menghapus item ini dari keranjang?</p>
            <div className={styles.confirmActions}>
              <button className={styles.btnCancel} onClick={cancelDelete}>
                Batal
              </button>
              <button className={styles.btnConfirm} onClick={confirmDelete}>
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}