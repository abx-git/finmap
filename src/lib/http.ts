function shouldUseCorsProxy(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_USE_CORS_PROXY === "true") return true;
  return window.location.hostname.endsWith("github.io");
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

async function fetchViaAllOrigins(url: string): Promise<unknown> {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error(`AllOrigins ${res.status}`);
  const wrapper = (await res.json()) as { contents?: string };
  if (!wrapper.contents) throw new Error("AllOrigins: leere Antwort");
  return JSON.parse(wrapper.contents);
}

async function fetchViaCorsProxy(url: string, init?: RequestInit): Promise<unknown> {
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl, {
    method: init?.method ?? "GET",
    headers: init?.headers,
    body: init?.body,
  });
  if (!res.ok) throw new Error(`CorsProxy ${res.status}`);
  return res.json();
}

export async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const method = (init?.method ?? "GET").toUpperCase();

  if (!shouldUseCorsProxy()) {
    try {
      return await directFetch(url, init);
    } catch {
      // fall through to proxy
    }
  }

  const errors: string[] = [];

  if (method === "GET") {
    try {
      return await fetchViaAllOrigins(url);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "AllOrigins fehlgeschlagen");
    }
  }

  try {
    return await fetchViaCorsProxy(url, init);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "CorsProxy fehlgeschlagen");
  }

  if (method === "GET") {
    try {
      return await directFetch(url, init);
    } catch {
      // already tried
    }
  }

  throw new Error(
    `Datenabruf fehlgeschlagen (${errors.join(", ") || "CORS"}). Bitte später erneut versuchen.`
  );
}
