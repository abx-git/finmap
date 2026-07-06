const ALLOWED_PROXY_HOSTS = new Set([
  "api.openfigi.com",
  "query1.finance.yahoo.com",
  "query2.finance.yahoo.com",
]);

const DEFAULT_PROXY_BASE =
  process.env.NEXT_PUBLIC_CORS_PROXY_URL ??
  "https://cors.raghu.workers.dev/?url=";

function needsProxy(): boolean {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "github.io" || host.endsWith(".github.io")) return true;
  }
  return process.env.NEXT_PUBLIC_USE_CORS_PROXY === "true";
}

function buildProxyUrl(targetUrl: string): string {
  const base = DEFAULT_PROXY_BASE;
  if (base.includes("url=")) {
    return `${base}${encodeURIComponent(targetUrl)}`;
  }
  return `${base}${targetUrl}`;
}

async function directFetch(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchViaProxy(url: string, init?: RequestInit): Promise<unknown> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Ungültige URL");
  }

  if (!ALLOWED_PROXY_HOSTS.has(parsed.hostname)) {
    throw new Error(`Proxy nicht erlaubt für ${parsed.hostname}`);
  }

  const proxyUrl = buildProxyUrl(url);
  const res = await fetch(proxyUrl, {
    method: init?.method ?? "GET",
    headers: init?.headers,
    body: init?.body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Proxy ${res.status}${text ? `: ${text.slice(0, 80)}` : ""}`
    );
  }

  return res.json();
}

export async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  if (!needsProxy()) {
    return directFetch(url, init);
  }

  try {
    return await fetchViaProxy(url, init);
  } catch (proxyError) {
    const message =
      proxyError instanceof Error ? proxyError.message : "Proxy fehlgeschlagen";
    throw new Error(
      `Datenabruf fehlgeschlagen (${message}). Bitte Seite hart neu laden (Strg+Shift+R) und erneut versuchen.`
    );
  }
}
