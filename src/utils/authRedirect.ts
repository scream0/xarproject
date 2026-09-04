const DEFAULT_REDIRECT = "/dashboard";

// Only allow internal, absolute paths. This prevents a callbackUrl from
// turning a successful login into an open redirect to an attacker domain.
function getSafeAuthRedirect(value: any, fallback = DEFAULT_REDIRECT) {
  const candidate = String(value || "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallback;
  }
  return candidate;
}

export { DEFAULT_REDIRECT, getSafeAuthRedirect };
