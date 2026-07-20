"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebaseClient";
import { collection, getDocs } from "firebase/firestore";
import toast from "react-hot-toast";

const StoreContext = createContext();

export function StoreProvider({ children }) {
  const router = useRouter();
  const [uiConfig, setUiConfig] = useState(null);
  const [user, setUser] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Produk diambil dari Firestore, bukan JSON lagi
  const [products, setProducts] = useState([]);

  const [cart, setCart] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("xar_cart");
      return saved ? JSON.parse(saved) : { items: [] };
    }
    return { items: [] };
  });

  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });

  // Fetch Produk dari Firestore
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "products"));
        const data = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProducts(data);
      } catch (error) {
        console.error("Gagal ambil produk:", error);
      }
    };
    fetchProducts();
  }, []);

  // Sync Keranjang
  useEffect(() => {
    localStorage.setItem("xar_cart", JSON.stringify(cart));
  }, [cart]);

  // Cek Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setCustomer({
          name: currentUser.displayName || "",
          email: currentUser.email || "",
          phone: "",
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const cartQuantity =
    cart?.items?.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) ||
    0;

  const addToCart = (product, customVariant = null, quantity = 1) => {
  let variant = customVariant || (product.variants && product.variants[0]);
  
  if (!variant) return toast.error("Varian tidak tersedia");

  // --- TAMBAHKAN LOGIKA INI ---
  // Jika varian yang masuk tidak punya stok (misal karena objek tidak lengkap),
  // coba cari data stok yang asli dari daftar varian produk
  if (product.variants && (variant.stock === undefined || variant.stock === null)) {
    const fullVariantData = product.variants.find(v => v.size === variant.size);
    if (fullVariantData) variant = fullVariantData;
  }
  // ---------------------------

  const stock = variant.stock ?? 0;
  if (stock <= 0) {
    return toast.error(`${product.name} (${variant.size}) stok habis!`);
  }

  const prodId = String(product.id).trim();
  const varSize = String(variant.size).trim();
  const uniqueCartId = `${prodId}-${varSize}`;

  setCart((prev) => {
    const existingItem = prev.items.find((item) => item.cartId === uniqueCartId);
    const currentQtyInCart = existingItem ? existingItem.quantity : 0;
    
    if (currentQtyInCart + quantity > stock) {
      toast.error(`Stok ${product.name} (${variant.size}) tidak cukup!`);
      return prev;
    }
    
    // ... (sisanya tetap sama: logic update cart/tambah item)
    if (existingItem) {
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.cartId === uniqueCartId
              ? { ...item, quantity: item.quantity + quantity, total: (item.quantity + quantity) * item.price }
              : item,
          ),
        };
      } else {
        return {
          ...prev,
          items: [
            ...prev.items,
            {
              cartId: uniqueCartId,
              id: product.id,
              name: product.name,
              size: variant.size,
              price: variant.price,
              image: product.imageUrl || product.image,
              quantity: quantity,
              total: variant.price * quantity,
            },
          ],
        };
      }
  });
  toast.success(`${product.name} (${variant.size}) ditambahkan!`);
};
  const removeFromCart = (cartId) => {
    setCart((prev) => {
      const item = prev.items.find((i) => i.cartId === cartId);
      if (!item) return prev;
      if (item.quantity > 1) {
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.cartId === cartId
              ? {
                  ...i,
                  quantity: i.quantity - 1,
                  total: i.price * (i.quantity - 1),
                }
              : i,
          ),
        };
      }
      return { ...prev, items: prev.items.filter((i) => i.cartId !== cartId) };
    });
  };

  const getAvailableVariants = (productId) => {
    const product = products.find((p) => p.id === productId);
    return product ? product.variants || [] : [];
  };

  const updateCartItemVariant = (currentCartId, newSize) => {
    setCart((prevCart) => {
      const cartItem = prevCart.items.find(
        (item) => item.cartId === currentCartId,
      );
      if (!cartItem) return prevCart;

      const allVariants = getAvailableVariants(cartItem.id);
      const newVariantData = allVariants.find((v) => v.size === newSize);
      if (!newVariantData) return prevCart;

      const newCartId = `${cartItem.id}-${newSize}`;
      return {
        ...prevCart,
        items: prevCart.items.map((item) =>
          item.cartId === currentCartId
            ? {
                ...item,
                cartId: newCartId,
                size: newSize,
                price: newVariantData.price,
                total: item.quantity * newVariantData.price,
              }
            : item,
        ),
      };
    });
  };

  const rupiah = (number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);

  const cartTotal =
    cart?.items?.reduce(
      (sum, item) =>
        sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
      0,
    ) || 0;

  const logout = async () => {
    try {
      await signOut(auth);
      setCustomer({ name: "", email: "", phone: "" });
      setUser(null);
      toast.success("Berhasil keluar!");
      router.push("/");
    } catch (error) {
      toast.error("Gagal logout");
    }
  };

  const processPayment = async () => {
    if (!user) {
      toast.error("Silakan login untuk checkout!");
      router.push(
        `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
      );
      return;
    }
    if (cart.items.length === 0) return toast.error("Keranjang kosong!");

    setIsProcessing(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart.items, customerDetails: customer }),
      });
      const data = await response.json();
      if (data.token && window.snap) {
        window.snap.pay(data.token, {
          onSuccess: () => {
            toast.success("Pembayaran Berhasil!");
            setCart({ items: [] });
          },
          onPending: () => toast("Menunggu Pembayaran"),
          onError: () => toast.error("Pembayaran Gagal"),
        });
      }
    } catch (error) {
      console.error(error);
      toast.error("Gagal memproses pembayaran");
    } finally {
      setIsProcessing(false);
    }
  };

  const checkoutWa = (e) => {
    e.preventDefault();
    if (!user) {
      toast.error("Login dulu!");
      router.push("/login");
      return;
    }
    // ... logic WA checkout
  };

  return (
    <StoreContext.Provider
      value={{
        cart,
        products,
        user,
        addToCart,
        removeFromCart,
        cartQuantity,
        cartTotal,
        customer,
        updateCartItemVariant,
        getAvailableVariants,
        setCustomer,
        checkoutWa,
        rupiah,
        processPayment,
        isProcessing,
        logout,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);
