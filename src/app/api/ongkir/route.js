import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RAJAONGKIR_BASE_URL =
  process.env.RAJAONGKIR_BASE_URL || "https://api.rajaongkir.com/starter";
const API_KEY =
  process.env.RAJAONGKIR_API_KEY || process.env.NEXT_PUBLIC_RAJAONGKIR_API_KEY;

function buildFallbackCosts(weight) {
  const kg = Math.max(1, Math.ceil(weight / 1000));
  const base = Math.max(12000, 8000 + kg * 3500);

  return [
    {
      courier: "jne",
      courierName: "JNE",
      services: [
        {
          service: "REG",
          description: "Layanan reguler",
          cost: base,
          etd: "1-2",
          note: "Estimasi lokal",
        },
        {
          service: "OKE",
          description: "Layanan ekonomis",
          cost: Math.max(10000, base - 2000),
          etd: "2-3",
          note: "Estimasi lokal",
        },
      ],
    },
    {
      courier: "jnt",
      courierName: "J&T",
      services: [
        {
          service: "EZ",
          description: "Layanan cepat",
          cost: base + 3000,
          etd: "1-2",
          note: "Estimasi lokal",
        },
      ],
    },
    {
      courier: "pos",
      courierName: "POS Indonesia",
      services: [
        {
          service: "POS",
          description: "Layanan pos",
          cost: Math.max(9000, base - 1000),
          etd: "3-5",
          note: "Estimasi lokal",
        },
      ],
    },
  ];
}

/**
 * GET /api/ongkir
 * Proxy ke RajaOngkir untuk menghitung biaya ongkir (cek tarif).
 *
 * Query params:
 *   origin       (string)  ID kota asal (wajib)
 *   destination  (string)  ID kota tujuan (wajib)
 *   weight       (number)  Berat paket dalam gram (wajib, >0)
 *   courier      (string)  Kode kurir: jne | tiki | pos | jnt | sicepat (opsional, default semua)
 *
 * Contoh:
 *   /api/ongkir?origin=501&destination=114&weight=1700&courier=jne
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get("origin");
    const destination = searchParams.get("destination");
    const weight = searchParams.get("weight");
    const courier = searchParams.get("courier") || "jne";

    // Validasi parameter wajib
    if (!origin || !destination || !weight) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Parameter origin, destination, dan weight (gram) wajib diisi.",
        },
        { status: 400 },
      );
    }

    const weightNumber = Number(weight);
    if (!Number.isFinite(weightNumber) || weightNumber <= 0) {
      return NextResponse.json(
        { success: false, error: "Weight harus berupa angka positif (gram)." },
        { status: 400 },
      );
    }

    if (!API_KEY) {
      return NextResponse.json({
        success: true,
        fallback: true,
        warning: "API key RajaOngkir belum aktif, menggunakan tarif estimasi lokal.",
        costs: buildFallbackCosts(weightNumber),
      });
    }

    // Panggil RajaOngkir /cost endpoint
    const body = new URLSearchParams();
    body.append("origin", origin);
    body.append("destination", destination);
    body.append("weight", String(weightNumber));
    body.append("courier", courier);

    const rajaResponse = await fetch(`${RAJAONGKIR_BASE_URL}/cost`, {
      method: "POST",
      headers: {
        key: API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      cache: "no-store",
    });

    const rajaData = await rajaResponse.json();

    if (!rajaResponse.ok) {
      console.error("RajaOngkir cost error:", rajaData);
      return NextResponse.json({
        success: true,
        fallback: true,
        warning: "RajaOngkir sedang tidak tersedia, menggunakan tarif estimasi lokal.",
        costs: buildFallbackCosts(weightNumber),
      });
    }

    const result = rajaData?.rajaongkir?.results || [];
    if (!result.length) {
      return NextResponse.json({
        success: true,
        fallback: true,
        warning: "Tidak ada tarif yang dikembalikan, menggunakan estimasi lokal.",
        costs: buildFallbackCosts(weightNumber),
      });
    }

    // Normalisasi data tarif ke bentuk yang mudah dipakai frontend
    const costs = result.map((courierResult) => ({
      courier: courierResult.code,
      courierName: courierResult.name,
      services: (courierResult.costs || []).map((service) => ({
        service: service.service,
        description: service.description,
        cost: Number(service.cost?.[0]?.value || 0),
        etd: service.cost?.[0]?.etd || "-",
        note: service.cost?.[0]?.note || "",
      })),
    }));

    return NextResponse.json({
      success: true,
      origin,
      destination,
      weight: weightNumber,
      costs,
    });
  } catch (error) {
    console.error("Ongkir API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}

