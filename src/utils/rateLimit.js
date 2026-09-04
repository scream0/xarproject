// src/utils/rateLimit.js
import { LRUCache } from 'lru-cache';
import { NextResponse } from 'next/server';

const rateLimitCache = new LRUCache({
  max: 500, // Max number of IP addresses to store
  ttl: 60 * 1000, // 1 minute (in milliseconds)
});

export function rateLimit(options) {
  const { limit = 5, windowMs = 60 * 1000 } = options;

  return async (request) => {
    const ip = request.headers.get('x-forwarded-for') || request.ip || '127.0.0.1'; // Fallback for IP
    const key = `rate_limit_${ip}`;

    let ipAttempts = rateLimitCache.get(key) || 0;

    if (ipAttempts >= limit) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan, silakan coba lagi nanti.' },
        { status: 429 }
      );
    }

    rateLimitCache.set(key, ipAttempts + 1, { ttl: windowMs });
    return null; // No rate limit exceeded
  };
}