import test from "node:test";
import assert from "node:assert/strict";
import { getSafeAuthRedirect } from "./authRedirect.js";

test("getSafeAuthRedirect permits only internal paths", () => {
  assert.equal(getSafeAuthRedirect("/checkout?step=payment"), "/checkout?step=payment");
  assert.equal(getSafeAuthRedirect("https://attacker.example"), "/dashboard");
  assert.equal(getSafeAuthRedirect("//attacker.example"), "/dashboard");
  assert.equal(getSafeAuthRedirect("\\\\attacker.example"), "/dashboard");
});
