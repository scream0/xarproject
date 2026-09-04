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
import { buildAddressId, normalizeAddress, formatAddressDisplay } from "@/utils/address";
import { shouldSkipAuthEvent, logoutUser } from "@/utils/authHelpers";

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
      const response = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/cart", {
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
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/settings?public=true", { cache: "no-store" });
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
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/products");
      const result = await res.json();
      const data = Array.isArray(result?.data) ? result.data : (Array.isArray(result) ? result : []);

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

  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  
  // Start promises concurrently
  const userPromise = fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/user/profile`, { headers }).catch(err => {
    console.error("Gagal memuat profil user untuk navbar:", err);
    return null;
  });
  
  const cartPromise = !isCartSynced
    ? fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/user/cart", { headers }).catch(err => {
        console.error("Gagal menyinkronkan keranjang:", err);
        return null;
      })
    : Promise.resolve(null);

  try {
    const [userRes, cartRes] = await Promise.all([userPromise, cartPromise]);

    // 1. Process User
    if (userRes && userRes.ok) {
      const result = await userRes.json();
      if (result.exists && result.data) {
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
    }

    // Set User state exactly once
    setUser(mergedUser);

    // 2. Process Cart
    if (cartRes && cartRes.ok) {
      const remoteCart = await cartRes.json();
      const normalizedRemoteCart = remoteCart
        ? { ...remoteCart, items: normalizeCartItems(remoteCart.items) }
        : remoteCart;

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
    console.error("Error dalam sinkronisasi user dan cart:", error);
    setUser(mergedUser); // Fallback
  }
}, [isCartSynced, syncCartWithDB]); // ⬅️ `cart` DIHAPUS dari dependency

  // ref untuk selalu pegang versi terbaru handleUserData tanpa jadi dependency effect
  const handleUserDataRef = useRef(null);
  useEffect(() => {
    handleUserDataRef.current = handleUserData;
  }, [handleUserData]);

  useEffect(() => {
    let subscription = null;
    let lastUserId = null;

    const initAuth = async () => {
      const { data: { session } } = await auth.getSession();
      setCurrentSession(session);
      const currentUser = session?.user || null;
      lastUserId = currentUser?.id || null;

      if (currentUser) {
        await handleUserDataRef.current(currentUser, session?.access_token);
      } else {
        setUser(null);
        setCustomer({ name: "", email: "", phone: "" });
        setIsCartSynced(false);
      }

      const { data: authListener } = auth.onAuthStateChange(async (_event, session) => {
        if (shouldSkipAuthEvent(_event, session, lastUserId)) {
          return;
        }

        setCurrentSession(session);
        const currentUser = session?.user || null;
        lastUserId = currentUser?.id || null;

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

  const addToCart = async (product, customVariant = null, quantity = 1, suppressToast = false) => {
    let variant = customVariant || (product.variants && product.variants[0]);

    if (!variant) {
      if (!suppressToast) toast.error("Varian tidak tersedia");
      return { success: false, reason: "no_variant" };
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
      if (!suppressToast) toast.error(`${product.name} (${variant.size}) stok habis!`);
      return { success: false, reason: "out_of_stock" };
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
      if (!suppressToast) toast.error(errorMessage);
      return { success: false, reason: "exceeds_stock" };
    } else if (successMessage) {
      if (!suppressToast) toast.success(successMessage);
      try {
        await syncCartWithDB(newCart);
      } catch (error) {
        setCart(previousCart); // Rollback
        if (!suppressToast) toast.error("Gagal menyimpan keranjang. Silakan coba lagi.");
        return { success: false, reason: "sync_failed" };
      }
      return { success: true };
    }
    return { success: false };
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
      setCustomer({ name: "", email: "", phone: "" });
      setUser(null);
      setCurrentSession(null);
      setCart({ items: [] }); // Clear cart on logout
      setIsCartSynced(false);
      await logoutUser();
    } catch (error) {
      console.error("Logout error:", error);
      if (typeof window !== "undefined") {
        window.location.replace("/login");
      }
    }
  };

  const [shippingCost, setShippingCost] = useState(0);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(0);

  // Hitung ongkir (estimasi lokal / fallback pengiriman).
  const calculateShippingCost = useCallback(
    async (destinationCityId, weight) => {
      if (!weight) return 0;
      setIsCalculatingShipping(true);
      try {
        const kg = Math.max(1, Math.ceil(Number(weight) / 1000));
        const base = Math.max(12000, 8000 + kg * 3500);
        return base;
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

      const userRes = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/user/profile`, { headers });
      const userText = userRes.ok ? await userRes.text() : "";
      const userResult = userText ? JSON.parse(userText) : {};
      const userData = userResult?.data || {};

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

      let userAddresses = [];
      let primaryAddress = null;

      if (!shippingDetail) {
        const addrRes = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/user/${userId}/addresses`, { headers });
        const addrText = addrRes.ok ? await addrRes.text() : "";
        const addrResult = addrText ? JSON.parse(addrText) : {};
        userAddresses = addrResult?.data || [];

        if (userAddresses.length === 0) {
          setIsCartOpen(false);
          setIsAddressModalOpen(true);
          setIsProcessing(false);
          return;
        }
        primaryAddress = userAddresses.find((a) => a.isPrimary) || userAddresses[0];
      }

      orderId = crypto.randomUUID();
      const baseSubtotal = customParams.amount ?? (activePromo ? discountedCartTotal : cartTotal);
      const totalDiscount = Number(customParams.discountAmount ?? promoSavings ?? 0);
      let totalWeight = 0;
      for (const item of cart.items) {
        const product = products.find(
          (p) => String(p.id || p._id) === String(item.productId),
        );
        const itemWeight = Number(product?.weight) || 250;
        totalWeight += itemWeight * (Number(item.quantity) || 1);
      }

      let selectedShippingAddress = customParams.shippingAddress || shippingDetail?.address || primaryAddress;
      if (selectedShippingAddress) {
        selectedShippingAddress = {
          ...selectedShippingAddress,
          fullAddress: formatAddressDisplay(selectedShippingAddress),
        };
      }

      const shippingCostAmount = Number(
        customParams.shippingCost ??
        shippingDetail?.shippingCost ??
        shippingDetail?.cost ??
        0
      );

      const customer = {
        firstName: userData?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Customer",
        email: user?.email,
        phone: userData?.phone || user?.user_metadata?.phone || "081234567890",
      };

      const shippingVoucherId = customParams.shippingVoucherId || shippingDetail?.appliedVouchers?.find(v => v.type === 'shipping')?.voucherId || null;
      const shippingVoucherClaimId = customParams.shippingVoucherClaimId || shippingDetail?.appliedVouchers?.find(v => v.type === 'shipping')?.claimId || null;
      const discountVoucherId = customParams.discountVoucherId || shippingDetail?.appliedVouchers?.find(v => v.type !== 'shipping')?.voucherId || null;
      const discountVoucherClaimId = customParams.discountVoucherClaimId || shippingDetail?.appliedVouchers?.find(v => v.type !== 'shipping')?.claimId || null;
      const paymentMethod = customParams.paymentMethod || "midtrans";

      const finalShippingDetail = customParams.shippingDetail || (shippingDetail
        ? {
            courierName: shippingDetail.courierName,
            courierService: shippingDetail.courierService,
            courierEtd: shippingDetail.courierEtd,
          }
        : null);

      const response = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/midtrans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId,
          orderId,
          amount: baseSubtotal,
          items: cart.items,
          customerDetails: customer,
          shippingAddress: selectedShippingAddress,
          shippingCost: shippingCostAmount,
          shippingDetail: finalShippingDetail,
          discountAmount: totalDiscount,
          shippingVoucherId,
          shippingVoucherClaimId,
          discountVoucherId,
          discountVoucherClaimId,
          paymentMethod,
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

      if (data.method === "manual") {
        toast.success("Pesanan Berhasil Dibuat!");
        router.push(`/dashboard/orders/${orderId}?order_id=${orderId}&status_code=201&transaction_status=pending&payment_type=manual`);
      } else if (data.token && window.snap) {
        window.snap.pay(data.token, {
          onSuccess: async (result) => {
            toast.success("Pembayaran Berhasil!");
            router.push(`/dashboard/orders/${orderId}?order_id=${orderId}&status_code=${result.status_code}&transaction_status=${result.transaction_status}`);
          },
          onPending: (result) => {
            toast("Menunggu Pembayaran", { icon: "⏳" });
            router.push(
              `/dashboard/orders/${orderId}?order_id=${orderId}&status_code=201&transaction_status=pending`,
            );
          },
          onError: (result) => {
            toast.error("Pembayaran Gagal");
            router.push(`/dashboard/orders/${orderId}`);
          },
          onClose: () => {
            toast("Popup pembayaran ditutup.", { icon: "ℹ️" });
            router.push(`/dashboard/orders/${orderId}`);
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
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const payload = {
        recipientName: addressData.recipientName,
        recipientPhone: addressData.recipientPhone,
        street: addressData.street,
        province: addressData.province || "",
        city: addressData.city,
        cityId: addressData.cityId || "",
        postalCode: addressData.postalCode || "",
        label: addressData.label || "Rumah",
        isPrimary: true,
      };

      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/user/${userId}/addresses`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
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