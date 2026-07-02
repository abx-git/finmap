import "server-only";
import YahooFinance from "yahoo-finance2";
import { getCached, setCache, sanitizeCacheKey } from "./cache";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface ResolvedInstrument {
  wkn: string;
  isin: string | null;
  ticker: string;
  name: string;
}

const GERMAN_YAHOO_SUFFIXES = [".DE", ".DU", ".MU", ".HM", ".F", ".SG", ".HA", ".AS"];

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
  return [...new Set(candidates.flatMap((candidate) => withPreferredTickers(candidate)))];
}

const GERMAN_EXCH_CODES = new Set([
  "GR",
  "GF",
  "GD",
  "GY",
  "GS",
  "GM",
  "GI",
  "GH",
  "GZ",
  "GB",
  "GT",
]);

interface OpenFigiEntry {
  name: string;
  ticker: string;
  exchCode: string;
  marketSector: string;
  securityType: string;
}

interface OpenFigiResponse {
  data?: OpenFigiEntry[];
  error?: string;
}

async function resolveViaOpenFIGI(wkn: string): Promise<OpenFigiEntry | null> {
  const cacheKey = sanitizeCacheKey(`figi_${wkn}`);
  const cached = await getCached<OpenFigiEntry>(cacheKey);
  if (cached) return cached;

  const res = await fetch("https://api.openfigi.com/v3/mapping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{ idType: "ID_WERTPAPIER", idValue: wkn }]),
  });

  if (!res.ok) return null;

  const results: OpenFigiResponse[] = await res.json();
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

  await setCache(cacheKey, pick);
  return pick;
}

async function verifyYahooTicker(ticker: string): Promise<{
  name: string;
  isin: string | null;
} | null> {
  try {
    const quote = await yahooFinance.quote(ticker);
    if (quote?.regularMarketPrice == null) return null;
    return {
      name: quote.longName ?? quote.shortName ?? ticker,
      isin: null,
    };
  } catch {
    return null;
  }
}

async function searchYahooByIsin(isin: string): Promise<string | null> {
  try {
    const results = await yahooFinance.search(isin, { quotesCount: 10 });
    return findGermanQuote(results.quotes ?? []);
  } catch {
    return null;
  }
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
      const results = await yahooFinance.search(query, { quotesCount: 10 });
      const symbol = findGermanQuote(results.quotes ?? []);
      if (symbol) return symbol;
    } catch {
      // try next query
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

  const isinCandidates = await lookupIsinCandidates(normalized);
  for (const isin of isinCandidates) {
    const ticker = await searchYahooByIsin(isin);
    if (!ticker) continue;
    const verified = await verifyYahooTicker(ticker);
    if (verified) {
      return {
        wkn: normalized,
        isin,
        ticker,
        name: verified.name,
      };
    }
  }

  return null;
}

async function lookupIsinCandidates(wkn: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://isinconverter.com/api/v1/wkn/${wkn}`,
      { next: { revalidate: 86400 } }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.isin) return [data.isin];
    }
  } catch {
    // fall through
  }
  return [];
}
