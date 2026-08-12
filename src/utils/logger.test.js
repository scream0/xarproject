import test from "node:test";
import assert from "node:assert/strict";
import { createSafeErrorLog, redactSecrets } from "./logger.js";

test("redactSecrets hides sensitive key names", () => {
  const payload = {
    token: "secret-token",
    nested: { password: "hunter2", safe: "ok" },
    public: "value",
  };

  const redacted = redactSecrets(payload);

  assert.equal(redacted.token, "[REDACTED]");
  assert.equal(redacted.nested.password, "[REDACTED]");
  assert.equal(redacted.public, "value");
});

test("createSafeErrorLog keeps error message but strips secrets", () => {
  const entry = createSafeErrorLog(
    { authorization: "Bearer abc123", requestId: "req-1" },
    new Error("bad token"),
    { session: "session-xyz" },
  );

  assert.equal(entry.context.authorization, "[REDACTED]");
  assert.equal(entry.error.message, "bad token");
  assert.equal(entry.session, "[REDACTED]");
});
