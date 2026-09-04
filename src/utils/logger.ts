const SENSITIVE_KEY_PATTERN = /token|secret|password|authorization|cookie|session|api[_-]?key|access[_-]?key|private[_-]?key/i;

function normalizeError(error: any) {
  if (error instanceof Error) {
    const e = error as Error & { status?: number; code?: string };
    return {
      name: e.name,
      message: e.message,
      status: e.status,
      code: e.code,
      stack: process.env.NODE_ENV !== "production" ? e.stack : undefined,
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

function redactSecrets(value: any, parentKey = ""): any {
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

  const redacted: Record<string, any> = {};

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

function createSafeErrorLog(context: string, error: any, extra: Record<string, any> = {}) {
  const safeContext = redactSecrets(context);
  const safeError = redactSecrets(normalizeError(error));
  const safeExtra = redactSecrets(extra);

  return {
    context: safeContext,
    error: safeError,
    ...safeExtra,
  };
}

function logServerError(context: string, error: any, extra: Record<string, any> = {}) {
  const payload = createSafeErrorLog(context, error, extra);

  if (process.env.NODE_ENV === "production") {
    console.error(JSON.stringify(payload));
    return;
  }

  console.error(payload);
}

export { createSafeErrorLog, logServerError, redactSecrets };
