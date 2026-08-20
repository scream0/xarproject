"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { isPromoActive, getDiscountedPrice, getCartPromoSummary } from "@/utils/promo";
import { buildAddressId, normalizeAddress } from "@/utils/address";

const StoreContext = createContext();

// Helper: pastikan setiap item cart punya cartId yang konsisten.
// Diperlukan karena data lama di DB / localStorage mungkin belum
// memiliki field cartId, yang menyebabkan warning "key" di React
// dan salah-target saat removeFromCart / updateCartItemVariant.
const normalizeCartItems = (items = []) =>
  (items || []).map((item) => ({
    ...item,
    cartId:
      item.cartId ||
      `${String(item.productId || item.id).trim()}-${String(item.size).trim()}`,
  }));

export function StoreProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [products, setProducts] = useState([]);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [promoSettings, setPromoSettings] = useState(null);
  const [cart, setCart] = useState({ items: [] });

  // load cart dari localStorage SETELAH mount (client-only, post-hydration)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("xar_cart");
      if (saved) {
        const parsed = JSON.parse(saved);
        setCart({ ...parsed, items: normalizeCartItems(parsed.items) });
      }
    } catch (error) {
      console.error("Gagal parsing cart:", error);
    }
  }, []); // cuma jalan sekali saat mount

  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [isCartSynced, setIsCartSynced] = useState(false);

  // Helper to sync cart with the database
  const syncCartWithDB = useCallback(async (cartToSync) => {
    if (!currentSession) return; // Only sync if user is logged in
    try {
      const token = currentSession.access_token;
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ items: cartToSync.items }),
      });
      if (!response.ok) {
        throw new Error('Failed to sync cart with database.');
      }
    } catch (error) {
      console.error(error);
      // Re-throw the error to be caught by the calling function for rollback
      throw error;
    }
  }, [currentSession]);


  // Fetch promo settings (public) untuk diterapkan di seluruh app
  useEffect(() => {
    const loadPromo = async () => {
      try {
        const res = await fetch("/api/settings?public=true", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setPromoSettings(data);
        }
      } catch (error) {
        console.error("Gagal memuat settings promo:", error);
      }
    };
    loadPromo();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("xar_cart", JSON.stringify(cart));
    }
  }, [cart]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      const result = await res.json();
      const data = result.data || result || [];

      const mapped = data.map((p) => ({
        ...p,
        imageUrl: p.image_url || p.imageUrl,
        isAvailable: p.is_available ?? p.isAvailable,
      }));
      setProducts(mapped);
    } catch (error) {
      console.error("Gagal ambil produk dari API:", error);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProducts();
  }, [fetchProducts]);

const handleUserData = useCallback(async (currentUser, token) => {
  const userId = currentUser.id || currentUser.uid;
  const defaultPhoto = currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || "";

  let mergedUser = {
    ...currentUser,
    uid: userId,
    photoURL: defaultPhoto,
  };

  setCustomer({
    name:
      currentUser.user_metadata?.full_name ||
      currentUser.user_metadata?.name ||
      currentUser.email?.split("@")[0] ||
      "User",
    email: currentUser.email || "",
    phone: currentUser.phone || "",
  });

  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`/api/users?userId=${userId}`, { headers });
    const result = await res.json();
    if (res.ok && result.exists && result.data) {
      const dbData = result.data;
      const photoFromDb = dbData.photo_url || defaultPhoto;

      mergedUser = {
        ...currentUser,
        uid: userId,
        ...dbData,
        photoURL: photoFromDb,
        photo_url: photoFromDb,
      };

      setCustomer({
        name:
          dbData.full_name ||
          dbData.username ||
          currentUser.user_metadata?.full_name ||
          currentUser.email?.split("@")[0] ||
          "User",
        email: currentUser.email || "",
        phone: dbData.phone || currentUser.phone || "",
      });
    }
  } catch (err) {
    console.error("Gagal memuat profil user untuk navbar:", err);
  }

  setUser(mergedUser);

  // Sync cart after user is set
  if (!isCartSynced) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/cart', { headers });
      if (res.ok) {
        const remoteCart = await res.json();
        const normalizedRemoteCart = remoteCart
          ? { ...remoteCart, items: normalizeCartItems(remoteCart.items) }
          : remoteCart;

        // ⬇️ pakai functional update, JANGAN baca `cart` dari closure
        setCart((localCart) => {
          const finalCart =
            normalizedRemoteCart && normalizedRemoteCart.items.length > 0
              ? normalizedRemoteCart
              : localCart;

          // sync ke DB kalau local cart yang menang & ada isinya
          if (finalCart.items.length > 0) {
            syncCartWithDB(finalCart).catch((error) => {
              console.error("Gagal menyinkronkan keranjang setelah merge:", error);
            });
          }

          return finalCart;
        });

        setIsCartSynced(true);
      }
    } catch (error) {
      console.error("Gagal menyinkronkan keranjang:", error);
    }
  }
}, [isCartSynced, syncCartWithDB]); // ⬅️ `cart` DIHAPUS dari dependency

  // ref untuk selalu pegang versi terbaru handleUserData tanpa jadi dependency effect
  const handleUserDataRef = useRef(null);
  useEffect(() => {
    handleUserDataRef.current = handleUserData;
  }, [handleUserData]);

  useEffect(() => {
    let subscription = null;

    const initAuth = async () => {
      const { data: { session } } = await auth.getSession();
      setCurrentSession(session);
      const currentUser = session?.user || null;

      if (currentUser) {
        await handleUserDataRef.current(currentUser, session?.access_token);
      } else {
        setUser(null);
        setCustomer({ name: "", email: "", phone: "" });
        setIsCartSynced(false);
      }

      const { data: authListener } = auth.onAuthStateChange(async (_event, session) => {
        setCurrentSession(session);
        const currentUser = session?.user || null;

        if (currentUser) {
          await handleUserDataRef.current(currentUser, session?.access_token);
        } else {
          setUser(null);
          setCustomer({ name: "", email: "", phone: "" });
          setIsCartSynced(false);
        }
      });
      subscription = authListener?.subscription;
    };

    initAuth();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []); // ⬅️ dependency KOSONG — cuma jalan sekali saat mount

  const cartQuantity =
    cart?.items?.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) ||
    0;

  const addToCart = async (product, customVariant = null, quantity = 1) => {
    let variant = customVariant || (product.variants && product.variants[0]);

    if (!variant) {
      toast.error("Varian tidak tersedia");
      return;
    }

    if (
      product.variants &&
      (variant.stock === undefined || variant.stock === null)
    ) {
      const fullVariantData = product.variants.find(
        (v) => v.size === variant.size,
      );
      if (fullVariantData) variant = fullVariantData;
    }

    const stock = Number(variant.stock ?? variant.stok ?? 10);
    if (stock <= 0) {
      toast.error(`${product.name} (${variant.size}) stok habis!`);
      return;
    }

    const prodId = String(product.id || product._id).trim();
    const varSize = String(variant.size).trim();
    const uniqueCartId = `${prodId}-${varSize}`;

    let successMessage = "";
    let errorMessage = "";
    
    const previousCart = cart;
    let newCart = cart;

    setCart((prev) => {
      const existingItem = prev.items.find(
        (item) => item.cartId === uniqueCartId,
      );
      const currentQtyInCart = existingItem ? existingItem.quantity : 0;

      if (currentQtyInCart + quantity > stock) {
        errorMessage = `Stok ${product.name} (${variant.size}) tidak cukup!`;
        newCart = prev;
        return prev;
      }

      successMessage = `${product.name} (${variant.size}) ditambahkan!`;
      if (existingItem) {
        newCart = {
          ...prev,
          items: prev.items.map((item) =>
            item.cartId === uniqueCartId
              ? {
                  ...item,
                  quantity: item.quantity + quantity,
                  total: (item.quantity + quantity) * item.price,
                }
              : item,
          ),
        };
        return newCart;
      } else {
        newCart = {
          ...prev,
          items: [
            ...prev.items,
            {
              cartId: uniqueCartId,
              productId: product.id || product._id,
              name: product.name,
              size: variant.size,
              price: variant.price,
              image:
                variant.image_url ||
                variant.imageUrl ||
                product.imageUrl ||
                product.image_url ||
                product.image,
              quantity: quantity,
              total: variant.price * quantity,
            },
          ],
        };
        return newCart;
      }
    });

    if (errorMessage) {
      toast.error(errorMessage);
    } else if (successMessage) {
      toast.success(successMessage);
      try {
        await syncCartWithDB(newCart);
      } catch (error) {
        setCart(previousCart); // Rollback
        toast.error("Gagal menyimpan keranjang. Silakan coba lagi.");
      }
    }
  };

  // mode: "decrement" (default, dipakai tombol -) mengurangi 1 quantity,
  // atau "all" (dipakai ikon trash) yang selalu menghapus item sepenuhnya
  // berapa pun quantity-nya.
  const removeFromCart = async (cartId, mode = "decrement") => {
    const previousCart = cart;
    let actionMessage = "";
    let newCart = cart;

    setCart((prev) => {
      const item = prev.items.find((i) => i.cartId === cartId);
      if (!item) {
        newCart = prev;
        return prev;
      }

      if (mode === "all" || item.quantity <= 1) {
        actionMessage = `${item.name} dihapus dari keranjang`;
        newCart = { ...prev, items: prev.items.filter((i) => i.cartId !== cartId) };
        return newCart;
      }

      actionMessage = `Jumlah ${item.name} dikurangi`;
      newCart = {
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
      return newCart;
    });

    if (actionMessage) {
      toast.success(actionMessage, { id: `cart-action-${cartId}` });
      try {
        await syncCartWithDB(newCart);
      } catch (error) {
        setCart(previousCart); // Rollback
        toast.error("Gagal menyimpan keranjang. Silakan coba lagi.");
      }
    }
  };

  const clearCart = async () => {
    const previousCart = cart;
    const clearedCart = { items: [] };
    setCart(clearedCart);
    try {
      await syncCartWithDB(clearedCart);
      toast.success("Keranjang dibersihkan.");
    } catch (error) {
      setCart(previousCart);
      toast.error("Gagal membersihkan keranjang. Silakan coba lagi.");
    }
  };

  const getAvailableVariants = (productId) => {
    const product = products.find(
      (p) =>
        String(p.id) === String(productId) ||
        String(p._id) === String(productId),
    );
    return product ? product.variants || [] : [];
  };

  const updateCartItemVariant = async (currentCartId, newSize) => {
    const previousCart = cart;
    let updateMessage = "";
    let newCart = cart;

    setCart((prevCart) => {
      const cartItem = prevCart.items.find(
        (item) => item.cartId === currentCartId,
      );
      if (!cartItem) {
        newCart = prevCart;
        return prevCart;
      }

      const allVariants = getAvailableVariants(cartItem.productId);
      const newVariantData = allVariants.find((v) => v.size === newSize);
      if (!newVariantData) {
        newCart = prevCart;
        return prevCart;
      }

      updateMessage = `Varian diubah ke ${newSize}`;
      const newCartId = `${cartItem.productId}-${newSize}`;
      newCart = {
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
      return newCart;
    });

    if (updateMessage) {
      toast.success(updateMessage);
      try {
        await syncCartWithDB(newCart);
      } catch (error) {
        setCart(previousCart); // Rollback
        toast.error("Gagal mengubah varian. Silakan coba lagi.");
      }
    }
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

  // PROMO: apakah promo sedang aktif?
  const activePromo = isPromoActive(promoSettings)
    ? promoSettings
    : null;

  // PROMO: total diskon keranjang & total setelah diskon
  const promoSummary = getCartPromoSummary(cart.items, promoSettings);
  const promoSavings = promoSummary.savings;
  const discountedCartTotal = cartTotal - promoSavings;

  const logout = async () => {
    try {
      await auth.signOut();
      setCustomer({ name: "", email: "", phone: "" });
      setUser(null);
      setCurrentSession(null);
      setCart({ items: [] }); // Clear cart on logout
      setIsCartSynced(false);
      toast.success("Berhasil keluar!");
      router.push("/");
    } catch (error) {
      toast.error("Gagal logout");
    }
  };

  const [shippingCost, setShippingCost] = useState(0);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(0);

  // Hitung ongkir via GET /api/ongkir (RajaOngkir starter).
  const calculateShippingCost = useCallback(
    async (destinationCityId, weight) => {
      if (!destinationCityId || !weight) return 0;
      setIsCalculatingShipping(true);
      try {
        const res = await fetch(
          `/api/ongkir?origin=114&destination=${destinationCityId}&weight=${weight}&courier=jne`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (res.ok && data.success && data.costs?.length > 0) {
          const allServices = data.costs.flatMap((c) =>
            (c.services || []).map((s) => Number(s.cost) || 0),
          );
          const cheapest = Math.min(...allServices);
          return Number.isFinite(cheapest) ? cheapest : 0;
        }
        return 0;
      } catch (err) {
        console.error("Gagal menghitung ongkir:", err);
        return 0;
      } finally {
        setIsCalculatingShipping(false);
      }
    },
    [],
  );

  const processPayment = async (customParams = {}) => {
    if (!user) {
      toast.error("Silakan login untuk checkout!");
      router.push(
        `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
      );
      return;
    }
    if (cart.items.length === 0) return toast.error("Keranjang kosong!");

    setIsProcessing(true);
    let orderId = "";

    try {
      const userId = user.id || user.uid;
      const token = currentSession?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const userRes = await fetch(`/api/users?userId=${userId}`, { headers });
      const userResult = await userRes.json();
      const userData = userResult?.data || {};
      const userAddresses = userData.addresses || [];

      if (userAddresses.length === 0) {
        setIsCartOpen(false);
        setIsAddressModalOpen(true);
        setIsProcessing(false);
        return;
      }

      orderId = `XAR-${Date.now()}`;
      const amount = activePromo ? discountedCartTotal : cartTotal;
      const primaryAddress =
        userAddresses.find((a) => a.isPrimary) || userAddresses[0];

      let shippingDetail = null;
      if (typeof window !== "undefined") {
        const savedShipping = localStorage.getItem("checkout_shipping");
        if (savedShipping) {
          try {
            shippingDetail = JSON.parse(savedShipping);
          } catch (e) {
            console.error("Gagal parse shipping detail:", e);
          }
        }
        localStorage.removeItem("checkout_shipping");
      }

      let totalWeight = 0;
      for (const item of cart.items) {
        const product = products.find(
          (p) => String(p.id || p._id) === String(item.productId),
        );
        const itemWeight = Number(product?.weight) || 250;
        totalWeight += itemWeight * (Number(item.quantity) || 1);
      }

      let shippingCostAmount = shippingDetail?.shippingCost || 0;
      let selectedShippingAddress = shippingDetail?.address || primaryAddress;

      if (!shippingCostAmount && primaryAddress?.cityId) {
        shippingCostAmount = await calculateShippingCost(
          primaryAddress.cityId,
          totalWeight,
        );
      }
      setShippingCost(shippingCostAmount);

      const shippingVoucherId = customParams.shippingVoucherId || shippingDetail?.appliedVouchers?.find(v => v.type === 'shipping')?.voucherId || null;
      const shippingVoucherClaimId = customParams.shippingVoucherClaimId || shippingDetail?.appliedVouchers?.find(v => v.type === 'shipping')?.claimId || null;
      const discountVoucherId = customParams.discountVoucherId || shippingDetail?.appliedVouchers?.find(v => v.type !== 'shipping')?.voucherId || null;
      const discountVoucherClaimId = customParams.discountVoucherClaimId || shippingDetail?.appliedVouchers?.find(v => v.type !== 'shipping')?.claimId || null;

      const response = await fetch("/api/midtrans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId,
          orderId,
          amount,
          items: cart.items,
          customerDetails: customer,
          shippingAddress: selectedShippingAddress,
          shippingCost: shippingCostAmount,
          shippingDetail: shippingDetail
            ? {
                courierName: shippingDetail.courierName,
                courierService: shippingDetail.courierService,
                courierEtd: shippingDetail.courierEtd,
              }
            : null,
          discountAmount: promoSavings,
          shippingVoucherId,
          shippingVoucherClaimId,
          discountVoucherId,
          discountVoucherClaimId,
        }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const htmlText = await response.text();
        console.error("Server merespons bukan JSON:", htmlText);
        throw new Error(
          "Endpoint API pembayaran tidak ditemukan atau server error.",
        );
      }

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Gagal memproses pembayaran");

      // Segera bersihkan cart dan perbarui stok di lokal sesudah pesanan dibuat
      await clearCart();
      await fetchProducts();
      window.dispatchEvent(new Event("product-stock-updated"));

      if (data.token && window.snap) {
        window.snap.pay(data.token, {
          onSuccess: async (result) => {
            toast.success("Pembayaran Berhasil!");
            router.push(`/account/orders/${orderId}?order_id=${orderId}&status_code=${result.status_code}&transaction_status=${result.transaction_status}`);
          },
          onPending: (result) => {
            toast("Menunggu Pembayaran");
            router.push(
              `/account/orders/${orderId}?order_id=${orderId}&status_code=201&transaction_status=pending`,
            );
          },
          onError: (result) => {
            toast.error("Pembayaran Gagal");
          },
          onClose: () => {
            toast("Popup pembayaran ditutup.");
            router.push(`/account/orders/${orderId}`);
          },
        });
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Gagal memproses pembayaran");
    } finally {
      setIsProcessing(false);
    }
  };

  const saveAddressAndPay = async (addressData) => {
    if (!user) return;
    try {
      setIsProcessing(true);
      const userId = user.id || user.uid;
      const token = currentSession?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const userRes = await fetch(`/api/users?userId=${userId}`, { headers });
      const userResult = await userRes.json();
      const existingAddresses = userResult?.data?.addresses || [];

      const newAddress = normalizeAddress({
        id: buildAddressId(),
        label: addressData.label || "Rumah",
        recipientName: addressData.recipientName,
        recipientPhone: addressData.recipientPhone,
        street: addressData.street,
        city: addressData.city,
        cityId: addressData.cityId || "",
        postalCode: addressData.postalCode || "",
        isPrimary: true,
      });

      const updatedAddresses = (existingAddresses || []).map((addr) => ({
        ...addr,
        isPrimary: false,
      }));
      updatedAddresses.push(newAddress);

      const res = await fetch("/api/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId,
          type: "addresses",
          addresses: updatedAddresses,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal menyimpan alamat");

      toast.success("Alamat berhasil disimpan!");
      setIsAddressModalOpen(false);

      await processPayment();
    } catch (error) {
      console.error("Error save address:", error);
      toast.error(error.message || "Gagal menyimpan alamat");
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
  };

  return (
    <StoreContext.Provider
      value={{
        cart,
        setCart,
        products,
        user,
        addToCart,
        removeFromCart,
        clearCart,
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
        setIsProcessing,
        logout,
        isCartOpen,
        setIsCartOpen,
        isAddressModalOpen,
        setIsAddressModalOpen,
        saveAddressAndPay,
        promoSettings,
        activePromo,
        promoSavings,
        discountedCartTotal,
        promoSummary,
        shippingCost,
        isCalculatingShipping,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);