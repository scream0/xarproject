const payload = {
  storeName: "My Store",
  storeEmail: "test@example.com",
  currency: "IDR",
  adminLocale: "id",
  lowStockThreshold: 10,
  storeCityId: "123",
  storeCityName: "Jakarta",
  enableMidtrans: true,
  enableManualTransfer: false,
  midtransIsProduction: false,
  activeCouriers: ["jne", "jnt"],
  biteshipIsProduction: false,
  biteshipAutoOrder: false,
  hero: { tagline: "Hello" },
  about: { content: {} },
  product: { header: {} },
  contact: { form: {} },
  footer: { branding: {} }
};

fetch("http://127.0.0.1:8080/api/admin/settings", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    // We need auth header if it requires it, but let's just test JSON parse?
    // Wait, the error happens IN the route handler, so it requires auth.
  },
  body: JSON.stringify(payload)
}).then(res => res.json()).then(console.log).catch(console.error);
