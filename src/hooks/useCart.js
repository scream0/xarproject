const addToCart = (product, variant, quantity = 1) => {
  setCart((prevCart) => {
    const existingIndex = prevCart.items.findIndex(
      (i) => i.id === product.id && i.size === variant.size,
    );

    let newItems;
    if (existingIndex > -1) {
      // Jika sudah ada, buat array baru dan update item tersebut
      newItems = prevCart.items.map((item, index) =>
        index === existingIndex
          ? {
              ...item,
              quantity: item.quantity + quantity,
              total: (item.quantity + quantity) * item.price,
            }
          : item,
      );
    } else {
      // Jika belum ada, buat array baru dengan item tambahan
      newItems = [
        ...prevCart.items,
        {
          ...product,
          ...variant, // ini membawa size dan price
          quantity: quantity,
          total: variant.price * quantity,
          cartId: Date.now(),
        },
      ];
    }

    const updatedCart = { ...prevCart, items: newItems };
    localStorage.setItem("xar_cart", JSON.stringify(updatedCart));
    return updatedCart;
  });
};
