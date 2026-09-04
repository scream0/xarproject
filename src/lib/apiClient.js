"use client";

/**
 * apiClient.js
 * Utilitas untuk mem-bypass Vercel API Route Rewrites dan
 * langsung fetch data dari URL Golang API.
 * Menghindari isu 500 error karena kegagalan SSL Handshake antara Vercel dan Cloudflare Tunnel.
 */

export const getApiBaseUrl = () => {
  return process.env.NEXT_PUBLIC_API_URL || "";
};

/**
 * Fungsi fetch yang sudah digabungkan dengan base URL.
 * Jika URL diawali dengan "/api/", maka akan otomatis diprefix.
 */
export async function apiFetch(endpoint, options = {}) {
  let url = endpoint;
  
  if (endpoint.startsWith("/api/")) {
    const base = getApiBaseUrl();
    url = `${base}${endpoint}`;
  }

  // Jika diperlukan setup headers default
  const defaultHeaders = {
    // Content-Type tidak diset default agar FormData tidak rusak, 
    // jika butuh json, komponen biasanya sudah mengsetnya.
  };

  const finalOptions = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  };

  return fetch(url, finalOptions);
}
