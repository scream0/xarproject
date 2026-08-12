const SENSITIVE_KEY_PATTERN = /token|secret|password|authorization|cookie|session|api[_-]?key|access[_-]?key|private[_-]?key/i;

function normalizeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      status: error.status,
      code: error.code,
      stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  if (error && typeof error === "object") {
    return error;
  }

  return { message: String(error) };
}

function redactSecrets(value, parentKey = "") {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item, parentKey));
  }

  if (typeof value !== "object") {
    return value;
  }

  const redacted = {};

  for (const [key, childValue] of Object.entries(value)) {
    const nextKey = parentKey ? `${parentKey}.${key}` : key;

    if (SENSITIVE_KEY_PATTERN.test(key) || SENSITIVE_KEY_PATTERN.test(nextKey)) {
      redacted[key] = "[REDACTED]";
      continue;
    }

    redacted[key] = redactSecrets(childValue, nextKey);
  }

  return redacted;
}

function createSafeErrorLog(context, error, extra = {}) {
  const safeContext = redactSecrets(context);
  const safeError = redactSecrets(normalizeError(error));
  const safeExtra = redactSecrets(extra);

  return {
    context: safeContext,
    error: safeError,
    ...safeExtra,
  };
}

function logServerError(context, error, extra = {}) {
  const payload = createSafeErrorLog(context, error, extra);

  if (process.env.NODE_ENV === "production") {
    console.error(JSON.stringify(payload));
    return;
  }

  console.error(payload);
}

export { createSafeErrorLog, logServerError, redactSecrets };
