import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RAJAONGKIR_BASE_URL =
  process.env.RAJAONGKIR_BASE_URL || "https://api.rajaongkir.com/starter";
const API_KEY =
  process.env.RAJAONGKIR_API_KEY || process.env.NEXT_PUBLIC_RAJAONGKIR_API_KEY;

// Cache in-memory sederhana: daftar kota jarang berubah (1 hari TTL)
let citiesCache = { data: null, ts: 0 };
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 jam

/**
 * GET /api/ongkir/cities
 * Mengambil daftar kota/kabupaten dari RajaOngkir.
 *
 * Query params:
 *   query  (string, opsional)  Filter nama kota (mis. "yogyakarta")
 *
 * Respon: { success, count, cities: [{ city_id, city_name, province, postal_code, type }] }
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("query") || "").toLowerCase();

    if (!API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error:
            "RAJAONGKIR_API_KEY belum diset di .env.local. Silakan daftar di rajaongkir.com dan tambahkan API key Anda.",
        },
        { status: 500 },
      );
    }

    // Gunakan cache jika masih valid
    if (!citiesCache.data || Date.now() - citiesCache.ts > CACHE_TTL) {
      const rajaResponse = await fetch(
        `${RAJAONGKIR_BASE_URL}/city`,
        { headers: { key: API_KEY }, cache: "no-store" },
      );

      const rajaData = await rajaResponse.json();

      if (!rajaResponse.ok) {
        console.error("RajaOngkir city error:", rajaData);
        return NextResponse.json(
          {
            success: false,
            error:
              rajaData?.rajaongkir?.status?.description ||
              rajaData?.status?.description ||
              "Gagal mengambil daftar kota.",
          },
          { status: rajaResponse.status },
        );
      }

      citiesCache = {
        data: rajaData?.rajaongkir?.results || [],
        ts: Date.now(),
      };
    }

    let cities = citiesCache.data;

    // Filter berdasarkan query jika ada
    if (query) {
      cities = cities.filter((city) =>
        `${city.city_name} ${city.province} ${city.type}`
          .toLowerCase()
          .includes(query),
      );
    }

    // Sortir alfabetis
    cities = [...cities].sort((a, b) =>
      `${a.type} ${a.city_name}`.localeCompare(`${b.type} ${b.city_name}`),
    );

    return NextResponse.json({
      success: true,
      count: cities.length,
      cities: cities.map((city) => ({
        city_id: city.city_id,
        city_name: city.city_name,
        province: city.province,
        type: city.type,
        postal_code: city.postal_code,
      })),
    });
  } catch (error) {
    console.error("RajaOngkir cities API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}

