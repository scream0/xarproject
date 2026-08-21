async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/vouchers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "SHIPTEST_" + Date.now(),
        title: "Test",
        type: "shipping",
        discount_amount: 1000,
        min_purchase: 0,
        valid_until: "2026-12-31",
        usage_limit: 1,
        total_usage_limit: null,
        is_active: true
      })
    });
    const data = await res.json();
    console.log("RESPONSE:", data);
  } catch (err) {
    console.error("FETCH ERROR:", err);
  }
}
test();
