import { NextRequest, NextResponse } from "next/server";
import { analyzePortfolio } from "@/lib/portfolio";
import { isValidWkn } from "@/lib/validation";
import type { HoldingInput } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const holdings: HoldingInput[] = body.holdings;

    if (!Array.isArray(holdings) || holdings.length === 0) {
      return NextResponse.json(
        { error: "Mindestens eine Position erforderlich" },
        { status: 400 }
      );
    }

    for (const h of holdings) {
      if (!h.wkn || !isValidWkn(h.wkn)) {
        return NextResponse.json(
          { error: `Ungültige WKN: ${h.wkn ?? "(leer)"}` },
          { status: 400 }
        );
      }
      if (!h.shares || h.shares <= 0) {
        return NextResponse.json(
          { error: `Ungültige Anteilszahl für WKN ${h.wkn}` },
          { status: 400 }
        );
      }
    }

    const result = await analyzePortfolio(holdings);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analyse fehlgeschlagen" },
      { status: 500 }
    );
  }
}
