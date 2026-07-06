import {
  searchYahoo,
  verifyYahooTicker,
} from "./yahoo-browser";
import { getMemoryCached, setMemoryCache, sanitizeCacheKey } from "./memory-cache";

export interface ResolvedInstrument {
  wkn: string;
  isin: string | null;
  ticker: string;
  name: string;
}

const GERMAN_YAHOO_SUFFIXES = [".DE", ".DU", ".MU", ".HM", ".F", ".SG", ".HA", ".AS"];

const GERMAN_EXCH_CODES = new Set([
  "GR", "GF", "GD", "GY", "GS", "GM", "GI", "GH", "GZ", "GB", "GT",
]);

function isGermanYahooSymbol(symbol: string): boolean {
  return GERMAN_YAHOO_SUFFIXES.some((suffix) => symbol.endsWith(suffix));
}

function isFundQuoteType(quoteType: unknown): boolean {
  return quoteType === "ETF" || quoteType === "EQUITY";
}

function findGermanQuote(quotes: object[]): string | null {
  const matches = quotes.filter(
    (q) =>
      "symbol" in q &&
      typeof q.symbol === "string" &&
      isGermanYahooSymbol(q.symbol) &&
      "quoteType" in q &&
      isFundQuoteType(q.quoteType)
  ) as { symbol: string }[];

  for (const suffix of GERMAN_YAHOO_SUFFIXES) {
    const match = matches.find((q) => q.symbol.endsWith(suffix));
    if (match) return match.symbol;
  }
  return null;
}

function buildTickerCandidates(ticker: string): string[] {
  return [...new Set(GERMAN_YAHOO_SUFFIXES.map((suffix) => `${ticker}${suffix}`))];
}

function withPreferredTickers(symbol: string): string[] {
  const base = symbol.includes(".") ? symbol.slice(0, symbol.lastIndexOf(".")) : symbol;
  return [...new Set([`${base}.DE`, symbol, ...buildTickerCandidates(base)])];
}

function expandTickerCandidates(candidates: string[]): string[] {
  return [...new Set(candidates.flatMap((c) => withPreferredTickers(c)))];
}

interface OpenFigiEntry {
  name: string;
  ticker: string;
  exchCode: string;
  marketSector: string;
  securityType: string;
}

async function resolveViaOpenFIGI(wkn: string): Promise<OpenFigiEntry | null> {
  const cacheKey = sanitizeCacheKey(`figi_${wkn}`);
  const cached = getMemoryCached<OpenFigiEntry>(cacheKey);
  if (cached) return cached;

  const res = await fetch("https://api.openfigi.com/v3/mapping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{ idType: "ID_WERTPAPIER", idValue: wkn }]),
  });
  if (!res.ok) return null;

  const results = (await res.json()) as Array<{ data?: OpenFigiEntry[] }>;
  const data = results[0]?.data;
  if (!data?.length) return null;

  const equities = data.filter(
    (d) =>
      d.marketSector === "Equity" &&
      (d.securityType === "Common Stock" || d.securityType === "ETP")
  );
  const german = equities.filter((d) => GERMAN_EXCH_CODES.has(d.exchCode));
  const pick =
    german.find((d) => d.exchCode === "GY") ??
    german.find((d) => d.exchCode === "GF") ??
    german[0] ??
    equities[0];

  if (!pick) return null;
  setMemoryCache(cacheKey, pick);
  return pick;
}

async function searchYahooFund(name: string): Promise<string | null> {
  const normalizedName = name
    .replace(/\s+DE\s+EUR\s+(ACC|DIST)\b/i, "")
    .replace(/^ISHARES/i, "iShares")
    .trim();
  const queries = [...new Set([name, normalizedName, normalizedName.split(" ").slice(0, 4).join(" ")])];

  for (const query of queries) {
    if (!query) continue;
    try {
      const quotes = await searchYahoo(query);
      const symbol = findGermanQuote(quotes);
      if (symbol) return symbol;
    } catch {
      // try next
    }
  }
  return null;
}

export async function resolveWkn(wkn: string): Promise<ResolvedInstrument | null> {
  const normalized = wkn.toUpperCase().replace(/\s/g, "");
  const figi = await resolveViaOpenFIGI(normalized);

  if (figi) {
    const byName = await searchYahooFund(figi.name);
    const candidates = expandTickerCandidates([
      ...buildTickerCandidates(figi.ticker),
      ...(byName ? [byName] : []),
    ]);

    for (const yahooTicker of candidates) {
      const verified = await verifyYahooTicker(yahooTicker);
      if (verified) {
        return {
          wkn: normalized,
          isin: null,
          ticker: yahooTicker,
          name: verified.name,
        };
      }
    }
  }

  return null;
}
