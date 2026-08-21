const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  const { data, error } = await supabase
    .from("vouchers")
    .insert({
      code: "TESTCODE" + Date.now(),
      title: "Test",
      type: "shipping", 
      discount_amount: 1000,
      min_purchase: 0,
      valid_until: new Date("2026-12-31").toISOString(),
      usage_limit: 1,
      total_usage_limit: null,
      is_active: true,
    })
    .select()
    .single();

  console.log("INSERT RESULT DATA:", data);
  console.log("INSERT RESULT ERROR:", error);
}
checkSchema();
