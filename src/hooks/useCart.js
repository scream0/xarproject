import { useContext } from "react";
import { StoreContext } from "@/context/StoreContext";

// Custom hook to easily access store context
export const useCart = () => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a StoreProvider");
  }
  
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
    setCustomer
  } = context;

  // Recalculate totals whenever cart items change
  const cartTotal = cart.items.reduce((sum, item) => sum + item.total, 0);
  const cartQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const rupiah = (number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(number);

  const saveCartToLocalStorage = (cartData) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("xar_cart", JSON.stringify(cartData));
    }
  };

  // --- CART ACTIONS ---

  const addToCart = (product, variant, quantity = 1) => {
    setCart((prevCart) => {
      const existingIndex = prevCart.items.findIndex(
        (i) => i.id === product.id && i.size === variant.size,
      );

      let newItems;
      if (existingIndex > -1) {
        newItems = prevCart.items.map((item, index) =>
          index === existingIndex
            ? { ...item, quantity: item.quantity + quantity, total: (item.quantity + quantity) * item.price }
            : item
        );
      } else {
        newItems = [
          ...prevCart.items,
          { 
            ...product, 
            ...variant, 
            quantity: quantity, 
            total: variant.price * quantity, 
            cartId: `${product.id}-${variant.size}` // More stable ID
          },
        ];
      }
      const updatedCart = { ...prevCart, items: newItems };
      saveCartToLocalStorage(updatedCart);
      return updatedCart;
    });
  };

  const removeFromCart = (cartId, mode = 'single') => {
    setCart((prevCart) => {
      const existingItem = prevCart.items.find((i) => i.cartId === cartId);
      if (!existingItem) return prevCart;

      let newItems;
      if (mode === 'all' || existingItem.quantity <= 1) {
        newItems = prevCart.items.filter((i) => i.cartId !== cartId);
      } else {
        newItems = prevCart.items.map((item) =>
          item.cartId === cartId
            ? { ...item, quantity: item.quantity - 1, total: (item.quantity - 1) * item.price }
            : item
        );
      }
      const updatedCart = { ...prevCart, items: newItems };
      saveCartToLocalStorage(updatedCart);
      return updatedCart;
    });
  };

  const updateCartItemVariant = (cartId, newSize) => {
      setCart(prevCart => {
          const itemToUpdate = prevCart.items.find(i => i.cartId === cartId);
          if (!itemToUpdate) return prevCart;

          const originalProduct = products.find(p => p.id === itemToUpdate.id);
          if (!originalProduct) return prevCart;

          const newVariant = originalProduct.variants.find(v => v.size === newSize);
          if (!newVariant) return prevCart;
          
          // Check if the same product with the new variant already exists in the cart
          const existingItemIndex = prevCart.items.findIndex(i => i.id === itemToUpdate.id && i.size === newSize);

          let newItems = [...prevCart.items];

          if (existingItemIndex > -1) {
              // Merge quantities and remove the old item
              newItems[existingItemIndex].quantity += itemToUpdate.quantity;
              newItems[existingItemIndex].total = newItems[existingItemIndex].quantity * newItems[existingItemIndex].price;
              newItems = newItems.filter(i => i.cartId !== cartId);
          } else {
              // Just update the variant
              const itemIndex = newItems.findIndex(i => i.cartId === cartId);
              newItems[itemIndex] = {
                  ...newItems[itemIndex],
                  size: newVariant.size,
                  price: newVariant.price,
                  total: newItems[itemIndex].quantity * newVariant.price,
                  cartId: `${itemToUpdate.id}-${newVariant.size}`
              };
          }
          
          const updatedCart = { ...prevCart, items: newItems };
          saveCartToLocalStorage(updatedCart);
          return updatedCart;
      });
  };

  const getAvailableVariants = (productId) => {
    const product = products.find(p => p.id === productId);
    return product?.variants || [];
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
    setCustomer
  };
};
