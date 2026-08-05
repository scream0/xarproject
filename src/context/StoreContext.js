"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { isPromoActive, getDiscountedPrice, getCartPromoSummary } from "@/utils/promo";
import { buildAddressId, normalizeAddress } from "@/utils/address";

const StoreContext = createContext();

export function StoreProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [products, setProducts] = useState([]);

  // STATE BARU UNTUK MODAL ALAMAT
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  // STATE PROMO — settings promo dari /api/settings?public=true
  const [promoSettings, setPromoSettings] = useState(null);

  const [cart, setCart] = useState({ items: [] });
  const [isInitialized, setIsInitialized] = useState(false);

  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });

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
      const saved = localStorage.getItem("xar_cart");
      if (saved) {
        try {
          setCart(JSON.parse(saved));
        } catch (e) {
          console.error("Gagal parsing cart:", e);
        }
      }
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (isInitialized && typeof window !== "undefined") {
      localStorage.setItem("xar_cart", JSON.stringify(cart));
    }
  }, [cart, isInitialized]);

  // Bungkus fetchProducts dengan useCallback agar dapat dipanggil ulang secara dinamis
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
    fetchProducts();
  }, [fetchProducts]);

  // Pantau status Auth Supabase secara dinamis
  useEffect(() => {
    let subscription = null;

    const initAuth = async () => {
      const { data: { session } } = await auth.getSession();
      setCurrentSession(session);
      const currentUser = session?.user || null;

      if (currentUser) {
        await handleUserData(currentUser, session?.access_token);
      } else {
        setUser(null);
        setCustomer({ name: "", email: "", phone: "" });
      }

      const { data: authListener } = auth.onAuthStateChange(async (_event, session) => {
        setCurrentSession(session);
        const currentUser = session?.user || null;

        if (currentUser) {
          await handleUserData(currentUser, session?.access_token);
        } else {
          setUser(null);
          setCustomer({ name: "", email: "", phone: "" });
        }
      });
      subscription = authListener?.subscription;
    };

    initAuth();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const handleUserData = async (currentUser, token) => {
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
  };

  const cartQuantity =
    cart?.items?.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) ||
    0;

  const addToCart = (product, customVariant = null, quantity = 1) => {
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

    setCart((prev) => {
      const existingItem = prev.items.find(
        (item) => item.cartId === uniqueCartId,
      );
      const currentQtyInCart = existingItem ? existingItem.quantity : 0;

      if (currentQtyInCart + quantity > stock) {
        errorMessage = `Stok ${product.name} (${variant.size}) tidak cukup!`;
        return prev;
      }

      successMessage = `${product.name} (${variant.size}) ditambahkan!`;
      if (existingItem) {
        return {
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
      } else {
        return {
          ...prev,
          items: [
            ...prev.items,
            {
              cartId: uniqueCartId,
              id: product.id || product._id,
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
      }
    });

    if (errorMessage) {
      toast.error(errorMessage);
    } else if (successMessage) {
      toast.success(successMessage);
    }
  };

  const removeFromCart = (cartId) => {
    let actionMessage = "";

    setCart((prev) => {
      const item = prev.items.find((i) => i.cartId === cartId);
      if (!item) return prev;

      if (item.quantity > 1) {
        actionMessage = `Jumlah ${item.name} dikurangi`;
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

      actionMessage = `${item.name} dihapus dari keranjang`;
      return { ...prev, items: prev.items.filter((i) => i.cartId !== cartId) };
    });

    if (actionMessage) {
      toast.success(actionMessage, { id: `cart-action-${cartId}` });
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

  const updateCartItemVariant = (currentCartId, newSize) => {
    let updateMessage = "";

    setCart((prevCart) => {
      const cartItem = prevCart.items.find(
        (item) => item.cartId === currentCartId,
      );
      if (!cartItem) return prevCart;

      const allVariants = getAvailableVariants(cartItem.id);
      const newVariantData = allVariants.find((v) => v.size === newSize);
      if (!newVariantData) return prevCart;

      updateMessage = `Varian diubah ke ${newSize}`;
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

    if (updateMessage) {
      toast.success(updateMessage);
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
      toast.success("Berhasil keluar!");
      router.push("/");
    } catch (error) {
      toast.error("Gagal logout");
    }
  };

  const [shippingCost, setShippingCost] = useState(0);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);

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
          (p) => String(p.id || p._id) === String(item.id),
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

      const finalAmount = amount + shippingCostAmount;

      const response = await fetch("/api/midtrans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId,
          orderId,
          amount: finalAmount,
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

      if (data.token && window.snap) {
        window.snap.pay(data.token, {
          onSuccess: async (result) => {
            toast.success("Pembayaran Berhasil!");
            setCart({ items: [] });

            try {
              await fetch("/api/orders/update-status", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ orderId, status: "success" }),
              });

              await fetchProducts();
              window.dispatchEvent(new Event("product-stock-updated"));
            } catch (err) {
              console.error("Gagal memperbarui status order & stok:", err);
            }

            router.push(`/dashboard`);
          },
          onPending: (result) => {
            toast("Menunggu Pembayaran");
            router.push(
              `/orders?order_id=${orderId}&status_code=201&transaction_status=pending`,
            );
          },
          onError: (result) => {
            toast.error("Pembayaran Gagal");
          },
          onClose: () => {
            toast("Popup pembayaran ditutup.");
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

      processPayment();
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