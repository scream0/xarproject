// @ts-nocheck
import { useStore } from "@/context/StoreContext";

// Custom hook to easily access cart-specific parts of the store context.
// Wraps useStore and exposes the same API as before plus cart helpers.
export const useCart = () => {
  const context = useStore();

  const {
    cart,
    setCart,
    products,
    user,
    isCartOpen,
    setIsCartOpen,
    isProcessing,
    setIsProcessing,
    customer,
    setCustomer,
    addToCart: addToCartCtx,
    removeFromCart: removeFromCartCtx,
    updateCartItemVariant: updateCartItemVariantCtx,
    getAvailableVariants: getAvailableVariantsCtx,
  } = context;

  // Recalculate totals whenever cart items change
  const cartTotal = cart.items.reduce((sum, item) => sum + item.total, 0);
  const cartQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const rupiah = (number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(number);

  const saveCartToLocalStorage = (cartData) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("xar_cart", JSON.stringify(cartData));
    }
  };

  // --- CART ACTIONS (thin wrappers over StoreContext + localStorage) ---

  const addToCart = (product, variant, quantity = 1) => {
    addToCartCtx(product, variant, quantity);
  };

  const removeFromCart = (cartId, mode = "single") => {
    if (mode === "all") {
      // Hapus item sepenuhnya dari keranjang.
      setCart((prevCart) => {
        const updatedCart = {
          items: prevCart.items.filter((i) => i.cartId !== cartId),
        };
        saveCartToLocalStorage(updatedCart);
        return updatedCart;
      });
      return;
    }
    removeFromCartCtx(cartId);
  };

  const updateCartItemVariant = (cartId, newSize) => {
    updateCartItemVariantCtx(cartId, newSize);
  };

  const getAvailableVariants = (productId) => {
    return getAvailableVariantsCtx(productId);
  };

  const clearCart = () => {
    const clearedCart = { items: [] };
    setCart(clearedCart);
    saveCartToLocalStorage(clearedCart);
  };

  return {
    cart,
    setCart,
    addToCart,
    removeFromCart,
    updateCartItemVariant,
    clearCart,
    cartTotal,
    cartQuantity,
    rupiah,
    products,
    getAvailableVariants,
    isCartOpen,
    setIsCartOpen,
    isProcessing,
    setIsProcessing,
    user,
    customer,
    setCustomer,
  };
};
